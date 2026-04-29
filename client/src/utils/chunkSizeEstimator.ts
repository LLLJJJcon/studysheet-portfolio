/**
 * Client-side chunk size estimator.
 * Mirrors server logic but works in px for canvas rendering.
 */

const CHAR_WIDTH_PER_PT = 0.35;
const LINE_HEIGHT_FACTOR = 1.35;
const MM_TO_PX = 96 / 25.4;

interface ChunkSize {
  width: number;   // px
  height: number;  // px
  lines: number;
}

// Estimate chunk dimensions in pixels based on content length, font size, and available width
export function estimateChunkSizePx(
  content: string,
  fontSize: number,
  availableWidthPx: number,
  lineHeight?: number
): ChunkSize {
  if (!content || !content.trim()) {
    return { width: 0, height: 0, lines: 0 };
  }

  const lh = lineHeight || fontSize * LINE_HEIGHT_FACTOR;
  const charWidthPx = CHAR_WIDTH_PER_PT * fontSize * MM_TO_PX;

  const charsPerLine = Math.floor(availableWidthPx / charWidthPx);
  if (charsPerLine <= 0) {
    return { width: availableWidthPx, height: lh * MM_TO_PX, lines: 1 };
  }

  const paragraphs = content.split('\n');
  let totalLines = 0;

  for (const para of paragraphs) {
    if (para.trim() === '') {
      totalLines += 0.5;
      continue;
    }
    totalLines += Math.ceil(para.length / charsPerLine);
  }

  totalLines = Math.max(1, Math.ceil(totalLines));

  // pt to px: 1pt = 96/72 px = 1.333px
  const lineHeightPx = lh * (96 / 72);
  const height = totalLines * lineHeightPx;

  return {
    width: availableWidthPx,
    height: Math.ceil(height),
    lines: totalLines,
  };
}
