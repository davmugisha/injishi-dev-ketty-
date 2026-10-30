// The outbox's rules, pure (mobile spec 0003, the outbox child): the reported time and its monotonic
// rebase, the backoff, the lane rule, dependencies, coalescing, and what each answer makes of a row.
// No React Native import, so `node --test` locks them without a device.

import { kigaliDate } from "../../lib/kigali.ts";
import { type OutboxRow, UNSENT_STATES } from "./types.ts";

/** The waits after each failed attempt, then a steady 2 minutes (D-j). */
export const BACKOFF_SECONDS = [5, 15, 30, 60] as const;
export const STEADY_RETRY_SECONDS = 120;

/** After this many failed attempts a row says "Still trying" (it is never dropped on its own). */
export const STILL_TRYING_AFTER = 5;

/** The wait before the next attempt, after `attempts` failed ones. */
export function backoffMs(attempts: number): number {
  const step = BACKOFF_SECONDS[Math.max(0, attempts - 1)];
  return (attempts >= 1 && step !== undefined ? step : STEADY_RETRY_SECONDS) * 1000;
}

/** The clocks at the moment of an attempt: the wall clock, the monotonic timer and this app start's id. */
export interface AttemptClock {
  wallMs: number;
  monoMs: number;
  processId: string;
}

/**
 * The reported time pair for one attempt (cross child contract 1). `deviceSentAt` is the wall clock
 * now. While the app has not been killed since the tap, `occurredAt` is rebased on the monotonic
 * timer, so a wall clock reset by the network in between changes nothing; after a kill the timer is
 * gone and the stored tap is sent.
 */
export function reportedTimeFor(
  row: Pick<OutboxRow, "occurredAt" | "occurredMono" | "processId">,
  now: AttemptClock,
): { occurredAt: string; deviceSentAt: string } {
  const deviceSentAt = new Date(now.wallMs).toISOString();
  if (row.processId !== now.processId) return { occurredAt: row.occurredAt, deviceSentAt };
  const elapsed = Math.max(0, now.monoMs - row.occurredMono);
  return { occurredAt: new Date(Math.round(now.wallMs - elapsed)).toISOString(), deviceSentAt };
}

export function isUnsent(row: Pick<OutboxRow, "state">): boolean {
  return UNSENT_STATES.includes(row.state);
}

/** What a lane does next (D-ag): send its oldest row, wait for it, or rest. */
export type LaneStep =
  | { kind: "send"; row: OutboxRow }
  | { kind: "wait"; until: number }
  /** The row's parent was refused, so it is refused with it, under one reason (D-as). */
  | { kind: "refuse_with_parent"; row: OutboxRow; parent: OutboxRow }
  /** The row's parent is still on its way in another lane; this lane waits. */
  | { kind: "blocked"; row: OutboxRow }
  | { kind: "idle" };

/**
 * The lane rule: the lowest `seq` unsent row goes first, and a row waiting to retry stops the lane
 * until it is due, so no later row overtakes it. Only a sent or refused row lets the next one go.
 * `rows` are one lane's rows for one account; `parentOf` finds a `dependsOn` row in any lane.
 */
export function nextStep(
  rows: readonly OutboxRow[],
  parentOf: (id: string) => OutboxRow | undefined,
  nowMs: number,
): LaneStep {
  const row = [...rows].filter(isUnsent).sort((a, b) => a.seq - b.seq)[0];
  if (!row) return { kind: "idle" };
  if (row.state === "waiting_retry" && row.nextAttemptAt !== null && row.nextAttemptAt > nowMs) {
    return { kind: "wait", until: row.nextAttemptAt };
  }
  if (row.dependsOn) {
    const parent = parentOf(row.dependsOn);
    if (parent?.state === "refused") return { kind: "refuse_with_parent", row, parent };
    if (parent && parent.state !== "sent") return { kind: "blocked", row };
  }
  return { kind: "send", row };
}

/** The earliest moment any lane has a row due, for the retry timer; null when nothing waits. */
export function earliestDue(rows: readonly OutboxRow[]): number | null {
  let due: number | null = null;
  for (const row of rows) {
    if (row.state !== "waiting_retry" || row.nextAttemptAt === null) continue;
    if (due === null || row.nextAttemptAt < due) due = row.nextAttemptAt;
  }
  return due;
}

/** One answer from the API, as `@injishi/api-client` gives it. */
export type Answer =
  | { status: "ok"; data: unknown; serverDate?: string }
  | { status: "unauthenticated" }
  | {
      status: "refused";
      httpStatus: number;
      message?: string;
      code?: string;
      body?: unknown;
      serverDate?: string;
    }
  | { status: "failed" };

export type Refusal = Extract<Answer, { status: "refused" }>;

/** What one answer makes of a row (the send loop's answer table). */
export type Outcome =
  | { type: "sent"; result: unknown; note: string | null; serverAt: string | null }
  | { type: "refused"; message: string }
  | { type: "retry"; reason: string }
  /** Every lane stops and the session returns to sign in; the row goes back to `queued`. */
  | { type: "signed_out" }
  /** Every lane stops and the step up screen opens; the row goes back to `queued`. */
  | { type: "step_up" };

