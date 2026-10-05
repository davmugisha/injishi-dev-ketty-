import { addDays, lastOfMonth, monthOf, nextMonth, yearOf } from './hr-calendar';

/**
 * Leave as lots (ADR-058, 058-leave AC-LV2 to AC-LV5). Pure: the service reads
 * the ledger, these work out what it means, and the service writes what they
 * say is due.
 *
 * Every credit is a lot (`accrual`, `carry_forward`, `adjustment`), with an
 * optional expiry. A debit (`taken`, `encashed`, `expiry`) names the lot it
 * draws from, and a `reversal` copies the lot of the row it undoes, so a lot's
 * remaining days are its credit plus the rows naming it. A `taken` row funded
 * by accrual the person has not earned yet (December leave booked in June)
 * names no lot; when lots are worked out it draws from the lots valid on its
 * own date, soonest to end first, then oldest. A balance is still the plain sum
 * of every row.
 */

export type LeaveKind = 'accrual' | 'taken' | 'reversal' | 'carry_forward' | 'expiry' | 'adjustment' | 'encashed';
export type LeaveReset = 'yearly' | 'monthly' | 'never';
export type LeaveCarry = 'none' | 'carry' | 'carry_with_expiry';

export interface LedgerItem {
  id: string;
  kind: LeaveKind;
  /** Signed. */
  days: number;
  effectiveOn: string;
  lotId: string | null;
  expiresOn: string | null;
  reversesId: string | null;
  periodKey: string | null;
}

export interface LotState {
  id: string;
  kind: 'accrual' | 'carry_forward' | 'adjustment';
  effectiveOn: string;
  expiresOn: string | null;
  /** The last day it can be spent: the day before its own expiry, or its year's (or month's) end. */
  usableUntil: string | null;
  credit: number;
  remaining: number;
}

const CREDITS = new Set<LeaveKind>(['accrual', 'carry_forward', 'adjustment']);

export function isCredit(kind: LeaveKind): boolean {
  return CREDITS.has(kind);
}

/** Days to a tenth, the ledger's precision, without float drift. */
export function tenth(value: number): number {
  return Math.round(value * 10) / 10;
}

/** The last day a lot can be spent (AC-LV2): its own expiry, or the end of the period its type resets at. */
export function usableUntil(lot: { effectiveOn: string; expiresOn: string | null }, reset: LeaveReset): string | null {
  const own = lot.expiresOn ? addDays(lot.expiresOn, -1) : null;
  const period =
    reset === 'yearly' ? `${yearOf(lot.effectiveOn)}-12-31` : reset === 'monthly' ? lastOfMonth(monthOf(lot.effectiveOn)) : null;
  if (own && period) return own < period ? own : period;
  return own ?? period;
}

/** May this lot fund a day of leave on `date`? */
export function validOn(lot: Pick<LotState, 'effectiveOn' | 'usableUntil'>, date: string): boolean {
  return lot.effectiveOn <= date && (lot.usableUntil === null || lot.usableUntil >= date);
}

/** Soonest to end first (AC-LV4): they expire; then oldest; then by id, so the order never depends on the read. */
function drawOrder(a: LotState, b: LotState): number {
  const ae = a.usableUntil ?? '9999-12-31';
  const be = b.usableUntil ?? '9999-12-31';
  return ae.localeCompare(be) || a.effectiveOn.localeCompare(b.effectiveOn) || a.id.localeCompare(b.id);
}

/**
 * Every lot and what is left of it (AC-LV2), counting the rows effective on or
 * before `asOf` (every row when null): first the rows naming a lot, then each
 * debit naming none, drawn from the lots valid on its own date.
 */
