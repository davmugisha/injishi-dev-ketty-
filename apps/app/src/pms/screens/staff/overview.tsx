"use client";

/**
 * Staff · Overview (ADR-058).
 *
 * The other lenses each answer one question well: who is on file, who is
 * rostered, what leave is waiting, what the month costs. Nobody opens sixteen
 * of them each morning to find the three that hold something. This is the one
 * screen that says what needs somebody today and where to go to deal with it.
 *
 * FOUR PARTS, each drawn only for whoever may read what it shows:
 *
 *   today             who is rostered, who is in, who should be and is not,
 *                     who is on leave
 *   waiting on you    every decision sitting in a queue, with its count, each
 *                     a link to the lens that decides it, and what is late on
 *                     a joining or leaving checklist
 *   files to put      people a pay run would leave out or a contract cannot be
 *   right             written for, and contracts and documents about to end
 *   who works here    headcount by job, and the dates an office remembers
 *
 * IT READS NOTHING OF ITS OWN. Every figure comes from a route another lens
 * already calls, through that lens's hook, so each is gated by the permission
 * its route declares and a part the reader may not see is not asked for at
 * all. A count here and the list it links to cannot disagree: they are one
 * read. A zero is not drawn as a zero: a queue with nothing in it is left
 * out, and an Overview with nothing waiting says so in a sentence.
 *
 * IT OPENS ON A SENTENCE. Above the four parts the page greets whoever opened
 * it and says where the day stands in words ("3 of 12 people on today's
 * roster are at work"), with the roster as one bar: at work, finished, not
 * clocked in, due later. A manager who reads nothing else has read the day.
 *
 * NO RANKING OF PEOPLE (index contract 7). "Not clocked in" is a list of who to
 * ring this morning, in shift order; nothing here totals a person's lateness
 * or orders anybody by a figure.
 */

import { ListQuery, type AttendanceRecord, type Employee, type RosterEntry } from "@injishi/contracts";
import { BarList } from "@injishi/ui";
import {
  AlarmClock,
  ArrowLeftRight,
  Building2,
  CalendarDays,
  CalendarOff,
  CalendarPlus,
  Clock,
  Coins,
  FileCheck,
  FileWarning,
  Inbox,
  ListChecks,
  MapPin,
  Receipt,
  Timer,
  UserCheck,
  UserX,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Icon } from "../../components/icon";
import { EmptyState, LoadFailed, SectionHeading, Skeleton } from "../../components/ui";
import { useCapability, useWorkspaceId } from "../../data/capability";
import { useChecklistBoard } from "../../data/checklists";
import { useSessionPerson } from "../../data/housekeeper";
import { useLeaveDashboard } from "../../data/leave";
import { OPS_READ, useMayRead } from "../../data/ops";
import { usePayrollDashboard } from "../../data/payroll";
import { useAttendancePage, useEmployees, useRosterPage } from "../../data/people";
import { useDocuments } from "../../data/people-file";
import { useAttendanceRequestPage, useShiftRequestPage } from "../../data/time";
import { TIMEZONE, addDaysIso, dayPartsIso, daysBetweenIso, dshortIso, fmt, todayIso } from "../../lib/format";
import { workspaceBase } from "../../lib/nav";
import { Avatar, Figure, Split } from "./staff-look";
import { RowList, clock, rowClass } from "./staff-ui";

/** How far ahead a contract's or a document's end is worth saying. */
const ENDING_WITHIN_DAYS = 60;
/** How far ahead a birthday or a work anniversary is worth saying. */
const DATES_WITHIN_DAYS = 14;
/** A shift this many minutes old with nobody clocked in is somebody to ring. */
const CHASE_AFTER_MINUTES = 15;

/** The word for a count, without the count: the row's bubble already says how many. */
const noun = (n: number, one: string, many = `${one}s`): string => (n === 1 ? one : many);
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${noun(n, one, many)}`;

/** Up to three names, then how many more. */
function names(people: readonly { displayName: string }[]): string {
  const shown = people.slice(0, 3).map((p) => p.displayName);
  return people.length > 3 ? `${shown.join(", ")} and ${people.length - 3} more` : shown.join(", ");
}

/** How many of a list's rows are at a status, from the counts the list route sends with any page. */
function countAt(page: { statusCounts?: { value: string; count: number }[] } | undefined, status: string): number {
  return page?.statusCounts?.find((c) => c.value === status)?.count ?? 0;
}

/** Days until the next time a date's month and day come round; 0 is today. */
function daysUntilNext(date: string, today: string): number {
  const year = Number(today.slice(0, 4));
  for (const y of [year, year + 1]) {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    // Somebody born on 29 February is a year older on the 28th most years.
    const monthDay = date.slice(5) === "02-29" && !leap ? "02-28" : date.slice(5);
    const days = daysBetweenIso(today, `${y}-${monthDay}`);
    if (days >= 0) return days;
  }
  return Number.POSITIVE_INFINITY;
}

const whenText = (days: number): string => (days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`);

