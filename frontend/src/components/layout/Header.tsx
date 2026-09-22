import React from 'react';
import { useChat } from '../../context/ChatContext';
import { useSettings } from '../../context/SettingsContext';
import {
  Menu,
  Files,
  SlidersHorizontal,
} from 'lucide-react';

interface HeaderProps {
  currentView: 'chat' | 'knowledge' | 'analytics';
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onOpenSettings,
}) => {
  const {
    isSidebarOpen,
    toggleSidebar,
    activeSession,
    toggleSourcesDrawer,
    isSourcesDrawerOpen,
  } = useChat();
  const { config } = useSettings();

  const totalCitations = React.useMemo(() => {
    if (!activeSession) return 0;
    const docNames = new Set<string>();
    activeSession.messages.forEach((m) => {
      m.claims?.forEach((c) => {
        c.evidence?.forEach((ev) => docNames.add(ev.document_name));
      });
    });
    return docNames.size;
  }, [activeSession]);

  return (
    <header className="h-12 px-4 border-b border-gray-200 bg-white flex items-center justify-between shrink-0 z-10 select-none">
      <div className="flex items-center gap-3 min-w-0">
        {!isSidebarOpen && (
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            title="Open Sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
            {currentView === 'chat' && (activeSession ? activeSession.title : 'New Claim Verification')}
            {currentView === 'knowledge' && 'Knowledge Corpus'}
            {currentView === 'analytics' && 'Verification Telemetry & Analytics'}
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Backend mode indicator */}
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
          title="Audit Backend Mode"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              config.mode === 'live' ? 'bg-emerald-500' : 'bg-emerald-600'
            }`}
          />
          <span className="hidden sm:inline">
            {config.mode === 'live' ? 'Live Backend' : 'Local Audit'}
          </span>
        </button>

        {/* Sources button in Chat view */}
        {currentView === 'chat' && (
          <button
            onClick={() => toggleSourcesDrawer()}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              isSourcesDrawerOpen
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
            }`}
            title="Retrieved Document Sources"
          >
            <Files className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Sources</span>
            {totalCitations > 0 && (
              <span className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                isSourcesDrawerOpen ? 'bg-gray-800 text-gray-100' : 'bg-gray-100 text-gray-700'
              }`}>
                {totalCitations}
              </span>
            )}
          </button>
        )}

        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          title="Settings"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
