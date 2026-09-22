import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, CornerDownLeft, BookOpen, AlertCircle } from 'lucide-react';
import { useChat } from '../../context/ChatContext';

interface ChatInputProps {
  onSend: (text: string) => void;
  isGenerating: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, isGenerating }) => {
  const { corpusCount } = useChat();
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isSubmittingRef = useRef<boolean>(false);

  // Synchronously unlock when generation completes
  useEffect(() => {
    if (!isGenerating) {
      isSubmittingRef.current = false;
    }
  }, [isGenerating]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ignore IME composition Enter events
    if (e.nativeEvent.isComposing) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isGenerating || isSubmittingRef.current) return;

    // Immediately acquire synchronous lock to prevent double submissions
    isSubmittingRef.current = true;
    onSend(trimmed);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const isDisabled = isGenerating || isSubmittingRef.current;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4 pt-1">
      <div className={`relative rounded-xl bg-white border transition-all shadow-sm ${
        isDisabled ? 'border-gray-200 opacity-90' : 'border-gray-300 focus-within:border-gray-500 focus-within:ring-1 focus-within:ring-gray-400'
      }`}>
        {/* Top Context Info */}
        <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-gray-500 border-b border-gray-100">
          <div className="flex items-center gap-1.5">
            {corpusCount > 0 ? (
              <>
                <BookOpen className="w-3.5 h-3.5 text-gray-400" />
                <span className="font-medium text-gray-700">Indexed Corpus:</span>
                <span className="text-gray-500 font-mono">
                  {corpusCount} {corpusCount === 1 ? 'document' : 'documents'} ready
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span className="font-medium text-amber-800">Knowledge corpus is empty.</span>
                <span className="text-gray-500">Upload documents to verify claims.</span>
              </>
            )}
          </div>
        </div>

        {/* Text Area */}
        <div className="p-3 pb-2">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isDisabled}
            placeholder={
              isDisabled
                ? 'Auditing propositions against indexed documents...'
                : 'Ask a follow-up or enter a claim to audit...'
            }
            className="w-full bg-transparent text-gray-900 placeholder-gray-400 text-sm focus:outline-none resize-none min-h-[40px] max-h-[140px] leading-relaxed disabled:cursor-not-allowed"
          />
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between px-3 pb-2.5 pt-0.5">
          <div className="flex items-center gap-1 text-[11px] text-gray-400">
            <CornerDownLeft className="w-3 h-3" />
            <span>Enter to verify</span>
            <span className="mx-1 opacity-40">·</span>
            <span>Shift + Enter for new line</span>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isDisabled}
            className={`p-1.5 rounded-lg flex items-center justify-center transition-colors ${
              input.trim() && !isDisabled
                ? 'bg-gray-900 text-white hover:bg-black cursor-pointer shadow-xs'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
            title="Submit audit query"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
      </div>
      <p className="text-center text-[11px] text-gray-400 mt-1.5">
        Propositions are extracted and verified against retrieved evidence. Unsubstantiated claims are flagged.
      </p>
    </div>
  );
};
