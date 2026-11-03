"use client";

import { Popover, toast } from "@heroui/react";
import { Agenda, type AgendaEventType, type AgendaView, useAgenda } from "@heroui-pro/react";
import { CalendarDate, CalendarDateTime } from "@internationalized/date";
import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { formatDay } from "./date.tsx";
import { useMediaQuery } from "./hooks.ts";
import { KeyValueList } from "./layout.tsx";
import { FilterMenu } from "./table.tsx";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** One kind of entry on a calendar: its name in the legend and the filter, and its colour (a CSS colour). */
export interface ScheduleKind {
  id: string;
  label: string;
  /** A theme colour: `var(--success)`, `var(--danger)`, `var(--accent)`, `var(--chart-cat-3)`. */
  color: string;
  /** Drawn as unconfirmed (dashed): something expected, not yet done (rent still due, a request). */
  tentative?: boolean;
}

/**
 * One entry. Without `time` it is a whole day or a span of days (a stay's nights, rent due, a lease's
 * notice) and sits in the all-day row and the month's bars. With `time` it is a moment on the clock (a
 * guest's arrival at 14:00, a fault visit, a shift) and sits in the hours of the day and week views.
 */
export interface ScheduleEvent {
  id: string;
  kind: string;
  /** Short, it sits in a cell: "101 · Grace Otieno", "A-02 · RWF 300K". */
  title: string;
  /** `YYYY-MM-DD`, a Kigali day. */
  start: string;
  /** The last day, inclusive. @default start */
  end?: string;
  /** `HH:mm`: a timed entry on `start`. */
  time?: string;
  /** `HH:mm` on `end ?? start`. @default time + 1 hour */
  endTime?: string;
  /** The popover's heading. @default title */
  heading?: string;
  /** The popover's lines. */
  details?: { label: string; value: ReactNode }[];
  /** Links or buttons at the foot of the popover ("Open the lease"). */
  actions?: ReactNode;
  /** It may be dragged to another day or time (the API allows the change). */
  movable?: boolean;
  /** Its end may be dragged (a timed entry only: a departure, a shift). */
  resizable?: boolean;
}

/** A move or resize, as days and times. Resolve with null when it saved, or the words of why not. */
export type ScheduleChange = (
  event: ScheduleEvent,
  next: { start: string; end: string; time: string | null; endTime: string | null },
) => Promise<string | null>;

