/**
 * The arithmetic behind `PhotoGallery`'s zoom (the photo enlarged where the pointer is, as a shop's product
 * photo does) and `PhotoGrid`'s reordering, as plain functions with no DOM, checked by
 * `tests/zoom.test.ts`.
 */

/** How much a zoomed photo is enlarged. */
export const ZOOM_SCALE = 2.5;

/** A box on the screen, as `getBoundingClientRect` gives it. */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The point of the photo to enlarge around, as percentages of its box (for `transform-origin`), from a
 * pointer at `x`, `y`. A pointer just outside the box (a finger sliding off the edge) holds at the edge.
 */
export function zoomOrigin(x: number, y: number, box: Box): { x: number; y: number } {
  if (box.width <= 0 || box.height <= 0) return { x: 50, y: 50 };
  const pct = (n: number) => Math.round(Math.min(100, Math.max(0, n * 100)) * 100) / 100;
  return { x: pct((x - box.left) / box.width), y: pct((y - box.top) / box.height) };
}

/** The next index going `step` from `index` in a list of `count`, wrapping around. */
export function wrapIndex(index: number, step: number, count: number): number {
  if (count <= 0) return 0;
  return (((index + step) % count) + count) % count;
}

/** Pixels a finger must travel sideways, at rest, for a swipe to go to the next photo. */
export const SWIPE_DISTANCE = 50;

/** Where a sideways swipe goes: -1 back, 1 on, 0 stay (too short, or more up and down than sideways). */
export function swipeStep(dx: number, dy: number, distance = SWIPE_DISTANCE): -1 | 0 | 1 {
  if (Math.abs(dx) < distance || Math.abs(dx) < Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}

/**
 * The slot under a point while dragging: the one containing it, or else the nearest by centre. `rects`
 * are the slots in order, as `{ left, top, right, bottom }`.
 */
export function slotAt(
  rects: readonly { left: number; top: number; right: number; bottom: number }[],
  x: number,
  y: number,
): number | null {
  let best: { index: number; distance: number } | null = null;
  for (const [index, r] of rects.entries()) {
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return index;
    const distance = Math.hypot((r.left + r.right) / 2 - x, (r.top + r.bottom) / 2 - y);
    if (!best || distance < best.distance) best = { index, distance };
  }
  return best?.index ?? null;
}
