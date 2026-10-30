"use client";

import { FieldError, Input, Label, TextField, toast } from "@heroui/react";
import type { ReservationChangeQuote } from "@injishi/contracts";
import { screenHref } from "@injishi/data";
import {
  ActionLink,
  EmptyBlock,
  FormDialog,
  formatDay,
  formatMoney,
  formatNumber,
  KeyValueList,
  PageContent,
  PhoneInput,
  type RackGroup,
  type RackSpan,
  type RoomStay,
  RoomTimeline,
  type ScheduleKind,
  SidePanel,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { checkInWalkIn, previewBookingMove, saveBookingMove } from "@/features/pms/front-desk-actions";
import type { CalendarBoard, CalendarKind, CalendarStay } from "@/server/stays/desk";
import { BookingPanel, type PanelStay } from "./BookingPanel";

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

const nextDay = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
const nightsIn = (span: RackSpan) =>
  Math.round((Date.parse(`${span.end}T00:00:00Z`) - Date.parse(`${span.start}T00:00:00Z`)) / 86_400_000) + 1;

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
  to: RackSpan;
  room: CalendarRoom;
  quote: ReservationChangeQuote | null;
  problems: string[];
};

/**
 * The booking calendar of a stay business (2026-10-30): rooms down the side by type, nights across, each
 * booking and stay a card over its nights. Choose empty nights to check a guest in there; choose a card
 * for its detail and next step; drag a booking not yet checked in to other nights or another room (the
 * change is priced first, and a higher price goes on the guest's bill).
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
  const [creating, setCreating] = useState<RackSpan | null>(null);
  const [moving, setMoving] = useState<Moving | null>(null);
  const [pending, start] = useTransition();

  const rooms = useMemo(
    () =>
      new Map<string, CalendarRoom>(
        board.roomTypes.flatMap((t) => t.rooms.map((r) => [r.id, { ...r, typeId: t.id, type: t.name }] as const)),
      ),
    [board.roomTypes],
  );
  const groups = useMemo<RackGroup[]>(
    () =>
      board.roomTypes.map((t) => {
        const real = t.rooms.filter((r) => !r.id.startsWith("waiting:")).length;
        return {
          id: t.id,
          label: t.name,
          meta: `${formatNumber(real)} ${real === 1 ? "room" : "rooms"}`,
          rooms: t.rooms,
        };
      }),
    [board.roomTypes],
  );
  const canMove = can.approve && can.assign;
  const events = useMemo<RoomStay[]>(
    () =>
      board.stays.map((s) => ({
        id: s.id,
        roomId: s.roomId,
        kind: s.kind,
        title: s.guest,
        start: s.start,
        end: s.end,
        movable: canMove && s.movable,
      })),
    [board.stays, canMove],
  );
  const open = board.stays.find((s) => s.id === openId) ?? null;

  const move = (event: RoomStay, to: RackSpan) => {
    const stay = board.stays.find((s) => s.id === event.id);
    const room = rooms.get(to.roomId);
    if (!stay?.bookingRef || !room) return;
    if (!room.bookable) {
      toast.danger("Drop the booking on a room.");
      return;
    }
    if (to.start < board.today) {
      toast.danger("A booking can't move into the past.");
      return;
    }
    const ref = stay.bookingRef;
    start(async () => {
      const r = await previewBookingMove(ref, { roomId: room.id, checkIn: to.start, checkOut: nextDay(to.end) });
      if (!r.ok) {
        toast.danger(r.error);
        return;
      }
      setMoving({ stay, to, room, ...r.value });
    });
  };

  const confirmMove = () => {
    const ref = moving?.stay.bookingRef;
    if (!moving || !ref) return;
    const { stay, to, room } = moving;
    start(async () => {
      const r = await saveBookingMove(ref, { roomId: room.id, checkIn: to.start, checkOut: nextDay(to.end) });
      if (!r.ok) {
        toast.danger(r.error);
        return;
      }
      toast.success(`${stay.guest} moved to ${room.label}, ${formatDay(to.start)}`);
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

  return (
    <PageContent>
      <AreaHeader
        actions={
          <ActionLink href={screenHref("WalkIn")} icon="PersonPlus" intent="primary">
            Walk in
          </ActionLink>
        }
      />
      {board.roomTypes.length === 0 ? (
        <EmptyBlock
          icon="Calendar"
          title="No rooms yet"
          description="Rooms and their bookings show here once the place has rooms."
        />
      ) : (
        <RoomTimeline
          label="Rooms and stays"
          groups={groups}
          events={events}
          kinds={KINDS}
          today={board.today}
          onSelect={(e) => setOpenId(e.id)}
          onCreate={can.checkIn ? setCreating : undefined}
          onMove={canMove ? move : undefined}
        />
      )}

      <BookingPanel
        stay={open ? panelStay(open) : null}
        today={board.today}
        can={{ approve: can.approve, checkIn: can.checkIn }}
        onClose={() => setOpenId(null)}
      />

      {creating ? (
        <NewStayPanel
          span={creating}
          today={board.today}
          room={rooms.get(creating.roomId) ?? null}
          onClose={() => setCreating(null)}
        />
      ) : null}

      <FormDialog
        isOpen={moving !== null}
        onOpenChange={(o) => (o ? undefined : setMoving(null))}
        title={`Move ${moving?.stay.guest ?? "the booking"}?`}
        size="sm"
        submitLabel="Move"
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
              { label: "Room", value: `${moving.room.label} (${moving.room.type})` },
              {
                label: "Dates",
                value: `${formatDay(moving.to.start, "long")} to ${formatDay(nextDay(moving.to.end), "long")}`,
              },
              ...(moving.quote ? [{ label: "Price", value: price(moving.quote) }] : []),
            ]}
          />
        ) : null}
      </FormDialog>
    </PageContent>
  );
}

/**
 * A new stay in the chosen room and nights. The desk checks a guest in from today (a walk in, the API's
 * `POST /ops/stays/walk-in`); it takes no desk booking for a later day yet, so a later start says so.
 */
