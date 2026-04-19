import React, { useCallback, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ChunkToolbarProps {
  nodeId: string;
  onDelete: (nodeId: string) => void;
  sourceFile?: string;
  onShowSource?: (nodeId: string) => void;
  anchorEl?: HTMLElement | null;
}

export const ChunkToolbar: React.FC<ChunkToolbarProps> = ({
  nodeId,
  onDelete,
  sourceFile,
  onShowSource,
  anchorEl,
}) => {
  const [position, setPosition] = useState<{ left: number; top: number; placeBelow: boolean } | null>(null);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(nodeId);
    },
    [nodeId, onDelete]
  );

  const handleShowSource = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onShowSource?.(nodeId);
    },
    [nodeId, onShowSource]
  );

  useLayoutEffect(() => {
    if (!anchorEl) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const rect = anchorEl.getBoundingClientRect();
      const placeBelow = rect.top < 44;
      setPosition({
        left: rect.right,
        top: placeBelow ? rect.bottom : rect.top,
        placeBelow,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorEl]);

  if (!position) return null;

  return createPortal(
    <div
      className="fixed z-50 flex items-center gap-1 bg-white/95 rounded shadow-md border border-gray-200 px-1 py-0.5"
      style={{
        left: position.left,
        top: position.top,
        transform: position.placeBelow
          ? 'translate(calc(-100% - 2px), 4px)'
          : 'translate(calc(-100% - 2px), calc(-100% - 4px))',
      }}
    >
      {sourceFile && (
        <button
          className="text-[10px] text-gray-500 px-1 truncate max-w-[150px] hover:text-blue-600"
          title={`View source: ${sourceFile}`}
          onClick={handleShowSource}
        >
          📄 {sourceFile}
        </button>
      )}
      <button
        className="p-1 hover:bg-red-50 rounded text-red-500 transition-colors"
        onClick={handleDelete}
        title="Delete"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
    </div>,
    document.body
  );
};
