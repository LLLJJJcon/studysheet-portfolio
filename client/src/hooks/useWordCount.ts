import { useMemo } from 'react';
import { useCanvasStore } from '../stores/canvasStore';
import { countWords } from '../utils/wordCount';

interface ChunkWordCount {
  nodeId: string;
  wordCount: number;
}

interface WordCountResult {
  totalWords: number;
  perChunk: ChunkWordCount[];
}

// Hook computing real-time total and per-chunk word counts from canvas store content
export function useWordCount(): WordCountResult {
  const containers = useCanvasStore((s) => s.containers);

  return useMemo(() => {
    const perChunk: ChunkWordCount[] = [];
    let totalWords = 0;

    containers.forEach((container) => {
      container.chunks.forEach((chunk) => {
        const wc = chunk.content ? countWords(chunk.content) : 0;
        perChunk.push({ nodeId: chunk.nodeId, wordCount: wc });
        totalWords += wc;
      });
    });

    return { totalWords, perChunk };
  }, [containers]);
}
