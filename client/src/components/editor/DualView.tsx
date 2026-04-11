import React, { useState, useCallback, useRef } from 'react';

interface DualViewProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  defaultLeftWidth?: number; // percentage, 0-100
  minLeftWidth?: number;     // percentage
  maxLeftWidth?: number;     // percentage
}

export const DualView: React.FC<DualViewProps> = ({
  leftPanel,
  rightPanel,
  defaultLeftWidth = 35,
  minLeftWidth = 20,
  maxLeftWidth = 60,
}) => {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      setLeftWidth(Math.min(maxLeftWidth, Math.max(minLeftWidth, newWidth)));
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [minLeftWidth, maxLeftWidth]);

  return (
    <div ref={containerRef} className="flex h-full w-full">
      {/* Left panel (tree view) */}
      <div
        className="h-full overflow-auto"
        style={{ width: `${leftWidth}%` }}
      >
        {leftPanel}
      </div>

      {/* Divider */}
      <div
        className="w-1 h-full bg-gray-200 hover:bg-blue-400 cursor-col-resize flex-shrink-0 transition-colors"
        onMouseDown={handleMouseDown}
      />

      {/* Right panel (canvas) */}
      <div
        className="h-full overflow-hidden"
        style={{ width: `${100 - leftWidth}%` }}
      >
        {rightPanel}
      </div>
    </div>
  );
};
