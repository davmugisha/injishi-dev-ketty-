import { addDays, eachDate } from './hr-calendar';

/**
 * Time's rules, pure (ADR-058, 058-time): which roster entry a clock in links
 * to (AC-TM15), the figures a closed record carries (AC-TM7, AC-TM8), what kind
 * of day a date is (AC-TM7, AC-TM12), which step a rotation is on (AC-TM3), and
 * how far a phone was from its branch (AC-TM9).
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
export const MAX_TRUSTED_ACCURACY_M = 200;

/**
 * Whether a phone punch validates itself: a location was sent, the branch has
 * coordinates, the accuracy is good enough and the point is inside the radius.
 * Anything else is recorded, never refused, for a person to validate.
 */
export function phonePunchVerdict(input: {
  point: { lat: number; lng: number; accuracyM: number | null } | null;
  branch: { lat: number; lng: number } | null;
  radiusM: number;
}): { validated: boolean; distanceM: number | null; reason: string | null } {
  if (!input.point) return { validated: false, distanceM: null, reason: 'No location was sent.' };
  if (!input.branch) return { validated: false, distanceM: null, reason: 'The branch has no location set.' };
  const distanceM = distanceMeters(input.point, input.branch);
  if (input.point.accuracyM === null || input.point.accuracyM > MAX_TRUSTED_ACCURACY_M) {
    return { validated: false, distanceM, reason: 'The phone could not tell closely enough where it was.' };
  }
  if (distanceM > input.radiusM) {
    return { validated: false, distanceM, reason: `It was ${distanceM} m from the branch.` };
  }
  return { validated: true, distanceM, reason: null };
}
