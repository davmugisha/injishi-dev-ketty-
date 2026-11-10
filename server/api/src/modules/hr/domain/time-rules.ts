import type { AttendancePendingReason } from '@injishi/contracts';

import { addDays, eachDate } from './hr-calendar';

/**
 * Time's rules, pure (ADR-058, 058-time): which roster entry a clock in links
 * to (AC-TM15), the figures a closed record carries (AC-TM7, AC-TM8), what kind
 * of day a date is (AC-TM7, AC-TM12), which step a rotation is on (AC-TM3),
 * how far a phone was from its branch (AC-TM9), and what a branch's clock-in
 * rules make of a person clocking themselves in.
 *
 * Every figure is whole minutes, floored, so two readers of one record can
 * never disagree by a rounding.
 */

/** A branch's attendance policy, or the business default, or these (058-time value sourcing). */
export interface AttendanceRules {
  graceInMinutes: number;
  graceOutMinutes: number;
  overtimeCutoffMinutes: number | null;
  overtimeAutoApprove: boolean;
  overtimeMinMinutes: number;
  linkWindowMinutes: number;
  staleOpenHours: number;
  defaultShiftMinutes: number;
  /** A worked holiday or day off earns a whole compensatory day from this many minutes, half from half of it (058-leave AC-LV8). */
  compensationThresholdMinutes: number;
}

/** No grace, no cutoff, nothing approved by itself: what a business that set nothing gets. */
export const DEFAULT_ATTENDANCE_RULES: AttendanceRules = {
  graceInMinutes: 0,
  graceOutMinutes: 0,
  overtimeCutoffMinutes: null,
  overtimeAutoApprove: false,
  overtimeMinMinutes: 0,
  linkWindowMinutes: 180,
  staleOpenHours: 16,
  defaultShiftMinutes: 480,
  compensationThresholdMinutes: 360,
};

const MINUTE = 60_000;

function minutes(ms: number): number {
  return Math.floor(ms / MINUTE);
}

// --- The link rule (AC-TM15) -------------------------------------------------------

export interface EntryWindow {
  startsAt: Date;
  endsAt: Date;
}

/**
 * The scheduled entry a clock in belongs to: the one whose window, from the
 * policy's link window before its start to its end, holds the instant. When
 * two do, the nearest start wins, so a split shift links to the half the
 * person arrived for.
 */
export function linkEntry<T extends EntryWindow>(clockInAt: Date, entries: readonly T[], linkWindowMinutes: number): T | null {
  const at = clockInAt.getTime();
  let best: T | null = null;
  let bestGap = Infinity;
  for (const entry of entries) {
    const opens = entry.startsAt.getTime() - linkWindowMinutes * MINUTE;
    if (at < opens || at > entry.endsAt.getTime()) continue;
    const gap = Math.abs(entry.startsAt.getTime() - at);
    if (gap < bestGap) {
      best = entry;
      bestGap = gap;
    }
  }
  return best;
}

// --- Close time figures (AC-TM7, AC-TM8) ------------------------------------------------

export interface ShiftForClose {
  startsAt: Date;
  endsAt: Date;
  breakMinutes: number;
  /** Overtime counts past this much work; null: the shift's length less its break. */
  minWorkMinutes: number | null;
}

export interface CloseFigures {
  lateMinutes: number | null;
  earlyMinutes: number | null;
  workedMinutes: number;
  overtimeMinutes: number | null;
  /** What pay may count: the policy's decision, or null for a person to make (AC-TM8). */
  approvedOvertimeMinutes: number | null;
}

/**
 * The figures of a record as it closes.
 *
 * - Late: clock in minus the start, when the clock in is later than the start
 *   plus the grace; counted from the start, not from the grace.
 * - Early: the end minus clock out, when clock out is earlier than the end less
 *   the grace.
 * - Worked: out minus in, less the shift's break, never below zero.
 * - Overtime: what was worked after the later of the clock in and the start,
 *   past the minimum work time (or the shift's length less its break); arriving
 *   early is never overtime; never negative; capped at the policy's cutoff.
 *
 * With no shift, a record has worked minutes only. A record the sweep closed
 * (`autoClosed`) earns no overtime until somebody puts its times right
 * (AC-TM4): its times are a guess.
 */
