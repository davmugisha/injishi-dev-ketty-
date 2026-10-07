/**
 * The calendar arithmetic frames R12, R15, R17 and R18 need, in one place.
 *
 * **Dates are `YYYY-MM-DD` strings, never `Date` objects**, the same rule
 * `CalendarRange` states and for the same reason: a `Date` is an instant and an
 * instant carries a timezone, but a rent due date and a move-out date are
 * calendar days. `new Date('2026-08-01')` parses as UTC midnight and prints as
 * 31 July anywhere west of Greenwich, which is how a notice gets filed a day
 * early. Every comparison here is a string comparison on a format that sorts
 * correctly by construction, and the only `Date` used is a UTC one built from
 * the parts, purely to do day arithmetic.
 *
 * Nothing here reads the clock. `today` is a parameter everywhere, so a screen
 * passes `todayIso()` once and a test passes a fixed day and asserts on an
 * exact string.
 */
import { type MessageKey, type Translate } from '@/i18n/i18n';

/** Midday UTC, so a day's arithmetic can never tip over a boundary. */
function utc(iso: string): number {
  return Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10), 12);
}

function toIso(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
}

export function addDays(iso: string, days: number): string {
  return toIso(utc(iso) + days * 86_400_000);
}

/**
 * Whole calendar months, clamped to the end of the target month: one month
 * after 31 January is 28 February, not 3 March. `Date` rolls over silently,
 * which on a lease end date is a term a month longer than anyone agreed.
 */
export function addMonths(iso: string, months: number): string {
  const y = +iso.slice(0, 4);
  const m = +iso.slice(5, 7) - 1;
  const d = +iso.slice(8, 10);
  const target = new Date(Date.UTC(y, m + months, 1, 12));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12));
  target.setUTCDate(Math.min(d, lastDay.getUTCDate()));
  return toIso(target.getTime());
}

/**
 * The length of a term in months — the number frame R16 prints as
 * "TERM 12 months".
 *
 * A term is named in months but its two fixtures disagree about how they write
 * the end: the Ingoro lease runs 1 Sep 2026 to 31 Aug 2027 (the day BEFORE the
 * anniversary, so twelve months) and the Nyamirambo one runs 1 Feb 2025 to
 * 1 Feb 2027 (ON the anniversary, so twenty-four). A raw month subtraction
 * reports eleven for the first, and adding one to compensate reports
 * twenty-five for the second. Neither convention is wrong and both are in the
 * data, so the count is not computed from the parts at all:
 *
 * take the raw month difference, ask what an `n`-month term starting on `from`
 * would actually end on, and keep whichever of `n` and `n + 1` lands closer to
 * the end this lease really has. That answers both conventions with one rule
 * and needs no flag on the record saying which one was used.
 */
export function monthsBetween(from: string, to: string): number {
  const raw = (+to.slice(0, 4) - +from.slice(0, 4)) * 12 + (+to.slice(5, 7) - +from.slice(5, 7));
  const missBy = (n: number) => Math.abs(daysBetween(addDays(addMonths(from, n), -1), to));
  return missBy(raw + 1) < missBy(raw) ? raw + 1 : raw;
}

/** Whole days from `from` to `to`. Negative when `to` is the earlier day. */
export function daysBetween(from: string, to: string): number {
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/**
 * `2026-09-04` -> `4 September 2026`, in the reader's own month names.
 *
 * **The month is not abbreviated, and that is a Kinyarwanda decision.** The
 * Kinyarwanda names cut to `Ukw`, `Ugu` and `Uku` for October, November and
 * December, and to `Kam` and `Kan` for June and August. Those are distinct
 * strings and confusable words, and this formatter prints rent due dates,
 * move-out dates and contract terms — the three places in the app where reading
 * the wrong month costs someone money. Kinyarwanda has no settled three-letter
 * month convention to borrow, and inventing one for a legal date is not this
 * session's call. The cost is a longer string, which every layout here has room
 * for; the alternative cost is a notice filed a month early.
 *
 * **`formatDay` in `@/data/search` still abbreviates, and that is not drift to
 * be tidied away.** It fills the Explore search pill — "Kigali · 4 Sep – 7 Sep
 * · 2" — which is a fixed-width control that full month names overflow. Two
 * contexts, two constraints, two formatters. The Kinyarwanda ambiguity is real
 * there too, so the pill needs a fix of its own (a shorter date form, or a
 * wider pill); replacing its formatter with this one only moves the problem
 * from a misread month to a truncated one.
 */
export function formatFullDay(iso: string, t: Translate): string {
  const month = t(`calendar.m${Number(iso.slice(5, 7))}` as MessageKey);
  return `${Number(iso.slice(8, 10))} ${month} ${iso.slice(0, 4)}`;
}

/** `2026-09-04` -> `September 2026`, in the reader's own month names. */
export function formatMonthYear(iso: string, t: Translate): string {
  return `${t(`calendar.m${Number(iso.slice(5, 7))}` as MessageKey)} ${iso.slice(0, 4)}`;
}

/**
 * How far off a due date is, said the way a person would.
 *
 * The frames print "Due Aug 01, 2026 · 4 weeks", which is only half the story:
 * the same card has to read correctly when the date has passed, and "4 weeks"
 * on an overdue charge is the sort of copy that gets someone's rent stamped
 * late. So there are five cases and each is its own key — singular and plural
 * are separate keys because Kinyarwanda does not pluralise the way English
 * does, which is the rule `moveOut.dayFromToday` already follows.
 */
export function dueCaption(dueOn: string, today: string, t: Translate): string {
  const days = daysBetween(today, dueOn);
  if (days === 0) return t('tenant.dueToday');
  if (days < 0) {
    const late = -days;
    return late === 1
      ? t('tenant.overdueDay', { count: 1 })
      : t('tenant.overdueDays', { count: late });
  }
  if (days === 1) return t('tenant.dueInDay', { count: 1 });
  if (days < 14) return t('tenant.dueInDays', { count: days });
  return t('tenant.dueInWeeks', { count: Math.round(days / 7) });
}

/**
 * The word a rent period's status pill prints, as one string for a screen
 * reader label.
 *
 * `PaymentStatus` draws the same words as a badge, and a label that wraps a row
 * replaces what is inside it: a row labelled "September 2026" alone never told
 * a VoiceOver user whether September was paid or overdue (mobile audit
 * 2026-10-05, TN-17). The keys are the ones `PaymentStatus` reads, so the two
 * cannot disagree.
 */
const RENT_STATUS_WORD: Record<'paid' | 'due' | 'overdue', MessageKey> = {
  paid: 'payment.paid',
  due: 'payment.due',
  overdue: 'payment.overdue',
};

export function rentStatusWord(status: 'paid' | 'due' | 'overdue', t: Translate): string {
  return t(RENT_STATUS_WORD[status]);
}

/**
 * The caption under a move-out date: how much notice it actually gives, against
 * how much the contract asks for. Both numbers, because FL23 Path A shows the
 * minimum and does not enforce it, and a tenant choosing a short date has to be
 * able to see by how much.
 */
export function noticeCaption(
  chosen: string,
  today: string,
  noticeDays: number,
  t: Translate,
): string {
  const days = daysBetween(today, chosen);
  const given = days === 1 ? t('tenant.noticeDay', { count: 1 }) : t('tenant.noticeDays', { count: days });
  return days < noticeDays
    ? t('tenant.noticeShort', { given, required: noticeDays })
    : t('tenant.noticeMet', { given });
}
