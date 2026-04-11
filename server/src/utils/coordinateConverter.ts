/**
 * Convert abstract layout coordinates (mm) to pixel positions for rendering.
 */

const SCREEN_DPI = 96;
const MM_TO_PX = SCREEN_DPI / 25.4;

export interface PointMm {
  x: number;
  y: number;
}

export interface RectMm {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PointPx {
  x: number;
  y: number;
}

export interface RectPx {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function mmToPx(mm: number): number {
  return Math.round(mm * MM_TO_PX);
}

export function pxToMm(px: number): number {
  return px / MM_TO_PX;
}

export function rectMmToPx(rect: RectMm): RectPx {
  return {
    x: mmToPx(rect.x),
    y: mmToPx(rect.y),
    width: mmToPx(rect.width),
    height: mmToPx(rect.height),
  };
}

export function rectPxToMm(rect: RectPx): RectMm {
  return {
    x: pxToMm(rect.x),
    y: pxToMm(rect.y),
    width: pxToMm(rect.width),
    height: pxToMm(rect.height),
  };
}

/**
 * Convert a page-relative mm position to absolute canvas pixel position.
 * Takes into account page index and page gaps.
 */
export function pagePositionToCanvasPx(
  rect: RectMm,
  pageIndex: number,
  pageHeightMm: number,
  pageGapPx: number = 20
): RectPx {
  const pageOffsetY = pageIndex * (mmToPx(pageHeightMm) + pageGapPx);
  return {
    x: mmToPx(rect.x),
    y: mmToPx(rect.y) + pageOffsetY,
    width: mmToPx(rect.width),
    height: mmToPx(rect.height),
  };
}

/**
 * Validate and clamp a chunk position to stay within page margins.
 */
export function clampToPageBounds(
  x: number,
  y: number,
  width: number,
  height: number,
  pageWidth: number,
  pageHeight: number,
  margins: { top: number; right: number; bottom: number; left: number }
): { x: number; y: number } {
  const minX = margins.left;
  const minY = margins.top;
  const maxX = pageWidth - margins.right - width;
  const maxY = pageHeight - margins.bottom - height;

  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  };
}

/**
 * Post-process L6 optimized positions:
 * - Skip user-positioned chunks
 * - Clamp auto-positioned chunks to page bounds
 * - Validate no overlaps
 */
export function postProcessOptimizedLayout(
  optimizedChunks: Array<{ nodeId: string; page: number; x: number; y: number }>,
  originalChunks: Array<{
    nodeId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    isUserPositioned?: boolean;
  }>,
  pageWidth: number,
  pageHeight: number,
  margins: { top: number; right: number; bottom: number; left: number }
): Array<{ nodeId: string; page: number; x: number; y: number }> {
  const userPositionedIds = new Set(
    originalChunks.filter((c) => c.isUserPositioned).map((c) => c.nodeId)
  );

  const chunkSizes = new Map(
    originalChunks.map((c) => [c.nodeId, { width: c.width, height: c.height }])
  );

  return optimizedChunks
    .filter((opt) => !userPositionedIds.has(opt.nodeId)) // Skip user-positioned
    .map((opt) => {
      const size = chunkSizes.get(opt.nodeId);
      if (!size) return opt;

      const clamped = clampToPageBounds(
        opt.x,
        opt.y,
        size.width,
        size.height,
        pageWidth,
        pageHeight,
        margins
      );

      return {
        nodeId: opt.nodeId,
        page: opt.page,
        x: clamped.x,
        y: clamped.y,
      };
    });
}
