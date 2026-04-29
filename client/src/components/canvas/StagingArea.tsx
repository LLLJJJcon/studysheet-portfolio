import React from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import { ChunkComponent } from './Chunk';
import { MM_TO_PX } from '../../utils/constants';

interface StagingAreaProps {
  pageWidth: number;   // mm
  pageHeight: number;  // mm
  pages: number;
  fontSize: number;
  pageGapPx: number;
  onSelectChunk: (nodeId: string) => void;
  onDeleteChunk: (nodeId: string) => void;
  onDoubleClickChunk?: (nodeId: string) => void;
}

// Render the off-page staging area where chunks can be temporarily placed before being re-assigned
export const StagingArea: React.FC<StagingAreaProps> = ({
  pageWidth,
  pageHeight,
  pages,
  fontSize,
  pageGapPx,
  onSelectChunk,
  onDeleteChunk,
}) => {
  const containers = useCanvasStore((s) => s.containers);
  const selectedChunkId = useCanvasStore((s) => s.selectedChunkId);
  const highlightedChunkId = useCanvasStore((s) => s.highlightedChunkId);

  const pageHeightPx = Math.round(pageHeight * MM_TO_PX);
  const stageWidthPx = Math.round(pageWidth * MM_TO_PX);
  const topOffset = pages * (pageHeightPx + pageGapPx);

  // Collect chunks that are in the staging area (page === -1 or position beyond page bounds)
  const stagedChunks: Array<{
    nodeId: string;
    content: string;
    x: number;
    y: number;
    width: number;
    height: number;
    importance: string;
  }> = [];

  containers.forEach((container) => {
    container.chunks.forEach((chunk) => {
      // A chunk is "staged" if it's in a container on page -1
      // or if the container is flagged as staging
      if (container.page === -1) {
        stagedChunks.push({
          nodeId: chunk.nodeId,
          content: '', // Content will come from chunk data
          x: chunk.x,
          y: chunk.y,
          width: chunk.width,
          height: chunk.height,
          importance: 'Awareness',
        });
      }
    });
  });

  const STAGING_HEIGHT = 200; // px

  return (
    <div
      className="absolute border-2 border-dashed border-gray-300 rounded-lg bg-gray-50/50"
      style={{
        left: 0,
        top: topOffset,
        width: stageWidthPx,
        minHeight: STAGING_HEIGHT,
      }}
    >
      {/* Header label */}
      <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-2 bg-gray-100/90 border-b border-gray-200 rounded-t-lg">
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          Staging area (Staging Area)
        </span>
        {stagedChunks.length > 0 && (
          <span className="text-xs text-gray-400">
            — {stagedChunks.length} knowledge block(s)
          </span>
        )}
      </div>

      {/* Empty state */}
      {stagedChunks.length === 0 && (
        <div className="flex items-center justify-center h-32 text-sm text-gray-400">
          Drag knowledge blocks here to stage
        </div>
      )}

      {/* Staged chunks rendered in flow layout within the staging area */}
      <div className="flex flex-wrap gap-2 p-2">
        {stagedChunks.map((chunk) => (
          <div key={chunk.nodeId} style={{ width: 'calc(33.33% - 8px)', minWidth: 120 }}>
            <ChunkComponent
              nodeId={chunk.nodeId}
              content={chunk.content}
              importance={chunk.importance}
              fontSize={fontSize}
              isSelected={selectedChunkId === chunk.nodeId}
              isHighlighted={highlightedChunkId === chunk.nodeId}
              onSelect={onSelectChunk}
              onDelete={onDeleteChunk}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
