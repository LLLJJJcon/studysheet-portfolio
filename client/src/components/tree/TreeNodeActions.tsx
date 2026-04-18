import React, { useCallback } from 'react';
import { useTreeStore } from '../../stores/treeStore';
import { useCanvasStore } from '../../stores/canvasStore';
import { TreeNode } from '../../types/tree';

// Collect all nodeIds in a subtree (for cascade delete)
function collectNodeIds(node: TreeNode): string[] {
  return [node.nodeId, ...node.children.flatMap(collectNodeIds)];
}

interface TreeNodeActionsProps {
  nodeId: string;
  depth: number;
}

export const TreeNodeActions: React.FC<TreeNodeActionsProps> = ({
  nodeId,
  depth,
}) => {
  const tree = useTreeStore((s) => s.tree);
  const setTree = useTreeStore((s) => s.setTree);

  const addChild = useCallback(() => {
    if (!tree) return;

    const newNode: TreeNode = {
      nodeId: crypto.randomUUID(),
      name: '新节点',
      children: [],
      importance: depth >= 2 ? 'Important' : undefined,
    };

    const updated = insertChild(tree, nodeId, newNode);
    setTree(updated);

    // Sync: add empty placeholder block on canvas
    if (newNode.importance) {
      // Find the last chunk in this section's container to insert after
      const containers = useCanvasStore.getState().containers;
      const container = containers.find((c) => c.parentNodeId === nodeId);
      const lastChunkId = container && container.chunks.length > 0
        ? container.chunks[container.chunks.length - 1].nodeId
        : nodeId; // fallback: use section nodeId (addChunk handles this via parentNodeId fallback)
      useCanvasStore.getState().addChunk(newNode.nodeId, '(空白)', newNode.importance, lastChunkId);
    }
  }, [tree, nodeId, depth, setTree]);

  const addSibling = useCallback(() => {
    if (!tree) return;

    const newNode: TreeNode = {
      nodeId: crypto.randomUUID(),
      name: '新节点',
      children: [],
      importance: depth >= 2 ? 'Important' : undefined,
    };

    const updated = insertSibling(tree, nodeId, newNode);
    setTree(updated);

    // Sync: add empty placeholder block on canvas after this node
    if (newNode.importance) {
      useCanvasStore.getState().addChunk(newNode.nodeId, '(空白)', newNode.importance, nodeId);
    }
  }, [tree, nodeId, depth, setTree]);

  const deleteNode = useCallback(() => {
    if (!tree) return;

    // Collect all nodeIds in the subtree being deleted
    const findNode = (node: TreeNode, targetId: string): TreeNode | null => {
      if (node.nodeId === targetId) return node;
      for (const child of node.children) {
        const found = findNode(child, targetId);
        if (found) return found;
      }
      return null;
    };
    const targetNode = findNode(tree, nodeId);
    if (targetNode) {
      const idsToDelete = collectNodeIds(targetNode);
      const deleteChunk = useCanvasStore.getState().deleteChunk;
      idsToDelete.forEach((id) => deleteChunk(id));
    }

    const updated = removeNode(tree, nodeId);
    if (updated) setTree(updated);
  }, [tree, nodeId, setTree]);

  return (
    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        className="p-0.5 rounded hover:bg-blue-50 text-blue-500"
        onClick={(e) => { e.stopPropagation(); addChild(); }}
        title="添加子节点"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>
      <button
        className="p-0.5 rounded hover:bg-green-50 text-green-500"
        onClick={(e) => { e.stopPropagation(); addSibling(); }}
        title="添加同级节点"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" />
        </svg>
      </button>
      <button
        className="p-0.5 rounded hover:bg-red-50 text-red-500"
        onClick={(e) => { e.stopPropagation(); deleteNode(); }}
        title="删除节点"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

// Tree manipulation helpers
function insertChild(tree: TreeNode, parentId: string, newNode: TreeNode): TreeNode {
  if (tree.nodeId === parentId) {
    return { ...tree, children: [...tree.children, newNode] };
  }
  return {
    ...tree,
    children: tree.children.map((child) => insertChild(child, parentId, newNode)),
  };
}

function insertSibling(tree: TreeNode, siblingId: string, newNode: TreeNode): TreeNode {
  const newChildren = [];
  for (const child of tree.children) {
    newChildren.push(child);
    if (child.nodeId === siblingId) {
      newChildren.push(newNode);
    }
  }

  if (newChildren.length !== tree.children.length) {
    return { ...tree, children: newChildren };
  }

  return {
    ...tree,
    children: tree.children.map((child) => insertSibling(child, siblingId, newNode)),
  };
}

function removeNode(tree: TreeNode, nodeId: string): TreeNode | null {
  if (tree.nodeId === nodeId) return null;

  return {
    ...tree,
    children: tree.children
      .map((child) => removeNode(child, nodeId))
      .filter((child): child is TreeNode => child !== null),
  };
}
