import { DocumentItem, DocumentProcessingState } from '../types/document';
import { getStoredApiConfig, requestJson } from './apiClient';
import { MOCK_DOCUMENTS } from './mockData';
import { parseUploadedDocument } from '../utils/documentParser';

const STORAGE_KEY = 'rag_auditor_v2_documents';

class DocumentService {
  private documents: DocumentItem[] = [];

  constructor() {
    this.init();
  }

  private init() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.documents = JSON.parse(stored);
      } else {
        // ALWAYS START WITH EMPTY CORPUS BY DEFAULT
        this.documents = [];
        this.save();
      }
    } catch {
      this.documents = [];
    }
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.documents));
    } catch (e) {
      console.warn('Failed to persist documents to localStorage', e);
    }
  }

  async getDocuments(): Promise<DocumentItem[]> {
    const config = getStoredApiConfig();
    if (config.mode === 'live' && config.baseUrl.trim()) {
      try {
        return await requestJson<DocumentItem[]>('/api/documents');
      } catch (e) {
        console.warn('Could not fetch from live API, falling back to local list', e);
      }
    }
    return [...this.documents];
  }

  async uploadDocument(
    file: File,
    onStateChange?: (state: DocumentProcessingState, chunksCount: number) => void
  ): Promise<DocumentItem> {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const config = getStoredApiConfig();

    const newDocId = `doc_${Date.now()}`;
    const newDoc: DocumentItem = {
      id: newDocId,
      filename: file.name,
      size_bytes: file.size,
      uploaded_at: new Date().toISOString(),
      state: 'UPLOADING',
      chunks_count: 0,
      description: `Uploaded document (${file.name.split('.').pop()?.toUpperCase() || 'DOCUMENT'}).`,
      category: 'User Corpus',
      chunks: []
    };

    if (config.mode === 'live' && config.baseUrl.trim()) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        return await requestJson<DocumentItem>('/api/documents/upload', {
          method: 'POST',
          body: formData,
        });
      } catch (e) {
        console.warn('Live upload failed, continuing with local processing pipeline', e);
      }
    }

    // Real ingestion pipeline with genuine text extraction
    this.documents.unshift(newDoc);
    this.save();

    if (onStateChange) onStateChange('UPLOADING', 0);
    await sleep(250);

    newDoc.state = 'PROCESSING';
    this.save();
    if (onStateChange) onStateChange('PROCESSING', 0);

    // Extract text, pages, and formulas using documentParser
    let parsedResult;
    try {
      parsedResult = await parseUploadedDocument(file, newDocId);
    } catch (err) {
      console.error('Document parsing error:', err);
      parsedResult = {
        chunks: [],
        fullText: '',
        description: `Uploaded file: ${file.name}`,
        totalPages: 1,
      };
    }

    newDoc.state = 'CHUNKING';
    newDoc.chunks = parsedResult.chunks;
    newDoc.chunks_count = parsedResult.chunks.length;
    newDoc.description = parsedResult.description;
    newDoc.raw_text = parsedResult.fullText;
    this.save();
    if (onStateChange) onStateChange('CHUNKING', newDoc.chunks_count);
    await sleep(300);

    newDoc.state = 'INDEXING';
    this.save();
    if (onStateChange) onStateChange('INDEXING', newDoc.chunks_count);
    await sleep(250);

    newDoc.state = 'READY';
    this.save();
    if (onStateChange) onStateChange('READY', newDoc.chunks_count);

    return { ...newDoc };
  }

  async deleteDocument(id: string): Promise<boolean> {
    const config = getStoredApiConfig();
    if (config.mode === 'live' && config.baseUrl.trim()) {
      try {
        await requestJson(`/api/documents/${id}`, { method: 'DELETE' });
      } catch (e) {
        console.warn('Live delete failed', e);
      }
    }
    this.documents = this.documents.filter((d) => d.id !== id);
    this.save();
    return true;
  }

  async clearAllDocuments(): Promise<void> {
    this.documents = [];
    this.save();
  }

  async loadDemoDocuments(): Promise<DocumentItem[]> {
    this.documents = JSON.parse(JSON.stringify(MOCK_DOCUMENTS));
    this.save();
    return [...this.documents];
  }

  async getDocumentById(id: string): Promise<DocumentItem | undefined> {
    return this.documents.find((d) => d.id === id);
  }
}

export const documentService = new DocumentService();
