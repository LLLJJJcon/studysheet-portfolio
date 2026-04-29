/**
 * Client-side collision detection for canvas elements.
 * Mirrors server-side logic.
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

// Check whether two rectangles overlap with an optional gap margin
export function rectsOverlap(a: Rect, b: Rect, gap: number = 0): boolean {
  return !(
    a.x + a.width + gap <= b.x ||
    b.x + b.width + gap <= a.x ||
    a.y + a.height + gap <= b.y ||
    b.y + b.height + gap <= a.y
  );
}

// Check whether a rectangle is fully contained within the given page bounds
export function isWithinBounds(rect: Rect, bounds: PageBounds): boolean {
  return (
    rect.x >= bounds.left &&
    rect.y >= bounds.top &&
    rect.x + rect.width <= bounds.right &&
    rect.y + rect.height <= bounds.bottom
  );
}

// Find indices of all rectangles that collide with the given rect
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

// Calculate the minimal displacement to resolve a collision between two rectangles
export function resolveCollision(
  movingRect: Rect,
  staticRect: Rect,
  gap: number = 2
): { x: number; y: number } {
  const dx1 = staticRect.x + staticRect.width + gap - movingRect.x;
  const dx2 = staticRect.x - gap - (movingRect.x + movingRect.width);
  const dy1 = staticRect.y + staticRect.height + gap - movingRect.y;
  const dy2 = staticRect.y - gap - (movingRect.y + movingRect.height);

  const options = [
    { x: movingRect.x + dx1, y: movingRect.y, dist: Math.abs(dx1) },
    { x: movingRect.x + dx2, y: movingRect.y, dist: Math.abs(dx2) },
    { x: movingRect.x, y: movingRect.y + dy1, dist: Math.abs(dy1) },
    { x: movingRect.x, y: movingRect.y + dy2, dist: Math.abs(dy2) },
  ];

  options.sort((a, b) => a.dist - b.dist);
  return { x: options[0].x, y: options[0].y };
}
