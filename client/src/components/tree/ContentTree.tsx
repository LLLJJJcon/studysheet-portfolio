import { useState, useCallback } from 'react';
import { TreeNode as TreeNodeType } from '../../types/tree';
import { useTreeStore } from '../../stores/treeStore';
import { useCanvasStore } from '../../stores/canvasStore';
import { TreeNodeActions } from './TreeNodeActions';

interface ContentTreeProps {
  tree?: TreeNodeType | null;
  selectedNodeId?: string;
  onSelect?: (nodeId: string) => void;
  loading?: boolean;
}

interface PositionedNode {
  node: TreeNodeType;
  depth: number;
  x: number;
  y: number;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 52;
const H_GAP = 96;
const V_GAP = 26;
const PADDING = 20;

export function ContentTree({ tree: propTree, selectedNodeId: propSelectedId, onSelect: propOnSelect, loading }: ContentTreeProps) {
  const storeTree = useTreeStore((s) => s.tree);
  const storeSelectedId = useTreeStore((s) => s.selectedNodeId);
  const storeSetSelected = useTreeStore((s) => s.setSelectedNodeId);
  const highlightedNodeId = useTreeStore((s) => s.highlightedNodeId);
  const setTree = useTreeStore((s) => s.setTree);
  const setSelectedChunkId = useCanvasStore((s) => s.setSelectedChunkId);
  const setSelectedContainerId = useCanvasStore((s) => s.setSelectedContainerId);

  const tree = propTree ?? storeTree;
  const selectedNodeId = propSelectedId ?? storeSelectedId;
  const onSelect = propOnSelect ?? storeSetSelected;

  const handleSelectNode = useCallback((node: TreeNodeType) => {
    onSelect?.(node.nodeId);

    const isSectionTitle = node.children.length > 0;
    if (isSectionTitle) {
      setSelectedContainerId(node.nodeId);
      setSelectedChunkId(null);
      return;
    }

    setSelectedContainerId(null);
    setSelectedChunkId(node.nodeId);
  }, [onSelect, setSelectedChunkId, setSelectedContainerId]);

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
      const currentParent = findParentNode(tree, dragNodeId);
      // No-op: dropping a node onto its current parent should not rebuild canvas chunks.
      if (currentParent?.nodeId === dragOverNodeId) {
        setDragNodeId(null);
        setDragOverNodeId(null);
        return;
      }

      // Move dragNodeId to be a child of dragOverNodeId
      const draggedNode = findNode(tree, dragNodeId);
      if (draggedNode) {
        let updated = removeNode(tree, dragNodeId);
        if (updated) {
          updated = insertChild(updated, dragOverNodeId, draggedNode);
          setTree(updated);

          // Sync canvas atomically: preserve chunk content/metadata while changing parent container.
          useCanvasStore.getState().moveChunkToParentContainer(dragNodeId, dragOverNodeId);
        }
      }
    }
    setDragNodeId(null);
    setDragOverNodeId(null);
  }, [dragNodeId, dragOverNodeId, tree, setTree]);

  const layout = tree ? computeTreeLayout(tree) : null;
  const positionById = layout ? new Map(layout.nodes.map((n) => [n.node.nodeId, n])) : new Map<string, PositionedNode>();

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
      <div
        className="relative"
        style={{
          width: layout ? Math.max(layout.width, 360) : 360,
          height: layout ? Math.max(layout.height, 180) : 180,
          minWidth: '100%',
        }}
      >
        {layout && (
          <svg
            className="absolute inset-0"
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
          >
            {layout.edges.map((edge) => {
              const from = positionById.get(edge.from);
              const to = positionById.get(edge.to);
              if (!from || !to) return null;

              const startX = from.x + NODE_WIDTH / 2;
              const startY = from.y;
              const endX = to.x - NODE_WIDTH / 2;
              const endY = to.y;
              const midX = (startX + endX) / 2;

              return (
                <path
                  key={`${edge.from}-${edge.to}`}
                  d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
                  fill="none"
                  stroke="#CBD5E1"
                  strokeWidth="1.5"
                />
              );
            })}
          </svg>
        )}

        {layout?.nodes.map(({ node, depth, x, y }) => {
          const isSelected = selectedNodeId === node.nodeId;
          const isHighlighted = highlightedNodeId === node.nodeId;
          const isDragOver = dragOverNodeId === node.nodeId;

          return (
            <div
              key={node.nodeId}
              className={`group absolute rounded-md border shadow-sm bg-white px-2 py-1.5 cursor-pointer transition-colors ${
                isSelected ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-200'
              } ${isHighlighted ? 'bg-yellow-50 border-yellow-300' : ''} ${
                isDragOver ? 'bg-green-50 border-green-400' : ''
              }`}
              style={{
                width: NODE_WIDTH,
                minHeight: NODE_HEIGHT,
                left: x - NODE_WIDTH / 2,
                top: y - NODE_HEIGHT / 2,
              }}
              onClick={() => handleSelectNode(node)}
              draggable={depth > 0}
              onDragStart={(e) => {
                e.stopPropagation();
                handleDragStart(node.nodeId);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDragOver(node.nodeId);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDragEnd();
              }}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-gray-800 truncate flex-1" title={node.name}>
                  {node.name}
                </span>
                {node.importance && <ImportancePill importance={node.importance} />}
                <TreeNodeActions nodeId={node.nodeId} depth={depth} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ImportancePill({ importance }: { importance: NonNullable<TreeNodeType['importance']> }) {
  if (importance === 'High-Frequency') {
    return <span className="text-[10px] px-1 py-0.5 rounded bg-red-100 text-red-700">High</span>;
  }
  if (importance === 'Awareness') {
    return <span className="text-[10px] px-1 py-0.5 rounded bg-gray-100 text-gray-600">Aware</span>;
  }
  return <span className="text-[10px] px-1 py-0.5 rounded bg-orange-100 text-orange-700">Imp</span>;
}

function computeTreeLayout(root: TreeNodeType): {
  nodes: PositionedNode[];
  edges: Array<{ from: string; to: string }>;
  width: number;
  height: number;
} {
  const nodes: PositionedNode[] = [];
  const edges: Array<{ from: string; to: string }> = [];
  let leafIndex = 0;
  let maxDepth = 0;

  const place = (node: TreeNodeType, depth: number): number => {
    maxDepth = Math.max(maxDepth, depth);

    if (!node.children || node.children.length === 0) {
      const y = PADDING + leafIndex * (NODE_HEIGHT + V_GAP) + NODE_HEIGHT / 2;
      const x = PADDING + depth * (NODE_WIDTH + H_GAP) + NODE_WIDTH / 2;
      nodes.push({ node, depth, x, y });
      leafIndex += 1;
      return y;
    }

    const childYs = node.children.map((child) => {
      edges.push({ from: node.nodeId, to: child.nodeId });
      return place(child, depth + 1);
    });

    const y = (childYs[0] + childYs[childYs.length - 1]) / 2;
    const x = PADDING + depth * (NODE_WIDTH + H_GAP) + NODE_WIDTH / 2;
    nodes.push({ node, depth, x, y });
    return y;
  };

  place(root, 0);

  const width = PADDING * 2 + (maxDepth + 1) * NODE_WIDTH + maxDepth * H_GAP;
  const leafCount = Math.max(1, leafIndex);
  const height = PADDING * 2 + leafCount * NODE_HEIGHT + Math.max(0, leafCount - 1) * V_GAP;

  return { nodes, edges, width, height };
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

function findParentNode(tree: TreeNodeType, nodeId: string): TreeNodeType | null {
  for (const child of tree.children) {
    if (child.nodeId === nodeId) return tree;
    const found = findParentNode(child, nodeId);
    if (found) return found;
  }
  return null;
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
