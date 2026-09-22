import React from 'react';
import { SettingsProvider } from './context/SettingsContext';
import { ChatProvider } from './context/ChatContext';
import { MainLayout } from './components/layout/MainLayout';

export const App: React.FC = () => {
  return (
    <SettingsProvider>
      <ChatProvider>
        <MainLayout />
      </ChatProvider>
    </SettingsProvider>
  );
};

export default App;
