// The outbox's door for screens (mobile spec 0003, D-e, D-p): `enqueue` saves a write on the phone at
// the tap and starts a send; the hooks read the rows back. A screen shows a write through a query's
// overlay (`overlay.ts`), never from these rows directly, except the outbox screen and the chip.

import { useMemo, useSyncExternalStore } from "react";
import { serverNow } from "@/lib/clock";
import { kigaliDate } from "@/lib/kigali";
import { newId } from "./ids";
import { kinds } from "./kinds";
import { notifyOutbox, outboxVersion, subscribeOutbox } from "./notify";
import { coalesceTarget, dependencyFor, type OutboxSummary, summarize } from "./rules";
import { PROCESS_ID, sendOutbox } from "./send";
import { deleteRow, insertRow, rowsOf, updateRow } from "./store";
import type { NewWrite, OutboxRow } from "./types";

export { resumeOutbox, sendOutbox, setOutboxAccount } from "./send";
export type { OutboxRow } from "./types";

export type EnqueueResult = { ok: true; row: OutboxRow } | { ok: false; reason: string };

/**
 * Save a write on the phone, under the account that made it, at the time of the tap, then try to send
 * it. The payload is checked against its kind's contract first, so a write that could never be
 * accepted is never saved. Returns at once; the screen says "Saved on this phone".
 */
export function enqueue(userId: string, write: NewWrite): EnqueueResult {
  const spec = kinds[write.kind];
  if (!spec) return { ok: false, reason: `Unknown write: ${write.kind}` };
  if (!spec.schema.safeParse(write.payload).success) return { ok: false, reason: "That change isn't complete." };
  const rows = rowsOf(userId);
  const existing = coalesceTarget(rows, { userId, kind: write.kind, subjectId: write.subjectId, payload: write.payload });
  if (existing) {
    updateRow(existing.id, { payload: write.payload });
    notifyOutbox();
    void sendOutbox("enqueue");
    return { ok: true, row: { ...existing, payload: write.payload } };
  }
  const now = Date.now();
  const row = insertRow({
    id: newId(),
    lane: spec.lane,
    userId,
    workspaceId: write.workspaceId ?? null,
    branchId: write.branchId ?? null,
    kind: write.kind,
    subjectId: write.subjectId,
    payload: write.payload,
    occurredAt: new Date(now).toISOString(),
    occurredMono: performance.now(),
    processId: PROCESS_ID,
    createdAt: now,
    state: "queued",
    attempts: 0,
    nextAttemptAt: null,
    dependsOn: write.dependsOn ?? dependencyFor(rows, { userId, kind: write.kind, subjectId: write.subjectId }),
    serverMessage: null,
    result: null,
    sentAt: null,
    serverAt: null,
    fileUri: write.fileUri ?? null,
    fileObjectKey: null,
  });
  notifyOutbox();
  void sendOutbox("enqueue");
  return { ok: true, row };
}

/** Dismiss a refused write: it is deleted, and the writes behind it already went on. */
export function dismiss(id: string): void {
  deleteRow(id);
  notifyOutbox();
}

/** An account's rows, read again whenever one changes. */
export function useOutboxRows(userId: string | null | undefined): OutboxRow[] {
  const version = useSyncExternalStore(subscribeOutbox, outboxVersion);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the version is the signal to read again
  return useMemo(() => (userId ? rowsOf(userId) : []), [userId, version]);
}

/** The chip's counts. */
export function useOutboxSummary(userId: string | null | undefined): OutboxSummary {
  const rows = useOutboxRows(userId);
  return useMemo(() => summarize(rows), [rows]);
}

/** Was this sent today, on the server's clock as the phone knows it? */
export function sentToday(row: OutboxRow, offsetMs: number): boolean {
  return row.state === "sent" && row.sentAt !== null && kigaliDate(row.sentAt + offsetMs) === kigaliDate(serverNow());
}
