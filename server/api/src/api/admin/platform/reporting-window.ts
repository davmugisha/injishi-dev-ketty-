/**
 * The comparison window every "…and how does that compare" number on this
 * console is measured over.
 *
 * `AdminKpi.previousValue` and `AdminRevenueLine.previousAmountRwf` exist so
 * the browser never picks its own window — two screens choosing 30 days and
 * "this calendar month" would disagree about the same platform and neither
 * would be wrong. The window is therefore a SERVER decision, stated once here
 * and imported by Overview and Analytics so those two cannot drift apart.
 *
 * Thirty rolling days rather than a calendar month: a calendar comparison is
 * meaningless on the 2nd, which is exactly when somebody opens the console
 * after a month-end.
 */
export const REPORTING_WINDOW_DAYS = 30;

export interface ReportingWindow {
  /** Inclusive lower bound of the current window. */
  readonly start: Date;
  /** Inclusive lower bound of the window immediately before it. */
  readonly previousStart: Date;
  /** The instant the window was taken, so every query in one response agrees. */
  readonly now: Date;
}

/**
 * Both bounds computed from ONE `now`.
 *
 * Taking `new Date()` separately in each query is how a response ends up with a
 * booking counted in neither window: two calls a millisecond apart straddle the
 * boundary. One instant, passed down, makes the two windows exactly adjacent.
 */
export function reportingWindow(
  now: Date = new Date(),
  days: number = REPORTING_WINDOW_DAYS,
): ReportingWindow {
  const span = days * 24 * 60 * 60 * 1000;
  return {
    now,
    start: new Date(now.getTime() - span),
    previousStart: new Date(now.getTime() - span * 2),
  };
}
