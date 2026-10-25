/**
 * How a conversation reads (rentals P3.4, ported from feat/rentals): lines from the same person within
 * five minutes on one day sit in one group (name once, time once), a new day gets its divider, and the
 * "New messages" line goes above the first line from the other side after the last read.
 *
 *   pnpm --filter @injishi/ui test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileSize, messageClock, messageDay, placeMessages, unreadStart, voiceClock } from "../src/message-groups.ts";

const line = (createdAt: string, fromUs: boolean, senderName = fromUs ? "Me" : "Grace", bodyType = "text") => ({
  createdAt,
  fromUs,
  senderName,
  bodyType,
});

test("groups a run from one sender within five minutes, and breaks on a gap, a sender or a day", () => {
  const places = placeMessages([
    line("2026-10-25T08:00:00Z", false),
    line("2026-10-25T08:02:00Z", false),
    line("2026-10-25T08:06:59Z", false),
    line("2026-10-25T08:20:00Z", false),
    line("2026-10-25T08:21:00Z", true),
    line("2026-10-25T08:21:30Z", true, "Eric"),
    line("2026-10-25T22:30:00Z", true, "Eric"),
  ]);
  assert.deepEqual(
    places.map((p) => [p.newDay, p.first, p.last]),
    [
      [true, true, false],
      [false, false, false],
      [false, false, true],
      [false, true, true],
      [false, true, true],
      [false, true, true],
      // 22:30 UTC is 00:30 the next day in Kigali.
      [true, true, true],
    ],
  );
});

test("a system line stands alone", () => {
  const places = placeMessages([line("2026-10-25T08:00:00Z", false), line("2026-10-25T08:01:00Z", false, "Grace", "system")]);
  assert.equal(places[0]?.last, true);
  assert.equal(places[1]?.first, true);
});

test("prints Kigali times and days", () => {
  assert.equal(messageClock("2026-10-25T08:05:00Z"), "10:05");
  assert.equal(messageDay("2026-10-25T08:05:00Z", "2026-10-25T12:00:00Z"), "Today");
  assert.equal(messageDay("2026-10-24T08:05:00Z", "2026-10-25T12:00:00Z"), "Yesterday");
  assert.equal(messageDay("2026-10-20T08:05:00Z", "2026-10-25T12:00:00Z"), "Tuesday 20 October");
  assert.equal(messageDay("2025-10-20T08:05:00Z", "2026-10-25T12:00:00Z"), "Monday 20 October 2025");
});

test("puts the unread line above the first new line from the other side", () => {
  const list = [
    { id: "a", createdAt: "2026-10-25T08:00:00Z", fromUs: false, bodyType: "text" },
    { id: "b", createdAt: "2026-10-25T08:10:00Z", fromUs: true, bodyType: "text" },
    { id: "c", createdAt: "2026-10-25T08:20:00Z", fromUs: false, bodyType: "text" },
  ];
  assert.equal(unreadStart(list, "2026-10-25T08:05:00Z"), "c");
  assert.equal(unreadStart(list, "2026-10-25T08:30:00Z"), null);
  assert.equal(unreadStart(list, null), null);
});

test("voice clocks and file sizes read plainly", () => {
  assert.equal(voiceClock(7), "0:07");
  assert.equal(voiceClock(105.4), "1:45");
  assert.equal(voiceClock(Number.POSITIVE_INFINITY), "0:00");
  assert.equal(fileSize(84_000), "82 KB");
  assert.equal(fileSize(1_300_000), "1.2 MB");
  assert.equal(fileSize(null), "");
});
