/**
 * How long a conversation lives after its last message (ADR-061 D-d), as the
 * owner set it on 2026-09-30. Every write moves `expires_at`; every read
 * filters on it.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

export const ANONYMOUS_RETENTION_DAYS = 7;
export const OWNED_RETENTION_DAYS = 90;

export function expiresAtFor(owned: boolean, lastMessageAt: Date): Date {
  const days = owned ? OWNED_RETENTION_DAYS : ANONYMOUS_RETENTION_DAYS;
  return new Date(lastMessageAt.getTime() + days * DAY_MS);
}

/** Limits on a public write that costs money per call (D-n). */
export const MAX_MODEL_CALLS_PER_TURN = 6;
export const MAX_OUTPUT_TOKENS = 8000;
/**
 * The whole turn, every model call and tool included, inside the 60 s the
 * API promises (D-p); the web client waits 65 s. No new model call starts
 * with less than `MIN_CALL_BUDGET_MS` left.
 */
export const TURN_BUDGET_MS = 55_000;
export const MIN_CALL_BUDGET_MS = 3_000;
