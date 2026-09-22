import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ConversationSession, ChatMessage } from '../types/session';
import { Claim } from '../types/claim';
import { Evidence } from '../types/evidence';
import { PipelineStage } from '../types/api';
import { queryService } from '../services/queryService';
import { documentService } from '../services/documentService';
import { useSettings } from './SettingsContext';
import { INITIAL_CONVERSATION_SESSIONS } from '../services/mockData';

interface ChatContextType {
  sessions: ConversationSession[];
  activeSessionId: string | null;
  activeSession: ConversationSession | null;
  activeClaim: Claim | null;
  activeEvidence: Evidence | null;
  isEvidenceViewerOpen: boolean;
  isSourcesDrawerOpen: boolean;
  isSidebarOpen: boolean;
  isGenerating: boolean;
  currentStage: PipelineStage;
  stageDetail: string;
  searchFilter: string;
  corpusCount: number;
  setSearchFilter: (term: string) => void;
  toggleSidebar: () => void;
  selectSession: (id: string) => void;
  createNewSession: () => string;
  deleteSession: (id: string) => void;
  clearAllSessions: () => void;
  loadDemoData: () => Promise<void>;
  sendMessage: (text: string, selectedDocIds?: string[]) => Promise<void>;
  selectClaim: (claim: Claim | null) => void;
  openEvidenceViewer: (evidence: Evidence) => void;
  closeEvidenceViewer: () => void;
  toggleSourcesDrawer: (open?: boolean) => void;
  refreshCorpusCount: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);
