"use client";

import { Popover, toast } from "@heroui/react";
import { Agenda, type AgendaEventType, useAgenda } from "@heroui-pro/react";
import { CalendarDate, CalendarDateTime } from "@internationalized/date";
import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { formatDay } from "./date.tsx";
import { KeyValueList } from "./layout.tsx";
import { FilterMenu } from "./table.tsx";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** One kind of entry on a schedule: its name in the legend and the filter, and its colour (a CSS colour). */
export interface ScheduleKind {
  id: string;
  label: string;
  /** A theme colour: `var(--success)`, `var(--danger)`, `var(--accent)`, `var(--chart-cat-3)`. */
  color: string;
  /** Drawn dashed: something expected, not yet done (rent still due, a booking not confirmed). */
  tentative?: boolean;
}

/** One entry: a day (rent due, a payment) or a span of days (a stay, a lease's notice). */
export interface ScheduleEvent {
  id: string;
  kind: string;
  /** Short, it sits in a cell: "A-02 · RWF 300K". */
  title: string;
  /** `YYYY-MM-DD`, a Kigali day. */
  start: string;
  /** The last day, inclusive. @default start */
  end?: string;
  /** The popover's heading. @default title */
  heading?: string;
  /** The popover's lines. */
  details?: { label: string; value: ReactNode }[];
  /** Links or buttons at the foot of the popover ("Open the lease"). */
  actions?: ReactNode;
  /** It may be dragged to another day (the API allows a date change). */
  movable?: boolean;
}

const dayOf = (day: string) => {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new CalendarDate(y, m, d);
};
const isoOf = (d: { year: number; month: number; day: number }) =>
  `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;

/**
 * Everything with a date, on one calendar (HeroUI Pro `Agenda`, month view): rent due days and payments,
 * stays from arrival to departure, fault visits, move-outs. Choosing an entry opens its detail in a
 * popover; an entry the API lets move can be dragged to another day (`onMove`), the rest are read only.
 * A filter shows one kind at a time; the legend names the colours.
 */
export function Schedule({
  events,
  kinds,
  today,
  label,
  onMove,
  toolbar,
  className,
}: {
  events: ScheduleEvent[];
  kinds: ScheduleKind[];
  /** `YYYY-MM-DD`: where the calendar opens. */
  today: string;
  /** What the calendar shows, for screen readers ("Rent calendar"). */
  label: string;
  /**
   * Move an entry to new days. Resolve with null when it moved, or the words of why not (shown in a
   * toast; the entry goes back). Without it nothing can be dragged.
   */
  onMove?: (event: ScheduleEvent, start: string, end: string) => Promise<string | null>;
  /** More controls beside the filter (a "Today" link to a list). */
  toolbar?: ReactNode;
  className?: string;
}) {
  const [kind, setKind] = useState("all");
  // Moves waiting for the API, shown at their new place until it answers.
  const [moved, setMoved] = useState<Record<string, { start: string; end: string }>>({});
  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const colors = useMemo(() => new Map(kinds.map((k) => [k.id, k])), [kinds]);
  const shown = useMemo(
    () =>
      events.filter((e) => kind === "all" || e.kind === kind).map((e) => (moved[e.id] ? { ...e, ...moved[e.id] } : e)),
    [events, kind, moved],
  );
  const agendaEvents = useMemo<AgendaEventType[]>(
    () =>
      shown.map((e) => {
        const a = dayOf(e.start);
        const b = dayOf(e.end ?? e.start);
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
    [shown, colors, onMove],
  );

  const move = onMove
    ? (id: string, start: CalendarDateTime, end: CalendarDateTime) => {
        const event = byId.get(id);
        if (!event?.movable) return;
        const next = { start: isoOf(start), end: isoOf(end) };
        if (next.start === event.start && next.end === (event.end ?? event.start)) return;
        setMoved((m) => ({ ...m, [id]: next }));
        void onMove(event, next.start, next.end).then((problem) => {
          setMoved((m) => {
            const { [id]: _, ...rest } = m;
            return rest;
          });
          if (problem) toast.danger(problem);
          else toast.success(`Moved to ${formatDay(next.start, "long")}`);
        });
      }
    : undefined;

  const agenda = useAgenda({
    events: agendaEvents,
    defaultView: "month",
    defaultDate: dayOf(today),
    onEventMove: move,
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState<ScheduleEvent | null>(null);

  // The chosen entry opens its popover, anchored to the entry itself.
  useEffect(() => {
    const id = agenda.selectedEventId;
    if (!id) {
      setOpen(null);
      return;
    }
    const el = rootRef.current?.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(id)}"]`) ?? null;
    anchor.current = el;
    setOpen(byId.get(id) ?? null);
  }, [agenda.selectedEventId, byId]);

  const used = kinds.filter((k) => events.some((e) => e.kind === k.id));

  return (
    <section aria-label={label} className={cx("flex min-w-0 flex-col gap-3", className)}>
      <div ref={rootRef} className="min-w-0">
        <Agenda {...agenda} className="overflow-hidden rounded-2xl border border-separator">
          <Agenda.Header className="flex-wrap gap-2 px-3 py-2">
            <Agenda.Heading className="text-base" />
            <div className="ml-auto flex flex-wrap items-center gap-2">
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
                            <Agenda.MonthEvent key={event.id} event={event} />
                          ))}
                        </Agenda.MonthCell>
                      ))}
                    </Agenda.MonthRow>
                  );
                })}
              </Agenda.MonthGrid>
            ) : (
              // A day or week of all-day entries: their bars, without an empty grid of hours.
              <>
                <Agenda.WeekHeader />
                <Agenda.AllDaySection>
                  <Agenda.AllDayLabel>Day</Agenda.AllDayLabel>
                  {agenda.allDayLayout.map((item) => (
                    <Agenda.AllDayEvent
                      key={item.event.id}
                      event={item.event}
                      colStart={item.colStart}
                      colSpan={item.colSpan}
                      row={item.row}
                    />
                  ))}
                </Agenda.AllDaySection>
              </>
            )}
          </Agenda.Body>
        </Agenda>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted">
        {agenda.view !== "month" ? (
          <button
            type="button"
            className="text-accent underline-offset-2 hover:underline"
            onClick={() => agenda.setView("month")}
          >
            Back to the month
          </button>
        ) : (
          <span>{onMove && events.some((e) => e.movable) ? "Drag an entry to move it" : null}</span>
        )}
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
            <span className="text-xs text-muted">{days}</span>
          </div>
          {event.details && event.details.length > 0 ? <KeyValueList items={event.details} /> : null}
          {event.actions ? <div className="flex flex-wrap gap-2">{event.actions}</div> : null}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
