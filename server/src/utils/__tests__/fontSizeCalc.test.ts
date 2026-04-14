import { describe, it, expect } from 'vitest';
import { calculateFontSize, getLineHeight, reevaluateFontSize } from '../fontSizeCalc';

describe('calculateFontSize', () => {
  it('returns max font size when ratio is low', () => {
    expect(calculateFontSize(500, 1000)).toBe(10);
  });

  it('returns max font size at exactly 0.7 ratio', () => {
    expect(calculateFontSize(700, 1000)).toBe(10);
  });

  it('returns default (7pt) at exactly 1.0 ratio', () => {
    expect(calculateFontSize(1000, 1000)).toBe(7);
  });

  it('interpolates between 10pt and 7pt for 0.7-1.0 range', () => {
    const result = calculateFontSize(850, 1000);
    expect(result).toBeGreaterThan(7);
    expect(result).toBeLessThan(10);
  });

  it('returns min font size when ratio is very high', () => {
    expect(calculateFontSize(1500, 1000)).toBe(6);
  });

  it('interpolates between 7pt and 6pt for 1.0-1.3 range', () => {
    const result = calculateFontSize(1150, 1000);
    expect(result).toBeGreaterThan(6);
    expect(result).toBeLessThan(7);
  });

  it('returns default for zero word limit', () => {
    expect(calculateFontSize(100, 0)).toBe(7);
  });

  it('returns default for negative word limit', () => {
    expect(calculateFontSize(100, -1)).toBe(7);
  });

  it('handles zero words', () => {
    expect(calculateFontSize(0, 1000)).toBe(10);
  });
});

describe('getLineHeight', () => {
  it('returns 1.4 for 6pt and below', () => {
    expect(getLineHeight(6)).toBe(1.4);
    expect(getLineHeight(5)).toBe(1.4);
  });

  it('returns 1.35 for 7pt', () => {
    expect(getLineHeight(7)).toBe(1.35);
  });

  it('returns 1.3 for 8pt', () => {
    expect(getLineHeight(8)).toBe(1.3);
  });

  it('returns 1.25 for 9pt and above', () => {
    expect(getLineHeight(9)).toBe(1.25);
    expect(getLineHeight(10)).toBe(1.25);
  });
});

describe('reevaluateFontSize', () => {
  it('reports changed when font size differs', () => {
    const result = reevaluateFontSize(10, 1000, 1000);
    expect(result.changed).toBe(true);
    expect(result.fontSize).toBe(7);
  });

  it('reports not changed when font size matches', () => {
    const result = reevaluateFontSize(10, 500, 1000);
    expect(result.changed).toBe(false);
    expect(result.fontSize).toBe(10);
  });

  it('returns correct lineHeight', () => {
    const result = reevaluateFontSize(10, 1500, 1000);
    expect(result.fontSize).toBe(6);
    expect(result.lineHeight).toBe(1.4);
  });
});
