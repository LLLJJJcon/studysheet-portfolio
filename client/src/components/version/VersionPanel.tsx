import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

interface Version {
  _id: string;
  versionNumber: number;
  label: string;
  description?: string;
  isBaseline: boolean;
  createdAt: string;
}

interface VersionPanelProps {
  courseId: string;
  isOpen: boolean;
  onClose: () => void;
  onRestored?: () => void;
}

export const VersionPanel: React.FC<VersionPanelProps> = ({
  courseId,
  isOpen,
  onClose,
  onRestored,
}) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    try {
      const res = await api.get(`/courses/${courseId}/versions`);
      setVersions(res.data);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (isOpen) fetchVersions();
  }, [isOpen, fetchVersions]);

  // Auto-refresh: poll every 5s when panel is open + listen for version-saved event
  useEffect(() => {
    if (!isOpen) return;
    const handler = () => fetchVersions();
    window.addEventListener('version-saved', handler);
    const interval = setInterval(fetchVersions, 5000);
    return () => {
      window.removeEventListener('version-saved', handler);
      clearInterval(interval);
    };
  }, [isOpen, fetchVersions]);

  const handleRestore = useCallback(
    async (versionId: string) => {
      if (restoring) return;
      if (!confirm('确定恢复到此版本？当前状态将自动保存。')) return;
      setRestoring(versionId);
      try {
        await api.post(`/courses/${courseId}/versions/${versionId}/restore`);
        onRestored?.();
        fetchVersions();
      } catch {
        // Handle error
      } finally {
        setRestoring(null);
      }
    },
    [courseId, restoring, onRestored, fetchVersions]
  );

  const handleMarkBaseline = useCallback(
    async (versionId: string) => {
      try {
        await api.put(`/courses/${courseId}/versions/${versionId}/baseline`);
        fetchVersions();
      } catch {
        // Handle error
      }
    },
    [courseId, fetchVersions]
  );

  const handleDelete = useCallback(
    async (versionId: string) => {
      try {
        await api.delete(`/courses/${courseId}/versions/${versionId}`);
        fetchVersions();
      } catch {
        // Handle error
      }
    },
    [courseId, fetchVersions]
  );

  const handleSaveNow = useCallback(async () => {
    try {
      await api.post(`/courses/${courseId}/versions`, {
        label: '手动保存',
        description: '用户手动创建的快照',
      });
      fetchVersions();
    } catch {
      // Handle error
    }
  }, [courseId, fetchVersions]);

  if (!isOpen) return null;

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin} 分钟前`;
    if (diffHour < 24) return `${diffHour} 小时前`;
    if (diffDay < 7) return `${diffDay} 天前`;
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-xl border-l border-gray-200 z-40 flex flex-col animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-sm font-semibold text-gray-800">版本历史</h3>
          <span className="text-[10px] text-gray-400">{versions.length} 个版本</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleSaveNow}
            className="px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="创建快照"
          >
            + 快照
          </button>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-auto py-3">
        {loading && versions.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400">加载中...</div>
        ) : versions.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400">暂无版本记录<br /><span className="text-xs">修改内容后会自动记录</span></div>
        ) : (
          <div className="relative pl-8 pr-4">
            {/* Timeline line */}
            <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gray-200" />

            {versions.map((v, idx) => {
              const isFirst = idx === 0;
              return (
                <div key={v._id} className="relative pb-4 group">
                  {/* Timeline dot */}
                  <div
                    className={`absolute left-[-21px] top-1.5 w-3 h-3 rounded-full border-2 ${
                      v.isBaseline
                        ? 'bg-blue-500 border-blue-500'
                        : isFirst
                        ? 'bg-green-500 border-green-500'
                        : 'bg-white border-gray-300 group-hover:border-blue-400'
                    }`}
                  />

                  {/* Content card */}
                  <div className={`rounded-lg p-2.5 transition-colors ${
                    v.isBaseline ? 'bg-blue-50 border border-blue-200' :
                    isFirst ? 'bg-green-50 border border-green-200' :
                    'bg-gray-50 border border-transparent hover:border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-gray-400">v{v.versionNumber}</span>
                        {v.isBaseline && (
                          <span className="px-1 py-px text-[9px] font-medium bg-blue-100 text-blue-700 rounded">基线</span>
                        )}
                        {isFirst && !v.isBaseline && (
                          <span className="px-1 py-px text-[9px] font-medium bg-green-100 text-green-700 rounded">HEAD</span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400">{formatTime(v.createdAt)}</span>
                    </div>

                    <div className="text-xs text-gray-700 font-medium truncate">{v.label}</div>

                    {v.description && (
                      <div className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{v.description}</div>
                    )}

                    <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleRestore(v._id)}
                        disabled={restoring === v._id}
                        className="px-1.5 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-100 rounded transition-colors disabled:opacity-50"
                      >
                        {restoring === v._id ? '恢复中...' : '恢复到此版本'}
                      </button>
                      {!v.isBaseline && (
                        <>
                          <button
                            onClick={() => handleMarkBaseline(v._id)}
                            className="px-1.5 py-0.5 text-[10px] font-medium text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          >
                            标记基线
                          </button>
                          <button
                            onClick={() => handleDelete(v._id)}
                            className="px-1.5 py-0.5 text-[10px] font-medium text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors ml-auto"
                          >
                            删除
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Restoring overlay */}
      {restoring && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            正在恢复版本...
          </div>
        </div>
      )}
    </div>
  );
};
