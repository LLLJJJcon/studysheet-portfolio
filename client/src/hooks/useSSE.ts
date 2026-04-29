import { useCallback, useRef } from 'react';

interface UseSSEOptions {
  onEvent: (eventType: string, data: unknown) => void;
  onError?: (error: Error) => void;
  onDone?: () => void;
}

// Hook for connecting to a server-sent events stream and dispatching parsed events
export function useSSE({ onEvent, onError, onDone }: UseSSEOptions) {
  const abortRef = useRef<AbortController | null>(null);

  const connect = useCallback(
    async (url: string, body?: Record<string, unknown>) => {
      // Abort any existing connection
      abortRef.current?.abort();
      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        const token = localStorage.getItem('token');
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let currentEvent = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ') && currentEvent) {
              try {
                const data = JSON.parse(line.slice(6));
                if (currentEvent === 'done') {
                  onDone?.();
                } else if (currentEvent === 'error') {
                  onError?.(new Error(data.message || 'Unknown error'));
                } else {
                  onEvent(currentEvent, data);
                }
              } catch {
                // Ignore malformed JSON
              }
              currentEvent = '';
            }
          }
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          onError?.(error as Error);
        }
      }
    },
    [onEvent, onError, onDone]
  );

  const disconnect = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  return { connect, disconnect };
}
