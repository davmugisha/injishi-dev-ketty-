"use client";

import {
  Calendar,
  DateField,
  DatePicker,
  DateRangePicker,
  type DateValue,
  Description,
  FieldError,
  Label,
  ListBox,
  RangeCalendar,
  Select,
} from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import { type CalendarDate, parseDate } from "@internationalized/date";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { IconAction } from "./buttons.tsx";
import { formatDay } from "./date.tsx";
import {
  addMonths,
  clampTo,
  latestDay,
  monthDiff,
  monthOf,
  PERIOD_PRESETS,
  type Period,
  type PeriodPresetId,
  presetPeriod,
  type RangeProblem,
  rangeProblem,
  withinSpan,
} from "./period.ts";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** A calendar value as the Kigali day it names (`yyyy-mm-dd`). */
function dayOfValue(value: DateValue): string {
  return `${String(value.year).padStart(4, "0")}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
}

/** React Aria memoises calendar state on the bounds' identity: keep one object per day string. */
function useDay(day: string | null | undefined): CalendarDate | undefined {
  return useMemo(() => (day ? parseDate(day) : undefined), [day]);
}

function textLabel(label: ReactNode, fallback: string): string {
  return typeof label === "string" ? label : fallback;
}

/** The month grid inside every date popover: heading, previous and next, the days. */
function CalendarParts({ range = false }: { range?: boolean }) {
  if (range) {
    return (
      <>
        <RangeCalendar.Header>
          <RangeCalendar.Heading />
          <RangeCalendar.NavButton slot="previous" />
          <RangeCalendar.NavButton slot="next" />
        </RangeCalendar.Header>
        <RangeCalendar.Grid>
          <RangeCalendar.GridHeader>
            {(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}
          </RangeCalendar.GridHeader>
          <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
        </RangeCalendar.Grid>
      </>
    );
  }
  return (
    <>
      <Calendar.Header>
        <Calendar.Heading />
        <Calendar.NavButton slot="previous" />
        <Calendar.NavButton slot="next" />
      </Calendar.Header>
      <Calendar.Grid>
        <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
        <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
      </Calendar.Grid>
    </>
  );
}

// --- BoundedDatePicker -----------------------------------------------------------------------------

/** Why a chosen day is not allowed, in words, or null. */
export function dayProblem(
  day: string | null | undefined,
  {
    minValue,
    maxValue,
    isDateUnavailable,
    unavailableMessage = "That day isn't available. Choose another.",
  }: {
    minValue?: string | null;
    maxValue?: string | null;
    isDateUnavailable?: (day: string) => boolean;
    unavailableMessage?: string;
  },
): string | null {
  if (!day) return null;
  if (minValue && day < minValue) return `Choose ${formatDay(minValue, "long")} or later.`;
  if (maxValue && day > maxValue) return `Choose ${formatDay(maxValue, "long")} or earlier.`;
  if (isDateUnavailable?.(day)) return unavailableMessage;
  return null;
}

export interface BoundedDatePickerProps {
  label: ReactNode;
  /** Controlled: the chosen Kigali day (`yyyy-mm-dd`), or null while empty. */
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (day: string | null) => void;
  /** The form field name: the day is posted under it as `yyyy-mm-dd`. */
  name?: string;
  /** The first day that may be chosen (`yyyy-mm-dd`). Earlier days are disabled in the calendar. */
  minValue?: string | null;
  /** The last day that may be chosen. Later days are disabled in the calendar. */
  maxValue?: string | null;
  /** Days that can't be chosen inside the bounds (a day already booked, a weekend). */
  isDateUnavailable?: (day: string) => boolean;
  /** What to say when a typed day is unavailable. */
  unavailableMessage?: string;
  isRequired?: boolean;
  isDisabled?: boolean;
  /** One short helper line ("At least 15 days from today"). */
  description?: ReactNode;
  /** An error from the shared schema or the API. Wins over the bounds message. */
  errorMessage?: string | null;
  className?: string;
  autoFocus?: boolean;
}

/**
 * A date field with a calendar that offers only valid days: `minValue`, `maxValue` and
 * `isDateUnavailable` reach both the typed field and the calendar (HeroUI 3.2.6's DatePicker does not
 * pass them to its Calendar, so invalid days stayed clickable). A day typed outside the rules shows our
 * own words under the field. Use it for every date a form asks for: lease dates, notice dates, a
 * guest's stay.
 */
export function BoundedDatePicker({
  label,
  value,
  defaultValue = null,
  onChange,
  name,
  minValue,
  maxValue,
  isDateUnavailable,
  unavailableMessage,
  isRequired,
  isDisabled,
  description,
  errorMessage,
  className,
  autoFocus,
}: BoundedDatePickerProps) {
  const [inner, setInner] = useState<string | null>(defaultValue);
  const current = value === undefined ? inner : value;
  const min = useDay(minValue);
  const max = useDay(maxValue);
  const selected = useDay(current);
  const unavailable = useCallback(
    (date: DateValue) => Boolean(isDateUnavailable?.(dayOfValue(date))),
    [isDateUnavailable],
  );
  const problem = errorMessage || dayProblem(current, { minValue, maxValue, isDateUnavailable, unavailableMessage });

  return (
    <DatePicker
      name={name}
      value={selected ?? null}
      onChange={(next) => {
        const day = next ? dayOfValue(next) : null;
        if (value === undefined) setInner(day);
        onChange?.(day);
      }}
      minValue={min}
      maxValue={max}
      isDateUnavailable={isDateUnavailable ? unavailable : undefined}
      isRequired={isRequired}
      isDisabled={isDisabled}
      isInvalid={problem ? true : undefined}
      autoFocus={autoFocus}
      firstDayOfWeek="mon"
      className={cx("gap-1", className)}
    >
      <Label>{label}</Label>
      <DateField.Group fullWidth>
        <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        <DateField.Suffix>
          <DatePicker.Trigger aria-label="Open the calendar">
            <DatePicker.TriggerIndicator />
          </DatePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      {description && !problem ? <Description>{description}</Description> : null}
      <FieldError>{problem || undefined}</FieldError>
      <DatePicker.Popover>
        {/* The bounds again, on the Calendar itself: the picker does not hand them down. */}
        <Calendar
          aria-label={textLabel(label, "Choose a day")}
          minValue={min}
          maxValue={max}
          isDateUnavailable={isDateUnavailable ? unavailable : undefined}
          firstDayOfWeek="mon"
        >
          <CalendarParts />
        </Calendar>
      </DatePicker.Popover>
    </DatePicker>
  );
}

// --- PeriodPicker ----------------------------------------------------------------------------------

/** "1 to 31 Oct 2026", "1 Aug to 31 Oct 2026", "1 Dec 2025 to 31 Jan 2026". */
export function formatRange(start: string, end: string): string {
  if (start === end) return formatDay(start, "short");
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const sameMonth = sameYear && start.slice(5, 7) === end.slice(5, 7);
  const endText = formatDay(end, "short");
  if (sameMonth) return `${Number(start.slice(8, 10))} to ${endText}`;
  if (sameYear) {
    const startText = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
      new Date(`${start}T12:00:00Z`),
    );
    return `${startText} to ${endText}`;
  }
  return `${formatDay(start, "short")} to ${endText}`;
}

/** The words for a range problem. */
export function rangeProblemText(problem: RangeProblem): string {
  switch (problem.code) {
    case "order":
      return "The end can't be before the start.";
    case "future":
      return `Choose days up to ${formatDay(problem.latest, "long")}.`;
    case "too_early":
      return `Choose days from ${formatDay(problem.earliest, "long")}.`;
    case "too_long":
      return `Choose up to ${problem.maxDays} days.`;
  }
}

export interface PeriodPickerProps {
  /** The period shown: a preset, or a custom range. Keep it in the address bar (`nuqs`). */
  value: Period;
  onChange: (period: Period) => void;
  /** The Kigali day today, from the server, so presets read the same on the server and in the browser. */
  today: string;
  /** Which presets to offer, in this order. @default all four */
  presets?: readonly PeriodPresetId[];
  /** Offer a custom range. @default true */
  allowCustom?: boolean;
  /** Let a custom range reach past today (planning ahead). @default false */
  allowFuture?: boolean;
  /** The earliest day a custom range may start (when the records begin). */
  minDay?: string | null;
  /** The latest day a custom range may end. */
  maxDay?: string | null;
  /** The most days a custom range may cover. @default 731 (two years) */
  maxDays?: number;
  /** Show the period's days beside the control ("1 Aug to 31 Oct 2026"). @default true */
  showRange?: boolean;
  /** For screen readers. @default "Period" */
  label?: string;
  className?: string;
}

const CUSTOM = "custom";

/**
 * The period a page's figures cover: This month, Last 3 months, This year, Last year, or a custom range.
 * A segmented control from md up, a select on a phone. Presets are whole calendar periods. A custom range
 * offers only valid days: the end can't come before the start, nothing after today unless
 * `allowFuture`, nothing before `minDay`, and no more than `maxDays` days (days farther than that from
 * the first day picked are disabled while picking).
 */
export function PeriodPicker({
  value,
  onChange,
  today,
  presets = PERIOD_PRESETS.map((p) => p.id),
  allowCustom = true,
  allowFuture = false,
  minDay,
  maxDay,
  maxDays = 731,
  showRange = true,
  label = "Period",
  className,
}: PeriodPickerProps) {
  const choices = [
    ...PERIOD_PRESETS.filter((p) => presets.includes(p.id)),
    ...(allowCustom ? [{ id: CUSTOM, label: "Custom" } as const] : []),
  ];
  const rules = { today, allowFuture, minDay, maxDay, maxDays };
  const latest = latestDay(rules);
  const [draftProblem, setDraftProblem] = useState<string | null>(null);

  const choose = (id: string) => {
    setDraftProblem(null);
    if (id === CUSTOM) {
      // Start from the days already shown, kept within the rules.
      const end = clampTo(value.end, minDay, latest);
      const start = clampTo(value.start, minDay, end);
      onChange({ preset: "custom", start, end });
      return;
    }
    onChange(presetPeriod(id as PeriodPresetId, today));
  };

  return (
    <fieldset aria-label={label} className={cx("flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2", className)}>
      <Segment
        aria-label={label}
        size="sm"
        selectedKey={value.preset}
        onSelectionChange={(k) => choose(String(k))}
        className="hidden w-fit md:inline-flex"
      >
        {choices.map((c) => (
          <Segment.Item key={c.id} id={c.id}>
            {c.label}
          </Segment.Item>
        ))}
      </Segment>
      <Select
        aria-label={label}
        value={value.preset}
        onChange={(k) => (k != null ? choose(String(k)) : undefined)}
        className="w-full md:hidden"
      >
        <Select.Trigger>
          {/* Only the name: the days show beside the control. */}
          <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {choices.map((c) => {
              const days = c.id === CUSTOM ? null : presetPeriod(c.id, today);
              return (
                <ListBox.Item key={c.id} id={c.id} textValue={c.label}>
                  <span className="flex min-w-0 flex-col">
                    <span>{c.label}</span>
                    <span className="text-xs text-muted">
                      {days ? formatRange(days.start, days.end) : "Choose the first and last day"}
                    </span>
                  </span>
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              );
            })}
          </ListBox>
        </Select.Popover>
      </Select>
      {value.preset === CUSTOM ? (
        <CustomRange
          label={label}
          value={value}
          rules={rules}
          latest={latest}
          problem={draftProblem}
          onProblem={setDraftProblem}
          onChange={onChange}
        />
      ) : showRange ? (
        <span className="text-sm whitespace-nowrap text-muted tabular">{formatRange(value.start, value.end)}</span>
      ) : null}
    </fieldset>
  );
}

function CustomRange({
  label,
  value,
  rules,
  latest,
  problem,
  onProblem,
  onChange,
}: {
  label: string;
  value: Period;
  rules: { today: string; allowFuture: boolean; minDay?: string | null; maxDay?: string | null; maxDays: number };
  latest: string | null;
  problem: string | null;
  onProblem: (problem: string | null) => void;
  onChange: (period: Period) => void;
}) {
  const min = useDay(rules.minDay);
  const max = useDay(latest);
  const range = useMemo(() => ({ start: parseDate(value.start), end: parseDate(value.end) }), [value.start, value.end]);
  // The first day picked while a range is being chosen, read from the calendar's own state as it renders.
  const anchor = useRef<string | null>(null);
  const outOfSpan = useCallback(
    (date: DateValue) => (anchor.current ? !withinSpan(dayOfValue(date), anchor.current, rules.maxDays) : false),
    [rules.maxDays],
  );
  return (
    <DateRangePicker
      aria-label={`${label}, custom range`}
      value={range}
      onChange={(next) => {
        if (!next) return;
        const start = dayOfValue(next.start);
        const end = dayOfValue(next.end);
        const found = rangeProblem(start, end, rules);
        onProblem(found ? rangeProblemText(found) : null);
        if (!found) onChange({ preset: "custom", start, end });
      }}
      minValue={min}
      maxValue={max}
      isDateUnavailable={outOfSpan}
      isInvalid={problem ? true : undefined}
      firstDayOfWeek="mon"
      className="w-full gap-1 sm:w-auto"
    >
      <DateField.Group fullWidth className="sm:min-w-64">
        <DateField.Input slot="start">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        <DateRangePicker.RangeSeparator>to</DateRangePicker.RangeSeparator>
        <DateField.Input slot="end">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        <DateField.Suffix>
          <DateRangePicker.Trigger aria-label="Open the calendar">
            <DateRangePicker.TriggerIndicator />
          </DateRangePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      <FieldError>{problem || undefined}</FieldError>
      <DateRangePicker.Popover>
        {/* The bounds again on the calendar (HeroUI does not hand them down), plus the span rule. */}
        <RangeCalendar
          aria-label={`${label}, custom range`}
          minValue={min}
          maxValue={max}
          isDateUnavailable={outOfSpan}
          firstDayOfWeek="mon"
        >
          {({ state }) => {
            anchor.current = state.anchorDate ? dayOfValue(state.anchorDate) : null;
            return <CalendarParts range />;
          }}
        </RangeCalendar>
      </DateRangePicker.Popover>
    </DateRangePicker>
  );
}

// --- MonthPicker and YearPicker -----------------------------------------------------------------------

interface StepOption {
  id: string;
  label: string;
}

/** Previous, a select, next: the shape of the month and year pickers. */
function SteppedSelect({
  label,
  options,
  value,
  onChange,
  previousLabel,
  nextLabel,
  firstReason,
  lastReason,
  isDisabled,
  className,
}: {
  label: string;
  /** Oldest first. */
  options: StepOption[];
  value: string;
  onChange: (id: string) => void;
  previousLabel: string;
  nextLabel: string;
  firstReason: string;
  lastReason: string;
  isDisabled?: boolean;
  className?: string;
}) {
  const index = options.findIndex((o) => o.id === value);
  const atFirst = index <= 0;
  const atLast = index === -1 || index >= options.length - 1;
  return (
    <fieldset aria-label={label} className={cx("flex min-w-0 items-center gap-1.5", className)}>
      <IconAction
        icon="ChevronLeft"
        label={previousLabel}
        disabledReason={atFirst ? firstReason : null}
        isDisabled={isDisabled}
        onPress={() => onChange(options[index - 1].id)}
      />
      <Select
        aria-label={label}
        value={value}
        onChange={(k) => (k != null ? onChange(String(k)) : undefined)}
        isDisabled={isDisabled}
        className="min-w-36"
      >
        <Select.Trigger className="h-8">
          <Select.Value className="tabular" />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {[...options].reverse().map((o) => (
              <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
                <span className="tabular">{o.label}</span>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      <IconAction
        icon="ChevronRight"
        label={nextLabel}
        disabledReason={atLast ? lastReason : null}
        isDisabled={isDisabled}
        onPress={() => onChange(options[index + 1].id)}
      />
    </fieldset>
  );
}

const MONTH_FORMAT = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/** "October 2026" for "2026-10". */
export function formatMonth(month: string): string {
  return MONTH_FORMAT.format(new Date(`${month}-15T12:00:00Z`));
}

/**
 * One month (`yyyy-mm`), stepped with previous and next or picked from a list, within `min`..`max`
 * (`max` defaults to the current month). For the rent roll and a month's payments.
 */
export function MonthPicker({
  value,
  onChange,
  today,
  min,
  max,
  label = "Month",
  isDisabled,
  className,
}: {
  value: string;
  onChange: (month: string) => void;
  /** The Kigali day today, from the server. */
  today: string;
  /** The first month offered (`yyyy-mm`). @default two years before `max` */
  min?: string;
  /** The last month offered. @default this month */
  max?: string;
  label?: string;
  isDisabled?: boolean;
  className?: string;
}) {
  const last = max ?? monthOf(today);
  const first = min ?? addMonths(last, -24);
  const options = useMemo(() => {
    const count = Math.max(0, monthDiff(first, last));
    return Array.from({ length: count + 1 }, (_, i) => {
      const id = addMonths(first, i);
      return { id, label: formatMonth(id) };
    });
  }, [first, last]);
  return (
    <SteppedSelect
      label={label}
      options={options}
      value={clampTo(value, first, last)}
      onChange={onChange}
      previousLabel="Previous month"
      nextLabel="Next month"
      firstReason="This is the first month"
      lastReason="This is the latest month"
      isDisabled={isDisabled}
      className={className}
    />
  );
}

/** One year, stepped or picked from a list, within `min`..`max` (`max` defaults to this year). For taxes. */
export function YearPicker({
  value,
  onChange,
  today,
  min,
  max,
  label = "Year",
  isDisabled,
  className,
}: {
  value: number;
  onChange: (year: number) => void;
  today: string;
  /** @default five years before `max` */
  min?: number;
  /** @default this year */
  max?: number;
  label?: string;
  isDisabled?: boolean;
  className?: string;
}) {
  const last = max ?? Number(today.slice(0, 4));
  const first = Math.min(min ?? last - 5, last);
  const options = useMemo(
    () => Array.from({ length: last - first + 1 }, (_, i) => ({ id: String(first + i), label: String(first + i) })),
    [first, last],
  );
  return (
    <SteppedSelect
      label={label}
      options={options}
      value={String(Math.min(Math.max(value, first), last))}
      onChange={(id) => onChange(Number(id))}
      previousLabel="Previous year"
      nextLabel="Next year"
      firstReason="This is the first year"
      lastReason="This is the latest year"
      isDisabled={isDisabled}
      className={className}
    />
  );
}
