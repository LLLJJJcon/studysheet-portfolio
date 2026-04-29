/**
 * Calculate font size based on word count to word limit ratio.
 * Mirrors server-side logic exactly.
 */

const MIN_FONT_SIZE = 6;
const MAX_FONT_SIZE = 10;
const DEFAULT_FONT_SIZE = 7;

// Calculate font size (6-10pt) based on the word count to word limit ratio
export function calculateFontSize(totalWords: number, wordLimit: number): number {
  if (wordLimit <= 0) return DEFAULT_FONT_SIZE;

  const ratio = totalWords / wordLimit;

  if (ratio <= 0.7) {
    return MAX_FONT_SIZE;
  } else if (ratio <= 1.0) {
    const t = (ratio - 0.7) / 0.3;
    return Math.round((MAX_FONT_SIZE - (MAX_FONT_SIZE - DEFAULT_FONT_SIZE) * t) * 10) / 10;
  } else if (ratio <= 1.3) {
    const t = (ratio - 1.0) / 0.3;
    return Math.round((DEFAULT_FONT_SIZE - (DEFAULT_FONT_SIZE - MIN_FONT_SIZE) * t) * 10) / 10;
  } else {
    return MIN_FONT_SIZE;
  }
}

// Return the appropriate line height multiplier for a given font size
export function getLineHeight(fontSize: number): number {
  if (fontSize <= 6) return 1.4;
  if (fontSize <= 7) return 1.35;
  if (fontSize <= 8) return 1.3;
  return 1.25;
}

// Re-evaluate font size and line height, returning whether they changed from current values
export function reevaluateFontSize(
  currentFontSize: number,
  totalWords: number,
  wordLimit: number
): { fontSize: number; lineHeight: number; changed: boolean } {
  const newFontSize = calculateFontSize(totalWords, wordLimit);
  const newLineHeight = getLineHeight(newFontSize);
  const changed = Math.abs(newFontSize - currentFontSize) >= 0.1;

  return { fontSize: newFontSize, lineHeight: newLineHeight, changed };
}
