import { useCallback, useEffect } from 'react';
import { useHistoryStore } from '../stores/historyStore';

export function useUndoRedo() {
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const canUndo = useHistoryStore((s) => s.past.length > 0);
  const canRedo = useHistoryStore((s) => s.future.length > 0);
  const pushAction = useHistoryStore((s) => s.pushAction);

  // Keyboard shortcuts: Ctrl+Z / Ctrl+Shift+Z
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const recordAction = useCallback(
    (description: string, undoFn: () => void, redoFn: () => void) => {
      pushAction({ description, undo: undoFn, redo: redoFn });
    },
    [pushAction]
  );

  return { undo, redo, canUndo, canRedo, recordAction };
}
