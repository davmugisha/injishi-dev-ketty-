/**
 * The venue setup screen's rules that do not need React: the steps of the side rail and whether each is done,
 * table labels for a bulk add, routing a whole menu section, business-day times, and whether a settings form has
 * unsaved changes. Every rule that protects data is the API's; these only decide what the screen shows and sends.
 */
import type { PosOutlet, PosSetup, PosVenue, PosVenueRoute } from "@/server/pos";

export type SetupStep =
  | "overview"
  | "floor"
  | "stations"
  | "registers"
  | "routing"
  | "venue"
  | "receipts"
  | "team"
  | "roles"
  | "archived";

/** The headings the rail groups its steps under (the overview and the archive sit outside them). */
export type SetupGroup = "Business" | "Operations" | "Floor" | "Team";

export const SETUP_STEPS: readonly { key: SetupStep; label: string; hint: string; group?: SetupGroup }[] = [
  { key: "overview", label: "Overview", hint: "Progress and starter templates" },
  { key: "venue", label: "Venue details", hint: "TIN, address, business day", group: "Business" },
  { key: "receipts", label: "Receipts and payments", hint: "Receipt text, tax and methods", group: "Business" },
  { key: "stations", label: "Kitchen and bar", hint: "Where tickets are prepared", group: "Operations" },
  { key: "registers", label: "Registers", hint: "Tills where cashiers take payment", group: "Operations" },
  { key: "routing", label: "Item routing", hint: "Which station makes each item", group: "Operations" },
  { key: "floor", label: "Floor and tables", hint: "Dining areas and their tables", group: "Floor" },
  { key: "team", label: "Team members", hint: "Invite staff, change roles", group: "Team" },
  { key: "roles", label: "Roles and permissions", hint: "What each role may do", group: "Team" },
  { key: "archived", label: "Archived", hint: "See and restore archived items" },
];

/** The team steps: shown only to someone who may manage the team (`team.manage`). */
export const TEAM_STEPS: ReadonlySet<SetupStep> = new Set<SetupStep>(["team", "roles"]);

/** The steps this person sees: the team steps need `team.manage`, everything else `outlet.manage` (the page's gate). */
export function visibleSteps(can: readonly string[]) {
  const team = can.includes("team.manage");
  return SETUP_STEPS.filter((s) => team || !TEAM_STEPS.has(s.key));
}

const STEP_KEYS = new Set<string>(SETUP_STEPS.map((s) => s.key));

/** The step named in the address (`?step=routing`), or the overview. */
export function stepFrom(value: string | null | undefined): SetupStep {
  return value && STEP_KEYS.has(value) ? (value as SetupStep) : "overview";
}

export type StepState = "done" | "todo" | "info";

/**
 * Whether a step is done, counted from what exists (never a gate: every step and screen stays open). The overview
 * and the archive are information, not work.
 */
export function stepState(step: SetupStep, venue: PosVenue, setup: PosSetup, outlet: PosOutlet): StepState {
  const has = (key: PosSetup["steps"][number]["key"]) => setup.steps.find((s) => s.key === key)?.done ?? false;
  switch (step) {
    case "overview":
    case "archived":
    case "roles":
      return "info";
    case "team":
      // Done once anyone besides the owner is an active member (the API's count).
      return has("team") ? "done" : "todo";
    case "floor":
      return venue.areas.length > 0 && venue.tables.length > 0 ? "done" : "todo";
    case "stations":
      return venue.stations.length > 0 ? "done" : "todo";
    case "registers":
      return venue.registers.length > 0 ? "done" : "todo";
    case "routing":
      return venue.routing.length > 0 && venue.routing.every((r) => r.stationId) ? "done" : "todo";
    case "venue":
      return outlet.settings.venueTin && outlet.settings.venueAddress ? "done" : "todo";
    case "receipts":
      return has("receipts") ? "done" : "todo";
  }
}

// ── Bulk tables ─────────────────────────────────────────────────────────────────────────────────────

export const BULK_MAX = 50;

/** `T` from 1, 3 tables: T1, T2, T3 (the API makes the same labels). */
export function bulkLabels(prefix: string, start: number, count: number): string[] {
  const p = prefix.trim();
  if (!Number.isInteger(start) || !Number.isInteger(count) || start < 0 || count < 1) return [];
  return Array.from({ length: Math.min(count, BULK_MAX) }, (_, i) => `${p}${start + i}`);
}

/** The labels of a bulk add that are already used at the outlet (the API refuses the batch if any are). */
export function labelClashes(labels: readonly string[], existing: readonly string[]): string[] {
  const used = new Set(existing);
  return labels.filter((l) => used.has(l));
}

