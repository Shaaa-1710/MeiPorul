export type ClaimVerdict =
  | 'SUPPORTED'
  | 'CONTRADICTED'
  | 'PARTIALLY_SUPPORTED'
  | 'NOT_ENTAILED'
  | 'UNCERTAIN'
  | 'NOT_VERIFIABLE';

export interface VerificationCascade {
  span_check: boolean | null;         // Cheaper exact span check
  entity_check: boolean | null;       // Named entity alignment
  numeric_check: boolean | null;      // Numeric, dates, and unit validation
  contradiction_detected?: boolean | null; // Lexical / polarity contradiction
  nli_required: boolean;              // Small NLI model step triggered?
  nli_confidence?: number | null;     // e.g. 0.94
  llm_escalation: boolean;            // Expensive LLM triggered only for ambiguous claims
  llm_reasoning?: string | null;      // LLM explanation if escalated
  escalation_reason?: string | null;  // Why escalated (or why skipped)
  compute_saved_tier?: 'instant' | 'cheap_heuristic' | 'small_nli' | 'expensive_llm';
}

export interface Claim {
  claim_id: string;
  text: string;
  verdict: ClaimVerdict;
  confidence: number;                 // 0.0 to 1.0
  start_char?: number;                // Character offset in full answer text
  end_char?: number;
  verification: VerificationCascade;
  evidence: import('./evidence').Evidence[];
}