export function closeFigures(input: {
  clockInAt: Date;
  clockOutAt: Date;
  shift: ShiftForClose | null;
  rules: AttendanceRules;
  autoClosed?: boolean;
}): CloseFigures {
  const { clockInAt, clockOutAt, shift, rules } = input;
  const inAt = clockInAt.getTime();
  const outAt = clockOutAt.getTime();
  const breakMs = (shift?.breakMinutes ?? 0) * MINUTE;
  const workedMinutes = Math.max(0, minutes(outAt - inAt - breakMs));
  if (!shift) {
    return { lateMinutes: null, earlyMinutes: null, workedMinutes, overtimeMinutes: null, approvedOvertimeMinutes: null };
  }
  const start = shift.startsAt.getTime();
  const end = shift.endsAt.getTime();
  const lateMinutes = inAt > start + rules.graceInMinutes * MINUTE ? minutes(inAt - start) : 0;
  const earlyMinutes = outAt < end - rules.graceOutMinutes * MINUTE ? minutes(end - outAt) : 0;

  let overtimeMinutes = 0;
  if (!input.autoClosed) {
    const from = Math.max(inAt, start);
    const workedFromStart = minutes(outAt - from - breakMs);
    const threshold = shift.minWorkMinutes ?? minutes(end - start - breakMs);
    overtimeMinutes = Math.max(0, workedFromStart - threshold);
    if (rules.overtimeCutoffMinutes !== null) overtimeMinutes = Math.min(overtimeMinutes, rules.overtimeCutoffMinutes);
  }

  let approvedOvertimeMinutes: number | null;
  if (overtimeMinutes === 0) approvedOvertimeMinutes = 0;
  else if (rules.overtimeAutoApprove && overtimeMinutes >= rules.overtimeMinMinutes) approvedOvertimeMinutes = overtimeMinutes;
  else approvedOvertimeMinutes = null;

  return { lateMinutes, earlyMinutes, workedMinutes, overtimeMinutes, approvedOvertimeMinutes };
}

// --- Holidays, weekly days off and the kind of a day (AC-TM7, AC-TM12) ----------------------

export interface OrgHolidayRule {
  propertyId: string | null;
  fromDate: string;
  toDate: string;
  recurringYearly: boolean;
}

export interface WeeklyOffRule {
  propertyId: string | null;
  /** 0 Sunday to 6 Saturday. */
  weekday: number;
  /** Empty: every week; else which weeks of the month, 1 to 5. */
  weeks: readonly number[];
}

function noon(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}

/** A holiday of the business that applies to this branch on this date, once or every year. */
export function isOrgHoliday(date: string, propertyId: string | null, holidays: readonly OrgHolidayRule[]): boolean {
  return holidays.some((h) => {
    if (h.propertyId !== null && h.propertyId !== propertyId) return false;
    if (!h.recurringYearly) return date >= h.fromDate && date <= h.toDate;
    // Every year: the same month and day span, which may cross New Year.
    const md = date.slice(5);
    const from = h.fromDate.slice(5);
    const to = h.toDate.slice(5);
    return from <= to ? md >= from && md <= to : md >= from || md <= to;
  });
}

/**
 * The weekly days off that apply to a branch: its own rows, else the
 * business's, else Saturday and Sunday (058-time value sourcing). Slice 1
 * counted Monday to Friday, which the default keeps.
 */
export function weeklyOffsFor(propertyId: string | null, rows: readonly WeeklyOffRule[]): WeeklyOffRule[] {
  const own = propertyId ? rows.filter((r) => r.propertyId === propertyId) : [];
  if (own.length > 0) return own;
  const business = rows.filter((r) => r.propertyId === null);
  if (business.length > 0) return business;
  return [
    { propertyId: null, weekday: 6, weeks: [] },
    { propertyId: null, weekday: 0, weeks: [] },
  ];
}

/** Is this date a weekly day off under these rules? A week of the month is days 1 to 7, 8 to 14, and so on. */
export function isWeeklyOff(date: string, rules: readonly WeeklyOffRule[]): boolean {
  const d = noon(date);
  const weekday = d.getUTCDay();
  const weekOfMonth = Math.ceil(d.getUTCDate() / 7);
  return rules.some((r) => r.weekday === weekday && (r.weeks.length === 0 || r.weeks.includes(weekOfMonth)));
}

