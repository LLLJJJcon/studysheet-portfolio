import React from 'react';

interface VersionItemProps {
  versionId: string;
  versionNumber: number;
  label: string;
  isBaseline: boolean;
  createdAt: string;
  onRestore: (versionId: string) => void;
  onMarkBaseline: (versionId: string) => void;
  onDelete?: (versionId: string) => void;
}

export const VersionItem: React.FC<VersionItemProps> = ({
  versionId,
  versionNumber,
  label,
  isBaseline,
  createdAt,
  onRestore,
  onMarkBaseline,
  onDelete,
}) => {
  const date = new Date(createdAt);
  const timeStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

  return (
    <div
      className={`border rounded-lg p-3 transition-all ${
        isBaseline
          ? 'border-blue-200 bg-blue-50/50'
          : 'border-gray-200 bg-white hover:bg-gray-50'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-400">v{versionNumber}</span>
          {isBaseline && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded">
              基线
            </span>
          )}
        </div>
        <span className="text-[10px] text-gray-400">{timeStr}</span>
      </div>

      <div className="text-sm text-gray-700 mb-2 truncate">{label}</div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onRestore(versionId)}
          className="px-2 py-0.5 text-[11px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
        >
          恢复
        </button>
        {!isBaseline && (
          <>
            <button
              onClick={() => onMarkBaseline(versionId)}
              className="px-2 py-0.5 text-[11px] font-medium text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            >
              标记基线
            </button>
            {onDelete && (
              <button
                onClick={() => onDelete(versionId)}
                className="px-2 py-0.5 text-[11px] font-medium text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors ml-auto"
              >
                删除
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
