import { describe, it, expect } from 'vitest';
import { countWords, estimatePages } from '../wordCount';

describe('countWords', () => {
  it('counts English words', () => {
    expect(countWords('hello world')).toBe(2);
  });

  it('counts CJK characters individually', () => {
    expect(countWords('你好世界')).toBe(4);
  });

  it('handles mixed CJK and Latin text', () => {
    const count = countWords('hello 你好 world');
    expect(count).toBe(4); // 2 latin words + 2 CJK chars
  });

  it('returns 0 for empty string', () => {
    expect(countWords('')).toBe(0);
  });

  it('returns 0 for whitespace-only string', () => {
    expect(countWords('   ')).toBe(0);
  });

  it('returns 0 for null/undefined', () => {
    expect(countWords(null as unknown as string)).toBe(0);
    expect(countWords(undefined as unknown as string)).toBe(0);
  });

  it('handles multiple spaces between words', () => {
    expect(countWords('hello   world')).toBe(2);
  });

  it('handles newlines and tabs', () => {
    expect(countWords('hello\nworld\tthere')).toBe(3);
  });
});

describe('estimatePages', () => {
  it('estimates pages correctly', () => {
    expect(estimatePages(6600, 6600)).toBe(1);
    expect(estimatePages(13200, 6600)).toBe(2);
  });

  it('rounds up partial pages', () => {
    expect(estimatePages(6601, 6600)).toBe(2);
  });

  it('returns 0 for zero chars per page', () => {
    expect(estimatePages(100, 0)).toBe(0);
  });

  it('returns 0 for no content', () => {
    expect(estimatePages(0, 6600)).toBe(0);
  });
});
