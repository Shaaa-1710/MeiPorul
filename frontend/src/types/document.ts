export type DocumentProcessingState =
  | 'UPLOADING'
  | 'PROCESSING'
  | 'CHUNKING'
  | 'INDEXING'
  | 'READY'
  | 'FAILED';

export interface DocumentChunk {
  chunk_id: string;
  page_number: number;
  section_title: string;
  token_count: number;
  content: string;
}

export interface DocumentItem {
  id: string;
  filename: string;
  size_bytes: number;
  uploaded_at: string;
  state: DocumentProcessingState;
  chunks_count: number;
  error_message?: string;
  description?: string;
  category?: string;
  chunks?: DocumentChunk[];
  raw_text?: string;
}
