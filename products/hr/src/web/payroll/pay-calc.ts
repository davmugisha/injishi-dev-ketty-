import { formatNumber, formatRwf } from "@injishi/ui";
import type { PayLine, PayRates, PayrollContribution, PayrollContributionList } from "../../model/payroll.ts";

/** Figures of one pay line, calculated from the configured rule snapshot (as the artifact's pay run does). */
export interface PayLineFigures {
  gross: number;
  paye: number;
  pension: number;
  maternity: number;
  /** Employee RSSB share (pension + maternity), rounded. */
  rssb: number;
  /** Loans, advances and other deductions. */
  otherDeductions: number;
  /** Paid with the net and not income: a claim paid back, a loan paid out. */
  onTop: number;
  /** Gross, less PAYE, RSSB and other deductions, plus what is paid on top. */
  net: number;
  /** Employer pension, maternity and occupational hazards. */
  employer: number;
}

/** PAYE on monthly taxable pay, band by band. */
function payeFor(gross: number, rates: PayRates): number {
  let tax = 0;
  let lower = 0;
  for (const band of rates.payeBands) {
    const upper = band.upTo ?? Number.POSITIVE_INFINITY;
    if (gross > lower) tax += (Math.min(gross, upper) - lower) * band.rate;
    lower = upper;
  }
  return Math.round(tax);
}

export function payLineFigures(line: PayLine, rates: PayRates): PayLineFigures {
  const gross = line.base + line.allowances + line.other;
  const paye = payeFor(gross, rates);
  const pension = gross * rates.pension;
  const maternity = gross * rates.maternity;
  const rssb = Math.round(pension + maternity);
  return {
    gross,
    paye,
    pension,
    maternity,
    rssb,
    otherDeductions: line.loan,
    onTop: 0,
    net: gross - paye - rssb - line.loan,
    employer: gross * (rates.pension + rates.maternity + rates.occupationalHazards),
  };
}

/** Whole-franc amount without currency ("180,000"), or an em dash for nothing. */
export function amount(value: number, dashWhenZero = false): string {
  if (dashWhenZero && !value) return "—";
  return formatNumber(Math.round(value));
}

/** "RWF 118,400", rounded to whole francs. */
export function rwf(value: number): string {
  return formatRwf(Math.round(value));
}

/** Rate as a percentage ("6%", "0.3%"). */
export function pct(rate: number): string {
  return formatNumber(rate, { style: "percent", maximumFractionDigits: 1 });
}

/** Deduction ("− RWF 93,000") or addition ("+ RWF 30,000"). */
export function signedRwf(value: number, sign: "+" | "−"): string {
  return `${sign} ${rwf(value)}`;
}

/** One colour per scheme, in the order the rules list them. */
const SCHEME_COLORS = [
  "var(--chart-1)",
  "var(--chart-5)",
  "var(--chart-4)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-other)",
];

/**
 * What one monthly salary comes to under the business's rules: each scheme's two shares, PAYE as
 * the rule in force says, the take-home and what the business pays in all.
 */
export function simulatePay(list: PayrollContributionList, salary: number) {
  const rows: { code: string; label: string; employee: number; employer: number; color: string }[] = [];
  const on = list.contributions.filter((c) => c.enabled);
  const colorOf = (code: string) =>
    SCHEME_COLORS[
      Math.max(
        0,
        list.contributions.findIndex((c) => c.code === code),
      ) % SCHEME_COLORS.length
    ];
  const share = (c: PayrollContribution, base: number) => {
    const b = c.capRwf ? Math.min(base, c.capRwf) : base;
    rows.push({
      code: c.code,
      label: c.label,
      employee: Math.round(b * c.employeeRate),
      employer: Math.round(b * c.employerRate),
      color: colorOf(c.code),
    });
  };
  for (const c of on) if (c.base !== "net") share(c, salary);
  const before = rows.reduce((t, r) => t + r.employee, 0);
  const taxable = list.paye?.taxableBase.includes("less_employee") ? salary - before : salary;
  let paye = 0;
  for (const band of list.paye?.bands ?? []) {
    const top = band.toRwf ?? Number.POSITIVE_INFINITY;
    if (taxable > band.fromRwf) paye += (Math.min(taxable, top) - band.fromRwf) * band.rate;
  }
  paye = Math.round(paye);
  for (const c of on) if (c.base === "net") share(c, Math.max(0, salary - before - paye));
  if (list.privateHealth.enabled) {
    rows.push({
      code: "private_health",
      label: list.privateHealth.provider ? `Health insurance (${list.privateHealth.provider})` : "Health insurance",
      employee: list.privateHealth.employeeAmountRwf,
      employer: list.privateHealth.employerAmountRwf,
      color: SCHEME_COLORS[5],
    });
  }
  const employee = rows.reduce((t, r) => t + r.employee, 0);
  const employer = rows.reduce((t, r) => t + r.employer, 0);
  return { rows, paye, employee, employer, takeHome: salary - paye - employee, cost: salary + employer };
}
