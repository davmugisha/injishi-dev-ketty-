// The outbox's shapes (mobile spec 0003, the outbox child). Pure types and constants, so the rules
// and their tests share them without React Native.

/** `queued → sending → sent`; `sending → waiting_retry → sending`; `sending → refused`. */
export const outboxStates = ["queued", "sending", "waiting_retry", "sent", "refused"] as const;
export type OutboxState = (typeof outboxStates)[number];

/** States a write is still on its way in. */
export const UNSENT_STATES: readonly OutboxState[] = ["queued", "sending", "waiting_retry"];

/** `main` carries every write without a file; `files` carries uploads, so a slow photo never holds ticks (D-ag). */
export type OutboxLane = "main" | "files";

/** One write saved on the phone: one row of the `outbox` table. */
export interface OutboxRow {
  /** The send order, from SQLite: two writes in one millisecond, or across a clock change, keep their order. */
  seq: number;
  /** A UUID minted at the tap: the `Idempotency-Key` on every attempt. */
  id: string;
  lane: OutboxLane;
  /** The account that made it; it is sent only while that account is signed in. */
  userId: string;
  /** The workspace and branch it was made under, never whatever is active at send time. */
  workspaceId: string | null;
  branchId: string | null;
  kind: string;
  /** The task or employee it is about, for grouping and the overlay. */
  subjectId: string;
  /** The request body, checked against its contract at enqueue. */
  payload: Record<string, unknown>;
  /** The phone's clock at the tap. */
  occurredAt: string;
  /** `performance.now()` at the tap, valid only within `processId`. */
  occurredMono: number;
  /** A random id minted at each app start. */
  processId: string;
  /** The phone's clock at the tap, for display only, never for order. */
  createdAt: number;
  state: OutboxState;
  attempts: number;
  nextAttemptAt: number | null;
  /** Another row's `id` this one waits on. */
  dependsOn: string | null;
  /** The refusal, or a note such as "Already clocked in at 07:02". */
  serverMessage: string | null;
  result: unknown;
  /** The phone's clock when it was sent, for "Sent at HH:MM". */
  sentAt: number | null;
  /** The answer's `date` header: the server's clock, for the overlay (D-aq). */
  serverAt: string | null;
  fileUri: string | null;
  fileObjectKey: string | null;
}

/** What a caller hands `enqueue`; the outbox fills in the rest. */
export interface NewWrite {
  kind: string;
  subjectId: string;
  payload: Record<string, unknown>;
  workspaceId?: string | null;
  branchId?: string | null;
  dependsOn?: string | null;
  fileUri?: string | null;
}
