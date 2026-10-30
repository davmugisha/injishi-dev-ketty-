"use client";

import { Agenda, type AgendaEventType, useAgenda } from "@heroui-pro/react";
import { CalendarDate, CalendarDateTime } from "@internationalized/date";
import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { daysBetween, formatDay } from "./date.tsx";
import { formatRange } from "./date-pickers.tsx";
import { useMediaQuery } from "./hooks.ts";
import type { ScheduleKind } from "./schedule.tsx";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** One room: a row of the timeline. */
export interface RackRoom {
  id: string;
  label: string;
  /** False for a row nothing can be booked into ("No room yet", a room out of service). @default true */
  bookable?: boolean;
}

/** Rooms of one type, under a heading row. */
export interface RackGroup {
  id: string;
  label: string;
  /** A short line beside the heading ("4 rooms"). */
  meta?: string;
  rooms: RackRoom[];
}

/** A stay or a booking in one room, from its first night to its last. */
export interface RoomStay {
  id: string;
  roomId: string;
  kind: string;
  /** Short, it sits in the card: the guest's name. */
  title: string;
  /** The first night, `yyyy-mm-dd`. */
  start: string;
  /** The last night, inclusive. */
  end: string;
  /** It may be dragged to other nights or another room. */
  movable?: boolean;
}

/** Where a range of empty nights or a dragged card lands. */
export interface RackSpan {
  roomId: string;
  /** The first night. */
  start: string;
  /** The last night, inclusive. */
  end: string;
}

