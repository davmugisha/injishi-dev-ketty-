// The outbox's pure rules (mobile spec 0003, the outbox child's critical scenarios), run by the
// mobile `test` script under `node --test`, with no device.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { MyWorkToday } from "@injishi/contracts";
import { applyPendingToday, overlays } from "./overlay.ts";
import {
  type Answer,
  backoffMs,
  CANT_REACH,
  coalesceTarget,
  dependencyFor,
  earliestDue,
  nextStep,
  outcomeOf,
  purgeable,
  reportedTimeFor,
  summarize,
} from "./rules.ts";
import type { OutboxRow } from "./types.ts";

let nextSeq = 1;

function row(over: Partial<OutboxRow> = {}): OutboxRow {
  const seq = over.seq ?? nextSeq++;
  return {
    seq,
    id: `row-${seq}`,
    lane: "main",
    userId: "user-a",
    workspaceId: null,
    branchId: null,
    kind: "clock_in",
    subjectId: "emp-1",
    payload: {},
    occurredAt: "2026-10-29T05:02:00.000Z",
    occurredMono: 1000,
    processId: "p1",
    createdAt: Date.parse("2026-10-29T05:02:00.000Z"),
    state: "queued",
    attempts: 0,
    nextAttemptAt: null,
    dependsOn: null,
    serverMessage: null,
    result: null,
    sentAt: null,
    serverAt: null,
    fileUri: null,
    fileObjectKey: null,
    ...over,
  };
}

const none = () => undefined;

describe("the reported time on each attempt", () => {
  test("rebases the tap on the monotonic timer while the app has not been killed", () => {
    // Tapped at mono 1000; the wall clock was then reset three hours ahead; sent 38 minutes later.
    const tapped = row({ occurredAt: "2026-10-29T05:02:00.000Z", occurredMono: 1000, processId: "p1" });
    const wall = Date.parse("2026-10-29T08:40:00.000Z");
    const sent = reportedTimeFor(tapped, { wallMs: wall, monoMs: 1000 + 38 * 60_000, processId: "p1" });
    assert.equal(sent.deviceSentAt, "2026-10-29T08:40:00.000Z");
    // The gap is 38 minutes on every clock, so the server lands on the tap.
    assert.equal(Date.parse(sent.deviceSentAt) - Date.parse(sent.occurredAt), 38 * 60_000);
  });

  test("sends the stored tap after a kill, when the timer is gone", () => {
    const tapped = row({ occurredAt: "2026-10-29T05:02:00.000Z", processId: "p1" });
    const sent = reportedTimeFor(tapped, { wallMs: Date.parse("2026-10-29T05:40:00.000Z"), monoMs: 50, processId: "p2" });
    assert.equal(sent.occurredAt, "2026-10-29T05:02:00.000Z");
    assert.equal(sent.deviceSentAt, "2026-10-29T05:40:00.000Z");
  });
});

describe("the lane rule", () => {
  test("sends the oldest row first, whatever the clock said", () => {
    const later = row({ seq: 20, createdAt: 1 });
    const earlier = row({ seq: 10, createdAt: 9 });
    const step = nextStep([later, earlier], none, 0);
    assert.equal(step.kind === "send" && step.row.seq, 10);
  });

  test("a row waiting to retry stops its lane until it is due, so nothing overtakes it", () => {
    const tick = row({ seq: 1, kind: "task_check", state: "waiting_retry", nextAttemptAt: 5_000 });
    const done = row({ seq: 2, kind: "task_done" });
    assert.deepEqual(nextStep([tick, done], none, 1_000), { kind: "wait", until: 5_000 });
    const due = nextStep([tick, done], none, 5_000);
    assert.equal(due.kind === "send" && due.row.seq, 1);
  });

  test("a sent or refused row lets the next one go", () => {
    const refused = row({ seq: 1, state: "refused" });
    const sent = row({ seq: 2, state: "sent" });
    const next = row({ seq: 3, kind: "clock_out" });
    const step = nextStep([refused, sent, next], none, 0);
    assert.equal(step.kind === "send" && step.row.seq, 3);
  });

  test("nothing unsent is idle, and the retry timer finds the earliest due row", () => {
    assert.deepEqual(nextStep([row({ state: "sent" })], none, 0), { kind: "idle" });
    assert.equal(
      earliestDue([row({ state: "waiting_retry", nextAttemptAt: 9 }), row({ state: "waiting_retry", nextAttemptAt: 4 })]),
      4,
    );
    assert.equal(earliestDue([row()]), null);
  });
});