export type DayKind = 'weekday' | 'weekly_off' | 'public_holiday';

/** A national or business holiday, else a weekly day off for the branch, else a weekday. */
export function dayKindOf(
  date: string,
  context: {
    propertyId: string | null;
    nationalHolidays: ReadonlySet<string>;
    orgHolidays: readonly OrgHolidayRule[];
    weeklyOffs: readonly WeeklyOffRule[];
  },
): DayKind {
  if (context.nationalHolidays.has(date) || isOrgHoliday(date, context.propertyId, context.orgHolidays)) {
    return 'public_holiday';
  }
  if (isWeeklyOff(date, weeklyOffsFor(context.propertyId, context.weeklyOffs))) return 'weekly_off';
  return 'weekday';
}

// --- Rotations (AC-TM3) ---------------------------------------------------------------------

export interface RotationRuleSpec {
  rule: 'every_n_days' | 'weekly' | 'monthly';
  ruleValue: number;
}

/**
 * How many rule boundaries pass from `startsOn` (exclusive) to `date`
 * (inclusive): every N days, each time a given weekday arrives, or each time a
 * given day of the month arrives.
 */
export function boundariesPassed(startsOn: string, date: string, spec: RotationRuleSpec): number {
  if (date <= startsOn) return 0;
  const days = Math.round((noon(date).getTime() - noon(startsOn).getTime()) / 86_400_000);
  if (spec.rule === 'every_n_days') return Math.floor(days / spec.ruleValue);
  let count = 0;
  for (const d of eachDate(addDays(startsOn, 1), date)) {
    const at = noon(d);
    if (spec.rule === 'weekly' ? at.getUTCDay() === spec.ruleValue : at.getUTCDate() === spec.ruleValue) count += 1;
  }
  return count;
}

/** The step a person is on, on a date: the starting step advanced once per boundary, wrapping round. */
export function rotationStepOn(
  date: string,
  assignment: { startsOn: string; startStep: number },
  pattern: RotationRuleSpec & { stepCount: number },
): number {
  const advanced = assignment.startStep + boundariesPassed(assignment.startsOn, date, pattern);
  return ((advanced % pattern.stepCount) + pattern.stepCount) % pattern.stepCount;
}

// --- Distance (AC-TM9) ---------------------------------------------------------------------

const EARTH_RADIUS_M = 6_371_008.8;

/** Great circle distance in metres, rounded, between two points in degrees. */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h))));
}

/** The largest accuracy a phone may report and still be trusted (AC-TM9). */
const MAX_TRUSTED_ACCURACY_M = 200;

/**
 * Whether a phone punch validates itself: a location was sent, the branch has
 * coordinates, the accuracy is good enough and the point is inside the radius.
 * Anything else is recorded, never refused, for a person to validate.
 */
export function phonePunchVerdict(input: {
  point: { lat: number; lng: number; accuracyM: number | null } | null;
  branch: { lat: number; lng: number } | null;
  radiusM: number;
}): PunchVerdict {
  if (!input.point) return { validated: false, distanceM: null, reason: 'No location was sent.', code: 'no_location' };
  if (!input.branch) {
    return { validated: false, distanceM: null, reason: 'The branch has no location set.', code: 'no_branch_location' };
  }
  const distanceM = distanceMeters(input.point, input.branch);
  if (input.point.accuracyM === null || input.point.accuracyM > MAX_TRUSTED_ACCURACY_M) {
    return {
      validated: false,
      distanceM,
      reason: 'The phone could not tell closely enough where it was.',
      code: 'poor_accuracy',
    };
  }
  if (distanceM > input.radiusM) {
    return { validated: false, distanceM, reason: `It was ${distanceM} m from the branch.`, code: 'outside_fence' };
  }
  return { validated: true, distanceM, reason: null, code: null };
}

export interface PunchVerdict {
  validated: boolean;
  distanceM: number | null;
  reason: string | null;
  /**
   * Why it waits, as stored on the record (mobile spec 0003, D-ao); null when it validated itself.
   * The clock-in rules decide on this, never on the sentence.
   */
  code: LocationPendingReason | null;
}

/** The location reasons of `phonePunchVerdict`, as stored on the record (mobile spec 0003, D-ao). */
export type LocationPendingReason = Exclude<AttendancePendingReason, 'late_sync'>;

