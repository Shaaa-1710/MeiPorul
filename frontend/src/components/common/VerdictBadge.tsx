import React from 'react';
import { ClaimVerdict } from '../../types/claim';
import { Check, X, AlertTriangle, HelpCircle, MinusCircle } from 'lucide-react';

interface VerdictBadgeProps {
  verdict: ClaimVerdict;
  confidence?: number;
  size?: 'sm' | 'md' | 'lg';
  showIconOnly?: boolean;
}

export const VerdictBadge: React.FC<VerdictBadgeProps> = ({
  verdict,
  confidence,
  size = 'md',
  showIconOnly = false,
}) => {
  const getVerdictConfig = (v: ClaimVerdict) => {
    switch (v) {
      case 'SUPPORTED':
        return {
          label: 'Supported',
          icon: Check,
          bgClass: 'bg-emerald-50 border-emerald-200 text-emerald-800',
          iconColor: 'text-emerald-700',
        };
      case 'CONTRADICTED':
        return {
          label: 'Contradicted',
          icon: X,
          bgClass: 'bg-rose-50 border-rose-300 text-rose-800 font-semibold shadow-xs',
          iconColor: 'text-rose-700 stroke-[2.5]',
        };
      case 'UNCERTAIN':
        return {
          label: 'Uncertain',
          icon: AlertTriangle,
          bgClass: 'bg-amber-100 border-amber-400 text-amber-900 font-semibold shadow-xs',
          iconColor: 'text-amber-800 stroke-[2.5]',
        };
      case 'PARTIALLY_SUPPORTED':
        return {
          label: 'Partially Supported',
          icon: AlertTriangle,
          bgClass: 'bg-amber-50 border-amber-200 text-amber-800',
          iconColor: 'text-amber-700',
        };
      case 'NOT_ENTAILED':
        return {
          label: 'Not Entailed',
          icon: MinusCircle,
          bgClass: 'bg-gray-100 border-gray-300 text-gray-700',
          iconColor: 'text-gray-600',
        };
      case 'NOT_VERIFIABLE':
      default:
        return {
          label: 'Not Verifiable',
          icon: HelpCircle,
          bgClass: 'bg-gray-100 border-gray-200 text-gray-600',
          iconColor: 'text-gray-500',
        };
    }
  };

  const config = getVerdictConfig(verdict);
  const IconComponent = config.icon;

  const sizeClasses = {
    sm: 'text-[11px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2 py-0.5 gap-1.5',
    lg: 'text-sm px-3 py-1 gap-2 font-medium',
  };

  const iconSizes = {
    sm: 12,
    md: 13,
    lg: 15,
  };

  if (showIconOnly) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full p-0.5 ${config.bgClass} border`}
        title={`${config.label} ${confidence !== undefined ? `(${Math.round(confidence * 100)}%)` : ''}`}
      >
        <IconComponent size={iconSizes[size]} className={config.iconColor} />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-md border tracking-tight ${config.bgClass} ${sizeClasses[size]}`}
    >
      <IconComponent size={iconSizes[size]} className={config.iconColor} />
      <span>{config.label}</span>
      {confidence !== undefined && (
        <span className="opacity-80 font-medium text-[10px] ml-0.5">
          {Math.round(confidence * 100)}%
        </span>
      )}
    </span>
  );
};
