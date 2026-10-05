import {
  eachMonth,
  firstOfMonth,
  monthOf,
  payableThirtieths,
  yearOf,
} from './hr-calendar';
import { entitlementFor, tenth, type SeniorityType } from './leave-lots';

/**
 * Which accrual rows a person is owed up to a date (ADR-058 AC-L2, 058-leave
 * AC-LV5).
 *
 * Accruing types earn from the hire date, each calendar year at that year's
 * entitlement: the base, plus seniority days earned by the year's first day. A
 * MONTHLY type earns a twelfth of the year's entitlement for each month, the
 * first month scaled by the payable thirtieths from the hire date (index
 * contract 9); a YEARLY type earns the whole year's entitlement on 1 January
 * (or the hire date). A month's accrual is credited as the month begins, so the
 * current month is already earned.
 *
 * Returned for EVERY period from the hire date to the date, not only the
 * missing ones: the ledger's unique `(employee, type, kind, period_key)` drops
 * what is already written, so a rerun, or a catch up after the job was down,
 * writes nothing twice and misses nothing.
 */

export interface AccruingType extends SeniorityType {
  accrual: 'yearly_upfront' | 'monthly' | 'none';
}

export interface DueAccrual {
  /** `YYYY-MM` for a monthly type, `YYYY` for a yearly one. */
  periodKey: string;
  days: number;
  effectiveOn: string;
}

export function dueAccruals(input: {
  type: AccruingType;
  hiredOn: string;
  /** Today in Kigali, or the last day worked for someone who has left, or a day ahead for a projection. */
  through: string;
}): DueAccrual[] {
  const { type, hiredOn, through } = input;
  if (type.yearlyEntitlementDays === null || through < hiredOn) return [];
  const out: DueAccrual[] = [];

  for (let y = yearOf(hiredOn); y <= yearOf(through); y++) {
    const entitlement = entitlementFor(type, hiredOn, y) ?? 0;
    if (entitlement <= 0) continue;
    const jan1 = `${y}-01-01`;

    if (type.accrual === 'yearly_upfront') {
      out.push({ periodKey: String(y), days: entitlement, effectiveOn: jan1 > hiredOn ? jan1 : hiredOn });
      continue;
    }

    if (type.accrual === 'monthly') {
      // Each month's row is the step in a running total within the year, not a
      // rounded twelfth: twelve rows of 21/12 rounded one by one would add to
      // 21.6, and a year must add to its entitlement exactly.
      const firstMonth = y === yearOf(hiredOn) ? monthOf(hiredOn) : `${y}-01`;
      const lastMonth = y === yearOf(through) ? monthOf(through) : `${y}-12`;
      const firstFraction = y === yearOf(hiredOn) ? payableThirtieths({ startsOn: hiredOn, endsOn: null }, firstMonth) / 30 : 1;
      let previous = 0;
      eachMonth(firstMonth, lastMonth).forEach((period, i) => {
        const cumulative = tenth((entitlement * (firstFraction + i)) / 12);
        const first = firstOfMonth(period);
        const days = tenth(cumulative - previous);
        previous = cumulative;
        if (days > 0) out.push({ periodKey: period, days, effectiveOn: first > hiredOn ? first : hiredOn });
      });
    }
  }
  return out;
}
