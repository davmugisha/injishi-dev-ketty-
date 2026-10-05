import type { PayslipLine } from '@injishi/contracts';

import { payableThirtieths } from './hr-calendar';
import type { PayeRule, Rounding, RssbRule } from './hr-rules';

/**
 * One person's payslip for one month, computed (ADR-058 AC-Y1, AC-Y2, AC-Y4).
 *
 * Pure: every input is a value, so a draft, a recompute and the confirm that
 * freezes a run compute the same figures from the same rows. The order is the
 * one index contract 8 fixes, so two builders cannot net differently from the
 * same rules: (1) gross, per contract; (2) each contribution on the base its
 * row names, capped when the row says so, the two shares apart; (3) PAYE on
 * the taxable base the PAYE row names; (4) deductions after tax (none yet);
 * (5) net.
 *
 * The first thread pays MONTHLY wages only. Daily and hourly contracts are
 * refused when they are written, so none reaches here.
 */

export interface PayContract {
  id: string;
  startsOn: string;
  endsOn: string | null;
  wageBasis: 'monthly' | 'daily' | 'hourly';
  wageRwf: number;
}

export interface PayInput {
  /** `YYYY-MM`. */
  period: string;
  /** Every contract whose dates overlap the month, whatever its status. */
  contracts: readonly PayContract[];
  /**
   * Approved unpaid leave days in the month, halves counted, each attributed to
   * the contract in force on the day its ledger row is dated.
   */
  unpaidDaysByContract: ReadonlyMap<string, number>;
  /**
   * Partly paid leave in the month (058-leave AC-LV1), per contract: the days,
   * halves counted, at each share of the day pay does NOT cover. Sick leave paid
   * at 60% is 40 here.
   */
  partialLeaveByContract?: ReadonlyMap<string, ReadonlyMap<number, number>>;
  paye: PayeRule;
  rssb: RssbRule;
}

export interface ComputedPayslip {
  /** The contract in force on the person's last payable day in the month. */
  contractId: string;
  payableDays: number;
  grossRwf: number;
  payeRwf: number;
  employeeContributionsRwf: number;
  employerContributionsRwf: number;
  otherDeductionsRwf: number;
  netRwf: number;
  lines: PayslipLine[];
}

const WHOLE = /^(\d+)(?:\.(\d{1,12}))?$/;

/**
 * `amount × rate`, rounded to the whole franc, computed exactly.
 *
 * A rate is a decimal such as 0.03, which a float cannot hold, and a
 * contribution that lands on a half franc must round the way the rule says
 * rather than the way the float error happens to lean. The rate is read as its
 * decimal digits and the product is taken in integers.
 */
export function applyRate(amount: number, rate: number, rounding: Rounding = 'half_up'): number {
  const match = WHOLE.exec(rate.toString());
  if (!match || !Number.isInteger(amount)) {
    throw new Error(`Cannot apply rate ${rate} to ${amount}.`);
  }
  const decimals = match[2] ?? '';
  const numerator = BigInt(match[1] + decimals);
  const denominator = 10n ** BigInt(decimals.length);
  return divide(BigInt(amount) * numerator, denominator, rounding);
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
export function wageForPartialDays(wageRwf: number, days: number, percent: number): number {
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) throw new Error(`Cannot take ${percent}% of a day.`);
  const halves = Math.round(days * 2);
  return divide(BigInt(wageRwf) * BigInt(halves) * BigInt(percent), 6000n, 'half_up');
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
    const match = WHOLE.exec(band.rate.toString());
    if (!match) throw new Error(`Unreadable PAYE rate ${band.rate}.`);
    const decimals = match[2] ?? '';
    const num = BigInt(slice) * BigInt(match[1] + decimals);
    const den = 10n ** BigInt(decimals.length);
    // a/b + c/d over a common denominator.
    exactNumerator = exactNumerator * den + num * exactDenominator;
    exactDenominator = exactDenominator * den;
  }
  return Math.max(0, divide(exactNumerator, exactDenominator, rounding));
}

