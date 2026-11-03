// The shift card's states (mobile spec 0003, AC-2, AC-3), under `node --test`.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { TodayView } from "../../data/outbox/overlay.ts";
import { shiftCardState, startWords } from "./shift-state.ts";

const morning = {
  rosterEntryId: "entry-1",
  shiftName: "Morning",
  startsAt: "2026-10-29T05:00:00.000Z",
  endsAt: "2026-10-29T13:00:00.000Z",
  breakMinutes: 30,
  propertyId: "prop-1",
};

function view(over: Partial<TodayView> = {}): TodayView {
  return {
    employeeId: "emp-1",
    workDate: "2026-10-29",
    generatedAt: "2026-10-29T04:00:00.000Z",
    shifts: [morning],
    openRecord: null,
    openBreak: null,
    lastClockOutAt: null,
    clockOutSaved: false,
    ...over,
  };
}

const at = (iso: string) => Date.parse(iso);

describe("the shift card", () => {
  test("before the shift it counts down, then says how long ago it started", () => {
    const before = shiftCardState(view(), at("2026-10-29T04:58:00.000Z"));
    assert.deepEqual(before, { kind: "before", shift: morning, minutes: 2 });
    const late = shiftCardState(view(), at("2026-10-29T05:10:00.000Z"));
    assert.equal(late.kind === "before" && startWords(late.minutes), "Started 10 min ago");
    assert.equal(startWords(80), "Starts in 1 h 20 min");
  });

  test("no shift on the roster, or every shift over, is no shift", () => {
    assert.deepEqual(shiftCardState(view({ shifts: [] }), at("2026-10-29T05:00:00.000Z")), { kind: "no_shift" });
    assert.deepEqual(shiftCardState(view(), at("2026-10-29T14:00:00.000Z")), { kind: "no_shift" });
  });

  test("on shift since the clock in, with its own shift, and a location reason asks the manager", () => {
    const state = shiftCardState(
      view({
        openRecord: {
          id: "rec-1",
          rosterEntryId: "entry-1",
          workDate: "2026-10-29",
          clockInAt: "2026-10-29T05:02:00.000Z",
          validated: false,
          pendingReason: "no_location",
          saved: false,
        },
      }),
      at("2026-10-29T06:00:00.000Z"),
    );
    assert.equal(state.kind, "on_shift");
    assert.equal(state.kind === "on_shift" && state.shift?.shiftName, "Morning");
    assert.equal(state.kind === "on_shift" && state.confirmLater, true);
  });

  test("a night shift that crossed midnight stays the card's shift while it is open", () => {
    const night = { ...morning, rosterEntryId: "night", startsAt: "2026-10-28T20:00:00.000Z", endsAt: "2026-10-29T04:00:00.000Z" };
    const state = shiftCardState(
      view({
        shifts: [night],
        openRecord: {
          id: "rec-2",
          rosterEntryId: "night",
          workDate: "2026-10-28",
          clockInAt: "2026-10-28T20:00:00.000Z",
          validated: true,
          pendingReason: null,
          saved: false,
        },
      }),
      at("2026-10-28T23:00:00.000Z"),
    );
    assert.equal(state.kind === "on_shift" && state.shift?.rosterEntryId, "night");
  });

  test("after a clock out it says when, and offers a second clock in", () => {
    assert.deepEqual(shiftCardState(view({ lastClockOutAt: "2026-10-29T13:00:00.000Z" }), at("2026-10-29T13:05:00.000Z")), {
      kind: "clocked_out",
      at: "2026-10-29T13:00:00.000Z",
      saved: false,
    });
  });
});