describe("dependencies", () => {
  test("a task write depends on that task's unsent start", () => {
    const start = row({ kind: "task_start", subjectId: "task-204" });
    assert.equal(dependencyFor([start], { userId: "user-a", kind: "task_check", subjectId: "task-204" }), start.id);
    assert.equal(dependencyFor([start], { userId: "user-a", kind: "task_check", subjectId: "task-211" }), null);
    assert.equal(dependencyFor([{ ...start, state: "sent" }], { userId: "user-a", kind: "task_done", subjectId: "task-204" }), null);
    assert.equal(dependencyFor([start], { userId: "user-a", kind: "clock_out", subjectId: "task-204" }), null);
  });

  test("a row whose parent was refused is refused with it; an unsent parent holds it", () => {
    const parent = row({ kind: "task_start", state: "refused" });
    const child = row({ kind: "task_check", dependsOn: parent.id });
    const step = nextStep([child], (id) => (id === parent.id ? parent : undefined), 0);
    assert.equal(step.kind, "refuse_with_parent");
    const waiting = nextStep([child], () => ({ ...parent, state: "queued" }), 0);
    assert.equal(waiting.kind, "blocked");
    const sent = nextStep([child], () => ({ ...parent, state: "sent" }), 0);
    assert.equal(sent.kind, "send");
  });
});

describe("coalescing", () => {
  test("a tick then an untick of one item sends once; a sending row is never touched", () => {
    const tick = row({ kind: "task_check", subjectId: "task-204", payload: { itemId: "towels", checked: true } });
    const incoming = { userId: "user-a", kind: "task_check", subjectId: "task-204", payload: { itemId: "towels", checked: false } };
    assert.equal(coalesceTarget([tick], incoming), tick);
    assert.equal(coalesceTarget([{ ...tick, state: "sending" }], incoming), undefined);
    assert.equal(coalesceTarget([tick], { ...incoming, payload: { itemId: "sheets" } }), undefined);
  });

  test("a minibar count replaces the queued one; a clock in never coalesces", () => {
    const count = row({ kind: "minibar_count", subjectId: "task-204" });
    assert.equal(coalesceTarget([count], { userId: "user-a", kind: "minibar_count", subjectId: "task-204", payload: {} }), count);
    const punch = row({ kind: "clock_in" });
    assert.equal(coalesceTarget([punch], { userId: "user-a", kind: "clock_in", subjectId: "emp-1", payload: {} }), undefined);
  });
});

describe("the answer table", () => {
  const notDone = () => null;

  test("ok is sent, with the server's clock for the overlay", () => {
    assert.deepEqual(outcomeOf({ status: "ok", data: { id: 1 }, serverDate: "Thu, 29 Oct 2026 05:40:00 GMT" }, notDone), {
      type: "sent",
      result: { id: 1 },
      note: null,
      serverAt: "Thu, 29 Oct 2026 05:40:00 GMT",
    });
  });

  test("no answer, a timeout, a 429 and a request in flight wait to retry", () => {
    assert.deepEqual(outcomeOf({ status: "failed" }, notDone), { type: "retry", reason: CANT_REACH });
    assert.equal(outcomeOf({ status: "refused", httpStatus: 408 }, notDone).type, "retry");
    assert.equal(outcomeOf({ status: "refused", httpStatus: 429 }, notDone).type, "retry");
    assert.equal(outcomeOf({ status: "refused", httpStatus: 409, code: "request_in_progress" }, notDone).type, "retry");
  });

  test("a signed out session and the step up stop everything", () => {
    assert.deepEqual(outcomeOf({ status: "unauthenticated" }, notDone), { type: "signed_out" });
    assert.deepEqual(outcomeOf({ status: "refused", httpStatus: 403, code: "two_factor_required" }, notDone), {
      type: "step_up",
    });
  });

  test("a refusal the kind reads as already done is sent, with its note", () => {
    const answer: Answer = {
      status: "refused",
      httpStatus: 409,
      code: "already_open",
      body: { record: { clockInAt: "2026-10-29T04:55:00.000Z" } },
    };
    const outcome = outcomeOf(answer, (r) => (r.code === "already_open" ? "Already clocked in at 06:55" : null));
    assert.equal(outcome.type, "sent");
    assert.equal(outcome.type === "sent" && outcome.note, "Already clocked in at 06:55");
  });

  test("any other refusal is final, in the server's words or plain ones", () => {
    assert.deepEqual(outcomeOf({ status: "refused", httpStatus: 409, message: "You no longer work here." }, notDone), {
      type: "refused",
      message: "You no longer work here.",
    });
    const old = outcomeOf({ status: "refused", httpStatus: 422, code: "reported_time_too_old" }, notDone);
    assert.equal(old.type === "refused" && old.message.includes("missed punch fix"), true);
  });

  test("backs off 5, 15, 30 and 60 seconds, then every 2 minutes", () => {
    assert.deepEqual([1, 2, 3, 4, 5, 9].map(backoffMs), [5_000, 15_000, 30_000, 60_000, 120_000, 120_000]);
  });
});

