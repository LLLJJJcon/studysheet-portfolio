import React from 'react';
import { MM_TO_PX } from '../../utils/constants';

interface ContainerBoxProps {
  id: string;
  title: string;
  x: number;         // mm
  y: number;         // mm
  width: number;     // mm
  height: number;    // mm
  pageIndex: number;
  pageWidthPx: number;
  pageGapPx: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
  children?: React.ReactNode;
}

// Render a positioned container box with title bar and alignment guides on the canvas
export const ContainerBox: React.FC<ContainerBoxProps> = ({
  id,
  title,
  x,
  y,
  width,
  height,
  pageIndex,
  pageWidthPx,
  pageGapPx,
  isSelected,
  onSelect,
  children,
}) => {
  const pxX = Math.round(x * MM_TO_PX) + pageIndex * (pageWidthPx + pageGapPx);
  const pxY = Math.round(y * MM_TO_PX);
  const pxW = Math.round(width * MM_TO_PX);
  const pxH = Math.round(height * MM_TO_PX);

  return (
    <div
      className={`absolute border-2 rounded-lg transition-colors ${
        isSelected
          ? 'border-indigo-400 bg-indigo-50/30'
          : 'border-gray-200 bg-transparent hover:border-gray-300'
      }`}
      style={{
        left: pxX,
        top: pxY,
        width: pxW,
        height: pxH,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(id);
      }}
    >
      {/* Title bar */}
      <div
        className={`absolute -top-5 left-1 px-2 py-0.5 text-xs font-medium rounded-t ${
          isSelected
            ? 'bg-indigo-100 text-indigo-700'
            : 'bg-gray-100 text-gray-500'
        }`}
      >
        {title}
      </div>

      {/* Snap hint guidelines (shown when selected) */}
      {isSelected && (
        <>
          {/* Center vertical guide */}
          <div
            className="absolute top-0 bottom-0 border-l border-dashed border-indigo-300 pointer-events-none"
            style={{ left: '50%' }}
          />
          {/* Center horizontal guide */}
          <div
            className="absolute left-0 right-0 border-t border-dashed border-indigo-300 pointer-events-none"
            style={{ top: '50%' }}
          />
        </>
      )}

      {children}
    </div>
  );
};
