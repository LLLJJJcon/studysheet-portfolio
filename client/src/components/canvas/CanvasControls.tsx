import React, { useState, useCallback } from 'react';

interface CanvasControlsProps {
  courseId: string;
  onOptimizeLayout: () => Promise<void>;
  isOptimizing?: boolean;
}

/**
 * Canvas control bar with AI Layout Optimization button and other canvas actions.
 */
export const CanvasControls: React.FC<CanvasControlsProps> = ({
  courseId: _courseId,
  onOptimizeLayout,
  isOptimizing = false,
}) => {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleOptimize = useCallback(async () => {
    setShowConfirm(false);
    await onOptimizeLayout();
  }, [onOptimizeLayout]);

  return (
    <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
      {/* AI Layout Optimize button */}
      <div className="relative">
        <button
          onClick={() => setShowConfirm(true)}
          disabled={isOptimizing}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg shadow-sm transition-all ${
            isOptimizing
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-700 border border-gray-200'
          }`}
        >
          {isOptimizing ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              优化中...
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
              AI 优化布局
            </>
          )}
        </button>

        {/* Confirmation popover */}
        {showConfirm && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 p-3 z-30">
            <p className="text-xs text-gray-600 mb-3">
              AI 将重新排列自动定位的知识块以优化空间利用。手动移动过的知识块将保持不变。
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700"
              >
                取消
              </button>
              <button
                onClick={handleOptimize}
                className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
              >
                确认优化
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
