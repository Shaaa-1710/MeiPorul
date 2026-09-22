import React from 'react';
import { ClaimVerdict } from '../../types/claim';

interface ConfidenceBarProps {
  confidence: number; // 0 to 1
  verdict?: ClaimVerdict;
  showLabel?: boolean;
}

export const ConfidenceBar: React.FC<ConfidenceBarProps> = ({
  confidence,
  verdict,
  showLabel = true,
}) => {
  const percent = Math.min(100, Math.max(0, Math.round(confidence * 100)));

  const getBarColor = () => {
    switch (verdict) {
      case 'SUPPORTED':
        return 'bg-emerald-500';
      case 'CONTRADICTED':
        return 'bg-rose-500';
      case 'PARTIALLY_SUPPORTED':
      case 'UNCERTAIN':
        return 'bg-amber-500';
      default:
        return 'bg-slate-400';
    }
  };

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getBarColor()}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-mono text-slate-300 min-w-[34px] text-right">
          {percent}%
        </span>
      )}
    </div>
  );
};
