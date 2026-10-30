"use client";

import { CircleCheck, CircleDashed, PersonPlus, TriangleExclamation } from "@gravity-ui/icons";
import { Card, Chip } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import { type IconName, screenHref } from "@injishi/data";
import { ActionLink, EmptyBlock, Icon, LinkButton, PageContent, PageHeader, StatusDot, type Tone } from "@injishi/ui";
import NextLink from "next/link";
import { type CSSProperties, Fragment, useMemo, useState } from "react";
import type { RackBar, RackBarKind, RackLane, RackRoomState, RoomRack } from "@/server/sources/room-rack";
import { ChoiceSelect } from "./shared";

const ALL_TYPES = "All room types";

const KIND_ICON: Record<RackBarKind, IconName> = {
  inhouse: "House",
  booked: "Calendar",
  tentative: "Clock",
  departed: "ArrowRightFromSquare",
};

const KIND_CLASS: Record<RackBarKind, string> = {
  booked: "bg-accent-soft text-accent-soft-foreground ring-1 ring-inset ring-accent",
  inhouse: "bg-accent text-accent-foreground",
  tentative: "bg-surface text-foreground ring-[1.5px] ring-inset ring-border",
  departed: "bg-surface-tertiary text-muted",
};

const KIND_WORD: Record<RackBarKind, string> = {
  booked: "Confirmed",
  inhouse: "In house",
  tentative: "Request",
  departed: "Checked out",
};

const LEGEND: RackBarKind[] = ["booked", "inhouse", "tentative", "departed"];

const DOT: Record<RackRoomState, Tone> = {
  dirty: "warning",
  clean: "success",
  inspected: "success",
  occupied: "default",
  ooo: "danger",
};

const BAR_BASE =
  "absolute top-1 bottom-1 flex min-w-0 items-center gap-1.5 overflow-hidden rounded-lg px-2 text-xs font-medium whitespace-nowrap no-underline";

/**
 * The room rack on the property's own records (2026-10-30): each room by type across the next one or two
 * weeks, with who is in it, who is booked into it, and the bookings that still need a room. Yesterday is the
 * first column so a guest leaving this morning is still on it. Each bar opens its booking.
 */
