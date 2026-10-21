/**
 * The long weekend "When to go" suggests for a month (`components/home/when-to-go.tsx`).
 *
 * It used to take the first Friday on or after the 10th, in the next year that
 * Friday still lay ahead. The band opens on the CURRENT month, so from about
 * the 10th onwards the suggestion was a year away while its label read only
 * "Fri 15 Oct – Mon 18 Oct": on 21 October 2026 the button promised what looked
 * like last week and searched October 2027. Now the current month offers its
 * next Friday while one is left, and a weekend in another year says the year.
 */

/** How many nights the suggestion covers: Friday to Monday. */
export const LONG_WEEKEND_NIGHTS = 3;

const iso = (date: Date) => date.toISOString().slice(0, 10);

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** The first Friday on or after `date`. */
function fridayFrom(date: Date): Date {
  return addDays(date, (5 - date.getUTCDay() + 7) % 7);
}

/**
 * A Friday-to-Monday weekend in `month` (0 for January), never starting on or
 * before `today` (an ISO date in Kigali).
 *
 * The current month offers its next Friday while one remains in it; any other
 * month offers its first Friday on or after the 10th, this year if that is
 * still ahead and next year if not.
 */
export function longWeekendIn(month: number, today: string): { checkIn: string; checkOut: string } {
  const year = Number(today.slice(0, 4));
  const thisMonth = Number(today.slice(5, 7)) - 1;

  const candidates: Date[] = [];
  if (month === thisMonth) {
    candidates.push(fridayFrom(addDays(new Date(`${today}T00:00:00Z`), 1)));
  }
  candidates.push(fridayFrom(new Date(Date.UTC(year, month, 10))));
  candidates.push(fridayFrom(new Date(Date.UTC(year + 1, month, 10))));

  const start = candidates.find((date) => iso(date) > today && date.getUTCMonth() === month);
  if (!start) throw new Error("unreachable: next year's month always lies ahead");
  return { checkIn: iso(start), checkOut: iso(addDays(start, LONG_WEEKEND_NIGHTS)) };
}

/** "Fri 23 Oct", or "Fri 15 Oct 2027" when the date is not in `today`'s year. */
export function formatWeekendDay(isoDate: string, today: string): string {
  const sameYear = isoDate.slice(0, 4) === today.slice(0, 4);
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
}
