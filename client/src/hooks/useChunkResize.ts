import { useState, useCallback, useRef } from 'react';
import { MM_TO_PX } from '../utils/constants';

interface ResizeState {
  nodeId: string;
  startWidth: number;   // mm
  startHeight: number;  // mm
  currentWidth: number; // mm
  currentHeight: number;// mm
  handle: ResizeHandle;
}

type ResizeHandle = 'e' | 'w' | 's' | 'n' | 'se' | 'sw' | 'ne' | 'nw';

interface UseChunkResizeOptions {
  onResizeEnd: (nodeId: string, width: number, height: number, dx: number, dy: number) => void;
  scale: number;
  minWidth?: number;  // mm
  minHeight?: number; // mm
}

export function useChunkResize({
  onResizeEnd,
  scale,
  minWidth = 10,
  minHeight = 5,
}: UseChunkResizeOptions) {
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const startPosRef = useRef({ x: 0, y: 0 });

  const startResize = useCallback(
    (
      nodeId: string,
      handle: ResizeHandle,
      e: React.MouseEvent,
      currentWidth: number,
      currentHeight: number
    ) => {
      e.preventDefault();
      e.stopPropagation();

      startPosRef.current = { x: e.clientX, y: e.clientY };

      const state: ResizeState = {
        nodeId,
        startWidth: currentWidth,
        startHeight: currentHeight,
        currentWidth,
        currentHeight,
        handle,
      };

      resizeRef.current = state;
      setResizeState(state);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!resizeRef.current) return;

        const dxPx = moveEvent.clientX - startPosRef.current.x;
        const dyPx = moveEvent.clientY - startPosRef.current.y;
        const dxMm = dxPx / (MM_TO_PX * scale);
        const dyMm = dyPx / (MM_TO_PX * scale);

        let newWidth = resizeRef.current.startWidth;
        let newHeight = resizeRef.current.startHeight;

        const h = resizeRef.current.handle;
        if (h.includes('e')) newWidth += dxMm;
        if (h.includes('w')) newWidth -= dxMm;
        if (h.includes('s')) newHeight += dyMm;
        if (h.includes('n')) newHeight -= dyMm;

        newWidth = Math.max(minWidth, newWidth);
        newHeight = Math.max(minHeight, newHeight);

        const updated = {
          ...resizeRef.current,
          currentWidth: newWidth,
          currentHeight: newHeight,
        };
        resizeRef.current = updated;
        setResizeState(updated);
      };

      const handleMouseUp = () => {
        if (resizeRef.current) {
          const r = resizeRef.current;
          const dw = r.currentWidth - r.startWidth;
          const dh = r.currentHeight - r.startHeight;
          let dx = 0;
          let dy = 0;

          if (r.handle.includes('w')) dx = -dw;
          if (r.handle.includes('n')) dy = -dh;

          onResizeEnd(r.nodeId, r.currentWidth, r.currentHeight, dx, dy);
        }
        resizeRef.current = null;
        setResizeState(null);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [onResizeEnd, scale, minWidth, minHeight]
  );

  return {
    isResizing: !!resizeState,
    resizingNodeId: resizeState?.nodeId || null,
    resizeState,
    startResize,
  };
}
