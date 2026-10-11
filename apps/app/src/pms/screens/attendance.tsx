"use client";

/**
 * HR · Attendance: who is in, who is late, who has not arrived (HR module,
 * Phase 5 — first pass, no ADR yet).
 *
 * TWO QUESTIONS, TWO HALVES. "What is happening today?" is the board at the
 * top: one row a person, their shift, the times they clocked, and where that
 * leaves them. "What did the week add up to?" is the timesheet under it: days,
 * hours, late arrivals and missed shifts per person, over a stretch of days,
 * with the file payroll asks for.
 *
 * PEOPLE CLOCK THEMSELVES, on My HR. This screen is where HR reads that, and
 * where a day is WRITTEN OR CORRECTED by hand: the phone left at home, the
 * clock out forgotten at the end of a night shift. A record HR wrote says so
 * on the row, to the employee as well.
 *
 * NOTHING HERE IS A STORED VERDICT. "Not in" is a rostered shift that has
 * started with no clock in; the API works it out each time it is asked, so it
 * clears the moment the person arrives. While the board shows today it asks
 * again every minute.
 */

import { BarList, Input } from "@injishi/ui";
import { ChevronLeft, ChevronRight, ClipboardClock, Download, PenLine, Table2 } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { ActionButton, Badge, Chip, EmptyState, LoadFailed, SectionHeading, Skeleton, StatCard } from "../components/ui";
import { useCapability, useWorkspaceId } from "../data/capability";
import {
  useAttendanceBoard,
  useRecordAttendance,
  useRemoveAttendance,
  useTimesheet,
  type AttendanceBoardRow,
  type Timesheet,
} from "../data/hr-time";
import { addDaysIso, dshortIso } from "../lib/format";
import { usePms } from "../store";
import {
  DayStatusBadge,
  Eyebrow,
  Field,
  FormError,
  Person,
  RowList,
  ShiftChip,
  clock,
  hoursText,
  inputClass,
  panelClass,
  rowClass,
  weekdayText,
} from "./hr-ui";

type Filter = "all" | "working" | "late" | "missing" | "done" | "expected" | "on_leave";

const stepClass =
  "flex size-9 cursor-pointer items-center justify-center rounded border border-card-bd bg-card text-ink2 hover:bg-hover";

/** Too small to be worth a badge: two minutes early is not "left early". */
const WORTH_SAYING_MINUTES = 5;