/** One queue with something in it: how many, what, and the lens that deals with it. */
interface Waiting {
  key: string;
  n: number;
  label: string;
  hint?: string;
  href: string;
}

/** The mark of each queue, by its key: the same mark wherever that kind of work is named. */
const MARK_OF: Record<string, LucideIcon> = {
  leave: CalendarDays,
  allocations: CalendarPlus,
  shifts: ArrowLeftRight,
  time: Clock,
  validate: MapPin,
  overtime: Timer,
  documents: FileCheck,
  "checklist-late": ListChecks,
  "checklist-unstarted": ListChecks,
  claims: Receipt,
  draft: Wallet,
  unpaid: Coins,
  "no-contract": UserX,
  details: FileWarning,
  "no-branch": Building2,
};

/** A queue to decide is the product's green; a file with something wrong is a warning. */
function WaitingRow({ row, index, wrong }: { row: Waiting; index: number; wrong?: boolean }) {
  const Mark = MARK_OF[row.key] ?? Inbox;
  return (
    <Link href={row.href} className={cn(rowClass(index), "group flex items-center gap-3 no-underline hover:bg-hover")}>
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", wrong ? "bg-warn-bg text-warn" : "bg-accent-soft text-accent-text")}>
        <Mark aria-hidden className="size-4.5" strokeWidth={1.9} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold text-ink">{row.label}</span>
        {row.hint && <span className="truncate text-2xs text-muted-foreground">{row.hint}</span>}
      </span>
      <span className={cn("pms-num grid h-6 min-w-6 shrink-0 place-items-center rounded-full px-2 text-xs font-bold", wrong ? "bg-warn-bg text-warn" : "bg-[var(--accent)] text-[var(--accent-ink)]")}>
        {row.n}
      </span>
      <span aria-hidden className="text-faint transition-transform duration-quick group-hover:translate-x-0.5">
        <Icon name="chevron-right" size={16} />
      </span>
    </Link>
  );
}

