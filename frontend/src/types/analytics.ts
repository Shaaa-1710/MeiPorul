export interface SystemAuditMetrics {
  isMockData: boolean;
  totalQueries: number;
  totalClaims: number;
  supportedClaims: number;
  contradictedClaims: number;
  partiallySupportedClaims: number;
  uncertainClaims: number;
  notEntailedClaims: number;
  averageConfidence: number;
  averageLatencyMs: number;
  cascadeEfficiencyRate: number; // e.g. 91.8% resolved without expensive LLM escalation
  nliEscalationRate: number;
  llmEscalationRate: number;
  cacheHitRate: number;
  breakdownByMethod: {
    exactSpanMatches: number;
    entityMatches: number;
    numericContradictions: number;
    nliResolutions: number;
    llmEscalations: number;
  };
  recentAudits: Array<{
    id: string;
    query: string;
    timestamp: string;
    verdictDistribution: Record<string, number>;
    escalated: boolean;
    latencyMs: number;
  }>;
}
