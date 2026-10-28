import { LOCALE } from "./format.tsx";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Rentals days are Kigali days (UTC+2, no daylight saving). */
export const KIGALI_TZ = "Africa/Kigali";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

/** The Kigali calendar day of an instant, as `yyyy-mm-dd`. Defaults to now. */
export function kigaliDay(at: Date | number = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: KIGALI_TZ }).format(at);
}

/**
 * A calendar day (`yyyy-mm-dd`, as the API sends days) or an instant, as the Kigali day it falls on.
 * Calendar days are taken as they are: "2026-10-12" is 12 October everywhere, whatever the viewer's zone.
 */
export function toKigaliDay(value: string | Date | number): string {
  if (typeof value === "string" && DAY.test(value)) return value;
  const at = typeof value === "string" ? new Date(value) : value;
  return kigaliDay(at);
}

/** Midday UTC of a calendar day: formatting it in UTC can never slip to the day before or after. */
function dayInstant(day: string): Date {
  return new Date(`${day}T12:00:00Z`);
}

export type DateStyle = "short" | "long" | "weekday" | "month";

const DATE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  /** 12 Oct 2026 */
  short: { day: "numeric", month: "short", year: "numeric" },
  /** 12 October 2026 */
  long: { day: "numeric", month: "long", year: "numeric" },
  /** Mon, 12 Oct */
  weekday: { weekday: "short", day: "numeric", month: "short" },
  /** October 2026 */
  month: { month: "long", year: "numeric" },
};

/** "12 Oct 2026" (short), "12 October 2026" (long), "Mon, 12 Oct" (weekday) or "October 2026" (month). */
export function formatDay(value: string | Date | number, style: DateStyle = "short"): string {
  return new Intl.DateTimeFormat(LOCALE, { ...DATE_OPTIONS[style], timeZone: "UTC" }).format(
    dayInstant(toKigaliDay(value)),
  );
}

/** Whole days from `from` to `to` (both Kigali days): 3 when `to` is three days later, -2 two days before. */
export function daysBetween(from: string, to: string): number {
  return Math.round((dayInstant(to).getTime() - dayInstant(from).getTime()) / MS_PER_DAY);
}

/**
 * How far a day is from today, in words: "Today", "Tomorrow", "In 3 days", "2 days ago", and months or
 * years past 60 days. `today` defaults to the Kigali day now; pass the server's day to render the same
 * words on the server and in the browser.
 */
export function relativeDay(value: string | Date | number, today: string = kigaliDay()): string {
  const days = daysBetween(today, toKigaliDay(value));
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const abs = Math.abs(days);
  const words =
    abs < 60
      ? rtf.format(days, "day")
      : abs < 730
        ? rtf.format(Math.round(days / 30.4), "month")
        : rtf.format(Math.round(days / 365.25), "year");
  return words[0].toUpperCase() + words.slice(1);
}

/** A day in the Kigali calendar, as a `<time>` element. */
export function DateText({
  value,
  style = "short",
  className,
}: {
  /** `yyyy-mm-dd` (a calendar day) or an instant (ISO string, Date, epoch ms). */
  value: string | Date | number;
  style?: DateStyle;
  className?: string;
}) {
  const day = toKigaliDay(value);
  return (
    <time dateTime={day} className={cx("whitespace-nowrap tabular", className)}>
      {formatDay(day, style)}
    </time>
  );
}

/** "In 3 days", "2 days ago", with the full date on hover and for screen readers. */
export function RelativeDay({
  value,
  today,
  className,
}: {
  value: string | Date | number;
  /** The Kigali day to count from (the server's), so the words match after hydration. */
  today?: string;
  className?: string;
}) {
  const day = toKigaliDay(value);
  const full = formatDay(day, "long");
  return (
    <time dateTime={day} title={full} className={cx("whitespace-nowrap", className)} suppressHydrationWarning>
      {relativeDay(day, today)}
      <span className="sr-only">, {full}</span>
    </time>
  );
}
