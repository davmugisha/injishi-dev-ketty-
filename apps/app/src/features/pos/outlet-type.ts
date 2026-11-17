/**
 * What kind of outlet this is, read from the preparation stations it actually has (no separate setting to keep in
 * step): kitchen only is a restaurant, bar only is a bar, both is a restaurant and bar. Everything that names the
 * kitchen or the bar (the till's Send button, the kitchen and bar display, the sidebar, the dashboard, setup) asks
 * these functions, so an outlet never shows a station it does not have.
 *
 * Routing never guesses from what an item is called: an item goes to the station set for it in Setup. Only an outlet
 * with one kind of station sends an item with no station there (the API does the same when the order is sent); an
 * outlet with both leaves it with no station, and no ticket, until the owner sets one.
 */
export type StationKind = "kitchen" | "bar";
export type OutletType = "restaurant" | "bar" | "restaurant_bar" | "none";

export const OUTLET_TYPE_LABEL: Readonly<Record<OutletType, string>> = {
  restaurant: "Restaurant",
  bar: "Bar",
  restaurant_bar: "Restaurant + Bar",
  none: "No kitchen or bar yet",
};

const STATION_LABEL: Readonly<Record<StationKind, string>> = { kitchen: "Kitchen", bar: "Bar" };

/** The kinds of the stations an outlet has (archived stations are not listed by the API). */
export function kindsOf(stations: readonly { kind: StationKind }[]): Set<StationKind> {
  return new Set(stations.map((s) => s.kind));
}

export function outletTypeOf(kinds: ReadonlySet<StationKind>): OutletType {
  const kitchen = kinds.has("kitchen");
  const bar = kinds.has("bar");
  if (kitchen && bar) return "restaurant_bar";
  if (kitchen) return "restaurant";
  if (bar) return "bar";
  return "none";
}

/** The one station kind of a single-station outlet (kitchen only or bar only), else null. */
export function onlyKind(kinds: ReadonlySet<StationKind>): StationKind | null {
  return kinds.size === 1 ? ([...kinds][0] ?? null) : null;
}

/** "Kitchen", "Bar" or "Kitchen and bar": the name of the preparation screens of an outlet. */
export function stationsName(kinds: ReadonlySet<StationKind> | null): string {
  if (!kinds || kinds.size === 0 || kinds.size === 2) return "Kitchen and bar";
  return kinds.has("bar") ? "Bar" : "Kitchen";
}

/** Who prepares at those stations, for the service flow. */
export function stationsCrew(kinds: ReadonlySet<StationKind> | null): string {
  if (!kinds || kinds.size === 0 || kinds.size === 2) return "Chef, bartender";
  return kinds.has("bar") ? "Bartender" : "Chef";
}

/**
 * Where a line will be prepared: its own station's kind; with no station, the outlet's only kind when it has one,
 * else null ("No station set").
 */
export function destinationOf(stationKind: StationKind | null, kinds: ReadonlySet<StationKind>): StationKind | null {
  return stationKind ?? onlyKind(kinds);
}

const items = (n: number) => `${n} item${n === 1 ? "" : "s"}`;

export interface SendPlan {
  /** The button: "Send to Kitchen" (restaurant), "Send to Bar" (bar), "Send Order" (restaurant and bar, or none). */
  label: string;
  /** The routing summary, one line each: "1 item → Kitchen", "2 items → Bar", "1 item → No station set". */
  lines: string[];
  /** The confirmation after sending. */
  done: string;
}

/**
 * The till's Send button for the lines not sent yet. Each waiting line brings its station kind (null when the item
 * has no station) and its quantity; the summary counts quantities.
 */
export function sendPlan(
  outletKinds: ReadonlySet<StationKind>,
  waiting: readonly { kind: StationKind | null; quantity: number }[],
): SendPlan {
  const count = { kitchen: 0, bar: 0, none: 0 };
  for (const w of waiting) {
    const to = destinationOf(w.kind, outletKinds);
    count[to ?? "none"] += w.quantity;
  }
  const lines = [
    count.kitchen ? `${items(count.kitchen)} → Kitchen` : "",
    count.bar ? `${items(count.bar)} → Bar` : "",
    count.none ? `${items(count.none)} → No station set` : "",
  ].filter(Boolean);
  const only = onlyKind(outletKinds);
  if (only) {
    return { label: `Send to ${STATION_LABEL[only]}`, lines, done: `Order sent to ${STATION_LABEL[only]}` };
  }
  const parts = [
    count.kitchen ? `${items(count.kitchen)} to Kitchen` : "",
    count.bar ? `${items(count.bar)} to Bar` : "",
    count.none ? `${items(count.none)} with no station set` : "",
  ].filter(Boolean);
  return {
    label: "Send Order",
    lines,
    done: parts.length ? `Order sent successfully: ${parts.join(" · ")}` : "Order sent successfully",
  };
}

/**
 * The station an item with no station should be set to in Setup: in a single-station outlet the first station of its
 * one kind (unambiguous); in an outlet with both kinds, or none, nothing is suggested.
 */
export function suggestStation<S extends { id: string; kind: StationKind }>(stations: readonly S[]): S | null {
  return onlyKind(kindsOf(stations)) ? (stations[0] ?? null) : null;
}
