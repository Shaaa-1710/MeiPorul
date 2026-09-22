import React from 'react';
import { PipelineStage } from '../../types/api';
import { Check, Circle, Loader2 } from 'lucide-react';

interface ProgressivePipelineProps {
  currentStage: PipelineStage;
  stageDetail?: string;
}

interface StepConfig {
  id: PipelineStage;
  label: string;
  subtext: string;
}

const STAGES: StepConfig[] = [
  {
    id: 'retrieving',
    label: 'Hybrid Document Retrieval',
    subtext: 'Scanning corpus with dense embeddings and BM25 index',
  },
  {
    id: 'generating',
    label: 'Response Synthesis',
    subtext: 'Generating baseline contextual answer',
  },
  {
    id: 'decomposing',
    label: 'Claim Decomposition',
    subtext: 'Isolating atomic factual propositions',
  },
  {
    id: 'checking_evidence',
    label: 'Verification Cascade',
    subtext: 'Checking exact spans, entity bindings, and numeric boundaries',
  },
  {
    id: 'running_nli',
    label: 'NLI Entailment Check',
    subtext: 'Evaluating natural language inference for ambiguous claims',
  },
  {
    id: 'finalizing',
    label: 'Audit Synthesis',
    subtext: 'Compiling evidence spans and verdict flags',
  },
];

export const ProgressivePipeline: React.FC<ProgressivePipelineProps> = ({
  currentStage,
  stageDetail,
}) => {
  const getStageStatus = (stageId: PipelineStage): 'completed' | 'in_progress' | 'pending' => {
    const stageOrder: PipelineStage[] = [
      'retrieving',
      'generating',
      'decomposing',
      'checking_evidence',
      'running_nli',
      'finalizing',
      'complete',
    ];

    const currentIndex = stageOrder.indexOf(currentStage);
    const stepIndex = stageOrder.indexOf(stageId);

    if (currentIndex > stepIndex || currentStage === 'complete') {
      return 'completed';
    }
    if (currentIndex === stepIndex) {
      return 'in_progress';
    }
    return 'pending';
  };

  return (
    <div className="w-full py-4 px-4 my-2 max-w-2xl mx-auto rounded-xl bg-white border border-gray-200 shadow-xs">
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-gray-100">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-700">
          Running Verification Pipeline
        </span>
        <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
          Cascade Active
        </span>
      </div>

      {stageDetail && (
        <div className="mb-2.5 px-2.5 py-1.5 rounded bg-gray-50 text-xs font-mono text-gray-600 border border-gray-200">
          {stageDetail}
        </div>
      )}

      <div className="space-y-1.5">
        {STAGES.map((step) => {
          const status = getStageStatus(step.id);

          return (
            <div
              key={step.id}
              className={`flex items-center justify-between p-1.5 rounded transition-colors ${
                status === 'in_progress' ? 'bg-gray-100/80 font-medium' : ''
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="shrink-0">
                  {status === 'completed' && (
                    <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                  )}
                  {status === 'in_progress' && (
                    <Loader2 className="w-3.5 h-3.5 text-gray-700 animate-spin" />
                  )}
                  {status === 'pending' && (
                    <Circle className="w-3.5 h-3.5 text-gray-300" />
                  )}
                </div>
                <span
                  className={`text-xs ${
                    status === 'in_progress'
                      ? 'text-gray-900 font-semibold'
                      : status === 'completed'
                      ? 'text-gray-700'
                      : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              <span className="text-[10px] font-mono text-gray-400">
                {status === 'completed' && 'Done'}
                {status === 'in_progress' && 'Checking...'}
                {status === 'pending' && 'Queued'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
