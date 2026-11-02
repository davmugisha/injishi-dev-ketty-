/**
 * The arithmetic of a broker's commission (0127), as pure functions so each is tested on its own. Dates are
 * Kigali calendar days, `YYYY-MM-DD`; money is whole francs.
 */

function noon(day: string): number {
  return Date.parse(`${day}T12:00:00Z`);
}

/**
 * The nights a guest actually stayed (the owner's call: the commission is on these, not on the nights
 * booked). From the booked check-in to the day they checked out, at least one night (a guest who checks
 * out the morning they arrived still had the room) and at most the nights booked (a late check-out is not
 * an extra night sold).
 */
export function nightsStayed(checkIn: string, checkOut: string, checkedOutOn: string): number {
  const booked = Math.max(1, Math.round((noon(checkOut) - noon(checkIn)) / 86_400_000));
  const stayed = Math.round((noon(checkedOutOn) - noon(checkIn)) / 86_400_000);
  return Math.min(booked, Math.max(1, stayed));
}

/** A percent deal's commission on a stay: basis points of the room price for the nights stayed. */
export function percentCommission(baseRwf: number, percentBp: number): number {
  return Math.max(0, Math.round((baseRwf * percentBp) / 10_000));
}

/** One commission a hotel still owes something on, oldest first. */
export interface Owed {
  id: string;
  owedRwf: number;
}

/**
 * Take what a hotel owes out of the money a check-out is about to pay it, oldest commission first, each in
 * full when the money allows and in part when it runs out. What is left is the hotel's payout.
 */
export function allocate(payoutRwf: number, owed: readonly Owed[]): { deductions: { id: string; amountRwf: number }[]; remainingRwf: number } {
  let left = Math.max(0, payoutRwf);
  const deductions: { id: string; amountRwf: number }[] = [];
  for (const o of owed) {
    if (left <= 0) break;
    const take = Math.min(left, Math.max(0, o.owedRwf));
    if (take <= 0) continue;
    deductions.push({ id: o.id, amountRwf: take });
    left -= take;
  }
  return { deductions, remainingRwf: left };
}

/** The Kigali calendar day of an instant. */
export function kigaliDay(at: Date): string {
  return new Date(at.getTime() + 2 * 3_600_000).toISOString().slice(0, 10);
}
