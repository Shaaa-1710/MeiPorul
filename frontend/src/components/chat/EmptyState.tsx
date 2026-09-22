import React from 'react';
import { Shield, UploadCloud, FileText, AlertCircle, ArrowRight } from 'lucide-react';
import { useChat } from '../../context/ChatContext';

interface EmptyStateProps {
  onSelectPrompt?: (promptText: string) => void;
  onNavigateToKnowledge?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  onNavigateToKnowledge,
}) => {
  const { corpusCount } = useChat();

  return (
    <div className="max-w-xl mx-auto px-4 py-12 flex flex-col items-center justify-center text-center select-none">
      {/* Product Icon */}
      <div className="w-11 h-11 rounded-lg bg-gray-900 text-white flex items-center justify-center mb-4 shadow-sm">
        <Shield className="w-5 h-5" />
      </div>

      <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 mb-1.5">
        What can I help you verify?
      </h1>
      <p className="text-xs sm:text-sm text-gray-500 max-w-md mb-6 leading-relaxed">
        Ask a question or provide a claim to audit against your uploaded documents.
      </p>

      {/* If there are no documents */}
      {corpusCount === 0 ? (
        <div className="w-full p-6 rounded-xl bg-white border border-gray-200 text-center space-y-3 shadow-2xs">
          <div className="w-9 h-9 rounded-full bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
            <AlertCircle className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Your knowledge corpus is empty.
            </h3>
            <p className="text-xs text-gray-500 max-w-xs mx-auto mt-0.5">
              Upload documents, course notes, or reference materials before auditing claims.
            </p>
          </div>

          {onNavigateToKnowledge && (
            <button
              onClick={onNavigateToKnowledge}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-medium transition-colors shadow-xs"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Upload Documents</span>
            </button>
          )}
        </div>
      ) : (
        <div className="w-full p-4 rounded-xl bg-white border border-gray-200 text-left flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-gray-100 text-gray-600">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-gray-900">
                Corpus Ready ({corpusCount} {corpusCount === 1 ? 'document' : 'documents'})
              </h4>
              <p className="text-[11px] text-gray-500">
                Type your inquiry below to decompose and verify claims against indexed passages.
              </p>
            </div>
          </div>
          {onNavigateToKnowledge && (
            <button
              onClick={onNavigateToKnowledge}
              className="text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-1"
            >
              <span>Manage</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