export function computePayslip(input: PayInput): ComputedPayslip {
  const monthly = input.contracts.filter((c) => c.wageBasis === 'monthly');
  if (monthly.length !== input.contracts.length) {
    // The contract route refuses daily and hourly wages in the first thread;
    // reaching here with one would pay somebody nothing, silently.
    throw new Error('Only monthly wages are computed in the first HR thread.');
  }
  if (monthly.length === 0) throw new Error('A payslip needs a contract in the month.');

  const ordered = [...monthly].sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  const lines: PayslipLine[] = [];
  let payableDays = 0;

  // (1) Gross, per contract.
  for (const contract of ordered) {
    const thirtieths = payableThirtieths(contract, input.period);
    payableDays += thirtieths;
    lines.push({
      code: 'wage',
      label: 'Monthly wage',
      contractId: contract.id,
      basis:
        thirtieths === 30
          ? `${contract.wageRwf} a month, the full month`
          : `${contract.wageRwf} a month × ${thirtieths}/30`,
      amountRwf: wageForDays(contract.wageRwf, thirtieths),
      side: 'earning',
    });
    // Unpaid leave never takes more than the days the contract paid.
    const unpaid = Math.min(input.unpaidDaysByContract.get(contract.id) ?? 0, thirtieths);
    if (unpaid > 0) {
      lines.push({
        code: 'unpaid_leave',
        label: 'Unpaid leave',
        contractId: contract.id,
        basis: `${unpaid} day${unpaid === 1 ? '' : 's'} × ${contract.wageRwf}/30`,
        amountRwf: -wageForDays(contract.wageRwf, unpaid),
        side: 'earning',
      });
    }
    // Partly paid leave, one line per share, the largest share first; together
    // with unpaid leave it never reaches past the days the contract paid.
    let room = thirtieths - Math.max(0, unpaid);
    const partial = [...(input.partialLeaveByContract?.get(contract.id) ?? new Map<number, number>())].sort((a, b) => b[0] - a[0]);
    for (const [percent, days] of partial) {
      const taken = Math.min(days, room);
      if (taken <= 0 || percent === 0) continue;
      room -= taken;
      lines.push({
        code: 'partly_paid_leave',
        label: 'Partly paid leave',
        contractId: contract.id,
        basis: `${taken} day${taken === 1 ? '' : 's'} × ${percent}% unpaid × ${contract.wageRwf}/30`,
        amountRwf: -wageForPartialDays(contract.wageRwf, taken, percent),
        side: 'earning',
      });
    }
  }
  const gross = sum(lines.filter((l) => l.side === 'earning'));
  // Until allowances exist (`058-payroll.md`), basic pay is the wage lines net
  // of unpaid leave, which is all of gross.
  const basic = sum(lines.filter((l) => l.code === 'wage' || l.code === 'unpaid_leave' || l.code === 'partly_paid_leave'));

  // (2) Contributions, each on its own base, the two shares apart.
  const contributionRounding = input.rssb.rounding ?? 'half_up';
  for (const c of input.rssb.contributions) {
    const raw = c.base === 'gross' ? gross : basic;
    const base = c.capRwf !== undefined ? Math.min(raw, c.capRwf) : raw;
    const capNote = c.capRwf !== undefined && raw > c.capRwf ? ` (capped at ${c.capRwf})` : '';
    lines.push({
      code: c.code,
      label: `${c.label}, employee share`,
      contractId: null,
      basis: `${c.employeeRate} × ${base} ${c.base}${capNote}`,
      amountRwf: applyRate(base, c.employeeRate, contributionRounding),
      side: 'employee',
    });
    lines.push({
      code: c.code,
      label: `${c.label}, employer share`,
      contractId: null,
      basis: `${c.employerRate} × ${base} ${c.base}${capNote}`,
      amountRwf: applyRate(base, c.employerRate, contributionRounding),
      side: 'employer',
    });
  }
  const employeeContributions = sum(lines.filter((l) => l.side === 'employee'));

  // (3) PAYE on the base the rule names.
  const taxable =
    input.paye.taxableBase === 'gross' ? gross : Math.max(0, gross - employeeContributions);
  lines.push({
    code: 'paye',
    label: 'PAYE',
    contractId: null,
    basis:
      input.paye.taxableBase === 'gross'
        ? `bands on ${taxable} gross`
        : `bands on ${taxable}, gross less employee contributions`,
    amountRwf: payeOn(taxable, input.paye),
    side: 'employee',
  });

  return totals(lines, ordered[ordered.length - 1].id, payableDays);
}

/**
 * The amount columns from the lines (AC-Y4). Every column is a sum of its
 * lines, so the payslip can never say something its lines do not.
 */
export function totals(lines: PayslipLine[], contractId: string, payableDays: number): ComputedPayslip {
  const grossRwf = sum(lines.filter((l) => l.side === 'earning'));
  const payeRwf = sum(lines.filter((l) => l.side === 'employee' && l.code === 'paye'));
  const employeeContributionsRwf = sum(
    lines.filter((l) => l.side === 'employee' && l.code !== 'paye'),
  );
  const employerContributionsRwf = sum(lines.filter((l) => l.side === 'employer'));
  const otherDeductionsRwf = 0;
  return {
    contractId,
    payableDays,
    grossRwf,
    payeRwf,
    employeeContributionsRwf,
    employerContributionsRwf,
    otherDeductionsRwf,
    netRwf: grossRwf - payeRwf - employeeContributionsRwf - otherDeductionsRwf,
    lines,
  };
}

function sum(lines: readonly PayslipLine[]): number {
  return lines.reduce((acc, l) => acc + l.amountRwf, 0);
}
