/** Today in Kigali, for an export's file name and subtitle. */
export function kigaliToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kigali" }).format(new Date());
}
