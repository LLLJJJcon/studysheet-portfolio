/**
 * Collision detection for layout chunks.
 * Checks for overlapping rectangles and boundary violations.
 */

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PageBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Check if two rectangles overlap.
 */
// Check whether two rectangles overlap, with an optional gap margin
export function rectsOverlap(a: Rect, b: Rect, gap: number = 0): boolean {
  return !(
    a.x + a.width + gap <= b.x ||
    b.x + b.width + gap <= a.x ||
    a.y + a.height + gap <= b.y ||
    b.y + b.height + gap <= a.y
  );
}

/**
 * Check if a rectangle is within page boundaries.
 */
// Check whether a rectangle fits entirely within the given page boundaries
export function isWithinBounds(rect: Rect, bounds: PageBounds): boolean {
  return (
    rect.x >= bounds.left &&
    rect.y >= bounds.top &&
    rect.x + rect.width <= bounds.right &&
    rect.y + rect.height <= bounds.bottom
  );
}

/**
 * Find all collisions for a given rect against a list of other rects.
 * Returns indices of colliding rects.
 */
// Find indices of all rectangles in the list that overlap with the given rect
export function findCollisions(
  rect: Rect,
  others: Rect[],
  gap: number = 0,
  excludeIndex?: number
): number[] {
  const collisions: number[] = [];
  for (let i = 0; i < others.length; i++) {
    if (i === excludeIndex) continue;
    if (rectsOverlap(rect, others[i], gap)) {
      collisions.push(i);
    }
  }
  return collisions;
}

/**
 * Snap a rect to avoid collisions by shifting it.
 * Returns a new position that avoids overlaps.
 */
// Compute the smallest displacement to move a rectangle away from a static obstacle
export function resolveCollision(
  movingRect: Rect,
  staticRect: Rect,
  gap: number = 2
): { x: number; y: number } {
  // Find the minimum displacement to resolve
  const dx1 = staticRect.x + staticRect.width + gap - movingRect.x; // move right
  const dx2 = staticRect.x - gap - (movingRect.x + movingRect.width); // move left
  const dy1 = staticRect.y + staticRect.height + gap - movingRect.y; // move down
  const dy2 = staticRect.y - gap - (movingRect.y + movingRect.height); // move up

  // Pick smallest absolute displacement
  const options = [
    { x: movingRect.x + dx1, y: movingRect.y, dist: Math.abs(dx1) },
    { x: movingRect.x + dx2, y: movingRect.y, dist: Math.abs(dx2) },
    { x: movingRect.x, y: movingRect.y + dy1, dist: Math.abs(dy1) },
    { x: movingRect.x, y: movingRect.y + dy2, dist: Math.abs(dy2) },
  ];

  options.sort((a, b) => a.dist - b.dist);
  return { x: options[0].x, y: options[0].y };
}
