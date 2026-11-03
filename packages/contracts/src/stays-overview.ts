import { z } from "zod";
import { BusinessKind } from "./business-kind";
import { Uuid } from "./primitives";
import { CalendarDay } from "./rentals/dates";

// ===========================================================================
// A short-stay business's home (2026-10-29): guest houses, lodges, hotels,
// motels, serviced apartments, villas and tented camps.
// ===========================================================================
//
// `GET /api/v1/ops/stays-overview/summary` is small and read on every page (the sidebar's counts and how
// the business is run); `GET /api/v1/ops/stays-overview/activity?from=&to=` carries the stays and the
// money of a period, read by the home only. Both are narrowed to the branches the person covers.

/**
 * How a stay business is run, which decides what the app offers it. A place of up to
 * `COMPACT_MAX_ROOMS` rooms is run by its owner and perhaps one helper: one short menu, no departments,
 * no outlets, no revenue desk. A larger one has a team and the full hotel tools. A small lodge and a
 * small hotel are alike; a large guest house is run like a lodge. Rooms, not the business kind, decide.
 */
export const StaySize = z.enum(["compact", "full"]);
export type StaySize = z.infer<typeof StaySize>;

export const COMPACT_MAX_ROOMS = 12;

export function staySize(rooms: number): StaySize {
  return rooms <= COMPACT_MAX_ROOMS ? "compact" : "full";
}

/** The words a stay business's screens use for what it lets: rooms, apartments, cottages, tents. */
export function stayUnitWords(kind: BusinessKind): { one: string; many: string } {
  if (kind === "apartment") return { one: "apartment", many: "apartments" };
  if (kind === "tented_camp") return { one: "tent", many: "tents" };
  if (kind === "villa") return { one: "villa", many: "villas" };
  return { one: "room", many: "rooms" };
}

/** Long stays are let by the week and the month as well as the night. */
export function letsLongStays(kind: BusinessKind): boolean {
  return kind === "apartment" || kind === "villa";
}

export const StaysSummary = z.object({
  today: CalendarDay,
  business: z.object({
    orgName: z.string(),
    kind: BusinessKind,
    size: StaySize,
    /** Bookable rooms (or apartments, tents) across the covered branches. */
    rooms: z.number().int().min(0),
    roomTypes: z.number().int().min(0),
    properties: z.number().int().min(0),
    /** The one branch when there is one, for the header. */
    propertyName: z.string().nullable(),
  }),
  counts: z.object({
    arrivalsToday: z.number().int().min(0),
    departuresToday: z.number().int().min(0),
    inHouse: z.number().int().min(0),
    /** Booking requests waiting for the business to accept or decline. */
    requestsWaiting: z.number().int().min(0),
  }),
});
export type StaysSummary = z.infer<typeof StaysSummary>;

/** Where a stay stands, as the home and the calendar word it. */
export const StayActivityStatus = z.enum(["requested", "confirmed", "in_house", "checked_out", "cancelled", "no_show"]);
export type StayActivityStatus = z.infer<typeof StayActivityStatus>;

export const StayActivityItem = z.object({
  id: Uuid,
  /** A booking (with or without its stay yet), or a walk in, which has no booking. */
  source: z.enum(["booking", "walk_in"]),
  reference: z.string().nullable(),
  guestName: z.string(),
  roomTypeName: z.string(),
  roomLabel: z.string().nullable(),
  /** The first night. */
  checkIn: CalendarDay,
  /** The morning they leave; for an open-ended walk in, today's tomorrow. */
  checkOut: CalendarDay,
  status: StayActivityStatus,
  channel: z.string().nullable(),
  nightlyRwf: z.number().int().min(0),
  totalRwf: z.number().int().min(0),
});
export type StayActivityItem = z.infer<typeof StayActivityItem>;

export const StaysActivity = z.object({
  from: CalendarDay,
  to: CalendarDay,
  today: CalendarDay,
  rooms: z.number().int().min(0),
  stays: z.array(StayActivityItem),
  /** Money received on guests' bills, summed per business day (payments less refunds). */
  payments: z.array(z.object({ day: CalendarDay, amountRwf: z.number().int() })),
});
export type StaysActivity = z.infer<typeof StaysActivity>;

/** Nights sold on each day of a period: a stay counts on every night from its check in to the night before it leaves. */
export function nightsSold(stays: readonly StayActivityItem[], days: readonly string[]): number[] {
  const live = stays.filter((s) => s.status !== "cancelled" && s.status !== "no_show" && s.status !== "requested");
  return days.map((d) => live.filter((s) => s.checkIn <= d && d < s.checkOut).length);
}
