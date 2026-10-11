"use client";

/**
 * HR · Overview: what needs somebody today (HR module — first pass, no ADR
 * yet).
 *
 * The other tabs are each one job: the roster, the clock, tasks, leave, pay. This is
 * the page HR lands on, and it answers the question they arrive with — "is
 * there anything I need to do?" — before they go looking. So it holds no
 * controls of its own: every line here is a count and a link to the tab where
 * the thing is done. A second place to approve leave would be a second place
 * for the two to disagree.
 *
 * Pay is the owner's (`team.manage`). A manager sees the same page without the
 * pay figures rather than with refusals in their place: the payroll hooks wait
 * on that permission and simply never ask.
 */

import { BarList } from "@injishi/ui";
import { ArrowRight, CalendarDays, CircleAlert, CircleCheck, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Badge, EmptyState, LoadFailed, SectionHeading, Skeleton, StatCard } from "../components/ui";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useAttendanceBoard, useRosterWeek } from "../data/hr-time";
import {
  useChecklistProgress,
  useEmployees,
  useLeaveRequests,
  usePayrollCost,
  usePayrollRuns,
  useStaffCompensation,
} from "../data/ops";
import { addDaysIso, dshortIso, fmt } from "../lib/format";
import { workspaceBase } from "../lib/nav";
import { RowList, panelClass, rowClass } from "./hr-ui";

const LEAVE_LABEL: Record<string, string> = {
  annual: "Annual leave",
  sick: "Sick leave",
  unpaid: "Unpaid leave",
  other: "Other leave",
};

/** One thing waiting on HR: what it is, and the tab where it is dealt with. */
interface Todo {
  key: string;
  href: string;
  action: string;
  body: ReactNode;
}