function NewStayPanel({
  span,
  today,
  room,
  onClose,
}: {
  span: RackSpan;
  today: string;
  room: CalendarRoom | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const count = nightsIn(span);
  const later = span.start > today;

  return (
    <SidePanel
      isOpen
      onOpenChange={(o) => (o ? undefined : onClose())}
      title="New stay"
      description={room ? `${room.label}, ${room.type}` : undefined}
      submitLabel="Check in"
      submitIcon="ArrowRightToSquare"
      isPending={pending}
      isSubmitDisabled={later || !room}
      validationErrors={error ? { guestName: error } : undefined}
      onSubmit={(e) => {
        e.preventDefault();
        if (!room || later) return;
        if (!name.trim()) {
          setError("Type the guest's name as it is on their ID.");
          return;
        }
        start(async () => {
          const r = await checkInWalkIn({
            roomTypeId: room.typeId,
            roomId: room.id,
            nights: count,
            guestName: name.trim(),
            phone: phone ?? undefined,
          });
          if (!r.ok) {
            toast.danger(r.error);
            return;
          }
          toast.success(`${name.trim()} checked in to ${r.value.room}`);
          onClose();
          router.refresh();
        });
      }}
    >
      <KeyValueList
        items={[
          { label: "Dates", value: `${formatDay(span.start, "long")} to ${formatDay(nextDay(span.end), "long")}` },
          { label: "Nights", value: formatNumber(count) },
        ]}
      />
      {later ? (
        <p className="text-sm text-muted">
          The desk checks guests in from today. Guests book later nights online, then show here.
        </p>
      ) : null}
      <TextField
        name="guestName"
        isRequired
        value={name}
        onChange={(v) => {
          setName(v);
          setError(null);
        }}
        isDisabled={later}
        className="flex flex-col gap-1"
      >
        <Label>Guest name</Label>
        <Input autoComplete="off" />
        <FieldError />
      </TextField>
      <PhoneInput label="Phone" value={phone} onChange={(v) => setPhone(v)} isDisabled={later} />
    </SidePanel>
  );
}
