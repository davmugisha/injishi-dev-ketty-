/**
 * The small formatters the stay screens share.
 *
 * They are here rather than inline at four call sites because the same date
 * appearing as "6 September 2026" on the hub and "2026-09-06" on the order
 * screen is the kind of thing nobody notices until a stakeholder does.
 *
 * NOTHING HERE READS THE CLOCK. Every function takes the string it is asked to
 * render and returns a value derived only from it, so the server render and the
 * first client render agree. `formatOrderTime` is the one that touches a
 * timezone, and it names one explicitly — see the note on it.
 */

/**
 * Spelled out rather than taken from `toLocaleDateString`.
 *
 * Node and the browser ship different ICU data, and a month name that differs
 * between the two is a hydration mismatch React repairs by throwing the subtree
 * away. A twelve-entry table cannot disagree with itself.
 */
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2026-09-06" becomes "6 September 2026". An unparseable value is returned as-is. */
export function formatStayDate(iso: string): string {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const month = MONTHS[Number(parts[1]) - 1];
  if (month === undefined) return iso;
  return `${Number(parts[2])} ${month} ${parts[0]}`;
}

/** "6 – 11 September 2026" where the month is shared, both dates in full otherwise. */
export function formatStayRange(checkIn: string, checkOut: string): string {
  const from = checkIn.split("-");
  const to = checkOut.split("-");
  if (from.length !== 3 || to.length !== 3) return `${checkIn} – ${checkOut}`;
  if (from[0] === to[0] && from[1] === to[1]) {
    return `${Number(from[2])} – ${formatStayDate(checkOut)}`;
  }
  return `${formatStayDate(checkIn)} – ${formatStayDate(checkOut)}`;
}

/**
 * How many nights the stay runs for.
 *
 * `Date.UTC` on the parsed parts rather than `new Date(iso)`: the latter is
 * parsed as UTC midnight in some engines and local midnight in others, and an
 * off-by-one night is exactly the sort of error a hotelier spots on stage.
 */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const from = checkIn.split("-").map(Number);
  const to = checkOut.split("-").map(Number);
  if (from.length !== 3 || to.length !== 3 || from.some(Number.isNaN) || to.some(Number.isNaN)) {
    return 0;
  }
  const ms =
    Date.UTC(to[0], to[1] - 1, to[2]) - Date.UTC(from[0], from[1] - 1, from[2]);
  return Math.max(0, Math.round(ms / 86_400_000));
}

/**
 * The clock time on an order, read in Kigali.
 *
 * `placedAt` is a UTC instant, and a guest in a Kigali hotel room reading
 * "17:42" for an order they placed at 19:42 would reasonably conclude the
 * feature is broken. The zone is named rather than left to the machine because
 * a demo is often given on a laptop that never left another continent.
 *
 * Safe to call during a render only because every order is read from storage in
 * an effect, so the server never renders one of these.
 */
const KIGALI_TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Kigali",
});

export function formatOrderTime(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return KIGALI_TIME.format(at);
}

/** "1 item" / "3 items" — the one wording for a cart count. */
export function itemCountLabel(count: number): string {
  return `${count} ${count === 1 ? "item" : "items"}`;
}
