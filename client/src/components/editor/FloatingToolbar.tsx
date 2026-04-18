import React, { useState, useCallback, useRef, useEffect } from 'react';

interface FloatingToolbarProps {
  nodeId: string;
  content: string;
  x: number;          // px position
  y: number;          // px position
  width: number;      // px
  fontSize: number;
  onSave: (nodeId: string, content: string) => void;
  onCancel: () => void;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  nodeId,
  content,
  x,
  y,
  width,
  fontSize,
  onSave,
  onCancel,
}) => {
  const [editValue, setEditValue] = useState(content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      // Auto-size
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, []);

  const handleSave = useCallback(() => {
    onSave(nodeId, editValue);
  }, [nodeId, editValue, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    },
    [onCancel, handleSave]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setEditValue(e.target.value);
      // Auto-size
      e.target.style.height = 'auto';
      e.target.style.height = `${e.target.scrollHeight}px`;
    },
    []
  );

  return (
    <div
      className="absolute z-50"
      style={{ left: x, top: y - 36 }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-1 bg-white rounded-t-lg shadow-lg border border-gray-200 px-2 py-1 mb-0">
        <button
          className="px-2 py-0.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          onClick={handleSave}
        >
          Save (Ctrl+Enter)
        </button>
        <button
          className="px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          onClick={onCancel}
        >
          Cancel (Esc)
        </button>
        <span className="text-xs text-gray-400 ml-2">
          {editValue.length} Character
        </span>
      </div>

      {/* Text editor */}
      <textarea
        ref={textareaRef}
        className="block bg-white border border-gray-200 border-t-0 rounded-b-lg shadow-lg p-2 outline-none resize-none"
        style={{
          width: Math.max(width, 200),
          fontSize: `${Math.max(fontSize, 10)}pt`,
          lineHeight: 1.4,
          minHeight: 60,
        }}
        value={editValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
};
