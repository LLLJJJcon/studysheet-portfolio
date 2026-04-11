/**
 * Calculate font size based on word count to word limit ratio.
 * 
 * Logic: If content fits comfortably, use larger font.
 * If content is close to limit, reduce font. 
 * Range: 6pt (minimum readable) to 10pt (comfortable).
 */

const MIN_FONT_SIZE = 6;
const MAX_FONT_SIZE = 10;
const DEFAULT_FONT_SIZE = 7;

/**
 * Calculate font size based on how much content vs available space.
 * ratio = totalWords / wordLimit
 * ratio < 0.7 → 10pt (lots of room)
 * ratio 0.7-1.0 → linear interpolation 10pt → 7pt
 * ratio 1.0-1.3 → linear interpolation 7pt → 6pt
 * ratio > 1.3 → 6pt (minimum)
 */
export function calculateFontSize(totalWords: number, wordLimit: number): number {
  if (wordLimit <= 0) return DEFAULT_FONT_SIZE;

  const ratio = totalWords / wordLimit;

  if (ratio <= 0.7) {
    return MAX_FONT_SIZE;
  } else if (ratio <= 1.0) {
    // Linear interpolation from 10pt to 7pt
    const t = (ratio - 0.7) / 0.3;
    return Math.round((MAX_FONT_SIZE - (MAX_FONT_SIZE - DEFAULT_FONT_SIZE) * t) * 10) / 10;
  } else if (ratio <= 1.3) {
    // Linear interpolation from 7pt to 6pt
    const t = (ratio - 1.0) / 0.3;
    return Math.round((DEFAULT_FONT_SIZE - (DEFAULT_FONT_SIZE - MIN_FONT_SIZE) * t) * 10) / 10;
  } else {
    return MIN_FONT_SIZE;
  }
}

/**
 * Get line height multiplier for a given font size.
 * Smaller fonts need slightly more line height for readability.
 */
export function getLineHeight(fontSize: number): number {
  if (fontSize <= 6) return 1.4;
  if (fontSize <= 7) return 1.35;
  if (fontSize <= 8) return 1.3;
  return 1.25;
}

/**
 * Re-evaluate font size based on current total word count.
 * Returns new fontSize and lineHeight if they differ from current values.
 * Used before L6 optimization to ensure layout uses the right font size.
 */
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
