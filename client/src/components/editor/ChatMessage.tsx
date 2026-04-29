import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SuggestionBlock } from './SuggestionBlock';
import type { ChatMessage as ChatMessageType } from '../../stores/chunkChatStore';

interface ChatMessageProps {
  message: ChatMessageType;
  onApply?: (messageId: string) => void;
  onCopy?: (content: string) => void;
}

// Render a single chat message bubble for user, assistant, or welcome roles
export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onApply,
  onCopy,
}) => {
  if (message.role === 'welcome') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] px-3 py-2.5 rounded-lg bg-gray-100 text-gray-700 text-sm whitespace-pre-line">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-3 py-2 rounded-lg bg-blue-500 text-white text-sm">
          {message.content}
        </div>
      </div>
    );
  }

  // assistant
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%]">
        <div className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm prose prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>
        {message.suggestion && (
          <SuggestionBlock
            content={message.suggestion.content}
            applied={message.suggestion.applied}
            onApply={() => onApply?.(message.id)}
            onCopy={() => onCopy?.(message.suggestion!.content)}
          />
        )}
      </div>
    </div>
  );
};
