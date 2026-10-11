"use client";

/**
 * Room grid (tape chart) — the spatial home of the hospitality PMS and its most
 * memorable surface (F-P02, blueprint §7).
 *
 * Rooms down, dates across, read from the property's real records:
 *
 * - `GET /ops/rooms` for the rows,
 * - `GET /ops/room-assignments` for every room held over the window (a future
 *   arrival's bar),
 * - `GET /ops/stays` for who is in the building and who has left (an in-house
 *   or checked-out bar, walk-ins included),
 * - `GET /ops/reservations` for the guest, the dates and the room type a bar
 *   belongs to.
 *
 * **A BAR MOVES BETWEEN ROOMS, NOT BETWEEN DATES.** The demo grid dragged a bar
 * sideways to new dates and dragged its right edge to extend the stay, and
 * neither is something the server can do: no route changes a booking's dates,
 * because a date change reprices the stay and moves the escrow, and nobody has
 * decided how. A grid that drew the gesture and then refused it would read as a
 * bug, so the gesture is gone and the legend says why. Changing ROOMS is real:
 * a drop holds the new room through `POST /ops/reservations/:id/assign` and only
 * then lets the old one go.
 *
 * Only an arrival's hold moves. A guest already in the building is in a room by
 * way of their STAY, and nothing moves a stay yet either.
 *
 * **`?booking=<id>` OPENS THE GRID ON ONE BOOKING** (2026-09-15). Reservations
 * sends "Assign room" and "On the grid" here with it. The window moves so the
 * booking's arrival is in view, its bar is outlined and scrolled to, and a panel
 * above the chart names the rooms it may hold and holds one in a press. Dragging
 * is a pointer gesture and cannot be the only way to assign a room: a keyboard
 * or a phone had no way in, and the desk arriving from a list row should not
 * have to find the booking a second time in the tray.
 */

import type {
  OperatorReservation,
  OperatorRoom,
  OperatorRoomAssignment,
  OperatorStay,
} from "@injishi/contracts";
import { Button } from "@injishi/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ActionButton, Badge, EmptyState, LoadFailed, Skeleton, surface } from "../components/ui";
import { Icon } from "../components/icon";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useHoldRoom, useReleaseRoom, useRoomAssignments, useRooms, useStays } from "../data/ops";
import { useReservations } from "../data/reservations";
import { seedFromServerReservation } from "../lib/check-in-seed";
import {
  addDaysIso,
  dateRangeIso,
  dayPartsIso,
  daysBetweenIso,
  fmt,
  kigaliDateOf,
  todayIso,
} from "../lib/format";
import { HOUSEKEEPING_BY } from "../lib/housekeeping";
import { folioPathForStay } from "../lib/stay-lookup";
import { useWorkspaceHref } from "../lib/workspace-href";
import { usePms } from "../store";
import { usePmsUi } from "../ui-store";

const COL = 72;
const LABEL_W = 178;
const ROW_H = 44;
/** What one extra overlapping bar adds to a row. Bar height plus its gap. */
const LANE_H = 38;
const DAYS = 14;
const PAST = 2; // days of history shown left of today
const GRID_W = LABEL_W + DAYS * COL; // 1186
const HEADER_H = 46;
/** Tall enough for the popover's three rows, badge and actions. */
const POP_H = 214;

/**
 * Is this a calendar day the grid can open on?
 *
 * `?from=` is typed by hand and pasted between people, so it is checked rather
 * than trusted: the shape, and then that the date EXISTS. `2026-02-31` passes
 * a regexp and rolls over to March in a `Date`, which would silently open the
 * grid on a day nobody asked for.
 */
/**
 * Stack overlapping bars into LANES, so two stays on one room are both there.
 *
 * Bars were drawn at one `top` with one height, so any two that shared a room
 * and a night landed exactly on top of each other: the topmost was the only
 * one a pointer could reach and the only one anybody could see. Ten of them
 * sat on Deluxe Room 1 for 17–18 Sep on the local stack (2026-09-17).
 *
 * Overlap on one room is not a display accident to be hidden — a same-day
 * turnover is two bars touching, and a genuine double-book is exactly what a
 * duty manager opens this screen to find. So every bar gets a lane: the first
 * one it does not collide in, by the usual interval-graph sweep over bars
 * sorted by start. The row grows to hold the lanes it needs.
 */
function assignLanes(bars: Bar[]): { lane: Map<string, number>; lanes: number } {
  const lane = new Map<string, number>();
  /** The exclusive end of the last bar placed in each lane. */
  const ends: string[] = [];
  for (const bar of [...bars].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0))) {
    let i = ends.findIndex((end) => end <= bar.from);
    if (i === -1) {
      i = ends.length;
      ends.push(bar.to);
    } else {
      ends[i] = bar.to;
    }
    lane.set(bar.key, i);
  }
  return { lane, lanes: Math.max(ends.length, 1) };
}

function isIsoDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

type BarKind = "reserved" | "inhouse" | "out";

/** One thing drawn on a room's row, whatever record it came from. */
interface Bar {
  key: string;
  roomId: string;
  /** `YYYY-MM-DD`, inclusive. */
  from: string;
  /** `YYYY-MM-DD`, exclusive. */
  to: string;
  guest: string;
  kind: BarKind;
  reservation: OperatorReservation | null;
  /** Set when the bar is a HOLD, which is the only thing that can move. */
  hold: OperatorRoomAssignment | null;
  stayId: string | null;
}

interface Ghost {
  roomId: string;
  bad: boolean;
  why: string | null;
}

