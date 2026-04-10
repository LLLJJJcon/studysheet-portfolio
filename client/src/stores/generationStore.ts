import { create } from 'zustand';
import { GenerationPhase, GenerationError } from '../types/generation';

interface SubtreeProgress {
  subtreeName: string;
  chunkCount: number;
}

interface GenerationState {
  phase: GenerationPhase;
  error: GenerationError | null;
  streamingContent: string;
  l2Progress: number;
  l2CompletedSubtrees: SubtreeProgress[];
  totalWordCount: number;
  l3CurrentLevel: string;
  l3CompressedCount: number;
  l3CompletedLevels: string[];
  setPhase: (phase: GenerationPhase) => void;
  setError: (error: GenerationError | null) => void;
  appendStreamingContent: (content: string) => void;
  resetStreamingContent: () => void;
  setL2Progress: (progress: number) => void;
  addCompletedSubtree: (subtree: SubtreeProgress) => void;
  setTotalWordCount: (count: number) => void;
  setL3CurrentLevel: (level: string) => void;
  incrementL3Compressed: () => void;
  addL3CompletedLevel: (level: string) => void;
  reset: () => void;
}

export const useGenerationStore = create<GenerationState>((set) => ({
  phase: 'idle',
  error: null,
  streamingContent: '',
  l2Progress: 0,
  l2CompletedSubtrees: [],
  totalWordCount: 0,
  l3CurrentLevel: '',
  l3CompressedCount: 0,
  l3CompletedLevels: [],

  setPhase: (phase) => set({ phase, error: null }),
  setError: (error) => set({ error, phase: error ? 'error' : 'idle' }),
  appendStreamingContent: (content) =>
    set((state) => ({ streamingContent: state.streamingContent + content })),
  resetStreamingContent: () => set({ streamingContent: '' }),
  setL2Progress: (progress) => set({ l2Progress: progress }),
  addCompletedSubtree: (subtree) =>
    set((state) => ({
      l2CompletedSubtrees: [...state.l2CompletedSubtrees, subtree],
    })),
  setTotalWordCount: (count) => set({ totalWordCount: count }),
  setL3CurrentLevel: (level) => set({ l3CurrentLevel: level }),
  incrementL3Compressed: () =>
    set((state) => ({ l3CompressedCount: state.l3CompressedCount + 1 })),
  addL3CompletedLevel: (level) =>
    set((state) => ({
      l3CompletedLevels: [...state.l3CompletedLevels, level],
    })),
  reset: () =>
    set({
      phase: 'idle',
      error: null,
      streamingContent: '',
      l2Progress: 0,
      l2CompletedSubtrees: [],
      totalWordCount: 0,
      l3CurrentLevel: '',
      l3CompressedCount: 0,
      l3CompletedLevels: [],
    }),
}));
