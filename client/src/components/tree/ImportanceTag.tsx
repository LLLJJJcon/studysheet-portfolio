import { useCallback } from 'react';
import { Importance } from '../../types/tree';

const COLORS: Record<Importance, { bg: string; text: string; label: string }> = {
  'High-Frequency': { bg: 'bg-red-100', text: 'text-red-700', label: 'High' },
  Important: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Imp' },
  Awareness: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Aware' },
};

const CYCLE_ORDER: Importance[] = ['High-Frequency', 'Important', 'Awareness'];

interface ImportanceTagProps {
  importance: Importance;
  onClick?: () => void;
  onCycle?: (newImportance: Importance) => void;
}

export function ImportanceTag({ importance, onClick, onCycle }: ImportanceTagProps) {
  const color = COLORS[importance];

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onCycle) {
        const currentIndex = CYCLE_ORDER.indexOf(importance);
        const nextIndex = (currentIndex + 1) % CYCLE_ORDER.length;
        onCycle(CYCLE_ORDER[nextIndex]);
      } else if (onClick) {
        onClick();
      }
    },
    [importance, onClick, onCycle]
  );

  const isClickable = !!onClick || !!onCycle;

  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${color.bg} ${color.text} ${
        isClickable ? 'cursor-pointer hover:opacity-80 active:scale-95 transition-all' : ''
      }`}
      onClick={handleClick}
      title={isClickable ? 'Click to toggle importance' : undefined}
    >
      {color.label}
    </span>
  );
}
