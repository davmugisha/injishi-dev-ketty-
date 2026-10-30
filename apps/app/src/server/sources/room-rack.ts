import { type ApiBooking, type ApiRoom, deskBoard } from "./frontdesk";
import type { SourceContext } from "./types";

/**
 * The room rack on the property's own records (2026-10-30), read from the desk's day
 * (`GET /ops/front-desk`): every room by type, and across the coming days who is in it, who is booked into
 * it, and who has a booking but no room yet. The board lists bookings leaving from yesterday and arriving up
 * to 120 days on, every open stay (walk-ins included) and stays that left in the last three days.
 *
 * Days are Kigali dates; a bar runs from its arrival afternoon to its departure morning, so a position is
 * "days since the rack's first day, plus a half".
 */

export type RackBarKind = "inhouse" | "booked" | "tentative" | "departed";
export type RackRoomState = "clean" | "dirty" | "inspected" | "occupied" | "ooo";

export interface RackBar {
  id: string;
  /** Arrival, in days from the rack's first day (an afternoon: n + 0.5). */
  from: number;
  /** Departure, in days from the rack's first day (a morning: n + 0.5). */
  to: number;
  kind: RackBarKind;
  guest: string;
  reference: string | null;
  /** Where pressing the bar goes: the booking in Reservations, or the desk for a walk-in. */
  href: string;
  /** "1 → 3 Nov". */
  dates: string;
}

export interface RackLane {
  id: string;
  kind: "group" | "room" | "unassigned";
  roomTypeId: string;
  /** A room's label; a group's room type; an unassigned lane's guest. */
  label: string;
  /** A group's summary ("4 rooms · sleeps 2"); a room's status in words. */
  meta: string;
  state: RackRoomState | null;
  bars: RackBar[];
  /** Two bars on this room overlap on some night. */
  overlap: boolean;
}

export interface RackDay {
  date: string;
  dow: string;
  day: number;
  month: string;
  /** Rooms of every type with nothing in them that night. */
  free: number;
}

export interface RoomRack {
  property: string;
  today: string;
  days: RackDay[];
  /** Now, in days from the first day (Kigali time). */
  now: number;
  types: { id: string; name: string; rooms: number }[];
  lanes: RackLane[];
  unassigned: number;
  overlaps: number;
  totalRooms: number;
}

const DAY_MS = 86_400_000;
/** How many days the rack reads: yesterday, today and the next 19. */
const SPAN = 21;

const dateMs = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
const addDays = (iso: string, n: number) => new Date(dateMs(iso) + n * DAY_MS).toISOString().slice(0, 10);

function shortDates(from: string, to: string): string {
  const f = new Date(dateMs(from));
  const t = new Date(dateMs(to));
  const month = (d: Date) => d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
  return f.getUTCMonth() === t.getUTCMonth()
    ? `${f.getUTCDate()} → ${t.getUTCDate()} ${month(t)}`
    : `${f.getUTCDate()} ${month(f)} → ${t.getUTCDate()} ${month(t)}`;
}

function roomState(r: ApiRoom): RackRoomState {
  if (r.status !== "available" || r.housekeeping === "out_of_order") return "ooo";
  if (r.occupant) return "occupied";
  return r.housekeeping;
}

const STATE_WORDS: Record<RackRoomState, string> = {
  clean: "Clean",
  dirty: "Dirty",
  inspected: "Inspected",
  occupied: "Occupied",
  ooo: "Out of order",
};

const bookingHref = (reference: string) => `/reservations?booking=${encodeURIComponent(reference)}`;

