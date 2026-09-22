import React, { useState } from 'react';
import { ProvenanceTrace } from '../../types/api';
import { Claim } from '../../types/claim';
import { VerdictBadge } from '../common/VerdictBadge';
import {
  X,
  FileCode,
  Check,
  Copy,
  Layers,
  Database,
  Search,
  Cpu,
} from 'lucide-react';

interface ProvenanceModalProps {
  provenance?: ProvenanceTrace;
  claims?: Claim[];
  isOpen: boolean;
  onClose: () => void;
}

export const ProvenanceModal: React.FC<ProvenanceModalProps> = ({
  provenance,
  claims = [],
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'chunks' | 'claims' | 'raw'>('chunks');
  const [copied, setCopied] = useState(false);

  if (!isOpen || !provenance) return null;

  const handleCopyJson = () => {
    const data = {
      provenance,
      claims,
    };
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden text-left">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
                <span>Audit Provenance & Retrieval Trace</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-200 text-gray-700 uppercase font-semibold">
                  Debug Inspector
                </span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Inspect exact chunk IDs, retrieval scores, and proposition-to-evidence bindings.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyJson}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
              title="Copy Raw Trace JSON"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied JSON' : 'Export JSON'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Query Summary Strip */}
        <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-200 text-xs text-gray-700 flex flex-wrap items-center justify-between gap-2 font-mono">
          <div className="flex items-center gap-2 min-w-0">
            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="text-gray-500">Query:</span>
            <span className="font-medium text-gray-900 truncate max-w-md">"{provenance.query}"</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <span>Type: <strong className="text-gray-800">{provenance.decomposition_type}</strong></span>
            <span>·</span>
            <span>Retrieved: <strong className="text-gray-800">{provenance.retrieved_chunks.length}</strong> chunks</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 border-b border-gray-200 flex items-center gap-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab('chunks')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'chunks'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Retrieved Chunks ({provenance.retrieved_chunks.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('claims')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'claims'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Claim & Evidence Bindings ({claims.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('raw')}
            className={`py-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'raw'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Raw JSON Trace</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'chunks' && (
            <div className="space-y-4">
              {provenance.retrieved_chunks.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs">
                  No chunks were retrieved from uploaded documents for this query.
                </div>
              ) : (
                provenance.retrieved_chunks.map((chk, idx) => (
                  <div
                    key={chk.chunk_id || idx}
                    className="p-4 rounded-xl bg-white border border-gray-200 shadow-2xs space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-100 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{chk.document_name}</span>
                        <span className="px-1.5 py-0.2 rounded bg-gray-100 font-mono text-[11px] text-gray-600">
                          Page {chk.page}
                        </span>
                        <span className="text-gray-400">·</span>
                        <span className="text-gray-600">{chk.section}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                          Score: {chk.score}
                        </span>
                        <span className="text-gray-400 font-normal">ID: {chk.chunk_id}</span>
                      </div>
                    </div>

                    {chk.matched_tokens.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                        <span className="text-gray-500 font-mono text-[10px]">Matched Tokens:</span>
                        {chk.matched_tokens.map((token, tIdx) => (
                          <span
                            key={tIdx}
                            className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-900 border border-amber-200 font-mono text-[10px]"
                          >
                            {token}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-xs font-mono text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {chk.text_snippet}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'claims' && (
            <div className="space-y-3.5">
              {claims.map((claim, idx) => (
                <div
                  key={claim.claim_id || idx}
                  className="p-4 rounded-xl bg-white border border-gray-200 shadow-2xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono text-gray-400 uppercase font-semibold">
                        Claim #{idx + 1} ({claim.claim_id})
                      </span>
                      <h4 className="text-xs font-semibold text-gray-900 leading-snug">
                        "{claim.text}"
                      </h4>
                    </div>
                    <VerdictBadge verdict={claim.verdict} size="sm" />
                  </div>

                  {/* Cascade Checklist Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-100 text-[11px] font-mono">
                    <div className="p-2 rounded bg-gray-50 border border-gray-100">
                      <span className="text-gray-400 block text-[9px] uppercase">Exact Span</span>
                      <span className={claim.verification.span_check ? 'text-emerald-700 font-semibold' : 'text-gray-500'}>
                        {claim.verification.span_check ? '✓ Match' : '—'}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-gray-50 border border-gray-100">
                      <span className="text-gray-400 block text-[9px] uppercase">Entity / Var</span>
                      <span className={claim.verification.entity_check ? 'text-emerald-700 font-semibold' : 'text-gray-500'}>
                        {claim.verification.entity_check ? '✓ Aligned' : '—'}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-gray-50 border border-gray-100">
                      <span className="text-gray-400 block text-[9px] uppercase">Numeric Check</span>
                      <span className={claim.verification.numeric_check === true ? 'text-emerald-700 font-semibold' : claim.verification.numeric_check === false ? 'text-rose-700 font-semibold' : 'text-gray-500'}>
                        {claim.verification.numeric_check === true ? '✓ Corroborated' : claim.verification.numeric_check === false ? '✕ Discrepancy' : '—'}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-gray-50 border border-gray-100">
                      <span className="text-gray-400 block text-[9px] uppercase">Contradiction</span>
                      <span className={claim.verification.contradiction_detected ? 'text-rose-700 font-bold' : 'text-emerald-700'}>
                        {claim.verification.contradiction_detected ? '✕ Detected' : 'None'}
                      </span>
                    </div>
                  </div>

                  {/* Bound Evidence */}
                  {claim.evidence && claim.evidence.length > 0 ? (
                    <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-mono text-gray-500">
                        <span>Bound Chunk: <strong>{claim.evidence[0].chunk_id || claim.evidence[0].document_name}</strong></span>
                        <span>Page {claim.evidence[0].page} · {claim.evidence[0].section}</span>
                      </div>
                      <p className="text-gray-800 text-[11px] leading-relaxed">
                        "{claim.evidence[0].text.slice(0, 160)}..."
                      </p>
                      <div className="text-[10px] text-gray-500 flex items-center gap-1 font-mono">
                        <span>Matched Highlight:</span>
                        <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-semibold">
                          "{claim.evidence[0].highlight}"
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-400 italic">
                      No bound evidence chunk in current indexed corpus.
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'raw' && (
            <pre className="p-4 rounded-xl bg-gray-900 text-gray-100 font-mono text-xs overflow-x-auto leading-relaxed max-h-[500px]">
              {JSON.stringify({ provenance, claims }, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
