"use client";

import { CircleCheck, CircleDashed, PersonPlus, TriangleExclamation, Xmark } from "@gravity-ui/icons";
import { Button, Card, Chip, Link, Popover, Switch, Tooltip } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import { type IconName, screenHref } from "@injishi/data";
import type { RackBar, RackBarKind, RackDay, RackLane, RoomMove, RoomStatus } from "@injishi/data/fixtures/frontdesk";
import { Icon, LinkButton, PageContent, PageHeader, StatusDot, type Tone } from "@injishi/ui";
import { type CSSProperties, Fragment, useMemo, useState } from "react";
import { bookingHref, ChoiceSelect, ROOM_STATUS } from "./shared";

/** First day shown on the rack (Sun 11 Oct); "today" is the second column. */
const FIRST_DAY = 11;
/** Now: Mon 12 Oct, 10:47 — 1.449 days after the rack starts. */
const NOW = 1.449;
const ALL_TYPES = "All room types";

const KIND_ICON: Record<RackBarKind, IconName> = {
  inhouse: "House",
  booked: "Calendar",
  tentative: "Clock",
  group: "Persons",
  ooo: "Wrench",
};

const KIND_CLASS: Record<RackBarKind, string> = {
  booked: "bg-accent-soft text-accent-soft-foreground ring-1 ring-inset ring-accent",
  inhouse: "bg-accent text-accent-foreground",
  tentative: "bg-surface text-foreground ring-[1.5px] ring-inset ring-border",
  group: "bg-surface-tertiary text-foreground ring-1 ring-inset ring-muted/60",
  ooo: "bg-[repeating-linear-gradient(135deg,var(--surface-secondary)_0_3px,var(--surface-tertiary)_3px_6px)] text-muted",
};

const LEGEND: { label: string; swatch: string }[] = [
  { label: "Confirmed", swatch: KIND_CLASS.booked },
  { label: "In house", swatch: KIND_CLASS.inhouse },
  { label: "Request or option", swatch: KIND_CLASS.tentative },
  { label: "Group block", swatch: KIND_CLASS.group },
  { label: "Out of order", swatch: KIND_CLASS.ooo },
];

const DOT: Record<RoomStatus, Tone> = {
  dirty: "warning",
  clean: "success",
  inspected: "success",
  occupied: "default",
  ooo: "danger",
};

const CHECK_TONE: Record<"success" | "warning" | "default", string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  default: "bg-surface-secondary text-muted",
};

const BAR_BASE =
  "absolute top-1 bottom-1 flex h-auto min-w-0 items-center gap-1.5 overflow-hidden rounded-lg px-2 text-xs font-medium whitespace-nowrap no-underline";

