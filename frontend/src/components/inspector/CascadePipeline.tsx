import React from 'react';
import { VerificationCascade, ClaimVerdict } from '../../types/claim';
import {
  Check,
  X,
  Minus,
  AlertTriangle,
} from 'lucide-react';

interface CascadePipelineProps {
  cascade: VerificationCascade;
  verdict: ClaimVerdict;
  confidence: number;
}

export const CascadePipeline: React.FC<CascadePipelineProps> = ({
  cascade,
  verdict,
}) => {
  const isLLMEscalated = cascade.llm_escalation;
  const isNLIRun = cascade.nli_required;
  const isUncertain = verdict === 'UNCERTAIN';

  return (
    <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-2.5 text-left">
      <div className="flex items-center justify-between pb-1.5 border-b border-gray-200">
        <span className="text-xs font-semibold text-gray-900">
          Verification Pipeline
        </span>
        <span className="text-[10px] font-mono text-gray-500">
          Cascade Logic
        </span>
      </div>

      {/* Checklist of cascade stages */}
      <div className="space-y-1.5 font-mono text-xs">
        {/* Step 1: Exact Span Check */}
        <div className="flex items-center justify-between py-0.5">
          <div className="flex items-center gap-2">
            {cascade.span_check === true ? (
              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
            ) : cascade.span_check === false ? (
              <X className="w-3.5 h-3.5 text-rose-600 stroke-[2.5]" />
            ) : (
              <Minus className="w-3.5 h-3.5 text-gray-400" />
            )}
            <span className="text-gray-700 text-[11px]">1. Exact Span Match</span>
          </div>
          <span className="text-[10px] text-gray-500 font-sans">
            {cascade.span_check === true ? 'Matched' : cascade.span_check === false ? 'No span match' : 'Skipped'}
          </span>
        </div>

        {/* Step 2: Entity Check */}
        <div className="flex items-center justify-between py-0.5">
          <div className="flex items-center gap-2">
            {cascade.entity_check === true ? (
              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
            ) : cascade.entity_check === false ? (
              <X className="w-3.5 h-3.5 text-rose-600 stroke-[2.5]" />
            ) : (
              <Minus className="w-3.5 h-3.5 text-gray-400" />
            )}
            <span className="text-gray-700 text-[11px]">2. Entity Verification</span>
          </div>
          <span className="text-[10px] text-gray-500 font-sans">
            {cascade.entity_check === true ? 'Verified' : cascade.entity_check === false ? 'Mismatch' : 'N/A'}
          </span>
        </div>

        {/* Step 3: Numeric Check */}
        <div className="flex items-center justify-between py-0.5">
          <div className="flex items-center gap-2">
            {cascade.numeric_check === true ? (
              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
            ) : cascade.numeric_check === false ? (
              <X className="w-3.5 h-3.5 text-rose-600 stroke-[2.5]" />
            ) : (
              <Minus className="w-3.5 h-3.5 text-gray-400" />
            )}
            <span className="text-gray-700 text-[11px]">3. Numeric & Date Check</span>
          </div>
          <span className="text-[10px] text-gray-500 font-sans">
            {cascade.numeric_check === true ? 'Corroborated' : cascade.numeric_check === false ? 'Contradiction' : 'None'}
          </span>
        </div>

        {/* Step 4: Contradiction Check */}
        {cascade.contradiction_detected !== undefined && (
          <div className="flex items-center justify-between py-0.5">
            <div className="flex items-center gap-2">
              {cascade.contradiction_detected ? (
                <X className="w-3.5 h-3.5 text-rose-600 stroke-[2.5]" />
              ) : (
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
              )}
              <span className="text-gray-700 text-[11px]">4. Polarity / Contradiction</span>
            </div>
            <span className="text-[10px] text-gray-500 font-sans">
              {cascade.contradiction_detected ? 'Conflict flagged' : 'No conflict'}
            </span>
          </div>
        )}

        {/* Step 5: NLI Check */}
        <div className="flex items-center justify-between py-0.5">
          <div className="flex items-center gap-2">
            {isNLIRun ? (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 stroke-[2]" />
            ) : (
              <Minus className="w-3.5 h-3.5 text-gray-400" />
            )}
            <span className="text-gray-700 text-[11px]">5. NLI Entailment</span>
          </div>
          <span className="text-[10px] text-gray-500 font-sans">
            {isNLIRun ? 'Required' : 'Skipped'}
          </span>
        </div>

        {/* Step 6: Escalation / Resolution */}
        <div className="flex items-center justify-between py-0.5">
          <div className="flex items-center gap-2">
            {isUncertain ? (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 stroke-[2]" />
            ) : isLLMEscalated ? (
              <AlertTriangle className="w-3.5 h-3.5 text-gray-700 stroke-[2]" />
            ) : (
              <Minus className="w-3.5 h-3.5 text-gray-400" />
            )}
            <span className="text-gray-700 text-[11px]">
              {isUncertain ? '6. Further Review' : '6. Reasoning Escalation'}
            </span>
          </div>
          <span className="text-[10px] text-gray-500 font-sans">
            {isUncertain
              ? 'Requires manual review'
              : isLLMEscalated
              ? 'Escalated'
              : 'Skipped'}
          </span>
        </div>
      </div>

      {/* Escalation or Ambiguity Reasoning */}
      {isLLMEscalated && cascade.llm_reasoning && (
        <div className="mt-2 p-2 rounded bg-white border border-gray-200 text-xs text-gray-700 font-sans">
          <span className="font-semibold block mb-0.5 text-gray-900">Escalation Analysis:</span>
          <p className="text-[11px] leading-relaxed text-gray-600">{cascade.llm_reasoning}</p>
        </div>
      )}
    </div>
  );
};
