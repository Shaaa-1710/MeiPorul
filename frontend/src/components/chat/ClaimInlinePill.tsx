import React from 'react';
import { Claim } from '../../types/claim';
import { useChat } from '../../context/ChatContext';
import { Check, X, AlertTriangle, HelpCircle } from 'lucide-react';

interface ClaimInlinePillProps {
  claim: Claim;
  index: number;
}

export const ClaimInlinePill: React.FC<ClaimInlinePillProps> = ({ claim, index }) => {
  const { activeClaim, selectClaim } = useChat();
  const isSelected = activeClaim?.claim_id === claim.claim_id;

  const getVerdictClass = () => {
    switch (claim.verdict) {
      case 'SUPPORTED':
        // Quiet confirmation: subtle green tint, blends quietly
        return 'claim-interactive-supported';
      case 'CONTRADICTED':
        // Strong interrupt: red flag
        return 'claim-interactive-contradicted';
      case 'UNCERTAIN':
        // Strong interrupt: amber flag
        return 'claim-interactive-uncertain';
      case 'PARTIALLY_SUPPORTED':
        return 'claim-interactive-partial';
      case 'NOT_ENTAILED':
        return 'claim-interactive-not-entailed';
      default:
        return 'claim-interactive-unverifiable';
    }
  };

  const renderIndicator = () => {
    switch (claim.verdict) {
      case 'SUPPORTED':
        // Quiet, subtle indicator
        return (
          <span className="inline-flex items-center gap-0.5 ml-1 text-emerald-700 select-none font-mono text-[10px]">
            <Check className="w-3 h-3 text-emerald-600 inline stroke-[2.5]" />
            <span className="text-emerald-800/80">[{index + 1}]</span>
          </span>
        );
      case 'CONTRADICTED':
        // Strong attention interrupt: Red Flag
        return (
          <span className="inline-flex items-center gap-1 ml-1.5 px-1.5 py-0.5 rounded bg-rose-100 border border-rose-400 text-rose-900 select-none font-sans text-[10px] font-bold tracking-tight shadow-2xs">
            <X className="w-3 h-3 text-rose-700 inline stroke-[3]" />
            <span>✕ CONTRADICTED</span>
          </span>
        );
      case 'UNCERTAIN':
        // Strong attention interrupt: Amber Flag + Needs Review
        return (
          <span className="inline-flex items-center gap-1 ml-1.5 px-1.5 py-0.5 rounded bg-amber-200 border border-amber-400 text-amber-950 select-none font-sans text-[10px] font-bold tracking-tight shadow-2xs">
            <AlertTriangle className="w-3 h-3 text-amber-800 inline stroke-[2.5]" />
            <span>⚠ UNCERTAIN · Needs review</span>
          </span>
        );
      case 'PARTIALLY_SUPPORTED':
        return (
          <span className="inline-flex items-center gap-1 ml-1.5 px-1.5 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-900 select-none font-sans text-[10px] font-semibold">
            <AlertTriangle className="w-3 h-3 text-amber-700 inline stroke-[2]" />
            <span>⚠ PARTIAL</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-0.5 ml-1 text-gray-500 font-mono text-[10px] select-none">
            <HelpCircle className="w-3 h-3 text-gray-400 inline" />
            <span>[{index + 1}]</span>
          </span>
        );
    }
  };

  return (
    <span
      onClick={() => selectClaim(claim)}
      title={`Claim ${index + 1}: ${claim.verdict}. Click to inspect evidence and verification cascade.`}
      className={`claim-interactive ${getVerdictClass()} ${
        isSelected ? 'ring-2 ring-gray-900 ring-offset-1 font-medium' : ''
      }`}
    >
      <span>{claim.text}</span>
      {renderIndicator()}
    </span>
  );
};
