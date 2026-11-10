import type { PayslipLine } from '@injishi/contracts';

import { monthShares } from './hr-calendar';
import type { OvertimeRule, PayeRule, Rounding, RssbRule } from './hr-rules';

/**
 * One person's payslip for one month, computed (ADR-058 AC-Y1, AC-Y2, AC-Y4;
 * 058-payroll AC-PY1 to AC-PY7, AC-PY6a).
 *
 * Pure: every input is a value, so a draft, a recompute and the confirm that
 * freezes a run compute the same figures from the same rows. The order is the
 * one 058-payroll AC-PY6 fixes, so two builders cannot net differently from the
 * same rules:
 *
 * 1. earnings per contract (the monthly wage by its share of the month, daily
 *    and hourly pay from attendance, leave, overtime), then allowances, then the
 *    earnings the caller built (claims, settlement, adjustments). `basic` is
 *    the wage lines net of unpaid leave;
 * 2. each contribution on the base its row names (`basic`, `gross` or
 *    `contributable`), capped when the row says so, the two shares apart;
 * 3. PAYE on the base its row names, the taxable base being the earnings
 *    marked taxable less the deductions taken before tax;
 * 4. deductions after tax, then loan installments and deduction adjustments;
 * 5. pass through money (a reimbursement, a loan paid out), outside gross;
 * 6. net = gross + pass through − PAYE − employee contributions − deductions.
 *
 * Every amount is whole francs, every product is taken in integers from the
 * decimal digits of its rates, and every line is rounded once, half up unless
 * its rule says otherwise.
 */

export interface PayContract {
  id: string;
  startsOn: string;
  endsOn: string | null;
  wageBasis: 'monthly' | 'daily' | 'hourly';
  wageRwf: number;
}

/** A pay component that applies to this person this month, already matched (AC-PY5). */
export interface PayComponentInput {
  code: string;
  name: string;
  kind: 'allowance' | 'deduction';
  amountType: 'fixed' | 'percent_basic' | 'percent_gross' | 'per_day_worked' | 'per_hour_worked' | 'per_child';
  amountRwf: number | null;
  /** A percentage, 0 to 100, for the two percent kinds. */
  rate: number | null;
  capRwf: number | null;
  taxable: boolean;
  contributable: boolean;
  /** A deduction taken before tax reduces the taxable base. */
  beforeTax: boolean;
}

export type DayKind = 'weekday' | 'weekly_off' | 'public_holiday';

export interface PayInput {
  /** `YYYY-MM`. */
  period: string;
  /** Every contract whose dates overlap the month, whatever its status. */
  contracts: readonly PayContract[];
  /** A planned last day that ends every contract running past it (an open exit case). */
  endsBy?: string | null;
  /**
   * Approved unpaid leave days in the month, halves counted, each attributed to
   * the contract in force on the day its ledger row is dated. Monthly wages only:
   * a daily or hourly worker on unpaid leave simply has no attendance.
   */
  unpaidDaysByContract: ReadonlyMap<string, number>;
  /**
   * Partly paid leave on a monthly wage (058-leave AC-LV1), per contract: the
   * days, halves counted, at each share of the day pay does NOT cover.
   */
  partialLeaveByContract?: ReadonlyMap<string, ReadonlyMap<number, number>>;
  /**
   * Paid leave on a daily or hourly wage (AC-PY2), per contract: the days,
   * halves counted, at each share of the day pay DOES cover (100 for paid).
   */
  paidLeaveByContract?: ReadonlyMap<string, ReadonlyMap<number, number>>;
  /** Closed, validated attendance in the month: minutes worked per work date and contract. */
  workDays?: readonly { workDate: string; contractId: string; workedMinutes: number }[];
  /** A whole day's work in minutes (the branch policy's threshold, 360 by default); half of it is half a day. */
  dayThresholdMinutes?: number;
  /** Approved overtime per contract and kind of day. Leave it out when the rule is missing; the caller blocks the run. */
  overtime?: readonly { contractId: string; dayKind: DayKind; approvedMinutes: number }[];
  overtimeRule?: OvertimeRule | null;
  /** On the month's first day. */
  childrenCount?: number;
  components?: readonly PayComponentInput[];
  /** Earnings the caller built (leave encashment, settlement, earning adjustments), each with its flags. */
  extraEarnings?: readonly PayslipLine[];
  /** Deductions after tax the caller built (loan installments, deduction adjustments). */
  extraDeductions?: readonly PayslipLine[];
  /** Money that is not income (a reimbursement, a loan paid out). */
  passthrough?: readonly PayslipLine[];
  paye: PayeRule;
  /** The contributions this business pays: the optional ones it chose are already in, the rest left out. */
  rssb: RssbRule;
  /**
   * A private health insurer's monthly premium per person, each side's part in whole francs:
   * taken after PAYE, like a contribution, never a share of pay.
   */
  fixedContributions?: readonly { code: string; label: string; employeeRwf: number; employerRwf: number }[];
}

