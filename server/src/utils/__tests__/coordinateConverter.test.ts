import { describe, it, expect } from 'vitest';
import {
  mmToPx,
  pxToMm,
  rectMmToPx,
  clampToPageBounds,
  postProcessOptimizedLayout,
} from '../coordinateConverter';

describe('mmToPx', () => {
  it('converts millimeters to pixels at 96 DPI', () => {
    // 1 inch = 25.4mm, at 96 DPI = 96px
    expect(mmToPx(25.4)).toBe(96);
  });

  it('returns 0 for 0mm', () => {
    expect(mmToPx(0)).toBe(0);
  });

  it('rounds result to integer', () => {
    const result = mmToPx(10);
    expect(Number.isInteger(result)).toBe(true);
  });
});

describe('pxToMm', () => {
  it('converts pixels to millimeters', () => {
    expect(pxToMm(96)).toBeCloseTo(25.4);
  });

  it('is inverse of mmToPx (approximately)', () => {
    const mm = 50;
    const px = mmToPx(mm);
    expect(pxToMm(px)).toBeCloseTo(mm, 0);
  });
});

describe('rectMmToPx', () => {
  it('converts all rect dimensions', () => {
    const rect = { x: 10, y: 20, width: 50, height: 30 };
    const result = rectMmToPx(rect);
    expect(result.x).toBe(mmToPx(10));
    expect(result.y).toBe(mmToPx(20));
    expect(result.width).toBe(mmToPx(50));
    expect(result.height).toBe(mmToPx(30));
  });
});

describe('clampToPageBounds', () => {
  const margins = { top: 5, right: 5, bottom: 5, left: 5 };

  it('keeps position within bounds', () => {
    const result = clampToPageBounds(10, 10, 20, 20, 210, 297, margins);
    expect(result.x).toBe(10);
    expect(result.y).toBe(10);
  });

  it('clamps to left margin', () => {
    const result = clampToPageBounds(2, 10, 20, 20, 210, 297, margins);
    expect(result.x).toBe(5);
  });

  it('clamps to top margin', () => {
    const result = clampToPageBounds(10, 2, 20, 20, 210, 297, margins);
    expect(result.y).toBe(5);
  });

  it('clamps to right edge', () => {
    const result = clampToPageBounds(200, 10, 20, 20, 210, 297, margins);
    expect(result.x).toBe(185); // 210 - 5 - 20
  });

  it('clamps to bottom edge', () => {
    const result = clampToPageBounds(10, 290, 20, 20, 210, 297, margins);
    expect(result.y).toBe(272); // 297 - 5 - 20
  });
});

describe('postProcessOptimizedLayout', () => {
  const margins = { top: 5, right: 5, bottom: 5, left: 5 };

  it('skips user-positioned chunks', () => {
    const optimized = [
      { nodeId: 'a', page: 0, x: 10, y: 10 },
      { nodeId: 'b', page: 0, x: 20, y: 20 },
    ];
    const original = [
      { nodeId: 'a', x: 10, y: 10, width: 50, height: 30, isUserPositioned: true },
      { nodeId: 'b', x: 20, y: 20, width: 50, height: 30, isUserPositioned: false },
    ];

    const result = postProcessOptimizedLayout(optimized, original, 210, 297, margins);
    expect(result).toHaveLength(1);
    expect(result[0].nodeId).toBe('b');
  });

  it('clamps positions to page bounds', () => {
    const optimized = [{ nodeId: 'a', page: 0, x: 200, y: 290 }];
    const original = [
      { nodeId: 'a', x: 10, y: 10, width: 50, height: 30, isUserPositioned: false },
    ];

    const result = postProcessOptimizedLayout(optimized, original, 210, 297, margins);
    expect(result[0].x).toBe(155); // 210 - 5 - 50
    expect(result[0].y).toBe(262); // 297 - 5 - 30
  });
});