const dayOf = (day: string) => {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new CalendarDate(y, m, d);
};
const isoOf = (d: { year: number; month: number; day: number }) =>
  `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
const plus = (day: string, n: number) => isoOf(dayOf(day).add({ days: n }));

/** The night cell under a point: its room and day, read from the cell's data attributes. */
function cellAt(x: number, y: number, skip?: HTMLElement): { roomId: string; day: string } | null {
  if (skip) skip.style.pointerEvents = "none";
  const hit = document.elementFromPoint(x, y);
  if (skip) skip.style.pointerEvents = "";
  const cell = hit?.closest<HTMLElement>("[data-timeline-day]");
  const roomId = cell?.dataset.timelineRoom;
  const day = cell?.dataset.timelineDay;
  return roomId && day ? { roomId, day } : null;
}

/**
 * Rooms down the side, nights across, stays as cards spanning their nights (HeroUI Pro `Agenda`: its week
 * header, one all-day row per room, its event cards and navigation). Agenda has no resource view, so each
 * room is its own all-day row over the same days. Press an empty night, or drag across several, to start
 * a stay there (`onCreate`); press a card for its detail (`onSelect`); a card that may move can be dragged
 * to other nights or another room (`onMove`, which the caller confirms).
 */
export function RoomTimeline({
  groups,
  events,
  kinds,
  today,
  label,
  onSelect,
  onCreate,
  onMove,
  toolbar,
  className,
}: {
  groups: RackGroup[];
  events: RoomStay[];
  kinds: ScheduleKind[];
  /** `yyyy-mm-dd`: the timeline opens on yesterday. Earlier nights can't be booked. */
  today: string;
  /** What the timeline shows, for screen readers ("Rooms and stays"). */
  label: string;
  onSelect?: (event: RoomStay) => void;
  onCreate?: (span: RackSpan) => void;
  onMove?: (event: RoomStay, to: RackSpan) => void;
  toolbar?: ReactNode;
  className?: string;
}) {
  const wide = useMediaQuery("(min-width: 640px)");
  const count = wide ? 14 : 7;
  const [first, setFirst] = useState(() => plus(today, -1));
  const days = useMemo(() => Array.from({ length: count }, (_, i) => dayOf(plus(first, i))), [first, count]);
  const last = isoOf(days[days.length - 1] as CalendarDate);
  const colors = useMemo(() => new Map(kinds.map((k) => [k.id, k])), [kinds]);
  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const agendaEvents = useMemo<AgendaEventType[]>(
    () =>
      events.map((e) => {
        const a = dayOf(e.start);
        const b = dayOf(e.end);
        const k = colors.get(e.kind);
        return {
          id: e.id,
          title: e.title,
          start: new CalendarDateTime(a.year, a.month, a.day, 0, 0),
          end: new CalendarDateTime(b.year, b.month, b.day, 23, 59),
          isAllDay: true,
          isReadOnly: !(onMove && e.movable),
          color: k?.color ?? "var(--muted)",
          status: k?.tentative ? "unconfirmed" : "confirmed",
        };
      }),
    [events, colors, onMove],
  );
  const agenda = useAgenda({ events: agendaEvents, defaultView: "week", defaultDate: dayOf(today) });

  // Each room's cards inside the window: column, span, and a row so two cards never overlap.
  const layout = useMemo(() => {
    const out = new Map<string, { event: AgendaEventType; colStart: number; colSpan: number; row: number }[]>();
    const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start));
    for (const e of sorted) {
      if (e.end < first || e.start > last) continue;
      const from = e.start < first ? first : e.start;
      const to = e.end > last ? last : e.end;
      const colStart = daysBetween(first, from);
      const colSpan = daysBetween(from, to) + 1;
      const items = out.get(e.roomId) ?? [];
      let row = 0;
      while (items.some((i) => i.row === row && i.colStart < colStart + colSpan && colStart < i.colStart + i.colSpan)) {
        row += 1;
      }
      const event = agendaEvents.find((a) => a.id === e.id);
      if (event) items.push({ event, colStart, colSpan, row });
      out.set(e.roomId, items);
    }
    return out;
  }, [events, agendaEvents, first, last]);

  // Choosing empty nights: pressed on one, dragged along the room's row.
  const [picking, setPicking] = useState<RackSpan | null>(null);
  // A card being dragged: where it would land.
  const [landing, setLanding] = useState<RackSpan | null>(null);
  const justDragged = useRef(false);
  const lastPointer = useRef<string>("mouse");

  // A touch scrolls the page, so a tap chooses one night (the click); a mouse or pen can drag a range.
  const pick = (roomId: string, day: string) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "touch" || e.button !== 0 || !onCreate || day < today) return;
    e.preventDefault();
    let span: RackSpan = { roomId, start: day, end: day };
    setPicking(span);
    const onMovePointer = (m: PointerEvent) => {
      const at = cellAt(m.clientX, m.clientY);
      if (!at || at.roomId !== roomId || at.day < today) return;
      span = at.day < day ? { roomId, start: at.day, end: day } : { roomId, start: day, end: at.day };
      setPicking(span);
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMovePointer);
      document.removeEventListener("pointerup", onUp);
      setPicking(null);
      onCreate(span);
    };
    document.addEventListener("pointermove", onMovePointer);
    document.addEventListener("pointerup", onUp);
  };
  const tap = (roomId: string, day: string) => (e: ReactMouseEvent<HTMLButtonElement>) => {
    // A mouse press already chose on pointer up; a tap or a keyboard press (detail 0) chooses here.
    if (lastPointer.current !== "touch" && e.detail !== 0) return;
    if (onCreate && day >= today) onCreate({ roomId, start: day, end: day });
  };

  const drag = (event: RoomStay) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch" || e.button !== 0 || !onMove || !event.movable) return;
    const card = e.currentTarget;
    const from = cellAt(e.clientX, e.clientY, card);
    if (!from) return;
    e.preventDefault();
    const x0 = e.clientX;
    const y0 = e.clientY;
    const nights = daysBetween(event.start, event.end);
    let dragging = false;
    let to: RackSpan | null = null;
    const onMovePointer = (m: PointerEvent) => {
      const dx = m.clientX - x0;
      const dy = m.clientY - y0;
      if (!dragging && Math.abs(dx) + Math.abs(dy) > 4) dragging = true;
      if (!dragging) return;
      card.style.transform = `translate(${dx}px, ${dy}px)`;
      card.style.zIndex = "5";
      const at = cellAt(m.clientX, m.clientY, card);
      if (!at) return;
      const start = plus(event.start, daysBetween(from.day, at.day));
      to = { roomId: at.roomId, start, end: plus(start, nights) };
      setLanding(to);
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMovePointer);
      document.removeEventListener("pointerup", onUp);
      card.style.transform = "";
      card.style.zIndex = "";
      setLanding(null);
      if (!dragging) return;
      justDragged.current = true;
      if (to && (to.roomId !== event.roomId || to.start !== event.start)) onMove(event, to);
    };
    document.addEventListener("pointermove", onMovePointer);
    document.addEventListener("pointerup", onUp);
  };

  const shift = (n: number) => setFirst((f) => plus(f, n));
  const used = kinds.filter((k) => events.some((e) => e.kind === k.id));
  const marked = (span: RackSpan | null, roomId: string, day: string) =>
    span !== null && span.roomId === roomId && day >= span.start && day <= span.end;

  return (
    <section aria-label={label} className={cx("flex min-w-0 flex-col gap-3", className)}>
      <Agenda
        {...agenda}
        visibleDays={days}
        heading={formatRange(first, last)}
        goToNext={() => shift(count)}
        goToPrevious={() => shift(-count)}
        goToToday={() => setFirst(plus(today, -1))}
        isAllDayExpanded
        selectedEventId={null}
        selectEvent={(id) => {
          if (justDragged.current) {
            justDragged.current = false;
            return;
          }
          const event = id ? byId.get(id) : undefined;
          if (event) onSelect?.(event);
        }}
        className="room-timeline overflow-hidden rounded-[var(--surface-radius)] border border-separator"
        style={{ "--agenda-time-column-width": wide ? "7rem" : "4.5rem" } as CSSProperties}
      >
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <h2 className="mr-auto text-base font-semibold whitespace-nowrap">{formatRange(first, last)}</h2>
          <div className="flex items-center gap-2">
            {toolbar}
            <Agenda.Navigation>
              <Agenda.NavButton slot="previous" />
              <Agenda.TodayButton />
              <Agenda.NavButton slot="next" />
            </Agenda.Navigation>
          </div>
        </div>
        <Agenda.Body>
          <Agenda.WeekHeader />
          {groups.map((g) => (
            <div key={g.id}>
              <div className="flex items-baseline gap-2 border-b border-separator bg-default/40 px-3 py-1.5 text-xs">
                <span className="font-semibold">{g.label}</span>
                {g.meta ? <span className="text-muted">{g.meta}</span> : null}
              </div>
              {g.rooms.map((r) => (
                <Agenda.AllDaySection key={r.id} className="min-h-10" aria-label={`Room ${r.label}`}>
                  <Agenda.AllDayLabel className="truncate text-start text-xs font-medium text-foreground">
                    <span className="ps-3">{r.label}</span>
                  </Agenda.AllDayLabel>
                  <div
                    className="absolute inset-y-0 end-0 flex"
                    style={{ insetInlineStart: "var(--agenda-time-column-width)" }}
                  >
                    {days.map((d) => {
                      const day = isoOf(d);
                      const past = day < today || r.bookable === false;
                      const chosen = marked(picking, r.id, day) || marked(landing, r.id, day);
                      return (
                        <button
                          key={day}
                          type="button"
                          tabIndex={past || !onCreate ? -1 : 0}
                          disabled={past || !onCreate}
                          data-timeline-room={r.id}
                          data-timeline-day={day}
                          aria-label={`${r.label}, ${formatDay(day, "long")}`}
                          onPointerDown={(e) => {
                            lastPointer.current = e.pointerType;
                            pick(r.id, day)(e);
                          }}
                          onClick={tap(r.id, day)}
                          className={cx(
                            "h-full min-w-0 flex-1 outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset",
                            !past && onCreate && "cursor-pointer hover:bg-accent-soft/60",
                            chosen && "bg-accent-soft",
                          )}
                        />
                      );
                    })}
                  </div>
                  {(layout.get(r.id) ?? []).map((item) => {
                    const source = byId.get(item.event.id);
                    return (
                      <Agenda.AllDayEvent
                        key={item.event.id}
                        event={item.event}
                        colStart={item.colStart}
                        colSpan={item.colSpan}
                        row={item.row}
                        data-event-id={item.event.id}
                        data-movable={source?.movable && onMove ? true : undefined}
                        className={cx("relative", source?.movable && onMove && "cursor-grab")}
                        onPointerDown={source ? drag(source) : undefined}
                      />
                    );
                  })}
                </Agenda.AllDaySection>
              ))}
            </div>
          ))}
        </Agenda.Body>
      </Agenda>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted">
        <span>{onCreate ? "Choose empty nights to add a stay" : null}</span>
        <span className="flex flex-wrap items-center gap-3">
          {used.map((k) => (
            <span key={k.id} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cx("size-2.5 rounded-sm", k.tentative && "border border-dashed bg-transparent")}
                style={k.tentative ? { borderColor: k.color } : { background: k.color }}
              />
              {k.label}
            </span>
          ))}
        </span>
      </div>
    </section>
  );
}
