"use client";

import { Agenda, type AgendaEventType, useAgenda } from "@heroui-pro/react";
import { CalendarDate, CalendarDateTime } from "@internationalized/date";
import { useMemo } from "react";
import { formatDay } from "./date.tsx";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export interface MoneyDay {
  id: string;
  /** `YYYY-MM-DD`, a Kigali day. */
  day: string;
  /** Short, it sits in a calendar cell: "RWF 300K due · A-02". */
  title: string;
  /** In the line under the calendar when it is chosen. */
  detail?: string;
  /** paid: money arrived; due: still to pay; overdue: past its day; info: anything else. */
  tone: "paid" | "due" | "overdue" | "info";
}

const TONE_COLOR: Record<MoneyDay["tone"], string> = {
  paid: "var(--success)",
  due: "var(--accent)",
  overdue: "var(--danger)",
  info: "var(--muted)",
};

const TONE_WORDS: { tone: MoneyDay["tone"]; label: string; dot: string }[] = [
  { tone: "due", label: "Due", dot: "bg-accent" },
  { tone: "overdue", label: "Overdue", dot: "bg-danger" },
  { tone: "paid", label: "Paid", dot: "bg-success" },
];

const dayOf = (day: string) => {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new CalendarDate(y, m, d);
};

/**
 * A month of money as a calendar (2026-10-28): what falls due on which day and what was paid, on
 * HeroUI Pro's Agenda in its month view. Read only: choosing an entry shows its detail under the grid;
 * the arrows and Today move through the months.
 */
export function MoneyCalendar({
  days,
  today,
  label = "Payments calendar",
  className,
}: {
  days: MoneyDay[];
  today: string;
  label?: string;
  className?: string;
}) {
  const events = useMemo<AgendaEventType[]>(
    () =>
      days.map((d) => {
        const date = dayOf(d.day);
        return {
          id: d.id,
          title: d.title,
          // A timed entry, so the month view lists it in its day's cell rather than as a spanning bar.
          start: new CalendarDateTime(date.year, date.month, date.day, 9, 0),
          end: new CalendarDateTime(date.year, date.month, date.day, 10, 0),
          isReadOnly: true,
          color: TONE_COLOR[d.tone],
          status: d.tone === "due" ? "unconfirmed" : "confirmed",
        };
      }),
    [days],
  );
  // Month only: a day's date opens no day view here, the entries say everything that day holds.
  const agenda = useAgenda({ events, view: "month", onViewChange: () => {}, defaultDate: dayOf(today) });
  const chosen = days.find((d) => d.id === agenda.selectedEventId) ?? null;
  return (
    <section aria-label={label} className={cx("flex min-w-0 flex-col gap-2", className)}>
      <Agenda {...agenda} className="min-h-0 flex-1">
        <Agenda.Header>
          <Agenda.Heading className="text-sm" />
          <Agenda.Navigation>
            <Agenda.NavButton slot="previous" />
            <Agenda.TodayButton />
            <Agenda.NavButton slot="next" />
          </Agenda.Navigation>
        </Agenda.Header>
        <Agenda.Body>
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
                      maxEvents={2}
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
        </Agenda.Body>
      </Agenda>
      <div className="flex min-h-5 flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted">
        <span aria-live="polite" className="min-w-0 truncate text-foreground">
          {chosen ? `${formatDay(chosen.day, "long")} · ${chosen.detail ?? chosen.title}` : "Choose an entry to see it"}
        </span>
        <span className="flex items-center gap-3">
          {TONE_WORDS.map((t) => (
            <span key={t.tone} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={cx("size-2 rounded-full", t.dot)} />
              {t.label}
            </span>
          ))}
        </span>
      </div>
    </section>
  );
}
