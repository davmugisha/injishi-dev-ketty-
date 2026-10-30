// The outbox's rows in `injishi-data.db` (mobile spec 0003, D-p). One row per write, updated in place,
// so a kill at any moment loses nothing. Synchronous on purpose: a tap's row is on disk before the
// screen says "Saved on this phone". Nothing here is ever logged (D-aj).

import { dataDb } from "../db";
import type { OutboxRow, OutboxState } from "./types";

interface RawRow {
  seq: number;
  id: string;
  lane: string;
  user_id: string;
  workspace_id: string | null;
  branch_id: string | null;
  kind: string;
  subject_id: string;
  payload: string;
  occurred_at: string;
  occurred_mono: number;
  process_id: string;
  created_at: number;
  state: string;
  attempts: number;
  next_attempt_at: number | null;
  depends_on: string | null;
  server_message: string | null;
  result: string | null;
  sent_at: number | null;
  server_at: string | null;
  file_uri: string | null;
  file_object_key: string | null;
}

function parseJson(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function fromRaw(raw: RawRow): OutboxRow {
  return {
    seq: raw.seq,
    id: raw.id,
    lane: raw.lane === "files" ? "files" : "main",
    userId: raw.user_id,
    workspaceId: raw.workspace_id,
    branchId: raw.branch_id,
    kind: raw.kind,
    subjectId: raw.subject_id,
    payload: (parseJson(raw.payload) as Record<string, unknown> | null) ?? {},
    occurredAt: raw.occurred_at,
    occurredMono: raw.occurred_mono,
    processId: raw.process_id,
    createdAt: raw.created_at,
    state: raw.state as OutboxState,
    attempts: raw.attempts,
    nextAttemptAt: raw.next_attempt_at,
    dependsOn: raw.depends_on,
    serverMessage: raw.server_message,
    result: parseJson(raw.result),
    sentAt: raw.sent_at,
    serverAt: raw.server_at,
    fileUri: raw.file_uri,
    fileObjectKey: raw.file_object_key,
  };
}

/** Save a new write; the row comes back with its `seq`. */
export function insertRow(row: Omit<OutboxRow, "seq">): OutboxRow {
  const result = dataDb().runSync(
    `INSERT INTO outbox (id, lane, user_id, workspace_id, branch_id, kind, subject_id, payload, occurred_at,
      occurred_mono, process_id, created_at, state, attempts, next_attempt_at, depends_on, server_message, result,
      sent_at, server_at, file_uri, file_object_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row.id,
    row.lane,
    row.userId,
    row.workspaceId,
    row.branchId,
    row.kind,
    row.subjectId,
    JSON.stringify(row.payload),
    row.occurredAt,
    row.occurredMono,
    row.processId,
    row.createdAt,
    row.state,
    row.attempts,
    row.nextAttemptAt,
    row.dependsOn,
    row.serverMessage,
    row.result === null || row.result === undefined ? null : JSON.stringify(row.result),
    row.sentAt,
    row.serverAt,
    row.fileUri,
    row.fileObjectKey,
  );
  return { ...row, seq: Number(result.lastInsertRowId) };
}

/** One account's rows, in send order. */
export function rowsOf(userId: string): OutboxRow[] {
  return dataDb()
    .getAllSync<RawRow>("SELECT * FROM outbox WHERE user_id = ? ORDER BY seq", userId)
    .map(fromRaw);
}

/** How many of an account's writes have not been sent. */
export function unsentCount(userId: string): number {
  return (
    dataDb().getFirstSync<{ n: number }>(
      "SELECT count(*) AS n FROM outbox WHERE user_id = ? AND state IN ('queued', 'sending', 'waiting_retry')",
      userId,
    )?.n ?? 0
  );
}

/** The columns a send or a coalesce changes. */
export type RowPatch = Partial<
  Pick<
    OutboxRow,
    | "payload"
    | "state"
    | "attempts"
    | "nextAttemptAt"
    | "dependsOn"
    | "serverMessage"
    | "result"
    | "sentAt"
    | "serverAt"
    | "fileUri"
    | "fileObjectKey"
  >
>;

const COLUMN: Record<keyof RowPatch, string> = {
  payload: "payload",
  state: "state",
  attempts: "attempts",
  nextAttemptAt: "next_attempt_at",
  dependsOn: "depends_on",
  serverMessage: "server_message",
  result: "result",
  sentAt: "sent_at",
  serverAt: "server_at",
  fileUri: "file_uri",
  fileObjectKey: "file_object_key",
};

export function updateRow(id: string, patch: RowPatch): void {
  const entries = Object.entries(patch) as [keyof RowPatch, unknown][];
  if (entries.length === 0) return;
  const sets = entries.map(([key]) => `${COLUMN[key]} = ?`).join(", ");
  const values = entries.map(([key, value]) =>
    key === "payload" || key === "result" ? (value === null || value === undefined ? null : JSON.stringify(value)) : value,
  );
  dataDb().runSync(`UPDATE outbox SET ${sets} WHERE id = ?`, ...(values as (string | number | null)[]), id);
}

export function deleteRow(id: string): void {
  dataDb().runSync("DELETE FROM outbox WHERE id = ?", id);
}

/** Delete an account's rows; their files are returned so the caller can delete them too. */
export function deleteAccountRows(userId: string): string[] {
  const files = dataDb()
    .getAllSync<{ file_uri: string }>("SELECT file_uri FROM outbox WHERE user_id = ? AND file_uri IS NOT NULL", userId)
    .map((r) => r.file_uri);
  dataDb().runSync("DELETE FROM outbox WHERE user_id = ?", userId);
  return files;
}

/** The accounts other than this one that still have rows on the phone. */
export function otherAccounts(userId: string): string[] {
  return dataDb()
    .getAllSync<{ user_id: string }>("SELECT DISTINCT user_id FROM outbox WHERE user_id <> ?", userId)
    .map((r) => r.user_id);
}

/** A row left `sending` by a kill goes back to `queued`: its key makes the resend safe. */
export function requeueInterrupted(): void {
  dataDb().runSync("UPDATE outbox SET state = 'queued' WHERE state = 'sending'");
}

/** "Try sending now", or signal back: every row waiting to retry is due at once. */
export function clearBackoffs(userId: string): void {
  dataDb().runSync(
    "UPDATE outbox SET next_attempt_at = NULL WHERE user_id = ? AND state = 'waiting_retry'",
    userId,
  );
}
