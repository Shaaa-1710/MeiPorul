import React from 'react';
import { useChat } from '../../context/ChatContext';
import { Evidence } from '../../types/evidence';
import {
  X,
  Files,
  FileText,
  ChevronRight,
  BookOpen,
} from 'lucide-react';

export const SourcesDrawer: React.FC = () => {
  const {
    isSourcesDrawerOpen,
    toggleSourcesDrawer,
    activeSession,
    openEvidenceViewer,
  } = useChat();

  if (!isSourcesDrawerOpen) return null;

  const sourcesMap = new Map<
    string,
    {
      docName: string;
      docId: string;
      page: number;
      section: string;
      claimsCount: number;
      evidences: Evidence[];
      verdicts: string[];
    }
  >();

  // Gather sources strictly from the latest audited message or active messages
  if (activeSession) {
    const auditedMessages = activeSession.messages.filter(
      (m) => m.role === 'assistant' && m.claims && m.claims.length > 0
    );
    const targetMessages = auditedMessages.length > 0 ? [auditedMessages[auditedMessages.length - 1]] : [];

    targetMessages.forEach((msg) => {
      msg.claims?.forEach((claim) => {
        claim.evidence?.forEach((ev) => {
          const key = `${ev.document_name}_p${ev.page}`;
          if (!sourcesMap.has(key)) {
            sourcesMap.set(key, {
              docName: ev.document_name,
              docId: ev.document_id,
              page: ev.page,
              section: ev.section,
              claimsCount: 1,
              evidences: [ev],
              verdicts: [claim.verdict],
            });
          } else {
            const entry = sourcesMap.get(key)!;
            entry.claimsCount += 1;
            entry.evidences.push(ev);
            if (!entry.verdicts.includes(claim.verdict)) {
              entry.verdicts.push(claim.verdict);
            }
          }
        });
      });
    });
  }

  const sourcesList = Array.from(sourcesMap.values());

  return (
    <aside className="w-84 sm:w-96 shrink-0 bg-white border-l border-gray-200 flex flex-col h-full z-20 shadow-sm font-sans">
      {/* Drawer Header */}
      <div className="p-3.5 border-b border-gray-200 flex items-center justify-between bg-white">
        <div className="flex items-center gap-2">
          <Files className="w-4 h-4 text-gray-700" />
          <span className="text-xs font-semibold text-gray-900">
            Sources {sourcesList.length > 0 && `(${sourcesList.length})`}
          </span>
        </div>
        <button
          onClick={() => toggleSourcesDrawer(false)}
          className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          title="Close sources drawer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
        Reference documents retrieved for this audit.
      </div>

      {/* Sources List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {sourcesList.length > 0 ? (
          sourcesList.map((src, idx) => {
            const hasContradiction = src.verdicts.includes('CONTRADICTED');
            const hasUncertain = src.verdicts.includes('UNCERTAIN');

            return (
              <div
                key={idx}
                onClick={() => {
                  if (src.evidences.length > 0) {
                    openEvidenceViewer(src.evidences[0]);
                  }
                }}
                className="group p-3 rounded-lg bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 cursor-pointer transition-all text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <FileText className="w-4 h-4 text-gray-400 group-hover:text-gray-700 shrink-0 mt-0.5 transition-colors" />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-semibold text-gray-900 truncate">
                        {src.docName}
                      </h4>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 text-[11px]">
                          Page {src.page}
                        </span>
                        {src.section && (
                          <span className="truncate max-w-[140px] text-[11px] text-gray-400">
                            {src.section}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-600 transition-transform group-hover:translate-x-0.5 shrink-0" />
                </div>

                {/* Evidence snippet */}
                {src.evidences[0] && (
                  <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-600 line-clamp-2">
                    "{src.evidences[0].text}"
                  </div>
                )}

                {/* Bottom status */}
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="text-gray-500">
                    {src.claimsCount} {src.claimsCount === 1 ? 'claim' : 'claims'} verified
                  </span>

                  {hasContradiction ? (
                    <span className="font-medium text-rose-700">
                      ✕ Conflicting
                    </span>
                  ) : hasUncertain ? (
                    <span className="font-medium text-amber-800">
                      ⚠ Inconclusive
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-medium">
                      ✓ Corroborated
                    </span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-12 text-center text-gray-400 text-xs">
            <BookOpen className="w-6 h-6 mx-auto mb-2 opacity-40" />
            <p>No document sources retrieved yet for this audit.</p>
          </div>
        )}
      </div>
    </aside>
  );
};
