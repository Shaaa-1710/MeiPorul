export interface Evidence {
  document_id: string;
  document_name: string;
  page: number;
  section: string;
  text: string;
  highlight: string;
  full_text?: string;
  line_numbers?: string;
  lineStart?: number;
  lineEnd?: number;
  why_explanation?: string;
  citation_id?: string;
  chunk_id?: string;
  similarity_score?: number;
  snippet_context?: string;
}

export interface SourceDocumentReference {
  document_id: string;
  document_name: string;
  page: number;
  section: string;
  matching_claims_count: number;
  citations: string[];
}