/** The next free number after the tables that already carry `prefix` (`T` with T1..T8 → 9). */
export function nextNumber(prefix: string, existing: readonly string[]): number {
  const p = prefix.trim();
  let top = 0;
  for (const label of existing) {
    if (!label.startsWith(p)) continue;
    const rest = label.slice(p.length);
    if (/^\d+$/.test(rest)) top = Math.max(top, Number(rest));
  }
  return top + 1;
}

// ── Routing by section ──────────────────────────────────────────────────────────────────────────────

export const NO_SECTION = "No section";

export interface RoutingSection {
  name: string;
  items: PosVenueRoute[];
  unrouted: number;
  /** The station every item of the section goes to, when they all go to the same one; else null. */
  commonStationId: string | null;
}

/** The menu's items grouped by section, in the order the API lists them. */
export function routingSections(routing: readonly PosVenueRoute[]): RoutingSection[] {
  const map = new Map<string, PosVenueRoute[]>();
  for (const r of routing) {
    const name = r.categoryName ?? NO_SECTION;
    map.set(name, [...(map.get(name) ?? []), r]);
  }
  return [...map.entries()].map(([name, items]) => {
    const ids = new Set(items.map((i) => i.stationId));
    const only = ids.size === 1 ? [...ids][0] : null;
    return { name, items, unrouted: items.filter((i) => !i.stationId).length, commonStationId: only ?? null };
  });
}

/** The route changes that send every item of `items` to `stationId`: items already there are left out. */
export function routesTo(
  items: readonly PosVenueRoute[],
  stationId: string | null,
): { serviceItemId: string; stationId: string | null }[] {
  return items.filter((i) => i.stationId !== stationId).map((i) => ({ serviceItemId: i.serviceItemId, stationId }));
}

// ── Reorder ─────────────────────────────────────────────────────────────────────────────────────────

/** `ids` with `id` moved one place up (-1) or down (+1); unchanged at the ends. */
export function moved(ids: readonly string[], id: string, by: -1 | 1): string[] {
  const i = ids.indexOf(id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= ids.length) return [...ids];
  const next = [...ids];
  [next[i], next[j]] = [next[j] as string, next[i] as string];
  return next;
}

// ── Venue details and business day ──────────────────────────────────────────────────────────────────

/** A TIN is empty (not set) or Rwanda's 9 digits. */
export function tinValid(tin: string): boolean {
  return /^(\d{9})?$/.test(tin.trim());
}

/** `240` → `04:00`. */
export function clock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** The start times offered: midnight to 06:00, every half hour (the API accepts any minute before noon). */
export const DAY_START_CHOICES: readonly number[] = Array.from({ length: 13 }, (_, i) => i * 30);

/** "From 04:00 to 04:00 the next day", or the calendar day. */
export function businessDayText(startMinutes: number): string {
  return startMinutes === 0
    ? "Calendar day (midnight to midnight)"
    : `${clock(startMinutes)} to ${clock(startMinutes)} the next day`;
}

/**
 * The start the API uses for a set of outlets read together (the same rule): one start when they agree, else the
 * calendar day.
 */
export function commonDayStart(outlets: readonly Pick<PosOutlet, "settings">[]): number {
  const starts = new Set(outlets.map((o) => o.settings.businessDayStartMinutes ?? 0));
  return starts.size === 1 ? ([...starts][0] ?? 0) : 0;
}

/** Today's business day in Kigali (`YYYY-MM-DD`) for a day that starts `startMinutes` after midnight. */
export function businessToday(startMinutes: number, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kigali" }).format(
    new Date(now.getTime() - startMinutes * 60_000),
  );
}

/** The note a dashboard or report shows about its days, or null for the plain calendar day. */
export function businessDayNote(b: { startMinutes: number; mixed: boolean } | undefined): string | null {
  if (!b) return null;
  if (b.mixed) return "Outlets start their business day at different times, so calendar days are shown.";
  if (b.startMinutes === 0) return null;
  return `Business day starts at ${clock(b.startMinutes)}: sales before ${clock(b.startMinutes)} count in the day before.`;
}

// ── Unsaved changes ─────────────────────────────────────────────────────────────────────────────────

/** True when any field of `draft` differs from `saved` (arrays compare as sets, strings ignore outer spaces). */
export function isDirty<T extends Record<string, unknown>>(saved: T, draft: T): boolean {
  return Object.keys(draft).some((k) => {
    const a = saved[k];
    const b = draft[k];
    if (Array.isArray(a) && Array.isArray(b)) return a.length !== b.length || a.some((x) => !b.includes(x));
    if (typeof a === "string" && typeof b === "string") return a.trim() !== b.trim();
    return a !== b;
  });
}