export interface ComputedPayslip {
  /** The contract in force on the person's last payable day in the month. */
  contractId: string;
  /** The month's share, in thirtieths (AC-PY1). */
  payableDays: number;
  grossRwf: number;
  payeRwf: number;
  employeeContributionsRwf: number;
  employerContributionsRwf: number;
  otherDeductionsRwf: number;
  nonIncomeRwf: number;
  netRwf: number;
  lines: PayslipLine[];
}

/** The hours in a working day of a daily or hourly wage, until a contract carries its own (AC-PY2). */
const DAY_HOURS = 8;

/** The lines `basic` is made of (AC-PY6): the wages, net of unpaid leave. */
const BASIC_CODES = new Set(['wage', 'unpaid_leave', 'partly_paid_leave', 'daily_wage', 'hourly_wage', 'paid_leave']);

const WHOLE = /^(\d+)(?:\.(\d{1,12}))?$/;

/** A non negative decimal as integer digits over a power of ten, so products stay exact. */
function decimalOf(value: number, what: string): { digits: bigint; scale: bigint } {
  const match = WHOLE.exec(value.toString());
  if (!match) throw new Error(`Cannot read ${what} ${value}.`);
  const decimals = match[2] ?? '';
  return { digits: BigInt(match[1] + decimals), scale: 10n ** BigInt(decimals.length) };
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

/** `amount × percent / 100`, exactly, half up. */
export function percentOf(amount: number, percent: number): number {
  if (!Number.isInteger(amount)) throw new Error(`Cannot take ${percent}% of ${amount}.`);
  const p = decimalOf(percent, 'percentage');
  return divide(BigInt(amount) * p.digits, 100n * p.scale, 'half_up');
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

/** `wage × days / 30`, half up: a day of a monthly wage is a thirtieth. */
export function wageForDays(wageRwf: number, days: number): number {
  // Days come in halves at most, so twice the days is a whole number and the
  // division stays exact.
  const halves = Math.round(days * 2);
  return divide(BigInt(wageRwf) * BigInt(halves), 60n, 'half_up');
}

/**
 * `wage × days × percent / (30 × 100)`, half up: the share of a day's wage a
 * partly paid leave does not pay. Halves and a whole percentage keep it exact.
 */
function wageForPartialDays(wageRwf: number, days: number, percent: number): number {
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) throw new Error(`Cannot take ${percent}% of a day.`);
  const halves = Math.round(days * 2);
  return divide(BigInt(wageRwf) * BigInt(halves) * BigInt(percent), 6000n, 'half_up');
}

/** `wage × hundredths / 3000`: a monthly wage by its share of the month (AC-PY1). */
function wageForShare(wageRwf: number, hundredths: number): number {
  return divide(BigInt(wageRwf) * BigInt(hundredths), 3000n, 'half_up');
}

/**
 * The pay of `days` (halves counted) at a contract's day rate, times a share
 * of 100 (AC-PY2): a thirtieth of a monthly wage, the daily wage, or eight
 * hours of an hourly wage. What leave encashment, settlement and paid leave on
 * a daily or hourly wage pay.
 */
export function dayRatePay(contract: Pick<PayContract, 'wageBasis' | 'wageRwf'>, days: number, percent = 100): number {
  const halves = BigInt(Math.round(days * 2));
  const pct = BigInt(percent);
  const wage = BigInt(contract.wageRwf);
  if (contract.wageBasis === 'monthly') return divide(wage * halves * pct, 6000n, 'half_up');
  if (contract.wageBasis === 'daily') return divide(wage * halves * pct, 200n, 'half_up');
  return divide(wage * BigInt(DAY_HOURS) * halves * pct, 200n, 'half_up');
}

/** A day's work counts whole from the threshold, half from half of it, else nothing (AC-PY2). */
export function dayUnits(workedMinutes: number, thresholdMinutes: number): number {
  if (workedMinutes >= thresholdMinutes) return 1;
  if (workedMinutes * 2 >= thresholdMinutes) return 0.5;
  return 0;
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

/**
 * Overtime pay for minutes on one contract (AC-PY4): the minutes as hours, at
 * the hourly rate (a monthly wage over the rule's divisor, a daily wage over 8,
 * an hourly wage as it is), times the day kind's multiplier.
 */
export function overtimePay(contract: Pick<PayContract, 'wageBasis' | 'wageRwf'>, minutes: number, multiplier: number, rule: OvertimeRule): number {
  const m = decimalOf(multiplier, 'multiplier');
  const wage = BigInt(contract.wageRwf);
  const mins = BigInt(minutes);
  const rounding = rule.rounding ?? 'half_up';
  if (contract.wageBasis === 'monthly') {
    const d = decimalOf(rule.monthlyHoursDivisor, 'hours divisor');
    return divide(mins * wage * m.digits * d.scale, 60n * m.scale * d.digits, rounding);
  }
  const hours = contract.wageBasis === 'daily' ? BigInt(DAY_HOURS) : 1n;
  return divide(mins * wage * m.digits, 60n * hours * m.scale, rounding);
}

function minutesText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m} min` : `${h} h ${String(m).padStart(2, '0')}`;
}

/** "RWF 520,000". */
function rwfText(n: number): string {
  return `RWF ${n.toLocaleString('en-US')}`;
}

/** A share of a month in hundredths of a day: "27", or "27.5" for a part day. */
function shareText(hundredths: number): string {
  return String(Math.round(hundredths) / 100);
}

function daysText(days: number): string {
  return `${days} day${days === 1 ? '' : 's'}`;
}

const DAY_KIND_LABEL: Record<DayKind, string> = {
  weekday: 'a working day',
  weekly_off: 'a weekly day off',
  public_holiday: 'a holiday',
};

export function computePayslip(input: PayInput): ComputedPayslip {
  const ordered = [...input.contracts].sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.id.localeCompare(b.id));
  if (ordered.length === 0) throw new Error('A payslip needs a contract in the month.');
  const shares = monthShares(ordered, input.period, input.endsBy ?? null);
  const threshold = input.dayThresholdMinutes ?? 360;
  const lines: PayslipLine[] = [];
  let payableHundredths = 0;
  const earn = (line: Omit<PayslipLine, 'side'>): void => {
    if (line.amountRwf !== 0) lines.push({ ...line, side: 'earning' });
  };

  // (1) Earnings, per contract.
  for (const contract of ordered) {
    const share = shares.get(contract.id) ?? 0;
    payableHundredths += share;
    if (contract.wageBasis === 'monthly') {
      if (share > 0) {
        earn({
          code: 'wage',
          label: 'Monthly wage',
          contractId: contract.id,
          basis: share === 3000 ? `${rwfText(contract.wageRwf)} a month, the full month` : `${rwfText(contract.wageRwf)} a month × ${shareText(share)}/30 days`,
          amountRwf: wageForShare(contract.wageRwf, share),
          taxable: true,
          contributable: true,
        });
      }
      // Unpaid leave never takes more than the days the contract paid.
      const paid = share / 100;
      const unpaid = Math.min(input.unpaidDaysByContract.get(contract.id) ?? 0, paid);
      if (unpaid > 0) {
        earn({
          code: 'unpaid_leave',
          label: 'Unpaid leave',
          contractId: contract.id,
          basis: `${daysText(unpaid)} × ${rwfText(contract.wageRwf)}/30`,
          amountRwf: -wageForDays(contract.wageRwf, unpaid),
          taxable: true,
          contributable: true,
        });
      }
      // Partly paid leave, one line per share, the largest share first; together
      // with unpaid leave it never reaches past the days the contract paid.
      let room = paid - Math.max(0, unpaid);
      const partial = [...(input.partialLeaveByContract?.get(contract.id) ?? new Map<number, number>())].sort((a, b) => b[0] - a[0]);
      for (const [percent, days] of partial) {
        const taken = Math.min(days, room);
        if (taken <= 0 || percent === 0) continue;
        room -= taken;
        earn({
          code: 'partly_paid_leave',
          label: 'Partly paid leave',
          contractId: contract.id,
          basis: `${daysText(taken)} × ${percent}% unpaid × ${rwfText(contract.wageRwf)}/30`,
          amountRwf: -wageForPartialDays(contract.wageRwf, taken, percent),
          taxable: true,
          contributable: true,
        });
      }
    } else {
      const own = (input.workDays ?? []).filter((d) => d.contractId === contract.id);
      const byDate = new Map<string, number>();
      for (const d of own) byDate.set(d.workDate, (byDate.get(d.workDate) ?? 0) + d.workedMinutes);
      if (contract.wageBasis === 'daily') {
        // Two shifts on one date are one day (AC-PY2).
        const days = [...byDate.values()].reduce((s, minutes) => s + dayUnits(minutes, threshold), 0);
        earn({
          code: 'daily_wage',
          label: 'Days worked',
          contractId: contract.id,
          basis: `${daysText(days)} × ${contract.wageRwf}`,
          amountRwf: dayRatePay(contract, days),
          taxable: true,
          contributable: true,
        });
      } else {
        const minutes = [...byDate.values()].reduce((s, m) => s + m, 0);
        earn({
          code: 'hourly_wage',
          label: 'Hours worked',
          contractId: contract.id,
          basis: `${minutesText(minutes)} × ${contract.wageRwf} an hour`,
          amountRwf: divide(BigInt(minutes) * BigInt(contract.wageRwf), 60n, 'half_up'),
          taxable: true,
          contributable: true,
        });
      }
      for (const [percent, days] of [...(input.paidLeaveByContract?.get(contract.id) ?? new Map<number, number>())].sort((a, b) => b[0] - a[0])) {
        if (days <= 0 || percent <= 0) continue;
        earn({
          code: 'paid_leave',
          label: percent === 100 ? 'Paid leave' : `Leave paid at ${percent}%`,
          contractId: contract.id,
          basis: `${daysText(days)}${percent === 100 ? '' : ` × ${percent}%`} at the day rate`,
          amountRwf: dayRatePay(contract, days, percent),
          taxable: true,
          contributable: true,
        });
      }
    }
    // Approved overtime, one line per kind of day (AC-PY4).
    const rule = input.overtimeRule;
    if (rule) {
      for (const kind of ['weekday', 'weekly_off', 'public_holiday'] as const) {
        const minutes = (input.overtime ?? [])
          .filter((o) => o.contractId === contract.id && o.dayKind === kind)
          .reduce((s, o) => s + o.approvedMinutes, 0);
        if (minutes <= 0) continue;
        const multiplier = rule.multipliers[kind];
        earn({
          code: 'overtime',
          label: `Overtime on ${DAY_KIND_LABEL[kind]}`,
          contractId: contract.id,
          basis:
            contract.wageBasis === 'monthly'
              ? `${minutesText(minutes)} × ${multiplier} × ${contract.wageRwf}/${rule.monthlyHoursDivisor}`
              : contract.wageBasis === 'daily'
                ? `${minutesText(minutes)} × ${multiplier} × ${contract.wageRwf}/${DAY_HOURS}`
                : `${minutesText(minutes)} × ${multiplier} × ${contract.wageRwf}`,
          amountRwf: overtimePay(contract, minutes, multiplier, rule),
          taxable: rule.taxable,
          contributable: rule.contributable,
        });
      }
    }
  }

  const basic = sum(lines.filter((l) => BASIC_CODES.has(l.code)));
  const grossBeforeAllowances = sum(lines.filter((l) => l.side === 'earning'));
  const workedDates = new Set((input.workDays ?? []).filter((d) => d.workedMinutes > 0).map((d) => d.workDate)).size;
  const workedMinutes = (input.workDays ?? []).reduce((s, d) => s + d.workedMinutes, 0);
  const componentAmount = (c: PayComponentInput, grossBase: number): { amount: number; basis: string } => {
    let amount = 0;
    let basis = '';
    switch (c.amountType) {
      case 'fixed':
        amount = c.amountRwf ?? 0;
        basis = 'fixed';
        break;
      case 'percent_basic':
        amount = percentOf(basic, c.rate ?? 0);
        basis = `${c.rate}% of ${basic} basic`;
        break;
      case 'percent_gross':
        amount = percentOf(grossBase, c.rate ?? 0);
        basis = `${c.rate}% of ${grossBase} gross`;
        break;
      case 'per_day_worked':
        amount = (c.amountRwf ?? 0) * workedDates;
        basis = `${c.amountRwf} × ${daysText(workedDates)} worked`;
        break;
      case 'per_hour_worked':
        amount = divide(BigInt(c.amountRwf ?? 0) * BigInt(workedMinutes), 60n, 'half_up');
        basis = `${c.amountRwf} × ${minutesText(workedMinutes)} worked`;
        break;
      case 'per_child':
        amount = (c.amountRwf ?? 0) * (input.childrenCount ?? 0);
        basis = `${c.amountRwf} × ${input.childrenCount ?? 0} child${input.childrenCount === 1 ? '' : 'ren'}`;
        break;
    }
    if (c.capRwf !== null && amount > c.capRwf) {
      amount = c.capRwf;
      basis = `${basis}, capped at ${c.capRwf}`;
    }
    return { amount, basis };
  };

  // Allowances; a percentage of gross reads gross before allowances.
  for (const c of (input.components ?? []).filter((x) => x.kind === 'allowance')) {
    const { amount, basis } = componentAmount(c, grossBeforeAllowances);
    earn({ code: `allowance:${c.code}`, label: c.name, contractId: null, basis, amountRwf: amount, taxable: c.taxable, contributable: c.contributable });
  }
  // The earnings the caller built: encashment, settlement, earning adjustments.
  for (const line of input.extraEarnings ?? []) if (line.amountRwf !== 0) lines.push({ ...line, side: 'earning' });

  const gross = sum(lines.filter((l) => l.side === 'earning'));
  const deductions = (input.components ?? []).filter((x) => x.kind === 'deduction');

  // Deductions taken before tax lower the taxable base.
  for (const c of deductions.filter((x) => x.beforeTax)) {
    const { amount, basis } = componentAmount(c, gross);
    if (amount > 0) lines.push({ code: `deduction:${c.code}`, label: c.name, contractId: null, basis, amountRwf: amount, side: 'deduction', beforeTax: true });
  }
  const contributable = sum(lines.filter((l) => l.side === 'earning' && l.contributable !== false));
  const taxable = Math.max(
    0,
    sum(lines.filter((l) => l.side === 'earning' && l.taxable !== false)) - sum(lines.filter((l) => l.side === 'deduction' && l.beforeTax)),
  );

  // (2) Contributions, each on its own base, the two shares apart. One on net pay waits for PAYE.
  const contributionRounding = input.rssb.rounding ?? 'half_up';
  const contribute = (c: RssbRule['contributions'][number], raw: number): void => {
    const base = c.capRwf !== undefined ? Math.min(raw, c.capRwf) : raw;
    const capNote = c.capRwf !== undefined && raw > c.capRwf ? ` (capped at ${c.capRwf})` : '';
    // A contribution only one side pays (the business alone, for occupational
    // hazards) has no line for the other: a rate of nothing is nobody's share,
    // not a share of zero francs on a payslip.
    if (c.employeeRate > 0) {
      lines.push({
        code: c.code,
        label: `${c.label}, employee share`,
        contractId: null,
        basis: `${c.employeeRate} × ${base} ${c.base}${capNote}`,
        amountRwf: applyRate(base, c.employeeRate, contributionRounding),
        side: 'employee',
      });
    }
    if (c.employerRate > 0) {
      lines.push({
        code: c.code,
        label: `${c.label}, employer share`,
        contractId: null,
        basis: `${c.employerRate} × ${base} ${c.base}${capNote}`,
        amountRwf: applyRate(base, c.employerRate, contributionRounding),
        side: 'employer',
      });
    }
  };
  for (const c of input.rssb.contributions) {
    if (c.base === 'net') continue;
    contribute(c, c.base === 'gross' ? gross : c.base === 'basic' ? basic : contributable);
  }
  const employeeContributions = sum(lines.filter((l) => l.side === 'employee'));

  // (3) PAYE on the base the rule names.
  const payeBase =
    input.paye.taxableBase === 'gross'
      ? gross
      : input.paye.taxableBase === 'gross_less_employee_contributions'
        ? Math.max(0, gross - employeeContributions)
        : input.paye.taxableBase === 'taxable'
          ? taxable
          : Math.max(0, taxable - employeeContributions);
  const baseWords: Record<PayeRule['taxableBase'], string> = {
    gross: 'gross',
    gross_less_employee_contributions: 'gross less employee contributions',
    taxable: 'taxable earnings',
    taxable_less_employee_contributions: 'taxable earnings less employee contributions',
  };
  const payeRwf = payeOn(payeBase, input.paye);
  lines.push({
    code: 'paye',
    label: 'PAYE',
    contractId: null,
    basis: `bands on ${payeBase}, ${baseWords[input.paye.taxableBase]}`,
    amountRwf: payeRwf,
    side: 'employee',
    taxBase: payeBase,
  });

  // (3b) What is a share of net pay (CBHI): gross less PAYE and the contributions above.
  const netBase = Math.max(0, gross - employeeContributions - payeRwf);
  for (const c of input.rssb.contributions) if (c.base === 'net') contribute(c, netBase);
  // A private insurer's premium: a fixed sum each side, not a share of pay.
  for (const f of input.fixedContributions ?? []) {
    if (f.employeeRwf > 0) {
      lines.push({ code: f.code, label: `${f.label}, employee share`, contractId: null, basis: 'fixed monthly premium', amountRwf: f.employeeRwf, side: 'employee' });
    }
    if (f.employerRwf > 0) {
      lines.push({ code: f.code, label: `${f.label}, employer share`, contractId: null, basis: 'fixed monthly premium', amountRwf: f.employerRwf, side: 'employer' });
    }
  }

  // (4) Deductions after tax, then loans and deduction adjustments.
  for (const c of deductions.filter((x) => !x.beforeTax)) {
    const { amount, basis } = componentAmount(c, gross);
    if (amount > 0) lines.push({ code: `deduction:${c.code}`, label: c.name, contractId: null, basis, amountRwf: amount, side: 'deduction' });
  }
  for (const line of input.extraDeductions ?? []) if (line.amountRwf !== 0) lines.push({ ...line, side: 'deduction' });

  // (5) Money that is not income.
  for (const line of input.passthrough ?? []) if (line.amountRwf !== 0) lines.push({ ...line, side: 'passthrough' });

  return totals(lines, ordered[ordered.length - 1].id, payableHundredths / 100);
}

/**
 * The amount columns from the lines (AC-Y4, AC-PY6a). Every column is a sum of
 * its lines, so the payslip can never say something its lines do not.
 */
function totals(lines: PayslipLine[], contractId: string, payableDays: number): ComputedPayslip {
  const grossRwf = sum(lines.filter((l) => l.side === 'earning'));
  const payeRwf = sum(lines.filter((l) => l.side === 'employee' && l.code === 'paye'));
  const employeeContributionsRwf = sum(lines.filter((l) => l.side === 'employee' && l.code !== 'paye'));
  const employerContributionsRwf = sum(lines.filter((l) => l.side === 'employer'));
  const otherDeductionsRwf = sum(lines.filter((l) => l.side === 'deduction'));
  const nonIncomeRwf = sum(lines.filter((l) => l.side === 'passthrough'));
  return {
    contractId,
    payableDays,
    grossRwf,
    payeRwf,
    employeeContributionsRwf,
    employerContributionsRwf,
    otherDeductionsRwf,
    nonIncomeRwf,
    netRwf: grossRwf + nonIncomeRwf - payeRwf - employeeContributionsRwf - otherDeductionsRwf,
    lines,
  };
}

function sum(lines: readonly PayslipLine[]): number {
  return lines.reduce((acc, l) => acc + l.amountRwf, 0);
}
