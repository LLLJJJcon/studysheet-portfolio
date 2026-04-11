import { useState, useCallback, useRef } from 'react';
import { MM_TO_PX } from '../utils/constants';

interface DragState {
  nodeId: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  offsetX: number;
  offsetY: number;
}

interface UseDragAndDropOptions {
  onDragEnd: (nodeId: string, newX: number, newY: number) => void;
  scale: number;
}

export function useDragAndDrop({ onDragEnd, scale }: UseDragAndDropOptions) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const startDrag = useCallback(
    (nodeId: string, e: React.MouseEvent, elementX: number, elementY: number) => {
      e.preventDefault();
      e.stopPropagation();

      const state: DragState = {
        nodeId,
        startX: elementX,
        startY: elementY,
        currentX: elementX,
        currentY: elementY,
        offsetX: e.clientX - elementX * MM_TO_PX * scale,
        offsetY: e.clientY - elementY * MM_TO_PX * scale,
      };

      dragRef.current = state;
      setDragState(state);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!dragRef.current) return;

        const newX = (moveEvent.clientX - dragRef.current.offsetX) / (MM_TO_PX * scale);
        const newY = (moveEvent.clientY - dragRef.current.offsetY) / (MM_TO_PX * scale);

        const updated = {
          ...dragRef.current,
          currentX: newX,
          currentY: newY,
        };
        dragRef.current = updated;
        setDragState(updated);
      };

      const handleMouseUp = () => {
        if (dragRef.current) {
          onDragEnd(
            dragRef.current.nodeId,
            dragRef.current.currentX,
            dragRef.current.currentY
          );
        }
        dragRef.current = null;
        setDragState(null);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [onDragEnd, scale]
  );

  const getDragOffset = useCallback(
    (nodeId: string) => {
      if (!dragState || dragState.nodeId !== nodeId) {
        return { x: 0, y: 0 };
      }
      return {
        x: (dragState.currentX - dragState.startX) * MM_TO_PX,
        y: (dragState.currentY - dragState.startY) * MM_TO_PX,
      };
    },
    [dragState]
  );

  return {
    isDragging: !!dragState,
    draggingNodeId: dragState?.nodeId || null,
    startDrag,
    getDragOffset,
  };
}