export function HrOverview() {
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const base = `${workspaceBase(workspaceId)}/hr`;

  const employees = useEmployees(workspaceId);
  const leave = useLeaveRequests(workspaceId);
  const progress = useChecklistProgress(workspaceId);
  // Owner only. For anybody else these never fetch, and the page leaves pay out.
  const seesPay = can("team.manage");
  const compensation = useStaffCompensation(workspaceId);
  const runs = usePayrollRuns(workspaceId);
  const cost = usePayrollCost(workspaceId);
  // Today on the clock, and whether next week has been written. Neither holds
  // the page up: their lines simply appear when the answers do.
  const attendance = useAttendanceBoard(workspaceId, null);
  const nextWeek = useRosterWeek(workspaceId, attendance.data ? addDaysIso(attendance.data.today, 7) : null);

  if (!can("employee.manage")) {
    return <EmptyState style={{ padding: 26, fontSize: 13.5 }}>{reasonFor("employee.manage")}</EmptyState>;
  }

  if (employees.isPending || leave.isPending) {
    return (
      <div className="pms-enter flex max-w-page flex-col gap-4">
        <Skeleton height={84} />
        <Skeleton height={200} delay={60} />
      </div>
    );
  }

  if (employees.isError || leave.isError) {
    return (
      <LoadFailed
        onRetry={() => {
          void employees.refetch();
          void leave.refetch();
        }}
        retrying={employees.isFetching || leave.isFetching}
      >
        We couldn&apos;t load the HR overview. This is on our side.
      </LoadFailed>
    );
  }

  const staff = employees.data?.employees ?? [];
  const requests = leave.data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);

  // A person is their account; somebody with no account is their own record.
  const people = new Set(staff.map((e) => e.userId ?? e.departmentMemberId)).size;
  const waiting = requests.filter((r) => r.status === "pending");
  const awayNow = requests.filter((r) => r.status === "approved" && r.startDate <= today && today <= r.endDate);
  const awayNames = awayNow.map((r) => r.name ?? "Unknown").filter((n, i, all) => all.indexOf(n) === i);
  const awaySoon = requests
    .filter((r) => r.status !== "rejected" && r.endDate >= today && r.startDate <= soon)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const overdue = (progress.data ?? []).filter((p) => p.overdue > 0);
  const overdueTasks = overdue.reduce((n, p) => n + p.overdue, 0);
  const noTitle = staff.filter((e) => !e.jobTitle).length;
  const noSalary = (compensation.data ?? []).filter((m) => m.baseSalaryRwf <= 0).length;

  const thisMonth = today.slice(0, 7);
  const run = (runs.data ?? []).find((r) => r.periodEnd.slice(0, 7) === thisMonth);
  const monthCost = (cost.data ?? [])
    .filter((r) => r.periodEnd.slice(0, 7) === thisMonth)
    .reduce((n, r) => n + r.grossRwf + r.employerRssbRwf, 0);
  const monthName = new Date().toLocaleDateString(undefined, { month: "long" });
  const runState = run ? (run.status === "paid" ? "paid" : run.status === "approved" ? "approved" : "a draft") : "not run yet";

  const byDepartment = new Map<string, number>();
  for (const e of staff) {
    const name = e.departmentName ?? "No department";
    byDepartment.set(name, (byDepartment.get(name) ?? 0) + 1);
  }
  const departments = [...byDepartment.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const clocked = attendance.data?.summary;
  const forgotten = (attendance.data?.rows ?? []).filter((r) => r.entry?.stale).length;
  // Only once the answer is for NEXT week: until today is known the hook reads this one.
  const nextWeekEmpty =
    attendance.data !== undefined &&
    nextWeek.data !== undefined &&
    nextWeek.data.from > attendance.data.today &&
    nextWeek.data.assignments.length === 0 &&
    nextWeek.data.shifts.some((shift) => shift.isActive);

  const todos: Todo[] = [];
  if (clocked && clocked.missing > 0) {
    todos.push({
      key: "missing",
      href: `${base}/attendance`,
      action: "See who",
      body: (
        <>
          <strong>{clocked.missing}</strong> {clocked.missing === 1 ? "person has" : "people have"} not clocked in for a shift
          that has started
        </>
      ),
    });
  }
  if (forgotten > 0) {
    todos.push({
      key: "forgotten",
      href: `${base}/attendance`,
      action: "Correct",
      body: (
        <>
          <strong>{forgotten}</strong> {forgotten === 1 ? "person looks" : "people look"} to have forgotten to clock out
        </>
      ),
    });
  }
  if (nextWeekEmpty) {
    todos.push({
      key: "roster",
      href: `${base}/roster`,
      action: "Write it",
      body: <>Next week has no roster yet</>,
    });
  }
  if (waiting.length > 0) {
    todos.push({
      key: "leave",
      href: `${base}/leave`,
      action: "Decide",
      body: (
        <>
          <strong>{waiting.length}</strong> leave {waiting.length === 1 ? "request is" : "requests are"} waiting for a decision
        </>
      ),
    });
  }
  if (overdueTasks > 0) {
    todos.push({
      key: "tasks",
      href: `${base}/checklists`,
      action: "See tasks",
      body: (
        <>
          <strong>{overdueTasks}</strong> {overdueTasks === 1 ? "task is" : "tasks are"} overdue across {overdue.length}{" "}
          {overdue.length === 1 ? "person" : "people"}
        </>
      ),
    });
  }
  if (seesPay && run?.status === "draft") {
    todos.push({
      key: "draft",
      href: `${base}/payroll`,
      action: "Review",
      body: <>{monthName}&apos;s payroll is a draft and has not been approved</>,
    });
  }
  if (seesPay && runs.data && !run && staff.length > 0) {
    todos.push({
      key: "run",
      href: `${base}/payroll`,
      action: "Run payroll",
      body: <>Payroll has not been run for {monthName}</>,
    });
  }
  if (seesPay && noSalary > 0) {
    todos.push({
      key: "salary",
      href: `${base}/payroll`,
      action: "Set salary",
      body: (
        <>
          <strong>{noSalary}</strong> {noSalary === 1 ? "person has" : "people have"} no salary set
        </>
      ),
    });
  }
  if (noTitle > 0) {
    todos.push({
      key: "title",
      href: `${base}/employees`,
      action: "Set title",
      body: (
        <>
          <strong>{noTitle}</strong> {noTitle === 1 ? "person has" : "people have"} no job title
        </>
      ),
    });
  }

  return (
    <div className="pms-enter relative flex max-w-page flex-col gap-6">
      {/* A figure is a way in: each tile opens the tab its number comes from. */}
      <section aria-label="HR at a glance" className="flex flex-col gap-3">
        {/* Five tiles share one row; a sixth, the owner's, makes two rows of three. */}
        <div className={cn("grid gap-3 sm:grid-cols-2", seesPay ? "lg:grid-cols-3" : "lg:grid-cols-5")}>
          <Link href={`${base}/employees`} className="no-underline">
            <StatCard n={String(people)} label={`People, in ${departments.length} ${departments.length === 1 ? "department" : "departments"}`} />
          </Link>
          <Link href={`${base}/attendance`} className="no-underline">
            <StatCard
              n={clocked ? String(clocked.working) : "—"}
              label={clocked ? `At work now, ${clocked.rostered} rostered today` : "At work now"}
            />
          </Link>
          <Link href={`${base}/leave`} className="no-underline">
            <StatCard n={String(awayNames.length)} label="Away today" />
          </Link>
          <Link href={`${base}/leave`} className="no-underline">
            <StatCard n={String(waiting.length)} label="Leave to decide" />
          </Link>
          <Link href={`${base}/checklists`} className="no-underline">
            <StatCard n={String(overdueTasks)} label="Overdue tasks" />
          </Link>
          {seesPay && (
            <Link href={`${base}/payroll`} className="no-underline">
              <StatCard n={monthCost > 0 ? fmt(monthCost) : "—"} label={`Staff cost, ${monthName}: ${runState}`} />
            </Link>
          )}
        </div>
        {awayNames.length > 0 && <p className="text-sm text-ink2">Away today: {awayNames.join(", ")}.</p>}
      </section>

      <section>
        <SectionHeading n={todos.length} icon={CircleAlert}>
          Needs attention
        </SectionHeading>
        {todos.length === 0 ? (
          <EmptyState icon={CircleCheck} className="mt-2.5">
            Nothing needs you right now.
          </EmptyState>
        ) : (
          <RowList>
            {todos.map((todo, i) => (
              <Link
                key={todo.key}
                href={todo.href}
                className={cn(rowClass(i), "flex items-center gap-3 no-underline hover:bg-hover")}
              >
                <span aria-hidden className="size-2 shrink-0 rounded-full bg-warn" />
                <span className="flex-1 text-sm text-ink">{todo.body}</span>
                <span className="flex items-center gap-1 text-sm font-semibold whitespace-nowrap text-accent-text">
                  {todo.action}
                  <ArrowRight aria-hidden="true" className="size-4" strokeWidth={2} />
                </span>
              </Link>
            ))}
          </RowList>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionHeading n={awaySoon.length} icon={CalendarDays}>
            Away in the next two weeks
          </SectionHeading>
          {awaySoon.length === 0 ? (
            <EmptyState icon={CalendarDays} className="mt-2.5">
              Nobody is due to be away.
            </EmptyState>
          ) : (
            <RowList>
              {awaySoon.map((r, i) => (
                <div key={r.id} className={cn(rowClass(i), "flex items-center gap-3")}>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-semibold text-ink">{r.name ?? "Unknown"}</span>
                    <span className="text-2xs text-muted-foreground">
                      {LEAVE_LABEL[r.leaveType] ?? r.leaveType} ·{" "}
                      <span className="pms-num">
                        {dshortIso(r.startDate)}
                        {r.endDate !== r.startDate ? ` to ${dshortIso(r.endDate)}` : ""}
                      </span>
                    </span>
                  </span>
                  {r.status === "pending" ? (
                    <Badge intent="info">Not decided</Badge>
                  ) : r.startDate <= today ? (
                    <Badge intent="ok">Away now</Badge>
                  ) : (
                    <Badge intent="neutral">From {dshortIso(r.startDate)}</Badge>
                  )}
                </div>
              ))}
            </RowList>
          )}
        </section>

        <section>
          <SectionHeading n={departments.length} icon={Users}>
            People by department
          </SectionHeading>
          {departments.length === 0 ? (
            <EmptyState icon={Users} className="mt-2.5">
              Nobody on the roster yet.
            </EmptyState>
          ) : (
            // One measure, one hue: the bar is the count, and the count is
            // written beside it, so the bar is never the only way to read it.
            <div className={cn(panelClass, "mt-2.5 p-4")}>
              <BarList
                aria-label="People by department"
                rows={departments.map(([name, count]) => ({ key: name, label: name, value: count, display: String(count) }))}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