/** A person on one of the day's lists: who, and the one fact that put them there. */
function PersonRow({ index, name, detail, href }: { index: number; name: string; detail: ReactNode; href?: string }) {
  const body = (
    <>
      <Avatar name={name} size={28} />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{name}</span>
      <span className="pms-num shrink-0 text-2xs text-muted-foreground">{detail}</span>
    </>
  );
  const className = cn(rowClass(index), "flex items-center gap-2.5");
  return href ? (
    <Link href={href} className={cn(className, "no-underline hover:bg-hover")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function Part({ title, n, children }: { title: string; n?: number; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-0">
      <SectionHeading n={n}>{title}</SectionHeading>
      {children}
    </section>
  );
}

/** Who is rostered now and has no record today: the people to ring, in shift order. */
function notClockedIn(roster: readonly RosterEntry[], sheet: readonly AttendanceRecord[], today: string, now: number): RosterEntry[] {
  const recorded = new Set(
    sheet.filter((r) => r.status !== "superseded" && (r.workDate === today || r.status === "open")).map((r) => r.employee.employeeId),
  );
  const seen = new Set<string>();
  return roster
    .filter((e) => e.status === "scheduled" && e.publishedAt !== null)
    .filter((e) => Date.parse(e.startsAt) + CHASE_AFTER_MINUTES * 60_000 <= now)
    .filter((e) => !recorded.has(e.employee.employeeId))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    // Somebody on two shifts today is one person to ring.
    .filter((e) => (seen.has(e.employee.employeeId) ? false : (seen.add(e.employee.employeeId), true)));
}

export function Overview() {
  const workspaceId = useWorkspaceId();
  const { can } = useCapability();
  const base = `${workspaceBase(workspaceId)}/staff`;
  const today = todayIso();
  const month = today.slice(0, 7);

  // What this reader may read. A hook asks nothing it may not; these say which
  // parts to draw, so a part is absent rather than an empty box.
  const mayRoster = useMayRead(OPS_READ.roster);
  const maySheet = useMayRead(OPS_READ.attendance);
  const mayLeave = useMayRead(OPS_READ.leaveViews);
  const mayPay = useMayRead(OPS_READ.payrollOverview);
  // Whoever drafts the month reads its totals; the payslips, claims and loans
  // behind them are `payroll.run`'s (ADR-069 D-e). A link goes no further than
  // its reader may.
  const mayRunPay = useMayRead(OPS_READ.payroll);
  const mayFiles = useMayRead(OPS_READ.employees);
  const mayDocuments = useMayRead(OPS_READ.documents);
  // Work figures are for whoever acts on them (058-time AC-TM13).
  const mayFigures = can("attendance.approve");

  const roster = useRosterPage(workspaceId, ListQuery.parse({ filters: [{ field: "workDate", op: "eq", value: today }], pageSize: 100 }));
  const sheet = useAttendancePage(workspaceId, ListQuery.parse({ pageSize: 100 }));
  const leave = useLeaveDashboard(workspaceId);
  const pay = usePayrollDashboard(workspaceId);
  const shiftAsks = useShiftRequestPage(workspaceId, ListQuery.parse({ pageSize: 10 }));
  const timeAsks = useAttendanceRequestPage(workspaceId, ListQuery.parse({ pageSize: 10 }));
  // A month back: with no day named the attendance route answers for today alone.
  const since = { field: "workDate", op: "gte" as const, value: addDaysIso(today, -31) };
  const toValidate = useAttendancePage(
    mayFigures ? workspaceId : null,
    ListQuery.parse({ filters: [since, { field: "validated", op: "eq", value: false }, { field: "status", op: "eq", value: "closed" }], pageSize: 10 }),
  );
  const overtime = useAttendancePage(
    mayFigures ? workspaceId : null,
    ListQuery.parse({ filters: [since, { field: "overtimePending", op: "eq", value: true }], pageSize: 10 }),
  );
  const files = useEmployees(workspaceId, "active");
  const documents = useDocuments(workspaceId, "all");
  const checklists = useChecklistBoard(workspaceId);

  // --- Today ---------------------------------------------------------------------
  const entries = (roster.data?.items ?? []).filter((e) => e.status === "scheduled" && e.publishedAt !== null);
  const rostered = new Set(entries.map((e) => e.employee.employeeId)).size;
  const records = sheet.data?.items ?? [];
  const inNow = records.filter((r) => r.status === "open").length;
  const missing = maySheet && mayRoster ? notClockedIn(roster.data?.items ?? [], records, today, Date.now()) : [];
  const onLeave = leave.data?.onLeaveToday ?? [];
  const leaveSoon = (leave.data?.startingThisWeek ?? []).filter((l) => l.startsOn > today);
  // The roster as one whole: each person on it is in exactly one of four places.
  const openIds = new Set(records.filter((r) => r.status === "open").map((r) => r.employee.employeeId));
  const doneIds = new Set(records.filter((r) => r.status === "closed" && r.workDate === today).map((r) => r.employee.employeeId));
  const missingIds = new Set(missing.map((e) => e.employee.employeeId));
  const rosteredIds = [...new Set(entries.map((e) => e.employee.employeeId))];
  const atWork = rosteredIds.filter((id) => openIds.has(id)).length;
  const finished = rosteredIds.filter((id) => !openIds.has(id) && doneIds.has(id)).length;
  const notIn = rosteredIds.filter((id) => !openIds.has(id) && !doneIds.has(id) && missingIds.has(id)).length;
  const dueLater = rosteredIds.length - atWork - finished - notIn;
  const session = useSessionPerson();

  // --- Waiting on you -------------------------------------------------------------
  const waiting: Waiting[] = [];
  const w = leave.data?.waiting;
  if (w && w.requests > 0) {
    waiting.push({
      key: "leave",
      n: w.requests,
      label: `${noun(w.requests, "Leave request")} to decide`,
      hint: [w.routedToMe > 0 ? `${w.routedToMe} routed to you` : null, w.atStepTwo > 0 ? `${w.atStepTwo} at the second step` : null].filter(Boolean).join(", ") || undefined,
      href: `${base}/leave`,
    });
  }
  if (w && w.allocations > 0) {
    waiting.push({ key: "allocations", n: w.allocations, label: `${noun(w.allocations, "Ask")} for extra days`, href: `${base}/leave/allocations` });
  }
  const shiftN = countAt(shiftAsks.data, "requested");
  if (shiftN > 0) {
    waiting.push({ key: "shifts", n: shiftN, label: `${noun(shiftN, "Shift or swap request")} to decide`, href: `${base}/shift-requests` });
  }
  const timeN = countAt(timeAsks.data, "requested");
  if (timeN > 0) {
    waiting.push({
      key: "time",
      n: timeN,
      label: `${noun(timeN, "Request")} to put a day's times right`,
      hint: "Somebody forgot to clock, or says the times are wrong",
      href: `${base}/attendance-requests`,
    });
  }
  const validateN = toValidate.data?.total ?? 0;
  if (validateN > 0) {
    waiting.push({
      key: "validate",
      n: validateN,
      label: `${noun(validateN, "Clock in")} to validate`,
      hint: "Made from a phone or a browser the branch could not place, or closed by the sweep",
      href: `${base}/attendance`,
    });
  }
  const overtimeN = overtime.data?.total ?? 0;
  if (overtimeN > 0) {
    waiting.push({
      key: "overtime",
      n: overtimeN,
      label: `${noun(overtimeN, "Day")} of overtime to decide`,
      hint: "Unpaid until somebody approves it, in full or in part",
      href: `${base}/attendance`,
    });
  }
  const submitted = (documents.data?.documents ?? []).filter((d) => d.status === "submitted");
  if (submitted.length > 0) {
    waiting.push({
      key: "documents",
      n: submitted.length,
      label: `${noun(submitted.length, "Document")} handed in, to check`,
      hint: names(submitted.map((d) => d.employee)),
      href: `${base}/documents`,
    });
  }
  // Joining and leaving: what is late on a checklist in hand, and who has none.
  const behind = (checklists.data?.checklists ?? []).filter((c) => c.overdueCount > 0);
  const lateTasks = behind.reduce((sum, c) => sum + c.overdueCount, 0);
  if (lateTasks > 0) {
    waiting.push({
      key: "checklist-late",
      n: lateTasks,
      label: `${noun(lateTasks, "Task")} late on a joining or leaving checklist`,
      hint: names(behind.map((c) => c.employee)),
      href: `${base}/checklists`,
    });
  }
  const unstarted = checklists.data?.unstarted ?? [];
  if (unstarted.length > 0) {
    waiting.push({
      key: "checklist-unstarted",
      n: unstarted.length,
      label: `${noun(unstarted.length, "Person", "People")} joined or leaving with no checklist started`,
      hint: names(unstarted.map((u) => u.employee)),
      href: `${base}/checklists`,
    });
  }
  const thisMonth = pay.data?.months.find((m) => m.period === month);
  if (pay.data && pay.data.claimsWaiting > 0) {
    waiting.push({ key: "claims", n: pay.data.claimsWaiting, label: `${noun(pay.data.claimsWaiting, "Expense claim")} to decide`, href: mayRunPay ? `${base}/payroll/claims` : `${base}/payroll` });
  }
  if (thisMonth?.status === "draft") {
    waiting.push({
      key: "draft",
      n: thisMonth.headcount,
      label: `${noun(thisMonth.headcount, "Payslip")} in this month's draft pay run`,
      hint: `Net ${fmt(thisMonth.netRwf)} so far. Nothing is paid until it is confirmed`,
      href: `${base}/payroll`,
    });
  }
  if (pay.data && pay.data.unpaidPayslips > 0) {
    waiting.push({
      key: "unpaid",
      n: pay.data.unpaidPayslips,
      label: `${noun(pay.data.unpaidPayslips, "Confirmed payslip")} not yet paid`,
      hint: mayRunPay ? "Build the bank or MoMo file, then mark them paid" : "Whoever runs payroll marks them paid",
      href: mayRunPay ? `${base}/payroll/payslips` : `${base}/payroll`,
    });
  }

  // --- Files to put right ---------------------------------------------------------
  const people: Employee[] = files.data ?? [];
  const lacking = people.filter((e) => e.detailsMissing.length > 0);
  const noContract = people.filter((e) => e.currentContract === null);
  const noBranch = people.filter((e) => e.workPropertyId === null);
  const ending = people
    .filter((e) => e.currentContract?.endsOn && daysBetweenIso(today, e.currentContract.endsOn) >= 0 && daysBetweenIso(today, e.currentContract.endsOn) <= ENDING_WITHIN_DAYS)
    .sort((a, b) => (a.currentContract?.endsOn ?? "").localeCompare(b.currentContract?.endsOn ?? ""));
  const lapsing = (documents.data?.documents ?? [])
    .filter((d) => d.status === "approved" && d.expiresOn !== null && daysBetweenIso(today, d.expiresOn) <= ENDING_WITHIN_DAYS)
    .sort((a, b) => (a.expiresOn ?? "").localeCompare(b.expiresOn ?? ""));
  const fileOf = (id: string) => `${base}/${id}`;
  const toFix: Waiting[] = [];
  if (noContract.length > 0) {
    toFix.push({
      key: "no-contract",
      n: noContract.length,
      label: `${noun(noContract.length, "Person", "People")} with no contract`,
      hint: `A pay run leaves them out: ${names(noContract)}`,
      href: noContract.length === 1 ? `${fileOf(noContract[0].id)}/contracts` : base,
    });
  }
  if (lacking.length > 0) {
    toFix.push({
      key: "details",
      n: lacking.length,
      label: `${noun(lacking.length, "File", "Files")} lacking details a contract needs`,
      hint: names(lacking),
      href: lacking.length === 1 ? fileOf(lacking[0].id) : base,
    });
  }
  if (noBranch.length > 0) {
    toFix.push({
      key: "no-branch",
      n: noBranch.length,
      label: `${noun(noBranch.length, "Person", "People")} with no branch`,
      hint: `They cannot be rostered: ${names(noBranch)}`,
      href: noBranch.length === 1 ? fileOf(noBranch[0].id) : base,
    });
  }

  // --- Who works here -------------------------------------------------------------
  const byJob = new Map<string, number>();
  for (const e of people) byJob.set(e.jobPositionTitle ?? "No position yet", (byJob.get(e.jobPositionTitle ?? "No position yet") ?? 0) + 1);
  const jobs = [...byJob.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const dates: { key: string; name: string; what: string; days: number; href: string }[] = [];
  for (const e of people) {
    const years = Number(today.slice(0, 4)) - Number(e.hiredOn.slice(0, 4));
    const toAnniversary = daysUntilNext(e.hiredOn, today);
    // A first day is not an anniversary; the year it turns is the one counted.
    const turning = toAnniversary === 0 || e.hiredOn.slice(5) > today.slice(5) ? years : years + 1;
    if (toAnniversary <= DATES_WITHIN_DAYS && turning >= 1) {
      dates.push({ key: `${e.id}:work`, name: e.displayName, what: `${plural(turning, "year")} here ${whenText(toAnniversary)}`, days: toAnniversary, href: fileOf(e.id) });
    }
    // A date of birth is on the full view only (AC-P2): a basic reader sees no birthdays.
    if (e.view === "full" && e.dateOfBirth) {
      const toBirthday = daysUntilNext(e.dateOfBirth, today);
      if (toBirthday <= DATES_WITHIN_DAYS) {
        dates.push({ key: `${e.id}:born`, name: e.displayName, what: `birthday ${whenText(toBirthday)}`, days: toBirthday, href: fileOf(e.id) });
      }
    }
    const daysHere = daysBetweenIso(e.hiredOn, today);
    if (daysHere >= 0 && daysHere <= 30) {
      dates.push({ key: `${e.id}:new`, name: e.displayName, what: daysHere === 0 ? "starts today" : `started ${dshortIso(e.hiredOn)}`, days: -1, href: fileOf(e.id) });
    }
  }
  dates.sort((a, b) => a.days - b.days || a.name.localeCompare(b.name));

  // The reads this reader makes, for one honest loading and failure state.
  const reads = [
    mayRoster ? roster : null,
    maySheet ? sheet : null,
    mayLeave ? leave : null,
    mayPay ? pay : null,
    mayFiles ? files : null,
  ].filter((q): q is NonNullable<typeof q> => q !== null);
  const loading = reads.some((q) => q.isPending);
  const failed = reads.filter((q) => q.isError);

  if (loading) {
    return (
      <div className="flex max-w-page flex-col gap-3 pt-4" aria-busy="true" aria-label="Loading">
        <Skeleton height={72} />
        <Skeleton height={180} delay={60} />
        <Skeleton height={140} delay={120} />
      </div>
    );
  }

  const showToday = mayRoster || maySheet || mayLeave;
  const quietDay = missing.length === 0 && onLeave.length === 0 && leaveSoon.length === 0;

  // The greeting: the hour in Kigali, and the first name on the session when it has one.
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, hour: "numeric", hour12: false }).format(new Date()));
  const firstName = session.data?.name?.trim().split(/\s+/)[0];
  const greeting = `Good ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}${firstName ? `, ${firstName}` : ""}`;
  const day = dayPartsIso(today);
  const toLookAt = waiting.length + toFix.length;
  const where =
    mayRoster && maySheet
      ? rostered === 0
        ? "Nobody is on today's published roster."
        : `${atWork} of ${plural(rostered, "person", "people")} on today's roster ${atWork === 1 ? "is" : "are"} at work.`
      : "";
  const next =
    toLookAt === 0 ? "Nothing is waiting on you." : `${toLookAt === 1 ? "One thing is" : `${toLookAt} things are`} waiting on you below.`;

  return (
    <div className="@container relative flex max-w-page flex-col gap-6 pt-4">
      <section
        aria-label="Today at a glance"
        className="flex flex-col gap-4 rounded-card border border-card-bd bg-card px-5 py-5"
        style={{ backgroundImage: "linear-gradient(135deg, color-mix(in oklab, var(--accent) 9%, transparent), transparent 55%)" }}
      >
        <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
          <span className="flex min-w-64 flex-1 flex-col gap-1">
            <h2 className="text-xl font-bold tracking-[-0.3px] text-ink">{greeting}</h2>
            <span className="text-sm text-ink2">
              {where} {next}
            </span>
          </span>
          <span className="pms-num rounded-full border border-card-bd bg-card px-3 py-1 text-xs font-semibold text-ink2">
            {day.wd} {day.dd} {day.mon}
          </span>
        </div>
        {mayRoster && maySheet && rostered > 0 && (
          <Split
            label="Today's roster"
            parts={[
              { key: "in", label: "At work", n: atWork, tone: "ok" },
              { key: "done", label: "Finished for the day", n: finished, tone: "neutral" },
              { key: "missing", label: "Not clocked in", n: notIn, tone: "warn" },
              { key: "later", label: "Due later", n: dueLater, tone: "info" },
            ]}
          />
        )}
      </section>

      {failed.length > 0 && (
        <LoadFailed
          onRetry={() => failed.forEach((q) => void q.refetch())}
          retrying={failed.some((q) => q.isFetching)}
        >
          Part of this page did not load, so a count below may be missing rather than zero. Nothing is lost. Try again.
        </LoadFailed>
      )}

      <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
        {maySheet && (
          <Figure
            icon={UserCheck}
            n={String(inNow)}
            label="At work now"
            hint={mayRoster ? `of ${rostered} on today's roster` : undefined}
            tone={inNow > 0 ? "ok" : "neutral"}
            href={`${base}/attendance`}
          />
        )}
        {maySheet && mayRoster && (
          <Figure
            icon={AlarmClock}
            n={String(missing.length)}
            label="Not clocked in"
            hint={missing.length === 0 ? "Everybody due so far is in" : "Their shift has started"}
            tone={missing.length > 0 ? "warn" : "neutral"}
            href={`${base}/attendance`}
          />
        )}
        {mayLeave && (
          <Figure
            icon={CalendarOff}
            n={String(onLeave.length)}
            label="On leave today"
            hint={leaveSoon.length > 0 ? `${leaveSoon.length} more this week` : undefined}
            tone={onLeave.length > 0 ? "info" : "neutral"}
            href={`${base}/leave`}
          />
        )}
        {mayPay && thisMonth && (
          <Figure
            icon={Wallet}
            n={fmt(thisMonth.netRwf)}
            label="Net pay this month"
            hint={`${thisMonth.status === "draft" ? "Draft, " : ""}${plural(thisMonth.headcount, "payslip")}`}
            href={`${base}/payroll`}
          />
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 @3xl:grid-cols-2">
        <Part title="Waiting on you">
          {waiting.length === 0 ? (
            <EmptyState className="mt-2.5">
              Nothing is waiting on you: no request to decide, no clock in to validate, no pay to confirm.
            </EmptyState>
          ) : (
            <RowList>
              {waiting.map((row, index) => (
                <WaitingRow key={row.key} row={row} index={index} />
              ))}
            </RowList>
          )}
        </Part>

        {showToday && (
          <Part title={`Today, ${dshortIso(today)}`}>
            {quietDay ? (
              <EmptyState className="mt-2.5">
                {rostered === 0 && mayRoster
                  ? "Nobody is on today's published roster."
                  : "Everybody due in so far has clocked in, and nobody is on leave."}
              </EmptyState>
            ) : (
              <>
                {missing.length > 0 && (
                  <RowList>
                    <div className={cn(rowClass(0), "flex items-baseline justify-between gap-3")}>
                      <span className="text-2xs font-bold tracking-[0.08em] uppercase text-[var(--muted2)]">Not clocked in</span>
                      <Link href={`${base}/attendance`} className="text-2xs font-semibold text-accent-text underline-offset-2 hover:underline">
                        Open the sheet
                      </Link>
                    </div>
                    {missing.map((e, index) => (
                      <PersonRow
                        key={e.id}
                        index={index + 1}
                        name={e.employee.displayName}
                        detail={`${e.shiftName}, ${clock(e.startsAt)} to ${clock(e.endsAt)}`}
                      />
                    ))}
                  </RowList>
                )}
                {(onLeave.length > 0 || leaveSoon.length > 0) && (
                  <RowList>
                    <div className={cn(rowClass(0), "text-2xs font-bold tracking-[0.08em] uppercase text-[var(--muted2)]")}>On leave</div>
                    {onLeave.map((l, index) => (
                      <PersonRow
                        key={l.requestId}
                        index={index + 1}
                        name={l.employee.displayName}
                        detail={`${l.leaveTypeName}, back ${dshortIso(addDaysIso(l.endsOn, 1))}`}
                      />
                    ))}
                    {leaveSoon.map((l, index) => (
                      <PersonRow
                        key={l.requestId}
                        index={onLeave.length + index + 1}
                        name={l.employee.displayName}
                        detail={`${l.leaveTypeName}, from ${dshortIso(l.startsOn)} to ${dshortIso(l.endsOn)}`}
                      />
                    ))}
                  </RowList>
                )}
              </>
            )}
          </Part>
        )}
      </div>

      {mayFiles && (
        <div className="grid grid-cols-1 items-start gap-6 @3xl:grid-cols-2">
          <Part title="Files to put right" n={toFix.length + ending.length + lapsing.length || undefined}>
            {toFix.length + ending.length + lapsing.length === 0 ? (
              <EmptyState className="mt-2.5">
                Every file has what a contract needs, everybody has a contract, and nothing ends in the next two months.
              </EmptyState>
            ) : (
              <RowList>
                {toFix.map((row, index) => (
                  <WaitingRow key={row.key} row={row} index={index} wrong />
                ))}
                {ending.map((e, index) => (
                  <PersonRow
                    key={e.id}
                    index={toFix.length + index}
                    name={e.displayName}
                    detail={`contract ends ${dshortIso(e.currentContract?.endsOn ?? "")}`}
                    href={`${fileOf(e.id)}/contracts`}
                  />
                ))}
                {mayDocuments &&
                  lapsing.map((d, index) => (
                    <PersonRow
                      key={d.id}
                      index={toFix.length + ending.length + index}
                      name={d.employee.displayName}
                      detail={`${d.title} ${d.expired ? "expired" : "expires"} ${dshortIso(d.expiresOn ?? "")}`}
                      href={`${fileOf(d.employee.employeeId)}/documents`}
                    />
                  ))}
              </RowList>
            )}
          </Part>

          <Part title="Who works here" n={people.length}>
            {people.length === 0 ? (
              <EmptyState className="mt-2.5">Nobody is on file yet. Put the first person on file under Employees.</EmptyState>
            ) : (
              <div className="mt-2.5 flex flex-col gap-4 rounded-card border border-card-bd bg-card px-[18px] py-4">
                <BarList
                  aria-label="People by job"
                  rows={jobs.map(([job, n]) => ({ key: job, label: job, value: n, display: String(n) }))}
                />
                {dates.length > 0 && (
                  <ul aria-label="Dates to remember" className="flex flex-col gap-1.5 border-t border-line pt-3">
                    {dates.slice(0, 6).map((d) => (
                      <li key={d.key} className="flex items-baseline gap-2 text-sm">
                        <Link href={d.href} className="font-semibold text-ink underline-offset-2 hover:underline">
                          {d.name}
                        </Link>
                        <span className="text-2xs text-muted-foreground">{d.what}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Part>
        </div>
      )}
    </div>
  );
}
