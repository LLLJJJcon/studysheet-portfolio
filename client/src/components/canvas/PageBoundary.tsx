import React from 'react';

interface PageBoundaryProps {
  pageIndex: number;
  widthPx: number;
  heightPx: number;
  pageGapPx: number;
  targetPages?: number;
  totalPages: number;
}

export const PageBoundary: React.FC<PageBoundaryProps> = ({
  pageIndex,
  widthPx,
  heightPx,
  pageGapPx,
  targetPages,
  totalPages,
}) => {
  const yOffset = pageIndex * (heightPx + pageGapPx);
  const currentPage = pageIndex + 1;
  const exceeds = targetPages !== undefined && totalPages > targetPages;

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
      <div className="absolute -top-5 left-0 text-xs text-gray-400 flex items-center gap-1">
        <span>Page {currentPage} / {totalPages}</span>
        {exceeds && currentPage > targetPages! && (
          <span className="text-red-500 font-medium">(Exceeds target pages)</span>
        )}
      </div>

      <div
        className="absolute border border-dashed border-gray-200 pointer-events-none"
        style={{ left: 19, top: 19, right: 19, bottom: 19 }}
      />
    </div>
  );
};
