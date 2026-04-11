import { useState, useCallback, useRef, useEffect } from 'react';
import { TreeNode as TreeNodeType, Importance } from '../../types/tree';
import { ImportanceTag } from './ImportanceTag';
import { TreeNodeActions } from './TreeNodeActions';
import { useTreeStore } from '../../stores/treeStore';

interface TreeNodeProps {
  node: TreeNodeType;
  depth: number;
  selectedNodeId?: string | null;
  onSelect?: (nodeId: string) => void;
  onDragStart?: (nodeId: string) => void;
  onDragOver?: (nodeId: string) => void;
  onDragEnd?: () => void;
  dragOverNodeId?: string | null;
}

export function TreeNode({
  node,
  depth,
  selectedNodeId,
  onSelect,
  onDragStart,
  onDragOver,
  onDragEnd,
  dragOverNodeId,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(node.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const tree = useTreeStore((s) => s.tree);
  const setTree = useTreeStore((s) => s.setTree);
  const highlightedNodeId = useTreeStore((s) => s.highlightedNodeId);

  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedNodeId === node.nodeId;
  const isHighlighted = highlightedNodeId === node.nodeId;
  const isDragOver = dragOverNodeId === node.nodeId;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(node.name);
    setIsEditing(true);
  }, [node.name]);

  const commitEdit = useCallback(() => {
    setIsEditing(false);
    if (editValue.trim() && editValue !== node.name && tree) {
      const updated = updateNodeName(tree, node.nodeId, editValue.trim());
      setTree(updated);
    }
  }, [editValue, node.name, node.nodeId, tree, setTree]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        commitEdit();
      } else if (e.key === 'Escape') {
        setIsEditing(false);
        setEditValue(node.name);
      }
    },
    [commitEdit, node.name]
  );

  const handleImportanceCycle = useCallback(
    (newImportance: Importance) => {
      if (!tree) return;
      const updated = updateNodeImportance(tree, node.nodeId, newImportance);
      setTree(updated);
    },
    [tree, node.nodeId, setTree]
  );

  return (
    <div>
      <div
        className={`group flex items-center gap-1 py-1 px-2 rounded cursor-pointer hover:bg-blue-50 transition-colors ${
          isSelected ? 'bg-blue-100' : ''
        } ${isHighlighted ? 'bg-yellow-50 ring-1 ring-yellow-300' : ''} ${
          isDragOver ? 'bg-green-50 ring-1 ring-green-300' : ''
        }`}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={() => onSelect?.(node.nodeId)}
        draggable={depth > 0}
        onDragStart={(e) => {
          e.stopPropagation();
          onDragStart?.(node.nodeId);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDragOver?.(node.nodeId);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDragEnd?.();
        }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-4 h-4 flex-shrink-0" />
        )}

        {isEditing ? (
          <input
            ref={inputRef}
            className="text-sm flex-1 bg-white border border-blue-300 rounded px-1 py-0.5 outline-none"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="text-sm truncate flex-1"
            onDoubleClick={handleDoubleClick}
          >
            {node.name}
          </span>
        )}

        {node.importance && (
          <ImportanceTag
            importance={node.importance}
            onCycle={handleImportanceCycle}
          />
        )}

        <TreeNodeActions nodeId={node.nodeId} depth={depth} />
      </div>

      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.nodeId}
              node={child}
              depth={depth + 1}
              selectedNodeId={selectedNodeId}
              onSelect={onSelect}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
              dragOverNodeId={dragOverNodeId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function updateNodeName(tree: TreeNodeType, nodeId: string, name: string): TreeNodeType {
  if (tree.nodeId === nodeId) {
    return { ...tree, name };
  }
  return {
    ...tree,
    children: tree.children.map((child) => updateNodeName(child, nodeId, name)),
  };
}

function updateNodeImportance(tree: TreeNodeType, nodeId: string, importance: Importance): TreeNodeType {
  if (tree.nodeId === nodeId) {
    return { ...tree, importance };
  }
  return {
    ...tree,
    children: tree.children.map((child) => updateNodeImportance(child, nodeId, importance)),
  };
}
