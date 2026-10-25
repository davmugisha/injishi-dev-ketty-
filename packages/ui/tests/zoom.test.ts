/**
 * The gallery's zoom point, swipes and wrapping, and the slot under a dragged photo.
 *
 *   pnpm --filter @injishi/ui test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { slotAt, swipeStep, wrapIndex, zoomOrigin } from "../src/zoom.ts";

const box = { left: 100, top: 50, width: 400, height: 300 };

test("the zoom follows the pointer, as percentages of the photo", () => {
  assert.deepEqual(zoomOrigin(300, 200, box), { x: 50, y: 50 });
  assert.deepEqual(zoomOrigin(100, 50, box), { x: 0, y: 0 });
  assert.deepEqual(zoomOrigin(200, 125, box), { x: 25, y: 25 });
  assert.deepEqual(zoomOrigin(433, 150, box), { x: 83.25, y: 33.33 });
});

test("a pointer past the edge holds the zoom at that edge", () => {
  assert.deepEqual(zoomOrigin(0, 999, box), { x: 0, y: 100 });
  assert.deepEqual(zoomOrigin(10, 10, { left: 0, top: 0, width: 0, height: 0 }), { x: 50, y: 50 });
});

test("a swipe goes on, back, or stays", () => {
  assert.equal(swipeStep(-120, 10), 1);
  assert.equal(swipeStep(120, 10), -1);
  assert.equal(swipeStep(-30, 0), 0);
  assert.equal(swipeStep(-80, 200), 0);
});

test("next and previous wrap around", () => {
  assert.equal(wrapIndex(7, 1, 8), 0);
  assert.equal(wrapIndex(0, -1, 8), 7);
  assert.equal(wrapIndex(3, 1, 8), 4);
  assert.equal(wrapIndex(0, 1, 0), 0);
});

test("the slot under the pointer, or the nearest one", () => {
  const rects = [
    { left: 0, top: 0, right: 100, bottom: 75 },
    { left: 110, top: 0, right: 210, bottom: 75 },
    { left: 0, top: 85, right: 100, bottom: 160 },
  ];
  assert.equal(slotAt(rects, 150, 30), 1);
  assert.equal(slotAt(rects, 103, 30), 0);
  assert.equal(slotAt(rects, 400, 140), 1);
  assert.equal(slotAt(rects, 20, 400), 2);
  assert.equal(slotAt([], 0, 0), null);
});
