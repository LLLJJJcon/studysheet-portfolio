
interface LoadingProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Loading({ message, size = 'md', className = '' }: LoadingProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div
        className={`${sizeClasses[size]} border-gray-200 border-t-blue-600 rounded-full animate-spin`}
      />
      {message && <p className="text-sm text-gray-500">{message}</p>}
    </div>
  );
}

interface FullPageLoadingProps {
  message?: string;
}

export function FullPageLoading({ message = 'Loading...' }: FullPageLoadingProps) {
  return (
    <div className="fixed inset-0 bg-white bg-opacity-80 z-50 flex items-center justify-center">
      <Loading size="lg" message={message} />
    </div>
  );
}

// Generation phase progress display
const phaseLabels: Record<string, { label: string; description: string }> = {
  idle: { label: '', description: '' },
  'l1:generating': { label: 'Step 1/4', description: 'Generating content tree...' },
  'l2:generating': { label: 'Step 2/4', description: 'Generating chunk content...' },
  'l3:compressing': { label: 'Step 3/4', description: 'Compressing to fit pages...' },
  'l4:layout': { label: 'Step 4/4', description: 'Calculating layout...' },
  complete: { label: 'Done', description: 'Study sheet generated!' },
  error: { label: 'Error', description: 'Generation failed' },
};

interface GenerationProgressProps {
  phase: string;
  l2Progress?: number;
  l3CompressedCount?: number;
  totalWords?: number;
}

export function GenerationProgress({
  phase,
  l2Progress = 0,
  l3CompressedCount = 0,
  totalWords = 0,
}: GenerationProgressProps) {
  const info = phaseLabels[phase] || { label: '', description: phase };
  const isActive = phase !== 'idle' && phase !== 'complete' && phase !== 'error';

  if (phase === 'idle') return null;

  const progressPercent =
    phase === 'l1:generating'
      ? 15
      : phase === 'l2:generating'
        ? 15 + l2Progress * 0.5
        : phase === 'l3:compressing'
          ? 70 + Math.min(l3CompressedCount * 3, 20)
          : phase === 'l4:layout'
            ? 92
            : phase === 'complete'
              ? 100
              : 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        {isActive && (
          <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
        )}
        {phase === 'complete' && <span className="text-green-600 text-lg">✓</span>}
        {phase === 'error' && <span className="text-red-600 text-lg">✕</span>}
        <div>
          <span className="text-xs font-semibold text-gray-400 uppercase">{info.label}</span>
          <p className="text-sm font-medium text-gray-700">{info.description}</p>
        </div>
      </div>

      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${
            phase === 'error' ? 'bg-red-500' : phase === 'complete' ? 'bg-green-500' : 'bg-blue-600'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {totalWords > 0 && (
        <p className="text-xs text-gray-400 mt-1">{totalWords.toLocaleString()} words total</p>
      )}
    </div>
  );
}

// Skeleton placeholder
interface SkeletonProps {
  className?: string;
  lines?: number;
}

export function Skeleton({ className = '', lines = 1 }: SkeletonProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-gray-200 rounded animate-pulse"
          style={{ width: `${Math.max(40, 100 - i * 15)}%` }}
        />
      ))}
    </div>
  );
}
