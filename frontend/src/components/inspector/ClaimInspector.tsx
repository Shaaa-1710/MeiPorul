import React from 'react';
import { useChat } from '../../context/ChatContext';
import { VerdictBadge } from '../common/VerdictBadge';
import { CascadePipeline } from './CascadePipeline';
import { renderHighlightedEvidence } from '../../utils/textHighlighter';
import {
  X,
  FileText,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  AlertTriangle,
  Check,
} from 'lucide-react';

export const ClaimInspector: React.FC = () => {
  const {
    activeClaim,
    selectClaim,
    activeSession,
    openEvidenceViewer,
  } = useChat();

  if (!activeClaim) return null;

  // Gather all claims in current session
  const allClaims = activeSession?.messages.flatMap((m) => m.claims || []) || [];
  const currentIndex = allClaims.findIndex((c) => c.claim_id === activeClaim.claim_id);
  const relatedClaims = allClaims.filter((c) => c.claim_id !== activeClaim.claim_id);

  const handlePrev = () => {
    if (currentIndex > 0) {
      selectClaim(allClaims[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (currentIndex < allClaims.length - 1) {
      selectClaim(allClaims[currentIndex + 1]);
    }
  };

  const primaryEvidence = activeClaim.evidence && activeClaim.evidence.length > 0
    ? activeClaim.evidence[0]
    : null;

  const renderLargeVerdictHeader = () => {
    switch (activeClaim.verdict) {
      case 'CONTRADICTED':
        return (
          <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-950 space-y-1">
            <div className="flex items-center gap-2 font-bold text-base tracking-tight text-rose-800">
              <X className="w-5 h-5 text-rose-700 stroke-[3]" />
              <span>✕ CONTRADICTED</span>
            </div>
            <p className="text-xs text-rose-800 font-medium">
              Evidence conflicts with claim.
            </p>
          </div>
        );
      case 'UNCERTAIN':
        return (
          <div className="p-3.5 rounded-lg bg-amber-100 border border-amber-400 text-amber-950 space-y-1">
            <div className="flex items-center gap-2 font-bold text-base tracking-tight text-amber-900">
              <AlertTriangle className="w-5 h-5 text-amber-800 stroke-[2.5]" />
              <span>⚠ UNCERTAIN</span>
            </div>
            <p className="text-xs text-amber-900 font-medium leading-relaxed">
              Evidence does not provide enough information to confidently verify this claim.
            </p>
          </div>
        );
      case 'PARTIALLY_SUPPORTED':
        return (
          <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 space-y-1">
            <div className="flex items-center gap-2 font-bold text-base tracking-tight text-amber-800">
              <AlertTriangle className="w-5 h-5 text-amber-700 stroke-[2]" />
              <span>⚠ PARTIALLY SUPPORTED</span>
            </div>
            <p className="text-xs text-amber-800 font-medium">
              Certain conditions corroborated, but key boundaries remain unestablished.
            </p>
          </div>
        );
      case 'SUPPORTED':
      default:
        return (
          <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1">
            <div className="flex items-center gap-2 font-bold text-base tracking-tight text-emerald-800">
              <Check className="w-5 h-5 text-emerald-700 stroke-[2.5]" />
              <span>✓ SUPPORTED</span>
            </div>
            <p className="text-xs text-emerald-700">
              Verified against retrieved reference evidence.
            </p>
          </div>
        );
    }
  };

  return (
    <aside className="w-84 sm:w-96 shrink-0 bg-white border-l border-gray-200 flex flex-col h-full z-20 shadow-sm">
      {/* Top Header */}
      <div className="p-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-800">
            Claim Details
          </span>
          {currentIndex !== -1 && (
            <span className="text-xs text-gray-500">
              ({currentIndex + 1} of {allClaims.length})
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handlePrev}
            disabled={currentIndex <= 0}
            className="p-1 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Previous Claim"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleNext}
            disabled={currentIndex === -1 || currentIndex >= allClaims.length - 1}
            className="p-1 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Next Claim"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => selectClaim(null)}
            className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors ml-1"
            title="Close Claim Details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-left">
        {/* Large Semantic Verdict Banner */}
        {renderLargeVerdictHeader()}

        {/* Claim Text */}
        <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 space-y-1.5">
          <span className="text-[11px] uppercase tracking-wider text-gray-400 font-medium block">
            Audited Claim
          </span>
          <p className="text-sm font-medium text-gray-900 leading-relaxed">
            "{activeClaim.text}"
          </p>
        </div>

        {/* Why the claim received the verdict */}
        {activeClaim.verification.escalation_reason && (
          <div className="p-3 rounded-lg bg-white border border-gray-200 space-y-1 text-xs">
            <span className="text-[11px] uppercase tracking-wider text-gray-500 font-medium block">
              Audit Findings
            </span>
            <p className="text-xs text-gray-700 leading-relaxed">
              {activeClaim.verification.escalation_reason}
            </p>
          </div>
        )}

        {/* Evidence */}
        <div className="p-3 rounded-lg bg-white border border-gray-200 space-y-2.5">
          <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-900">
              <FileText className="w-3.5 h-3.5 text-gray-500" />
              <span>Retrieved Evidence</span>
            </div>
            {primaryEvidence?.citation_id && (
              <span className="text-[11px] px-1.5 py-0.2 rounded bg-gray-100 text-gray-600 border border-gray-200">
                {primaryEvidence.citation_id}
              </span>
            )}
          </div>

          {primaryEvidence ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
                <span className="font-medium text-gray-800 truncate max-w-[170px] bg-gray-100 px-1.5 py-0.5 rounded">
                  {primaryEvidence.document_name}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[11px]">
                  Page {primaryEvidence.page}
                </span>
                {primaryEvidence.chunk_id && (
                  <span className="px-1.5 py-0.5 rounded bg-gray-100 text-[10px] text-gray-500 truncate max-w-[130px]" title={primaryEvidence.chunk_id}>
                    {primaryEvidence.chunk_id}
                  </span>
                )}
                {primaryEvidence.section && (
                  <span className="text-gray-500 truncate max-w-[130px] text-[11px]">
                    · {primaryEvidence.section}
                  </span>
                )}
              </div>

              {/* Exact Highlighted Evidence Span */}
              <div className="p-2.5 rounded bg-gray-50 border border-gray-200 text-xs leading-relaxed text-gray-800">
                <p className="whitespace-pre-wrap select-text">
                  {renderHighlightedEvidence(primaryEvidence.text, primaryEvidence.highlight, {
                    verdictType: activeClaim.verdict,
                  })}
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-gray-500">
                  {activeClaim.verdict === 'CONTRADICTED'
                    ? 'Highlighted text conflicts with claim'
                    : activeClaim.verdict === 'UNCERTAIN'
                    ? 'Available text omits required proof'
                    : 'Highlighted text corroborates claim'}
                </span>
                <button
                  onClick={() => openEvidenceViewer(primaryEvidence)}
                  className="flex items-center gap-1 text-[11px] text-gray-700 hover:text-black font-medium transition-colors"
                >
                  <span>Inspect context</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-gray-400 text-xs">
              No matching evidence span found in indexed corpus.
            </div>
          )}
        </div>

        {/* Verification Pipeline Cascade */}
        <CascadePipeline
          cascade={activeClaim.verification}
          verdict={activeClaim.verdict}
          confidence={activeClaim.confidence}
        />

        {/* Related Claims in this audit */}
        {relatedClaims.length > 0 && (
          <div className="pt-2 border-t border-gray-200 space-y-2">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">
              Related Claims in this Audit
            </span>
            <div className="space-y-1.5">
              {relatedClaims.map((rc) => (
                <div
                  key={rc.claim_id}
                  onClick={() => selectClaim(rc)}
                  className="p-2 rounded bg-gray-50 hover:bg-gray-100 border border-gray-200 cursor-pointer transition-colors flex items-center justify-between gap-2"
                >
                  <p className="text-xs text-gray-800 truncate flex-1">
                    "{rc.text}"
                  </p>
                  <VerdictBadge verdict={rc.verdict} size="sm" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
