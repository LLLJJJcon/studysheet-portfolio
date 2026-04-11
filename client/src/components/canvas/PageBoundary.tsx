import React from 'react';

interface PageBoundaryProps {
  pageIndex: number;
  widthPx: number;
  heightPx: number;
  pageGapPx: number;
}

export const PageBoundary: React.FC<PageBoundaryProps> = ({
  pageIndex,
  widthPx,
  heightPx,
  pageGapPx,
}) => {
  const yOffset = pageIndex * (heightPx + pageGapPx);

  return (
    <div
      className="absolute bg-white shadow-md border border-gray-300"
      style={{
        left: 0,
        top: yOffset,
        width: widthPx,
        height: heightPx,
      }}
    >
      {/* Page number label */}
      <div className="absolute -top-5 left-0 text-xs text-gray-400">
        Page {pageIndex + 1}
      </div>

      {/* Margin guides (subtle dashed lines) */}
      <div
        className="absolute border border-dashed border-gray-200 pointer-events-none"
        style={{
          left: 19,   // ~5mm margin at 96dpi
          top: 19,
          right: 19,
          bottom: 19,
        }}
      />
    </div>
  );
};