const dayOf = (day: string) => {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new CalendarDate(y, m, d);
};
const isoOf = (d: { year: number; month: number; day: number }) =>
  `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
const hhmm = (d: { hour: number; minute: number }) =>
  `${String(d.hour).padStart(2, "0")}:${String(d.minute).padStart(2, "0")}`;
const clockOf = (time: string) => time.split(":").map(Number) as [number, number];

function toAgenda(e: ScheduleEvent, kind: ScheduleKind | undefined, editable: boolean): AgendaEventType {
  const a = dayOf(e.start);
  const b = dayOf(e.end ?? e.start);
  const base = {
    id: e.id,
    title: e.title,
    color: kind?.color ?? "var(--muted)",
    status: kind?.tentative ? ("unconfirmed" as const) : ("confirmed" as const),
    isReadOnly: !(editable && (e.movable || e.resizable)),
  };
  if (!e.time) {
    return {
      ...base,
      start: new CalendarDateTime(a.year, a.month, a.day, 0, 0),
      end: new CalendarDateTime(b.year, b.month, b.day, 23, 59),
      isAllDay: true,
    };
  }
  const [h, m] = clockOf(e.time);
  const start = new CalendarDateTime(a.year, a.month, a.day, h, m);
  let end = start.add({ hours: 1 });
  if (e.endTime) {
    const [eh, em] = clockOf(e.endTime);
    end = new CalendarDateTime(b.year, b.month, b.day, eh, em);
  }
  return { ...base, start, end, isAllDay: false };
}

/**
 * Every calendar in the product: the HeroUI Pro `Agenda`, used as it is meant to be. Its own day, week
 * and month views, its navigation and Today, entries that open when chosen, a slot chosen in the hours
 * of a day or week that creates (`onCreate`), and entries dragged or stretched (`onMove`, `onResize`).
 * Agenda has no rows per room or per unit: a caller narrows by those with filters in `toolbar`.
 *
 * Choosing an entry calls `onSelect` when given (a booking opens its panel), otherwise opens a popover
 * with the entry's details and actions. Drag is off on a phone, as Agenda intends: a phone changes an
 * entry from its panel. The legend names only the kinds on screen; a filter shows one kind at a time.
 */
export function AgendaCalendar({
  events,
  kinds,
  today,
  label,
  defaultView = "month",
  views,
  startHour = 6,
  endHour = 23,
  onCreate,
  onSelect,
  onMove,
  onResize,
  toolbar,
  hint,
  className,
}: {
  events: ScheduleEvent[];
  kinds: ScheduleKind[];
  /** `YYYY-MM-DD`: where the calendar opens. */
  today: string;
  /** What the calendar shows, for screen readers ("Rent calendar"). */
  label: string;
  defaultView?: AgendaView;
  /** The views offered. @default day, week and month */
  views?: AgendaView[];
  startHour?: number;
  endHour?: number;
  /** A slot chosen in a day or week: its day and time (`HH:mm`). */
  onCreate?: (day: string, time: string) => void;
  /** An entry chosen. Without it, the entry's popover opens. */
  onSelect?: (event: ScheduleEvent) => void;
  onMove?: ScheduleChange;
  onResize?: ScheduleChange;
  /** Filters and actions beside the kind filter (room type, room, search). */
  toolbar?: ReactNode;
  /** One short line under the calendar ("Choose a time to add a booking"). */
  hint?: ReactNode;
  className?: string;
}) {
  const wide = useMediaQuery("(min-width: 768px)");
  const [kind, setKind] = useState("all");
  // Changes waiting for the API, shown at their new place until it answers.
  const [pending, setPending] = useState<Record<string, Partial<ScheduleEvent>>>({});
  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const colors = useMemo(() => new Map(kinds.map((k) => [k.id, k])), [kinds]);
  const editable = wide && !!(onMove || onResize);

  const agendaEvents = useMemo<AgendaEventType[]>(
    () =>
      events
        .filter((e) => kind === "all" || e.kind === kind)
        .map((e) => toAgenda(pending[e.id] ? { ...e, ...pending[e.id] } : e, colors.get(e.kind), editable)),
    [events, kind, pending, colors, editable],
  );

  const change = (run: ScheduleChange | undefined, allowed: (e: ScheduleEvent) => boolean | undefined) =>
    run && wide
      ? (id: string, start: CalendarDateTime, end: CalendarDateTime) => {
          const event = byId.get(id);
          if (!event || !allowed(event)) return;
          const timed = !!event.time;
          const next = {
            start: isoOf(start),
            end: isoOf(end),
            time: timed ? hhmm(start) : null,
            endTime: timed ? hhmm(end) : null,
          };
          if (
            next.start === event.start &&
            next.end === (event.end ?? event.start) &&
            next.time === (event.time ?? null)
          ) {
            if (!timed || next.endTime === (event.endTime ?? next.endTime)) return;
          }
          setPending((p) => ({
            ...p,
            [id]: {
              start: next.start,
              end: next.end,
              time: next.time ?? undefined,
              endTime: next.endTime ?? undefined,
            },
          }));
          void run(event, next).then((problem) => {
            setPending((p) => {
              const { [id]: _, ...rest } = p;
              return rest;
            });
            if (problem) toast.danger(problem);
          });
        }
      : undefined;

  const agenda = useAgenda({
    events: agendaEvents,
    defaultView,
    defaultDate: dayOf(today),
    startHour,
    endHour,
    onEventCreate: onCreate && wide ? ({ start }) => onCreate(isoOf(start), hhmm(start)) : undefined,
    onEventMove: change(onMove, (e) => e.movable),
    onEventResize: change(onResize, (e) => e.resizable),
  });

  const rootRef = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState<ScheduleEvent | null>(null);

  // The chosen entry: the caller's panel, or its popover anchored to the entry itself.
  useEffect(() => {
    const id = agenda.selectedEventId;
    if (!id) {
      setOpen(null);
      return;
    }
    const event = byId.get(id) ?? null;
    if (event && onSelect) {
      onSelect(event);
      agenda.selectEvent(null);
      return;
    }
    const el = rootRef.current?.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(id)}"]`) ?? null;
    anchor.current = el;
    setOpen(event);
  }, [agenda.selectedEventId, agenda.selectEvent, byId, onSelect]);

  const used = kinds.filter((k) => events.some((e) => e.kind === k.id));
  const offered = views ?? ["day", "week", "month"];

  return (
    <section aria-label={label} className={cx("flex min-w-0 flex-col gap-3", className)}>
      <div ref={rootRef} className="min-w-0">
        <Agenda {...agenda} className="overflow-hidden rounded-[var(--surface-radius)] border border-separator">
          <Agenda.Header className="flex flex-wrap items-center gap-2 px-3 py-2">
            <Agenda.Heading className="mr-auto text-base font-semibold whitespace-nowrap" />
            <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end">
              {used.length > 1 ? (
                <FilterMenu
                  label="Show"
                  name="Show"
                  compact
                  options={[{ id: "all", label: "Everything" }, ...used.map((k) => ({ id: k.id, label: k.label }))]}
                  value={kind}
                  onChange={setKind}
                />
              ) : null}
              {toolbar}
              {offered.length > 1 ? <Agenda.ViewSelector size="sm" /> : null}
              <Agenda.Navigation>
                <Agenda.NavButton slot="previous" />
                <Agenda.TodayButton />
                <Agenda.NavButton slot="next" />
              </Agenda.Navigation>
            </div>
          </Agenda.Header>
          <Agenda.Body>
            {agenda.view === "month" ? (
              <Agenda.MonthGrid>
                {agenda.visibleWeeks.map((week) => {
                  const layout = agenda.getMonthRowLayout(week);
                  return (
                    <Agenda.MonthRow key={week[0]?.toString()} spanningRowCount={layout.rowCount}>
                      {layout.items.map((item) => (
                        <Agenda.MonthSpanningEvent
                          key={item.event.id}
                          event={item.event}
                          colStart={item.colStart}
                          colSpan={item.colSpan}
                          row={item.row}
                          data-event-id={item.event.id}
                        />
                      ))}
                      {week.map((day, col) => (
                        <Agenda.MonthCell
                          key={day.toString()}
                          date={day}
                          maxEvents={3}
                          moreLabel={(n) => `${n} more`}
                          spanningRowCount={layout.rowCountPerCol[col] ?? 0}
                        >
                          {agenda.getPerCellEvents(day, week).map((event) => (
                            <Agenda.MonthEvent key={event.id} event={event}>
                              <span data-event-id={event.id} className="block truncate">
                                {event.title}
                              </span>
                            </Agenda.MonthEvent>
                          ))}
                        </Agenda.MonthCell>
                      ))}
                    </Agenda.MonthRow>
                  );
                })}
              </Agenda.MonthGrid>
            ) : (
              <>
                <Agenda.WeekHeader />
                <Agenda.AllDaySection>
                  <Agenda.AllDayLabel>All day</Agenda.AllDayLabel>
                  {agenda.allDayLayout.map((item) => (
                    <Agenda.AllDayEvent
                      key={item.event.id}
                      event={item.event}
                      colStart={item.colStart}
                      colSpan={item.colSpan}
                      row={item.row}
                      data-event-id={item.event.id}
                    />
                  ))}
                </Agenda.AllDaySection>
                <Agenda.TimeGrid>
                  <Agenda.CurrentTimeIndicator />
                  {agenda.visibleDays.map((day) => (
                    <Agenda.DayColumn key={day.toString()} date={day}>
                      {agenda.getEventsForDay(day).map((event) => (
                        <Agenda.Event key={event.id} event={event}>
                          <span data-event-id={event.id} className="contents">
                            <Agenda.EventTitle>{event.title}</Agenda.EventTitle>
                            <Agenda.EventTime event={event} />
                          </span>
                        </Agenda.Event>
                      ))}
                    </Agenda.DayColumn>
                  ))}
                </Agenda.TimeGrid>
              </>
            )}
          </Agenda.Body>
        </Agenda>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted">
        <span>{hint ?? null}</span>
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

      <EventPopover event={open} anchor={anchor} onClose={() => agenda.selectEvent(null)} kinds={colors} />
    </section>
  );
}

