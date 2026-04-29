import React from 'react';

export interface ChangeItem {
  id: string;
  type: 'update_content' | 'delete_node' | 'add_node' | 'update_importance';
  nodeId: string;
  parentNodeId?: string;
  name?: string;
  oldContent?: string;
  newContent?: string;
  oldImportance?: string;
  newImportance?: string;
  importance?: string;
  reason?: string;
  status: 'pending' | 'accepted' | 'rejected';
}

interface ChangePreviewProps {
  changes: ChangeItem[];
  onAccept: (changeId: string) => void;
  onReject: (changeId: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onClose: () => void;
}

// Label, color, and icon mappings for each change type in the preview panel
const TYPE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  update_content: { label: 'Modify content', color: 'text-blue-600 bg-blue-50', icon: '✏️' },
  delete_node: { label: 'Delete node', color: 'text-red-600 bg-red-50', icon: '🗑️' },
  add_node: { label: 'Add new node', color: 'text-green-600 bg-green-50', icon: '➕' },
  update_importance: { label: 'Adjust importance', color: 'text-amber-600 bg-amber-50', icon: '🏷️' },
};

// Render the AI change preview panel with per-item and bulk accept/reject actions
export const ChangePreview: React.FC<ChangePreviewProps> = ({
  changes,
  onAccept,
  onReject,
  onAcceptAll,
  onRejectAll,
  onClose,
}) => {
  const pendingCount = changes.filter((c) => c.status === 'pending').length;
  const acceptedCount = changes.filter((c) => c.status === 'accepted').length;
  const rejectedCount = changes.filter((c) => c.status === 'rejected').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-2xl mx-4 max-h-[80vh] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-gray-800">AI Change suggestions</h3>
            <div className="flex items-center gap-2 text-xs">
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {pendingCount} Pending
                </span>
              )}
              {acceptedCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-600">
                  {acceptedCount} Accepted
                </span>
              )}
              {rejectedCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                  {rejectedCount} Rejected
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Change list */}
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {changes.map((change) => (
            <ChangeItemCard
              key={change.id}
              change={change}
              onAccept={() => onAccept(change.id)}
              onReject={() => onReject(change.id)}
            />
          ))}
          {changes.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">
              No change suggestions
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <div className="text-xs text-gray-400">
            Total {changes.length} item change(s)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRejectAll}
              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              disabled={pendingCount === 0}
            >
              Reject all
            </button>
            <button
              onClick={onAcceptAll}
              className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
              disabled={pendingCount === 0}
            >
              Accept all
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Render an individual change card with diff display and accept/reject buttons
const ChangeItemCard: React.FC<{
  change: ChangeItem;
  onAccept: () => void;
  onReject: () => void;
}> = ({ change, onAccept, onReject }) => {
  const typeInfo = TYPE_LABELS[change.type] || TYPE_LABELS.update_content;
  const isDone = change.status !== 'pending';

  return (
    <div
      className={`border rounded-lg transition-all ${
        change.status === 'accepted'
          ? 'border-green-200 bg-green-50/50'
          : change.status === 'rejected'
          ? 'border-red-200 bg-red-50/50 opacity-60'
          : 'border-gray-200 bg-white'
      }`}
    >
      {/* Change header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-sm">{typeInfo.icon}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${typeInfo.color}`}>
            {typeInfo.label}
          </span>
          <span className="text-xs text-gray-400 font-mono">{change.nodeId}</span>
        </div>
        {change.status !== 'pending' && (
          <span
            className={`text-xs font-medium ${
              change.status === 'accepted' ? 'text-green-600' : 'text-red-500'
            }`}
          >
            {change.status === 'accepted' ? '✓ Accepted' : '✗ Rejected'}
          </span>
        )}
      </div>

      {/* Change body */}
      <div className="px-4 py-3 text-sm">
        {change.type === 'update_content' && (
          <div className="space-y-2">
            {change.oldContent && (
              <div>
                <span className="text-xs font-medium text-gray-500">Original content:</span>
                <div className="mt-1 p-2 bg-red-50 rounded text-xs text-gray-700 line-clamp-3">
                  {change.oldContent}
                </div>
              </div>
            )}
            {change.newContent && (
              <div>
                <span className="text-xs font-medium text-gray-500">New content:</span>
                <div className="mt-1 p-2 bg-green-50 rounded text-xs text-gray-700 line-clamp-3">
                  {change.newContent}
                </div>
              </div>
            )}
          </div>
        )}

        {change.type === 'delete_node' && change.reason && (
          <div className="text-xs text-gray-600">
            <span className="font-medium">Reason:</span> {change.reason}
          </div>
        )}

        {change.type === 'add_node' && (
          <div className="space-y-1">
            {change.name && (
              <div className="text-xs">
                <span className="font-medium text-gray-500">Name:</span> {change.name}
              </div>
            )}
            {change.importance && (
              <div className="text-xs">
                <span className="font-medium text-gray-500">Importance:</span> {change.importance}
              </div>
            )}
            {change.newContent && (
              <div className="mt-1 p-2 bg-green-50 rounded text-xs text-gray-700 line-clamp-3">
                {change.newContent}
              </div>
            )}
          </div>
        )}

        {change.type === 'update_importance' && (
          <div className="text-xs text-gray-600">
            <span className="font-medium">{change.oldImportance}</span>
            <span className="mx-2">→</span>
            <span className="font-medium">{change.newImportance}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      {!isDone && (
        <div className="flex items-center justify-end gap-2 px-4 py-2 border-t border-gray-100">
          <button
            onClick={onReject}
            className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
          >
            Reject
          </button>
          <button
            onClick={onAccept}
            className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
          >
            Accept
          </button>
        </div>
      )}
    </div>
  );
};
