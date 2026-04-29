// Count words for Latin text and characters for CJK text, returning a unified word count
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

// Estimate the number of pages needed for a given word count and page capacity
export function estimatePages(wordCount: number, charsPerPage: number): number {
  if (charsPerPage <= 0) return 0;
  return Math.ceil(wordCount / charsPerPage);
}

// Character capacity per page for each supported page format
export const CHARS_PER_PAGE: Record<string, number> = {
  A4: 6600,
  '16:9': 4200,
};
