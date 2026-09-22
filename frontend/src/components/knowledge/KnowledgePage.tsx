import React, { useState, useEffect, useRef } from 'react';
import { documentService } from '../../services/documentService';
import { DocumentItem, DocumentProcessingState } from '../../types/document';
import { formatBytes, formatDateRelative } from '../../utils/formatters';
import { DocumentChunkModal } from './DocumentChunkModal';
import { useSettings } from '../../context/SettingsContext';
import { useChat } from '../../context/ChatContext';
import {
  UploadCloud,
  Search,
  FileText,
  Trash2,
  Eye,
  Check,
  Loader2,
  AlertTriangle,
  Layers,
  FolderOpen,
} from 'lucide-react';

export const KnowledgePage: React.FC = () => {
  const { showToast } = useSettings();
  const { refreshCorpusCount } = useChat();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('ALL');
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocs = async () => {
    const list = await documentService.getDocuments();
    setDocuments(list);
    await refreshCorpusCount();
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setIsUploading(true);

    try {
      await documentService.uploadDocument(file, (state, count) => {
        setUploadStatus(`${state} (${count} chunks)...`);
        loadDocs();
      });
      showToast(`Document "${file.name}" indexed successfully`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to upload document', 'error');
    } finally {
      setIsUploading(false);
      setUploadStatus('');
      await loadDocs();
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Remove "${name}" from audit corpus?`)) {
      await documentService.deleteDocument(id);
      await loadDocs();
      showToast(`Document "${name}" removed`, 'info');
    }
  };

  const getStateBadge = (state: DocumentProcessingState) => {
    switch (state) {
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Check className="w-3 h-3 text-emerald-600 stroke-[2.5]" />
            <span>Ready</span>
          </span>
        );
      case 'UPLOADING':
      case 'PROCESSING':
      case 'CHUNKING':
      case 'INDEXING':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>{state}</span>
          </span>
        );
      case 'FAILED':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            <span>Failed</span>
          </span>
        );
    }
  };

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.description && doc.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = stateFilter === 'ALL' || doc.state === stateFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-y-auto p-4 sm:p-8">
      <div className="max-w-5xl mx-auto w-full space-y-6">
        {/* Page Header */}
        <div className="pb-4 border-b border-gray-200">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            Knowledge Corpus
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1 leading-relaxed">
            Upload reference documents, PDFs, or course notes. Files will be processed, chunked, and indexed for claim verification.
          </p>
        </div>

        {/* Large Upload Area */}
        <div className="rounded-xl border border-gray-300 bg-white p-8 sm:p-10 text-center shadow-2xs">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.docx,.csv"
            disabled={isUploading}
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center max-w-md mx-auto">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 mb-3">
              {isUploading ? (
                <Loader2 className="w-6 h-6 animate-spin text-gray-800" />
              ) : (
                <UploadCloud className="w-6 h-6 text-gray-700" />
              )}
            </div>

            <h3 className="text-base font-semibold text-gray-900 mb-1">
              {isUploading ? uploadStatus : 'Upload documents'}
            </h3>

            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Drag and drop PDF, TXT, or DOCX files here, or click to browse.
            </p>

            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-medium transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              Select Files
            </button>

            <span className="text-[11px] text-gray-400 mt-3 font-mono">
              Supports PDF, TXT, DOCX
            </span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search documents..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400"
            />
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto text-xs flex-wrap">
            <span className="text-gray-500 mr-1">Status:</span>
            {['ALL', 'UPLOADING', 'PROCESSING', 'INDEXING', 'READY', 'FAILED'].map((st) => (
              <button
                key={st}
                onClick={() => setStateFilter(st)}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  stateFilter === st
                    ? 'bg-gray-900 text-white font-medium'
                    : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200'
                }`}
              >
                {st === 'ALL' ? 'All' : st.charAt(0) + st.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Large Empty-State Panel When 0 Documents */}
        {documents.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center space-y-3 shadow-2xs">
            <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-400 mx-auto">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                No documents uploaded yet
              </h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 leading-relaxed">
                Upload relevant guidelines, policies, or reference documents to build your knowledge corpus.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-medium transition-colors shadow-xs cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Upload Documents</span>
            </button>
          </div>
        ) : (
          /* Document Cards Grid - Only rendered when documents actually exist! */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className="group p-4 rounded-xl bg-white hover:bg-gray-50/50 border border-gray-200 hover:border-gray-300 transition-all flex flex-col justify-between shadow-2xs text-left"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className="p-2 rounded-lg bg-gray-100 text-gray-600 shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                          {doc.filename}
                        </h3>
                        <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                          {doc.description || 'Uploaded reference document for verification cascades.'}
                        </p>
                      </div>
                    </div>
                    {getStateBadge(doc.state)}
                  </div>

                  <div className="flex items-center gap-3 pt-2 text-xs text-gray-500">
                    <span>{formatBytes(doc.size_bytes)}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1 text-gray-600">
                      <Layers className="w-3 h-3 text-gray-400" />
                      {doc.chunks_count} chunks
                    </span>
                    <span>·</span>
                    <span>{formatDateRelative(doc.uploaded_at)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {doc.category || 'Uploaded File'}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedDoc(doc)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      <span>View Chunks</span>
                    </button>
                    <button
                      onClick={() => handleDelete(doc.id, doc.filename)}
                      className="p-1.5 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {documents.length > 0 && filteredDocs.length === 0 && (
          <div className="py-12 text-center text-gray-400 text-xs">
            No matching documents found with status "{stateFilter}".
          </div>
        )}
      </div>

      {/* Chunk Inspection Modal */}
      <DocumentChunkModal
        document={selectedDoc}
        onClose={() => setSelectedDoc(null)}
      />
    </div>
  );
};
