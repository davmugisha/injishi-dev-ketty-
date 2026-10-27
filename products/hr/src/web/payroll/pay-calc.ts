import { formatNumber, formatRwf } from "@injishi/ui";
import type { PayLine, PayRates } from "../../model/payroll.ts";

/** Figures of one pay line, calculated from the configured rule snapshot (as the artifact's pay run does). */
interface PayLineFigures {
  gross: number;
  paye: number;
  pension: number;
  maternity: number;
  /** Employee RSSB share (pension + maternity), rounded. */
  rssb: number;
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
