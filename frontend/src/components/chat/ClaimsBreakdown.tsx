import React from 'react';
import { Claim } from '../../types/claim';
import { VerdictBadge } from '../common/VerdictBadge';
import { useChat } from '../../context/ChatContext';
import { FileText, ChevronRight, AlertTriangle, X } from 'lucide-react';

interface ClaimsBreakdownProps {
  claims: Claim[];
}

export const ClaimsBreakdown: React.FC<ClaimsBreakdownProps> = ({ claims }) => {
  const { activeClaim, selectClaim } = useChat();

  return (
    <div className="space-y-2 mt-4 font-sans">
      <div className="flex items-center justify-between px-1 mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        <span>Evaluated Claims ({claims.length})</span>
        <span className="text-xs text-gray-400">Click claim to view evidence</span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {claims.map((claim, idx) => {
          const isSelected = activeClaim?.claim_id === claim.claim_id;
          const isContradicted = claim.verdict === 'CONTRADICTED';
          const isUncertain = claim.verdict === 'UNCERTAIN';

          // Card borders and backgrounds based on hierarchy:
          // Problems are flagged (red / amber); normal/supported is quiet
          const getCardStyle = () => {
            if (isSelected) {
              return 'bg-white border-gray-900 shadow-sm ring-1 ring-gray-900';
            }
            if (isContradicted) {
              return 'bg-rose-50/50 hover:bg-rose-50 border-rose-300';
            }
            if (isUncertain) {
              return 'bg-amber-50/60 hover:bg-amber-50 border-amber-300';
            }
            return 'bg-white hover:bg-gray-50 border-gray-200';
          };

          return (
            <div
              key={claim.claim_id || idx}
              onClick={() => selectClaim(claim)}
              className={`group p-3 rounded-lg border transition-all cursor-pointer text-left ${getCardStyle()}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <span className="text-xs font-semibold text-gray-400 pt-0.5 shrink-0">
                    C{idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs sm:text-sm leading-relaxed ${
                      isContradicted ? 'text-rose-950 font-medium' : isUncertain ? 'text-amber-950 font-medium' : 'text-gray-900'
                    }`}>
                      "{claim.text}"
                    </p>

                    {/* Flagged Status Note */}
                    {isContradicted && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-rose-700 font-medium">
                        <X className="w-3 h-3 stroke-[3]" />
                        <span>Evidence conflicts with claim</span>
                      </div>
                    )}
                    {isUncertain && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-800 font-medium">
                        <AlertTriangle className="w-3 h-3 stroke-[2.5]" />
                        <span>Needs review — Insufficient evidence to establish claim</span>
                      </div>
                    )}

                    {/* Evidence Source Pill */}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                      {claim.evidence && claim.evidence.length > 0 ? (
                        <span className="flex items-center gap-1 text-[11px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                          <FileText className="w-3 h-3 text-gray-400" />
                          <span className="truncate max-w-[150px]">
                            {claim.evidence[0].document_name}
                          </span>
                          <span className="text-gray-400">p.{claim.evidence[0].page}</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-400 italic">No retrieved citation</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <VerdictBadge verdict={claim.verdict} confidence={claim.confidence} size="sm" />
                  <ChevronRight
                    className={`w-4 h-4 transition-transform ${
                      isSelected ? 'text-gray-900 translate-x-0.5' : 'text-gray-300 group-hover:text-gray-600'
                    }`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
