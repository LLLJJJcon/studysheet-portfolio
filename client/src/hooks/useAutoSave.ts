import { useEffect, useRef, useCallback } from 'react';
import api from '../services/api';

const AUTO_SAVE_INTERVAL = 60_000; // 60 seconds
const DEBOUNCE_DELAY = 5_000; // 5 seconds after last change

interface UseAutoSaveOptions {
  courseId: string | undefined;
  enabled?: boolean;
}

// Auto-save hook that periodically saves version snapshots with debounced and throttled triggers
export function useAutoSave({ courseId, enabled = true }: UseAutoSaveOptions) {
  const lastSaveRef = useRef<number>(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const retryTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const saveVersion = useCallback(async () => {
    if (!courseId || !enabled) return;

    const now = Date.now();
    const elapsed = now - lastSaveRef.current;
    // Don't save more than once per 30 seconds; schedule retry when throttled
    if (elapsed < 30_000) {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = undefined;
        saveVersion();
      }, 30_000 - elapsed + 500);
      return;
    }

    try {
      await api.post(`/courses/${courseId}/versions`);
      lastSaveRef.current = Date.now();
      window.dispatchEvent(new Event('version-saved'));
    } catch {
      // Silently fail auto-save
    }
  }, [courseId, enabled]);

  // Debounced save after state changes
  const triggerSave = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(saveVersion, DEBOUNCE_DELAY);
  }, [saveVersion]);

  // Periodic auto-save
  useEffect(() => {
    if (!enabled || !courseId) return;

    intervalRef.current = setInterval(saveVersion, AUTO_SAVE_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, [courseId, enabled, saveVersion]);

  // Save on page unload
  useEffect(() => {
    if (!enabled || !courseId) return;

    const handleUnload = () => {
      // Use sendBeacon for reliability during unload
      const url = `/api/courses/${courseId}/versions`;
      const body = JSON.stringify({ label: 'Auto-save when page closes' });
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [courseId, enabled]);

  return { triggerSave, saveNow: saveVersion };
}