export function lotStates(items: readonly LedgerItem[], reset: LeaveReset, asOf: string | null = null): LotState[] {
  const within = (date: string): boolean => asOf === null || date <= asOf;
  const lots: LotState[] = items
    .filter((i) => isCredit(i.kind) && within(i.effectiveOn))
    .map((i) => ({
      id: i.id,
      kind: i.kind as LotState['kind'],
      effectiveOn: i.effectiveOn,
      expiresOn: i.expiresOn,
      usableUntil: usableUntil(i, reset),
      credit: i.days,
      remaining: i.days,
    }))
    .sort((a, b) => a.effectiveOn.localeCompare(b.effectiveOn) || a.id.localeCompare(b.id));
  const byId = new Map(lots.map((l) => [l.id, l]));

  for (const i of items) {
    if (isCredit(i.kind) || !within(i.effectiveOn) || !i.lotId) continue;
    const lot = byId.get(i.lotId);
    if (lot) lot.remaining = tenth(lot.remaining + i.days);
  }

  // A debit naming no lot, net of the reversals of it.
  const reversedBy = new Map<string, number>();
  for (const i of items) {
    if (i.kind === 'reversal' && i.reversesId && i.lotId === null && within(i.effectiveOn)) {
      reversedBy.set(i.reversesId, tenth((reversedBy.get(i.reversesId) ?? 0) + i.days));
    }
  }
  const unnamed = items
    .filter((i) => (i.kind === 'taken' || i.kind === 'encashed') && i.lotId === null && within(i.effectiveOn))
    .sort((a, b) => a.effectiveOn.localeCompare(b.effectiveOn) || a.id.localeCompare(b.id));
  for (const debit of unnamed) {
    let need = tenth(-(debit.days + (reversedBy.get(debit.id) ?? 0)));
    if (need <= 0) continue;
    for (const lot of lots.filter((l) => l.remaining > 0 && validOn(l, debit.effectiveOn)).sort(drawOrder)) {
      const take = Math.min(need, lot.remaining);
      lot.remaining = tenth(lot.remaining - take);
      need = tenth(need - take);
      if (need <= 0) break;
    }
  }
  return lots;
}

/**
 * Which lots a day of leave draws (AC-LV4): those valid on `date` with days
 * left, soonest to end first, then oldest. Whatever no written lot covers is
 * returned with no lot: accrual the person will have earned by then.
 */
export function drawLots(items: readonly LedgerItem[], reset: LeaveReset, date: string, days: number): { lotId: string | null; days: number }[] {
  const out: { lotId: string | null; days: number }[] = [];
  let need = tenth(days);
  for (const lot of lotStates(items, reset).filter((l) => l.remaining > 0 && validOn(l, date)).sort(drawOrder)) {
    const take = Math.min(need, lot.remaining);
    if (take > 0) out.push({ lotId: lot.id, days: tenth(take) });
    need = tenth(need - take);
    if (need <= 0) break;
  }
  if (need > 0) out.push({ lotId: null, days: need });
  return out;
}

export interface LotType {
  reset: LeaveReset;
  carry: LeaveCarry;
  carryMaxDays: number;
  carryExpiresMonths: number | null;
}

/** A row the planner says is due. `ref` names a planned lot; `lotRef` an expiry of one. */
export interface PlannedRow {
  ref: string;
  kind: 'expiry' | 'carry_forward';
  days: number;
  effectiveOn: string;
  lotId: string | null;
  lotRef: string | null;
  periodKey: string | null;
  expiresOn: string | null;
}

/** `date` plus whole months, clamped to the month's length. */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const last = Number(lastOfMonth(`${year}-${String(month).padStart(2, '0')}`).slice(8));
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/**
 * The expiry and carry rows due up to `today` (AC-LV2, AC-LV3), in date order,
 * each worked out after the ones before it:
 *
 * - a lot's own expiry, on its date, removes what remains in it;
 * - a monthly type, at each month's end, expires the month's lots;
 * - a yearly type, at each year's end, expires every lot of the closing year,
 *   then, when it carries, opens one `carry_forward` lot of the smaller of
 *   their sum and the maximum, expiring after the type's months when it is
 *   `carry_with_expiry`. Only then does the new year's accrual count.
 *
 * Rows already written are never planned again (one expiry per lot, one carry
 * per year), so a rerun plans nothing and a catch up after downtime plans every
 * missed period in date order.
 */
