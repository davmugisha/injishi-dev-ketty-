import type { OrderType, PosTicket, TicketStatus } from "../../server/pos";

/**
 * The rules of the kitchen display, kept free of React so they can be tested on their own: how long a ticket has
 * waited, how urgent that is, which ticket comes first, which tickets a filter keeps, and the limits a kitchen sets.
 */

/** Minutes after which a ticket turns orange and after which it is overdue (red). */
export interface KdsLimits {
  warnMinutes: number;
  lateMinutes: number;
}

/** The server draws a ticket late at 15 minutes (`TICKET_LATE_MINUTES`); the display starts from the same figure. */
export const DEFAULT_LIMITS: KdsLimits = { warnMinutes: 10, lateMinutes: 15 };
export const LIMIT_MIN = 1;
export const LIMIT_MAX = 240;

export type Urgency = "normal" | "warning" | "late";
export const URGENCY_RANK: Readonly<Record<Urgency, number>> = { normal: 0, warning: 1, late: 2 };

/** The two separate displays: the kitchen shows the food stations, the bar shows the drinks stations. */
export type KdsStation = "kitchen" | "bar";
export const STATION_NAME: Readonly<Record<KdsStation, string>> = { kitchen: "Kitchen", bar: "Bar" };

/** Inside a display: every order, only the ones eaten in, or only the ones taken away. */
export type OrderFilter = "all" | "dine_in" | "takeaway";
export const ORDER_FILTERS: readonly { id: OrderFilter; label: string }[] = [
  { id: "all", label: "All orders" },
  { id: "dine_in", label: "Dine in" },
  { id: "takeaway", label: "Takeaway" },
];

/** `?kind=` of the older links (and the words a person would type) opens the matching display. Anything else is the kitchen. */
/**
 * Whether a kitchen note warns of an allergy or intolerance (so the display can flag it in red). Matches the words
 * staff actually type: "allergy", "allergic", "nut-free", "no peanuts", "gluten", "celiac", "lactose", "shellfish"…
 */
export function mentionsAllergy(note: string | null | undefined): boolean {
  if (!note) return false;
  return /\b(allerg\w*|anaphyla\w*|nut|nuts|peanuts?|tree ?nuts?|gluten|coeliac|celiac|lactose|dairy|shellfish|sesame|soy|eggs?)\b|nut-free/i.test(
    note,
  );
}

export function parseStation(kind: string | undefined): KdsStation {
  return kind === "bar" || kind === "drinks" ? "bar" : "kitchen";
}

export const ORDER_TYPE_LABEL: Readonly<Record<OrderType, string>> = {
  dine_in: "Dine in",
  takeaway: "Takeaway",
  delivery: "Delivery",
  room_service: "Room service",
  event: "Event",
};

/** Why a pair of limits cannot be used, or null when it can. */
export function limitsError(warn: number, late: number): string | null {
  const whole = (n: number) => Number.isInteger(n) && n >= LIMIT_MIN && n <= LIMIT_MAX;
  if (!whole(warn) || !whole(late)) return `Use whole minutes from ${LIMIT_MIN} to ${LIMIT_MAX}.`;
  if (warn >= late) return "Orange must start before the order is overdue.";
  return null;
}

/** Limits read back from storage: anything unusable falls back to the defaults instead of breaking the screen. */
export function readLimits(raw: unknown): KdsLimits {
  if (raw && typeof raw === "object") {
    const { warnMinutes, lateMinutes } = raw as Record<string, unknown>;
    if (typeof warnMinutes === "number" && typeof lateMinutes === "number" && !limitsError(warnMinutes, lateMinutes)) {
      return { warnMinutes, lateMinutes };
    }
  }
  return { ...DEFAULT_LIMITS };
}

/**
 * How long a ticket has been waiting, in whole seconds. A ticket still being made is timed from the moment it was
 * sent; one waiting at the pass is timed from the moment it became ready (a plate going cold is the urgent thing then).
 * A ticket that is finished stops counting.
 */
export function waitSeconds(
  t: Pick<PosTicket, "status" | "createdAt" | "readyAt" | "servedAt">,
  nowMs: number,
): number {
  const from = t.status === "ready" && t.readyAt ? Date.parse(t.readyAt) : Date.parse(t.createdAt);
  const to =
    t.status === "served" || t.status === "cancelled" ? Date.parse(t.servedAt ?? t.readyAt ?? t.createdAt) : nowMs;
  return Math.max(0, Math.floor((to - from) / 1000));
}

export function urgencyOf(status: TicketStatus, seconds: number, limits: KdsLimits): Urgency {
  if (status === "served" || status === "cancelled") return "normal";
  if (seconds >= limits.lateMinutes * 60) return "late";
  if (seconds >= limits.warnMinutes * 60) return "warning";
  return "normal";
}

/** How late a ticket is, for its card: minutes under an hour and a half, then hours and minutes. */
export function lateBy(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  if (m < 90) return `+${m} min`;
  return `+${Math.floor(m / 60)} h ${m % 60} min`;
}

/** Overdue first, then orange, then the rest; inside each group the order that has waited longest comes first. */
export function byPriority(limits: KdsLimits, nowMs: number) {
  return (a: PosTicket, b: PosTicket): number => {
    const ua = URGENCY_RANK[urgencyOf(a.status, waitSeconds(a, nowMs), limits)];
    const ub = URGENCY_RANK[urgencyOf(b.status, waitSeconds(b, nowMs), limits)];
    if (ua !== ub) return ub - ua;
    const ta = Date.parse(a.createdAt);
    const tb = Date.parse(b.createdAt);
    return ta !== tb ? ta - tb : a.ticketNumber.localeCompare(b.ticketNumber);
  };
}

