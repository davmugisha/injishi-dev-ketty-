/**
 * Formatting shared by the live sources: real values from the API turned into the strings the
 * interface's documents carry ("12 Oct", "09:40", "RWF 85,000"). Kigali time throughout.
 */

const TZ = "Africa/Kigali";

/** "09:40" for an instant, in Kigali. */
export function clock(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(iso),
  );
}

/** The Kigali calendar day of an instant, "2026-10-15". */
export function kigaliDate(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso),
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "12 Oct" for a calendar date (YYYY-MM-DD) or an instant. */
export function dayMonth(value: string | Date): string {
  const iso = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : kigaliDate(value);
  return `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
}

/** "4 Mar 2024". */
export function dayMonthYear(value: string | Date): string {
  const iso = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : kigaliDate(value);
  return `${dayMonth(iso)} ${iso.slice(0, 4)}`;
}

/** "RWF 85,000" for whole francs. */
export function rwf(amount: number): string {
  return `RWF ${Math.round(amount).toLocaleString("en-US")}`;
}
