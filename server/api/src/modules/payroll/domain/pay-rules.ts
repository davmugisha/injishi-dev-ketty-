/**
 * How a payslip is worked out (HR module — first pass, no ADR yet).
 *
 * THE ARITHMETIC IS MAIN'S. `applyRate`, `payeOn`, `wageForDays` and the two
 * helpers under them are taken from `modules/people/domain/pay-computation.ts`
 * on main (ADR-058), and the rule shapes from its `hr-rules.ts`, so that the
 * two HR modules agree to the franc on the same inputs and this file can be
 * deleted in favour of that one when they meet. What it replaced here was one
 * flat rate for tax and one for pension.
 *
 * THE RATES ARE NOT MAIN'S, because main states none: its sample rows are
 * invented round numbers. The figures below are Rwanda's published rates as
 * understood when this was written (October 2026):
 *
 *   PAYE        monthly bands of 0%, 10%, 20% and 30%, at 60,000, 100,000 and
 *               200,000 RWF
 *   RSSB        pension 6% from each side, maternity leave 0.3% from each
 *               side, occupational hazards 2% from the employer
 *   CBHI        0.5% of net pay, from the employee
 *
 * THEY HAVE NOT BEEN CHECKED BY AN ACCOUNTANT. Nothing here should be filed
 * with RRA or RSSB, or paid from, until somebody qualified has confirmed each
 * line against the current law. The overtime terms are not law at all: they
 * are this module's own choice, stated below so they can be changed in one
 * place.
 *
 * Pure: every input is a value, so a draft, a recalculation and a test all
 * compute the same payslip from the same facts.
 */

export type Rounding = 'half_up' | 'down' | 'up';

export interface PayeRule {
  /** Progressive: each band taxes only the francs inside it. The last is open ended. */
  bands: readonly { fromRwf: number; toRwf: number | null; rate: number }[];
  rounding?: Rounding;
}

export interface Contribution {
  code: string;
  label: string;
  /** `net` is pay after tax and the gross based contributions, which is what CBHI is charged on. */
  base: 'gross' | 'net';
  /** A fraction of one, such as 0.06. Never a percentage. */
  employeeRate: number;
  employerRate: number;
}

export const RWANDA_PAYE: PayeRule = {
  bands: [
    { fromRwf: 0, toRwf: 60_000, rate: 0 },
    { fromRwf: 60_000, toRwf: 100_000, rate: 0.1 },
    { fromRwf: 100_000, toRwf: 200_000, rate: 0.2 },
    { fromRwf: 200_000, toRwf: null, rate: 0.3 },
  ],
};

export const RWANDA_CONTRIBUTIONS: readonly Contribution[] = [
  { code: 'pension', label: 'RSSB pension', base: 'gross', employeeRate: 0.06, employerRate: 0.06 },
  { code: 'maternity', label: 'RSSB maternity leave', base: 'gross', employeeRate: 0.003, employerRate: 0.003 },
  { code: 'occupational_hazards', label: 'RSSB occupational hazards', base: 'gross', employeeRate: 0, employerRate: 0.02 },
  { code: 'cbhi', label: 'Community health insurance (CBHI)', base: 'net', employeeRate: 0.005, employerRate: 0 },
];

/**
 * Overtime, as this module pays it. Time worked past the end of a rostered
 * shift counts once it reaches `fromMinutes` on a day (a few minutes spent
 * finishing up is not overtime), and is paid at `multiplier` times the hourly
 * rate, the hourly rate being a month's salary over thirty days of eight hours.
 */
export const OVERTIME = { fromMinutes: 30, multiplier: 1.5, dayHours: 8 } as const;

/** A month of a monthly wage is thirty days, whatever the calendar says (main, AC-PY1). */
const MONTH_DAYS = 30;

// --- Exact arithmetic, from main -------------------------------------------

const WHOLE = /^(\d+)(?:\.(\d{1,12}))?$/;

/** A non negative decimal as integer digits over a power of ten, so products stay exact. */
function decimalOf(value: number, what: string): { digits: bigint; scale: bigint } {
  const match = WHOLE.exec(value.toString());
  if (!match) throw new Error(`Cannot read ${what} ${value}.`);
  const decimals = match[2] ?? '';
  return { digits: BigInt(match[1] + decimals), scale: 10n ** BigInt(decimals.length) };
}

