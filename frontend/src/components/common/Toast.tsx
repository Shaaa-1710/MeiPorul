import React from 'react';
import { useSettings } from '../../context/SettingsContext';
import { AlertCircle, Check, Info, AlertTriangle, X } from 'lucide-react';

export const Toast: React.FC = () => {
  const { toastMessage, hideToast } = useSettings();

  if (!toastMessage) return null;

  const icons = {
    info: <Info className="w-4 h-4 text-gray-700 shrink-0" />,
    success: <Check className="w-4 h-4 text-emerald-700 stroke-[2.5] shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />,
  };

  const borders = {
    info: 'border-gray-300 bg-white text-gray-900',
    success: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    warning: 'border-amber-300 bg-amber-50 text-amber-950',
    error: 'border-rose-300 bg-rose-50 text-rose-950',
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg ${borders[toastMessage.type]}`}
      >
        {icons[toastMessage.type]}
        <p className="text-xs font-medium">{toastMessage.text}</p>
        <button
          onClick={hideToast}
          className="ml-2 text-gray-400 hover:text-gray-700 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
