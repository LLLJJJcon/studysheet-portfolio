import React, { useRef, useState, useCallback } from 'react';
import { PageBoundary } from './PageBoundary';
import { MM_TO_PX } from '../../utils/constants';

interface LayoutCanvasProps {
  pageWidth: number;    // mm
  pageHeight: number;   // mm
  pages: number;
  children?: React.ReactNode;
}

const PAGE_GAP = 20; // px gap between pages

export const LayoutCanvas: React.FC<LayoutCanvasProps> = ({
  pageWidth,
  pageHeight,
  pages,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const canvasWidthPx = Math.round(pageWidth * MM_TO_PX);
  const pageWidthPx = canvasWidthPx;
  const pageHeightPx = Math.round(pageHeight * MM_TO_PX);
  const totalWidthPx = pageWidthPx;
  const totalHeightPx =
    pages * pageHeightPx + (pages - 1) * PAGE_GAP;

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setScale((s) => Math.min(3, Math.max(0.1, s * delta)));
      }
    },
    []
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        e.preventDefault();
        setIsPanning(true);
        setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      }
    },
    [offset]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setOffset({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
      }
    },
    [isPanning, panStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-gray-100"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        className="absolute origin-top-left"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          width: totalWidthPx,
          height: totalHeightPx,
        }}
      >
        {Array.from({ length: pages }, (_, i) => (
          <PageBoundary
            key={i}
            pageIndex={i}
            widthPx={pageWidthPx}
            heightPx={pageHeightPx}
            pageGapPx={PAGE_GAP}
          />
        ))}
        {children}
      </div>

      {/* Zoom indicator */}
      <div className="absolute bottom-3 right-3 bg-white/80 px-2 py-1 rounded text-xs text-gray-500">
        {Math.round(scale * 100)}%
      </div>
    </div>
  );
};
