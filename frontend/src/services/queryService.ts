import { QueryRequest, QueryResponse, PipelineStage } from '../types/api';
import { getStoredApiConfig, requestJson } from './apiClient';
import { documentService } from './documentService';
import { executeRealAudit } from './realAuditEngine';
import {
  MOCK_QUERY_SCENARIO_ELIGIBILITY,
  MOCK_QUERY_SCENARIO_TAX,
  MOCK_QUERY_SCENARIO_CLINICAL,
} from './mockData';

export type StageProgressCallback = (stage: PipelineStage, detail: string) => void;

class QueryService {
  async submitQuery(
    req: QueryRequest,
    onProgress?: StageProgressCallback
  ): Promise<QueryResponse> {
    const config = getStoredApiConfig();

    // 1. Live Backend API Mode (Only when explicitly configured with a base URL)
    if (config.mode === 'live' && config.baseUrl.trim()) {
      try {
        if (onProgress) onProgress('retrieving', 'Connecting to backend hybrid retriever...');
        const response = await requestJson<QueryResponse>('/api/query', {
          method: 'POST',
          body: JSON.stringify(req),
        });
        if (onProgress) onProgress('complete', 'Audit completed from backend.');
        return response;
      } catch (error: any) {
        console.error('Backend error:', error);
        throw error;
      }
    }

    // 2. Explicit Synthetic Demo Mode (Only when explicitly flagged as demo)
    if (req.is_demo_mode) {
      return this.handleDemoMode(req, onProgress);
    }

    // 3. REAL AUDIT MODE (Strictly user-uploaded documents and user queries)
    return this.handleRealAuditMode(req, onProgress);
  }

  /**
   * Real Audit execution strictly on user-uploaded documents.
   * Zero hardcoded statutory/legal fallbacks. Zero keyword mock interception.
   */
  private async handleRealAuditMode(
    req: QueryRequest,
    onProgress?: StageProgressCallback
  ): Promise<QueryResponse> {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const docs = await documentService.getDocuments();

    // Case 1: Knowledge corpus is completely empty
    if (docs.length === 0) {
      if (onProgress) {
        onProgress('retrieving', 'Checking knowledge corpus...');
        await sleep(150);
        onProgress('checking_evidence', 'Zero reference documents found in knowledge corpus.');
        await sleep(150);
        onProgress('complete', 'Audit halted: No documents available to audit against.');
      }

      return {
        query_id: `q_empty_${Date.now()}`,
        is_mock_data: false,
        model_name: 'Cascade Auditor',
        timestamp: new Date().toISOString(),
        answer: `Cannot audit inquiry "${req.query.slice(0, 80)}...": The knowledge corpus is currently empty. Please upload your course documents, notes, or reference materials before executing audits.`,
        claims: [
          {
            claim_id: `c_empty_1`,
            text: `Cannot verify propositions without indexed corpus documents.`,
            verdict: 'NOT_VERIFIABLE',
            confidence: 0,
            verification: {
              span_check: false,
              entity_check: null,
              numeric_check: null,
              contradiction_detected: null,
              nli_required: false,
              llm_escalation: false,
              escalation_reason: 'Knowledge corpus contains 0 uploaded documents. Verification requires reference material.',
              compute_saved_tier: 'instant',
            },
            evidence: [],
          },
        ],
        metrics: {
          latency_ms: 80,
          claims_count: 1,
          llm_escalations: 0,
          cache_hits: 0,
        },
      };
    }

    // Case 2: Documents exist in corpus -> run pure real retrieval & verification
    return executeRealAudit(req, docs, onProgress);
  }

  /**
   * Synthetic Demo Scenarios (Isolated, clearly marked as DEMO).
   */
  private async handleDemoMode(
    req: QueryRequest,
    onProgress?: StageProgressCallback
  ): Promise<QueryResponse> {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const normalized = req.query.toLowerCase().trim();

    if (onProgress) {
      onProgress('retrieving', 'Scanning synthetic demonstration dataset...');
      await sleep(200);
      onProgress('checking_evidence', 'Verifying benchmark claims...');
      await sleep(250);
      onProgress('complete', 'Demo scenario loaded.');
    }

    if (normalized.includes('tax') || normalized.includes('80-iac') || normalized.includes('partner')) {
      return {
        ...JSON.parse(JSON.stringify(MOCK_QUERY_SCENARIO_TAX)),
        is_mock_data: true,
        timestamp: new Date().toISOString(),
      };
    } else if (normalized.includes('trial') || normalized.includes('clinical') || normalized.includes('hypertension')) {
      return {
        ...JSON.parse(JSON.stringify(MOCK_QUERY_SCENARIO_CLINICAL)),
        is_mock_data: true,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      ...JSON.parse(JSON.stringify(MOCK_QUERY_SCENARIO_ELIGIBILITY)),
      is_mock_data: true,
      timestamp: new Date().toISOString(),
    };
  }
}

export const queryService = new QueryService();