interface DragSession {
  bar: Bar | null;
  reservation: OperatorReservation;
  x0: number;
  y0: number;
  moved: boolean;
}

/**
 * How each kind of bar is drawn. Three encodings, so no reader depends on one:
 * a fill and border of ONE hue (each tint is now a color-mix of its border's
 * role in `pms-tokens.css`, so the pair can no longer drift apart the way
 * violet on pale blue did), a glyph at the bar's start, and the kind spoken
 * first in the bar's accessible name.
 */
const KIND: Record<BarKind, { bg: string; bd: string; fg: string; icon: "calendar-days" | "bed-double" | "log-out"; label: string }> = {
  reserved: { bg: "var(--info-bg)", bd: "var(--info)", fg: "var(--foreground)", icon: "calendar-days", label: "Reserved" },
  inhouse: { bg: "var(--accent-soft)", bd: "var(--accent-text)", fg: "var(--foreground)", icon: "bed-double", label: "In-house" },
  out: { bg: "var(--hover)", bd: "var(--line2)", fg: "var(--muted)", icon: "log-out", label: "Checked out" },
};

/** "101" before "102" before "1010", and an unnumbered room last. */
function byLabel(a: OperatorRoom, b: OperatorRoom): number {
  if (a.label === null) return b.label === null ? 0 : 1;
  if (b.label === null) return -1;
  return a.label.localeCompare(b.label, undefined, { numeric: true });
}

/**
 * "Room 101" for a bare number, the label itself for anything else.
 *
 * A label is whatever the property typed, and "Deluxe Room 1" is as common as
 * "101". Prefixing every label printed "Room Deluxe Room 1", which wrapped the
 * row label onto two lines and into the next row.
 */
function roomName(room: OperatorRoom | undefined): string {
  if (!room?.label) return "Unnumbered room";
  return /^\d+[A-Za-z]?$/.test(room.label) ? `Room ${room.label}` : room.label;
}

/** Do `[aFrom, aTo)` and `[bFrom, bTo)` share a night? Half open, like the constraint. */
function overlaps(aFrom: string, aTo: string, bFrom: string, bTo: string): boolean {
  return aFrom < bTo && bFrom < aTo;
}

/**
 * Every bar on the tape, from the three reads that between them know.
 *
 * A guest in the building is drawn from their STAY, because that is the room
 * they are actually in. Their booking's hold on the same room would be the same
 * bar twice, so it is skipped; a hold on a DIFFERENT room is a later leg of a
 * split stay and is drawn as its own reserved bar.
 */
function buildBars(
  holds: readonly OperatorRoomAssignment[],
  stays: readonly OperatorStay[],
  reservations: readonly OperatorReservation[],
  today: string,
  windowFrom: string,
): Bar[] {
  const resById = new Map(reservations.map((r) => [r.id, r]));
  const openStayRoomByBooking = new Map(
    stays.filter((s) => s.lifecycle === "open" && s.bookingId).map((s) => [s.bookingId as string, s.roomId]),
  );
  const bars: Bar[] = [];

  for (const hold of holds) {
    if (openStayRoomByBooking.get(hold.bookingId) === hold.roomId) continue;
    const res = resById.get(hold.bookingId) ?? null;
    bars.push({
      key: `hold:${hold.id}`,
      roomId: hold.roomId,
      from: hold.from,
      to: hold.to,
      guest: res?.guestName ?? res?.reference ?? "Reservation",
      kind: "reserved",
      reservation: res,
      hold,
      stayId: null,
    });
  }

  for (const stay of stays) {
    const res = stay.bookingId ? (resById.get(stay.bookingId) ?? null) : null;
    const from = kigaliDateOf(stay.entryAt);
    if (stay.lifecycle === "open") {
      // Through the booked departure, or the planned exit of a walk-in. A guest
      // still here past either is still here tonight, so the bar never ends
      // before tomorrow while the stay is open.
      const planned = res?.checkOut ?? (stay.plannedExitAt ? kigaliDateOf(stay.plannedExitAt) : null);
      const tomorrow = addDaysIso(today, 1);
      const to = planned && planned > today ? planned : tomorrow;
      bars.push({
        key: `stay:${stay.id}`,
        roomId: stay.roomId,
        from,
        to: to > from ? to : addDaysIso(from, 1),
        guest: stay.guestName ?? res?.guestName ?? "Guest",
        kind: "inhouse",
        reservation: res,
        hold: null,
        stayId: stay.id,
      });
    } else if (stay.actualExitAt) {
      const exit = kigaliDateOf(stay.actualExitAt);
      const to = exit > from ? exit : addDaysIso(from, 1);
      if (to <= windowFrom) continue;
      bars.push({
        key: `stay:${stay.id}`,
        roomId: stay.roomId,
        from,
        to,
        guest: stay.guestName ?? res?.guestName ?? "Guest",
        kind: "out",
        reservation: res,
        hold: null,
        stayId: stay.id,
      });
    }
  }

  return bars;
}