const SESSIONS_STORAGE_KEY = 'rag_auditor_v2_sessions';

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useSettings();

  // STRICTLY EMPTY BY DEFAULT
  const [sessions, setSessions] = useState<ConversationSession[]>(() => {
    try {
      const stored = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse stored sessions', e);
    }
    return [];
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    return null;
  });

  const [corpusCount, setCorpusCount] = useState<number>(0);
  const [activeClaim, setActiveClaim] = useState<Claim | null>(null);
  const [activeEvidence, setActiveEvidence] = useState<Evidence | null>(null);
  const [isEvidenceViewerOpen, setIsEvidenceViewerOpen] = useState<boolean>(false);
  const [isSourcesDrawerOpen, setIsSourcesDrawerOpen] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [currentStage, setCurrentStage] = useState<PipelineStage>('idle');
  const [stageDetail, setStageDetail] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const isSubmittingRef = useRef<boolean>(false);

  const refreshCorpusCount = useCallback(async () => {
    const docs = await documentService.getDocuments();
    setCorpusCount(docs.length);
  }, []);

  useEffect(() => {
    refreshCorpusCount();
  }, [refreshCorpusCount]);

  // Persist sessions
  useEffect(() => {
    try {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.warn('Failed to save sessions to localStorage', e);
    }
  }, [sessions]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  const selectSession = useCallback((id: string) => {
    setActiveSessionId(id);
    setActiveClaim(null);
    setIsEvidenceViewerOpen(false);
  }, []);

  const createNewSession = useCallback((): string => {
    const newId = `conv_${Date.now()}`;
    const newSession: ConversationSession = {
      id: newId,
      title: 'New Audit',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      selectedDocumentIds: [],
    };

    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newId);
    setActiveClaim(null);
    return newId;
  }, []);

  const deleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const filtered = prev.filter((s) => s.id !== id);
        if (activeSessionId === id) {
          setActiveSessionId(filtered.length > 0 ? filtered[0].id : null);
          setActiveClaim(null);
        }
        return filtered;
      });
      showToast('Audit deleted', 'info');
    },
    [activeSessionId, showToast]
  );

  const clearAllSessions = useCallback(() => {
    setSessions([]);
    setActiveSessionId(null);
    setActiveClaim(null);
    localStorage.removeItem(SESSIONS_STORAGE_KEY);
    showToast('Audit history cleared', 'info');
  }, [showToast]);

  const loadDemoData = useCallback(async () => {
    await documentService.loadDemoDocuments();
    const demoSessions = JSON.parse(JSON.stringify(INITIAL_CONVERSATION_SESSIONS));
    setSessions(demoSessions);
    if (demoSessions.length > 0) {
      setActiveSessionId(demoSessions[0].id);
      if (demoSessions[0].messages.length > 1 && demoSessions[0].messages[1].claims) {
        setActiveClaim(demoSessions[0].messages[1].claims[0]);
      }
    }
    await refreshCorpusCount();
    showToast('Demo evaluation dataset loaded', 'success');
  }, [refreshCorpusCount, showToast]);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const selectClaim = useCallback((claim: Claim | null) => {
    setActiveClaim(claim);
    if (claim && claim.evidence && claim.evidence.length > 0) {
      setActiveEvidence(claim.evidence[0]);
    }
  }, []);

  const openEvidenceViewer = useCallback((evidence: Evidence) => {
    setActiveEvidence(evidence);
    setIsEvidenceViewerOpen(true);
  }, []);

  const closeEvidenceViewer = useCallback(() => {
    setIsEvidenceViewerOpen(false);
  }, []);

  const toggleSourcesDrawer = useCallback((open?: boolean) => {
    setIsSourcesDrawerOpen((prev) => (open !== undefined ? open : !prev));
  }, []);

  const sendMessage = async (text: string, selectedDocIds?: string[]) => {
    const trimmed = text.trim();
    if (!trimmed || isGenerating || isSubmittingRef.current) return;

    // Synchronous lock immediately acquired
    isSubmittingRef.current = true;
    setIsGenerating(true);
    setCurrentStage('retrieving');
    setStageDetail('Checking indexed corpus...');

    // Atomically determine session ID to avoid double-session race conditions
    let targetSessionId = activeSessionId;
    const isNewSession = !targetSessionId;
    if (isNewSession) {
      targetSessionId = `conv_${Date.now()}`;
      setActiveSessionId(targetSessionId);
    }

    const userMsgId = `msg_u_${Date.now()}`;
    const userMessage: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    const cleanTitle = trimmed.length > 40 ? `${trimmed.slice(0, 40).trim()}...` : trimmed;

    setSessions((prev) => {
      if (isNewSession) {
        const newSession: ConversationSession = {
          id: targetSessionId!,
          title: cleanTitle,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [userMessage],
          selectedDocumentIds: selectedDocIds || [],
        };
        return [newSession, ...prev];
      }

      return prev.map((s) => {
        if (s.id === targetSessionId) {
          const isFirstMessage = s.messages.length === 0;
          return {
            ...s,
            title: isFirstMessage ? cleanTitle : s.title,
            updatedAt: new Date().toISOString(),
            messages: [...s.messages, userMessage],
          };
        }
        return s;
      });
    });

    try {
      const response = await queryService.submitQuery(
        {
          query: trimmed,
          document_ids: selectedDocIds,
        },
        (stage, detail) => {
          setCurrentStage(stage);
          setStageDetail(detail);
        }
      );

      const assistantMsgId = `msg_a_${Date.now()}`;
      const assistantMessage: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: response.answer,
        timestamp: new Date().toISOString(),
        claims: response.claims,
        metrics: response.metrics,
        provenance: response.provenance,
        isAudited: true,
        isMock: response.is_mock_data ?? false,
      };

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === targetSessionId) {
            // Guard against duplicate assistant messages
            if (s.messages.some((m) => m.id === assistantMsgId)) {
              return s;
            }
            return {
              ...s,
              updatedAt: new Date().toISOString(),
              messages: [...s.messages, assistantMessage],
            };
          }
          return s;
        })
      );

      // Default select the first contradicted claim or uncertain claim for instant inspection
      if (response.claims && response.claims.length > 0) {
        const flagged =
          response.claims.find((c) => c.verdict === 'CONTRADICTED') ||
          response.claims.find((c) => c.verdict === 'UNCERTAIN') ||
          response.claims[0];
        setActiveClaim(flagged);
        if (flagged.evidence && flagged.evidence.length > 0) {
          setActiveEvidence(flagged.evidence[0]);
        }
      }
    } catch (err: any) {
      console.error('Audit execution error:', err);
      // Clean, actionable user error message (never expose raw unhandled TypeError: Failed to fetch)
      const errorMsg =
        err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError')
          ? 'Unable to connect to the audit backend. Check the backend connection.'
          : err?.message || 'Audit execution failed. Please try again.';
      showToast(errorMsg, 'error');
      setCurrentStage('error');
      setStageDetail(errorMsg);
    } finally {
      isSubmittingRef.current = false;
      setIsGenerating(false);
      setTimeout(() => {
        setCurrentStage('idle');
      }, 800);
    }
  };

  return (
    <ChatContext.Provider
      value={{
        sessions,
        activeSessionId,
        activeSession,
        activeClaim,
        activeEvidence,
        isEvidenceViewerOpen,
        isSourcesDrawerOpen,
        isSidebarOpen,
        isGenerating,
        currentStage,
        stageDetail,
        searchFilter,
        corpusCount,
        setSearchFilter,
        toggleSidebar,
        selectSession,
        createNewSession,
        deleteSession,
        clearAllSessions,
        loadDemoData,
        sendMessage,
        selectClaim,
        openEvidenceViewer,
        closeEvidenceViewer,
        toggleSourcesDrawer,
        refreshCorpusCount,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
