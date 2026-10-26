import { type LeaseChargeView, type LeaseTermsView, rentSchedule } from "@injishi/contracts";

/** "+250788301122" as "0788 301 122"; other numbers as stored. */
export function localPhone(e164: string): string {
  const m = /^\+250(\d{3})(\d{3})(\d{3})$/.exec(e164);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : e164;
}

/**
 * The next rent not raised yet: the first month in the schedule due after today and after the last rent
 * charge already raised. Null once the lease has no month left.
 */
export function nextRent(
  terms: LeaseTermsView,
  charges: readonly LeaseChargeView[],
  today: string,
): { dueOn: string; amountRwf: number } | null {
  if (terms.monthlyRentRwf <= 0 || terms.endDate < terms.startDate) return null;
  let schedule: ReturnType<typeof rentSchedule>;
  try {
    schedule = rentSchedule({
      startDate: terms.startDate,
      endDate: terms.endDate,
      billingStartsOn: terms.billingStartsOn,
      monthlyRentRwf: terms.monthlyRentRwf,
      rentDueDay: terms.rentDueDay,
    });
  } catch {
    return null;
  }
  const raised = new Set(charges.filter((c) => c.kind === "rent" && c.periodStart).map((c) => c.periodStart));
  const next = schedule.find((s) => s.dueOn > today && !raised.has(s.periodStart));
  return next ? { dueOn: next.dueOn, amountRwf: next.amountRwf } : null;
}
