import type { BadgeIntent } from "@/lib/types";

/**
 * The console's shared vocabulary for turning a fact into something readable.
 *
 * The API sends domain shapes only — integer francs, ISO instants, enum
 * members — and never a formatted string, because "RWF 45,000" cannot be
 * summed, sorted or compared. Every one of those values becomes text HERE, so
 * two screens cannot format the same number two ways.
 *
 * Nothing in this file invents a fact. It rewrites values it was given and
 * returns {@link EMPTY} when it was given none.
 */

/**
 * What a missing value looks like.
 *
 * An em dash, never "0", never "". `null` means the platform has no value for
 * this field, and rendering that as a zero states a figure nobody measured.
 */
export const EMPTY = "—";

/**
 * The locale every number and date in this console is written in.
 *
 * One constant so a figure cannot be grouped one way on the overview and
 * another way in finance.
 */
const LOCALE = "en-RW";

/**
 * Money, from the integer francs and the currency tag the API sent.
 *
 * The currency comes from the row rather than being hardcoded to RWF. v1 is
 * single-currency, but a hardcoded prefix would print the wrong symbol in
 * silence on the day that stops being true, and a wrong currency on a money
 * screen is the most expensive kind of wrong.
 */
export function money(amountRwf: number | null, currency: string): string {
  if (amountRwf === null) return EMPTY;
  return `${currency} ${amountRwf.toLocaleString(LOCALE)}`;
}

/** A plain count. */
export function count(value: number | null): string {
  if (value === null) return EMPTY;
  return value.toLocaleString(LOCALE);
}

/** A percentage the API sent as a number (0–100, not a ratio). */
export function percent(value: number | null, fractionDigits = 1): string {
  if (value === null) return EMPTY;
  return `${value.toFixed(fractionDigits)}%`;
}

/** A rate the API sent as a ratio (0–1), such as `errorRate`. */
export function rate(value: number | null, fractionDigits = 1): string {
  if (value === null) return EMPTY;
  return `${(value * 100).toFixed(fractionDigits)}%`;
}

/**
 * Monogram for an avatar tile.
 *
 * Derived from the name the API sent, which is why it is here and not on the
 * wire: initials are a rendering of a name, not a second fact about a business.
 */
export function initialsOf(name: string): string {
  const words = name
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0]!.slice(0, 1);
  const second = words.length > 1 ? words[1]!.slice(0, 1) : "";
  return (first + second).toUpperCase();
}

/**
 * A date, in UTC.
 *
 * UTC rather than the viewer's zone on purpose. These pages render on the
 * server; formatting in the server's local zone would print one date to a
 * staffer in Kigali and another to the same staffer's colleague abroad, and an
 * audit trail whose dates depend on who is reading it is not an audit trail.
 */
const DATE = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const DATE_TIME = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  hour12: false,
});

function parse(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `12 Aug 2026`, or {@link EMPTY}. */
export function date(iso: string | null): string {
  const d = parse(iso);
  return d ? DATE.format(d) : EMPTY;
}

/** `12 Aug 2026, 14:05` UTC, or {@link EMPTY}. */
export function dateTime(iso: string | null): string {
  const d = parse(iso);
  return d ? `${DATE_TIME.format(d)} UTC` : EMPTY;
}

/**
 * How long ago, in the units a queue is read in: `31 h`, `3 d`.
 *
 * The review queue's whole job is to show what has been waiting too long, and
 * "submitted 11 Aug" does not answer that question at a glance the way "3 d"
 * does. Computed at render time on the server, which is fine because these
 * pages are never cached — `cache: "no-store"` in `lib/api/server.ts`.
 */
export function elapsed(iso: string | null, now: Date = new Date()): string {
  const d = parse(iso);
  if (!d) return EMPTY;
  const minutes = Math.floor((now.getTime() - d.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

/**
 * Period-on-period movement, and the colour it earns.
 *
 * `goodDirection` is a REQUIRED argument, not a default. The contract sends a
 * previous value and no polarity, so nothing on the wire says whether a rise is
 * good news. Colouring every rise green would paint a climbing failed-charge
 * count as a success, so each caller states what "better" means for the figure
 * it is showing — and where the platform genuinely has no opinion, it says
 * `"none"` and gets a neutral badge with the direction still visible.
 *
 * Returns `null` when there is no previous value: a badge reading "+0%" against
 * a period that does not exist is a comparison nobody made.
 */
export function movement(
  current: number | null,
  previous: number | null,
  goodDirection: "up" | "down" | "none",
): { text: string; intent: BadgeIntent; trendingUp?: boolean } | null {
  if (current === null || previous === null) return null;

  if (previous === 0) {
    // A percentage change from zero is undefined, not infinite. Say what
    // actually happened instead of printing a number that means nothing.
    if (current === 0) return { text: "no change", intent: "default" };
    return {
      text: "new",
      intent: goodDirection === "up" ? "success" : "default",
      trendingUp: true,
    };
  }

  const delta = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = Math.round(delta);
  if (rounded === 0) return { text: "no change", intent: "default" };

  const up = rounded > 0;
  const text = `${up ? "+" : ""}${rounded}%`;

  if (goodDirection === "none") {
    return { text, intent: "default", trendingUp: up };
  }
  const good = goodDirection === "up" ? up : !up;
  return {
    text,
    intent: good ? "success" : "danger",
    trendingUp: up,
  };
}

/**
 * Join the parts of a detail line, dropping the ones the API did not send.
 *
 * Absence must not leave a dangling separator: `"rejected ·  · 3 d"` reads as a
 * value that failed to load rather than one that was never there.
 */
export function detail(...parts: (string | null | undefined | false)[]): string {
  return parts.filter((p): p is string => Boolean(p)).join(" · ");
}

/**
 * Turn a snake_case enum member into words.
 *
 * Only for enums whose members are self-describing (`registrant_held`,
 * `rent_settle`). Where the platform already owns a label table for an enum —
 * `ACCOMMODATION_CLASS_LABEL`, `REJECTION_REASON_LABEL`, `PERMISSION_LABEL` —
 * use that table instead. A second wording of the same enum is a fact with two
 * owners, and the two drift.
 */
export function humanise(value: string): string {
  return value.replace(/_/g, " ");
}

/** `null` reaches the presentation types as `undefined`; they use optionals. */
export function optional<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}
