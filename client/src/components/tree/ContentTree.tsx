import { useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { TreeNode as TreeNodeType } from '../../types/tree';
import { useTreeStore } from '../../stores/treeStore';
import { useCanvasStore } from '../../stores/canvasStore';
import { useChunkChatStore } from '../../stores/chunkChatStore';
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
  width: number;
  height: number;
}

const COLLAPSED_NODE_WIDTH = 180;
const COLLAPSED_NODE_HEIGHT = 72;
const EXPANDED_NODE_WIDTH = 320;
const COLUMN_WIDTH = 240;
const H_GAP = 96;
const V_GAP = 26;
const PADDING = 20;

export function ContentTree({ tree: propTree, selectedNodeId: propSelectedId, onSelect: propOnSelect, loading }: ContentTreeProps) {
  const { id: courseId } = useParams<{ id: string }>();
  const storeTree = useTreeStore((s) => s.tree);
  const storeSelectedId = useTreeStore((s) => s.selectedNodeId);
  const storeSetSelected = useTreeStore((s) => s.setSelectedNodeId);
  const highlightedNodeId = useTreeStore((s) => s.highlightedNodeId);
  const setTree = useTreeStore((s) => s.setTree);
  const containers = useCanvasStore((s) => s.containers);
  const setSelectedChunkId = useCanvasStore((s) => s.setSelectedChunkId);
  const setSelectedContainerId = useCanvasStore((s) => s.setSelectedContainerId);
  const [scale, setScale] = useState(1);

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
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(() => new Set());
  const openChat = useChunkChatStore((s) => s.open);

  const chunkTextByNodeId = useMemo(() => {
    const map = new Map<string, string>();
    for (const container of containers) {
      for (const chunk of container.chunks) {
        if (chunk.content) {
          map.set(chunk.nodeId, chunk.content);
        }
      }
    }
    return map;
  }, [containers]);

  const getExpandedText = useCallback((node: TreeNodeType) => {
    const chunkText = chunkTextByNodeId.get(node.nodeId);
    if (chunkText && chunkText.trim().length > 0) {
      return chunkText;
    }
    return node.name;
  }, [chunkTextByNodeId]);

  const handleDragStart = useCallback((nodeId: string) => {
    setDragNodeId(nodeId);
  }, []);

  const handleDragOver = useCallback((nodeId: string) => {
    setDragOverNodeId(nodeId);
  }, []);

  const toggleExpanded = useCallback((nodeId: string) => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const handleAiChat = useCallback((node: TreeNodeType) => {
    openChat(node.nodeId);
    setSelectedChunkId(node.nodeId);
  }, [openChat, setSelectedChunkId]);

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
          useCanvasStore.getState().moveChunkToParentContainer(
            dragNodeId,
            dragOverNodeId,
            collectNodeIds(draggedNode)
          );
        }
      }
    }
    setDragNodeId(null);
    setDragOverNodeId(null);
  }, [dragNodeId, dragOverNodeId, tree, setTree]);

  const layout = tree ? computeTreeLayout(tree, expandedNodeIds, getExpandedText) : null;
  const positionById = layout ? new Map(layout.nodes.map((n) => [n.node.nodeId, n])) : new Map<string, PositionedNode>();

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale((current) => Math.min(3, Math.max(0.1, current * delta)));
    }
  }, []);

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
    <div className="relative h-full min-h-0">
      <div
        className="h-full overflow-auto py-2"
        onWheel={handleWheel}
      >
        <div
          className="relative"
          style={{
            width: layout ? Math.max(layout.width * scale, 360) : 360,
            height: layout ? Math.max(layout.height * scale, 180) : 180,
            minWidth: '100%',
            minHeight: '100%',
          }}
        >
          {layout && (
            <div
              className="absolute top-0 left-0 origin-top-left"
              style={{
                width: layout.width,
                height: layout.height,
                transform: `scale(${scale})`,
              }}
            >
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

                  const startX = from.x + from.width / 2;
                  const startY = from.y;
                  const endX = to.x - to.width / 2;
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

              {layout.nodes.map(({ node, depth, x, y, width, height }) => {
                const isSelected = selectedNodeId === node.nodeId;
                const isHighlighted = highlightedNodeId === node.nodeId;
                const isDragOver = dragOverNodeId === node.nodeId;
                const isExpanded = expandedNodeIds.has(node.nodeId);
                const displayText = isExpanded ? getExpandedText(node) : node.name;

                return (
                  <div
                    key={node.nodeId}
                    className={`group absolute rounded-md border shadow-sm bg-white px-2 py-1.5 cursor-pointer transition-colors ${
                      isSelected ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-200'
                    } ${isHighlighted ? 'bg-yellow-50 border-yellow-300' : ''} ${
                      isDragOver ? 'bg-green-50 border-green-400' : ''
                    }`}
                    style={{
                      width,
                      minHeight: height,
                      left: x - width / 2,
                      top: y - height / 2,
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
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1 min-h-[16px]">
                        {node.importance && <ImportancePill importance={node.importance} />}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          className="text-[10px] px-1 py-0.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(node.nodeId);
                          }}
                          title={isExpanded ? 'Collapse node' : 'Expand node'}
                        >
                          {isExpanded ? '−' : '+'}
                        </button>
                        {node.children.length === 0 && node.importance && (
                          <button
                            type="button"
                            className="text-[10px] px-1 py-0.5 rounded border border-purple-200 text-purple-700 hover:bg-purple-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAiChat(node);
                            }}
                            title="AI Chat"
                          >
                            AI
                          </button>
                        )}
                        <TreeNodeActions nodeId={node.nodeId} depth={depth} />
                      </div>
                    </div>

                    <div
                      className={`text-xs font-medium text-gray-800 w-full ${
                        isExpanded ? 'whitespace-pre-wrap break-words leading-5' : 'overflow-hidden leading-4'
                      }`}
                      title={displayText}
                      style={
                        isExpanded
                          ? undefined
                          : {
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            }
                      }
                    >
                      {displayText}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-3 right-3 z-10 bg-white/80 px-2 py-1 rounded text-xs text-gray-500 pointer-events-none">
        {Math.round(scale * 100)}%
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

function computeTreeLayout(
  root: TreeNodeType,
  expandedNodeIds: Set<string>,
  getExpandedText: (node: TreeNodeType) => string
): {
  nodes: PositionedNode[];
  edges: Array<{ from: string; to: string }>;
  width: number;
  height: number;
} {
  const nodes: PositionedNode[] = [];
  const edges: Array<{ from: string; to: string }> = [];
  let maxDepth = 0;

  const measureSubtreeHeight = (node: TreeNodeType): number => {
    const nodeHeight = getNodeDimensions(
      expandedNodeIds.has(node.nodeId),
      getExpandedText(node)
    ).height;
    if (!node.children || node.children.length === 0) {
      return nodeHeight;
    }

    const childrenHeight =
      node.children.reduce((sum, child) => sum + measureSubtreeHeight(child), 0) +
      Math.max(0, node.children.length - 1) * V_GAP;

    return Math.max(nodeHeight, childrenHeight);
  };

  const place = (node: TreeNodeType, depth: number, top: number): { centerY: number; usedHeight: number } => {
    maxDepth = Math.max(maxDepth, depth);
    const dimensions = getNodeDimensions(
      expandedNodeIds.has(node.nodeId),
      getExpandedText(node)
    );

    if (!node.children || node.children.length === 0) {
      const y = top + dimensions.height / 2;
      const x = PADDING + depth * (COLUMN_WIDTH + H_GAP) + COLUMN_WIDTH / 2;
      nodes.push({ node, depth, x, y, width: dimensions.width, height: dimensions.height });
      return { centerY: y, usedHeight: dimensions.height };
    }

    const childrenTotalHeight =
      node.children.reduce((sum, child) => sum + measureSubtreeHeight(child), 0) +
      Math.max(0, node.children.length - 1) * V_GAP;

    const usedHeight = Math.max(dimensions.height, childrenTotalHeight);
    let childTop = top + (usedHeight - childrenTotalHeight) / 2;

    for (const child of node.children) {
      edges.push({ from: node.nodeId, to: child.nodeId });
      const placed = place(child, depth + 1, childTop);
      childTop += placed.usedHeight + V_GAP;
    }

    const y = top + usedHeight / 2;
    const x = PADDING + depth * (COLUMN_WIDTH + H_GAP) + COLUMN_WIDTH / 2;
    nodes.push({ node, depth, x, y, width: dimensions.width, height: dimensions.height });
    return { centerY: y, usedHeight };
  };

  const rootPlacement = place(root, 0, PADDING);

  const width = PADDING * 2 + (maxDepth + 1) * COLUMN_WIDTH + maxDepth * H_GAP;
  const height = PADDING + rootPlacement.usedHeight + PADDING;

  return { nodes, edges, width, height };
}

function getNodeDimensions(
  isExpanded: boolean,
  expandedText: string
): { width: number; height: number } {
  if (!isExpanded) {
    return { width: COLLAPSED_NODE_WIDTH, height: COLLAPSED_NODE_HEIGHT };
  }

  // Estimate wrapped lines close to actual rendering width (text-xs + leading-5 in a 320px card).
  const contentWidthPx = EXPANDED_NODE_WIDTH - 16; // card horizontal padding
  const avgCharWidthPx = 6.6;
  const lineCapacity = Math.max(12, Math.floor(contentWidthPx / avgCharWidthPx));
  const lineCount = expandedText
    .split('\n')
    .reduce((sum, part) => sum + Math.max(1, Math.ceil(part.length / lineCapacity)), 0);

  const textHeight = lineCount * 20; // matches leading-5
  const controlsHeight = 22;
  const verticalPadding = 10;

  return {
    width: EXPANDED_NODE_WIDTH,
    height: Math.max(68, textHeight + controlsHeight + verticalPadding),
  };
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

function updateNodeInTree(
  tree: TreeNodeType,
  nodeId: string,
  updater: (node: TreeNodeType) => TreeNodeType
): TreeNodeType {
  if (tree.nodeId === nodeId) return updater(tree);
  return {
    ...tree,
    children: tree.children.map((child) => updateNodeInTree(child, nodeId, updater)),
  };
}

function collectNodeIds(node: TreeNodeType): string[] {
  return [node.nodeId, ...node.children.flatMap(collectNodeIds)];
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