export function RoomGrid({
  focusBookingId = null,
  windowStart = null,
}: { focusBookingId?: string | null; windowStart?: string | null } = {}) {
  const { toast, toastError } = usePms();
  const { openCheckIn } = usePmsUi();
  const router = useRouter();
  // Every jump stays inside the workspace in the address bar (ADR-018).
  const href = useWorkspaceHref();
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();

  const today = todayIso();
  const rooms = useRooms(workspaceId);
  const reservations = useReservations(workspaceId);
  const stays = useStays(workspaceId);

  /*
   * The window, and WHY IT MOVES NOW.
   *
   * It was two days of history and twelve ahead, derived from `today` and from
   * nothing else, with no control that changed it. A hotel calendar that
   * cannot be paged is a fortnight's report: a booking three weeks out could
   * not be looked at on this screen at all, and the only thing that ever
   * shifted the window was arriving on a `?booking=` link. Measured
   * 2026-09-17.
   *
   * `?from=` is the window's address, for the same reason `?booking=` is the
   * focus's: a duty manager sends "the grid for the last week of the month" as
   * a link, and a window kept in component state cannot be sent. An unreadable
   * or absent value is the home window, never an error — this parameter is
   * typed by hand.
   *
   * A focused booking still WINS over `?from=`, because following a link to a
   * booking is a request to look at that booking, and the two parameters only
   * ever arrive together when something built a link out of both.
   *
   * Waiting for the reservations read before asking for holds keeps the grid
   * from fetching one window and then another.
   */
  const focusRes = focusBookingId
    ? (reservations.data?.reservations.find((r) => r.id === focusBookingId) ?? null)
    : null;
  const homeFrom = addDaysIso(today, -PAST);
  const homeTo = addDaysIso(today, DAYS - PAST);
  const shifted = focusRes !== null && (focusRes.checkIn < homeFrom || focusRes.checkIn >= homeTo);
  const paged = !shifted && windowStart !== null && isIsoDay(windowStart) ? windowStart : null;
  const windowFrom = shifted && focusRes
    ? addDaysIso(focusRes.checkIn, -PAST)
    : (paged ?? homeFrom);
  const windowTo = addDaysIso(windowFrom, DAYS);
  /** Where the arrows and "Today" send you. Paging drops a stale focus. */
  const windowHref = (from: string | null) =>
    from === null ? href("/calendar") : href(`/calendar?from=${from}`);
  const atHome = windowFrom === homeFrom;
  const holdsReady = !focusBookingId || !reservations.isPending;
  const holds = useRoomAssignments(holdsReady ? workspaceId : null, windowFrom, windowTo);
  const holdRoom = useHoldRoom(workspaceId);
  const releaseRoom = useReleaseRoom(workspaceId);

  const mayAssign = can("reservation.assign");

  const rowsRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragSession | null>(null);
  // Mirrored in a ref because the pointerup handler is bound when the drag
  // starts, and reading the state there would read the ghost as it was then.
  const ghostRef = useRef<Ghost | null>(null);
  const [ghost, setGhostState] = useState<Ghost | null>(null);
  const [dragging, setDragging] = useState<OperatorReservation | null>(null);
  const [pop, setPop] = useState<{ key: string; x: number; y: number } | null>(null);
  const [pickedRoom, setPickedRoom] = useState<string>("");
  const chartRef = useRef<HTMLDivElement>(null);
  const scrolledFor = useRef<string | null>(null);

  const settled = [rooms, reservations, stays, holds].every((q) => q.isSuccess);

  /*
   * Bring the focused booking's bar into view once, when everything it is drawn
   * from has answered. Once per booking id, so a refetch after holding a room
   * does not yank the chart back while the desk is looking elsewhere.
   */
  useEffect(() => {
    if (!focusBookingId || !settled || scrolledFor.current === focusBookingId) return;
    const box = chartRef.current;
    if (!box) return;
    scrolledFor.current = focusBookingId;
    const bar = box.querySelector<HTMLElement>("[data-focus-bar]");
    if (!bar) return;
    const b = box.getBoundingClientRect();
    const e = bar.getBoundingClientRect();
    box.scrollBy({
      left: e.left - b.left - LABEL_W - COL,
      top: e.top - b.top - HEADER_H - ROW_H,
    });
  }, [focusBookingId, settled]);

  const setGhost = (g: Ghost | null) => {
    ghostRef.current = g;
    setGhostState(g);
  };

  if (workspaceId === null) {
    return (
      <EmptyState style={{ padding: 26, fontSize: 13.5 }}>
        The calendar draws this property&apos;s rooms and bookings. Open a workspace to see it.
      </EmptyState>
    );
  }

  const reads = [rooms, reservations, stays, holds];
  if (reads.some((q) => q.isPending)) {
    return (
      <div className="pms-enter" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Skeleton height={40} />
        <Skeleton height={340} delay={60} />
      </div>
    );
  }
  if (reads.some((q) => q.isError)) {
    const fetching = reads.some((q) => q.isFetching);
    return (
      /* Unreachable is not an empty hotel. A desk told every room is free
         will sell a room somebody is sleeping in. */
      <LoadFailed onRetry={() => reads.forEach((q) => void q.refetch())} retrying={fetching}>
        We couldn&apos;t load the calendar. Your bookings and holds are safe — this is on
        our side, not an empty property.
      </LoadFailed>
    );
  }

  const roomList = [...(rooms.data?.rooms ?? [])].sort(byLabel);
  const roomById = new Map(roomList.map((r) => [r.id, r]));
  const resList = reservations.data?.reservations ?? [];
  const bars = buildBars(holds.data?.assignments ?? [], stays.data?.stays ?? [], resList, today, windowFrom);

  /*
   * Row geometry, computed ONCE, because three things read it: the rows as
   * drawn, the drag's "which room is under the pointer", and where a bar's
   * popover opens. Rows used to be one fixed height and all three divided by
   * it; a row that grows to hold a second lane made that arithmetic wrong for
   * every row below the clash, so the drag landed a bar one room off.
   */
  const rowLanes = roomList.map((rm) =>
    assignLanes(bars.filter((b) => b.roomId === rm.id && overlaps(b.from, b.to, windowFrom, windowTo))),
  );
  const rowHeights = rowLanes.map(({ lanes }) => ROW_H + (lanes - 1) * LANE_H);
  const rowTops = rowHeights.reduce<number[]>((tops, h, i) => {
    tops.push(i === 0 ? 0 : tops[i - 1] + rowHeights[i - 1]);
    return tops;
  }, []);
  const rowsHeight = rowHeights.reduce((a, h) => a + h, 0);
  const heldBookings = new Set((holds.data?.assignments ?? []).map((h) => h.bookingId));

  const occupied = roomList.filter((r) => r.occupiedBy !== null).length;

  // Approved arrivals inside the window with no room held yet. A pending
  // request stays out: it may yet be declined, and a room held for it would be
  // held for nobody.
  const tray = resList.filter(
    (r) =>
      r.state === "confirmed" &&
      !heldBookings.has(r.id) &&
      r.checkOut > today &&
      overlaps(r.checkIn, r.checkOut, windowFrom, windowTo),
  );

  const days = Array.from({ length: DAYS }, (_, i) => {
    const iso = addDaysIso(windowFrom, i);
    const parts = dayPartsIso(iso);
    return { i, iso, ...parts, showMon: i === 0 || parts.dd === "01", today: iso === today };
  });

  /** Why a booking cannot land in this room, or null when it can. */
  const refusalFor = (res: OperatorReservation, room: OperatorRoom, from: string, to: string, moving: Bar | null): string | null => {
    if (room.roomTypeId !== res.roomTypeId) {
      return `${roomName(room)} is a ${room.roomTypeName}, not the room type ${res.guestName ?? "this guest"} booked`;
    }
    if (room.status !== "available") {
      return `${roomName(room)} is ${room.status.replace(/_/g, " ")}`;
    }
    const clash = bars.find(
      (b) => b.roomId === room.id && b.key !== moving?.key && b.kind !== "out" && overlaps(from, to, b.from, b.to),
    );
    return clash ? `${roomName(room)} is taken ${dateRangeIso(clash.from, clash.to)} by ${clash.guest}` : null;
  };

  const rowAt = (clientY: number): OperatorRoom | undefined => {
    const rect = rowsRef.current?.getBoundingClientRect();
    if (!rect || roomList.length === 0) return undefined;
    const y = clientY - rect.top;
    let i = rowTops.findIndex((top, k) => y >= top && y < top + rowHeights[k]);
    if (i === -1) i = y < 0 ? 0 : roomList.length - 1;
    return roomList[i];
  };

  const startDrag = (reservation: OperatorReservation, bar: Bar | null, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { bar, reservation, x0: e.clientX, y0: e.clientY, moved: false };

    const onMove = (ev: PointerEvent) => {
      const c = dragRef.current;
      if (!c) return;
      if (Math.abs(ev.clientX - c.x0) + Math.abs(ev.clientY - c.y0) > 5) c.moved = true;
      if (!c.moved || !mayAssign || holdRoom.isPending) return;
      setDragging(c.reservation);
      const room = rowAt(ev.clientY);
      if (!room) return;
      const from = c.bar?.from ?? c.reservation.checkIn;
      const to = c.bar?.to ?? c.reservation.checkOut;
      const why = room.id === c.bar?.roomId ? null : refusalFor(c.reservation, room, from, to, c.bar);
      setGhost({ roomId: room.id, bad: why !== null, why });
      setPop(null);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const c = dragRef.current;
      const g = ghostRef.current;
      dragRef.current = null;
      setGhost(null);
      setDragging(null);
      if (!c) return;

      if (!c.moved) {
        if (c.bar) openPop(c.bar);
        return;
      }
      if (!g || g.roomId === c.bar?.roomId) return;
      if (g.bad) {
        toast(`Can't place it there — ${g.why}. Pick another room.`, "bad");
        return;
      }
      const room = roomById.get(g.roomId);
      const guest = c.reservation.guestName ?? c.reservation.reference;
      holdRoom.mutate(
        {
          bookingId: c.reservation.id,
          roomId: g.roomId,
          // A tray drop takes the booking's own dates. A moved bar keeps its
          // leg's dates, so a split stay moves one leg rather than all of them.
          from: c.bar?.hold?.from,
          to: c.bar?.hold?.to,
          releaseAssignmentId: c.bar?.hold?.id,
        },
        {
          onSuccess: () => toast(`${guest} now holds ${roomName(room)}.`, "ok"),
          // The server's own words: a room taken a moment ago, a changed room
          // type, a refused permission. Guessing here would be worse.
          onError: toastError,
        },
      );
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const openPop = (bar: Bar) => {
    const ri = roomList.findIndex((r) => r.id === bar.roomId);
    const start = Math.max(daysBetweenIso(windowFrom, bar.from), 0);
    const x = Math.max(8, Math.min(LABEL_W + start * COL, GRID_W - 284));
    // Below the bar unless that runs off the bottom of the chart, which clips
    // it inside its own scroll box: on a small property the last rows opened a
    // popover whose buttons could not be seen. Above it then, if that fits.
    const rowTop = HEADER_H + (rowTops[ri] ?? 0) + (rowLanes[ri]?.lane.get(bar.key) ?? 0) * LANE_H;
    const below = rowTop + 42;
    const above = rowTop - POP_H + 2;
    const chartH = HEADER_H + rowsHeight;
    setPop({ key: bar.key, x, y: below + POP_H > chartH && above >= 0 ? above : below });
  };

  const popBar = pop ? bars.find((b) => b.key === pop.key) : undefined;
  const popRoom = popBar ? roomById.get(popBar.roomId) : undefined;
  const popRes = popBar?.reservation ?? null;
  const billPath = folioPathForStay(popBar?.stayId);
  const mayCheckIn = popBar?.kind === "reserved" && popRes?.state === "confirmed" && popRes.checkIn === today;

  const assignReason = mayAssign ? undefined : reasonFor("reservation.assign");
  const todayCol = daysBetweenIso(windowFrom, today);

  /* The focused booking: what it holds now, and where it may go. */
  const focusHolds = focusRes ? (holds.data?.assignments ?? []).filter((h) => h.bookingId === focusRes.id) : [];
  const focusStay = focusRes
    ? (stays.data?.stays ?? []).find((st) => st.bookingId === focusRes.id && st.lifecycle === "open")
    : undefined;
  // One hold can be moved in place. A split stay has a leg per room, and which
  // leg to move is a question for the bars, where each leg is drawn.
  const movableHold = focusHolds.length === 1 ? focusHolds[0] : undefined;
  const focusBar = movableHold ? bars.find((b) => b.hold?.id === movableHold.id) : undefined;
  const canPlaceFocus =
    focusRes !== null && focusRes.state === "confirmed" && focusRes.checkOut > today && focusHolds.length <= 1;
  const eligible =
    canPlaceFocus && focusRes
      ? roomList.filter(
          (rm) =>
            rm.id !== movableHold?.roomId &&
            refusalFor(
              focusRes,
              rm,
              movableHold?.from ?? focusRes.checkIn,
              movableHold?.to ?? focusRes.checkOut,
              focusBar ?? null,
            ) === null,
        )
      : [];
  const picked = eligible.find((rm) => rm.id === pickedRoom) ?? eligible[0];

  const placeFocus = () => {
    if (!focusRes || !picked) return;
    const guest = focusRes.guestName ?? focusRes.reference;
    holdRoom.mutate(
      {
        bookingId: focusRes.id,
        roomId: picked.id,
        from: movableHold?.from,
        to: movableHold?.to,
        releaseAssignmentId: movableHold?.id,
      },
      {
        onSuccess: () => {
          setPickedRoom("");
          toast(`${guest} now holds ${roomName(picked)}.`, "ok");
        },
        onError: toastError,
      },
    );
  };

  return (
    <div className="pms-enter" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {focusBookingId && (
        <FocusPanel
          reservation={focusRes}
          heldRooms={focusHolds.map((h) => roomName(roomById.get(h.roomId)))}
          stayRoom={focusStay ? roomName(roomById.get(focusStay.roomId)) : null}
          canPlace={canPlaceFocus}
          moving={movableHold !== undefined}
          eligible={eligible}
          picked={picked}
          onPick={setPickedRoom}
          onPlace={placeFocus}
          placing={holdRoom.isPending}
          assignReason={assignReason}
          recordHref={focusRes ? href(`/reservations/${focusRes.id}`) : href("/reservations")}
          homeHref={shifted ? href("/calendar") : null}
        />
      )}

      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <LegendKey kind="inhouse" />
        <LegendKey kind="reserved" />
        <LegendKey kind="out" />
        <span className="pms-num" style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", borderLeft: "1px solid var(--line2)", paddingLeft: 16 }}>
          {occupied} / {roomList.length} occupied now
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          {mayAssign
            ? "Drag a reserved bar to another room · click for details · stay dates can't be changed here yet"
            : `Click a bar for details · ${assignReason ?? "you can't move rooms here"}`}
        </span>
      </div>

      {/*
        The window control. A week a press, because the chart is a fortnight
        wide and a fortnight a press would leave no overlap to read across.
        "Today" appears only when the window has moved, so the row does not
        carry a control that does nothing — the same rule the focus panel's
        "Back to today" already followed.
      */}
      <div
        role="group"
        aria-label="Calendar window"
        style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <ActionButton
            onClick={() => router.push(windowHref(addDaysIso(windowFrom, -7)))}
            aria-label="Previous week"
            title="Previous week"
          >
            <Icon name="chevron-left" size={15} strokeWidth={2.2} />
          </ActionButton>
          <ActionButton
            onClick={() => router.push(windowHref(addDaysIso(windowFrom, 7)))}
            aria-label="Next week"
            title="Next week"
          >
            <Icon name="chevron-right" size={15} strokeWidth={2.2} />
          </ActionButton>
        </span>

        <span
          className="pms-num"
          aria-live="polite"
          style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}
        >
          {dateRangeIso(windowFrom, addDaysIso(windowTo, -1))}
        </span>

        {!atHome && (
          <Link href={windowHref(null)} className="text-sm underline underline-offset-2">
            Today
          </Link>
        )}
      </div>

      {/* Tray of approved arrivals with no room held */}
      {tray.length > 0 ? (
        <div style={{ ...surface, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--muted2)", marginRight: 4 }}>No room yet</span>
          {tray.map((r) => (
            <span
              key={r.id}
              onPointerDown={mayAssign ? (e) => startDrag(r, null, e) : undefined}
              title={mayAssign ? undefined : assignReason}
              data-focus-bar={r.id === focusBookingId ? "tray" : undefined}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, border: r.id === focusBookingId ? "2px solid var(--accent-text)" : "1.5px dashed var(--info)", background: "var(--info-bg)", color: "var(--foreground)", borderRadius: 999, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: mayAssign ? "grab" : "default", touchAction: "none", userSelect: "none", whiteSpace: "nowrap" }}
            >
              {mayAssign && <Icon name="grip-vertical" size={13} strokeWidth={2} color="var(--info)" />}
              <span>{r.guestName ?? r.reference}</span>
              <span className="pms-num" style={{ fontWeight: 500, color: "var(--muted)" }}>{`${dateRangeIso(r.checkIn, r.checkOut)} · ${r.nights}n`}</span>
            </span>
          ))}
          {mayAssign && <span style={{ fontSize: 12, color: "var(--muted)" }}>— drag onto a room of the type they booked</span>}
        </div>
      ) : (
        <div style={{ border: "1px dashed var(--line2)", borderRadius: "var(--radius-surface)", padding: "12px 16px", fontSize: 12.5, color: "var(--muted)" }}>
          Every approved arrival in these two weeks has a room. Newly approved bookings appear here for assignment.
        </div>
      )}

      {roomList.length === 0 ? (
        <EmptyState style={{ padding: 26, fontSize: 13.5 }}>
          This property has no rooms yet. Rooms are set up under Inventory.
        </EmptyState>
      ) : (
        /* The chart */
        <div ref={chartRef} style={{ border: "1px solid var(--panel-bd)", borderRadius: "var(--radius-surface)", background: "var(--card)", overflow: "auto", maxHeight: "calc(100dvh - 322px)", minHeight: 340, position: "relative", overscrollBehavior: "contain" }}>
          {/* Grows to hold an open popover that fits neither above nor below,
              so the box scrolls to it rather than clipping it. */}
          <div style={{ width: GRID_W, position: "relative", minHeight: pop ? pop.y + POP_H : undefined }}>
            {/* Sticky day header */}
            <div style={{ display: "flex", position: "sticky", top: 0, zIndex: 6, background: "var(--card)", borderBottom: "1px solid var(--line2)" }}>
              <div style={{ width: LABEL_W, flex: `0 0 ${LABEL_W}px`, position: "sticky", left: 0, zIndex: 7, background: "var(--card)", display: "flex", alignItems: "center", padding: "0 14px", fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--muted2)", borderRight: "1px solid var(--line2)" }}>
                Rooms · {roomList.length}
              </div>
              {days.map((d) => (
                <div key={d.i} style={{ width: COL, flex: `0 0 ${COL}px`, padding: "6px 0 7px", textAlign: "center", background: d.today ? "var(--td)" : "transparent" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: d.today ? "var(--accent-text)" : "var(--faint)" }}>{d.wd}</div>
                  <div className="pms-num" style={{ fontSize: 14.5, fontWeight: 700, color: d.today ? "var(--accent-text)" : "var(--foreground)" }}>{d.dd}</div>
                  <div style={{ fontSize: 9.5, color: "var(--faint)" }}>{d.showMon ? d.mon : ""}</div>
                </div>
              ))}
            </div>

            {/* Rows */}
            <div ref={rowsRef} style={{ position: "relative" }}>
              {/* Vertical gridlines */}
              <div style={{ position: "absolute", left: LABEL_W, top: 0, bottom: 0, width: DAYS * COL, backgroundImage: `repeating-linear-gradient(to right, var(--line) 0, var(--line) 1px, transparent 1px, transparent ${COL}px)` }} />
              {/* Weekend bands */}
              {days.filter((d) => d.weekend && !d.today).map((d) => (
                <div key={`w${d.i}`} style={{ position: "absolute", top: 0, bottom: 0, left: LABEL_W + d.i * COL, width: COL, background: "var(--wk)" }} />
              ))}
              {/* Today band, when today is inside the window at all */}
              {todayCol >= 0 && todayCol < DAYS && (
                <div style={{ position: "absolute", top: 0, bottom: 0, left: LABEL_W + todayCol * COL, width: COL, background: "var(--td)", borderLeft: "2px solid var(--accent2)" }} />
              )}

              {roomList.map((rm, ri) => {
                const rowBars = bars.filter((b) => b.roomId === rm.id && overlaps(b.from, b.to, windowFrom, windowTo));
                const { lane } = rowLanes[ri];
                // One lane is the old single-row height; each extra lane adds
                // its own band, so a row with a clash is visibly taller rather
                // than hiding the clash.
                const rowHeight = rowHeights[ri];
                const gh = ghost && ghost.roomId === rm.id ? ghost : null;
                // While a bar is in the air, every row it cannot land on says
                // so before the drop rather than after it.
                const wrongType = dragging !== null && dragging.roomTypeId !== rm.roomTypeId;
                const dragFrom = dragRef.current?.bar?.from ?? dragging?.checkIn ?? windowFrom;
                const dragTo = dragRef.current?.bar?.to ?? dragging?.checkOut ?? windowFrom;
                return (
                  <div key={rm.id} style={{ display: "flex", height: rowHeight, borderTop: "1px solid var(--line)", position: "relative", opacity: wrongType ? 0.4 : 1 }}>
                    <div style={{ width: LABEL_W, flex: `0 0 ${LABEL_W}px`, position: "sticky", left: 0, zIndex: 5, background: "var(--card)", display: "flex", alignItems: "center", gap: 9, padding: "0 14px", borderRight: "1px solid var(--line2)" }}>
                      {/* The same colour Room status gives this state, and a
                          name a screen reader speaks; `title` alone reached
                          neither a keyboard nor a touch screen. */}
                      <span
                        role="img"
                        aria-label={`Housekeeping: ${HOUSEKEEPING_BY[rm.housekeeping].label}`}
                        title={HOUSEKEEPING_BY[rm.housekeeping].label}
                        style={{ width: 8, height: 8, flex: "0 0 auto", borderRadius: 99, background: HOUSEKEEPING_BY[rm.housekeeping].dot }}
                      />
                      <span className="pms-num" title={roomName(rm)} style={{ fontSize: 13, fontWeight: 700, color: rm.status === "available" ? "var(--foreground)" : "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, flex: "0 1 auto" }}>{roomName(rm)}</span>
                      <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, flex: "1 1 0" }}>
                        {rm.status === "available" ? rm.roomTypeName : rm.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div style={{ position: "relative", width: DAYS * COL, flex: "0 0 auto" }}>
                      {rowBars.map((b) => {
                        const start = daysBetweenIso(windowFrom, b.from);
                        const end = daysBetweenIso(windowFrom, b.to);
                        const gs = Math.max(start, 0);
                        const ge = Math.min(end, DAYS);
                        const c = KIND[b.kind];
                        const clipL = start < 0;
                        const clipR = end > DAYS;
                        const rad = clipL && clipR ? "0" : clipL ? "0 8px 8px 0" : clipR ? "8px 0 0 8px" : "8px";
                        const movable = mayAssign && b.hold !== null && b.reservation !== null;
                        const focused = focusBookingId !== null && b.reservation?.id === focusBookingId;
                        return (
                          // A button to the keyboard as well as the pointer:
                          // Tab reaches every bar and Enter opens the same
                          // details a click does. Moving a room is still a
                          // drag, and still pointer-only.
                          <div
                            key={b.key}
                            role="button"
                            tabIndex={0}
                            aria-label={`${c.label}: ${b.guest}, ${roomName(rm)}, ${dateRangeIso(b.from, b.to)}`}
                            onPointerDown={(e) => {
                              if (movable && b.reservation) startDrag(b.reservation, b, e);
                              else if (e.button === 0) openPop(b);
                            }}
                            onKeyDown={(e) => {
                              if (e.key !== "Enter" && e.key !== " ") return;
                              e.preventDefault();
                              openPop(b);
                            }}
                            title={`${c.label} · ${b.guest} · ${dateRangeIso(b.from, b.to)}`}
                            data-focus-bar={focused ? "bar" : undefined}
                            style={{ boxShadow: focused ? "0 0 0 2px var(--accent-text)" : undefined, position: "absolute", left: gs * COL + 2, width: Math.max(24, (ge - gs) * COL - 4), top: 5 + (lane.get(b.key) ?? 0) * LANE_H, height: 33, borderRadius: rad, background: c.bg, border: `1.5px solid ${c.bd}`, display: "flex", alignItems: "center", gap: 5, padding: "0 9px", cursor: movable ? "grab" : "pointer", touchAction: "none", userSelect: "none", overflow: "hidden", zIndex: 2, opacity: dragRef.current?.bar?.key === b.key && ghost ? 0.5 : 1 }}
                          >
                            <Icon name={c.icon} size={12} strokeWidth={2} color={b.kind === "out" ? c.fg : c.bd} />
                            <span style={{ fontSize: 11.5, fontWeight: 600, color: c.fg, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.guest}</span>
                          </div>
                        );
                      })}
                      {gh && dragging && (
                        <div
                          title={gh.why ?? undefined}
                          style={{ position: "absolute", left: Math.max(daysBetweenIso(windowFrom, dragFrom), 0) * COL + 2, width: Math.max(24, (Math.min(daysBetweenIso(windowFrom, dragTo), DAYS) - Math.max(daysBetweenIso(windowFrom, dragFrom), 0)) * COL - 4), top: 4, height: 35, borderRadius: 9, border: `2px dashed ${gh.bad ? "var(--bad)" : "var(--accent2)"}`, background: gh.bad ? "var(--bad-bg)" : "var(--td)", zIndex: 3, pointerEvents: "none" }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detail popover */}
            {pop && popBar && (
              <div className="pms-pop" style={{ position: "absolute", left: pop.x, top: pop.y, zIndex: 9, width: 272, background: "var(--panel)", border: "1px solid var(--card-bd)", borderRadius: "var(--radius-surface)", boxShadow: "var(--shadow-pop)", padding: "14px 15px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: "var(--foreground)" }}>{popBar.guest}</span>
                    <span className="pms-num" style={{ display: "block", marginTop: 1, fontSize: 11.5, color: "var(--muted)" }}>
                      {popRes ? `${popRes.reference} · ${popRes.nights} nights` : "Walk-in"}
                    </span>
                  </span>
                  <Button variant="ghost" onClick={() => setPop(null)} aria-label="Close" style={{ border: "none", background: "none", color: "var(--muted)", cursor: "pointer", display: "flex", padding: 2 }}>
                    <Icon name="x" size={16} />
                  </Button>
                </div>
                <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5 }}>
                  <PopRow label="Room" value={`${roomName(popRoom)} · ${popRoom?.roomTypeName ?? ""}`} />
                  <PopRow label="Dates" value={dateRangeIso(popBar.from, popBar.to)} num />
                  {popRes?.totalRwf != null && <PopRow label="Booked total" value={fmt(popRes.totalRwf)} num />}
                </div>
                <div style={{ marginTop: 8 }}>
                  {popBar.kind === "out" ? <Badge intent="neutral">Checked out</Badge>
                    : popBar.kind === "inhouse" ? <Badge intent="accent">In-house</Badge>
                    : <Badge intent="info">{popRes?.checkIn === today ? "Arrives today" : "Reserved"}</Badge>}
                </div>
                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                  {popBar.kind === "inhouse" && billPath ? (
                    <PopAction primary onClick={() => { router.push(href(billPath)); setPop(null); }}>View bill</PopAction>
                  ) : null}
                  {mayCheckIn && popRes ? (
                    <PopAction
                      primary
                      disabled={!can("stay.checkin")}
                      title={reasonFor("stay.checkin")}
                      onClick={() => { openCheckIn(seedFromServerReservation(popRes)); setPop(null); }}
                    >
                      Check in
                    </PopAction>
                  ) : null}
                  {popBar.hold && popRes ? (
                    <PopAction
                      disabled={!mayAssign || releaseRoom.isPending}
                      title={assignReason}
                      onClick={() => {
                        const hold = popBar.hold as OperatorRoomAssignment;
                        releaseRoom.mutate(
                          { bookingId: popRes.id, assignmentId: hold.id },
                          {
                            onSuccess: () => toast(`${roomName(popRoom)} is no longer held for ${popBar.guest}.`, "info"),
                            onError: toastError,
                          },
                        );
                        setPop(null);
                      }}
                    >
                      Unassign room
                    </PopAction>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The booking the grid was opened on, and a keyboard way to give it a room.
 *
 * Offers only rooms the grid itself would accept on a drop: the booked room
 * type, available, and free across the booking's nights. The server still
 * decides; a refusal comes back in its own words through the toast.
 */
function FocusPanel({
  reservation,
  heldRooms,
  stayRoom,
  canPlace,
  moving,
  eligible,
  picked,
  onPick,
  onPlace,
  placing,
  assignReason,
  recordHref,
  homeHref,
}: {
  reservation: OperatorReservation | null;
  heldRooms: string[];
  stayRoom: string | null;
  canPlace: boolean;
  moving: boolean;
  eligible: OperatorRoom[];
  picked: OperatorRoom | undefined;
  onPick: (roomId: string) => void;
  onPlace: () => void;
  placing: boolean;
  assignReason: string | undefined;
  recordHref: string;
  homeHref: string | null;
}) {
  if (!reservation) {
    return (
      <div data-focus-panel="missing" style={{ ...surface, padding: "12px 16px", fontSize: 13, color: "var(--ink2)" }}>
        That booking isn&apos;t on this property&apos;s list any more.{" "}
        <Link href={recordHref} className="font-semibold underline underline-offset-2">
          Back to Reservations
        </Link>
      </div>
    );
  }

  const guest = reservation.guestName ?? "Guest";
  const where = stayRoom
    ? `In ${stayRoom}`
    : heldRooms.length > 0
      ? `Holds ${heldRooms.join(", ")}`
      : reservation.state === "confirmed"
        ? "No room held yet"
        : null;

  return (
    <div
      data-focus-panel={reservation.id}
      style={{ ...surface, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
    >
      <span style={{ minWidth: 0, flex: "1 1 220px" }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>{guest}</span>
        <span className="pms-num" style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>
          {`${reservation.reference} · ${dateRangeIso(reservation.checkIn, reservation.checkOut)} · ${reservation.nights}n`}
          {where ? ` · ${where}` : ""}
        </span>
      </span>

      {canPlace &&
        (eligible.length > 0 && picked ? (
          <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <select
              aria-label={moving ? `Move ${guest} to room` : `Room for ${guest}`}
              value={picked.id}
              onChange={(e) => onPick(e.target.value)}
              disabled={assignReason !== undefined}
              className="h-10 min-w-0 max-w-full rounded border border-line2 bg-field px-2 text-sm text-foreground"
            >
              {eligible.map((rm) => (
                <option key={rm.id} value={rm.id}>
                  {roomName(rm)}
                </option>
              ))}
            </select>
            <ActionButton variant="primary" onClick={onPlace} pending={placing} deniedReason={assignReason}>
              {moving ? "Move here" : "Hold this room"}
            </ActionButton>
          </span>
        ) : (
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
            {moving
              ? "No other room of this type is free for these nights."
              : "No room of the booked type is free for these nights."}
          </span>
        ))}

      <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {homeHref && (
          <Link href={homeHref} className="text-sm underline underline-offset-2">
            Back to today
          </Link>
        )}
        <Link href={recordHref} className="text-sm font-semibold underline underline-offset-2">
          Open booking
        </Link>
      </span>
    </div>
  );
}

/** A legend entry drawn from the same table as the bars, glyph included. */
function LegendKey({ kind }: { kind: BarKind }) {
  const c = KIND[kind];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--ink2)" }}>
      <span aria-hidden style={{ width: 22, height: 16, borderRadius: 5, background: c.bg, border: `1.5px solid ${c.bd}`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name={c.icon} size={10} strokeWidth={2} color={kind === "out" ? c.fg : c.bd} />
      </span>
      {c.label}
    </span>
  );
}

function PopRow({ label, value, num }: { label: string; value: string; num?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span className={num ? "pms-num" : undefined} style={{ fontWeight: 600, color: "var(--foreground)", textAlign: "right" }}>{value}</span>
    </div>
  );
}

function PopAction({
  children,
  onClick,
  primary,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        flex: 1,
        border: primary ? "none" : "1px solid var(--card-bd)",
        background: primary ? "var(--accent)" : "var(--card)",
        color: primary ? "var(--accent-ink)" : "var(--ink2)",
        borderRadius: "var(--radius-surface)",
        padding: 9,
        fontSize: 12.5,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        minHeight: 38,
      }}
    >
      {children}
    </Button>
  );
}