export function RoomRackView({ rack }: { rack: RoomRack }) {
  const [span, setSpan] = useState<14 | 7>(14);
  const [type, setType] = useState(ALL_TYPES);
  const n = span;
  const shownDays = rack.days.slice(0, n);
  const pct = (x: number) => Number(((x / n) * 100).toFixed(3));
  const clamp = (x: number) => Math.max(0, Math.min(n, x));
  const first = shownDays[0];
  const last = shownDays[shownDays.length - 1];
  const rangeLabel =
    first && last
      ? first.month === last.month
        ? `${first.dow} ${first.day} – ${last.dow} ${last.day} ${last.month}`
        : `${first.dow} ${first.day} ${first.month} – ${last.dow} ${last.day} ${last.month}`
      : "";

  const visible = useMemo(() => {
    const id = rack.types.find((t) => t.name === type)?.id;
    return type === ALL_TYPES ? rack.lanes : rack.lanes.filter((l) => l.roomTypeId === id);
  }, [rack, type]);
  const shownRooms = visible.filter((l) => l.kind === "room").length;

  const gridLines: CSSProperties = {
    backgroundImage: "linear-gradient(to right, var(--separator) 1px, transparent 1px)",
    backgroundSize: `${pct(1)}% 100%`,
  };

  const renderBar = (lane: RackLane, b: RackBar) => {
    const l = clamp(b.from);
    const r = clamp(b.to);
    if (r - l <= 0) return null;
    const style: CSSProperties = { left: `${pct(l)}%`, width: `${Math.max(0, pct(r - l) - 0.35)}%` };
    const flag = lane.kind === "unassigned" ? "ring-[1.5px] ring-inset ring-warning" : "";
    const where = lane.kind === "unassigned" ? "no room yet" : `room ${lane.label}`;
    return (
      <NextLink
        key={b.id}
        href={b.href}
        title={`${b.guest} · ${KIND_WORD[b.kind]} · ${where} · ${b.dates}${b.reference ? ` · ${b.reference}` : ""}`}
        aria-label={`${b.guest}, ${KIND_WORD[b.kind].toLowerCase()}, ${b.dates}. Open the booking`}
        className={`${BAR_BASE} ${KIND_CLASS[b.kind]} ${flag} hover:brightness-95`}
        style={style}
      >
        <Icon name={KIND_ICON[b.kind]} className="size-3.5 flex-none" />
        <span className="truncate">{b.guest}</span>
      </NextLink>
    );
  };

  if (rack.totalRooms === 0 && rack.unassigned === 0) {
    return (
      <PageContent>
        <PageHeader eyebrow={`Calendar · ${rack.property}`} title="Room Rack" />
        <EmptyBlock
          icon="House"
          title="No rooms to show yet"
          description="The rack lists each room of every room type. Add your room types and how many rooms each has in your listing's setup."
          action={
            <ActionLink href="/front-desk" icon="ArrowLeft">
              Front desk
            </ActionLink>
          }
        />
      </PageContent>
    );
  }

  return (
    <PageContent className="gap-4 text-[14px] leading-5">
      <PageHeader
        eyebrow={`Calendar · ${rack.property}`}
        title="Room Rack"
        description={`${rangeLabel} · ${shownRooms} of ${rack.totalRooms} rooms · press a booking to open it.`}
        actions={
          <>
            <Segment
              aria-label="Days shown"
              selectedKey={String(span)}
              onSelectionChange={(k) => setSpan(String(k) === "7" ? 7 : 14)}
            >
              <Segment.Item id="14">14 days</Segment.Item>
              <Segment.Item id="7">7 days</Segment.Item>
            </Segment>
            {rack.types.length > 1 ? (
              <ChoiceSelect
                aria-label="Room types shown"
                options={[ALL_TYPES, ...rack.types.map((t) => t.name)]}
                value={type}
                onChange={setType}
                className="min-w-[170px]"
              />
            ) : null}
            <LinkButton href={screenHref("WalkIn")} variant="secondary">
              <PersonPlus className="size-4" />
              Walk-in
            </LinkButton>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {rack.overlaps ? (
          <Chip variant="soft" color="danger">
            <TriangleExclamation className="size-3" />
            <Chip.Label>
              {rack.overlaps} {rack.overlaps === 1 ? "room has" : "rooms have"} two stays on one night
            </Chip.Label>
          </Chip>
        ) : (
          <Chip variant="soft" color="success">
            <CircleCheck className="size-3" />
            <Chip.Label>No double bookings</Chip.Label>
          </Chip>
        )}
        {rack.unassigned ? (
          <Chip variant="soft" color="warning">
            <CircleDashed className="size-3" />
            <Chip.Label>
              {rack.unassigned} {rack.unassigned === 1 ? "booking" : "bookings"} without a room
            </Chip.Label>
          </Chip>
        ) : null}
        <span className="flex-1" />
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legend">
          {LEGEND.map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`inline-block size-3 rounded-[4px] ${KIND_CLASS[k]}`} />
              {KIND_WORD[k]}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-3 w-0.5 rounded-full bg-accent" />
            Now
          </li>
        </ul>
      </div>

      <Card className="overflow-hidden p-0" aria-label="Rooms by night">
        <div className="overflow-x-auto">
          <div className="grid min-w-[880px] grid-cols-[180px_minmax(0,1fr)]">
            <div className="flex h-12 items-center border-r border-b border-separator px-2.5 text-xs font-medium text-muted">
              Room
            </div>
            <div
              className="grid h-12 border-b border-separator"
              style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
            >
              {shownDays.map((d) => {
                const today = d.date === rack.today;
                return (
                  <div
                    key={d.date}
                    className={`flex flex-col items-center justify-center border-r border-separator px-0.5 text-center text-xs leading-4 ${
                      today ? "bg-accent/10" : ""
                    }`}
                  >
                    <span className={`font-semibold ${today ? "text-accent-soft-foreground" : "text-foreground"}`}>
                      {d.dow} {d.day}
                    </span>
                    <span className="text-[11px] text-muted tabular">
                      {today ? `Today · ${d.free} free` : `${d.free} free`}
                    </span>
                  </div>
                );
              })}
            </div>

            {visible.map((lane) =>
              lane.kind === "group" ? (
                <div
                  key={lane.id}
                  className="col-span-2 flex h-[26px] items-center gap-2 border-b border-separator bg-surface-secondary px-2.5 text-xs font-semibold"
                >
                  {lane.label}
                  <span className="font-normal text-muted">{lane.meta}</span>
                </div>
              ) : (
                <Fragment key={lane.id}>
                  <div className="flex h-[34px] min-w-0 items-center gap-2 border-r border-b border-separator px-2.5 text-xs text-muted">
                    <span
                      className={`truncate font-semibold text-foreground ${lane.kind === "room" ? "text-[13px] tabular" : "text-xs"}`}
                    >
                      {lane.label}
                    </span>
                    <StatusDot tone={lane.state ? DOT[lane.state] : "warning"} />
                    <span className="truncate text-[11px]">{lane.meta}</span>
                    {lane.overlap ? (
                      <TriangleExclamation
                        className="size-3 flex-none text-danger"
                        aria-label="Two stays on one night"
                      />
                    ) : null}
                  </div>
                  <div className="relative h-[34px] border-b border-separator" style={gridLines}>
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 bg-accent/[0.07]"
                      style={{ left: `${pct(1)}%`, width: `${pct(1)}%` }}
                    />
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 z-[2] w-0.5 bg-accent"
                      style={{ left: `${pct(rack.now)}%` }}
                    />
                    {lane.bars.map((b) => renderBar(lane, b))}
                  </div>
                </Fragment>
              ),
            )}
          </div>
        </div>
      </Card>

      <p className="text-xs text-muted">
        Bars run from the arrival afternoon to the departure morning. A booking without a room is under its room type;
        give it one from its booking in Reservations.
      </p>
    </PageContent>
  );
}
