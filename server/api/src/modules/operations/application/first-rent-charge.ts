/**
 * The first month of rent a lease owes when it goes active.
 *
 * Activating a lease used to change its status and nothing else, so a tenancy
 * that had just gone live was missing from the rent roll until something else
 * raised a charge, and nothing else did. The board told the landlord "rent is
 * raised against it from now on" over a roll that did not show it.
 *
 * The month is whichever is later: the month the tenancy starts, or this
 * month. A lease signed today that started in March does not owe six back
 * months on activation. Those are a landlord's decision, not a side effect of
 * a button. A lease that starts next month owes next month.
 *
 * The due date is the 5th of that month, the date every seeded roll and the
 * blueprint use. If the 5th has already passed, the due date is five days
 * from today, so a tenancy activated on the 20th is not overdue the moment it
 * exists.
 */
export interface FirstRentCharge {
  periodMonth: string;
  dueDate: string;
  amountRwf: number;
}

const DUE_DAY_OFFSET = 4; // the 5th
const GRACE_DAYS = 5;

export function firstRentCharge(
  lease: { monthlyRentRwf: number | null; startDate: string | null },
  today: string,
): FirstRentCharge | null {
  // No agreed rent means no figure to charge. Inventing zero would put a
  // "paid" looking row on the roll for a tenancy nobody priced.
  if (lease.monthlyRentRwf === null || lease.monthlyRentRwf <= 0) return null;

  const thisMonth = `${today.slice(0, 7)}-01`;
  const startMonth = lease.startDate ? `${lease.startDate.slice(0, 7)}-01` : thisMonth;
  const periodMonth = startMonth > thisMonth ? startMonth : thisMonth;

  const fifth = addDays(periodMonth, DUE_DAY_OFFSET);
  const dueDate = fifth >= today ? fifth : addDays(today, GRACE_DAYS);

  return { periodMonth, dueDate, amountRwf: lease.monthlyRentRwf };
}

/** Today's calendar date in Kigali, where rent falls due, as YYYY-MM-DD. */
export function kigaliToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return now.toLocaleDateString('en-CA', { timeZone: 'Africa/Kigali' });
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
