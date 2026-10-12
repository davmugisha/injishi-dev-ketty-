import {
  type FacilityOutlet,
  type OrderingAccess,
  type OutletKind,
  type PropertyFacility,
} from "@injishi/contracts";

/**
 * What a property on the platform says it offers, read from the API
 * (ADR-050 D-k, AC-16).
 *
 * ## One list, and it is the server's
 *
 * `PropertyDetail.facilities` is already the union of the property's amenities
 * and its guest visible outlets, deduped by the link between them: a pool that
 * also sells day passes arrives as ONE entry carrying both faces. It is also
 * already filtered — an inactive outlet, a hidden one, and a tenant outlet whose
 * tenancy is not active never reach this file (AC-18). Nothing here re-derives
 * either. Joining or filtering again in the browser would be a second answer to
 * a question the server has already settled, and the two would drift.
 *
 * The property page receives the list with the rest of the property, read on
 * the server (`data/public-property.ts`), so nothing here fetches.
 */

/**
 * Who may order from an outlet, in words a guest reads.
 *
 * Written as a `Record` over the contract's union, so a fourth access mode
 * fails the build here rather than printing an empty line. The server enforces
 * it at order time (D-k); this only tells the guest before they walk over.
 */
export const ORDERING_ACCESS_LABEL: Record<OrderingAccess, string> = {
  in_house_only: "For staying guests, charged to the room",
  walk_in_only: "Open to everyone, pay when you order",
  both: "Open to everyone, and staying guests can charge it to the room",
};

/** What an outlet's kind is called in prose. */
export const OUTLET_KIND_LABEL: Record<OutletKind, string> = {
  restaurant: "Restaurant",
  bar: "Bar",
  lounge: "Lounge",
  banquet: "Events",
  room_service: "Room service",
  spa: "Spa",
  gym: "Gym",
  pool: "Pool",
  gift_shop: "Shop",
  parking: "Parking",
  laundry: "Laundry",
  business_center: "Business centre",
  other: "On site",
};

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_LABEL: Record<(typeof DAYS)[number], string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/** One day's windows as text, or null when the stored value is unreadable. */
function dayWindows(value: unknown): string | null {
  const isWindow = (w: unknown): w is [string, string] =>
    Array.isArray(w) &&
    w.length === 2 &&
    typeof w[0] === "string" &&
    typeof w[1] === "string" &&
    CLOCK.test(w[0]) &&
    CLOCK.test(w[1]);

  if (isWindow(value)) return `${value[0]}–${value[1]}`;
  if (Array.isArray(value) && value.length > 0 && value.every(isWindow)) {
    return value.map((w) => `${w[0]}–${w[1]}`).join(", ");
  }
  return null;
}

/**
 * An outlet's service hours as one short line, or null.
 *
 * Reads the shape `OutletHoursInput` writes: a day key holding one window or a
 * list of them; a day with no key is closed. Consecutive days with the same
 * windows are run together ("Mon–Fri 07:00–22:00"), and seven identical days
 * read as "Daily". The READ shape is deliberately loose (rows written before the
 * schema existed must still read), so anything this cannot parse is skipped, and
 * hours that yield nothing return null rather than a guess.
 *
 * Null hours also return null. The API reads null as "always open", but on a
 * property page it is far more often a host who has not entered hours yet, and
 * "Open 24 hours" printed over a restaurant that closes at ten is a promise the
 * page cannot keep. Saying nothing is the honest reading.
 */
export function hoursSummary(hours: FacilityOutlet["hours"]): string | null {
  if (!hours || typeof hours !== "object") return null;
  const record = hours as Record<string, unknown>;

  const perDay = DAYS.map((day) => ({ day, text: dayWindows(record[day]) }));
  if (perDay.every((d) => d.text === null)) return null;

  if (perDay.every((d) => d.text !== null && d.text === perDay[0].text)) {
    return `Daily ${perDay[0].text}`;
  }

  const runs: { from: string; to: string; text: string }[] = [];
  for (const { day, text } of perDay) {
    if (text === null) continue;
    const last = runs[runs.length - 1];
    const previousDay = DAYS[DAYS.indexOf(day) - 1];
    if (last && last.text === text && last.to === previousDay) {
      last.to = day;
    } else {
      runs.push({ from: day, to: day, text });
    }
  }

  return runs
    .map((run) =>
      run.from === run.to
        ? `${DAY_LABEL[run.from as keyof typeof DAY_LABEL]} ${run.text}`
        : `${DAY_LABEL[run.from as keyof typeof DAY_LABEL]}–${DAY_LABEL[run.to as keyof typeof DAY_LABEL]} ${run.text}`,
    )
    .join(" · ");
}
