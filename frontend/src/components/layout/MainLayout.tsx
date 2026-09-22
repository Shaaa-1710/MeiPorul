import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ChatContainer } from '../chat/ChatContainer';
import { KnowledgePage } from '../knowledge/KnowledgePage';
import { AnalyticsPage } from '../analytics/AnalyticsPage';
import { ClaimInspector } from '../inspector/ClaimInspector';
import { SourcesDrawer } from '../inspector/SourcesDrawer';
import { EvidenceViewer } from '../inspector/EvidenceViewer';
import { SettingsModal } from '../settings/SettingsModal';
import { Toast } from '../common/Toast';

export const MainLayout: React.FC = () => {
  const [currentView, setCurrentView] = useState<'chat' | 'knowledge' | 'analytics'>('chat');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const { activeClaim, isSourcesDrawerOpen } = useChat();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50 text-gray-900 font-sans">
      {/* Persistent / Collapsible Left Sidebar */}
      <Sidebar
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Center Main Stage + Header */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden">
        <Header
          currentView={currentView}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* View Switcher */}
        <main className="flex-1 flex min-h-0 overflow-hidden relative">
          {currentView === 'chat' && (
            <ChatContainer onNavigateToKnowledge={() => setCurrentView('knowledge')} />
          )}
          {currentView === 'knowledge' && <KnowledgePage />}
          {currentView === 'analytics' && <AnalyticsPage />}
        </main>
      </div>

      {/* Right Contextual Drawers / Inspectors (In Chat view) */}
      {currentView === 'chat' && (
        <>
          {activeClaim && <ClaimInspector />}
          {!activeClaim && isSourcesDrawerOpen && <SourcesDrawer />}
        </>
      )}

      {/* Global Modals & Notifications */}
      <EvidenceViewer />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
      <Toast />
    </div>
  );
};
