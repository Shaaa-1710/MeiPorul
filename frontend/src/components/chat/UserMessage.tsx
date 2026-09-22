import React from 'react';
import { ChatMessage } from '../../types/session';
import { formatDateRelative } from '../../utils/formatters';

interface UserMessageProps {
  message: ChatMessage;
}

export const UserMessage: React.FC<UserMessageProps> = ({ message }) => {
  return (
    <div className="w-full py-2.5 flex justify-end">
      <div className="max-w-2xl bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm shadow-2xs">
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        <div className="mt-1 flex justify-end">
          <span className="text-[11px] text-gray-400">
            {formatDateRelative(message.timestamp)}
          </span>
        </div>
      </div>
    </div>
  );
};
