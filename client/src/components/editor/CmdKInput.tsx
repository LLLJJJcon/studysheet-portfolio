import React, { useState, useRef, useEffect, useCallback } from 'react';

interface CmdKInputProps {
  isVisible: boolean;
  onSubmit: (instruction: string) => void;
  onClose: () => void;
  isLoading?: boolean;
}

/**
 * Inline Cmd+K input box.
 * Appears when user presses Cmd/Ctrl+K in the editor.
 * Accepts a natural language editing instruction.
 */
export const CmdKInput: React.FC<CmdKInputProps> = ({
  isVisible,
  onSubmit,
  onClose,
  isLoading = false,
}) => {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when visible
  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isVisible]);

  // Clear value when hidden
  useEffect(() => {
    if (!isVisible) {
      setValue('');
    }
  }, [isVisible]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;
    onSubmit(trimmed);
  }, [value, isLoading, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [handleSubmit, onClose]
  );

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
      />

      {/* Input container */}
      <div className="relative w-full max-w-lg mx-4 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center justify-center w-6 h-6 rounded bg-gray-800 text-white text-xs font-mono">
            K
          </div>
          <span className="text-sm font-medium text-gray-600">AI 编辑指令</span>
          {isLoading && (
            <div className="ml-auto flex items-center gap-1 text-xs text-blue-500">
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              处理中...
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-3">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述你想要的修改，例如：让排序部分更简洁..."
            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder:text-gray-400"
            disabled={isLoading}
          />
        </div>

        {/* Footer hints */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
          <span>Enter 提交 · Esc 取消</span>
          <span>由 AI 生成变更建议</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Hook to listen for Cmd/Ctrl+K shortcut.
 */
export function useCmdKShortcut(onTrigger: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onTrigger();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onTrigger]);
}
