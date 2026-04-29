import { create } from 'zustand';

interface HistoryEntry {
  timestamp: number;
  description: string;
  undo: () => void;
  redo: () => void;
}

interface HistoryState {
  past: HistoryEntry[];
  future: HistoryEntry[];
  maxHistory: number;

  pushAction: (entry: Omit<HistoryEntry, 'timestamp'>) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
}

// Create the history store managing undo/redo action stacks for reversible operations
export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  maxHistory: 50,

  pushAction: (entry) =>
    set((state) => {
      const newEntry: HistoryEntry = {
        ...entry,
        timestamp: Date.now(),
      };
      const past = [...state.past, newEntry].slice(-state.maxHistory);
      return { past, future: [] };
    }),

  undo: () => {
    const { past, future } = get();
    if (past.length === 0) return;

    const entry = past[past.length - 1];
    entry.undo();

    set({
      past: past.slice(0, -1),
      future: [entry, ...future],
    });
  },

  redo: () => {
    const { past, future } = get();
    if (future.length === 0) return;

    const entry = future[0];
    entry.redo();

    set({
      past: [...past, entry],
      future: future.slice(1),
    });
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  clear: () => set({ past: [], future: [] }),
}));
