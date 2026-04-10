import React, { useEffect, useState, useRef } from 'react';
import { useGenerationStore } from '../../stores/generationStore';

const PHASE_LABELS: Record<string, string> = {
  idle: '就绪',
  'l1:generating': 'L1: 生成考点树...',
  'l1:complete': 'L1: 考点树已完成',
  'l2:generating': 'L2: 生成分块内容...',
  'l2:complete': 'L2: 分块内容已完成',
  'l3:compressing': 'L3: 内容压缩中...',
  'l3:complete': 'L3: 压缩已完成',
  'l4:layout': 'L4: 排版中...',
  'l4:complete': 'L4: 排版已完成',
  done: '生成完成',
  error: '出错',
};

const IMPORTANCE_LABELS: Record<string, string> = {
  Awareness: '了解级',
  Important: '重要级',
  'High-Frequency': '高频级',
};

export const GenerationStatus: React.FC = () => {
  const phase = useGenerationStore((s) => s.phase);
  const error = useGenerationStore((s) => s.error);
  const l2Progress = useGenerationStore((s) => s.l2Progress);
  const l2CompletedSubtrees = useGenerationStore((s) => s.l2CompletedSubtrees);
  const l3CurrentLevel = useGenerationStore((s) => s.l3CurrentLevel);
  const l3CompressedCount = useGenerationStore((s) => s.l3CompressedCount);
  const l3CompletedLevels = useGenerationStore((s) => s.l3CompletedLevels);
  const totalWordCount = useGenerationStore((s) => s.totalWordCount);
  const streamingContent = useGenerationStore((s) => s.streamingContent);
  const streamRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const isActive = !['idle', 'done', 'error'].includes(phase);

  // Auto-scroll streaming console to bottom
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [streamingContent]);

  useEffect(() => {
    if (!isActive) return;
    setElapsed(0);
    const start = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}分${sec.toString().padStart(2, '0')}秒` : `${sec}秒`;
  };

  if (phase === 'idle') return null;

  return (
    <div className={`rounded-lg border-2 p-4 shadow-sm ${
      isActive ? 'border-blue-400 bg-blue-50/50 animate-pulse-subtle' :
      phase === 'done' ? 'border-green-300 bg-green-50/50' :
      phase === 'error' ? 'border-red-300 bg-red-50/50' :
      'border-gray-200 bg-white'
    }`}>
      <div className="flex items-center gap-3 mb-3">
        {isActive && (
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        )}
        {phase === 'done' && (
          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
        {phase === 'error' && (
          <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )}
        <span className="text-sm font-semibold text-gray-800">
          {PHASE_LABELS[phase] || phase}
        </span>
        <span className="ml-auto flex items-center gap-2">
          {isActive && (
            <span className="text-xs text-gray-400">{formatElapsed(elapsed)}</span>
          )}
          {totalWordCount > 0 && (
            <span className="text-xs text-gray-400">
              {totalWordCount.toLocaleString()} 字
            </span>
          )}
        </span>
      </div>

      {/* Phase progress indicator */}
      {isActive && (
        <div className="flex gap-1 mb-3">
          {['l1', 'l2', 'l3', 'l4'].map((level) => {
            const isCurrentLevel = phase.startsWith(level);
            const isPastLevel = 
              (level === 'l1' && !phase.startsWith('l1')) ||
              (level === 'l2' && ['l3:compressing', 'l3:complete', 'l4:layout', 'l4:complete', 'done'].includes(phase)) ||
              (level === 'l3' && ['l4:layout', 'l4:complete', 'done'].includes(phase));
            return (
              <div
                key={level}
                className={`h-1.5 flex-1 rounded-full ${
                  isPastLevel ? 'bg-green-400' :
                  isCurrentLevel ? 'bg-blue-400 animate-pulse' :
                  'bg-gray-200'
                }`}
              />
            );
          })}
        </div>
      )}

      {phase === 'l2:generating' && (
        <div className="space-y-2">
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.round(l2Progress * 100)}%` }}
            />
          </div>
          <div className="text-xs text-gray-500">
            已完成 {l2CompletedSubtrees.length} 个子树
          </div>
          {l2CompletedSubtrees.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {l2CompletedSubtrees.map((s, i) => (
                <span
                  key={i}
                  className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded"
                >
                  {s.subtreeName} ({s.chunkCount})
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {phase === 'l3:compressing' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {l3CurrentLevel && (
              <span className="text-xs font-medium text-orange-600">
                正在压缩: {IMPORTANCE_LABELS[l3CurrentLevel] || l3CurrentLevel}
              </span>
            )}
            <span className="text-xs text-gray-400">
              已压缩 {l3CompressedCount} 个块
            </span>
          </div>
          {l3CompletedLevels.length > 0 && (
            <div className="flex gap-1">
              {l3CompletedLevels.map((level, i) => (
                <span
                  key={i}
                  className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded"
                >
                  {IMPORTANCE_LABELS[level] || level} ✓
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error.message}
          <button
            onClick={() => {
              useGenerationStore.getState().reset();
            }}
            className="ml-2 text-blue-600 hover:text-blue-800 underline"
          >
            关闭
          </button>
        </div>
      )}

      {/* Streaming console */}
      {isActive && streamingContent && (
        <div
          ref={streamRef}
          className="mt-3 bg-gray-900 rounded-md p-3 max-h-32 overflow-y-auto font-mono text-[10px] leading-relaxed text-green-400 whitespace-pre-wrap break-all select-none opacity-70"
        >
          {streamingContent.slice(-2000)}
          <span className="inline-block w-1.5 h-3 bg-green-400 ml-0.5 animate-pulse" />
        </div>
      )}
    </div>
  );
};
