import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChunkToolbar } from './ChunkToolbar';
import { useCanvasStore } from '../../stores/canvasStore';
import { useTreeStore } from '../../stores/treeStore';
import { TreeNode } from '../../types/tree';

function findSourceFile(node: TreeNode, targetId: string, ancestorSource?: string): string | undefined {
  const src = node.sourceFile || ancestorSource;
  if (node.nodeId === targetId) return src;
  for (const ch of node.children) {
    const found = findSourceFile(ch, targetId, src);
    if (found) return found;
  }
  return undefined;
}

interface ChunkProps {
  nodeId: string;
  content: string;
  importance: string;
  fontSize: number;
  isSelected: boolean;
  isHighlighted: boolean;
  onSelect: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onShowSource?: (nodeId: string) => void;
  showInsertBefore?: boolean;
  showInsertAfter?: boolean;
  onDragOverPosition?: (nodeId: string, position: 'before' | 'after') => void;
  onDragLeaveChunk?: () => void;
  onDropInsert?: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
}

const IMPORTANCE_COLORS: Record<string, string> = {
  'High-Frequency': 'border-red-300 bg-red-50',
  Important: 'border-blue-300 bg-blue-50',
  Awareness: 'border-gray-300 bg-gray-50',
};

const HIGHLIGHT_RING: Record<string, string> = {
  'High-Frequency': 'ring-red-400',
  Important: 'ring-blue-400',
  Awareness: 'ring-gray-400',
};

export const ChunkComponent: React.FC<ChunkProps> = ({
  nodeId,
  content,
  importance,
  fontSize,
  isSelected,
  isHighlighted,
  onSelect,
  onDelete,
  onShowSource,
  showInsertBefore,
  showInsertAfter,
  onDragOverPosition,
  onDragLeaveChunk,
  onDropInsert,
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const updateChunkContent = useCanvasStore((s) => s.updateChunkContent);
  const tree = useTreeStore((s) => s.tree);
  const sourceFile = tree ? findSourceFile(tree, nodeId) : undefined;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(nodeId);
      if (sourceFile && onShowSource) {
        onShowSource(nodeId);
      }
    },
    [nodeId, onSelect, sourceFile, onShowSource]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setEditText(content);
      setIsEditing(true);
    },
    [content]
  );

  const handleEditDone = useCallback(() => {
    setIsEditing(false);
    if (editText !== content) {
      updateChunkContent(nodeId, editText);
    }
  }, [editText, content, nodeId, updateChunkContent]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
      const ta = textareaRef.current;
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }
  }, [isEditing]);

  const handleEditChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditText(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }, []);

  // Delete key support when selected
  useEffect(() => {
    if (!isSelected || isEditing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        e.preventDefault();
        onDelete(nodeId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelected, isEditing, nodeId, onDelete]);

  const colorClass = IMPORTANCE_COLORS[importance] || IMPORTANCE_COLORS.Important;
  const highlightRing = HIGHLIGHT_RING[importance] || 'ring-blue-400';

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', nodeId);
    e.dataTransfer.effectAllowed = 'move';
  }, [nodeId]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (onDragOverPosition) {
      const rect = divRef.current?.getBoundingClientRect();
      if (rect) {
        const midY = rect.top + rect.height / 2;
        onDragOverPosition(nodeId, e.clientY < midY ? 'before' : 'after');
      }
    }
  }, [nodeId, onDragOverPosition]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (onDragLeaveChunk && divRef.current && !divRef.current.contains(e.relatedTarget as Node)) {
      onDragLeaveChunk();
    }
  }, [onDragLeaveChunk]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId && draggedId !== nodeId && onDropInsert) {
      const rect = divRef.current?.getBoundingClientRect();
      if (rect) {
        const midY = rect.top + rect.height / 2;
        onDropInsert(draggedId, nodeId, e.clientY < midY ? 'before' : 'after');
      }
    }
  }, [nodeId, onDropInsert]);

  return (
    <div
      ref={divRef}
      draggable={!isEditing}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border rounded cursor-pointer transition-shadow ${colorClass} ${
        isSelected ? `ring-2 ${highlightRing} shadow-md` : ''
      } ${isHighlighted ? `ring-1 ${highlightRing}` : ''}`}
      style={{
        fontSize: `${fontSize}pt`,
        lineHeight: 1.35,
        marginBottom: 2,
        borderTop: showInsertBefore ? '3px solid #3b82f6' : undefined,
        borderBottom: showInsertAfter ? '3px solid #3b82f6' : undefined,
        position: 'relative',
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <div className="px-0.5 py-px">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            className="w-full border-none outline-none resize-none bg-transparent text-gray-800"
            style={{ fontSize: `${fontSize}pt`, lineHeight: 1.35, minHeight: '40px' }}
            value={editText}
            onChange={handleEditChange}
            onBlur={handleEditDone}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setIsEditing(false); setEditText(content); }
              e.stopPropagation();
            }}
          />
        ) : (
          (() => {
            const imgMatch = content.match(/^!\[.*?\]\((.*?)\)$/);
            if (imgMatch) {
              return (
                <img
                  src={imgMatch[1]}
                  alt="image"
                  style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              );
            }
            return (
              <div className="text-gray-800 chunk-markdown">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            );
          })()
        )}
      </div>

      {isSelected && (
        <ChunkToolbar
          nodeId={nodeId}
          onDelete={onDelete}
          sourceFile={sourceFile}
          onShowSource={onShowSource}
        />
      )}
    </div>
  );
};
