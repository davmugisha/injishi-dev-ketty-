"use client";

import { Calendar, type DateValue } from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { type ReactNode, useMemo, useState } from "react";
import { ActionButton } from "./buttons.tsx";
import { formatDay } from "./date.tsx";
import { Money } from "./money.tsx";
import { STATUS_TONE } from "./status.ts";
import { StatusChip } from "./status-chip.tsx";
import { toneBg } from "./tone.ts";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** A rent charge as the calendar shows it: on its due day, paid, due or overdue. */
export type RentDayStatus = "paid" | "open" | "overdue";

export interface RentDayItem {
  id: string;
  /** The due day, a Kigali day (`yyyy-mm-dd`). */
  day: string;
  status: RentDayStatus;
  /** Who: the tenant's name. */
  title: ReactNode;
  /** Where or what: "A-01 · October rent". */
  detail?: ReactNode;
  amount: number;
}

/** The order a day's dots and rows come in: what needs doing first. */
const ORDER: RentDayStatus[] = ["overdue", "open", "paid"];
const WORDS: Record<RentDayStatus, string> = { overdue: "Overdue", open: "Due", paid: "Paid" };

function dayOfValue(value: DateValue): string {
  return `${String(value.year).padStart(4, "0")}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
}

/** A state's mark: filled for what is still owed, a ring for paid (done), so the two read apart without colour. */
function StateDot({ status }: { status: RentDayStatus }) {
  const tone = STATUS_TONE.charge[status];
  return status === "paid" ? (
    <span aria-hidden="true" className={cx("size-1.5 rounded-full border", toneBorder(tone))} />
  ) : (
    <span aria-hidden="true" className={cx("size-1.5 rounded-full", toneBg(tone))} />
  );
}

function toneBorder(tone: string): string {
  return tone === "success"
    ? "border-success"
    : tone === "danger"
      ? "border-danger"
      : tone === "warning"
        ? "border-warning"
        : "border-accent";
}

/** "2 due, 1 overdue". */
function countsText(items: readonly RentDayItem[]): string {
  return ORDER.map((s) => {
    const n = items.filter((i) => i.status === s).length;
    return n ? `${n} ${WORDS[s].toLowerCase()}` : null;
  })
    .filter(Boolean)
    .join(", ");
}

export interface RentCalendarProps {
  /** Charges to show, each on its due day. */
  items: readonly RentDayItem[];
  /** The Kigali day today, from the server: it is marked, and chosen first. */
  today: string;
  /** Controlled: the chosen day. */
  selectedDay?: string;
  defaultSelectedDay?: string;
  onSelectedDayChange?: (day: string) => void;
  /** Open a charge (a side panel). Rows are buttons when given. */
  onItemPress?: (item: RentDayItem) => void;
  /** @default "Rent calendar" */
  label?: string;
  className?: string;
}

/**
 * Rent on a month grid: each day with a dot per state (overdue, due, paid), and the chosen day's charges
 * listed beside it (under it in a narrow space). Days are Kigali days. Pick a day with a click or the
 * arrow keys; an empty day points to the next day with rent on it.
 */
export function RentCalendar({
  items,
  today,
  selectedDay,
  defaultSelectedDay,
  onSelectedDayChange,
  onItemPress,
  label = "Rent calendar",
  className,
}: RentCalendarProps) {
  const [inner, setInner] = useState(defaultSelectedDay ?? today);
  const selected = selectedDay ?? inner;
  const choose = (day: string) => {
    if (selectedDay === undefined) setInner(day);
    onSelectedDayChange?.(day);
  };
  const byDay = useMemo(() => {
    const map = new Map<string, RentDayItem[]>();
    for (const item of items) {
      const list = map.get(item.day) ?? [];
      list.push(item);
      map.set(item.day, list);
    }
    for (const list of map.values()) list.sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
    return map;
  }, [items]);
  const days = useMemo(() => [...byDay.keys()].sort(), [byDay]);
  const dayItems = byDay.get(selected) ?? [];
  const next = days.find((d) => d > selected) ?? null;
  const value = useMemo(() => parseDate(selected), [selected]);
  // The month shown follows the chosen day (the "Next" button can jump to another month); the arrows
  // and keys move it freely in between.
  const [focused, setFocused] = useState<DateValue>(value);
  const [shownFor, setShownFor] = useState(selected);
  if (shownFor !== selected) {
    setShownFor(selected);
    setFocused(value);
  }
  const total = dayItems.reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className={cx("@container min-w-0", className)}>
      <div className="grid gap-5 @2xl:grid-cols-5">
        <div className="flex min-w-0 flex-col gap-3 @2xl:col-span-3">
          <Calendar
            aria-label={label}
            value={value}
            onChange={(date) => choose(dayOfValue(date))}
            focusedValue={focused}
            onFocusChange={setFocused}
            firstDayOfWeek="mon"
            className="w-full max-w-none"
          >
            <Calendar.Header className="pb-3">
              <Calendar.Heading className="text-sm font-semibold" />
              <Calendar.NavButton slot="previous" />
              <Calendar.NavButton slot="next" />
            </Calendar.Header>
            <Calendar.Grid>
              <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
              <Calendar.GridBody>
                {(date) => {
                  const day = dayOfValue(date);
                  const states = ORDER.filter((s) => byDay.get(day)?.some((i) => i.status === s));
                  return (
                    <Calendar.Cell
                      date={date}
                      className={cx(
                        // Square cells would be huge in a wide card: rows of a fixed height instead.
                        "aspect-auto h-11 flex-col gap-1 rounded-lg",
                        // Today is the Kigali day, not the browser's.
                        "data-today:bg-transparent data-today:text-foreground",
                        day === today && "font-semibold text-accent data-today:text-accent",
                        "data-selected:bg-accent-soft data-selected:text-foreground data-selected:ring-2 data-selected:ring-accent data-selected:ring-inset",
                      )}
                    >
                      {({ formattedDate }) => (
                        <>
                          <span className="leading-none tabular">{formattedDate}</span>
                          <span aria-hidden="true" className="flex h-1.5 items-center gap-0.5">
                            {states.map((s) => (
                              <StateDot key={s} status={s} />
                            ))}
                          </span>
                        </>
                      )}
                    </Calendar.Cell>
                  );
                }}
              </Calendar.GridBody>
            </Calendar.Grid>
          </Calendar>
          <ul aria-label="What the dots mean" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {ORDER.map((s) => (
              <li key={s} className="flex items-center gap-1.5">
                <StateDot status={s} />
                {WORDS[s]}
              </li>
            ))}
          </ul>
        </div>

        <section
          aria-label={`Rent on ${formatDay(selected, "long")}`}
          aria-live="polite"
          className="flex min-w-0 flex-col gap-3 @2xl:col-span-2 @2xl:border-l @2xl:border-separator @2xl:pl-5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="text-sm font-semibold">
              {selected === today ? "Today" : formatDay(selected, "weekday")}
              {selected === today ? (
                <span className="font-normal text-muted">, {formatDay(selected, "weekday")}</span>
              ) : null}
            </h3>
            {dayItems.length > 0 ? (
              <span className="text-xs text-muted">
                {countsText(dayItems)} · <Money value={total} />
              </span>
            ) : null}
          </div>
          {dayItems.length === 0 ? (
            <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-border px-3 py-4">
              <p className="text-sm text-muted">No rent due this day.</p>
              {next ? (
                <ActionButton
                  icon="ArrowRight"
                  size="sm"
                  intent="ghost"
                  iconPlacement="end"
                  onPress={() => choose(next)}
                >
                  Next: {formatDay(next, "weekday")}
                </ActionButton>
              ) : null}
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-separator">
              {dayItems.map((item) => {
                const body = (
                  <>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium text-foreground">{item.title}</span>
                      {item.detail ? <span className="truncate text-xs text-muted">{item.detail}</span> : null}
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <Money value={item.amount} className="text-sm" />
                      <StatusChip kind="charge" status={item.status}>
                        {WORDS[item.status]}
                      </StatusChip>
                    </span>
                  </>
                );
                return (
                  <li key={item.id}>
                    {onItemPress ? (
                      <button
                        type="button"
                        onClick={() => onItemPress(item)}
                        className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left hover:bg-default focus-visible:outline-2 focus-visible:outline-focus"
                      >
                        {body}
                      </button>
                    ) : (
                      <div className="flex items-center gap-3 px-2 py-2.5">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
