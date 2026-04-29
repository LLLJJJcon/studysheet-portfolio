import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { TreeNode } from '../types/tree';

// Helper: find and update a node by nodeId in the tree
function updateNodeInTree(
  node: TreeNode,
  nodeId: string,
  updater: (n: TreeNode) => TreeNode
): TreeNode {
  if (node.nodeId === nodeId) return updater(node);
  return {
    ...node,
    children: node.children.map((child) =>
      updateNodeInTree(child, nodeId, updater)
    ),
  };
}

// Helper: remove a node by nodeId from the tree
function removeNodeFromTree(node: TreeNode, nodeId: string): TreeNode {
  return {
    ...node,
    children: node.children
      .filter((child) => child.nodeId !== nodeId)
      .map((child) => removeNodeFromTree(child, nodeId)),
  };
}

// Helper: find a node in the tree
export function findNodeInTree(node: TreeNode, nodeId: string): TreeNode | null {
  if (node.nodeId === nodeId) return node;
  for (const child of node.children) {
    const found = findNodeInTree(child, nodeId);
    if (found) return found;
  }
  return null;
}

// Helper: find parent of a node in the tree
export function findParentInTree(tree: TreeNode, nodeId: string): TreeNode | null {
  for (const child of tree.children) {
    if (child.nodeId === nodeId) return tree;
    const found = findParentInTree(child, nodeId);
    if (found) return found;
  }
  return null;
}

// Helper: extract a node from the tree (remove and return it)
function extractNodeFromTree(tree: TreeNode, nodeId: string): { tree: TreeNode; node: TreeNode | null } {
  let extracted: TreeNode | null = null;
  const strip = (t: TreeNode): TreeNode => ({
    ...t,
    children: t.children.reduce((acc, child) => {
      if (child.nodeId === nodeId) {
        extracted = child;
        return acc;
      }
      acc.push(strip(child));
      return acc;
    }, [] as TreeNode[]),
  });
  const newTree = strip(tree);
  return { tree: newTree, node: extracted };
}

// Helper: insert a node under a parent, positioned relative to a reference sibling
function insertNodeUnderParent(
  tree: TreeNode,
  parentId: string,
  node: TreeNode,
  refSiblingId: string | null,
  position: 'before' | 'after'
): TreeNode {
  if (tree.nodeId === parentId) {
    if (!refSiblingId) {
      return { ...tree, children: [...tree.children, node] };
    }
    const children: TreeNode[] = [];
    let inserted = false;
    for (const child of tree.children) {
      if (position === 'before' && child.nodeId === refSiblingId) {
        children.push(node);
        inserted = true;
      }
      children.push(child);
      if (position === 'after' && child.nodeId === refSiblingId) {
        children.push(node);
        inserted = true;
      }
    }
    // If refSiblingId wasn't found among children, append at end
    if (!inserted) children.push(node);
    return { ...tree, children };
  }
  return {
    ...tree,
    children: tree.children.map((child) =>
      insertNodeUnderParent(child, parentId, node, refSiblingId, position)
    ),
  };
}

interface TreeState {
  tree: TreeNode | null;
  selectedNodeId: string | null;
  highlightedNodeId: string | null;
  setTree: (tree: TreeNode | null) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  setHighlightedNodeId: (nodeId: string | null) => void;
  updateNodeName: (nodeId: string, name: string) => void;
  removeNode: (nodeId: string) => void;
  moveNode: (nodeId: string, newParentId: string, refSiblingId: string | null, position: 'before' | 'after') => void;
}

// Create the tree store managing the content tree structure, node selection, and tree mutations
export const useTreeStore = create<TreeState>()(
  subscribeWithSelector((set) => ({
    tree: null,
    selectedNodeId: null,
    highlightedNodeId: null,

    setTree: (tree) => set({ tree }),
    setSelectedNodeId: (nodeId) => set({ selectedNodeId: nodeId }),
    setHighlightedNodeId: (nodeId) => set({ highlightedNodeId: nodeId }),

    updateNodeName: (nodeId, name) =>
      set((state) => ({
        tree: state.tree
          ? updateNodeInTree(state.tree, nodeId, (n) => ({ ...n, name }))
          : null,
      })),

    removeNode: (nodeId) =>
      set((state) => ({
        tree: state.tree ? removeNodeFromTree(state.tree, nodeId) : null,
      })),

    moveNode: (nodeId, newParentId, refSiblingId, position) =>
      set((state) => {
        if (!state.tree) return {};
        const { tree: stripped, node: extracted } = extractNodeFromTree(state.tree, nodeId);
        if (!extracted) return {};
        const updated = insertNodeUnderParent(stripped, newParentId, extracted, refSiblingId, position);
        return { tree: updated };
      }),
  }))
);

// Initialize bidirectional sync between tree and canvas selection/highlight states
export async function initTreeCanvasSync() {
  const { useCanvasStore } = await import('./canvasStore');

  // Tree selection → Canvas highlight
  useTreeStore.subscribe(
    (state) => state.selectedNodeId,
    (selectedNodeId) => {
      useCanvasStore.getState().setHighlightedChunkId(selectedNodeId);
    }
  );

  // Canvas selection → Tree highlight + selection
  useCanvasStore.subscribe(
    (state: { selectedChunkId: string | null }) => state.selectedChunkId,
    (selectedChunkId: string | null) => {
      const treeState = useTreeStore.getState();
      treeState.setHighlightedNodeId(selectedChunkId);
      treeState.setSelectedNodeId(selectedChunkId);
    }
  );
}
