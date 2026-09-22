import { Claim } from './claim';

export interface QueryRequest {
  query: string;
  document_ids?: string[];
  mode?: 'cascade' | 'strict' | 'fast';
  confidence_threshold?: number;
  is_demo_mode?: boolean;
}

export interface AuditMetrics {
  latency_ms: number;
  claims_count: number;
  llm_escalations: number;
  cache_hits: number;
  // Synthetic / measured backend metrics
  estimated_cost_saved_percent?: number;
  nli_escalations?: number;
  heuristics_resolved_count?: number;
}

export interface ProvenanceRetrievedChunk {
  chunk_id: string;
  document_id: string;
  document_name: string;
  page: number;
  score: number;
  section: string;
  text_snippet: string;
  matched_tokens: string[];
}

export interface ProvenanceTrace {
  query: string;
  retrieved_chunks: ProvenanceRetrievedChunk[];
  total_chunks_scanned: number;
  decomposition_type: 'mathematical_derivation' | 'propositional';
}

export interface QueryResponse {
  query_id: string;
  answer: string;
  claims: Claim[];
  metrics: AuditMetrics;
  provenance?: ProvenanceTrace;
  is_mock_data?: boolean;
  model_name?: string;
  timestamp?: string;
}

export type PipelineStage =
  | 'idle'
  | 'retrieving'
  | 'generating'
  | 'decomposing'
  | 'checking_evidence'
  | 'running_nli'
  | 'finalizing'
  | 'complete'
  | 'error';

export interface StageInfo {
  stage: PipelineStage;
  label: string;
  detail: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
}
