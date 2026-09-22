import React, { useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import {
  X,
  Sliders,
  Wifi,
  Check,
  AlertTriangle,
  RefreshCw,
  Server,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    config,
    updateConfig,
    cascadeStrictness,
    setCascadeStrictness,
    nliThreshold,
    setNliThreshold,
    showToast,
  } = useSettings();

  const [mode, setMode] = useState<'local' | 'live'>(config.mode || 'local');
  const [baseUrl, setBaseUrl] = useState(config.baseUrl || '');
  const [timeoutMs, setTimeoutMs] = useState(config.timeoutMs);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = () => {
    updateConfig({
      mode,
      baseUrl: baseUrl.trim(),
      useMock: mode === 'local',
      timeoutMs: Number(timeoutMs),
    });
    onClose();
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        setConnectionStatus('success');
        showToast('Successfully connected to backend', 'success');
      } else {
        setConnectionStatus('failed');
        showToast(`Server returned status ${res.status}`, 'warning');
      }
    } catch {
      setConnectionStatus('failed');
      showToast(`Unable to reach backend at ${baseUrl}`, 'error');
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-white border border-gray-300 rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-gray-200 text-gray-700">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Audit Settings & API
              </h3>
              <p className="text-xs text-gray-500">
                Configure cascade threshold parameters and live backend connection.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Backend Mode Switch */}
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-900">
                <Server className="w-4 h-4 text-gray-600" />
                <span>Backend Execution Mode</span>
              </div>
              <div className="flex items-center gap-1 bg-white p-0.5 rounded border border-gray-200 text-xs">
                <button
                  type="button"
                  onClick={() => setMode('local')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                    mode === 'local'
                      ? 'bg-gray-900 text-white font-semibold shadow-xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Local Audit Mode
                </button>
                <button
                  type="button"
                  onClick={() => setMode('live')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                    mode === 'live'
                      ? 'bg-emerald-100 text-emerald-900 font-semibold shadow-xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Live Backend API
                </button>
              </div>
            </div>

            <p className="text-[11px] text-gray-500 leading-relaxed">
              {mode === 'local'
                ? 'Audits user-uploaded documents locally using client-side decomposition and verification. Works out-of-the-box without requiring an external backend.'
                : 'Directly querying your external RAG backend at /api/query.'}
            </p>

            {mode === 'live' && (
              <div className="space-y-2 pt-2 border-t border-gray-200">
                <label className="text-xs font-medium text-gray-700 block">
                  Backend API Base URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="http://localhost:8000"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-xs text-gray-900 font-mono focus:outline-none focus:border-gray-500"
                  />
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testingConnection || !baseUrl.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-100 border border-gray-200 text-xs text-gray-700 transition-colors disabled:opacity-50"
                  >
                    {testingConnection ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Wifi className="w-3.5 h-3.5" />
                    )}
                    <span>Ping</span>
                  </button>
                </div>

                {connectionStatus === 'success' && (
                  <p className="text-[11px] text-emerald-700 flex items-center gap-1">
                    <Check className="w-3 h-3 stroke-[2.5]" /> Backend connected
                  </p>
                )}
                {connectionStatus === 'failed' && (
                  <p className="text-[11px] text-rose-700 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Could not reach backend server.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Cascade Strictness */}
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-900">
                Cascade Strictness
              </span>
              <span className="text-xs font-mono uppercase text-gray-500">
                {cascadeStrictness}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                { id: 'fast', label: 'Fast', desc: 'Heuristics prioritized' },
                { id: 'balanced', label: 'Balanced', desc: 'Standard cascade' },
                { id: 'strict', label: 'Strict', desc: 'Full verification depth' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setCascadeStrictness(m.id as any)}
                  className={`p-2 rounded border text-left transition-all ${
                    cascadeStrictness === m.id
                      ? 'bg-white border-gray-900 text-gray-900 shadow-xs'
                      : 'bg-white/60 border-gray-200 text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <p className="font-semibold text-xs text-gray-900">{m.label}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{m.desc}</p>
                </button>
              ))}
            </div>

            {/* NLI Ambiguity Threshold */}
            <div className="pt-2 border-t border-gray-200 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-700">NLI Ambiguity Threshold:</span>
                <span className="font-mono text-gray-900 font-semibold">
                  {Math.round(nliThreshold * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="0.98"
                step="0.01"
                value={nliThreshold}
                onChange={(e) => setNliThreshold(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded appearance-none cursor-pointer accent-gray-900"
              />
            </div>

            {/* Timeout */}
            <div className="pt-2 border-t border-gray-200 flex items-center justify-between text-xs">
              <span className="text-gray-700">Request Timeout:</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="2000"
                  max="60000"
                  step="1000"
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(Number(e.target.value))}
                  className="w-20 px-2 py-1 rounded bg-white border border-gray-300 text-right text-xs font-mono text-gray-900"
                />
                <span className="text-gray-500 font-mono">ms</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-gray-100 border border-gray-200 text-xs text-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-medium transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
