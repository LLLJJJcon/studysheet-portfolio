import { useState, useCallback } from 'react';
import { TreeNode as TreeNodeType } from '../../types/tree';
import { TreeNode } from './TreeNode';
import { useTreeStore } from '../../stores/treeStore';
import { useCanvasStore } from '../../stores/canvasStore';

interface ContentTreeProps {
  tree?: TreeNodeType | null;
  selectedNodeId?: string;
  onSelect?: (nodeId: string) => void;
  loading?: boolean;
}

export function ContentTree({ tree: propTree, selectedNodeId: propSelectedId, onSelect: propOnSelect, loading }: ContentTreeProps) {
  const storeTree = useTreeStore((s) => s.tree);
  const storeSelectedId = useTreeStore((s) => s.selectedNodeId);
  const storeSetSelected = useTreeStore((s) => s.setSelectedNodeId);
  const setTree = useTreeStore((s) => s.setTree);

  const tree = propTree ?? storeTree;
  const selectedNodeId = propSelectedId ?? storeSelectedId;
  const onSelect = propOnSelect ?? storeSetSelected;

  const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);

  const handleDragStart = useCallback((nodeId: string) => {
    setDragNodeId(nodeId);
  }, []);

  const handleDragOver = useCallback((nodeId: string) => {
    setDragOverNodeId(nodeId);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragNodeId && dragOverNodeId && dragNodeId !== dragOverNodeId && tree) {
      // Move dragNodeId to be a child of dragOverNodeId
      const draggedNode = findNode(tree, dragNodeId);
      if (draggedNode) {
        let updated = removeNode(tree, dragNodeId);
        if (updated) {
          updated = insertChild(updated, dragOverNodeId, draggedNode);
          setTree(updated);

          // Sync canvas: move chunk to the target section's container
          const { containers, deleteChunk, addChunk } = useCanvasStore.getState();
          // Find the chunk data
          let chunkContent = '';
          let chunkImportance = 'Important';
          for (const c of containers) {
            const ch = c.chunks.find((ck) => ck.nodeId === dragNodeId);
            if (ch) {
              chunkContent = ch.content || '';
              chunkImportance = ch.importance || 'Important';
              break;
            }
          }
          // Move: delete from old location, add to new container
          deleteChunk(dragNodeId);
          // Find last chunk in target container to insert after
          const targetContainer = containers.find((c) => c.parentNodeId === dragOverNodeId);
          const afterId = targetContainer && targetContainer.chunks.length > 0
            ? targetContainer.chunks[targetContainer.chunks.length - 1].nodeId
            : dragOverNodeId;
          addChunk(dragNodeId, chunkContent, chunkImportance, afterId);
        }
      }
    }
    setDragNodeId(null);
    setDragOverNodeId(null);
  }, [dragNodeId, dragOverNodeId, tree, setTree]);

  if (loading) {
    return (
      <div className="p-4 text-sm text-gray-400 animate-pulse">
        Generating content tree...
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="p-4 text-sm text-gray-400">
        No content tree. Upload files and click "Start Generation".
      </div>
    );
  }

  return (
    <div className="py-2 overflow-auto">
      <TreeNode
        node={tree}
        depth={0}
        selectedNodeId={selectedNodeId}
        onSelect={onSelect}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        dragOverNodeId={dragOverNodeId}
      />
    </div>
  );
}

// Helper functions
function findNode(tree: TreeNodeType, nodeId: string): TreeNodeType | null {
  if (tree.nodeId === nodeId) return tree;
  for (const child of tree.children) {
    const found = findNode(child, nodeId);
    if (found) return found;
  }
  return null;
}

function removeNode(tree: TreeNodeType, nodeId: string): TreeNodeType | null {
  if (tree.nodeId === nodeId) return null;
  return {
    ...tree,
    children: tree.children
      .map((child) => removeNode(child, nodeId))
      .filter((c): c is TreeNodeType => c !== null),
  };
}

function insertChild(tree: TreeNodeType, parentId: string, node: TreeNodeType): TreeNodeType {
  if (tree.nodeId === parentId) {
    return { ...tree, children: [...tree.children, node] };
  }
  return {
    ...tree,
    children: tree.children.map((child) => insertChild(child, parentId, node)),
  };
}
