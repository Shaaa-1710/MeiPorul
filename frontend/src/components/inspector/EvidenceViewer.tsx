import React from 'react';
import { useChat } from '../../context/ChatContext';
import { renderHighlightedEvidence } from '../../utils/textHighlighter';
import {
  X,
  FileText,
  Copy,
  Check,
} from 'lucide-react';

export const EvidenceViewer: React.FC = () => {
  const {
    activeEvidence,
    activeClaim,
    isEvidenceViewerOpen,
    closeEvidenceViewer,
  } = useChat();

  const [copied, setCopied] = React.useState(false);

  if (!isEvidenceViewerOpen || !activeEvidence) return null;

  const handleCopyText = () => {
    navigator.clipboard.writeText(activeEvidence.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-white border border-gray-300 rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-gray-200 text-gray-700">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                {activeEvidence.document_name}
                {activeEvidence.citation_id && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white text-gray-700 border border-gray-200">
                    {activeEvidence.citation_id}
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-500 font-mono">
                Page {activeEvidence.page} · Section: {activeEvidence.section || 'General'}
              </p>
            </div>
          </div>

          <button
            onClick={closeEvidenceViewer}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Claim Context Banner */}
        {activeClaim && (
          <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-200 flex items-start gap-2 text-xs text-gray-700">
            <span className="font-semibold text-gray-500 shrink-0">Evaluated Claim:</span>
            <span className="italic text-gray-900">"{activeClaim.text}"</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
            <span>Verified Document Context</span>
            {activeEvidence.similarity_score && (
              <span className="font-mono text-[11px] text-gray-600">
                Relevance: {Math.round(activeEvidence.similarity_score * 100)}%
              </span>
            )}
          </div>

          {/* Full document page context with highlighted span */}
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 text-sm leading-relaxed text-gray-900 font-sans">
            <p className="whitespace-pre-wrap select-text">
              {renderHighlightedEvidence(activeEvidence.full_text || activeEvidence.text, activeEvidence.highlight, {
                verdictType: activeClaim?.verdict,
              })}
            </p>
          </div>

          {/* Citation Match Box */}
          <div className="p-3 rounded-lg bg-white border border-gray-200 space-y-1">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">
              Direct Citation Match
            </span>
            <div className="p-2 rounded bg-gray-50 font-mono text-xs text-gray-900 border border-gray-200">
              "{activeEvidence.highlight}"
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <span className="text-xs text-gray-400 font-mono">
            ID: {activeEvidence.document_id}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyText}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-100 border border-gray-200 text-xs text-gray-700 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={closeEvidenceViewer}
              className="px-4 py-1.5 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
