import React, { createContext, useContext, useState, useEffect } from 'react';
import { ApiConfig, getStoredApiConfig, setStoredApiConfig } from '../services/apiClient';

interface SettingsContextType {
  config: ApiConfig;
  updateConfig: (newConfig: Partial<ApiConfig>) => void;
  cascadeStrictness: 'balanced' | 'strict' | 'fast';
  setCascadeStrictness: (val: 'balanced' | 'strict' | 'fast') => void;
  nliThreshold: number;
  setNliThreshold: (val: number) => void;
  toastMessage: { text: string; type: 'info' | 'success' | 'warning' | 'error' } | null;
  showToast: (text: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  hideToast: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<ApiConfig>(getStoredApiConfig());
  const [cascadeStrictness, setCascadeStrictness] = useState<'balanced' | 'strict' | 'fast'>('balanced');
  const [nliThreshold, setNliThreshold] = useState<number>(0.85);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'info' | 'success' | 'warning' | 'error' } | null>(null);

  const updateConfig = (newConfig: Partial<ApiConfig>) => {
    const updated = setStoredApiConfig(newConfig);
    setConfig(updated);
    showToast(
      updated.mode === 'live' ? `Live backend enabled (${updated.baseUrl || 'no URL'})` : 'Switched to Local Audit Mode',
      'info'
    );
  };

  const showToast = (text: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setToastMessage({ text, type });
  };

  const hideToast = () => {
    setToastMessage(null);
  };

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  return (
    <SettingsContext.Provider
      value={{
        config,
        updateConfig,
        cascadeStrictness,
        setCascadeStrictness,
        nliThreshold,
        setNliThreshold,
        toastMessage,
        showToast,
        hideToast,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
