/**
 * "2h", "1d", "3w" — the timestamp on a thread row and a notification row.
 *
 * Frame R13 prints exactly this: `2h`, `1d`, `Jul 01`. The first two are
 * relative and the third is not, and the boundary between them is the decision
 * this file makes: **relative up to four weeks, and nothing beyond**.
 *
 * Past four weeks a relative stamp stops helping. "8w" is not a date anybody
 * converts in their head, and the frame's own third row admits as much by
 * switching to "Jul 01". So `relativeTime` returns `undefined` past the
 * boundary and the caller prints a date instead — which it has to do through
 * `Intl` and the active locale, not through this function, because a month name
 * is language, and this file returns message KEYS rather than text so that it
 * can be tested without mounting a provider.
 *
 * Pure, and takes `now` as an argument. A helper that reads the clock itself is
 * a helper whose tests are flaky on the last millisecond of an hour.
 */
import type { MessageKey } from '@/i18n/messages';

export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
export const WEEK_MS = 7 * DAY_MS;

/** Past this, a relative stamp is worse than a date. See the header. */
export const RELATIVE_LIMIT_MS = 4 * WEEK_MS;

export interface RelativeTime {
  key: MessageKey;
  params?: Record<string, number>;
}

/**
 * The relative stamp for an instant, or `undefined` when it is too old to be
 * one. Anything in the future reads as "now": a device clock a few seconds
 * behind the fixture should not print "in 3 minutes".
 */
export function relativeTime(at: number, now: number): RelativeTime | undefined {
  const elapsed = now - at;
  if (elapsed < MINUTE_MS) return { key: 'inbox.timeNow' };
  if (elapsed < HOUR_MS) {
    return { key: 'inbox.timeMinutes', params: { minutes: Math.floor(elapsed / MINUTE_MS) } };
  }
  if (elapsed < DAY_MS) {
    return { key: 'inbox.timeHours', params: { hours: Math.floor(elapsed / HOUR_MS) } };
  }
  if (elapsed < WEEK_MS) {
    return { key: 'inbox.timeDays', params: { days: Math.floor(elapsed / DAY_MS) } };
  }
  if (elapsed < RELATIVE_LIMIT_MS) {
    return { key: 'inbox.timeWeeks', params: { weeks: Math.floor(elapsed / WEEK_MS) } };
  }
  return undefined;
}

/**
 * The two instants fall on different calendar DAYS, so a conversation owes a
 * separator between them.
 *
 * Local, deliberately, and by calendar day rather than by elapsed hours: 23:50
 * and 00:10 are twenty minutes apart and are two different days to everyone who
 * reads them, which is the whole reason a chat draws the line.
 */
export function sameDay(a: number, b: number): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
}

export type DayLabel = { key: MessageKey } | { date: number };

/** Today, Yesterday, or the date itself — what a day separator says. */
export function dayLabel(at: number, now: number): DayLabel {
  if (sameDay(at, now)) return { key: 'inbox.dayToday' };
  if (sameDay(at, now - DAY_MS)) return { key: 'inbox.dayYesterday' };
  return { date: at };
}
