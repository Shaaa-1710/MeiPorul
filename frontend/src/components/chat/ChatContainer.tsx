import React, { useRef, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { UserMessage } from './UserMessage';
import { AssistantMessage } from './AssistantMessage';
import { EmptyState } from './EmptyState';
import { ProgressivePipeline } from './ProgressivePipeline';
import { ChatInput } from './ChatInput';

interface ChatContainerProps {
  onNavigateToKnowledge?: () => void;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({ onNavigateToKnowledge }) => {
  const {
    activeSession,
    isGenerating,
    currentStage,
    stageDetail,
    sendMessage,
  } = useChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeSession?.messages, isGenerating, currentStage]);

  const messages = activeSession?.messages || [];
  const hasMessages = messages.length > 0;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-gray-50">
      {/* Scrollable Conversation Stream */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
        {!hasMessages && !isGenerating ? (
          <div className="h-full flex items-center justify-center">
            <EmptyState
              onSelectPrompt={(prompt) => sendMessage(prompt)}
              onNavigateToKnowledge={onNavigateToKnowledge}
            />
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-2">
            {messages.map((msg) =>
              msg.role === 'user' ? (
                <UserMessage key={msg.id} message={msg} />
              ) : (
                <AssistantMessage key={msg.id} message={msg} />
              )
            )}

            {/* In-flight Verification Pipeline Progress */}
            {isGenerating && (
              <ProgressivePipeline
                currentStage={currentStage}
                stageDetail={stageDetail}
              />
            )}

            <div ref={messagesEndRef} className="h-4" />
          </div>
        )}
      </div>

      {/* Persistent Bottom Composer */}
      <div className="shrink-0 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent pt-2">
        <ChatInput
          onSend={(text) => sendMessage(text)}
          isGenerating={isGenerating}
        />
      </div>
    </div>
  );
};
