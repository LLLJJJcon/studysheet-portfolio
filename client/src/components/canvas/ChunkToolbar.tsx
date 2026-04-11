import React, { useCallback } from 'react';

interface ChunkToolbarProps {
  nodeId: string;
  onDelete: (nodeId: string) => void;
  sourceFile?: string;
  onShowSource?: (nodeId: string) => void;
}

export const ChunkToolbar: React.FC<ChunkToolbarProps> = ({
  nodeId,
  onDelete,
  sourceFile,
  onShowSource,
}) => {
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

  return (
    <div className="absolute -top-8 right-0 flex items-center gap-1 bg-white rounded shadow-md border border-gray-200 px-1 py-0.5">
      {sourceFile && (
        <button
          className="text-[10px] text-gray-500 px-1 truncate max-w-[150px] hover:text-blue-600"
          title={`查看来源: ${sourceFile}`}
          onClick={handleShowSource}
        >
          📄 {sourceFile}
        </button>
      )}
      <button
        className="p-1 hover:bg-red-50 rounded text-red-500 transition-colors"
        onClick={handleDelete}
        title="删除"
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
    </div>
  );
};
