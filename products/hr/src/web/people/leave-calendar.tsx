"use client";

import { CalendarXmark } from "@gravity-ui/icons";
import { Avatar, Button, Calendar, Chip } from "@heroui/react";
import { EmptyState } from "@heroui-pro/react";
import { type CalendarDate, parseDate } from "@internationalized/date";
import { type ReactNode, useMemo, useState } from "react";
import { ButtonContext } from "react-aria-components";
import type { LeaveStretch } from "../../model/people.ts";
import { addDays, dayOfMonth, longDay, rangeShort, weekdayIndex } from "./days";
import { avatarColor, firstName, initials } from "./parts";

/** One stretch of leave: `cal` is [first day counted from today, number of days]. */
export interface CalendarBar {
  id: string;
  name: string;
  type: string;
  approved: boolean;
  cal: [number, number];
  /** A request on this screen: pressing it opens the request. */
  isRequest: boolean;
}

/** Leave further out than the calendar's data reaches: listed under "Coming up" with its own dates. */
export interface LaterLeave {
  id: string;
  name: string;
  type: string;
  dates: string;
  days: number;
}

/** The theme colour of a kind of leave, the same in the list, the calendar and the legend. */
export function leaveColor(type: string): string {
  if (/sick/i.test(type)) return "var(--chart-4)";
  if (/annual/i.test(type)) return "var(--accent)";
  if (/unpaid/i.test(type)) return "var(--muted)";
  return "var(--chart-5)";
}

/** What reads on that colour: the chart tints stay light in both themes, so they take the dark ink. */
function leaveInk(type: string): string {
  if (/annual/i.test(type)) return "var(--accent-foreground)";
  if (/unpaid/i.test(type)) return "var(--background)";
  return "var(--eclipse)";
}

export const LEAVE_KINDS = [
  { label: "Annual", color: "var(--accent)" },
  { label: "Sick", color: "var(--chart-4)" },
  { label: "Other", color: "var(--chart-5)" },
];

const kindOf = (type: string) => type.split(" ·")[0].replace(/ leave$/i, "");

/** A person's stretch of leave, as a row the side lists show. */
interface Away {
  id: string;
  name: string;
  type: string;
  approved: boolean;
  dates: string;
  days: number;
  isRequest: boolean;
}

/** The dates of a stretch, "26 Oct" for one day, "30 Oct – 1 Nov" for several. */
function datesOf(from: string, to: string): string {
  return from === to ? `${dayOfMonth(from)} ${rangeShort(from, from).split(" ").pop()}` : rangeShort(from, to);
}

/** A person's leave on one day square: a solid chip in the kind's colour, dashed while pending. */
function DayChip({ a }: { a: Away }) {
  const color = leaveColor(a.type);
  return (
    <span
      className={`block truncate rounded-md px-1.5 py-px text-xs leading-4 font-semibold ${
        a.approved ? "" : "border-[1.5px] border-dashed bg-surface text-foreground"
      }`}
      style={a.approved ? { background: color, color: leaveInk(a.type) } : { borderColor: color }}
    >
      {firstName(a.name)}
    </span>
  );
}

/** One person in a side list: who, what kind, when, for how long; a request opens on press. */
function AwayRow({ a, isActive, onPick }: { a: Away; isActive: boolean; onPick: (id: string) => void }) {
  const body: ReactNode = (
    <>
      <Avatar size="sm" variant="soft" color={avatarColor(a.name)} className="shrink-0">
        <Avatar.Fallback>{initials(a.name)}</Avatar.Fallback>
      </Avatar>
      <span className="flex min-w-0 flex-1 flex-col items-start text-left">
        <span className="w-full truncate text-[13px] font-semibold">{a.name}</span>
        <span className="flex w-full min-w-0 items-center gap-1.5 text-xs font-normal text-muted">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={{ background: leaveColor(a.type) }}
          />
          <span className="truncate">
            {kindOf(a.type)} · {a.dates}
          </span>
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-xs font-semibold tabular">{a.days} d</span>
        {a.approved ? null : (
          <Chip size="sm" variant="soft" color="warning">
            Pending
          </Chip>
        )}
      </span>
    </>
  );
  const look = `flex h-auto w-full items-center gap-2.5 rounded-xl bg-surface px-2.5 py-2 text-foreground ${
    isActive ? "ring-2 ring-[var(--focus)]" : ""
  }`;
  return a.isRequest ? (
    <Button variant="ghost" className={`${look} justify-start hover:bg-surface!`} onPress={() => onPick(a.id)}>
      {body}
    </Button>
  ) : (
    <div className={look}>{body}</div>
  );
}

