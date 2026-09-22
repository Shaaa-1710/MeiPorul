import React, { useState, useEffect } from 'react';
import { auditService } from '../../services/auditService';
import { SystemAuditMetrics } from '../../types/analytics';
import { formatPercent, formatLatency } from '../../utils/formatters';
import { useSettings } from '../../context/SettingsContext';
import { useChat } from '../../context/ChatContext';
import {
  Check,
  X,
  AlertTriangle,
  Layers,
  Clock,
  Shield,
  Activity,
  BarChart2,
} from 'lucide-react';

export const AnalyticsPage: React.FC = () => {
  const { config } = useSettings();
  const { sessions } = useChat();
  const [metrics, setMetrics] = useState<SystemAuditMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadMetrics = async () => {
      setIsLoading(true);
      const data = await auditService.getMetrics();
      setMetrics(data);
      setIsLoading(false);
    };
    loadMetrics();
  }, [config.useMock, sessions]);

  if (isLoading || !metrics) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-xs font-mono">
          Loading audit telemetry...
        </div>
      </div>
    );
  }

  const isEmpty = metrics.totalClaims === 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-y-auto p-4 sm:p-8">
      <div className="max-w-5xl mx-auto w-full space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-200">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
              Audit Telemetry & Analytics
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              Measurement of proposition verification verdicts, contradiction rates, and cascade resolution stages.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {isEmpty ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-gray-100 text-gray-600 border border-gray-200 text-xs font-mono">
                <span>No Audits Recorded</span>
              </span>
            ) : metrics.isMockData ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-300 text-xs font-mono">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                <span>Evaluation Data</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-mono">
                <Activity className="w-3.5 h-3.5 text-emerald-700" />
                <span>Live Telemetry</span>
              </span>
            )}
          </div>
        </div>

        {/* Empty State Banner if 0 Audits */}
        {isEmpty ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center space-y-3 shadow-2xs">
            <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-400 mx-auto">
              <BarChart2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                Analytics will appear after your first audit.
              </h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 leading-relaxed">
                Run an audit against your uploaded documents to start collecting verification telemetry.
              </p>
            </div>
          </div>
        ) : null}

        {/* KEY AUDIT KPIS GRID */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-xl bg-white border border-gray-200 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-medium">Total Queries</span>
              <Activity className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <div className="text-2xl font-bold text-gray-900 font-mono">
              {metrics.totalQueries}
            </div>
            <div className="text-[10px] text-gray-400 mt-1 font-mono">
              {isEmpty ? '0 runs' : 'Processed queries'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-gray-200 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-medium">Propositions Audited</span>
              <Layers className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <div className="text-2xl font-bold text-gray-900 font-mono">
              {metrics.totalClaims}
            </div>
            <div className="text-[10px] text-gray-400 mt-1 font-mono">
              {isEmpty ? '0 claims' : 'Decomposed claims'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-gray-200 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-medium">Average Latency</span>
              <Clock className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <div className="text-2xl font-bold text-gray-900 font-mono">
              {isEmpty ? '—' : formatLatency(metrics.averageLatencyMs)}
            </div>
            <div className="text-[10px] text-gray-400 mt-1 font-mono">
              {isEmpty ? 'No data' : 'End-to-end verification'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-gray-200 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-medium">Mean Confidence</span>
              <Shield className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <div className="text-2xl font-bold text-gray-900 font-mono">
              {isEmpty ? '—' : formatPercent(metrics.averageConfidence)}
            </div>
            <div className="text-[10px] text-gray-400 mt-1 font-mono">
              {isEmpty ? 'No data' : 'Verification certainty'}
            </div>
          </div>
        </div>

        {/* VERDICTS BREAKDOWN & CASCADE STAGES (Shown only when audits exist) */}
        {!isEmpty && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Claim Verdict Distribution */}
            <div className="p-5 rounded-xl bg-white border border-gray-200 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-800">
                  Claim Verdict Breakdown
                </h3>
                <span className="text-[10px] text-gray-400 font-mono">
                  {metrics.totalClaims} claims evaluated
                </span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                {/* Supported: quiet green */}
                <div>
                  <div className="flex items-center justify-between text-gray-700 mb-1">
                    <span className="flex items-center gap-1.5 text-emerald-700">
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      Supported (Quiet)
                    </span>
                    <span>
                      {metrics.supportedClaims} ({Math.round((metrics.supportedClaims / metrics.totalClaims) * 100)}%)
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${(metrics.supportedClaims / metrics.totalClaims) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Contradicted: clearly flagged red */}
                <div>
                  <div className="flex items-center justify-between text-gray-700 mb-1">
                    <span className="flex items-center gap-1.5 text-rose-700 font-semibold">
                      <X className="w-3.5 h-3.5 stroke-[3]" />
                      Contradicted (Flagged Red)
                    </span>
                    <span className="font-semibold text-rose-800">
                      {metrics.contradictedClaims} ({Math.round((metrics.contradictedClaims / metrics.totalClaims) * 100)}%)
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-600 rounded-full"
                      style={{ width: `${(metrics.contradictedClaims / metrics.totalClaims) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Uncertain: clearly flagged amber */}
                <div>
                  <div className="flex items-center justify-between text-gray-700 mb-1">
                    <span className="flex items-center gap-1.5 text-amber-800 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" />
                      Uncertain (Flagged Amber · Review)
                    </span>
                    <span className="font-semibold text-amber-800">
                      {metrics.uncertainClaims} ({Math.round((metrics.uncertainClaims / metrics.totalClaims) * 100)}%)
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${(metrics.uncertainClaims / metrics.totalClaims) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Partially Supported */}
                <div>
                  <div className="flex items-center justify-between text-gray-700 mb-1">
                    <span className="flex items-center gap-1.5 text-amber-700">
                      <AlertTriangle className="w-3.5 h-3.5 stroke-[2]" />
                      Partially Supported
                    </span>
                    <span>
                      {metrics.partiallySupportedClaims} ({Math.round((metrics.partiallySupportedClaims / metrics.totalClaims) * 100)}%)
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full"
                      style={{ width: `${(metrics.partiallySupportedClaims / metrics.totalClaims) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Cascade Stage Resolution Breakdown */}
            <div className="p-5 rounded-xl bg-white border border-gray-200 space-y-4 shadow-2xs">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-800">
                Cascade Stage Resolution Breakdown
              </h3>

              <div className="space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between p-2.5 rounded bg-gray-50 border border-gray-100">
                  <span className="text-gray-700">Exact Semantic Span Matches</span>
                  <span className="font-semibold text-gray-900">
                    {metrics.breakdownByMethod.exactSpanMatches} claims
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded bg-gray-50 border border-gray-100">
                  <span className="text-gray-700">Entity Alignment Matches</span>
                  <span className="font-semibold text-gray-900">
                    {metrics.breakdownByMethod.entityMatches} claims
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded bg-rose-50/50 border border-rose-200">
                  <span className="text-rose-900 font-medium">Numeric Boundary Contradictions</span>
                  <span className="font-semibold text-rose-800">
                    {metrics.breakdownByMethod.numericContradictions} claims
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded bg-amber-50/50 border border-amber-200">
                  <span className="text-amber-900 font-medium">Small NLI Model Resolutions</span>
                  <span className="font-semibold text-amber-800">
                    {metrics.breakdownByMethod.nliResolutions} claims
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded bg-gray-100 border border-gray-200">
                  <span className="text-gray-800 font-medium">
                    Escalated to Reasoning Arbiter
                  </span>
                  <span className="font-semibold text-gray-900">
                    {metrics.breakdownByMethod.llmEscalations} claims
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
