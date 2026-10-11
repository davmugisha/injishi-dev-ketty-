"use client";

/**
 * My HR · My time: an employee's own clock and shifts (HR module, Phase 5 —
 * first pass, no ADR yet).
 *
 * ONE BUTTON, AND IT ONLY EVER OFFERS THE NEXT THING. Not clocked in: "Clock
 * in". At work: "Clock out", beside how long the shift has run. Finished: no
 * button at all, and the day's total in its place. Somebody arriving at the
 * door with a phone in one hand should not have to read the page to know what
 * to press.
 *
 * THE BUTTON SENDS NOTHING BUT THE PRESS. Which person, which shift and what
 * time it is are all the API's to decide (`ops/my-hr/time`), so the clock on a
 * phone that is ten minutes fast changes nothing, and there is no id here to
 * point at a colleague.
 *
 * Under the clock: this week as seven days, the shifts coming up, and the days
 * already worked. A day HR wrote or corrected says so, with the reason HR gave.
 */

import { CalendarClock, History, LogIn, LogOut, Timer } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import { ActionButton, Badge, EmptyState, LoadFailed, SectionHeading, Skeleton, StatCard } from "../components/ui";
import { useWorkspaceId } from "../data/capability";
import { useClock, useMyTime, type AttendanceEntry, type MyTime as MyTimeData, type MyTimeDay } from "../data/hr-time";
import { TIMEZONE, dayPartsIso, dshortIso } from "../lib/format";
import { usePms } from "../store";
import { DayStatusBadge, Eyebrow, FormError, RowList, ShiftChip, clock, hoursText, panelClass, rowClass, shiftHours, weekdayText } from "./hr-ui";

/** The time, ticking. Read once a second so the clock and the running total move. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** `17:42:08`, the wall clock in Kigali. */
function kigaliTime(ms: number): { clock: string; seconds: string } {
  const text = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(ms));
  return { clock: text.slice(0, 5), seconds: text.slice(6, 8) };
}

/** `Thursday 08 October`, from a stored day. */
function longDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "UTC",
  });
}