/** `numerator / denominator` to a whole number, rounded as stated. */
function divide(numerator: bigint, denominator: bigint, rounding: Rounding): number {
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  let q = n / d;
  const r = n % d;
  if (r !== 0n) {
    if (rounding === 'up') q += 1n;
    else if (rounding === 'half_up' && r * 2n >= d) q += 1n;
  }
  return Number(negative ? -q : q);
}

/**
 * `amount × rate`, rounded to the whole franc, computed exactly.
 *
 * A rate is a decimal such as 0.03, which a float cannot hold, and a
 * contribution that lands on a half franc must round the way the rule says
 * rather than the way the float error happens to lean. The rate is read as its
 * decimal digits and the product is taken in integers.
 */
export function applyRate(amount: number, rate: number, rounding: Rounding = 'half_up'): number {
  if (!Number.isInteger(amount)) throw new Error(`Cannot apply rate ${rate} to ${amount}.`);
  const r = decimalOf(rate, 'rate');
  return divide(BigInt(amount) * r.digits, r.scale, rounding);
}

/** Progressive PAYE on a taxable base. */
export function payeOn(base: number, rule: PayeRule): number {
  const rounding = rule.rounding ?? 'half_up';
  // Each band's slice is taxed exactly and summed, then the sum is rounded
  // once, so a person's tax does not depend on how many bands their pay spans.
  let exactNumerator = 0n;
  let exactDenominator = 1n;
  for (const band of rule.bands) {
    const top = band.toRwf ?? Number.POSITIVE_INFINITY;
    const slice = Math.max(0, Math.min(base, top) - band.fromRwf);
    if (slice === 0) continue;
    const r = decimalOf(band.rate, 'PAYE rate');
    const num = BigInt(slice) * r.digits;
    // a/b + c/d over a common denominator.
    exactNumerator = exactNumerator * r.scale + num * exactDenominator;
    exactDenominator = exactDenominator * r.scale;
  }
  return Math.max(0, divide(exactNumerator, exactDenominator, rounding));
}

/** `wage × days / 30`, half up: a day of a monthly wage is a thirtieth. */
export function wageForDays(wageRwf: number, days: number): number {
  return divide(BigInt(wageRwf) * BigInt(days), BigInt(MONTH_DAYS), 'half_up');
}

/** Minutes of overtime as pay: the hourly rate, times the multiplier, exactly. */
export function overtimePay(wageRwf: number, minutes: number): number {
  const multiplier = decimalOf(OVERTIME.multiplier, 'overtime multiplier');
  return divide(
    BigInt(wageRwf) * BigInt(minutes) * multiplier.digits,
    BigInt(MONTH_DAYS * OVERTIME.dayHours * 60) * multiplier.scale,
    'half_up',
  );
}

// --- The payslip -----------------------------------------------------------

/**
 * What the roster, the clock and leave say about one person's month. Null
 * where a payslip was computed before payroll read attendance.
 */
export interface PayFacts {
  /** Shifts they were rostered on, up to today, leave left out. */
  rosteredDays: number;
  /** Days with a clock record. */
  workedDays: number;
  /** Rostered shifts that started and that nobody clocked: unpaid. */
  missedDays: number;
  lateDays: number;
  /** Days of approved leave of a type the business set as unpaid. */
  unpaidLeaveDays: number;
  /** Minutes past the end of a rostered shift, on days that reached the threshold. */
  overtimeMinutes: number;
}

/**
 * One line of a payslip. The sides are main's names (`PayslipLine` in
 * `@injishi/contracts` there): what is earned, what is withheld from the
 * employee, and what the business adds on top.
 */
export interface PayslipLine {
  code: string;
  label: string;
  side: 'earning' | 'employee' | 'employer';
  /** Whole francs. A negative earning is pay taken off: an absence. */
  amountRwf: number;
  /** How the figure was reached, in words a person can check. */
  basis: string | null;
}

export interface ComputedPayslip {
  lines: PayslipLine[];
  grossRwf: number;
  payeRwf: number;
  /** Everything withheld for RSSB and CBHI. */
  employeeContributionsRwf: number;
  employerContributionsRwf: number;
  netRwf: number;
}

const francs = (n: number): string => `${Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')} RWF`;
const percent = (rate: number): string => `${Number((rate * 100).toFixed(3))}%`;
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