export function Attendance() {
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();

  // `null` is today, on the hotel's own clock.
  const [date, setDate] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  // The one row whose day is being written or corrected.
  const [writing, setWriting] = useState<string | null>(null);
  const board = useAttendanceBoard(workspaceId, date);

  if (!can("employee.manage")) {
    return <EmptyState style={{ padding: 26, fontSize: 13.5 }}>{reasonFor("employee.manage")}</EmptyState>;
  }

  if (board.isPending) {
    return (
      <div className="pms-enter flex max-w-page flex-col gap-4">
        <Skeleton height={84} />
        <Skeleton height={320} delay={60} />
      </div>
    );
  }

  if (board.isError) {
    return (
      <LoadFailed onRetry={() => void board.refetch()} retrying={board.isFetching}>
        We couldn&apos;t load attendance. This is on our side.
      </LoadFailed>
    );
  }

  const data = board.data;
  const isToday = data.date === data.today;
  const s = data.summary;
  const matches = (row: AttendanceBoardRow) =>
    filter === "all" || (filter === "late" ? (row.entry?.lateMinutes ?? 0) > 0 : row.status === filter);
  const shown = data.rows.filter(matches);

  const filters: { key: Filter; label: string; n: number }[] = [
    { key: "all", label: "Everyone", n: s.people },
    { key: "working", label: "At work", n: s.working },
    { key: "late", label: "Late", n: s.late },
    { key: "missing", label: "Not in", n: s.missing },
    { key: "done", label: "Finished", n: s.done },
    { key: "expected", label: "Not started", n: s.expected },
    { key: "on_leave", label: "On leave", n: s.onLeave },
  ];

  return (
    <div className="pms-enter relative flex max-w-page flex-col gap-6">
      <section>
        <SectionHeading icon={ClipboardClock} n={`${s.rostered} rostered`}>
          {isToday ? "Today" : "The day"}
        </SectionHeading>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button type="button" aria-label="The day before" onClick={() => setDate(addDaysIso(data.date, -1))} className={stepClass}>
            <ChevronLeft aria-hidden="true" className="size-4" strokeWidth={2} />
          </button>
          <span className="pms-num min-w-40 text-center text-sm font-semibold text-ink" aria-live="polite">
            {weekdayText(data.date)} {data.date.slice(0, 4)}
          </span>
          <button type="button" aria-label="The day after" onClick={() => setDate(addDaysIso(data.date, 1))} className={stepClass}>
            <ChevronRight aria-hidden="true" className="size-4" strokeWidth={2} />
          </button>
          {isToday ? (
            <Badge intent="accent">Today, as of {clock(data.serverNow)}</Badge>
          ) : (
            <ActionButton onClick={() => setDate(null)}>Back to today</ActionButton>
          )}
          <span className="ml-auto w-44">
            <Input
              type="date"
              size="sm"
              aria-label="Go to a day"
              value={data.date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="h-9 rounded border-line2 bg-card text-sm"
            />
          </span>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard n={String(s.working)} label={isToday ? "At work now" : "Never clocked out"} />
          <StatCard n={String(s.late)} label="Arrived late" />
          <StatCard n={String(s.missing)} label={isToday ? "Not in, shift started" : "Did not come in"} />
          <StatCard n={String(s.done)} label="Finished their day" />
          <StatCard n={String(s.onLeave)} label="On leave" />
        </div>

        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Show">
          {filters
            // A filter that would show nobody is noise, except the one that is on.
            .filter((f) => f.key === "all" || f.n > 0 || f.key === filter)
            .map((f) => (
              <Chip key={f.key} size="sm" n={f.n} label={f.label} active={filter === f.key} onClick={() => setFilter(f.key)} />
            ))}
        </div>

        {data.rows.length === 0 ? (
          <EmptyState icon={ClipboardClock} className="mt-2.5">
            Nobody to show yet. Add people on the Employees tab, then write the week on the Roster tab.
          </EmptyState>
        ) : shown.length === 0 ? (
          <EmptyState icon={ClipboardClock} className="mt-2.5">
            Nobody matches that on {dshortIso(data.date)}.
          </EmptyState>
        ) : (
          <RowList>
            {shown.map((row, i) => (
              <div key={row.departmentMemberId} className={rowClass(i)}>
                <BoardRow
                  row={row}
                  writing={writing === row.departmentMemberId}
                  onWrite={() => setWriting(writing === row.departmentMemberId ? null : row.departmentMemberId)}
                />
                {writing === row.departmentMemberId && (
                  <RecordForm row={row} date={data.date} past={!isToday} onDone={() => setWriting(null)} />
                )}
              </div>
            ))}
          </RowList>
        )}
      </section>

      <TimesheetSection today={data.today} />
    </div>
  );
}

/** One person's day, read left to right: who, which shift, what the clock says, where that leaves them. */
function BoardRow({ row, writing, onWrite }: { row: AttendanceBoardRow; writing: boolean; onWrite: () => void }) {
  const { entry } = row;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Person
        name={row.name ?? "Unknown"}
        detail={[row.jobTitle, row.departmentName].filter(Boolean).join(" · ")}
        className="basis-52"
      />

      <span className="w-40 shrink-0">
        {row.shift ? <ShiftChip shift={row.shift} className="w-full" /> : <span className="text-2xs text-faint">No shift</span>}
      </span>

      <span className="flex w-36 shrink-0 flex-col gap-0.5">
        {entry ? (
          <>
            <span className="pms-num text-sm font-semibold text-ink">
              {clock(entry.clockInAt)} to {entry.clockOutAt ? clock(entry.clockOutAt) : "now"}
            </span>
            <span className="pms-num text-2xs text-muted-foreground">{hoursText(entry.workedMinutes)} worked</span>
          </>
        ) : (
          <span className="text-2xs text-faint">No clock in</span>
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        <DayStatusBadge status={row.status} />
        {entry && row.onLeave && <Badge intent="info">On leave</Badge>}
        {entry && entry.lateMinutes > 0 && <Badge intent="warn">{hoursText(entry.lateMinutes)} late</Badge>}
        {entry && entry.leftEarlyMinutes >= WORTH_SAYING_MINUTES && (
          <Badge intent="warn">Left {hoursText(entry.leftEarlyMinutes)} early</Badge>
        )}
        {entry && entry.overtimeMinutes >= WORTH_SAYING_MINUTES && (
          <Badge intent="info">{hoursText(entry.overtimeMinutes)} over</Badge>
        )}
        {entry?.stale && <Badge intent="warn">Clock out forgotten?</Badge>}
        {entry?.source === "manual" && <Badge intent="neutral">Written by HR</Badge>}
        {entry?.note && <span className="text-2xs text-muted-foreground">{entry.note}</span>}
      </span>

      <ActionButton icon={writing ? undefined : PenLine} onClick={onWrite}>
        {writing ? "Close" : entry ? "Correct" : "Record"}
      </ActionButton>
    </div>
  );
}

/** Write somebody's day, or correct the one that is there. */
function RecordForm({
  row,
  date,
  past,
  onDone,
}: {
  row: AttendanceBoardRow;
  date: string;
  /** A day already gone: an empty clock out would leave them "at work" for ever. */
  past: boolean;
  onDone: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const { toast } = usePms();
  const record = useRecordAttendance(workspaceId);
  const remove = useRemoveAttendance(workspaceId);
  const name = row.name ?? "This person";
  const [draft, setDraft] = useState({
    clockIn: row.entry ? clock(row.entry.clockInAt) : (row.shift?.startTime ?? "08:00"),
    clockOut: row.entry?.clockOutAt ? clock(row.entry.clockOutAt) : past ? (row.shift?.endTime ?? "") : "",
    note: row.entry?.note ?? "",
  });
  const id = row.departmentMemberId;
  const overnight = draft.clockOut !== "" && draft.clockOut <= draft.clockIn;

  return (
    <form
      className="mt-3 flex flex-col gap-4 border-t border-line pt-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        record.mutate(
          {
            departmentMemberId: row.departmentMemberId,
            workDate: date,
            clockIn: draft.clockIn,
            clockOut: draft.clockOut || null,
            note: draft.note.trim() || undefined,
          },
          {
            onSuccess: () => {
              toast(`${name}'s day on ${dshortIso(date)} saved`, "ok");
              onDone();
            },
          },
        );
      }}
    >
      <div className="grid gap-4 md:grid-cols-4">
        <Field label="Clocked in" htmlFor={`att-in-${id}`}>
          <Input
            id={`att-in-${id}`}
            required
            type="time"
            value={draft.clockIn}
            onChange={(e) => setDraft({ ...draft, clockIn: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field
          label="Clocked out"
          hint={overnight ? "The next morning." : "Leave empty while they are still at work."}
          htmlFor={`att-out-${id}`}
        >
          <Input
            id={`att-out-${id}`}
            type="time"
            value={draft.clockOut}
            onChange={(e) => setDraft({ ...draft, clockOut: e.target.value })}
            className={inputClass}
          />
        </Field>
        <div className="md:col-span-2">
          <Field label="Note" hint="Why it was written by hand. They see it too." htmlFor={`att-note-${id}`}>
            <Input
              id={`att-note-${id}`}
              maxLength={300}
              placeholder="Forgot to clock out"
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
      </div>
      <FormError error={record.error ?? remove.error} />
      <div className="flex flex-wrap justify-end gap-2">
        {row.entry && (
          <ActionButton
            className="mr-auto"
            pending={remove.isPending}
            onClick={() =>
              remove.mutate(
                { entryId: row.entry!.id },
                {
                  onSuccess: () => {
                    toast(`${name}'s record for ${dshortIso(date)} removed`, "ok");
                    onDone();
                  },
                },
              )
            }
          >
            Remove this record
          </ActionButton>
        )}
        <ActionButton onClick={onDone}>Cancel</ActionButton>
        <ActionButton variant="primary" type="submit" pending={record.isPending}>
          Save the day
        </ActionButton>
      </div>
    </form>
  );
}

/* ── The timesheet ──────────────────────────────────────────────────────── */

type Range = "this-week" | "last-week" | "this-month" | "last-month";

const RANGES: { key: Range; label: string }[] = [
  { key: "this-week", label: "This week" },
  { key: "last-week", label: "Last week" },
  { key: "this-month", label: "This month" },
  { key: "last-month", label: "Last month" },
];

/** The Monday of the week a day sits in. */
function mondayOf(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return addDaysIso(day, -((weekday + 6) % 7));
}

/** The first and last day a range covers, never running past today. */
function rangeDays(range: Range, today: string): { from: string; to: string } {
  const monday = mondayOf(today);
  const monthStart = `${today.slice(0, 7)}-01`;
  switch (range) {
    case "this-week":
      return { from: monday, to: today };
    case "last-week":
      return { from: addDaysIso(monday, -7), to: addDaysIso(monday, -1) };
    case "this-month":
      return { from: monthStart, to: today };
    case "last-month": {
      const lastDay = addDaysIso(monthStart, -1);
      return { from: `${lastDay.slice(0, 7)}-01`, to: lastDay };
    }
  }
}

/** Minutes as decimal hours, which is what a spreadsheet adds up. */
function decimalHours(minutes: number): string {
  return (minutes / 60).toFixed(2);
}

/** Hand the timesheet over as a file a spreadsheet opens. */
function downloadCsv(sheet: Timesheet): void {
  const cell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const lines = [
    ["Name", "Job title", "Department", "Days rostered", "Days worked", "Days late", "Shifts missed", "Leave days", "Hours scheduled", "Hours worked", "Overtime hours", "Minutes late"],
    ...sheet.rows.map((r) => [
      r.name ?? "",
      r.jobTitle ?? "",
      r.departmentName ?? "",
      r.rosteredDays,
      r.presentDays,
      r.lateDays,
      r.missedDays,
      r.leaveDays,
      decimalHours(r.scheduledMinutes),
      decimalHours(r.workedMinutes),
      decimalHours(r.overtimeMinutes),
      r.lateMinutes,
    ]),
  ];
  const csv = lines.map((line) => line.map(cell).join(",")).join("\r\n");
  // The byte order mark is what makes Excel read the names as UTF-8.
  const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `timesheet-${sheet.from}-to-${sheet.to}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

const headCell = "py-2 pr-3 text-2xs font-bold tracking-[0.05em] uppercase text-[var(--muted2)]";
const figureCell = "pms-num py-2.5 pr-3 text-right";

/** A stretch of days added up per person, and the file payroll asks for. */
function TimesheetSection({ today }: { today: string }) {
  const workspaceId = useWorkspaceId();
  const [range, setRange] = useState<Range>("this-week");
  const { from, to } = rangeDays(range, today);
  const sheet = useTimesheet(workspaceId, from, to);
  const data = sheet.data;
  const worked = (data?.rows ?? []).filter((r) => r.presentDays > 0 || r.rosteredDays > 0 || r.leaveDays > 0);

  return (
    <section>
      <SectionHeading
        icon={Table2}
        action={
          <ActionButton
            icon={Download}
            deniedReason={!data || worked.length === 0 ? "Nothing to export for these days" : undefined}
            onClick={() => data && downloadCsv(data)}
          >
            Export as a spreadsheet
          </ActionButton>
        }
      >
        Timesheet
      </SectionHeading>

      <div className="mt-2.5 flex flex-wrap items-center gap-2" role="group" aria-label="Which days">
        {RANGES.map((r) => (
          <Chip key={r.key} size="sm" label={r.label} active={range === r.key} onClick={() => setRange(r.key)} />
        ))}
        <span className="pms-num text-2xs text-muted-foreground">
          {dshortIso(from)} to {dshortIso(to)} {to.slice(0, 4)}
        </span>
      </div>

      {sheet.isPending ? (
        <Skeleton height={160} style={{ marginTop: 10 }} />
      ) : sheet.isError || !data ? (
        <LoadFailed onRetry={() => void sheet.refetch()} retrying={sheet.isFetching} className="mt-2.5">
          We couldn&apos;t add the timesheet up. This is on our side.
        </LoadFailed>
      ) : worked.length === 0 ? (
        <EmptyState icon={Table2} className="mt-2.5">
          Nothing rostered or clocked in these days.
        </EmptyState>
      ) : (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard n={hoursText(data.totals.workedMinutes)} label={`Worked, of ${hoursText(data.totals.scheduledMinutes)} scheduled`} />
            <StatCard n={String(data.totals.presentDays)} label={`Days worked, ${data.totals.rosteredDays} rostered`} />
            <StatCard n={String(data.totals.lateDays)} label="Late arrivals" />
            <StatCard n={String(data.totals.missedDays)} label="Shifts nobody came in for" />
          </div>

          <div className={cn(panelClass, "mt-3 overflow-x-auto px-[18px] py-2")}>
            <table className="w-full min-w-[44rem] text-sm">
              <caption className="sr-only">
                Timesheet, {dshortIso(from)} to {dshortIso(to)}
              </caption>
              <thead>
                <tr className="border-b border-line text-left">
                  <th scope="col" className={headCell}>Person</th>
                  <th scope="col" className={cn(headCell, "text-right")}>Days worked</th>
                  <th scope="col" className={cn(headCell, "text-right")}>Hours</th>
                  <th scope="col" className={cn(headCell, "text-right")}>Scheduled</th>
                  <th scope="col" className={cn(headCell, "text-right")}>Over</th>
                  <th scope="col" className={cn(headCell, "text-right")}>Late</th>
                  <th scope="col" className={cn(headCell, "pr-0 text-right")}>Missed</th>
                </tr>
              </thead>
              <tbody>
                {worked.map((r) => (
                  <tr key={r.departmentMemberId} className="border-b border-line last:border-b-0">
                    <td className="py-2.5 pr-3">
                      <span className="flex flex-col gap-0.5">
                        <span className="font-semibold text-ink">{r.name ?? "Unknown"}</span>
                        <span className="text-2xs text-muted-foreground">
                          {[r.jobTitle, r.departmentName].filter(Boolean).join(" · ")}
                          {r.leaveDays > 0 ? ` · ${r.leaveDays} on leave` : ""}
                        </span>
                      </span>
                    </td>
                    <td className={cn(figureCell, "text-ink")}>
                      {r.presentDays}
                      <span className="text-muted-foreground"> of {r.rosteredDays}</span>
                    </td>
                    <td className={cn(figureCell, "font-semibold text-ink")}>{hoursText(r.workedMinutes)}</td>
                    <td className={cn(figureCell, "text-muted-foreground")}>{hoursText(r.scheduledMinutes)}</td>
                    <td className={cn(figureCell, r.overtimeMinutes > 0 ? "text-ink" : "text-faint")}>
                      {r.overtimeMinutes > 0 ? hoursText(r.overtimeMinutes) : "0"}
                    </td>
                    <td className={cn(figureCell, r.lateDays > 0 ? "text-warn" : "text-faint")}>{r.lateDays}</td>
                    <td className={cn(figureCell, "pr-0", r.missedDays > 0 ? "font-semibold text-bad" : "text-faint")}>{r.missedDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={cn(panelClass, "mt-3 flex flex-col gap-3 p-4")}>
            <Eyebrow>Hours worked, day by day</Eyebrow>
            <BarList
              aria-label="Hours worked, day by day"
              rows={data.days
                .filter((d) => d.date <= today)
                .map((d) => ({
                  key: d.date,
                  label: weekdayText(d.date),
                  value: d.workedMinutes,
                  display: d.workedMinutes > 0 ? hoursText(d.workedMinutes) : "0 h",
                  detail: (
                    <span className="pms-num text-2xs text-muted-foreground">
                      {d.present} in{d.rostered > 0 ? ` of ${d.rostered}` : ""}
                      {d.late > 0 ? ` · ${d.late} late` : ""}
                      {d.missing > 0 ? ` · ${d.missing} missed` : ""}
                    </span>
                  ),
                }))}
            />
          </div>
        </>
      )}
    </section>
  );
}