export function inStation(t: Pick<PosTicket, "stationKind">, station: KdsStation): boolean {
  return t.stationKind === station;
}

export function matchesFilter(t: Pick<PosTicket, "orderType">, filter: OrderFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "dine_in":
      return t.orderType === "dine_in";
    case "takeaway":
      return t.orderType === "takeaway";
  }
}

/** How many tickets each display holds (for the Kitchen / Bar switch). */
export function stationCounts(tickets: Pick<PosTicket, "stationKind">[]): Record<KdsStation, number> {
  return {
    kitchen: tickets.filter((t) => inStation(t, "kitchen")).length,
    bar: tickets.filter((t) => inStation(t, "bar")).length,
  };
}

/** How many of one display's tickets each filter keeps. */
export function filterCounts(tickets: Pick<PosTicket, "orderType">[]): Record<OrderFilter, number> {
  return {
    all: tickets.length,
    dine_in: tickets.filter((t) => matchesFilter(t, "dine_in")).length,
    takeaway: tickets.filter((t) => matchesFilter(t, "takeaway")).length,
  };
}

/** "Crust: Thin" -> a label and a value, so a modifier reads as two things. A line with no label is all value. */
export function splitOption(option: string): { label: string | null; value: string } {
  const at = option.indexOf(":");
  if (at <= 0) return { label: null, value: option.trim() };
  return { label: option.slice(0, at).trim(), value: option.slice(at + 1).trim() };
}

/** Quantity still to make on a display: every item of its tickets that are not yet at the pass. */
export function itemsToMake(tickets: Pick<PosTicket, "status" | "items">[]): number {
  return tickets
    .filter((t) => t.status === "queued" || t.status === "preparing")
    .reduce((sum, t) => sum + t.items.filter((i) => i.status !== "cancelled").reduce((n, i) => n + i.quantity, 0), 0);
}

/**
 * The last few finished tickets of one display, newest FINISH first: a ticket collected a second ago leads the strip
 * whatever time it was sent. (A cancelled ticket has no finish time of its own, so it is placed by when it was sent.)
 */
export function recentlyDone<
  T extends Pick<PosTicket, "status" | "stationKind" | "createdAt" | "readyAt" | "servedAt">,
>(tickets: readonly T[], station: KdsStation, limit = 8): T[] {
  const finishedAt = (t: T) => Date.parse(t.servedAt ?? t.readyAt ?? t.createdAt);
  return tickets
    .filter((t) => inStation(t, station) && (t.status === "served" || t.status === "cancelled"))
    .sort((a, b) => finishedAt(b) - finishedAt(a))
    .slice(0, limit);
}

/** The displays' heartbeat: connected while the browser is online and the board has been read recently. */
export function isConnected(online: boolean, lastReadMs: number | null, nowMs: number, staleAfterMs = 20_000): boolean {
  if (!online) return false;
  return lastReadMs === null || nowMs - lastReadMs <= staleAfterMs;
}

/** "7:05", or "1:02:09" past an hour. */
export function formatWait(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** "POS-261106-0004" -> "4": the figure a cook calls out. The full number stays on the ticket in small print. */
export function shortOrderNumber(orderNumber: string): string {
  const last = orderNumber.split("-").pop() ?? orderNumber;
  const digits = last.replace(/^0+(?=\d)/, "");
  return digits || orderNumber;
}

/**
 * The tickets that are new since the screen last looked: queued tickets whose id is not in `seen`. The first look
 * (`seen` is null) announces nothing, so opening the screen on a busy kitchen does not play a chime for every order.
 */
export function newQueuedIds(seen: ReadonlySet<string> | null, tickets: Pick<PosTicket, "id" | "status">[]): string[] {
  if (seen === null) return [];
  return tickets.filter((t) => t.status === "queued" && !seen.has(t.id)).map((t) => t.id);
}

// ── What a device remembers (per outlet), never trusted blindly ────────────────────────────────────────────────────

const limitsKey = (outletId: string) => `injishi.kds.limits.${outletId}`;
const soundKey = (outletId: string) => `injishi.kds.sound.${outletId}`;

type Store = Pick<Storage, "getItem" | "setItem">;

export function loadLimits(store: Store | null, outletId: string): KdsLimits {
  try {
    const raw = store?.getItem(limitsKey(outletId));
    return raw ? readLimits(JSON.parse(raw)) : { ...DEFAULT_LIMITS };
  } catch {
    return { ...DEFAULT_LIMITS };
  }
}

export function saveLimits(store: Store | null, outletId: string, limits: KdsLimits): void {
  try {
    store?.setItem(limitsKey(outletId), JSON.stringify(limits));
  } catch {
    // Private windows and full storage throw: the limits then last until the page is closed, which is acceptable.
  }
}

export function loadSound(store: Store | null, outletId: string): boolean {
  try {
    return store?.getItem(soundKey(outletId)) !== "off";
  } catch {
    return true;
  }
}

export function saveSound(store: Store | null, outletId: string, on: boolean): void {
  try {
    store?.setItem(soundKey(outletId), on ? "on" : "off");
  } catch {
    // As above.
  }
}

/** The board's look: dark by default (the Injishi venue kitchen display, for a dim kitchen), or light. Remembered per device. */
export type KdsTheme = "light" | "dark";
// v2: the venue kitchen display made dark the default; a choice saved under the old key (light) no longer applies.
const THEME_KEY = "injishi.kds.theme.v2";

export function loadTheme(store: Store | null): KdsTheme {
  try {
    return store?.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function saveTheme(store: Store | null, theme: KdsTheme): void {
  try {
    store?.setItem(THEME_KEY, theme);
  } catch {
    // As above.
  }
}
