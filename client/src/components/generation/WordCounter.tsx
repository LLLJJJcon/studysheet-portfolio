import React from 'react';
import { useGenerationStore } from '../../stores/generationStore';
import { useWordCount } from '../../hooks/useWordCount';

interface WordCounterProps {
  targetWordCount?: number;
  showPerChunk?: boolean;
}

export const WordCounter: React.FC<WordCounterProps> = ({ targetWordCount, showPerChunk = false }) => {
  const generationWordCount = useGenerationStore((s) => s.totalWordCount);
  const { totalWords: canvasWordCount, perChunk } = useWordCount();

  // Use canvas word count if available, fall back to generation store count
  const totalWordCount = canvasWordCount > 0 ? canvasWordCount : generationWordCount;

  const percentage = targetWordCount
    ? Math.min(100, Math.round((totalWordCount / targetWordCount) * 100))
    : 0;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg">
        <div className="text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{totalWordCount.toLocaleString()}</span>
          {targetWordCount && (
            <span> / {targetWordCount.toLocaleString()}</span>
          )}{' '}
          字
        </div>
        {targetWordCount && (
          <div className="flex-1 max-w-[120px] h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                percentage > 100
                  ? 'bg-red-500'
                  : percentage > 80
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(100, percentage)}%` }}
            />
          </div>
        )}
      </div>
      {showPerChunk && perChunk.length > 0 && (
        <div className="px-3 py-1 text-xs text-gray-400 max-h-32 overflow-auto">
          {perChunk
            .filter((c) => c.wordCount > 0)
            .map((c) => (
              <div key={c.nodeId} className="flex justify-between py-0.5">
                <span className="truncate max-w-[120px]">{c.nodeId}</span>
                <span className="text-gray-500">{c.wordCount}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
