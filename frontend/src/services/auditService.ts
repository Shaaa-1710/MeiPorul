import { SystemAuditMetrics } from '../types/analytics';
import { getStoredApiConfig, requestJson } from './apiClient';
import { ConversationSession } from '../types/session';

const SESSIONS_STORAGE_KEY = 'rag_auditor_v2_sessions';

class AuditService {
  async getMetrics(): Promise<SystemAuditMetrics> {
    const config = getStoredApiConfig();

    if (config.mode === 'live' && config.baseUrl.trim()) {
      try {
        return await requestJson<SystemAuditMetrics>('/api/analytics');
      } catch (e) {
        console.warn('Could not fetch live analytics, falling back to local audit telemetry', e);
      }
    }

    // Compute REAL metrics from actual stored sessions
    let storedSessions: ConversationSession[] = [];
    try {
      const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (raw) {
        storedSessions = JSON.parse(raw);
      }
    } catch {
      storedSessions = [];
    }

    const totalQueries = storedSessions.reduce((acc, s) => {
      return acc + s.messages.filter((m) => m.role === 'user').length;
    }, 0);

    const allClaims = storedSessions.flatMap((s) =>
      s.messages.flatMap((m) => m.claims || [])
    );

    const totalClaims = allClaims.length;

    if (totalClaims === 0) {
      // EMPTY INITIAL STATE
      return {
        isMockData: false,
        totalQueries: totalQueries,
        totalClaims: 0,
        supportedClaims: 0,
        contradictedClaims: 0,
        partiallySupportedClaims: 0,
        uncertainClaims: 0,
        notEntailedClaims: 0,
        averageConfidence: 0,
        averageLatencyMs: 0,
        cascadeEfficiencyRate: 0,
        nliEscalationRate: 0,
        llmEscalationRate: 0,
        cacheHitRate: 0,
        breakdownByMethod: {
          exactSpanMatches: 0,
          entityMatches: 0,
          numericContradictions: 0,
          nliResolutions: 0,
          llmEscalations: 0,
        },
        recentAudits: []
      };
    }

    const supported = allClaims.filter((c) => c.verdict === 'SUPPORTED').length;
    const contradicted = allClaims.filter((c) => c.verdict === 'CONTRADICTED').length;
    const partial = allClaims.filter((c) => c.verdict === 'PARTIALLY_SUPPORTED').length;
    const uncertain = allClaims.filter((c) => c.verdict === 'UNCERTAIN').length;
    const notEntailed = allClaims.filter((c) => c.verdict === 'NOT_ENTAILED').length;

    const avgConf =
      allClaims.reduce((acc, c) => acc + (c.confidence || 0), 0) / totalClaims;

    const escalations = allClaims.filter((c) => c.verification.llm_escalation).length;
    const nliRuns = allClaims.filter((c) => c.verification.nli_required).length;

    const allLatencies = storedSessions.flatMap((s) =>
      s.messages
        .filter((m) => m.role === 'assistant' && m.metrics)
        .map((m) => m.metrics!.latency_ms)
    );

    const avgLatency =
      allLatencies.length > 0
        ? Math.round(allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length)
        : 0;

    return {
      isMockData: false,
      totalQueries,
      totalClaims,
      supportedClaims: supported,
      contradictedClaims: contradicted,
      partiallySupportedClaims: partial,
      uncertainClaims: uncertain,
      notEntailedClaims: notEntailed,
      averageConfidence: avgConf,
      averageLatencyMs: avgLatency,
      cascadeEfficiencyRate: totalClaims > 0 ? (totalClaims - escalations) / totalClaims : 0,
      nliEscalationRate: totalClaims > 0 ? nliRuns / totalClaims : 0,
      llmEscalationRate: totalClaims > 0 ? escalations / totalClaims : 0,
      cacheHitRate: 0,
      breakdownByMethod: {
        exactSpanMatches: allClaims.filter((c) => c.verification.span_check).length,
        entityMatches: allClaims.filter((c) => c.verification.entity_check).length,
        numericContradictions: allClaims.filter((c) => c.verification.numeric_check === false).length,
        nliResolutions: nliRuns,
        llmEscalations: escalations,
      },
      recentAudits: storedSessions.map((s) => ({
        id: s.id,
        query: s.title,
        timestamp: s.updatedAt,
        verdictDistribution: {
          SUPPORTED: s.messages.flatMap((m) => m.claims || []).filter((c) => c.verdict === 'SUPPORTED').length,
          CONTRADICTED: s.messages.flatMap((m) => m.claims || []).filter((c) => c.verdict === 'CONTRADICTED').length,
          UNCERTAIN: s.messages.flatMap((m) => m.claims || []).filter((c) => c.verdict === 'UNCERTAIN').length,
        },
        escalated: s.messages.some((m) => m.claims?.some((c) => c.verification.llm_escalation)),
        latencyMs: s.messages.find((m) => m.metrics)?.metrics?.latency_ms || 0
      }))
    };
  }
}

export const auditService = new AuditService();