export function planLotEvents(items: readonly LedgerItem[], type: LotType, today: string): PlannedRow[] {
  const working: LedgerItem[] = [...items];
  const planned: PlannedRow[] = [];
  const expired = new Set(items.filter((i) => i.kind === 'expiry' && i.lotId).map((i) => i.lotId as string));
  const carried = new Set(items.filter((i) => i.kind === 'carry_forward').map((i) => i.periodKey));
  let seq = 0;

  const expire = (lot: LotState, on: string): number => {
    if (expired.has(lot.id) || lot.remaining <= 0) {
      expired.add(lot.id);
      return 0;
    }
    const ref = `planned:${(seq += 1)}`;
    const isPlanned = lot.id.startsWith('planned:');
    planned.push({
      ref,
      kind: 'expiry',
      days: tenth(-lot.remaining),
      effectiveOn: on,
      lotId: isPlanned ? null : lot.id,
      lotRef: isPlanned ? lot.id : null,
      periodKey: null,
      expiresOn: null,
    });
    working.push({ id: ref, kind: 'expiry', days: tenth(-lot.remaining), effectiveOn: on, lotId: lot.id, expiresOn: null, reversesId: null, periodKey: null });
    expired.add(lot.id);
    return lot.remaining;
  };

  const credits = (): LedgerItem[] => working.filter((i) => isCredit(i.kind));
  const firstCredit = (): string | null => credits().reduce<string | null>((m, i) => (m === null || i.effectiveOn < m ? i.effectiveOn : m), null);

  // Walk day by day through the event dates only: each pass finds the earliest due event.
  for (let guard = 0; guard < 10_000; guard += 1) {
    const start = firstCredit();
    if (start === null) break;
    const states = lotStates(working, type.reset);
    const ownDue = states
      .filter((l) => l.expiresOn !== null && l.expiresOn <= today && !expired.has(l.id))
      .map((l) => l.expiresOn as string);
    let boundary: string | null = null;
    if (type.reset === 'yearly') {
      for (let y = yearOf(start); `${y + 1}-01-01` <= today; y += 1) {
        const closing = states.filter((l) => yearOf(l.effectiveOn) === y && !expired.has(l.id));
        const needsCarry = type.carry !== 'none' && !carried.has(String(y + 1)) && closing.some((l) => l.remaining > 0);
        if (closing.length > 0 || needsCarry) {
          boundary = `${y + 1}-01-01`;
          break;
        }
      }
    } else if (type.reset === 'monthly') {
      for (let m = monthOf(start); `${nextMonth(m)}-01` <= today; m = nextMonth(m)) {
        if (states.some((l) => monthOf(l.effectiveOn) === m && !expired.has(l.id))) {
          boundary = `${nextMonth(m)}-01`;
          break;
        }
      }
    }
    const nextOwn = ownDue.sort()[0] ?? null;
    if (nextOwn === null && boundary === null) break;

    if (nextOwn !== null && (boundary === null || nextOwn <= boundary)) {
      const asOf = lotStates(working, type.reset, addDays(nextOwn, -1));
      for (const lot of asOf.filter((l) => l.expiresOn === nextOwn && !expired.has(l.id))) expire(lot, nextOwn);
      // A lot whose credit is effective on its own expiry day never had a day to spend.
      for (const lot of states.filter((l) => l.expiresOn === nextOwn && !expired.has(l.id))) expired.add(lot.id);
      continue;
    }

    const on = boundary as string;
    const closingDay = addDays(on, -1);
    const asOf = lotStates(working, type.reset, closingDay);
    if (type.reset === 'yearly') {
      const y = yearOf(closingDay);
      let sum = 0;
      for (const lot of asOf.filter((l) => yearOf(l.effectiveOn) === y && !expired.has(l.id))) sum = tenth(sum + expire(lot, on));
      for (const lot of states.filter((l) => yearOf(l.effectiveOn) === y)) expired.add(lot.id);
      const key = String(y + 1);
      if (type.carry !== 'none' && !carried.has(key)) {
        carried.add(key);
        const days = tenth(Math.min(sum, type.carryMaxDays));
        if (days > 0) {
          const ref = `planned:${(seq += 1)}`;
          const expiresOn =
            type.carry === 'carry_with_expiry' && type.carryExpiresMonths ? addMonths(on, type.carryExpiresMonths) : null;
          planned.push({ ref, kind: 'carry_forward', days, effectiveOn: on, lotId: null, lotRef: null, periodKey: key, expiresOn });
          working.push({ id: ref, kind: 'carry_forward', days, effectiveOn: on, lotId: null, expiresOn, reversesId: null, periodKey: key });
        }
      }
    } else {
      const m = monthOf(closingDay);
      for (const lot of asOf.filter((l) => monthOf(l.effectiveOn) === m && !expired.has(l.id))) expire(lot, on);
      for (const lot of states.filter((l) => monthOf(l.effectiveOn) === m)) expired.add(lot.id);
    }
  }
  return planned;
}

