import React from 'react';
import { Claim, ClaimVerdict } from '../../types/claim';
import { useChat } from '../../context/ChatContext';
import { Check, AlertTriangle, X, HelpCircle, FileText, ChevronRight } from 'lucide-react';

interface ClaimDynamicListProps {
  claims: Claim[];
  onOpenEvidence?: (claim: Claim) => void;
}

export const ClaimDynamicList: React.FC<ClaimDynamicListProps> = ({
  claims,
  onOpenEvidence,
}) => {
  const { activeClaim, selectClaim } = useChat();

  if (!claims || claims.length === 0) {
    return null;
  }

  const renderStatusIcon = (verdict: ClaimVerdict) => {
    switch (verdict) {
      case 'SUPPORTED':
        return (
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 select-none"
            title="Supported"
          >
            <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
          </span>
        );
      case 'PARTIALLY_SUPPORTED':
        return (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-300 shrink-0 select-none"
            title="Partially Supported"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700 stroke-[2]" />
            <span>Partial</span>
          </span>
        );
      case 'UNCERTAIN':
        return (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold bg-amber-200 text-amber-950 border border-amber-400 shrink-0 select-none shadow-2xs"
            title="Uncertain — Needs review"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-800 stroke-[2.5]" />
            <span>Needs review</span>
          </span>
        );
      case 'CONTRADICTED':
        return (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-900 border border-rose-300 shrink-0 select-none shadow-2xs"
            title="Contradicted — Evidence conflicts with claim"
          >
            <X className="w-3.5 h-3.5 text-rose-700 stroke-[3]" />
            <span>Conflicts</span>
          </span>
        );
      case 'NOT_ENTAILED':
      case 'NOT_VERIFIABLE':
      default:
        return (
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded bg-gray-100 text-gray-500 border border-gray-200 shrink-0 select-none"
            title="Not verifiable"
          >
            <HelpCircle className="w-3.5 h-3.5 stroke-[2]" />
          </span>
        );
    }
  };

  const getCardStyle = (claim: Claim, isSelected: boolean) => {
    if (isSelected) {
      return 'border-gray-900 bg-white ring-1 ring-gray-900 shadow-2xs';
    }
    switch (claim.verdict) {
      case 'CONTRADICTED':
        return 'border-rose-300 bg-rose-50/40 hover:bg-rose-50/70';
      case 'UNCERTAIN':
        return 'border-amber-300 bg-amber-50/40 hover:bg-amber-50/70';
      case 'PARTIALLY_SUPPORTED':
        return 'border-amber-200 bg-amber-50/20 hover:bg-amber-50/40';
      case 'SUPPORTED':
      default:
        return 'border-gray-200 bg-white hover:bg-gray-50/80 hover:border-gray-300';
    }
  };

  return (
    <ol className="space-y-2.5 list-none p-0 m-0">
      {claims.map((claim, idx) => {
        const isSelected = activeClaim?.claim_id === claim.claim_id;
        const hasEvidence = claim.evidence && claim.evidence.length > 0;
        const primaryEvidence = hasEvidence ? claim.evidence[0] : null;

        // Evidence citation text: use citation_id if provided by backend, otherwise document name & page
        const evidenceRefText = primaryEvidence
          ? `${primaryEvidence.citation_id ? `[${primaryEvidence.citation_id}] ` : ''}${primaryEvidence.document_name} · p. ${primaryEvidence.page}`
          : null;

        const handleRowClick = () => {
          selectClaim(claim);
        };

        const handleEvidenceClick = (e: React.MouseEvent) => {
          e.stopPropagation();
          selectClaim(claim);
          if (onOpenEvidence) {
            onOpenEvidence(claim);
          }
        };

        return (
          <li
            key={claim.claim_id || idx}
            onClick={handleRowClick}
            className={`group relative flex items-start gap-3 p-3 sm:p-3.5 rounded-lg border transition-all cursor-pointer text-left ${getCardStyle(
              claim,
              isSelected
            )}`}
          >
            {/* Dynamic Claim Number in clean UI font (font-sans) */}
            <span className="font-sans text-xs sm:text-sm font-semibold text-gray-500 pt-0.5 select-none shrink-0 w-5 text-right">
              {idx + 1}.
            </span>

            {/* Verdict Status Icon / Badge */}
            <div className="shrink-0 pt-0.5">
              {renderStatusIcon(claim.verdict)}
            </div>

            {/* Claim Content Area */}
            <div className="min-w-0 flex-1">
              {/* Claim Text with exact whitespace-pre-wrap & break-words for formulas/math */}
              <div className="font-sans text-sm text-gray-900 leading-relaxed font-normal whitespace-pre-wrap break-words">
                {claim.text}
              </div>

              {/* Explanatory notes for attention-interrupt verdicts */}
              {claim.verdict === 'CONTRADICTED' && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-rose-800 font-semibold">
                  <X className="w-3.5 h-3.5 text-rose-700 stroke-[3]" />
                  <span>Evidence conflicts with claim</span>
                </div>
              )}
              {claim.verdict === 'UNCERTAIN' && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-900 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-800 stroke-[2.5]" />
                  <span>Needs review — Insufficient evidence to establish claim</span>
                </div>
              )}

              {/* Evidence Reference Row */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {hasEvidence && primaryEvidence ? (
                  <button
                    type="button"
                    onClick={handleEvidenceClick}
                    className="inline-flex items-center gap-1.5 text-xs font-normal text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 px-2 py-0.5 rounded border border-gray-200 transition-colors group/ev cursor-pointer select-none"
                    title={`Inspect evidence in ${primaryEvidence.document_name}`}
                  >
                    <FileText className="w-3.5 h-3.5 text-gray-400 group-hover/ev:text-gray-600" />
                    <span>{evidenceRefText}</span>
                  </button>
                ) : (
                  <span className="inline-flex items-center text-xs text-gray-400 italic select-none">
                    No supporting evidence found
                  </span>
                )}
              </div>
            </div>

            {/* Right Chevron / Selection Indicator */}
            <div className="shrink-0 pt-1 text-gray-300 group-hover:text-gray-500 transition-colors hidden sm:block">
              <ChevronRight
                className={`w-4 h-4 transition-transform ${
                  isSelected ? 'text-gray-900 translate-x-0.5' : ''
                }`}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
};
