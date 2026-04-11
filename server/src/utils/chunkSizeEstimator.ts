import { countWords } from './wordCount';

/**
 * Estimate the rendering dimensions of a chunk based on its content,
 * font size, and available width.
 *
 * Returns estimated width and height in mm.
 */

// Character width per pt: CJK ≈ 0.35, Latin ≈ 0.17
// Detect ratio and interpolate
function charWidthForContent(content: string): number {
  const cjk = content.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g);
  const ratio = cjk ? cjk.length / content.length : 0;
  return 0.17 + ratio * 0.18;
}
// Line height multiplier
const LINE_HEIGHT_FACTOR = 1.35;

interface ChunkSize {
  width: number;   // mm
  height: number;  // mm
  lines: number;
}

export function estimateChunkSize(
  content: string,
  fontSize: number,
  availableWidth: number,
  lineHeight?: number
): ChunkSize {
  if (!content || !content.trim()) {
    return { width: 0, height: 0, lines: 0 };
  }

  // lineHeight param is a multiplier (e.g. 1.25). Convert to pt.
  const lhPt = fontSize * (lineHeight || LINE_HEIGHT_FACTOR);
  const charWidthMm = charWidthForContent(content) * fontSize;

  // Characters that fit per line
  const charsPerLine = Math.floor(availableWidth / charWidthMm);
  if (charsPerLine <= 0) {
    return { width: availableWidth, height: lhPt * 0.3528, lines: 1 };
  }

  // Split content into paragraphs and estimate lines
  const paragraphs = content.split('\n');
  let totalLines = 0;

  for (const para of paragraphs) {
    if (para.trim() === '') {
      totalLines += 0.5; // Half line for empty paragraphs
      continue;
    }
    const paraChars = para.length;
    totalLines += Math.ceil(paraChars / charsPerLine);
  }

  totalLines = Math.max(1, Math.ceil(totalLines));

  // Convert pt to mm: 1pt = 0.3528mm
  const lineHeightMm = lhPt * 0.3528;
  const height = totalLines * lineHeightMm;

  return {
    width: availableWidth,
    height: Math.ceil(height * 10) / 10,
    lines: totalLines,
  };
}

/**
 * Estimate total area needed for all chunks on a page.
 */
export function estimateTotalArea(
  chunks: Array<{ content: string }>,
  fontSize: number,
  pageWidth: number,
  margins: { left: number; right: number }
): number {
  const availableWidth = pageWidth - margins.left - margins.right;
  let totalHeight = 0;

  for (const chunk of chunks) {
    const size = estimateChunkSize(chunk.content, fontSize, availableWidth);
    totalHeight += size.height;
  }

  return totalHeight * availableWidth;
}
