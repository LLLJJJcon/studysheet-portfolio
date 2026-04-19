import React, { useCallback, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ChunkToolbarProps {
  nodeId: string;
  onDelete: (nodeId: string) => void;
  sourceFile?: string;
  onShowSource?: (nodeId: string) => void;
  onAskAI?: (nodeId: string) => void;
  anchorEl?: HTMLElement | null;
}

export const ChunkToolbar: React.FC<ChunkToolbarProps> = ({
  nodeId,
  onDelete,
  sourceFile,
  onShowSource,
  onAskAI,
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

  const handleAskAI = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onAskAI?.(nodeId);
    },
    [nodeId, onAskAI]
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
      {onAskAI && (
        <button
          className="p-1 hover:bg-purple-50 rounded text-purple-500 transition-colors"
          onClick={handleAskAI}
          title="Ask AI"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
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
