/**
 * Photo and video checks made in the browser before an upload.
 *
 *   pnpm --filter @injishi/ui test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatFileSize,
  MB,
  moveItem,
  photoFileProblem,
  takeRoom,
  videoDurationProblem,
  videoFileProblem,
  videoLength,
} from "../src/media.ts";

test("photos: JPEG, PNG or WebP within the size", () => {
  assert.equal(photoFileProblem({ name: "a.jpg", type: "image/jpeg", size: 2 * MB }), null);
  assert.equal(photoFileProblem({ name: "a.webp", type: "", size: 2 * MB }), null, "no type: judged by name");
  assert.match(photoFileProblem({ name: "a.heic", type: "image/heic", size: MB }) ?? "", /isn't a JPEG, PNG or WebP/);
  assert.match(
    photoFileProblem({ name: "a.png", type: "image/png", size: 11 * MB }) ?? "",
    /a.png is 11 MB. The most is 10 MB/,
  );
  assert.match(photoFileProblem({ name: "a.png", type: "image/png", size: 0 }) ?? "", /empty/);
  assert.equal(
    photoFileProblem({ name: "a.png", type: "image/png", size: 3 * MB }, 2 * MB),
    "a.png is 3 MB. The most is 2 MB.",
  );
});

test("videos: MP4, MOV or WebM within the size, 1 second to 3 minutes", () => {
  assert.equal(videoFileProblem({ name: "t.mp4", type: "video/mp4", size: 20 * MB }), null);
  assert.equal(videoFileProblem({ name: "t.mov", type: "", size: 20 * MB }), null);
  assert.match(videoFileProblem({ name: "t.avi", type: "video/x-msvideo", size: MB }) ?? "", /MP4, MOV or WebM/);
  assert.match(videoFileProblem({ name: "t.mp4", type: "video/mp4", size: 101 * MB }) ?? "", /101 MB/);
  assert.equal(videoDurationProblem(42), null);
  assert.equal(videoDurationProblem(180.4), null, "players round");
  assert.equal(videoDurationProblem(181), "That video runs 3:01. Keep it to 3 minutes or less.");
  assert.equal(videoDurationProblem(0.2), "That video is too short. Use one of at least 1 second.");
  assert.match(videoDurationProblem(Number.NaN) ?? "", /couldn't play/);
  assert.equal(videoDurationProblem(20, 1, 90), null);
  assert.equal(videoDurationProblem(95, 1, 90), "That video runs 1:35. Keep it to 1 minute 30 seconds or less.");
});

test("lengths and sizes in words", () => {
  assert.equal(videoLength(42), "0:42");
  assert.equal(videoLength(125), "2:05");
  assert.equal(formatFileSize(850_000), "830 KB");
  assert.equal(formatFileSize(2.4 * MB), "2.4 MB");
  assert.equal(formatFileSize(2 * MB), "2 MB");
  assert.equal(formatFileSize(12.6 * MB), "13 MB");
});

test("room and order", () => {
  assert.deepEqual(takeRoom([1, 2, 3], 2), { taken: [1, 2], left: [3] });
  assert.deepEqual(takeRoom([1, 2, 3], 0), { taken: [], left: [1, 2, 3] });
  assert.deepEqual(moveItem(["a", "b", "c", "d"], 3, 0), ["d", "a", "b", "c"]);
  assert.deepEqual(moveItem(["a", "b", "c", "d"], 0, 2), ["b", "c", "a", "d"]);
  assert.deepEqual(moveItem(["a", "b"], 1, 9), ["a", "b"]);
  assert.deepEqual(moveItem(["a", "b"], 5, 0), ["a", "b"]);
});