function hoursText(minutes: number): string {
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

/** The PAYE bands as one sentence, for the line that tax was reached by. */
function bandsText(rule: PayeRule): string {
  return rule.bands
    .map((b) => (b.toRwf === null ? `${percent(b.rate)} above` : `${percent(b.rate)} to ${francs(b.toRwf)}`))
    .join(', ');
}

/**
 * One person's payslip for one month.
 *
 * A MONTH'S SALARY IS PAID FOR A MONTH'S WORK. A rostered shift nobody clocked
 * and a day of unpaid leave each take a thirtieth off, and time worked past
 * the end of a shift adds to it. Being late takes nothing off: it is on the
 * record, and what to do about it is a conversation, not a deduction. Somebody
 * who was never rostered cannot have missed a shift, so with no roster the
 * salary is simply the salary.
 *
 * Tax and the contributions are then charged on what was actually earned.
 */
export function computePayslip(baseSalaryRwf: number, facts: PayFacts | null): ComputedPayslip {
  const lines: PayslipLine[] = [
    { code: 'basic', label: 'Basic salary', side: 'earning', amountRwf: baseSalaryRwf, basis: 'The monthly salary on record' },
  ];

  if (facts) {
    // Never more off than there is: thirty unpaid days is the whole month.
    const unpaidDays = Math.min(MONTH_DAYS, facts.missedDays + facts.unpaidLeaveDays);
    const missed = Math.min(facts.missedDays, unpaidDays);
    const leave = unpaidDays - missed;
    if (missed > 0) {
      lines.push({
        code: 'absence',
        label: 'Absence',
        side: 'earning',
        amountRwf: -wageForDays(baseSalaryRwf, missed),
        basis: `${plural(missed, 'rostered shift', 'rostered shifts')} with no clock in, a thirtieth of the month each`,
      });
    }
    if (leave > 0) {
      lines.push({
        code: 'unpaid_leave',
        label: 'Unpaid leave',
        side: 'earning',
        amountRwf: -wageForDays(baseSalaryRwf, leave),
        basis: `${plural(leave, 'day', 'days')} of unpaid leave, a thirtieth of the month each`,
      });
    }
    if (facts.overtimeMinutes > 0) {
      lines.push({
        code: 'overtime',
        label: 'Overtime',
        side: 'earning',
        amountRwf: overtimePay(baseSalaryRwf, facts.overtimeMinutes),
        basis: `${hoursText(facts.overtimeMinutes)} past the end of a shift, at ${OVERTIME.multiplier} times the hourly rate`,
      });
    }
  }

  const grossRwf = Math.max(0, lines.reduce((n, l) => n + l.amountRwf, 0));
  const payeRwf = payeOn(grossRwf, RWANDA_PAYE);
  lines.push({ code: 'paye', label: 'PAYE income tax', side: 'employee', amountRwf: payeRwf, basis: `Taxed by band: ${bandsText(RWANDA_PAYE)}` });

  // The contributions charged on gross first; CBHI is charged on what is left.
  let employee = 0;
  let employer = 0;
  const charge = (c: Contribution, base: number, of: string): void => {
    const mine = applyRate(base, c.employeeRate);
    const theirs = applyRate(base, c.employerRate);
    if (c.employeeRate > 0) lines.push({ code: c.code, label: c.label, side: 'employee', amountRwf: mine, basis: `${percent(c.employeeRate)} of ${of}` });
    if (c.employerRate > 0) lines.push({ code: c.code, label: c.label, side: 'employer', amountRwf: theirs, basis: `${percent(c.employerRate)} of ${of}` });
    employee += mine;
    employer += theirs;
  };
  for (const c of RWANDA_CONTRIBUTIONS.filter((x) => x.base === 'gross')) charge(c, grossRwf, 'gross pay');
  const afterGross = Math.max(0, grossRwf - payeRwf - employee);
  for (const c of RWANDA_CONTRIBUTIONS.filter((x) => x.base === 'net')) charge(c, afterGross, 'pay after tax and RSSB');

  return {
    lines,
    grossRwf,
    payeRwf,
    employeeContributionsRwf: employee,
    employerContributionsRwf: employer,
    netRwf: Math.max(0, grossRwf - payeRwf - employee),
  };
}