/**
 * Every reason a phone punch waits, in the stored order: the location reason
 * first, then `late_sync` for one that arrived late. The first is the one the
 * record keeps; the flagged event carries them all.
 */
export function punchPendingReasons(input: {
  location: LocationPendingReason | null;
  lateSync: boolean;
}): AttendancePendingReason[] {
  return [...(input.location ? [input.location] : []), ...(input.lateSync ? (['late_sync'] as const) : [])];
}

/**
 * Whether a phone clock out that found nothing open replaces the end the sweep
 * gave the person's latest record (mobile spec 0003, D-ap): the record is one
 * the sweep closed (`auto_closed`), the sweep ran after the tap (the record's
 * last change), and the tap came after the clock in. Otherwise the phone was
 * simply not clocked in.
 */
export function takesLateClockOut(
  record: { status: string; autoClosed: boolean; updatedAt: Date; clockInAt: Date },
  at: Date,
): boolean {
  return (
    record.status === 'closed' &&
    record.autoClosed &&
    record.updatedAt.getTime() > at.getTime() &&
    at.getTime() > record.clockInAt.getTime()
  );
}

// --- Clock-in rules: how a branch's staff clock themselves in ----------------------------

export type ClockMode = 'anywhere' | 'at_work' | 'entrance';

/** "350 m", "3.2 km": a distance as a person says it. */
export function distanceWords(m: number): string {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

/** "07:05" in Kigali, which keeps UTC+2 all year. */
export function kigaliClock(at: Date): string {
  return new Date(at.getTime() + 2 * 3_600_000).toISOString().slice(11, 16);
}

export type SelfPunchDecision =
  | { allow: true; validated: boolean; reason: string | null }
  /** Refused, with the sentence for the person; `far` marks a refusal for being away from work. */
  | { allow: false; reason: string; far: boolean };

/**
 * What a branch's rule makes of a person clocking themselves in or out from
 * their phone. A fresh code scanned off the entrance tablet is proof in every
 * mode, unless the phone itself says it is far away, as a photo of the code sent
 * home would. A clock out is never refused: refusing one would leave the person
 * clocked in, so the doubtful ones wait for HR instead.
 */
export function selfPunchDecision(input: {
  mode: ClockMode;
  direction: 'in' | 'out';
  scanned: boolean;
  verdict: PunchVerdict;
}): SelfPunchDecision {
  const { verdict } = input;
  const far = verdict.code === 'outside_fence' && verdict.distanceM !== null;
  if (input.scanned) {
    return far
      ? { allow: true, validated: false, reason: `Scanned the code, but the phone was ${distanceWords(verdict.distanceM ?? 0)} from work.` }
      : { allow: true, validated: true, reason: null };
  }
  if (input.direction === 'out' || input.mode === 'anywhere') {
    return { allow: true, validated: verdict.validated, reason: verdict.reason };
  }
  if (input.mode === 'entrance') {
    return { allow: false, reason: 'Clock in at the entrance: scan the code on the tablet, or use your PIN there.', far: false };
  }
  // At work only.
  switch (verdict.code) {
    case null:
      return { allow: true, validated: true, reason: null };
    case 'outside_fence':
      return { allow: false, reason: `You are ${distanceWords(verdict.distanceM ?? 0)} from work. Clock in when you get there.`, far: true };
    case 'poor_accuracy':
      return {
        allow: false,
        reason: 'Your phone cannot tell closely enough where it is. Step outside or near a window and try again, or scan the code at the entrance.',
        far: false,
      };
    case 'no_location':
      return { allow: false, reason: 'Turn on location so Injishi can see you are at work, then try again.', far: false };
    case 'no_branch_location':
      // Nothing to measure against: recorded for HR rather than refusing everyone.
      return { allow: true, validated: false, reason: verdict.reason };
  }
}

/**
 * When a self clock-in opens for a shift: `opensMinutesBefore` ahead of its
 * start. Null when it is open already, or when the branch sets no limit.
 */
export function clockInOpensAt(input: { at: Date; shiftStartsAt: Date | null; opensMinutesBefore: number | null }): Date | null {
  if (input.opensMinutesBefore === null || !input.shiftStartsAt) return null;
  const opens = new Date(input.shiftStartsAt.getTime() - input.opensMinutesBefore * MINUTE);
  return input.at < opens ? opens : null;
}
