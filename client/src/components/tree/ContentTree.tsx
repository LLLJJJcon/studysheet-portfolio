import { useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { TreeNode as TreeNodeType } from '../../types/tree';
import { useTreeStore } from '../../stores/treeStore';
import { useCanvasStore } from '../../stores/canvasStore';
import { TreeNodeActions } from './TreeNodeActions';
import { generationApi, CmdKChange } from '../../services/generationApi';

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
  const [aiBusyNodeId, setAiBusyNodeId] = useState<string | null>(null);
  const [aiEditorNode, setAiEditorNode] = useState<TreeNodeType | null>(null);
  const [aiInstruction, setAiInstruction] = useState('');
  const [aiNotice, setAiNotice] = useState<{ type: 'error' | 'info'; message: string } | null>(null);

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

  const applyCmdKChanges = useCallback((changes: CmdKChange[]) => {
    if (!changes.length) return false;

    let workingTree = useTreeStore.getState().tree;
    if (!workingTree) return false;

    const canvasApi = useCanvasStore.getState();

    for (const change of changes) {
      if (change.type === 'update_content' && typeof change.newContent === 'string') {
        canvasApi.updateChunkContent(change.nodeId, change.newContent);
        continue;
      }

      if (change.type === 'update_importance' && change.newImportance) {
        const newImportance = change.newImportance as TreeNodeType['importance'];
        workingTree = updateNodeInTree(workingTree, change.nodeId, (node) => ({
          ...node,
          importance: newImportance,
        }));

        useCanvasStore.setState((state) => ({
          containers: state.containers.map((container) => ({
            ...container,
            chunks: container.chunks.map((chunk) =>
              chunk.nodeId === change.nodeId
                ? { ...chunk, importance: change.newImportance }
                : chunk
            ),
          })),
        }));
        continue;
      }

      if (change.type === 'delete_node') {
        const targetNode = findNode(workingTree, change.nodeId);
        if (!targetNode) continue;
        const idsToDelete = collectNodeIds(targetNode);
        for (const id of idsToDelete) {
          canvasApi.deleteChunk(id);
        }
        const updated = removeNode(workingTree, change.nodeId);
        if (updated) workingTree = updated;
        continue;
      }

      if (change.type === 'add_node' && change.parentNodeId) {
        const newNodeId = change.nodeId || crypto.randomUUID();
        const newImportance = (change.importance || 'Important') as TreeNodeType['importance'];
        const newNode: TreeNodeType = {
          nodeId: newNodeId,
          name: change.name || 'New node',
          importance: newImportance,
          children: [],
        };

        workingTree = insertChild(workingTree, change.parentNodeId, newNode);
        canvasApi.addChunk(
          newNodeId,
          change.newContent || '(Blank)',
          newImportance || 'Important',
          change.parentNodeId
        );
      }
    }

    setTree(workingTree);
    return true;
  }, [setTree]);

  const openAiEditor = useCallback((node: TreeNodeType) => {
    const existingText = (chunkTextByNodeId.get(node.nodeId) || '').trim();
    const defaultInstruction = existingText
      ? 'Improve and refine this block while keeping it concise and exam-focused.'
      : `Generate concise content for this node: ${node.name}`;

    setAiNotice(null);
    setAiEditorNode(node);
    setAiInstruction(defaultInstruction);
  }, [chunkTextByNodeId]);

  const closeAiEditor = useCallback(() => {
    if (aiBusyNodeId) return;
    setAiEditorNode(null);
    setAiInstruction('');
  }, [aiBusyNodeId]);

  const handleAiAssistNode = useCallback(async () => {
    if (!courseId || aiBusyNodeId || !aiEditorNode) return;

    const token = localStorage.getItem('token');
    if (!token) {
      setAiNotice({ type: 'error', message: 'Please log in again to use AI editing.' });
      return;
    }

    const trimmedInstruction = aiInstruction.trim();
    if (!trimmedInstruction) {
      setAiNotice({ type: 'error', message: 'Please enter an instruction.' });
      return;
    }

    const existingText = (chunkTextByNodeId.get(aiEditorNode.nodeId) || '').trim();

    const scopedInstruction = [
      `Focus only on nodeId "${aiEditorNode.nodeId}" (node name: "${aiEditorNode.name}").`,
      existingText
        ? 'Edit and improve the content of this block based on the instruction below.'
        : 'Generate content for this block based on the instruction below.',
      `Instruction: ${trimmedInstruction}`,
    ].join('\n');

    setAiNotice(null);
    setAiBusyNodeId(aiEditorNode.nodeId);
    try {
      let cmdkError = '';
      let proposedChanges: CmdKChange[] = [];
      await generationApi.sendCmdK(courseId, scopedInstruction, token, {
        onChanges: (changes) => {
          proposedChanges = changes;
        },
        onError: (message) => {
          cmdkError = message || 'AI update failed';
        },
      });

      if (cmdkError) {
        throw new Error(cmdkError);
      }

      const applied = applyCmdKChanges(proposedChanges);
      if (applied) {
        setAiNotice({ type: 'info', message: 'AI changes applied to this node.' });
        setAiEditorNode(null);
        setAiInstruction('');
        return;
      }

      const [updatedTree, updatedLayout] = await Promise.all([
        generationApi.fetchContentTree(courseId),
        generationApi.fetchLayout(courseId),
      ]);

      if (updatedTree) {
        setTree(updatedTree as TreeNodeType);
      }
      if (updatedLayout) {
        useCanvasStore.getState().setLayout(
          updatedLayout.containers as any[],
          updatedLayout.fontSize,
          updatedLayout.lineHeight
        );
      }

      if (!updatedTree && !updatedLayout) {
        setAiNotice({ type: 'info', message: 'AI finished but returned no applicable changes for this node.' });
      } else {
        setAiNotice({ type: 'info', message: 'AI update completed.' });
      }

      setAiEditorNode(null);
      setAiInstruction('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI update failed';
      setAiNotice({ type: 'error', message });
    } finally {
      setAiBusyNodeId(null);
    }
  }, [aiBusyNodeId, aiEditorNode, aiInstruction, applyCmdKChanges, chunkTextByNodeId, courseId, setTree]);

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

  const layout = tree ? computeTreeLayout(tree, expandedNodeIds, getExpandedText) : null;
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
    <div className="py-2 relative">
      {aiNotice && (
        <div
          className={`mb-2 rounded border px-2 py-1 text-xs ${
            aiNotice.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-blue-200 bg-blue-50 text-blue-700'
          }`}
        >
          {aiNotice.message}
        </div>
      )}

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
        )}

        {layout?.nodes.map(({ node, depth, x, y, width, height }) => {
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
                  <button
                    type="button"
                    className="text-[10px] px-1 py-0.5 rounded border border-teal-200 text-teal-700 hover:bg-teal-50 disabled:opacity-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      openAiEditor(node);
                    }}
                    disabled={aiBusyNodeId !== null}
                    title="AI generate/edit this node"
                  >
                    {aiBusyNodeId === node.nodeId ? 'AI...' : 'AI'}
                  </button>
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

      {aiEditorNode && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/25"
            onClick={closeAiEditor}
          />

          <div className="relative z-50 w-full max-w-xl mx-4 rounded-xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div>
                <p className="text-sm font-semibold text-gray-800">AI edit this node</p>
                <p className="text-xs text-gray-500 truncate" title={aiEditorNode.name}>{aiEditorNode.name}</p>
              </div>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600"
                onClick={closeAiEditor}
                disabled={aiBusyNodeId !== null}
                title="Close"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-4 py-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Instruction
              </label>
              <textarea
                value={aiInstruction}
                onChange={(e) => setAiInstruction(e.target.value)}
                className="w-full min-h-28 resize-y rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                placeholder="Describe what to generate or edit for this node"
                disabled={aiBusyNodeId !== null}
              />
            </div>

            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50 rounded-b-xl">
              <button
                type="button"
                onClick={closeAiEditor}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-50"
                disabled={aiBusyNodeId !== null}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAiAssistNode}
                className="px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded hover:bg-teal-700 disabled:opacity-50"
                disabled={aiBusyNodeId !== null}
              >
                {aiBusyNodeId === aiEditorNode.nodeId ? 'Applying AI...' : 'Apply AI'}
              </button>
            </div>
          </div>
        </div>
      )}
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
