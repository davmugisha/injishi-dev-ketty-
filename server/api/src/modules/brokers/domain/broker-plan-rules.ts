import { BROKER_DISTRICT_CHANGE_DAYS, BROKER_PLAN_GRACE_DAYS, type BrokerPlanCode } from '@injishi/contracts';

/**
 * The rules of a broker's plan (2026-10-23), as pure functions so each one
 * is tested on its own: which plan is in force today, what an upgrade costs,
 * and when a district may move. Dates are Kigali calendar days, `YYYY-MM-DD`.
 */

/** The smallest charge a mobile money rail takes. */
export const MIN_PLAN_CHARGE_RWF = 100;

function noon(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}

export function addDays(date: string, days: number): string {
  const d = noon(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** One month on, clamped to the month's length: 31 Jan → 28 Feb. */
export function addMonth(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const year = m === 12 ? y + 1 : y;
  const month = m === 12 ? 1 : m + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((noon(to).getTime() - noon(from).getTime()) / 86_400_000);
}

/** A plan month as it is checked before it is written: it starts no earlier than today and ends after it starts. */
export function periodProblem(start: string, end: string, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return 'A plan month needs real dates.';
  if (start < today) return 'A plan month cannot start in the past.';
  if (end <= start) return 'A plan month must end after it starts.';
  return null;
}

/** The paid plan a broker holds, as far as the scope rule needs it. */
export interface LivePlan {
  plan: Exclude<BrokerPlanCode, 'district'>;
  status: 'active' | 'past_due';
  provinceId: number | null;
  periodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export type EffectiveScope =
  | { plan: 'district'; districtId: number | null }
  | { plan: 'province'; provinceId: number }
  | { plan: 'country' };

/**
 * What a broker sees today.
 *
 * A paid plan works through its month, and for three days after it while a
 * renewal is unpaid (or before the hourly sweep has caught up). A plan the
 * broker asked to end stops on its last day. Anything else is District: the
 * broker's own district, or nothing until they choose one. Data is never
 * removed; only what is shown narrows.
 */
export function effectiveScope(live: LivePlan | null, homeDistrictId: number | null, today: string): EffectiveScope {
  const district: EffectiveScope = { plan: 'district', districtId: homeDistrictId };
  if (!live) return district;
  if (live.cancelAtPeriodEnd && today >= live.periodEnd) return district;
  if (today >= addDays(live.periodEnd, BROKER_PLAN_GRACE_DAYS)) return district;
  if (live.plan === 'country') return { plan: 'country' };
  return live.provinceId === null ? district : { plan: 'province', provinceId: live.provinceId };
}

/** The last day a past-due plan still works. */
export function graceUntil(periodEnd: string): string {
  return addDays(periodEnd, BROKER_PLAN_GRACE_DAYS - 1);
}

/**
 * What an upgrade costs today: the new month at full price, less what is left
 * of the month already paid for. Never below what a rail will take.
 */
export function upgradeCharge(
  newPriceRwf: number,
  current: { priceRwf: number; periodStart: string; periodEnd: string; status: 'active' | 'past_due' } | null,
  today: string,
): number {
  let credit = 0;
  if (current && current.status === 'active' && current.priceRwf > 0) {
    const total = daysBetween(current.periodStart, current.periodEnd);
    const left = Math.max(0, Math.min(total, daysBetween(today, current.periodEnd)));
    credit = total > 0 ? Math.floor((current.priceRwf * left) / total) : 0;
  }
  return Math.max(newPriceRwf - credit, MIN_PLAN_CHARGE_RWF);
}

/** On the free plan, the first day the home district may move again; null when it may now. */
export function districtChangeFrom(changedAt: Date | null, now: Date, kigaliDay: (d: Date) => string): string | null {
  if (!changedAt) return null;
  const from = addDays(kigaliDay(changedAt), BROKER_DISTRICT_CHANGE_DAYS);
  return kigaliDay(now) >= from ? null : from;
}
