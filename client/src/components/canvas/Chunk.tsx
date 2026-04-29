import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChunkToolbar } from './ChunkToolbar';
import { useCanvasStore } from '../../stores/canvasStore';
import { useTreeStore } from '../../stores/treeStore';
import { useChunkChatStore } from '../../stores/chunkChatStore';
import { TreeNode } from '../../types/tree';
import { MM_TO_PX } from '../../utils/constants';

// Traverse the tree to find the source file associated with a target node
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
  heightMm?: number;
  onInsertImage?: (afterNodeId: string) => void;
}

// Importance-level to CSS class mapping for chunk border and background colors
const IMPORTANCE_COLORS: Record<string, string> = {
  'High-Frequency': 'border-red-300 bg-red-50',
  Important: 'border-blue-300 bg-blue-50',
  Awareness: 'border-gray-300 bg-gray-50',
};

// Importance-level to highlight ring color mapping for selected/highlighted chunks
const HIGHLIGHT_RING: Record<string, string> = {
  'High-Frequency': 'ring-red-400',
  Important: 'ring-blue-400',
  Awareness: 'ring-gray-400',
};

// Render a single chunk with inline editing, drag-and-drop, resize, markdown preview, and toolbar
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
  heightMm,
  onInsertImage,
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(content);
  const [isResizing, setIsResizing] = useState(false);
  const [liveSizePx, setLiveSizePx] = useState<{ height: number } | null>(null);
  const liveSizeRef = useRef<{ height: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const updateChunkContent = useCanvasStore((s) => s.updateChunkContent);
  const setChunkBoxSize = useCanvasStore((s) => s.setChunkBoxSize);
  const tree = useTreeStore((s) => s.tree);
  const sourceFile = tree ? findSourceFile(tree, nodeId) : undefined;
  const highlightedDuplicateIds = useChunkChatStore((s) => s.highlightedDuplicateIds);
  const isDuplicateHighlighted = highlightedDuplicateIds.includes(nodeId);
  const openChat = useChunkChatStore((s) => s.open);

  const handleAskAI = useCallback(() => {
    setIsEditing(false);
    openChat(nodeId);
  }, [nodeId, openChat]);

  const minHeightMm = 8;
  const baseHeightPx = Math.max(36, (heightMm || minHeightMm) * MM_TO_PX);
  const appliedHeightPx = liveSizePx?.height || baseHeightPx;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(nodeId);
    },
    [nodeId, onSelect]
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

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isEditing) return;

    setIsResizing(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startHeight = appliedHeightPx;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dy = moveEvent.clientY - startY;
      const nextHeight = Math.max(minHeightMm * MM_TO_PX, startHeight + dy);
      const next = { height: nextHeight };
      liveSizeRef.current = next;
      setLiveSizePx(next);
    };

    const handleMouseUp = () => {
      const finalSize = liveSizeRef.current || { height: startHeight };
      setChunkBoxSize(
        nodeId,
        undefined,
        Math.max(minHeightMm, finalSize.height / MM_TO_PX)
      );
      setIsResizing(false);
      setLiveSizePx(null);
      liveSizeRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [appliedHeightPx, isEditing, nodeId, setChunkBoxSize]);

  return (
    <div
      ref={divRef}
      draggable={!isEditing && !isResizing}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border rounded cursor-pointer transition-shadow ${colorClass} ${
        isSelected ? `ring-2 ${highlightRing} shadow-md` : ''
      } ${isHighlighted ? `ring-1 ${highlightRing}` : ''} ${
        isDuplicateHighlighted ? 'ring-2 ring-orange-400 ring-dashed' : ''
      }`}
      style={{
        fontSize: `${fontSize}pt`,
        lineHeight: 1.35,
        marginBottom: 2,
        minHeight: `${appliedHeightPx}px`,
        borderTop: showInsertBefore ? '3px solid #3b82f6' : undefined,
        borderBottom: showInsertAfter ? '3px solid #3b82f6' : undefined,
        position: 'relative',
        WebkitBoxDecorationBreak: 'clone',
        boxDecorationBreak: 'clone' as const,
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <div className="px-0.5 py-px">
        {isEditing ? (
          <>
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
            <button
              className="text-xs text-purple-500 hover:text-purple-700 mt-1 px-1"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAskAI();
              }}
            >
              Ask AI
            </button>
          </>
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
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
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
          onAskAI={handleAskAI}
          anchorEl={divRef.current}
        />
      )}

      {isSelected && !isEditing && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1">
          {onInsertImage && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onInsertImage(nodeId);
              }}
              className="w-7 h-5 bg-emerald-500 text-white rounded-md shadow hover:bg-emerald-600 cursor-pointer flex items-center justify-center"
              title="Add image"
              aria-label="Add image"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M8 13l2.5-2.5L16 16" />
                <path d="M14.5 12.5L16 11l3 3" />
              </svg>
            </button>
          )}

          <button
            type="button"
            onMouseDown={handleResizeStart}
            className="w-7 h-5 bg-blue-500 text-white rounded-md shadow cursor-ns-resize flex items-center justify-center"
            title="Drag to adjust block height"
            aria-label="Adjust block height"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 4v16" />
              <path d="M8 8l4-4 4 4" />
              <path d="M8 16l4 4 4-4" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};
