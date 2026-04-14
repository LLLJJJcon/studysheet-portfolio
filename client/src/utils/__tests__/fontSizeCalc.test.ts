import { describe, it, expect } from 'vitest';
import { calculateFontSize, getLineHeight, reevaluateFontSize } from '../fontSizeCalc';

describe('calculateFontSize (client)', () => {
  it('returns 10pt for low ratio', () => {
    expect(calculateFontSize(300, 1000)).toBe(10);
  });

  it('returns 7pt at ratio 1.0', () => {
    expect(calculateFontSize(1000, 1000)).toBe(7);
  });

  it('returns 6pt for high ratio', () => {
    expect(calculateFontSize(1400, 1000)).toBe(6);
  });

  it('handles edge cases', () => {
    expect(calculateFontSize(0, 0)).toBe(7);
    expect(calculateFontSize(0, 1000)).toBe(10);
  });
});

describe('getLineHeight (client)', () => {
  it('returns correct values by font size', () => {
    expect(getLineHeight(6)).toBe(1.4);
    expect(getLineHeight(7)).toBe(1.35);
    expect(getLineHeight(8)).toBe(1.3);
    expect(getLineHeight(10)).toBe(1.25);
  });
});

describe('reevaluateFontSize (client)', () => {
  it('detects font size change', () => {
    const result = reevaluateFontSize(10, 1000, 1000);
    expect(result.changed).toBe(true);
    expect(result.fontSize).toBe(7);
    expect(result.lineHeight).toBe(1.35);
  });

  it('no change when same', () => {
    const result = reevaluateFontSize(10, 500, 1000);
    expect(result.changed).toBe(false);
  });
});