export function MyTime() {
  const workspaceId = useWorkspaceId();
  const query = useMyTime(workspaceId);

  if (query.isPending) return <Skeleton height={240} />;
  if (query.isError) {
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load your time. This is on our side.
      </LoadFailed>
    );
  }

  const data = query.data;
  return (
    <>
      <ClockCard data={data} />

      <section aria-label="Your hours at a glance" className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
        <StatCard n={hoursText(data.totals.weekMinutes)} label="Worked this week" />
        <StatCard n={hoursText(data.totals.monthMinutes)} label="Worked this month" />
        <StatCard n={String(data.totals.monthDays)} label="Days worked this month" />
        <StatCard n={String(data.totals.monthLate)} label="Late arrivals this month" />
      </section>

      <section>
        <SectionHeading icon={CalendarClock}>This week</SectionHeading>
        <div className="mt-2.5 grid grid-cols-2 gap-2 @xl:grid-cols-4 @3xl:grid-cols-7">
          {data.week.map((day) => (
            <DayTile key={day.date} day={day} today={data.today} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeading n={data.upcoming.length} icon={Timer}>
          Coming shifts
        </SectionHeading>
        {data.upcoming.length === 0 ? (
          <EmptyState icon={Timer} className="mt-2.5">
            No shifts are written for you in the next two weeks yet.
          </EmptyState>
        ) : (
          <RowList>
            {data.upcoming.map((u, i) => (
              <div key={u.date} className={cn(rowClass(i), "flex flex-wrap items-center gap-3")}>
                <span className="pms-num w-28 shrink-0 text-sm font-semibold text-ink">{weekdayText(u.date)}</span>
                <ShiftChip shift={u.shift} />
                <span className="pms-num basis-full text-2xs text-muted-foreground @xl:flex-1 @xl:basis-0">
                  {hoursText(u.shift.minutes)}
                  {u.shift.overnight ? " · ends the next morning" : ""}
                </span>
                {u.onLeave && <Badge intent="info">You are on leave</Badge>}
              </div>
            ))}
          </RowList>
        )}
      </section>

      <section>
        <SectionHeading n={data.history.length} icon={History}>
          Days worked
        </SectionHeading>
        {data.history.length === 0 ? (
          <EmptyState icon={History} className="mt-2.5">
            Nothing recorded yet. Your days appear here once you clock in.
          </EmptyState>
        ) : (
          <RowList>
            {data.history.map((entry, i) => (
              <div key={entry.id} className={cn(rowClass(i), "flex flex-wrap items-center gap-x-4 gap-y-1.5")}>
                {/* On a phone a row is three lines: the day and its hours, the
                    times, then what the day was like. With room it is one line,
                    and `order` puts the hours back after the times. */}
                <span className="pms-num order-1 min-w-0 flex-1 text-sm font-semibold text-ink @2xl:w-28 @2xl:flex-none">
                  {weekdayText(entry.workDate)}
                </span>
                <span className="order-3 flex basis-full flex-col gap-0.5 @2xl:order-2 @2xl:w-40 @2xl:shrink-0 @2xl:basis-auto">
                  <span className="pms-num text-sm text-ink">
                    {clock(entry.clockInAt)} to {entry.clockOutAt ? clock(entry.clockOutAt) : "now"}
                  </span>
                  <span className="text-2xs text-muted-foreground">{entry.shiftName ?? "No shift that day"}</span>
                </span>
                <span className="pms-num order-2 shrink-0 text-sm font-semibold text-ink @2xl:order-3 @2xl:w-20">
                  {hoursText(entry.workedMinutes)}
                </span>
                <span className="order-4 flex min-w-0 basis-full flex-wrap items-center gap-1.5 @2xl:flex-1 @2xl:basis-0">
                  <EntryBadges entry={entry} />
                </span>
              </div>
            ))}
          </RowList>
        )}
      </section>
    </>
  );
}

/** What a record says beyond its two times. */
function EntryBadges({ entry }: { entry: AttendanceEntry }) {
  return (
    <>
      {!entry.clockOutAt && <Badge intent="ok">At work</Badge>}
      {entry.lateMinutes > 0 ? (
        <Badge intent="warn">{hoursText(entry.lateMinutes)} late</Badge>
      ) : (
        entry.shiftName && <Badge intent="ok">On time</Badge>
      )}
      {entry.leftEarlyMinutes >= 5 && <Badge intent="warn">Left {hoursText(entry.leftEarlyMinutes)} early</Badge>}
      {entry.overtimeMinutes >= 5 && <Badge intent="info">{hoursText(entry.overtimeMinutes)} over</Badge>}
      {entry.source === "manual" && <Badge intent="neutral">Written by HR</Badge>}
      {entry.note && <span className="text-2xs text-muted-foreground">{entry.note}</span>}
    </>
  );
}

/** The clock, today's shift, and the one button. */
function ClockCard({ data }: { data: MyTimeData }) {
  const workspaceId = useWorkspaceId();
  const { toast } = usePms();
  const press = useClock(workspaceId);
  const now = useNow();
  const time = kigaliTime(now);

  const { open, todayEntry, todayShift } = data;
  // Counted on this device between the minute by minute reads, so the total
  // moves with the clock above it; the figure that is KEPT is the server's.
  const runningMinutes = open ? Math.max(0, Math.floor((now - Date.parse(open.clockInAt)) / 60_000)) : 0;
  // Still clocked in on a record that began another day: a night shift, or a
  // clock out that was forgotten.
  const carriedOver = open && open.workDate !== data.today;

  const clockIn = () =>
    press.mutate(
      { direction: "in" },
      {
        onSuccess: (entry) =>
          toast(
            entry.lateMinutes > 0
              ? `Clocked in at ${clock(entry.clockInAt)}, ${hoursText(entry.lateMinutes)} after your shift began`
              : `Clocked in at ${clock(entry.clockInAt)}. Have a good shift.`,
            entry.lateMinutes > 0 ? "warn" : "ok",
          ),
      },
    );
  const clockOut = () =>
    press.mutate(
      { direction: "out" },
      {
        onSuccess: (entry) =>
          toast(`Clocked out at ${entry.clockOutAt ? clock(entry.clockOutAt) : ""}. ${hoursText(entry.workedMinutes)} worked.`, "ok"),
      },
    );

  return (
    <section className={cn(panelClass, "flex flex-col gap-5 p-5 @2xl:flex-row @2xl:items-center")}>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Eyebrow>{longDay(data.today)}</Eyebrow>
        <p className="pms-num flex items-baseline gap-1.5 text-ink" aria-label={`The time is ${time.clock}`}>
          <span className="text-5xl leading-none font-bold tracking-[-1.5px]">{time.clock}</span>
          <span aria-hidden className="text-xl font-semibold text-faint">
            {time.seconds}
          </span>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {todayShift ? (
            <>
              <ShiftChip shift={todayShift} />
              <span className="text-2xs text-muted-foreground">
                Your shift today
                {todayShift.overnight ? ", ending tomorrow morning" : ""}. On time up to {todayShift.graceMinutes} min after{" "}
                {todayShift.startTime}.
              </span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">You are not rostered today. You can still clock in if you are working.</span>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-col items-stretch gap-2.5 @2xl:w-72 @2xl:items-end">
        {open ? (
          <>
            <div className="flex flex-wrap items-center gap-1.5 @2xl:justify-end">
              <Badge intent="ok">
                Clocked in at {clock(open.clockInAt)}
                {carriedOver ? `, ${dshortIso(open.workDate)}` : ""}
              </Badge>
              {open.lateMinutes > 0 && <Badge intent="warn">{hoursText(open.lateMinutes)} late</Badge>}
            </div>
            <p className="pms-num text-sm text-ink2 @2xl:text-right">
              At work for <span className="font-bold text-ink">{hoursText(runningMinutes)}</span>
            </p>
            {open.stale && (
              <p className="text-2xs text-warn @2xl:text-right">
                This has been running a long time. If you forgot to clock out, do it now and ask HR to correct the hours.
              </p>
            )}
            <ActionButton variant="primary" icon={LogOut} pending={press.isPending} onClick={clockOut} style={{ height: 48, paddingInline: 24, fontSize: 16 }}>
              Clock out
            </ActionButton>
          </>
        ) : todayEntry ? (
          <>
            <Badge intent="neutral">Done for today</Badge>
            <p className="pms-num text-sm text-ink2 @2xl:text-right">
              {clock(todayEntry.clockInAt)} to {todayEntry.clockOutAt ? clock(todayEntry.clockOutAt) : ""} ·{" "}
              <span className="font-bold text-ink">{hoursText(todayEntry.workedMinutes)}</span> worked
            </p>
            <p className="text-2xs text-muted-foreground @2xl:text-right">If these times are wrong, ask HR to correct them.</p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground @2xl:text-right">You have not clocked in today.</p>
            <ActionButton
              variant="primary"
              icon={LogIn}
              pending={press.isPending}
              deniedReason={data.canClockIn ? undefined : "You have no employee record here yet"}
              onClick={clockIn}
              style={{ height: 48, paddingInline: 24, fontSize: 16 }}
            >
              Clock in
            </ActionButton>
          </>
        )}
        <FormError error={press.error} />
      </div>
    </section>
  );
}

/** One day of the week: what was planned, and what the clock says happened. */
function DayTile({ day, today }: { day: MyTimeDay; today: string }) {
  const { wd, dd } = dayPartsIso(day.date);
  const isToday = day.date === today;
  return (
    <div
      className={cn(
        "flex min-h-28 flex-col gap-1.5 rounded-card border p-2.5",
        isToday ? "border-accent-text bg-accent-soft" : "border-card-bd bg-card",
        day.date < today && !day.entry && "opacity-70",
      )}
    >
      <span className="flex items-baseline gap-1.5">
        <span className={cn("text-2xs font-bold tracking-[0.05em] uppercase", isToday ? "text-accent-text" : "text-[var(--muted2)]")}>
          {wd}
        </span>
        <span className="pms-num text-sm font-semibold text-ink">{dd}</span>
      </span>
      {day.shift ? (
        <span className="flex flex-col">
          <span className="truncate text-2xs font-semibold text-ink">{day.shift.name}</span>
          <span className="pms-num text-2xs text-muted-foreground">{shiftHours(day.shift)}</span>
        </span>
      ) : (
        <span className="text-2xs text-faint">{day.onLeave ? "Leave" : "No shift"}</span>
      )}
      {day.entry && (
        <span className="pms-num text-2xs text-ink2">
          {clock(day.entry.clockInAt)} to {day.entry.clockOutAt ? clock(day.entry.clockOutAt) : "now"}
        </span>
      )}
      <span className="mt-auto flex flex-wrap gap-1">
        <DayStatusBadge status={day.status} />
        {day.entry && day.entry.lateMinutes > 0 && <Badge intent="warn">Late</Badge>}
      </span>
    </div>
  );
}
