import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useChunkChatStore } from '../../stores/chunkChatStore';
import { useCanvasStore } from '../../stores/canvasStore';
import { useTreeStore } from '../../stores/treeStore';
import { useCourseStore } from '../../stores/courseStore';
import { ChatMessage } from './ChatMessage';
import { useSSE } from '../../hooks/useSSE';
import { parseSuggestion } from '../../utils/parseSuggestion';
import { getTreePath } from '../../utils/treePath';
import { buildChunkIndex } from '../../utils/chunkIndex';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const MAX_HISTORY_MESSAGES = 20;

interface ChunkAIChatProps {
  courseId: string;
}

export const ChunkAIChat: React.FC<ChunkAIChatProps> = ({ courseId }) => {
  const isOpen = useChunkChatStore((s) => s.isOpen);
  const targetNodeId = useChunkChatStore((s) => s.targetNodeId);
  const messages = useChunkChatStore((s) => s.messages);
  const isStreaming = useChunkChatStore((s) => s.isStreaming);
  const streamingContent = useChunkChatStore((s) => s.streamingContent);
  const close = useChunkChatStore((s) => s.close);
  const addUserMessage = useChunkChatStore((s) => s.addUserMessage);
  const startStreaming = useChunkChatStore((s) => s.startStreaming);
  const appendStreamToken = useChunkChatStore((s) => s.appendStreamToken);
  const finishStreaming = useChunkChatStore((s) => s.finishStreaming);
  const applySuggestion = useChunkChatStore((s) => s.applySuggestion);
  const setHighlightedDuplicates = useChunkChatStore((s) => s.setHighlightedDuplicates);

  const [input, setInput] = useState('');
  const [thinkingStep, setThinkingStep] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Close drawer when selected chunk changes
  useEffect(() => {
    const unsub = useCanvasStore.subscribe(
      (s) => s.selectedChunkId,
      (newId) => {
        const store = useChunkChatStore.getState();
        if (store.isOpen && newId !== store.targetNodeId) {
          store.close();
        }
      }
    );
    return unsub;
  }, []);

  const onEvent = useCallback(
    (eventType: string, data: unknown) => {
      const d = data as Record<string, any>;
      switch (eventType) {
        case 'chat:thinking':
          setThinkingStep(d.step || null);
          break;
        case 'chat:routed':
          setThinkingStep(null);
          break;
        case 'chat:checked':
          setThinkingStep(null);
          if (d.hasDuplicates && d.chunks) {
            const dupIds = d.chunks
              .filter((c: any) => c.isDuplicate)
              .map((c: any) => c.nodeId);
            setHighlightedDuplicates(dupIds);
          }
          break;
        case 'chat:token':
          appendStreamToken(d.content || '');
          break;
        case 'chat:done': {
          const { cleanContent, suggestion } = parseSuggestion(d.fullContent || '');
          finishStreaming(cleanContent, suggestion);
          setThinkingStep(null);
          break;
        }
      }
    },
    [appendStreamToken, finishStreaming, setHighlightedDuplicates]
  );

  const onError = useCallback(
    (error: Error) => {
      finishStreaming(`Error: ${error.message}`, null);
      setThinkingStep(null);
    },
    [finishStreaming]
  );

  const onDone = useCallback(() => {
    setThinkingStep(null);
  }, []);

  const { connect, disconnect } = useSSE({ onEvent, onError, onDone });

  // Disconnect SSE on close
  useEffect(() => {
    if (!isOpen) disconnect();
  }, [isOpen, disconnect]);

  const getChunkInfo = useCallback(() => {
    if (!targetNodeId) return null;
    const containers = useCanvasStore.getState().containers;
    for (const container of containers) {
      const chunk = container.chunks.find((c) => c.nodeId === targetNodeId);
      if (chunk) return chunk;
    }
    return null;
  }, [targetNodeId]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || !targetNodeId) return;

    const chunk = getChunkInfo();
    if (!chunk) return;

    const tree = useTreeStore.getState().tree;
    if (!tree) return;

    const containers = useCanvasStore.getState().containers;

    startStreaming();
    addUserMessage(trimmed);
    setInput('');

    const treePath = getTreePath(tree, targetNodeId);
    const chunkIndex = buildChunkIndex(containers, tree, targetNodeId);
    const currentCourse = useCourseStore.getState().currentCourse;
    const pageWordLimit = currentCourse?.pageConfig?.wordLimit || 5000;

    const chatMessages = useChunkChatStore
      .getState()
      .messages.filter((m) => m.role !== 'welcome')
      .slice(-MAX_HISTORY_MESSAGES)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const url = `${API_URL}/courses/${courseId}/chunks/${targetNodeId}/chat`;
    connect(url, {
      messages: chatMessages,
      chunkContext: {
        content: chunk.content || '',
        name: chunk.name || targetNodeId,
        importance: chunk.importance || 'Important',
        treePath,
        wordCount: (chunk.content || '').split(/\s+/).filter(Boolean).length,
        pageWordLimit,
        chunkIndex,
      },
    });
  }, [input, isStreaming, targetNodeId, courseId, getChunkInfo, startStreaming, addUserMessage, connect]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleApply = useCallback(
    (messageId: string) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg?.suggestion || !targetNodeId) return;
      useCanvasStore.getState().updateChunkContent(targetNodeId, msg.suggestion.content);
      applySuggestion(messageId);
    },
    [messages, targetNodeId, applySuggestion]
  );

  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
  }, []);

  // Get current chunk info for header
  const chunk = getChunkInfo();
  const chunkName = chunk?.name || targetNodeId || '';
  const importance = chunk?.importance || '';

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={close}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-[380px] bg-gray-50 shadow-xl z-50 flex flex-col transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm">✨</span>
              <span className="font-medium text-sm text-gray-800 truncate">AI Assistant</span>
              <span className="text-xs text-gray-500 truncate">{chunkName}</span>
            </div>
            {importance && (
              <div className="text-xs text-gray-400 mt-0.5 pl-6">
                importance: {importance}
              </div>
            )}
          </div>
          <button
            onClick={close}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              onApply={handleApply}
              onCopy={handleCopy}
            />
          ))}

          {/* Streaming content */}
          {isStreaming && streamingContent && (
            <div className="flex justify-start">
              <div className="max-w-[85%] px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-800 whitespace-pre-wrap">
                {streamingContent}
              </div>
            </div>
          )}

          {/* Thinking indicator */}
          {isStreaming && !streamingContent && (
            <div className="flex justify-start">
              <div className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-400 flex items-center gap-2">
                <span className="animate-pulse">●</span>
                {thinkingStep === 'routing'
                  ? 'Analyzing intent...'
                  : thinkingStep === 'checking'
                    ? 'Checking for duplicates...'
                    : 'Thinking...'}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-gray-200 bg-white px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask AI to edit this chunk..."
              disabled={isStreaming}
              rows={1}
              className="flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
              style={{ maxHeight: 120 }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 120) + 'px';
              }}
            />
            <button
              onClick={handleSend}
              disabled={isStreaming || !input.trim()}
              className="p-2 text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
              </svg>
            </button>
          </div>
          {chunk && (
            <div className="mt-1.5 text-xs text-gray-400">
              Current: {(chunk.content || '').split(/\s+/).filter(Boolean).length} words
            </div>
          )}
        </div>
      </div>
    </>
  );
};
