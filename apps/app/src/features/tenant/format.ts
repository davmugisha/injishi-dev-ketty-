import { type LeaseChargeView, type LeaseTermsView, rentSchedule } from "@injishi/contracts";

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