/**
 * Who is away, on HeroUI's Calendar opened out to a full month: each day a square with the first
 * names of the people off that day in their kind's colour (dashed while pending), today ringed,
 * weekends shaded. Every month of the year shows its leave. Pressing a day lists who is away on it;
 * beside that, the leave coming up.
 */
export function LeaveCalendar({
  today,
  bars,
  later,
  leave,
  selected,
  onPick,
}: {
  today: string;
  bars: CalendarBar[];
  later: LaterLeave[];
  /** The year's approved and pending leave, so any month can be paged to. */
  leave: LeaveStretch[];
  selected: string;
  onPick: (id: string) => void;
}) {
  const [day, setDay] = useState(today);
  const [focused, setFocused] = useState<CalendarDate>(() => parseDate(today));

  // Every stretch as a row, and the people away on each day.
  const { stretches, byDay } = useMemo(() => {
    // A bar is cut to the days from today; the leave itself may have begun earlier or end later.
    const real = new Map(leave.map((l) => [l.id, l]));
    const stretches: (Away & { from: string; to: string })[] = bars.map((b) => {
      const whole = real.get(b.id);
      const from = whole?.from ?? addDays(today, b.cal[0]);
      const to = whole?.to ?? addDays(today, b.cal[0] + b.cal[1] - 1);
      return {
        id: b.id,
        name: b.name,
        type: b.type,
        approved: b.approved,
        dates: datesOf(from, to),
        days: whole?.days ?? b.cal[1],
        isRequest: b.isRequest,
        from,
        to,
      };
    });
    const byDay = new Map<string, Away[]>();
    for (const s of stretches) {
      for (let iso = s.from; iso <= s.to; iso = addDays(iso, 1)) {
        byDay.set(iso, [...(byDay.get(iso) ?? []), s]);
      }
    }
    // Leave the bars do not reach, past or far off: on the grid only, the side lists stay on what is current.
    const inBars = new Set(bars.map((b) => b.id));
    const asks = new Set(later.map((l) => l.id));
    for (const l of leave) {
      if (inBars.has(l.id)) continue;
      const row: Away = {
        id: l.id,
        name: l.name,
        type: l.type,
        approved: l.approved,
        dates: datesOf(l.from, l.to),
        days: l.days,
        isRequest: asks.has(l.id) || Boolean(l.request),
      };
      for (let iso = l.from; iso <= l.to; iso = addDays(iso, 1)) {
        byDay.set(iso, [...(byDay.get(iso) ?? []), row]);
      }
    }
    // Approved first, then by name: the pending ones read as the open questions they are.
    for (const list of byDay.values()) {
      list.sort((a, b) => Number(b.approved) - Number(a.approved) || a.name.localeCompare(b.name));
    }
    return { stretches, byDay };
  }, [bars, later, leave, today]);

  const onDay = byDay.get(day) ?? [];
  const upcoming: Away[] = [
    ...stretches
      .filter((s) => s.from >= today || (byDay.get(today) ?? []).includes(s))
      .sort((a, b) => a.from.localeCompare(b.from)),
    ...later.map((l) => ({ ...l, approved: false, isRequest: true })),
  ];

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <Calendar
        aria-label="Who is away"
        value={parseDate(day)}
        onChange={(d) => setDay(d.toString())}
        focusedValue={focused}
        onFocusChange={setFocused}
        firstDayOfWeek="mon"
        className="w-full max-w-none min-w-0"
      >
        <Calendar.Header className="mb-3 flex items-center gap-1.5">
          <Calendar.Heading className="me-auto text-[17px] font-semibold" />
          {/* The calendar asks every button inside it for a previous or next slot; Today is neither. */}
          <ButtonContext.Provider value={null}>
            <Button
              size="sm"
              variant="secondary"
              onPress={() => {
                setFocused(parseDate(today));
                setDay(today);
              }}
            >
              Today
            </Button>
          </ButtonContext.Provider>
          <Calendar.NavButton slot="previous" />
          <Calendar.NavButton slot="next" />
        </Calendar.Header>
        <Calendar.Grid weekdayStyle="short" className="gap-1">
          <Calendar.GridHeader>
            {(d) => (
              <Calendar.HeaderCell className="pb-1 text-center text-xs font-semibold text-muted">
                {d}
              </Calendar.HeaderCell>
            )}
          </Calendar.GridHeader>
          <Calendar.GridBody>
            {(date) => {
              const iso = date.toString();
              const list = byDay.get(iso) ?? [];
              const isToday = iso === today;
              const weekend = weekdayIndex(iso) >= 5;
              return (
                <Calendar.Cell
                  date={date}
                  aria-label={`${longDay(iso)}${list.length ? `, ${list.length} away` : ""}`}
                  className={`flex aspect-auto h-[86px] w-full min-w-0 flex-col items-stretch justify-start gap-1 rounded-xl border p-1.5 text-left text-[13px] font-normal transition-colors data-[outside-month=true]:opacity-40 data-[selected=true]:bg-surface data-[selected=true]:text-foreground data-[selected=true]:ring-2 data-[selected=true]:ring-accent data-[today=true]:text-foreground ${
                    weekend ? "border-transparent bg-surface-secondary" : "border-separator bg-surface"
                  } data-[today=true]:bg-surface hover:bg-default!`}
                >
                  {({ formattedDate }) => (
                    <>
                      <span className="flex items-center justify-between gap-1">
                        <span
                          className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[13px] tabular ${
                            isToday
                              ? "bg-accent font-bold text-accent-foreground"
                              : iso < today
                                ? "font-semibold text-muted"
                                : "font-semibold"
                          }`}
                        >
                          {formattedDate}
                        </span>
                        {list.length > 2 ? (
                          <span className="text-xs font-semibold text-muted tabular">{list.length} off</span>
                        ) : null}
                      </span>
                      {list.slice(0, 2).map((a) => (
                        <DayChip key={a.id} a={a} />
                      ))}
                      {list.length > 2 ? (
                        <span className="text-xs leading-3 font-medium text-muted">+{list.length - 2} more</span>
                      ) : null}
                    </>
                  )}
                </Calendar.Cell>
              );
            }}
          </Calendar.GridBody>
        </Calendar.Grid>
      </Calendar>

      <div className="flex min-w-0 flex-col gap-3">
        <section aria-labelledby="on-h" className="flex flex-col gap-2 rounded-2xl bg-surface-secondary p-3">
          <h3 id="on-h" className="flex items-center justify-between px-1 text-sm font-semibold">
            {day === today ? "Away today" : longDay(day)}
            <Chip size="sm" variant="soft" color={onDay.length ? "accent" : "default"}>
              {onDay.length}
            </Chip>
          </h3>
          {onDay.length === 0 ? (
            <p className="px-1 pb-1 text-xs text-muted">Everyone is in.</p>
          ) : (
            onDay.map((a) => <AwayRow key={a.id} a={a} isActive={selected === a.id} onPick={onPick} />)
          )}
        </section>

        <section aria-labelledby="up-h" className="flex flex-col gap-2 rounded-2xl bg-surface-secondary p-3">
          <h3 id="up-h" className="flex items-center justify-between px-1 text-sm font-semibold">
            Coming up
            <Chip size="sm" variant="soft">
              {upcoming.length}
            </Chip>
          </h3>
          {upcoming.length === 0 ? (
            <EmptyState size="sm" className="py-6">
              <EmptyState.Header>
                <EmptyState.Media variant="icon">
                  <CalendarXmark />
                </EmptyState.Media>
                <EmptyState.Title>Nobody away</EmptyState.Title>
              </EmptyState.Header>
            </EmptyState>
          ) : null}
          {upcoming.map((a) => (
            <AwayRow key={a.id} a={a} isActive={selected === a.id} onPick={onPick} />
          ))}
        </section>
      </div>
    </div>
  );
}