function EventPopover({
  event,
  anchor,
  onClose,
  kinds,
}: {
  event: ScheduleEvent | null;
  anchor: RefObject<HTMLElement | null>;
  onClose: () => void;
  kinds: Map<string, ScheduleKind>;
}) {
  if (!event || !anchor.current) return null;
  const kind = kinds.get(event.kind);
  const days =
    event.end && event.end !== event.start
      ? `${formatDay(event.start, "long")} to ${formatDay(event.end, "long")}`
      : formatDay(event.start, "long");
  const when = event.time ? `${days}, ${event.time}${event.endTime ? ` to ${event.endTime}` : ""}` : days;
  return (
    <Popover isOpen onOpenChange={(o) => (o ? undefined : onClose())}>
      <Popover.Content triggerRef={anchor} placement="bottom" className="w-72 max-w-[calc(100vw-2rem)]">
        <Popover.Dialog aria-label={event.heading ?? event.title} className="flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <span aria-hidden="true" className="size-2 rounded-sm" style={{ background: kind?.color }} />
              {kind?.label}
            </span>
            <Popover.Heading className="text-sm font-semibold">{event.heading ?? event.title}</Popover.Heading>
            <span className="text-xs text-muted">{when}</span>
          </div>
          {event.details && event.details.length > 0 ? <KeyValueList items={event.details} /> : null}
          {event.actions ? <div className="flex flex-wrap gap-2">{event.actions}</div> : null}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
