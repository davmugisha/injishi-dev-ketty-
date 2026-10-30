"use client";

import { toast } from "@heroui/react";
import type { ReservationChangeQuote } from "@injishi/contracts";
import { screenHref } from "@injishi/data";
import {
  ActionButton,
  ActionLink,
  AgendaCalendar,
  EmptyBlock,
  FilterMenu,
  FormDialog,
  formatDay,
  formatMoney,
  KeyValueList,
  PageContent,
  type ScheduleEvent,
  type ScheduleKind,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { previewBookingMove, saveBookingMove } from "@/features/pms/front-desk-actions";
import type { CalendarBoard, CalendarKind, CalendarStay, DeskRoom } from "@/server/stays/desk";
import { BookingPanel, type PanelStay } from "./BookingPanel";
import { NewBookingPanel } from "./NewBookingPanel";

const KINDS: ScheduleKind[] = [
  { id: "requested", label: "Request", color: "var(--warning)", tentative: true },
  { id: "confirmed", label: "Booked", color: "var(--accent)" },
  { id: "in_house", label: "In house", color: "var(--success)" },
  { id: "checked_out", label: "Left", color: "var(--chart-other)" },
];

const PANEL_STATE: Record<CalendarKind, PanelStay["state"]> = {
  requested: "pending",
  confirmed: "confirmed",
  in_house: "inhouse",
  checked_out: "left",
};

const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const plusHour = (time: string) => {
  const [h = 0, m = 0] = time.split(":").map(Number);
  return `${String(Math.min(h + 1, 23)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};
const WAITING = "waiting:";

const panelStay = (s: CalendarStay): PanelStay => ({
  guest: s.guest,
  reference: s.bookingRef,
  stayRef: s.stayRef,
  state: PANEL_STATE[s.kind],
  checkIn: s.start,
  checkOut: s.checkOut,
  guests: s.guests,
  room: s.room || null,
  roomType: s.roomType,
  phone: s.phone,
  totalRwf: s.totalRwf,
  paidRwf: s.paidRwf,
  balanceRwf: s.balanceRwf,
  cancellation: s.cancellation,
  roomId: s.roomId.startsWith(WAITING) ? null : s.roomId,
});

interface CalendarRoom {
  id: string;
  label: string;
  bookable: boolean;
  typeId: string;
  type: string;
}

type Moving = {
  stay: CalendarStay;
  checkIn: string;
  checkOut: string;
  quote: ReservationChangeQuote | null;
  problems: string[];
};

/** An entry's stay: a stay's nights, its arrival, or its departure (`arr:` and `dep:` ids). */
const stayIdOf = (id: string) => id.replace(/^(arr|dep):/, "");

/**
 * The booking calendar of a stay business, on the HeroUI Pro Agenda (day, week, month). Each stay is a
 * bar over its nights, titled by room and guest; in the day and week views the hours also carry each
 * arrival (at the guest's arrival time, else check-in time) and departure (at check-out time), so a day
 * reads as the desk's to-do. Agenda has no row per room, so rooms are filters: a type, a room, or the
 * bookings with no room yet. Choose a time to start a stay that day; choose an entry for its detail and
 * next step; drag a booking's arrival to move its dates, or its departure to change how long it stays
 * (the change is priced first, and a higher price goes on the guest's bill).
 */
export function StaysCalendarView({
  board,
  can,
}: {
  board: CalendarBoard;
  can: { approve: boolean; checkIn: boolean; assign: boolean };
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState<{ day: string; time: string } | null>(null);
  const [moving, setMoving] = useState<Moving | null>(null);
  const [type, setType] = useState("all");
  const [roomFilter, setRoomFilter] = useState("all");
  const [pending, start] = useTransition();

  const rooms = useMemo(
    () =>
      new Map<string, CalendarRoom>(
        board.roomTypes.flatMap((t) => t.rooms.map((r) => [r.id, { ...r, typeId: t.id, type: t.name }] as const)),
      ),
    [board.roomTypes],
  );
  const roomOptions = useMemo(
    () =>
      board.roomTypes
        .filter((t) => type === "all" || t.id === type)
        .flatMap((t) =>
          t.rooms.map((r) => ({
            id: r.id,
            label: r.id.startsWith(WAITING) ? `${t.name}: no room yet` : `${r.label} · ${t.name}`,
          })),
        ),
    [board.roomTypes, type],
  );
  const canMove = can.approve && can.assign;
  const shown = useMemo(
    () =>
      board.stays.filter(
        (s) => (type === "all" || s.roomTypeId === type) && (roomFilter === "all" || s.roomId === roomFilter),
      ),
    [board.stays, type, roomFilter],
  );

  // The property's times, with the usual ones when it has not set them.
  const checkInAt = board.checkInTime || "14:00";
  const checkOutAt = board.checkOutTime || "11:00";
  const events = useMemo<ScheduleEvent[]>(
    () =>
      shown.flatMap((s) => {
        const where = s.room ? `${s.room} · ` : "";
        const nights: ScheduleEvent = {
          id: s.id,
          kind: s.kind,
          title: `${where}${s.guest}`,
          start: s.start,
          end: s.end,
        };
        // Arrivals and departures still to come, on the clock.
        const coming = s.kind === "requested" || s.kind === "confirmed";
        const out: ScheduleEvent[] = [nights];
        if (coming) {
          const at = s.eta || checkInAt;
          out.push({
            id: `arr:${s.id}`,
            kind: s.kind,
            title: `Arrives · ${where}${s.guest}`,
            start: s.start,
            time: at,
            endTime: plusHour(at),
            movable: canMove && s.movable,
          });
        }
        if (coming || s.kind === "in_house") {
          out.push({
            id: `dep:${s.id}`,
            kind: s.kind,
            title: `Leaves · ${where}${s.guest}`,
            start: s.checkOut,
            time: checkOutAt,
            endTime: plusHour(checkOutAt),
            movable: canMove && s.movable,
          });
        }
        return out;
      }),
    [shown, checkInAt, checkOutAt, canMove],
  );
  const open = board.stays.find((s) => s.id === openId) ?? null;
  // Two stays in one room on a shared night: the panel says so.
  const clashes = useMemo(() => {
    const out = new Set<string>();
    const live = board.stays.filter((s) => !s.roomId.startsWith(WAITING) && s.kind !== "checked_out");
    for (const a of live)
      for (const b of live)
        if (a.id < b.id && a.roomId === b.roomId && a.start <= b.end && b.start <= a.end) {
          out.add(a.id);
          out.add(b.id);
        }
    return out;
  }, [board.stays]);
  const panelRooms = useMemo<DeskRoom[]>(
    () =>
      [...rooms.values()]
        .filter((r) => r.bookable)
        .map((r) => ({ id: r.id, label: r.label, typeId: r.typeId, type: r.type })),
    [rooms],
  );

  /** An arrival dragged moves the whole stay; a departure dragged changes how many nights. */
  const move = async (event: ScheduleEvent, next: { start: string }): Promise<string | null> => {
    const stay = board.stays.find((s) => s.id === stayIdOf(event.id));
    if (!stay?.bookingRef) return "Only a booking not yet checked in moves here.";
    const arrival = event.id.startsWith("arr:");
    const checkIn = arrival ? next.start : stay.start;
    const checkOut = arrival ? shift(stay.checkOut, daysBetween(stay.start, next.start)) : next.start;
    if (checkIn < board.today) return "A booking can't move into the past.";
    if (checkOut <= checkIn) return "A stay needs at least one night.";
    if (checkIn === stay.start && checkOut === stay.checkOut) return null;
    const roomId = stay.roomId.startsWith(WAITING) ? null : stay.roomId;
    const r = await previewBookingMove(stay.bookingRef, { roomId, checkIn, checkOut });
    if (!r.ok) return r.error;
    setMoving({ stay, checkIn, checkOut, ...r.value });
    return null;
  };

  const confirmMove = () => {
    const ref = moving?.stay.bookingRef;
    if (!moving || !ref) return;
    const { stay, checkIn, checkOut } = moving;
    const roomId = stay.roomId.startsWith(WAITING) ? null : stay.roomId;
    start(async () => {
      const r = await saveBookingMove(ref, { roomId, checkIn, checkOut });
      if (!r.ok) {
        toast.danger(r.error);
        return;
      }
      toast.success(`${stay.guest} now stays ${formatDay(checkIn)} to ${formatDay(checkOut)}`);
      setMoving(null);
      router.refresh();
    });
  };

  const price = (q: ReservationChangeQuote) =>
    q.differenceRwf > 0
      ? `${formatMoney(q.differenceRwf)} more, on the bill`
      : q.differenceRwf < 0
        ? `${formatMoney(-q.differenceRwf)} less, as credit on the bill`
        : "No change";

  const typeOptions = [
    { id: "all", label: "All room types" },
    ...board.roomTypes.map((t) => ({ id: t.id, label: t.name })),
  ];

  return (
    <PageContent>
      <AreaHeader
        actions={
          <>
            <ActionLink href={screenHref("WalkIn")} icon="PersonPlus">
              Walk in
            </ActionLink>
            {can.approve ? (
              <ActionButton intent="primary" icon="Plus" onPress={() => setCreating({ day: board.today, time: "" })}>
                New booking
              </ActionButton>
            ) : null}
          </>
        }
      />
      {board.roomTypes.length === 0 ? (
        <EmptyBlock
          icon="Calendar"
          title="No rooms yet"
          description="Rooms and their bookings show here once the place has rooms."
        />
      ) : (
        <AgendaCalendar
          label="Bookings and stays"
          events={events}
          kinds={KINDS}
          today={board.today}
          defaultView="week"
          startHour={6}
          endHour={23}
          onSelect={(e) => setOpenId(stayIdOf(e.id))}
          onCreate={can.approve ? (day, time) => setCreating({ day, time }) : undefined}
          onMove={canMove ? move : undefined}
          hint={can.approve ? "Choose a time on a day to book a guest" : undefined}
          toolbar={
            <>
              <FilterMenu
                label="Room type"
                name="Type"
                icon="FolderHouse"
                compact
                options={typeOptions}
                value={type}
                onChange={(v) => {
                  setType(v);
                  setRoomFilter("all");
                }}
              />
              <FilterMenu
                label="Room"
                name="Room"
                icon="House"
                compact
                options={[{ id: "all", label: "All rooms" }, ...roomOptions]}
                value={roomFilter}
                onChange={setRoomFilter}
              />
            </>
          }
        />
      )}

      <BookingPanel
        stay={open ? { ...panelStay(open), clash: clashes.has(open.id) } : null}
        today={board.today}
        can={can}
        rooms={panelRooms}
        onClose={() => setOpenId(null)}
      />

      {creating ? (
        <NewBookingPanel
          roomTypes={board.roomTypes.map((t) => ({ id: t.id, name: t.name }))}
          today={board.today}
          initial={{
            day: creating.day,
            time: creating.time,
            ...(type !== "all" ? { roomTypeId: type } : {}),
            ...(roomFilter !== "all" && !roomFilter.startsWith(WAITING) ? { roomId: roomFilter } : {}),
          }}
          onClose={() => setCreating(null)}
        />
      ) : null}

      <FormDialog
        isOpen={moving !== null}
        onOpenChange={(o) => (o ? undefined : setMoving(null))}
        title={`Change ${moving?.stay.guest ?? "the booking"}'s dates?`}
        size="sm"
        submitLabel="Change"
        isPending={pending}
        isSubmitDisabled={(moving?.problems.length ?? 0) > 0}
        formError={moving && moving.problems.length > 0 ? moving.problems.join(" ") : undefined}
        onSubmit={(e) => {
          e.preventDefault();
          confirmMove();
        }}
      >
        {moving ? (
          <KeyValueList
            items={[
              { label: "Room", value: moving.stay.room || `${moving.stay.roomType}, no room yet` },
              {
                label: "Dates",
                value: `${formatDay(moving.checkIn, "long")} to ${formatDay(moving.checkOut, "long")}`,
              },
              ...(moving.quote ? [{ label: "Price", value: price(moving.quote) }] : []),
            ]}
          />
        ) : null}
      </FormDialog>
    </PageContent>
  );
}
