import React, { useCallback, useMemo, useState, useRef, useLayoutEffect } from 'react';
import { useCanvasStore, ChunkPosition } from '../../stores/canvasStore';
import { useTreeStore, findNodeInTree, findParentInTree } from '../../stores/treeStore';
import { TreeNode } from '../../types/tree';
import { ChunkComponent } from './Chunk';
import { MM_TO_PX } from '../../utils/constants';

const PAGE_GAP = 20; // must match LayoutCanvas

interface CanvasRendererProps {
  pageWidthPx: number;
  pageHeightPx: number;
  columns: number;
  courseId?: string;
  onShowSource?: (nodeId: string) => void;
  onPagesDetected?: (pages: number) => void;
}

type OrderedItem = {
  type: 'title' | 'chunk';
  id: string;
  sectionId: string;
  title?: string;
  chunk?: ChunkPosition;
};

function collectSubtreeNodeIds(node: TreeNode): string[] {
  return [node.nodeId, ...node.children.flatMap(collectSubtreeNodeIds)];
}

export const CanvasRenderer: React.FC<CanvasRendererProps> = ({
  pageWidthPx,
  pageHeightPx,
  columns,
  courseId,
  onShowSource,
  onPagesDetected,
}) => {
  const containers = useCanvasStore((s) => s.containers);
  const fontSize = useCanvasStore((s) => s.fontSize);
  const selectedChunkId = useCanvasStore((s) => s.selectedChunkId);
  const selectedContainerId = useCanvasStore((s) => s.selectedContainerId);
  const highlightedChunkId = useCanvasStore((s) => s.highlightedChunkId);
  const setSelectedChunkId = useCanvasStore((s) => s.setSelectedChunkId);
  const setSelectedContainerId = useCanvasStore((s) => s.setSelectedContainerId);
  const deleteChunk = useCanvasStore((s) => s.deleteChunk);
  const moveChunkSubtree = useCanvasStore((s) => s.moveChunkSubtree);
  const addChunk = useCanvasStore((s) => s.addChunk);
  const tree = useTreeStore((s) => s.tree);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<'before' | 'after' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const insertAfterRef = useRef<string | null>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  // Pagination state
  const [pageMap, setPageMap] = useState<Map<string, { page: number; col: number }> | null>(null);
  const [measuredKey, setMeasuredKey] = useState('');

  const effectiveColumns = columns || 3;
  const marginPx = 5 * MM_TO_PX;
  const colGapPx = 2 * MM_TO_PX;
  const pageContentHeight = pageHeightPx - 2 * marginPx;
  const contentAreaWidth = pageWidthPx - 2 * marginPx;
  const colWidth = (contentAreaWidth - (effectiveColumns - 1) * colGapPx) / effectiveColumns;

  /* --- Ordered items (flatten containers) --- */
  const orderedItems = useMemo<OrderedItem[]>(() => {
    const onPage = containers
      .filter((c) => c.page >= 0)
      .sort((a, b) => {
        if (a.page !== b.page) return a.page - b.page;
        if (a.y !== b.y) return a.y - b.y;
        return a.x - b.x;
      });
    if (onPage.length === 0) return [];

    const seenSections = new Set<string>();
    const items: OrderedItem[] = [];
    for (const c of onPage) {
      if (!seenSections.has(c.parentNodeId)) {
        seenSections.add(c.parentNodeId);
        items.push({
          type: 'title',
          id: `title-${c.parentNodeId}`,
          sectionId: c.parentNodeId,
          title: c.title,
        });
      }
      for (const chunk of c.chunks) {
        items.push({ type: 'chunk', id: chunk.nodeId, sectionId: c.parentNodeId, chunk });
      }
    }
    return items;
  }, [containers]);

  // Layout key: invalidate measurement when inputs change
  const layoutKey = useMemo(
    () =>
      `${orderedItems
        .map((i) => i.id + (i.chunk?.content?.length || 0))
        .join(',')}|${fontSize}|${effectiveColumns}|${pageWidthPx}|${pageHeightPx}`,
    [orderedItems, fontSize, effectiveColumns, pageWidthPx, pageHeightPx],
  );
  const needsMeasure = layoutKey !== measuredKey;

  /* --- Measurement via CSS columns + useLayoutEffect --- */
  useLayoutEffect(() => {
    if (!needsMeasure || !measureRef.current || orderedItems.length === 0) return;

    const container = measureRef.current;
    const containerRect = container.getBoundingClientRect();
    const step = colWidth + colGapPx;

    const newMap = new Map<string, { page: number; col: number }>();
    container.querySelectorAll('[data-item-id]').forEach((el) => {
      const htmlEl = el as HTMLElement;
      const id = htmlEl.dataset.itemId;
      if (!id) return;
      const rect = htmlEl.getBoundingClientRect();
      const relLeft = rect.left - containerRect.left;
      const absCol = Math.max(0, Math.round(relLeft / step));
      const page = Math.floor(absCol / effectiveColumns);
      const col = absCol % effectiveColumns;
      newMap.set(id, { page, col });
    });

    setPageMap(newMap);
    setMeasuredKey(layoutKey);

    const maxPage =
      newMap.size > 0 ? Math.max(...Array.from(newMap.values()).map((v) => v.page)) : 0;
    onPagesDetected?.(maxPage + 1);
  });

  /* --- Item map for lookup --- */
  const itemMap = useMemo(() => {
    const m = new Map<string, OrderedItem>();
    orderedItems.forEach((item) => m.set(item.id, item));
    return m;
  }, [orderedItems]);

  /* --- Number of pages from measurement --- */
  const numPages = useMemo(() => {
    if (!pageMap || pageMap.size === 0) return 1;
    return Math.max(...Array.from(pageMap.values()).map((v) => v.page)) + 1;
  }, [pageMap]);

  /* --- Handlers --- */
  const handleInsertImage = useCallback((afterNodeId: string) => {
    insertAfterRef.current = afterNodeId;
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !courseId || !insertAfterRef.current) return;
      const afterNodeId = insertAfterRef.current;
      insertAfterRef.current = null;
      e.target.value = '';

      const { generationApi } = await import('../../services/generationApi');
      const result = await generationApi.uploadImage(courseId, file);
      if (!result) return;

      const newNodeId = crypto.randomUUID();
      addChunk(newNodeId, `![image](${result.url})`, 'Awareness', afterNodeId);

      const { tree, setTree } = useTreeStore.getState();
      if (tree) {
        const parent = findParentInTree(tree, afterNodeId);
        if (parent) {
          const newTreeNode: TreeNode = {
            nodeId: newNodeId,
            name: 'Image',
            children: [],
            importance: 'Awareness',
          };
          const newChildren: TreeNode[] = [];
          for (const child of parent.children) {
            newChildren.push(child);
            if (child.nodeId === afterNodeId) newChildren.push(newTreeNode);
          }
          const updatedParent = { ...parent, children: newChildren };
          const updateNode = (n: typeof tree): typeof tree => {
            if (n.nodeId === parent.nodeId) return updatedParent;
            return { ...n, children: n.children.map(updateNode) };
          };
          setTree(updateNode(tree));
        }
      }
    },
    [courseId, addChunk],
  );

  const handleSelectChunk = useCallback(
    (nodeId: string) => {
      setSelectedChunkId(nodeId);
      setSelectedContainerId(null);
      useTreeStore.getState().setSelectedNodeId(nodeId);
    },
    [setSelectedChunkId, setSelectedContainerId],
  );

  const handleSelectSectionTitle = useCallback(
    (sectionId: string) => {
      setSelectedContainerId(sectionId);
      setSelectedChunkId(null);
      useTreeStore.getState().setSelectedNodeId(sectionId);
    },
    [setSelectedContainerId, setSelectedChunkId],
  );

  const handleDeleteChunk = useCallback(
    (nodeId: string) => {
      deleteChunk(nodeId);
      useTreeStore.getState().removeNode(nodeId);
      setSelectedChunkId(null);
    },
    [deleteChunk, setSelectedChunkId],
  );

  const handleDragOverChunk = useCallback((nodeId: string, pos: 'before' | 'after') => {
    setDragOverId(nodeId);
    setDragPosition(pos);
  }, []);

  const handleDragLeaveChunk = useCallback(() => {
    setDragOverId(null);
    setDragPosition(null);
  }, []);

  const handleDropChunk = useCallback(
    (draggedId: string, targetId: string, pos: 'before' | 'after') => {
      setDragOverId(null);
      setDragPosition(null);
      if (draggedId !== targetId) {
        const draggedNode = tree ? findNodeInTree(tree, draggedId) : null;
        const subtreeIds = draggedNode ? collectSubtreeNodeIds(draggedNode) : [draggedId];

        if (subtreeIds.includes(targetId)) return;

        moveChunkSubtree(draggedId, subtreeIds, targetId, pos);
        const state = useCanvasStore.getState();
        let targetParentNodeId: string | null = null;
        for (const c of state.containers) {
          if (c.chunks.some((ch) => ch.nodeId === targetId)) {
            targetParentNodeId = c.parentNodeId;
            break;
          }
        }
        if (targetParentNodeId) {
          useTreeStore.getState().moveNode(draggedId, targetParentNodeId, targetId, pos);
        }
      }
    },
    [moveChunkSubtree, tree],
  );

  /* --- Render a single chunk item with optional insert-gap --- */
  const renderChunkItem = (item: OrderedItem, isLastInCol: boolean) => {
    const chunk = item.chunk!;
    return (
      <React.Fragment key={chunk.nodeId}>
        <ChunkComponent
          nodeId={chunk.nodeId}
          content={chunk.content || ''}
          importance={chunk.importance || 'Important'}
          fontSize={fontSize}
          isSelected={selectedChunkId === chunk.nodeId}
          isHighlighted={highlightedChunkId === chunk.nodeId}
          onSelect={handleSelectChunk}
          onDelete={handleDeleteChunk}
          onShowSource={onShowSource}
          showInsertBefore={dragOverId === chunk.nodeId && dragPosition === 'before'}
          showInsertAfter={dragOverId === chunk.nodeId && dragPosition === 'after'}
          onDragOverPosition={handleDragOverChunk}
          onDragLeaveChunk={handleDragLeaveChunk}
          onDropInsert={handleDropChunk}
          heightMm={chunk.height}
          onInsertImage={handleInsertImage}
        />
        {!isLastInCol && (
          <div style={{ height: 6 }} />
        )}
      </React.Fragment>
    );
  };

  /* --- Empty state --- */
  if (orderedItems.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center text-gray-300">
          <svg
            className="w-16 h-16 mx-auto mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-sm">After uploading file and generating, content will be displayed here</p>
        </div>
      </div>
    );
  }

  /* --- Measurement & continuous layout dimensions --- */
  const maxMeasurePages = 10;
  const totalMeasureCols = effectiveColumns * maxMeasurePages;
  const measureWidth = totalMeasureCols * colWidth + (totalMeasureCols - 1) * colGapPx;
  const pageStep = effectiveColumns * (colWidth + colGapPx);
  const totalVisualCols = effectiveColumns * numPages;
  const totalVisualWidth = totalVisualCols * colWidth + (totalVisualCols - 1) * colGapPx;

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

      {/* Hidden measurement container */}
      {needsMeasure && (
        <div
          ref={measureRef}
          aria-hidden
          style={{
            position: 'absolute',
            left: -99999,
            top: -99999,
            width: measureWidth,
            height: pageContentHeight,
            columnCount: totalMeasureCols,
            columnGap: colGapPx,
            columnFill: 'auto' as const,
            fontSize: `${fontSize}pt`,
            lineHeight: 1.35,
            visibility: 'hidden',
            pointerEvents: 'none' as const,
          }}
        >
          {orderedItems.map((item, idx) => {
            if (item.type === 'title') {
              return (
                <div
                  key={item.id}
                  data-item-id={item.id}
                  style={{
                    fontSize: '9px',
                    lineHeight: '14px',
                    marginBottom: 2,
                    fontWeight: 600,
                    breakAfter: 'avoid' as const,
                  }}
                >
                  {item.title}
                </div>
              );
            }
            const chunk = item.chunk!;
            const content = chunk.content || '';
            const isImage = /^!\[.*?\]\(.*?\)$/.test(content);
            const nextIsChunk = orderedItems[idx + 1]?.type === 'chunk';
            return (
              <React.Fragment key={item.id}>
                <div
                  data-item-id={item.id}
                  className="border rounded"
                  style={{
                    padding: '1px 2px',
                    marginBottom: 2,
                    width: `${Math.min(colWidth, Math.max(80, (chunk.width || 20) * MM_TO_PX))}px`,
                    minHeight: `${Math.max(36, (chunk.height || 8) * MM_TO_PX)}px`,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {isImage ? <div style={{ width: '100%', height: 100 }} /> : content}
                </div>
                {nextIsChunk && <div style={{ height: 6 }} />}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Continuous CSS column layout — one viewport per page */}
      {Array.from({ length: numPages }, (_, pageIdx) => (
        <div
          key={pageIdx}
          style={{
            position: 'absolute',
            left: marginPx,
            top: pageIdx * (pageHeightPx + PAGE_GAP) + marginPx,
            width: contentAreaWidth,
            height: pageContentHeight,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              columnCount: totalVisualCols,
              columnGap: colGapPx,
              columnFill: 'auto' as const,
              height: pageContentHeight,
              width: totalVisualWidth,
              transform: `translateX(${-pageIdx * pageStep}px)`,
              fontSize: `${fontSize}pt`,
              lineHeight: 1.35,
            }}
          >
            {orderedItems.map((item, idx) => {
              if (item.type === 'title') {
                const isTitleSelected = selectedContainerId === item.sectionId;
                return (
                  <div
                    key={item.id}
                    className={`font-semibold truncate cursor-pointer rounded px-1 transition-colors ${
                      isTitleSelected
                        ? 'text-blue-700 bg-blue-50 ring-1 ring-blue-300'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                    style={{ fontSize: '9px', lineHeight: '14px', marginBottom: 2, breakAfter: 'avoid' as const }}
                    onClick={() => handleSelectSectionTitle(item.sectionId)}
                    title={item.title}
                  >
                    {item.title}
                  </div>
                );
              }
              const nextItem = orderedItems[idx + 1];
              const isLast = !nextItem || nextItem.type === 'title';
              return renderChunkItem(item, isLast);
            })}
          </div>
        </div>
      ))}
    </>
  );
};