export const CANT_REACH = "Can't reach Injishi";

/**
 * The answer table: `ok`, or a refusal the kind reads as "already done", is sent; a timeout, a
 * `429` and a request still in flight wait to retry, as does no answer at all; a signed out session
 * and the step up stop everything; any other refusal is final and shows the server's reason.
 * `alreadyDone` returns the note for a refusal that means the write already happened, else null.
 */
export function outcomeOf(answer: Answer, alreadyDone: (refusal: Refusal) => string | null): Outcome {
  switch (answer.status) {
    case "ok":
      return { type: "sent", result: answer.data, note: null, serverAt: answer.serverDate ?? null };
    case "unauthenticated":
      return { type: "signed_out" };
    case "failed":
      return { type: "retry", reason: CANT_REACH };
    case "refused": {
      if (answer.code === "two_factor_required") return { type: "step_up" };
      if (answer.httpStatus === 408 || answer.httpStatus === 429 || answer.code === "request_in_progress") {
        return { type: "retry", reason: answer.httpStatus === 429 ? "Injishi asked to slow down" : CANT_REACH };
      }
      const note = alreadyDone(answer);
      if (note !== null) return { type: "sent", result: answer.body ?? null, note, serverAt: answer.serverDate ?? null };
      return { type: "refused", message: refusalWords(answer) };
    }
  }
}

/** A refusal in plain words: the API's own sentence when it wrote one, else one per code. */
export function refusalWords(refusal: Refusal): string {
  if (refusal.message) return refusal.message;
  switch (refusal.code) {
    case "reported_time_too_old":
      return "This is more than 7 days old, so it can't be sent. Ask your manager for a missed punch fix.";
    case "idempotency_key_reused":
      return "Injishi already has a different change under this one's key.";
    case "time_before_start":
      return "The end is before the start.";
    default:
      return refusal.httpStatus === 403 ? "You can't do this here any more." : "Injishi couldn't accept this.";
  }
}

/**
 * Coalescing at enqueue: a `task_check` for the same task and item, or a `minibar_count` for the same
 * task, replaces the payload of a row still `queued` (a tick then an untick sends once). Nothing else
 * coalesces. Returns the row to replace, or undefined.
 */
export function coalesceTarget(
  rows: readonly OutboxRow[],
  incoming: { userId: string; kind: string; subjectId: string; payload: Record<string, unknown> },
): OutboxRow | undefined {
  const same = (row: OutboxRow): boolean =>
    row.state === "queued" &&
    row.userId === incoming.userId &&
    row.kind === incoming.kind &&
    row.subjectId === incoming.subjectId;
  if (incoming.kind === "task_check") {
    return rows.find((row) => same(row) && row.payload.itemId === incoming.payload.itemId);
  }
  if (incoming.kind === "minibar_count") return rows.find(same);
  return undefined;
}

/** Writes about a task that wait on that task's unsent start (D-as). */
export const TASK_WRITES: readonly string[] = [
  "task_pause",
  "task_resume",
  "task_check",
  "minibar_count",
  "task_done",
  "found_item",
];

/** The unsent `task_start` a new task write depends on, or null. */
export function dependencyFor(
  rows: readonly OutboxRow[],
  incoming: { userId: string; kind: string; subjectId: string },
): string | null {
  if (!TASK_WRITES.includes(incoming.kind)) return null;
  const start = rows.find(
    (row) =>
      row.kind === "task_start" && row.userId === incoming.userId && row.subjectId === incoming.subjectId && isUnsent(row),
  );
  return start?.id ?? null;
}

/** The header chip's counts and the outbox screen's sections. */
export interface OutboxSummary {
  /** Queued, sending or waiting to retry. */
  waiting: number;
  refused: number;
  /** Waiting rows that failed at least `STILL_TRYING_AFTER` times. */
  stillTrying: number;
  /** The chip: "N waiting", "N not sent" when any is refused, else "All sent". */
  chip: { label: string; tone: "warning" | "danger" | "success" };
}

export function summarize(rows: readonly OutboxRow[]): OutboxSummary {
  const waiting = rows.filter(isUnsent).length;
  const refused = rows.filter((row) => row.state === "refused").length;
  const stillTrying = rows.filter((row) => isUnsent(row) && row.attempts >= STILL_TRYING_AFTER).length;
  const chip: OutboxSummary["chip"] =
    refused > 0
      ? { label: `${refused} not sent`, tone: "danger" }
      : waiting > 0
        ? { label: `${waiting} waiting`, tone: "warning" }
        : { label: "All sent", tone: "success" };
  return { waiting, refused, stillTrying, chip };
}

/** A sent row whose Kigali day has ended, and that no unsent row still names, is deleted. */
export function purgeable(rows: readonly OutboxRow[], today: string, offsetMs: number): OutboxRow[] {
  const named = new Set(rows.filter(isUnsent).flatMap((row) => (row.dependsOn ? [row.dependsOn] : [])));
  return rows.filter(
    (row) =>
      row.state === "sent" && row.sentAt !== null && kigaliDate(row.sentAt + offsetMs) < today && !named.has(row.id),
  );
}
