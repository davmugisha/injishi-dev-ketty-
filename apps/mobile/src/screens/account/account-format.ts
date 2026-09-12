/**
 * Every sentence Account builds out of a fixture value, as a pure function.
 *
 * Here rather than inline in the screens for the reason `broker-format.ts`
 * gives: the same fact is printed in more than one place and has to read the
 * same way each time — a plan name is a row value on Account and a heading on
 * the subscription screen; a session's last-seen day is a row and a warning.
 * Keys rather than strings, and `Translate` passed in rather than reached for,
 * so all of it is testable without rendering and the Kinyarwanda column is
 * exercised by the same call.
 */
import { formatDay } from '@/data/search';
import type { MessageKey, Translate } from '@/i18n/i18n';
import type { DeviceSession, PlanId, StaffState } from './account-fixtures';

/**
 * `14 Jul 2026`. `formatDay` gives the day and the month, which is right
 * everywhere it is used — a booking, a rent due date, a shift — because those
 * are all inside the current year. A TIN verification and a plan renewal are
 * not, and a date without a year is the one that gets misread.
 */
export function formatLongDay(iso: string, t: Translate): string {
  return `${formatDay(iso, t)} ${iso.slice(0, 4)}`;
}

/** The plan's display name. One key per plan, so RW gets its own word. */
export function planKey(plan: PlanId): MessageKey {
  return `plan.${plan}` as MessageKey;
}

/** What a staff row's state is called, and how it is toned. */
export function staffStateKey(state: StaffState): MessageKey {
  return `staff.state.${state}` as MessageKey;
}

export function staffStateTone(state: StaffState): 'success' | 'warning' | 'neutral' {
  if (state === 'active') return 'success';
  if (state === 'invited') return 'warning';
  return 'neutral';
}

/**
 * How many days ago a session was last used.
 *
 * `today` is passed rather than read off the clock so a test asserts a number
 * rather than whatever day it happens to run on — the same reason every other
 * date helper in this app takes its `today`.
 */
export function daysSince(iso: string, today: string): number {
  const then = Date.parse(`${iso}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(then) || Number.isNaN(now)) return 0;
  return Math.max(0, Math.round((now - then) / 86_400_000));
}

/**
 * The line under a device: where it was and how long ago.
 *
 * Three bands rather than a raw count, because "today" and "16 days ago" ask a
 * reader for different decisions and a bare number makes them do the comparison
 * themselves. F-S12 §9 names the case this exists for — a stolen session — and
 * the one a person is most likely to spot is the one they have not used in a
 * while.
 */
export function sessionMeta(session: DeviceSession, today: string, t: Translate): string {
  const days = daysSince(session.lastSeen, today);
  const when =
    days === 0
      ? t('security.seenToday')
      : days === 1
        ? t('security.seenYesterday')
        : t('security.seenDaysAgo', { days });
  return `${session.place} · ${when}`;
}

/**
 * Whether a session is old enough to be worth a second look.
 *
 * Not an alarm — an unused device is usually just an unused device — so this
 * only decides whether the row carries a quiet marker. Two weeks is the band
 * where "I was in Rubavu last month" stops being the obvious explanation.
 */
export const STALE_SESSION_DAYS = 14;

export function isStaleSession(session: DeviceSession, today: string): boolean {
  return !session.current && daysSince(session.lastSeen, today) >= STALE_SESSION_DAYS;
}
