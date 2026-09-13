/**
 * When a `pending` RRA check is tried again (ADR-053, AC-R5).
 *
 * `pending` is RRA being unreachable, never a verdict. FL01 promises the check is
 * retried automatically, and until this existed no code kept that promise: a
 * business that paid its fee during an outage sat at `submitted` forever.
 *
 * Pure rules, no database and no clock of their own, so the sweep and the admin
 * review queue answer "is this due" and "has this stalled" from one definition.
 */

/**
 * How long to wait AFTER attempt n before attempt n + 1.
 *
 * Attempt 1 is the check made at submission. The table is ADR-053's:
 *
 * | Attempts made | Wait before the next |
 * |---|---|
 * | 1 | 5 minutes |
 * | 2 | 30 minutes |
 * | 3 | 2 hours |
 * | 4 | 6 hours |
 * | 5 | 24 hours |
 * | 6 | the ceiling: stop, surface to admin |
 */
export const TIN_RECHECK_BACKOFF_MS: readonly number[] = [
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  6 * 60 * 60_000,
  24 * 60 * 60_000,
];

/**
 * Six attempts, then a human decides.
 *
 * A sweep with no ceiling turns a permanently broken adapter into an infinite
 * retry against a third party, which is how a dependency outage becomes a
 * dependency ban. Reaching it never rejects the business: an outage charged to
 * the registrant would bill them for the platform's bad day.
 */
export const TIN_RECHECK_CEILING = TIN_RECHECK_BACKOFF_MS.length + 1;

/** Has this business used every automatic attempt it gets? */
export function tinRecheckStalled(attemptsMade: number): boolean {
  return attemptsMade >= TIN_RECHECK_CEILING;
}

/**
 * When the next attempt is due, or null at the ceiling.
 *
 * Zero attempts is due immediately. It should not happen, because submission
 * makes attempt 1, but a business that reached `submitted` with no row at all is
 * better re checked than left waiting on a timer that never started.
 */
export function nextTinRecheckAt(
  attemptsMade: number,
  lastCheckedAt: Date | null,
): Date | null {
  if (tinRecheckStalled(attemptsMade)) return null;
  if (attemptsMade <= 0 || lastCheckedAt === null) return new Date(0);
  return new Date(lastCheckedAt.getTime() + TIN_RECHECK_BACKOFF_MS[attemptsMade - 1]);
}

/** Is an attempt due now? */
export function tinRecheckDue(
  attemptsMade: number,
  lastCheckedAt: Date | null,
  now: Date,
): boolean {
  const next = nextTinRecheckAt(attemptsMade, lastCheckedAt);
  return next !== null && next.getTime() <= now.getTime();
}