export async function readRoomRack(ctx: SourceContext): Promise<RoomRack> {
  const board = await deskBoard(ctx);
  const today = board.today;
  const start = addDays(today, -1);
  const at = (iso: string) => (dateMs(iso) - dateMs(start)) / DAY_MS + 0.5;
  // Kigali is UTC+2 all year: the hour of the day, as a fraction after today's midnight.
  const kigali = new Date(ctx.now.getTime() + 2 * 3600 * 1000);
  const now = 1 + (kigali.getUTCHours() * 60 + kigali.getUTCMinutes()) / 1440;

  const days: RackDay[] = Array.from({ length: SPAN }, (_, i) => {
    const date = addDays(start, i);
    const d = new Date(dateMs(date));
    return {
      date,
      dow: d.toLocaleString("en-GB", { weekday: "short", timeZone: "UTC" }),
      day: d.getUTCDate(),
      month: d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" }),
      free: 0,
    };
  });

  const byRoom = new Map<string, RackBar[]>();
  const put = (roomId: string, bar: RackBar) => byRoom.set(roomId, [...(byRoom.get(roomId) ?? []), bar]);
  const inRack = (from: string, to: string) =>
    dateMs(to) > dateMs(start) && dateMs(from) < dateMs(addDays(start, SPAN));

  // Stays: who is in a room, or left one in the last days. A stay's bar ends at its planned or actual exit.
  const stayBookings = new Set<string>();
  for (const s of board.stays) {
    if (s.bookingId) stayBookings.add(s.bookingId);
    const from = (s.checkIn ?? s.entryAt).slice(0, 10);
    const exit = s.actualExitAt ?? s.plannedExitAt ?? s.checkOut ?? addDays(today, 1);
    const to = exit.slice(0, 10) > from ? exit.slice(0, 10) : addDays(from, 1);
    if (!inRack(from, to)) continue;
    put(s.roomId, {
      id: `stay:${s.id}`,
      from: at(from),
      to: at(to),
      kind: s.lifecycle === "open" ? "inhouse" : "departed",
      guest: s.guestName ?? "Guest",
      reference: s.bookingReference ?? s.reference,
      href: s.bookingReference ? bookingHref(s.bookingReference) : "/front-desk",
      dates: shortDates(from, to),
    });
  }

  // Bookings not yet in house: their held rooms, or no room yet.
  const unassigned: ApiBooking[] = [];
  for (const b of board.bookings) {
    if (stayBookings.has(b.id) || b.stay) continue;
    if (b.status !== "confirmed" && b.status !== "pending_approval") continue;
    if (!inRack(b.checkIn, b.checkOut)) continue;
    const kind: RackBarKind = b.status === "confirmed" ? "booked" : "tentative";
    if (b.holds.length === 0) {
      unassigned.push(b);
      continue;
    }
    for (const h of b.holds) {
      put(h.roomId, {
        id: `hold:${b.id}:${h.roomId}:${h.from}`,
        from: at(h.from),
        to: at(h.to),
        kind,
        guest: b.guestName ?? "Unnamed guest",
        reference: b.reference,
        href: bookingHref(b.reference),
        dates: shortDates(h.from, h.to),
      });
    }
  }

  const overlapsIn = (bars: RackBar[]) =>
    bars.some((a, i) =>
      bars.some((b, j) => j > i && a.kind !== "departed" && b.kind !== "departed" && a.from < b.to && b.from < a.to),
    );

  // Lanes: a header per room type, its rooms, then its bookings that still need a room.
  const lanes: RackLane[] = [];
  const types = board.roomTypes.filter((t) => t.active);
  let overlaps = 0;
  for (const t of types) {
    const rooms = board.rooms.filter((r) => r.roomTypeId === t.id);
    const waiting = unassigned.filter((b) => b.roomTypeId === t.id);
    if (rooms.length === 0 && waiting.length === 0) continue;
    lanes.push({
      id: `type:${t.id}`,
      kind: "group",
      roomTypeId: t.id,
      label: t.name,
      meta: `${rooms.length} ${rooms.length === 1 ? "room" : "rooms"}${t.sleeps ? ` · sleeps ${t.sleeps}` : ""}`,
      state: null,
      bars: [],
      overlap: false,
    });
    for (const r of [...rooms].sort((a, b) =>
      (a.label ?? "").localeCompare(b.label ?? "", undefined, { numeric: true }),
    )) {
      const bars = (byRoom.get(r.id) ?? []).sort((a, b) => a.from - b.from);
      const overlap = overlapsIn(bars);
      if (overlap) overlaps += 1;
      const state = roomState(r);
      lanes.push({
        id: `room:${r.id}`,
        kind: "room",
        roomTypeId: t.id,
        label: r.label ?? "Room",
        meta: STATE_WORDS[state],
        state,
        bars,
        overlap,
      });
    }
    for (const b of waiting) {
      lanes.push({
        id: `wait:${b.id}`,
        kind: "unassigned",
        roomTypeId: t.id,
        label: b.guestName ?? "Unnamed guest",
        meta: "No room yet",
        state: null,
        bars: [
          {
            id: `wait-bar:${b.id}`,
            from: at(b.checkIn),
            to: at(b.checkOut),
            kind: b.status === "confirmed" ? "booked" : "tentative",
            guest: b.guestName ?? "Unnamed guest",
            reference: b.reference,
            href: bookingHref(b.reference),
            dates: shortDates(b.checkIn, b.checkOut),
          },
        ],
        overlap: false,
      });
    }
  }

  // Free rooms each night: a type's sellable rooms less what is in them or booked into the type that night.
  const night = (i: number) => i + 0.5;
  for (let i = 0; i < SPAN; i++) {
    let free = 0;
    for (const t of types) {
      const rooms = board.rooms.filter(
        (r) => r.roomTypeId === t.id && r.status === "available" && r.housekeeping !== "out_of_order",
      );
      const used = lanes
        .filter((l) => l.roomTypeId === t.id && l.kind !== "group")
        .flatMap((l) => l.bars)
        .filter((b) => b.kind !== "departed" && b.from <= night(i) && b.to > night(i)).length;
      free += Math.max(0, rooms.length - used);
    }
    const d = days[i];
    if (d) d.free = free;
  }

  return {
    property: board.property.name,
    today,
    days,
    now,
    types: types.map((t) => ({
      id: t.id,
      name: t.name,
      rooms: board.rooms.filter((r) => r.roomTypeId === t.id).length,
    })),
    lanes,
    unassigned: unassigned.length,
    overlaps,
    totalRooms: board.rooms.length,
  };
}