describe("the chip and the sent rows", () => {
  test("says N waiting, N not sent when any is refused, else All sent", () => {
    assert.equal(summarize([]).chip.label, "All sent");
    assert.equal(summarize([row(), row({ state: "waiting_retry" })]).chip.label, "2 waiting");
    const withRefused = summarize([row(), row({ state: "refused" })]);
    assert.equal(withRefused.chip.label, "1 not sent");
    assert.equal(withRefused.chip.tone, "danger");
    assert.equal(summarize([row({ attempts: 5 })]).stillTrying, 1);
  });

  test("deletes sent rows from an earlier Kigali day, unless an unsent row names one", () => {
    const yesterday = row({ state: "sent", sentAt: Date.parse("2026-10-28T10:00:00Z") });
    const named = row({ state: "sent", sentAt: Date.parse("2026-10-28T11:00:00Z") });
    const child = row({ dependsOn: named.id });
    const today = row({ state: "sent", sentAt: Date.parse("2026-10-29T05:00:00Z") });
    assert.deepEqual(
      purgeable([yesterday, named, child, today], "2026-10-29", 0).map((r) => r.id),
      [yesterday.id],
    );
  });
});

describe("the overlay on the shift card", () => {
  const today: MyWorkToday = {
    employeeId: "emp-1",
    workDate: "2026-10-29",
    generatedAt: "2026-10-29T05:00:00.000Z",
    shifts: [],
    openRecord: null,
    openBreak: null,
    lastClockOutAt: null,
  };

  test("an unsent clock in shows on shift since the tap, saved on this phone", () => {
    const view = applyPendingToday(today, [row({ occurredAt: "2026-10-29T05:02:00.000Z" })], 0);
    assert.equal(view.openRecord?.clockInAt, "2026-10-29T05:02:00.000Z");
    assert.equal(view.openRecord?.saved, true);
  });

  test("the tap is corrected by the learned clock offset", () => {
    const view = applyPendingToday(today, [row({ occurredAt: "2026-10-29T08:02:00.000Z" })], -3 * 3_600_000);
    assert.equal(view.openRecord?.clockInAt, "2026-10-29T05:02:00.000Z");
  });

  test("a clock out after it closes the record at its tap", () => {
    const view = applyPendingToday(
      today,
      [row({ seq: 1 }), row({ seq: 2, kind: "clock_out", occurredAt: "2026-10-29T13:00:00.000Z" })],
      0,
    );
    assert.equal(view.openRecord, null);
    assert.equal(view.lastClockOutAt, "2026-10-29T13:00:00.000Z");
    assert.equal(view.clockOutSaved, true);
  });

  test("a refused row, another person's row and a sent row the read already holds are not laid over", () => {
    const sentBefore = row({ state: "sent", serverAt: "Thu, 29 Oct 2026 04:58:00 GMT" });
    assert.equal(applyPendingToday(today, [row({ state: "refused" })], 0).openRecord, null);
    assert.equal(applyPendingToday(today, [row({ subjectId: "emp-2" })], 0).openRecord, null);
    assert.equal(applyPendingToday(today, [sentBefore], 0).openRecord, null);
  });

  test("a sent row newer than the read stays laid over until the read catches up", () => {
    const sentAfter = row({ state: "sent", serverAt: "Thu, 29 Oct 2026 05:03:00 GMT" });
    assert.equal(overlays(sentAfter, today.generatedAt), true);
    const view = applyPendingToday(today, [sentAfter], 0);
    assert.equal(view.openRecord?.saved, false);
  });
});
