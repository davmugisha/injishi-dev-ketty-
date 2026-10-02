import {
  eachMonth,
  firstOfMonth,
  monthOf,
  payableThirtieths,
  yearOf,
} from './hr-calendar';

/**
 * Which accrual rows a person is owed up to today (ADR-058 AC-L2).
 *
 * Accruing types earn from the hire date. A MONTHLY type earns a twelfth of the
 * yearly entitlement for each month, the first month scaled by the payable
 * thirtieths from the hire date (index contract 9); a YEARLY type earns its
 * whole entitlement for each calendar year. A month's accrual is credited as the
 * month begins (or on the hire date, in the first month), so the current month
 * is already earned.
 *
 * Returned for EVERY period from the hire date to today, not only the missing
 * ones: the ledger's unique `(employee, type, kind, period_key)` drops what is
 * already written, so a rerun, or a catch up after the job was down, writes
 * nothing twice and misses nothing.
 */

export interface AccruingType {
  accrual: 'yearly_upfront' | 'monthly' | 'none';
  yearlyEntitlementDays: number | null;
}

export interface DueAccrual {
  /** `YYYY-MM` for a monthly type, `YYYY` for a yearly one. */
  periodKey: string;
  days: number;
  effectiveOn: string;
}

/** Days to one decimal, the ledger's precision. */
function tenth(value: number): number {
  return Math.round(value * 10) / 10;
}

export function dueAccruals(input: {
  type: AccruingType;
  hiredOn: string;
  /** Today in Kigali, or the last day worked for someone who has left. */
  through: string;
}): DueAccrual[] {
  const { type, hiredOn, through } = input;
  const entitlement = type.yearlyEntitlementDays;
  if (entitlement === null || entitlement <= 0 || through < hiredOn) return [];

  if (type.accrual === 'yearly_upfront') {
    const out: DueAccrual[] = [];
    for (let y = yearOf(hiredOn); y <= yearOf(through); y++) {
      const jan1 = `${y}-01-01`;
      out.push({
        periodKey: String(y),
        days: entitlement,
        effectiveOn: jan1 > hiredOn ? jan1 : hiredOn,
      });
    }
    return out;
  }

  if (type.accrual === 'monthly') {
    // Each month's row is the step in a rounded running total, not a rounded
    // twelfth: twelve rows of 21/12 rounded one by one would add to 21.6, and a
    // balance must add to the entitlement exactly.
    const months = eachMonth(monthOf(hiredOn), monthOf(through));
    const firstFraction = payableThirtieths({ startsOn: hiredOn, endsOn: null }, months[0]) / 30;
    const out: DueAccrual[] = [];
    let previous = 0;
    months.forEach((period, i) => {
      const earnedMonths = firstFraction + i;
      const cumulative = tenth((entitlement * earnedMonths) / 12);
      const first = firstOfMonth(period);
      out.push({
        periodKey: period,
        days: tenth(cumulative - previous),
        effectiveOn: first > hiredOn ? first : hiredOn,
      });
      previous = cumulative;
    });
    return out.filter((a) => a.days > 0);
  }

  return [];
}