/** Full years from `from` to `to` (both dates). */
export function completedYears(from: string, to: string): number {
  if (to < from) return 0;
  const years = yearOf(to) - yearOf(from);
  return to.slice(5) >= from.slice(5) ? years : years - 1;
}

/** Full months from `from` to `to`. */
export function completedMonths(from: string, to: string): number {
  if (to < from) return 0;
  const months = (yearOf(to) - yearOf(from)) * 12 + (Number(to.slice(5, 7)) - Number(from.slice(5, 7)));
  return to.slice(8) >= from.slice(8) ? months : months - 1;
}

export interface SeniorityType {
  yearlyEntitlementDays: number | null;
  seniorityEveryYears?: number | null;
  seniorityExtraDays?: number | null;
  seniorityCapDays?: number | null;
}

/**
 * A year's entitlement (AC-LV5): the base, plus M days for every N years of
 * service completed by the year's first day, the extra capped.
 */
export function entitlementFor(type: SeniorityType, hiredOn: string, year: number): number | null {
  if (type.yearlyEntitlementDays === null) return null;
  if (!type.seniorityEveryYears || !type.seniorityExtraDays) return type.yearlyEntitlementDays;
  const steps = Math.floor(completedYears(hiredOn, `${year}-01-01`) / type.seniorityEveryYears);
  const extra = steps * type.seniorityExtraDays;
  const cap = type.seniorityCapDays ?? null;
  return tenth(type.yearlyEntitlementDays + (cap !== null ? Math.min(extra, cap) : extra));
}

export interface EligibilityType {
  name: string;
  eligibleSex: 'female' | 'male' | null;
  minServiceMonths: number;
  oncePerEmployment: boolean;
}

/** Why a person may not take this leave (AC-LV6), in words naming the rule; null when they may. */
export function eligibilityRefusal(
  type: EligibilityType,
  person: { sex: 'female' | 'male' | null; serviceFrom: string },
  startsOn: string,
  takenBefore: boolean,
): string | null {
  if (type.eligibleSex && person.sex !== type.eligibleSex) {
    return `${type.name} is for ${type.eligibleSex === 'female' ? 'women' : 'men'}${person.sex === null ? ', and this file records no sex' : ''}.`;
  }
  if (type.minServiceMonths > 0 && completedMonths(person.serviceFrom, startsOn) < type.minServiceMonths) {
    return `${type.name} needs ${type.minServiceMonths} month${type.minServiceMonths === 1 ? '' : 's'} of service by its first day.`;
  }
  if (type.oncePerEmployment && takenBefore) {
    return `${type.name} is taken once per employment, and this person has taken it.`;
  }
  return null;
}

export interface RestrictionRule {
  id: string;
  title: string;
  fromDate: string;
  toDate: string;
  departmentId: string | null;
  jobPositionIds: readonly string[];
  typeMode: 'all' | 'only' | 'except';
  leaveTypeIds: readonly string[];
}

/**
 * The restricted period a request falls under (AC-LV9), if any: its dates
 * overlap, the person is in its department and one of its positions (each
 * when named, together), and its type mode covers the type. Statutory types
 * never fall under one.
 */
export function restrictionFor(
  periods: readonly RestrictionRule[],
  ask: { startsOn: string; endsOn: string; leaveTypeId: string; statutory: boolean; departmentIds: readonly string[]; jobPositionId: string | null },
): RestrictionRule | null {
  if (ask.statutory) return null;
  return (
    periods.find((p) => {
      if (p.toDate < ask.startsOn || p.fromDate > ask.endsOn) return false;
      if (p.departmentId && !ask.departmentIds.includes(p.departmentId)) return false;
      if (p.jobPositionIds.length > 0 && (!ask.jobPositionId || !p.jobPositionIds.includes(ask.jobPositionId))) return false;
      if (p.typeMode === 'only') return p.leaveTypeIds.includes(ask.leaveTypeId);
      if (p.typeMode === 'except') return !p.leaveTypeIds.includes(ask.leaveTypeId);
      return true;
    }) ?? null
  );
}

/**
 * The days a worked holiday or day off earns (AC-LV8): a whole day at the
 * threshold, half a day at half of it, none below.
 */
export function compensatoryDays(workedMinutes: number, thresholdMinutes: number): number {
  if (workedMinutes >= thresholdMinutes) return 1;
  if (workedMinutes * 2 >= thresholdMinutes) return 0.5;
  return 0;
}
