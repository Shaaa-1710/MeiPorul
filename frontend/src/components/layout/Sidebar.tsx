import React from 'react';
import { useChat } from '../../context/ChatContext';
import {
  Shield,
  Plus,
  Search,
  MessageSquare,
  BookOpen,
  BarChart2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { ConversationSession } from '../../types/session';

interface SidebarProps {
  currentView: 'chat' | 'knowledge' | 'analytics';
  onNavigate: (view: 'chat' | 'knowledge' | 'analytics') => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  onOpenSettings,
}) => {
  const {
    sessions,
    activeSessionId,
    selectSession,
    createNewSession,
    deleteSession,
    isSidebarOpen,
    toggleSidebar,
    searchFilter,
    setSearchFilter,
    corpusCount,
    loadDemoData,
  } = useChat();

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const now = new Date().getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;

  const todaySessions: ConversationSession[] = [];
  const yesterdaySessions: ConversationSession[] = [];
  const previousSessions: ConversationSession[] = [];

  filteredSessions.forEach((session) => {
    const sessionTime = new Date(session.updatedAt).getTime();
    const diff = now - sessionTime;
    if (diff < oneDayMs) {
      todaySessions.push(session);
    } else if (diff < 2 * oneDayMs) {
      yesterdaySessions.push(session);
    } else {
      previousSessions.push(session);
    }
  });

  const renderSection = (title: string, list: ConversationSession[]) => {
    return (
      <div className="mb-4">
        <h4 className="px-3 text-[11px] font-semibold tracking-wider text-gray-400 uppercase mb-1.5">
          {title}
        </h4>
        {list.length > 0 ? (
          <div className="space-y-0.5">
            {list.map((session) => {
              const isActive = session.id === activeSessionId && currentView === 'chat';
              const hasContradicted = session.messages.some((m) =>
                m.claims?.some((c) => c.verdict === 'CONTRADICTED')
              );
              const hasUncertain = session.messages.some((m) =>
                m.claims?.some((c) => c.verdict === 'UNCERTAIN')
              );

              return (
                <div
                  key={session.id}
                  onClick={() => {
                    selectSession(session.id);
                    onNavigate('chat');
                  }}
                  className={`group relative flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-gray-200/80 text-gray-900 font-medium'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                    <div className="shrink-0 relative">
                      <MessageSquare className={`w-3.5 h-3.5 ${isActive ? 'text-gray-900' : 'text-gray-400'}`} />
                      {hasContradicted && (
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-rose-600 ring-1 ring-white" />
                      )}
                      {!hasContradicted && hasUncertain && (
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 ring-1 ring-white" />
                      )}
                    </div>
                    <span className="truncate text-xs leading-relaxed">{session.title}</span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(session.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-600 text-gray-400 transition-opacity rounded"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-3 py-1 text-xs text-gray-400 font-normal">
            No audits yet
          </div>
        )}
      </div>
    );
  };

  if (!isSidebarOpen) {
    return (
      <aside className="w-14 shrink-0 bg-[#F9FAFB] border-r border-gray-200 flex flex-col items-center py-3 justify-between z-20">
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            title="Expand Sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              createNewSession();
              onNavigate('chat');
            }}
            className="p-2.5 rounded-lg bg-gray-900 text-white hover:bg-black transition-colors"
            title="New Audit"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => onNavigate('knowledge')}
            className={`p-2 rounded-lg transition-colors ${
              currentView === 'knowledge'
                ? 'text-gray-900 bg-gray-200'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="Knowledge Corpus"
          >
            <BookOpen className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigate('analytics')}
            className={`p-2 rounded-lg transition-colors ${
              currentView === 'analytics'
                ? 'text-gray-900 bg-gray-200'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="Audit Analytics"
          >
            <BarChart2 className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-64 shrink-0 bg-[#F9FAFB] border-r border-gray-200 flex flex-col justify-between h-full select-none z-20">
      {/* Top Header */}
      <div className="p-3 pb-2">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gray-900 flex items-center justify-center text-white">
              <Shield className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-sm tracking-tight text-gray-900">
              RAG Auditor
            </span>
          </div>
          <button
            onClick={toggleSidebar}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
            title="Collapse Sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* New Audit Button */}
        <button
          onClick={() => {
            createNewSession();
            onNavigate('chat');
          }}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-medium transition-colors shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Audit</span>
        </button>

        {/* Search Filter */}
        <div className="relative mt-2.5">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search audits..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gray-400 transition-colors"
          />
        </div>
      </div>

      {/* History List with Empty States */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {renderSection('Today', todaySessions)}
        {renderSection('Yesterday', yesterdaySessions)}
        {renderSection('Previous 7 Days', previousSessions)}
      </div>

      {/* Bottom Navigation */}
      <div className="p-2 border-t border-gray-200 bg-[#F9FAFB] space-y-0.5">
        <button
          onClick={() => onNavigate('knowledge')}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
            currentView === 'knowledge'
              ? 'bg-gray-200 text-gray-900 font-medium'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-4 h-4 text-gray-500" />
            <span>Knowledge Corpus</span>
          </div>
          {corpusCount > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-gray-200 text-gray-600">
              {corpusCount} {corpusCount === 1 ? 'doc' : 'docs'}
            </span>
          )}
        </button>

        <button
          onClick={() => onNavigate('analytics')}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
            currentView === 'analytics'
              ? 'bg-gray-200 text-gray-900 font-medium'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <BarChart2 className="w-4 h-4 text-gray-500" />
            <span>Audit Analytics</span>
          </div>
        </button>

        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          <Settings className="w-4 h-4 text-gray-500" />
          <span>Settings</span>
        </button>

        {/* Optional Demo Loader Action */}
        <div className="pt-2 mt-1 border-t border-gray-200/60 px-2 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-700 font-medium flex items-center justify-center text-[10px] shrink-0">
              RA
            </div>
            <div className="truncate">
              <p className="text-xs font-medium text-gray-800 truncate">RAG Auditor</p>
              <p className="text-[10px] text-gray-400 truncate">research workspace</p>
            </div>
          </div>

          <button
            onClick={() => loadDemoData()}
            className="text-[10px] text-gray-500 hover:text-gray-900 underline font-mono cursor-pointer"
            title="Explicitly load sample evaluation scenarios"
          >
            Load Demo Data
          </button>
        </div>
      </div>
    </aside>
  );
};