export function RoomRackView({
  days,
  lanes,
  move,
  recordIds,
}: {
  days: RackDay[];
  lanes: RackLane[];
  move: RoomMove | null;
  recordIds: string[];
}) {
  const [span, setSpan] = useState<14 | 7>(14);
  const [moveState, setMoveState] = useState<"open" | "closed" | "done">(move ? "open" : "done");
  const [notify, setNotify] = useState(true);
  const [reason, setReason] = useState(move?.reasons[0] ?? "");
  const [type, setType] = useState(ALL_TYPES);

  const moved = moveState === "done";
  const n = span;
  const shownDays = days.slice(0, n);
  const pct = (x: number) => Number(((x / n) * 100).toFixed(3));
  const pos = (d: number) => Math.max(0, Math.min(n, d - FIRST_DAY + 0.5));
  const first = shownDays[0];
  const last = shownDays[shownDays.length - 1];
  const rangeLabel = first && last ? `${first.dow} ${first.day} – ${last.dow} ${last.day} October` : "";

  const types = useMemo(() => lanes.filter((l) => l.kind === "group" && l.rooms > 0).map((l) => l.label), [lanes]);

  // Sections: a group header followed by its room lanes; filtered by room type.
  const visible = useMemo(() => {
    const out: RackLane[] = [];
    let header: RackLane | null = null;
    let pending: RackLane[] = [];
    const flush = () => {
      if (header && pending.length) out.push(header, ...pending);
      pending = [];
    };
    for (const l of lanes) {
      if (l.kind === "group") {
        flush();
        header = l;
      } else if (type === ALL_TYPES || l.group === type) {
        pending.push(l);
      }
    }
    flush();
    return out;
  }, [lanes, type]);

  const shownRooms = visible.filter((l) => l.kind === "room" && l.status !== null).length;
  const totalRooms =
    type === ALL_TYPES
      ? lanes.reduce((sum, l) => sum + l.rooms, 0)
      : (lanes.find((l) => l.kind === "group" && l.label === type)?.rooms ?? 0);
  const unassigned = lanes.filter((l) => l.kind === "room" && l.status === null).length;

  const openMove = () => {
    if (!moved) setMoveState("open");
  };

  const gridLines: CSSProperties = {
    backgroundImage: "linear-gradient(to right, var(--separator) 1px, transparent 1px)",
    backgroundSize: `${pct(1)}% 100%`,
  };

  const renderBar = (lane: RackLane, b: RackBar) => {
    const l = pos(b.from);
    const r = pos(b.to);
    if (r - l <= 0) return null;
    const style: CSSProperties = { left: `${pct(l)}%`, width: `${Math.max(0, pct(r - l) - 0.35)}%` };
    const kind: RackBarKind = b.proposal && moved ? "booked" : b.kind;
    const label = moved && b.movedLabel ? b.movedLabel : b.label;
    const flag =
      b.flag === "warning"
        ? "ring-[1.5px] ring-inset ring-warning"
        : b.conflict && !moved
          ? "ring-[1.5px] ring-inset ring-danger"
          : "";
    const content = (
      <>
        <Icon name={b.icon ?? KIND_ICON[kind]} className="size-3.5 flex-none" />
        <span className="truncate">{label}</span>
      </>
    );
    const dates = `${b.from} → ${b.to} Oct`;

    if (b.proposal && !moved && move) {
      return (
        <Popover
          key={b.id}
          isOpen={moveState === "open"}
          onOpenChange={(open) => setMoveState(open ? "open" : "closed")}
        >
          <Button
            aria-label={`${label}, ${dates}. Review the move`}
            className={`${BAR_BASE} h-auto min-h-0 justify-start bg-surface text-accent-soft-foreground ring-[1.5px] ring-inset ring-accent hover:bg-accent-soft`}
            style={style}
          >
            {content}
          </Button>
          <Popover.Content
            placement="right bottom"
            isNonModal
            className="w-[400px] max-w-[calc(100vw-32px)]"
            aria-labelledby="mv-h"
          >
            <Popover.Dialog aria-labelledby="mv-h" className="flex flex-col gap-3">
              <div className="flex items-start gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <Popover.Heading id="mv-h" className="text-[15px] leading-[22px] font-semibold">
                    {move.title}
                  </Popover.Heading>
                  <span className="text-xs text-muted tabular">{move.detail}</span>
                </div>
                <Button size="sm" variant="ghost" isIconOnly aria-label="Close" onPress={() => setMoveState("closed")}>
                  <Xmark className="size-4" />
                </Button>
              </div>
              <ul className="flex flex-col gap-2.5">
                {move.checks.map((c) => (
                  <li key={c.id} className="flex items-start gap-2.5">
                    <span
                      className={`inline-flex size-6 flex-none items-center justify-center rounded-lg ${CHECK_TONE[c.tone]}`}
                    >
                      <Icon name={c.icon} className="size-3.5" />
                    </span>
                    <span className="flex flex-col">
                      <span className="text-[13px] font-medium">{c.title}</span>
                      <span className="text-xs leading-4 text-muted">{c.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <ChoiceSelect label="Reason" options={move.reasons} value={reason} onChange={setReason} />
              <Switch isSelected={notify} onChange={setNotify}>
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  Message {move.firstName} about the move
                </Switch.Content>
              </Switch>
              <div className="flex justify-end gap-2 border-t border-separator pt-3">
                <Button size="sm" variant="secondary" onPress={() => setMoveState("closed")}>
                  Not now
                </Button>
                <Button size="sm" onPress={() => setMoveState("done")}>
                  Confirm move
                </Button>
              </div>
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
      );
    }

    const href =
      kind === "inhouse"
        ? screenHref("StayFolio")
        : (kind === "booked" || kind === "tentative") && b.bookingId
          ? bookingHref(b.bookingId, recordIds)
          : null;
    if (href) {
      return (
        <Tooltip key={b.id} delay={400} closeDelay={0}>
          <Link
            href={href}
            aria-label={`${label}, room ${lane.room}, ${dates}`}
            className={`${BAR_BASE} ${KIND_CLASS[kind]} ${flag} hover:brightness-95`}
            style={style}
          >
            {content}
          </Link>
          <Tooltip.Content>
            {label} · {dates}
          </Tooltip.Content>
        </Tooltip>
      );
    }
    return (
      <span
        key={b.id}
        title={`${label} · ${dates}`}
        className={`${BAR_BASE} ${KIND_CLASS[kind]} ${flag}`}
        style={style}
      >
        {content}
      </span>
    );
  };

  return (
    <PageContent className="gap-4 text-[14px] leading-5">
      <PageHeader
        eyebrow="Calendar · Isangano Lakeside Hotel"
        title="Room Rack"
        description={`${rangeLabel} · ${shownRooms} of ${totalRooms} rooms · moves and split stays go through a room-status and folio check.`}
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
            <ChoiceSelect
              aria-label="Room types shown"
              options={[ALL_TYPES, ...types]}
              value={type}
              onChange={setType}
              className="min-w-[170px]"
            />
            <LinkButton href={screenHref("WalkIn")} variant="secondary">
              <PersonPlus className="size-4" />
              Walk-in
            </LinkButton>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {move && !moved ? (
          <Button size="sm" variant="danger-soft" className="rounded-full" onPress={openMove}>
            <TriangleExclamation className="size-3.5" />
            {move.conflictChip}
          </Button>
        ) : (
          <Chip variant="soft" color="success">
            <CircleCheck className="size-3" />
            <Chip.Label>No conflicts</Chip.Label>
          </Chip>
        )}
        {unassigned ? (
          <Chip variant="soft" color="warning">
            <CircleDashed className="size-3" />
            <Chip.Label>
              {unassigned} {unassigned === 1 ? "arrival" : "arrivals"} without a room
            </Chip.Label>
          </Chip>
        ) : null}
        <span className="flex-1" />
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legend">
          {LEGEND.map((it) => (
            <li key={it.label} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`inline-block size-3 rounded-[4px] ${it.swatch}`} />
              {it.label}
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
          <div className="grid min-w-[880px] grid-cols-[160px_minmax(0,1fr)]">
            <div className="flex h-12 items-center border-r border-b border-separator px-2.5 text-xs font-medium text-muted">
              Room
            </div>
            <div
              className="grid h-12 border-b border-separator"
              style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
            >
              {shownDays.map((d, i) => {
                const today = i === 1;
                return (
                  <div
                    key={d.id}
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
                    <span className="text-[13px] font-semibold text-foreground tabular">{lane.room}</span>
                    <StatusDot tone={lane.status ? DOT[lane.status] : "warning"} />
                    <span className="truncate text-[11px]">
                      {lane.statusLabel ?? (lane.status ? ROOM_STATUS[lane.status].label : "")}
                    </span>
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
                      style={{ left: `${pct(NOW)}%` }}
                    />
                    {lane.bars.map((b) => renderBar(lane, b))}
                    {lane.conflict && !moved && move ? (
                      <Button
                        isIconOnly
                        size="sm"
                        variant="danger"
                        aria-label={move.conflictLabel}
                        onPress={openMove}
                        className="absolute top-1.5 z-[3] size-[22px] min-w-0 rounded-full p-0 ring-2 ring-surface"
                        style={{ left: `calc(${pct(pos(move.fromDay))}% - 11px)` }}
                      >
                        <TriangleExclamation className="size-3" />
                      </Button>
                    ) : null}
                  </div>
                </Fragment>
              ),
            )}
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          Bars run from arrival afternoon to departure morning. A move never re-prices nights already posted. Rates and
          blocks are managed by your general manager.
        </p>
        {moved && move ? (
          <span className="flex items-center gap-2" role="status">
            <Chip variant="soft" color="success">
              <CircleCheck className="size-3" />
              <Chip.Label>
                Move planned {move.plannedAt} · housekeeping told{notify ? ` · ${move.firstName} messaged` : ""}
              </Chip.Label>
            </Chip>
            <Button size="sm" variant="ghost" onPress={() => setMoveState("open")}>
              Undo
            </Button>
          </span>
        ) : null}
      </div>
    </PageContent>
  );
}
