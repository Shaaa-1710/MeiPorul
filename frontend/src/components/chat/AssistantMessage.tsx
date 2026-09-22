import React, { useState } from 'react';
import { ChatMessage } from '../../types/session';
import { ClaimDynamicList } from './ClaimDynamicList';
import { useChat } from '../../context/ChatContext';
import { EvidencePopover } from '../inspector/EvidencePopover';
import {
  Shield,
  Check,
  X,
  AlertTriangle,
  Copy,
  Files,
  FileText,
} from 'lucide-react';

interface AssistantMessageProps {
  message: ChatMessage;
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({ message }) => {
  const { toggleSourcesDrawer, activeClaim, selectClaim } = useChat();
  const [viewMode, setViewMode] = useState<'claims' | 'raw'>('claims');
  const [copied, setCopied] = useState(false);
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);

  const claims = message.claims || [];

  const supportedCount = claims.filter((c) => c.verdict === 'SUPPORTED').length;
  const contradictedCount = claims.filter((c) => c.verdict === 'CONTRADICTED').length;
  const uncertainCount = claims.filter((c) => c.verdict === 'UNCERTAIN').length;
  const partialCount = claims.filter((c) => c.verdict === 'PARTIALLY_SUPPORTED').length;

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenEvidence = () => {
    // If activeClaim is not part of this message's claims, default to claim 1
    const isClaimInThisMessage = claims.some((c) => c.claim_id === activeClaim?.claim_id);
    if (!isClaimInThisMessage && claims.length > 0) {
      selectClaim(claims[0]);
    }
    setIsEvidenceOpen(true);
  };

  return (
    <div className="w-full py-3.5 flex gap-3 text-gray-900 font-sans">
      {/* Restrained Assistant Logo */}
      <div className="w-7 h-7 rounded-md bg-gray-900 text-white flex items-center justify-center shrink-0 mt-0.5">
        <Shield className="w-3.5 h-3.5" />
      </div>

      <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-xl p-4 shadow-2xs">
        {/* Top Header Bar: Verdict Summary Chips */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-gray-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-800">Audited Answer</span>

            {/* Verdict summary chips (Hierarchy: problems flagged red & amber, supported quiet) */}
            {claims.length > 0 && (
              <div className="flex items-center gap-1.5 ml-1">
                {contradictedCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-100 border border-rose-300 text-rose-900 shadow-2xs">
                    <X className="w-3 h-3 text-rose-700 stroke-[3]" />
                    <span>{contradictedCount} Contradicted</span>
                  </span>
                )}
                {uncertainCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-200 border border-amber-400 text-amber-950 shadow-2xs">
                    <AlertTriangle className="w-3 h-3 text-amber-800 stroke-[2.5]" />
                    <span>{uncertainCount} Uncertain (Needs review)</span>
                  </span>
                )}
                {partialCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800">
                    <AlertTriangle className="w-3 h-3 text-amber-700 stroke-[2]" />
                    <span>{partialCount} Partial</span>
                  </span>
                )}
                {supportedCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-normal px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <Check className="w-3 h-3 text-emerald-700 stroke-[2]" />
                    <span>{supportedCount} Supported</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Toggle between Dynamic Claim List and Raw Answer Text */}
          {claims.length > 0 && (
            <div className="flex items-center rounded-md bg-gray-100 p-0.5 border border-gray-200 text-xs">
              <button
                onClick={() => setViewMode('claims')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                  viewMode === 'claims'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Audited Claims ({claims.length})
              </button>
              <button
                onClick={() => setViewMode('raw')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                  viewMode === 'raw'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Full Text
              </button>
            </div>
          )}
        </div>

        {/* Message Content: Dynamic Claim List vs Raw Text */}
        {claims.length > 0 && viewMode === 'claims' ? (
          <div className="space-y-3 font-normal">
            <ClaimDynamicList
              claims={claims}
              onOpenEvidence={(claim) => {
                selectClaim(claim);
                setIsEvidenceOpen(true);
              }}
            />
          </div>
        ) : (
          <div className="text-sm leading-relaxed text-gray-800 font-normal whitespace-pre-wrap">
            {message.content}
          </div>
        )}

        {/* Simplified User-Facing Research Footer */}
        <div className="mt-3.5 pt-2.5 border-t border-gray-100 flex items-center justify-end gap-1">
          <button
            onClick={handleOpenEvidence}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
            title="Inspect retrieved evidence for this answer"
          >
            <FileText className="w-3.5 h-3.5 text-gray-400" />
            <span className="font-medium">Evidence</span>
          </button>

          <button
            onClick={() => toggleSourcesDrawer(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
            title="Inspect retrieved source documents"
          >
            <Files className="w-3.5 h-3.5 text-gray-400" />
            <span className="font-medium">Sources</span>
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
            title="Copy answer text"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                <span className="font-medium text-emerald-700">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-gray-400" />
                <span className="font-medium">Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Contextual Evidence Popover */}
      {isEvidenceOpen && (
        <EvidencePopover
          claims={claims}
          isOpen={isEvidenceOpen}
          initialClaimId={activeClaim?.claim_id || claims[0]?.claim_id}
          onClose={() => setIsEvidenceOpen(false)}
        />
      )}
    </div>
  );
};
