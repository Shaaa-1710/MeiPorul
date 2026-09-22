import React from 'react';
import { DocumentItem } from '../../types/document';
import { formatBytes, formatDateRelative } from '../../utils/formatters';
import { X, FileText, Layers } from 'lucide-react';

interface DocumentChunkModalProps {
  document: DocumentItem | null;
  onClose: () => void;
}

export const DocumentChunkModal: React.FC<DocumentChunkModalProps> = ({
  document,
  onClose,
}) => {
  if (!document) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-white border border-gray-300 rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-gray-200 text-gray-700">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 truncate max-w-md">
                {document.filename}
              </h3>
              <p className="text-xs text-gray-500 font-mono">
                {formatBytes(document.size_bytes)} · {document.chunks_count} chunks · Indexed {formatDateRelative(document.uploaded_at)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chunks content */}
        <div className="p-5 overflow-y-auto space-y-3">
          <div className="flex items-center justify-between text-xs text-gray-500 font-semibold uppercase tracking-wider">
            <span>Indexed Document Chunks ({document.chunks?.length || 0})</span>
            <span className="font-mono text-[10px]">Dense + BM25</span>
          </div>

          {document.chunks && document.chunks.length > 0 ? (
            document.chunks.map((chk, idx) => (
              <div
                key={chk.chunk_id || idx}
                className="p-3.5 rounded-lg bg-gray-50 border border-gray-200 space-y-1.5 text-left"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-gray-700 font-semibold text-[11px] bg-white px-2 py-0.5 rounded border border-gray-200">
                      Chunk #{idx + 1}
                    </span>
                    <span className="text-gray-800 font-medium">
                      Page {chk.page_number} · {chk.section_title}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-gray-400">
                    {chk.token_count} tokens
                  </span>
                </div>

                <p className="text-xs text-gray-700 leading-relaxed font-sans bg-white p-2.5 rounded border border-gray-200">
                  {chk.content}
                </p>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-gray-400 text-xs">
              <Layers className="w-6 h-6 mx-auto mb-2 opacity-40" />
              <p>Indexed across {document.chunks_count} structural segments.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
