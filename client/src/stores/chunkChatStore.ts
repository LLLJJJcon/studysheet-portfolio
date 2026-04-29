import { create } from 'zustand';

export interface SuggestionItem {
  content: string;
  applied: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'welcome';
  content: string;
  suggestion?: SuggestionItem | null;
  timestamp: number;
}

interface ChunkChatState {
  isOpen: boolean;
  targetNodeId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  highlightedDuplicateIds: string[];

  open: (nodeId: string) => void;
  close: () => void;
  addUserMessage: (content: string) => void;
  setHighlightedDuplicates: (nodeIds: string[]) => void;
  startStreaming: () => void;
  appendStreamToken: (token: string) => void;
  finishStreaming: (finalContent: string, suggestion?: SuggestionItem | null) => void;
  applySuggestion: (messageId: string) => void;
}

// Default welcome message displayed when the chunk chat panel opens
const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'welcome',
  content: `👋 Hi! I'm your chunk editing assistant. I can help you:
· ✂️ Compress or simplify
· ✍️ Rewrite for clarity
· ➕ Add new content
· 📊 Format as tables or lists
· 🔍 Compare with other chunks

What would you like to do?`,
  timestamp: 0,
};

// Create the chunk chat store managing AI chat panel state, messages, and streaming responses
export const useChunkChatStore = create<ChunkChatState>((set) => ({
  isOpen: false,
  targetNodeId: null,
  messages: [],
  isStreaming: false,
  streamingContent: '',
  highlightedDuplicateIds: [],

  open: (nodeId: string) => set({
    isOpen: true,
    targetNodeId: nodeId,
    messages: [{ ...WELCOME_MESSAGE, timestamp: Date.now() }],
    isStreaming: false,
    streamingContent: '',
    highlightedDuplicateIds: [],
  }),

  close: () => set({
    isOpen: false,
    targetNodeId: null,
    messages: [],
    isStreaming: false,
    streamingContent: '',
    highlightedDuplicateIds: [],
  }),

  addUserMessage: (content: string) => set((state) => ({
    messages: [
      ...state.messages,
      {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: Date.now(),
      },
    ],
  })),

  setHighlightedDuplicates: (nodeIds: string[]) => set({
    highlightedDuplicateIds: nodeIds,
  }),

  startStreaming: () => set({
    isStreaming: true,
    streamingContent: '',
  }),

  appendStreamToken: (token: string) => set((state) => ({
    streamingContent: state.streamingContent + token,
  })),

  finishStreaming: (finalContent: string, suggestion?: SuggestionItem | null) => set((state) => ({
    isStreaming: false,
    streamingContent: '',
    messages: [
      ...state.messages,
      {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: finalContent,
        suggestion: suggestion || null,
        timestamp: Date.now(),
      },
    ],
  })),

  applySuggestion: (messageId: string) => set((state) => ({
    messages: state.messages.map((msg) =>
      msg.id === messageId && msg.suggestion
        ? { ...msg, suggestion: { ...msg.suggestion, applied: true } }
        : msg
    ),
    highlightedDuplicateIds: [],
  })),
}));
