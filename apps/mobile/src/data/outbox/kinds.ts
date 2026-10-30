// The outbox's kinds (mobile spec 0003, cross child contract 2). A feature adds writes by registering a
// kind here: its contract (checked at enqueue), how to build the request, which refusals mean "already
// done", what to refresh once it is sent, and how the outbox screen names it. Milestone 1 has the two
// punches; each later milestone adds its own.

import type { ApiRequest } from "@injishi/api-client";
import { PhoneClockRequest } from "@injishi/contracts";
import type { QueryKey } from "@tanstack/react-query";
import { kigaliDate, kigaliShortDate, kigaliTime } from "@/lib/kigali";
import type { Refusal } from "./rules";
import type { OutboxLane, OutboxRow } from "./types";

export interface KindSpec {
  lane: OutboxLane;
  /** The request body's contract, checked when the write is saved, before it can ever be sent. */
  schema: { safeParse(input: unknown): { success: boolean } };
  /** The call for one attempt, with this attempt's reported time. */
  request(row: OutboxRow, time: { occurredAt: string; deviceSentAt: string }): { path: string; init: ApiRequest };
  /** The note for a refusal that means the write already happened, else null. */
  alreadyDone(refusal: Refusal, row: OutboxRow, today: string): string | null;
  /** The queries to read again once it is sent. */
  refresh(row: OutboxRow): QueryKey[];
  /** What it is, on the outbox screen: "Clock in". */
  label(row: OutboxRow): string;
  /** What others still see while it waits. */
  othersSee(row: OutboxRow): string;
  /** For a kind whose parent's answer it needs (a photo needs its found item's id): the payload with it. */
  adoptParent?(payload: Record<string, unknown>, parentResult: unknown): Record<string, unknown>;
}

/** The fields a punch's location fix rides in, removed from the row once it is sent. */
export const LOCATION_FIELDS = ["lat", "lng", "accuracyM"] as const;

function punch(path: "clock-in" | "clock-out", row: OutboxRow, time: { occurredAt: string; deviceSentAt: string }) {
  return {
    path: `/api/v1/me/work/${row.subjectId}/${path}`,
    init: { method: "POST" as const, body: { ...row.payload, ...time } },
  };
}

function todayKeys(row: OutboxRow): QueryKey[] {
  return [
    ["u", row.userId, "today", row.subjectId],
    ["u", row.userId, "me-work"],
  ];
}

/** "Already clocked in at 06:55", with the date when it was not today (AC-7). */
function alreadyClockedIn(refusal: Refusal, today: string): string | null {
  if (refusal.code !== "already_open") return null;
  const record = (refusal.body as { record?: { clockInAt?: unknown } } | undefined)?.record;
  const at = typeof record?.clockInAt === "string" ? record.clockInAt : null;
  if (!at) return "Already clocked in";
  const day = kigaliDate(Date.parse(at)) === today ? "" : ` on ${kigaliShortDate(at)}`;
  return `Already clocked in at ${kigaliTime(at)}${day}`;
}

export const kinds: Record<string, KindSpec> = {
  clock_in: {
    lane: "main",
    schema: PhoneClockRequest,
    request: (row, time) => punch("clock-in", row, time),
    alreadyDone: (refusal, _row, today) => alreadyClockedIn(refusal, today),
    refresh: todayKeys,
    label: () => "Clock in",
    othersSee: () => "Your manager doesn't see you clocked in yet",
  },
  clock_out: {
    lane: "main",
    schema: PhoneClockRequest,
    request: (row, time) => punch("clock-out", row, time),
    alreadyDone: (refusal) => (refusal.code === "not_clocked_in" ? "Already clocked out" : null),
    refresh: todayKeys,
    label: () => "Clock out",
    othersSee: () => "Your manager still sees you on shift",
  },
};
