/**
 * Count words/characters for content sizing.
 * For CJK text, counts characters. For Latin text, counts words.
 * Returns a unified "word count" suitable for page estimation.
 */
// Count words in mixed CJK/Latin text, treating each CJK character as one word
export function countWords(text: string): number {
  if (!text || !text.trim()) return 0;

  // Count CJK characters
  const cjkMatch = text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g);
  const cjkCount = cjkMatch ? cjkMatch.length : 0;

  // Remove CJK characters and count remaining Latin words
  const nonCjk = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g, ' ');
  const words = nonCjk
    .split(/\s+/)
    .filter((w) => w.length > 0);
  const latinCount = words.length;

  return cjkCount + latinCount;
}

/**
 * Estimate how many pages the content will occupy.
 * charsPerPage depends on page format (A4=6600, 16:9=4200).
 */
// Estimate how many pages are needed given a word count and characters per page
export function estimatePages(wordCount: number, charsPerPage: number): number {
  if (charsPerPage <= 0) return 0;
  return Math.ceil(wordCount / charsPerPage);
}
