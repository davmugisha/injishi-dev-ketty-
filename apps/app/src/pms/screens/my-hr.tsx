"use client";

/**
 * My HR: what an employee does for THEMSELVES (HR module, self-service — first
 * pass, no ADR yet): their leave, their clock and shifts, their tasks and
 * their payslips.
 *
 * The HR screen is the business's view: every employee, every request, every
 * payslip, behind `employee.manage` and `team.manage`. This is the other side
 * of the same records — one person's own leave, tasks and pay — and it gates no
 * permission, because reading your own record is not a power over the business.
 * The API resolves "me" from the session and takes no employee id, so there is
 * nothing here to point at somebody else.
 *
 * WHAT STAYS WITH HR, on purpose: a leave request made here is only a request
 * until it is decided on the HR Leave tab. A task is different — the employee
 * ticks their own work done here, and HR sees it at once and can still tick or
 * reopen it from the Checklists tab.
 *
 * TWO SURFACES SHOW THIS. `MyHr` is the desktop shell's, a lens per route.
 * `MyHrCompact` is the same four parts for a surface that has no routes of
 * its own: the housekeeper's phone, which `AppShell` draws INSTEAD of the
 * shell for a housekeeper, so without it the people most likely to clock in
 * from a phone had no way to reach any of this. Both draw the same screens,
 * and every layout under them answers to the room it is given (a container
 * query), not to the window: the phone surface is 390px wide inside a desktop
 * browser, where a window breakpoint would lay out seven columns.
 */

import { Checkbox, Input } from "@injishi/ui";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, FileDown, ListChecks, Receipt, Send } from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { LensPage } from "../components/lens-page";
import {
  lastSixMonths,
  rwfCompact,
  StackedColumns,
  VIZ_SLOTS,
  VizSwatch,
  type VizColumn,
} from "../components/stacked-columns";
import { ActionButton, Badge, Chip, EmptyState, LoadFailed, SectionHeading, SelectField, Skeleton } from "../components/ui";
import { humanError } from "../data/api";
import { useWorkspaceId } from "../data/capability";
import {
  useMyHrOverview,
  useMyLeave,
  useMyPayslips,
  useMyTasks,
  useRequestMyLeave,
  useSetMyTaskDone,
  useWithdrawMyLeave,
  type MyLeave,
  type MyLeaveType,
  type MyPayslipRow,
} from "../data/ops";
import { downloadPayslipPdf } from "../data/payslip";
import { dshortIso, fmt, kigaliDateOf } from "../lib/format";
import { workspaceBase } from "../lib/nav";
import { usePms } from "../store";
import { MyTime } from "./my-time";
import {
  Eyebrow,
  Field,
  Meter,
  PayslipLines,
  Refusal,
  RowList,
  attendanceSentence,
  dayCount,
  dayRange,
  daysText,
  inputClass,
  panelClass,
  rowClass,
} from "./hr-ui";

const LEAVE_LABEL: Record<MyLeaveType, string> = {
  annual: "Annual",
  sick: "Sick",
  unpaid: "Unpaid",
  other: "Other",
};

const LEAVE_STATUS = {
  pending: { text: "Waiting for HR", intent: "info" },
  approved: { text: "Approved", intent: "ok" },
  rejected: { text: "Rejected", intent: "warn" },
} as const;

/** A card's own title, and the line under it. */
function PanelTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {note && <span className="text-2xs text-muted-foreground">{note}</span>}
    </div>
  );
}

/** `05 Oct 2026`, from a stored UTC date: that date wherever the browser is. */
function fullDay(iso: string): string {
  return `${dshortIso(iso)} ${iso.slice(0, 4)}`;
}

/** The four parts of My HR. A segment is the route under `/my-hr`; leave is the route itself. */
const MY_HR_LENSES = [
  { key: "leave", label: "My leave", short: "Leave", segment: "" },
  { key: "time", label: "My time", short: "Time", segment: "time" },
  { key: "tasks", label: "My tasks", short: "Tasks", segment: "tasks" },
  { key: "payslips", label: "My payslips", short: "Payslips", segment: "payslips" },
] as const;

export type MyHrLens = (typeof MY_HR_LENSES)[number]["key"];

/** Which part a route segment names. Anything else is leave, the route's own part. */
export function myHrLensOf(segment: string | undefined): MyHrLens {
  return MY_HR_LENSES.find((l) => l.key === segment)?.key ?? "leave";
}

/**
 * The caller's own record at this business: either what to show in its place
 * (still loading, could not load, not an employee here), or the departments
 * they work in.
 */
function useMyRecord(): { blocked: ReactNode; departments: string } {
  const workspaceId = useWorkspaceId();
  const overview = useMyHrOverview(workspaceId);

  if (overview.isPending) {
    return {
      departments: "",
      blocked: (
        <div className="pms-enter flex max-w-page flex-col gap-4">
          <Skeleton height={40} />
          <Skeleton height={200} delay={60} />
        </div>
      ),
    };
  }

  if (overview.isError) {
    return {
      departments: "",
      blocked: (
        <LoadFailed onRetry={() => void overview.refetch()} retrying={overview.isFetching}>
          We couldn&apos;t load your HR record. This is on our side.
        </LoadFailed>
      ),
    };
  }

  const employments = overview.data?.employments ?? [];

  // Not everybody who signs in is an employee here: an owner who was never
  // put on a department has no record to show, and saying so beats four
  // empty tabs.
  if (employments.length === 0) {
    return {
      departments: "",
      blocked: (
        <EmptyState style={{ padding: 26, fontSize: 13.5 }}>
          You have no employee record at this business yet. Once HR adds you as an
          employee, your leave, shifts, tasks and payslips appear here.
        </EmptyState>
      ),
    };
  }

  return { blocked: null, departments: employments.map((e) => e.departmentName).join(" and ") };
}

/** One part of My HR, in a container its layouts measure themselves against. */
function MyHrPart({ lens, departments }: { lens: MyHrLens; departments: string }) {
  return (
    <div className="@container relative">
      <div className="pms-enter flex max-w-page flex-col gap-6">
        <p className="text-sm text-muted-foreground">Private to you · {departments}</p>
        {lens === "time" ? <MyTime /> : lens === "tasks" ? <MyTasks /> : lens === "payslips" ? <MyPayslips /> : <MyLeave />}
      </div>
    </div>
  );
}

export function MyHr({ lens }: { lens: string }) {
  const workspaceId = useWorkspaceId();
  const record = useMyRecord();
  const base = `${workspaceBase(workspaceId)}/my-hr`;

  if (record.blocked) return record.blocked;

  return (
    <LensPage
      lenses={MY_HR_LENSES.map((l) => ({ key: l.key, label: l.label, href: l.segment ? `${base}/${l.segment}` : base }))}
      active={lens}
    >
      <MyHrPart lens={myHrLensOf(lens)} departments={record.departments} />
    </LensPage>
  );
}

/**
 * My HR for a surface with no routes of its own (the housekeeper's phone).
 * The part in view is state here, not a route segment, because every route on
 * that surface draws the same phone. It opens on the clock: on a phone, at the
 * door, that is the part somebody came for.
 */
export function MyHrCompact({ initialLens = "time" }: { initialLens?: MyHrLens }) {
  const record = useMyRecord();
  const [lens, setLens] = useState<MyHrLens>(initialLens);

  if (record.blocked) return record.blocked;

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="My HR sections" className="flex flex-wrap gap-2">
        {/* The clock first: the order somebody on their feet reaches for them. */}
        {[...MY_HR_LENSES]
          .sort((a, b) => Number(b.key === "time") - Number(a.key === "time"))
          .map((l) => (
            <Chip key={l.key} size="sm" label={l.short} active={lens === l.key} onClick={() => setLens(l.key)} />
          ))}
      </div>
      <MyHrPart lens={lens} departments={record.departments} />
    </div>
  );
}

function MyLeave() {
  const workspaceId = useWorkspaceId();
  const { toast, toastError } = usePms();
  const query = useMyLeave(workspaceId);
  const request = useRequestMyLeave(workspaceId);
  const withdraw = useWithdrawMyLeave(workspaceId);

  const [leaveType, setLeaveType] = useState<MyLeaveType>("annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  // A refusal stays on the form until the request changes. A toast alone was
  // gone before it was read, and the button looked as if it had done nothing.
  const [refusal, setRefusal] = useState<string | null>(null);

  if (query.isPending) return <Skeleton height={200} />;
  if (query.isError) {
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load your leave. This is on our side.
      </LoadFailed>
    );
  }

  const { requests, balances, year } = query.data;
  const rule = (query.data.rules ?? []).find((r) => r.leaveType === leaveType);
  const ruleText =
    rule && (rule.applicableAfterDays > 0 || rule.maxConsecutiveDays)
      ? `${LEAVE_LABEL[leaveType]} leave${
          rule.applicableAfterDays > 0 ? ` can be taken after ${rule.applicableAfterDays} days of employment` : ""
        }${rule.applicableAfterDays > 0 && rule.maxConsecutiveDays ? ", and" : ""}${
          rule.maxConsecutiveDays ? ` is limited to ${rule.maxConsecutiveDays} days in a row` : ""
        }.`
      : undefined;

  const submit = () => {
    if (!startDate || !endDate) return;
    setRefusal(null);
    if (endDate < startDate) {
      setRefusal("The last day cannot be before the first day.");
      return;
    }
    request.mutate(
      { leaveType, startDate, endDate, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          setStartDate("");
          setEndDate("");
          setReason("");
          toast("Leave request sent to HR", "ok");
        },
        onError: (error) => {
          setRefusal(humanError(error));
          toastError(error);
        },
      },
    );
  };

  return (
    <>
      <div className="grid gap-3 @3xl:grid-cols-2">
        <section className={cn(panelClass, "flex flex-col gap-4 p-5")}>
          <PanelTitle title="Leave balance" note={String(year)} />
          <div className="flex flex-col gap-4">
            {balances.map((b) => (
              <LeaveMeter key={b.leaveType} label={`${LEAVE_LABEL[b.leaveType]} leave`} balance={b} />
            ))}
          </div>
        </section>

        <section className={cn(panelClass, "flex flex-col gap-4 p-5")}>
          <PanelTitle title="Your leave calendar" />
          <LeaveCalendar requests={requests} />
        </section>
      </div>

      <section>
        <SectionHeading icon={Send}>Request leave</SectionHeading>
        <form
          className={cn(panelClass, "mt-2.5 flex flex-col gap-4 p-5")}
          onSubmit={(ev) => {
            ev.preventDefault();
            submit();
          }}
        >
          <div className="grid gap-4 @xl:grid-cols-2">
            <div className="@xl:col-span-2">
              <Field label="Type" hint={ruleText}>
                <SelectField
                  label="Leave type"
                  value={leaveType}
                  onChange={(v) => setLeaveType(v as MyLeaveType)}
                  options={(Object.keys(LEAVE_LABEL) as MyLeaveType[]).map((t) => ({ value: t, label: `${LEAVE_LABEL[t]} leave` }))}
                />
              </Field>
            </div>
            <Field label="From" htmlFor="my-leave-from">
              <Input
                id="my-leave-from"
                required
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="To" htmlFor="my-leave-to">
              <Input
                id="my-leave-to"
                required
                type="date"
                min={startDate || undefined}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputClass}
              />
            </Field>
            <div className="@xl:col-span-2">
              <Field label="Reason" hint="Optional." htmlFor="my-leave-reason">
                <Input
                  id="my-leave-reason"
                  maxLength={300}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          </div>
          {refusal && <Refusal>Not sent: {refusal}</Refusal>}
          <div className="flex justify-end">
            <ActionButton variant="primary" type="submit" pending={request.isPending}>
              Send request
            </ActionButton>
          </div>
        </form>
      </section>

      <section>
        <SectionHeading n={requests.length} icon={CalendarDays}>
          My requests
        </SectionHeading>
        {requests.length === 0 ? (
          <EmptyState icon={CalendarDays} className="mt-2.5">
            You have not asked for any leave yet.
          </EmptyState>
        ) : (
          <RowList>
            {requests.map((r, i) => (
              <div key={r.id} className={cn(rowClass(i), "flex flex-wrap items-center gap-3")}>
                <span className="flex min-w-0 flex-[1_1_12rem] flex-col gap-0.5">
                  <span className="text-sm font-semibold text-ink">
                    {LEAVE_LABEL[r.leaveType]} leave · <span className="pms-num">{dayRange(r)}</span>
                  </span>
                  <span className="text-2xs text-muted-foreground">
                    {daysText(dayCount(r))}
                    {r.reason ? ` · ${r.reason}` : ""}
                  </span>
                </span>
                <Badge intent={LEAVE_STATUS[r.status].intent}>{LEAVE_STATUS[r.status].text}</Badge>
                {r.status === "pending" && (
                  <ActionButton
                    pending={withdraw.isPending && withdraw.variables?.requestId === r.id}
                    onClick={() =>
                      withdraw.mutate(
                        { requestId: r.id },
                        { onSuccess: () => toast("Request withdrawn", "ok"), onError: toastError },
                      )
                    }
                  >
                    Withdraw
                  </ActionButton>
                )}
              </div>
            ))}
          </RowList>
        )}
      </section>
    </>
  );
}

/**
 * One leave type's allowance as a meter: the filled part is what has been
 * used, the rest of the track is what is left. The number that matters — days
 * left — is the large one beside it, so the bar is never the only reading.
 */
function LeaveMeter({
  label,
  balance,
}: {
  label: string;
  balance: { allocated: number; used: number; remaining: number; source?: string; basis?: string | null };
}) {
  const { allocated, used, remaining } = balance;
  // With no allowance set there is nothing to be over, only days taken.
  const over = allocated > 0 && remaining < 0;
  const left = Math.max(remaining, 0);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <span className="flex-1 text-sm font-semibold text-ink">{label}</span>
        {allocated > 0 ? (
          <span className="text-sm text-muted-foreground">
            <span className="text-xl font-bold text-ink">{left}</span> {left === 1 ? "day" : "days"} left
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">No allowance set</span>
        )}
      </div>
      <Meter label={`${label}: ${used} of ${allocated} days used`} value={used} max={allocated} over={over} />
      <div className="flex justify-between text-2xs text-muted-foreground">
        <span>
          {daysText(used)} used
          {over ? `, ${-remaining} over the allowance` : ""}
        </span>
        <span>{allocated > 0 ? `of ${allocated}` : ""}</span>
      </div>
      {/* Where the allowance came from, so "why 9 and not 18" is answered here. */}
      {balance.source === "automatic" && balance.basis ? (
        <span className="text-2xs text-muted-foreground">{balance.basis}</span>
      ) : balance.source === "manual" ? (
        <span className="text-2xs text-muted-foreground">Set by HR for you this year</span>
      ) : null}
    </div>
  );
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** `2026-11-05` for a UTC date: the form leave dates are stored and compared in. */
function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const monthStepClass =
  "flex size-8 cursor-pointer items-center justify-center rounded border border-card-bd bg-card text-ink2 hover:bg-hover";

/**
 * A month of the employee's own leave. Approved days are filled; days still
 * waiting for HR are outlined, so the two are told apart by shape as well as
 * by colour. It opens on the month of the next leave that has not finished,
 * which is the one somebody opening this page is most likely asking about.
 */
function LeaveCalendar({ requests }: { requests: MyLeave["requests"] }) {
  const today = isoDay(new Date());
  const shown = requests.filter((r) => r.status !== "rejected");
  const upcoming = shown
    .filter((r) => r.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const next = upcoming[0];
  const startMonth = (next && next.startDate > today ? next.startDate : today).slice(0, 7);
  const [month, setMonth] = useState(startMonth);

  const [year, monthIndex] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthIndex - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  // Monday first: getUTCDay() is 0 for Sunday.
  const lead = (first.getUTCDay() + 6) % 7;
  const shift = (by: number) => setMonth(isoDay(new Date(Date.UTC(year, monthIndex - 1 + by, 1))).slice(0, 7));
  const statusOf = (day: string) => {
    const hit = shown.filter((r) => r.startDate <= day && day <= r.endDate);
    if (hit.some((r) => r.status === "approved")) return "approved";
    return hit.length > 0 ? "pending" : null;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-sm font-semibold text-ink">
          {first.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })}
        </span>
        <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className={monthStepClass}>
          <ChevronLeft aria-hidden="true" className="size-4" strokeWidth={2} />
        </button>
        <button type="button" aria-label="Next month" onClick={() => shift(1)} className={monthStepClass}>
          <ChevronRight aria-hidden="true" className="size-4" strokeWidth={2} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d) => (
          <span key={d} className="pb-0.5 text-2xs font-bold text-[var(--muted2)]">
            {d}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`lead-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = `${month}-${String(i + 1).padStart(2, "0")}`;
          const status = statusOf(day);
          return (
            <span
              key={day}
              title={status === "approved" ? "Approved leave" : status === "pending" ? "Waiting for HR" : undefined}
              className={cn(
                "pms-num flex h-8 items-center justify-center rounded text-xs",
                status === "approved"
                  ? "border border-transparent bg-primary font-bold text-primary-foreground"
                  : status === "pending"
                    ? "border-2 border-dashed border-primary font-bold text-ink"
                    : day === today
                      ? "border border-ink font-bold text-ink"
                      : "border border-transparent text-ink",
              )}
            >
              {i + 1}
            </span>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-2xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[3px] bg-primary" />
          Approved
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[3px] border-2 border-dashed border-primary" />
          Waiting for HR
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[3px] border border-ink" />
          Today
        </span>
      </div>

      <p className="border-t border-line pt-3 text-sm text-muted-foreground">
        {next ? (
          <>
            <span className="font-semibold text-ink">{next.startDate <= today ? "On leave now" : "Next leave"}:</span>{" "}
            {LEAVE_LABEL[next.leaveType]}, <span className="pms-num">{dayRange(next)}</span> ({daysText(dayCount(next))}) ·{" "}
            {LEAVE_STATUS[next.status].text}
          </>
        ) : (
          "You have no leave coming up."
        )}
      </p>
    </div>
  );
}

function MyTasks() {
  const workspaceId = useWorkspaceId();
  const { toast, toastError } = usePms();
  const query = useMyTasks(workspaceId);
  const setDone = useSetMyTaskDone(workspaceId);

  if (query.isPending) return <Skeleton height={200} />;
  if (query.isError) {
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load your tasks. This is on our side.
      </LoadFailed>
    );
  }

  const tasks = query.data;
  const today = new Date().toISOString().slice(0, 10);
  const done = tasks.filter((t) => t.done).length;

  return (
    <section>
      <SectionHeading n={tasks.length} icon={ListChecks}>
        My tasks
      </SectionHeading>
      <p className="mt-2 text-sm text-muted-foreground">
        {tasks.length > 0 ? `${done} of ${tasks.length} done. ` : ""}Tick a task when you finish it.
      </p>
      {tasks.length === 0 ? (
        <EmptyState icon={ListChecks} className="mt-2.5">
          No tasks have been assigned to you.
        </EmptyState>
      ) : (
        <RowList>
          {tasks.map((t, i) => (
            <div key={t.id} className={cn(rowClass(i), "flex flex-wrap items-center gap-3")}>
              <span className="min-w-0 flex-[1_1_12rem]">
                <Checkbox
                  isSelected={t.done}
                  isDisabled={setDone.isPending && setDone.variables?.itemId === t.id}
                  onChange={(next: boolean) =>
                    setDone.mutate(
                      { itemId: t.id, done: next },
                      {
                        onSuccess: () => toast(next ? `${t.label} marked done` : `${t.label} reopened`, "ok"),
                        onError: toastError,
                      },
                    )
                  }
                  className="flex w-full items-center gap-2.5 text-sm font-semibold text-ink"
                >
                  <span className={t.done ? "text-muted-foreground line-through" : undefined}>{t.label}</span>
                </Checkbox>
              </span>
              <span className="text-2xs text-muted-foreground">
                {t.kind}
                {t.assigneeRole ? ` · with ${t.assigneeRole}` : ""}
                {t.dueDate ? ` · due ${dshortIso(t.dueDate)}` : ""}
              </span>
              {t.done ? (
                <Badge intent="ok">Done{t.completedAt ? ` ${dshortIso(kigaliDateOf(t.completedAt))}` : ""}</Badge>
              ) : t.dueDate && t.dueDate < today ? (
                <Badge intent="warn">Overdue</Badge>
              ) : (
                <Badge intent="info">Open</Badge>
              )}
            </div>
          ))}
        </RowList>
      )}
    </section>
  );
}

/** "October 2026", from the day a pay period ends. */
function payMonth(periodEnd: string): string {
  return new Date(periodEnd).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
}

function SlipLine({ label, amount, strong, minus }: { label: string; amount: number; strong?: boolean; minus?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3 py-1 text-sm", strong ? "font-bold text-ink" : "text-ink2")}>
      <span>{label}</span>
      <span className="pms-num">
        {minus ? "− " : ""}
        {fmt(amount)}
      </span>
    </div>
  );
}

/**
 * One department's slip as a single line: what was earned, what was withheld,
 * what was received. The full breakdown is one press away, so a month reads at
 * a glance and nothing is lost.
 */
function SlipRow({ slip }: { slip: MyPayslipRow }) {
  const [open, setOpen] = useState(false);
  const deductions = slip.payeRwf + slip.rssbEmployeeRwf;

  return (
    <div className="border-t border-line">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 bg-transparent px-[18px] py-2.5 text-left hover:bg-hover"
      >
        {/* "Rooms" alone read as something bought. It is where the work was done. */}
        <span className="flex-[1_1_12rem] text-sm font-semibold text-ink">
          <span className="font-normal text-muted-foreground">Your salary as </span>
          {slip.jobTitle?.trim() || "staff"}
          <span className="font-normal text-muted-foreground"> · {slip.departmentName} department</span>
        </span>
        <span className="pms-num text-2xs whitespace-nowrap text-muted-foreground">Gross {fmt(slip.grossRwf)}</span>
        <span className="pms-num text-2xs whitespace-nowrap text-muted-foreground">Deducted {fmt(deductions)}</span>
        <span className="pms-num text-sm font-bold whitespace-nowrap text-ink">Net {fmt(slip.netRwf)}</span>
        <Badge>{open ? "Hide lines" : "Lines"}</Badge>
      </button>
      {open && <Slip slip={slip} />}
    </div>
  );
}

/** One department's slip for one period, laid out as a payslip reads on paper. */
function Slip({ slip }: { slip: MyPayslipRow }) {
  const workspaceId = useWorkspaceId();
  const { toastError } = usePms();
  const [downloading, setDownloading] = useState(false);
  const deductions = slip.payeRwf + slip.rssbEmployeeRwf;
  const kept = slip.grossRwf > 0 ? Math.round((slip.netRwf / slip.grossRwf) * 100) : 0;
  const month = attendanceSentence(slip.attendance);

  const download = () => {
    if (!workspaceId || downloading) return;
    setDownloading(true);
    downloadPayslipPdf(workspaceId, `/ops/my-hr/payslips/${slip.id}/pdf`, `payslip-${slip.periodEnd.slice(0, 7)}.pdf`)
      .catch(toastError)
      .finally(() => setDownloading(false));
  };

  return (
    <div className="flex flex-col gap-3 px-[18px] pt-1 pb-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="pms-num text-2xs text-muted-foreground">
          {fullDay(slip.periodStart)} to {fullDay(slip.periodEnd)}
        </span>
        <Badge intent={slip.status === "paid" ? "ok" : "info"}>
          {slip.status === "paid"
            ? `Paid${slip.paidAt ? ` ${dshortIso(kigaliDateOf(slip.paidAt))}` : ""}`
            : "Approved, not yet paid"}
        </Badge>
        <span className="ml-auto">
          <ActionButton icon={FileDown} pending={downloading} onClick={download}>
            Download PDF
          </ActionButton>
        </span>
      </div>

      {/* What the month held, since that is what the figures under it were worked out from. */}
      {month && <p className="text-sm text-ink2">Your month: {month}.</p>}

      {slip.lines.length > 0 ? (
        <PayslipLines lines={slip.lines} />
      ) : (
        // A payslip from before its lines were kept: the amounts, named for what they were.
        <div className="grid gap-x-8 gap-y-3 @xl:grid-cols-2">
          <div className="flex flex-col">
            <Eyebrow>Earnings</Eyebrow>
            <SlipLine label="Monthly salary" amount={slip.grossRwf} />
            <SlipLine label="Gross pay" amount={slip.grossRwf} strong />
          </div>
          <div className="flex flex-col">
            <Eyebrow>Deductions</Eyebrow>
            <SlipLine label="PAYE (income tax)" amount={slip.payeRwf} minus />
            <SlipLine label="RSSB (your share)" amount={slip.rssbEmployeeRwf} minus />
            <SlipLine label="Total deductions" amount={deductions} strong minus />
          </div>
        </div>
      )}

      {/* How the gross splits: what reaches you, and what is withheld. */}
      <div className="flex flex-col gap-1">
        <div
          role="img"
          aria-label={`You keep ${kept}% of gross pay; ${100 - kept}% is deducted.`}
          className="relative h-2.5 overflow-hidden rounded-r bg-chart-track"
        >
          <span className="absolute inset-y-0 left-0 rounded-r bg-chart-1" style={{ width: `${kept}%` }} />
        </div>
        <div className="flex justify-between text-2xs text-muted-foreground">
          <span>Take home {kept}%</span>
          <span>Deducted {100 - kept}%</span>
        </div>
      </div>

      <div className="border-t border-dashed border-line pt-2.5">
        <SlipLine label="Gross pay" amount={slip.grossRwf} />
        <SlipLine label="Tax and contributions withheld" amount={deductions} minus />
        <SlipLine label="Net pay (what you receive)" amount={slip.netRwf} strong />
        <p className="text-2xs text-muted-foreground">
          Your employer also pays {fmt(slip.rssbEmployerRwf)} to RSSB for you. It is not taken from your pay.
        </p>
      </div>
    </div>
  );
}

/* ── Payslips: the picture before the paperwork ─────────────────────────── */

/**
 * The three places a gross salary goes, in a FIXED order and colour: the same
 * part is the same colour in the breakdown bar, the chart and both legends.
 *
 * The colours are the first, third and fifth steps of the design system's
 * chart ramp, which is one hue, so the parts are a step apart in lightness
 * rather than neighbours. That is still not enough to carry the reading alone,
 * which is why every part is also NAMED and VALUED in text beside its swatch,
 * and the payslip list below is the table view of the same numbers.
 */
const PAY_PARTS = [
  { key: "net", label: "Take home", color: VIZ_SLOTS[0] },
  { key: "paye", label: "PAYE (income tax)", color: VIZ_SLOTS[2] },
  { key: "rssb", label: "RSSB (pension)", color: VIZ_SLOTS[4] },
] as const;

type PayPartKey = (typeof PAY_PARTS)[number]["key"];
type PaySplit = Record<PayPartKey, number>;

function splitOf(rows: readonly MyPayslipRow[]): PaySplit {
  return {
    net: rows.reduce((n, s) => n + s.netRwf, 0),
    paye: rows.reduce((n, s) => n + s.payeRwf, 0),
    rssb: rows.reduce((n, s) => n + s.rssbEmployeeRwf, 0),
  };
}

function grossOf(split: PaySplit): number {
  return split.net + split.paye + split.rssb;
}

/** One horizontal bar: how a gross salary divides, with every part named. */
function PaySplitBar({ split }: { split: PaySplit }) {
  const gross = grossOf(split);
  return (
    <div className="flex flex-col gap-3.5">
      <div
        role="img"
        aria-label={PAY_PARTS.map((p) => `${p.label} ${fmt(split[p.key])}`).join(", ")}
        // The gap is the card showing through: it separates the parts
        // without a border drawn around any of them.
        className="flex h-3.5 gap-0.5 overflow-hidden rounded-r"
      >
        {PAY_PARTS.map((p) =>
          split[p.key] > 0 ? <span key={p.key} className="basis-0" style={{ flexGrow: split[p.key], background: p.color }} /> : null,
        )}
      </div>
      <dl className="flex flex-col gap-2">
        {PAY_PARTS.map((p) => (
          <div key={p.key} className="flex items-center gap-2 text-sm">
            <VizSwatch color={p.color} />
            <dt className="flex-1 text-ink">{p.label}</dt>
            <dd className="pms-num font-semibold text-ink">{fmt(split[p.key])}</dd>
            <dd className="pms-num w-10 text-right text-muted-foreground">
              {gross > 0 ? Math.round((split[p.key] / gross) * 100) : 0}%
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function MyPayslips() {
  const workspaceId = useWorkspaceId();
  const query = useMyPayslips(workspaceId);
  const [openPeriod, setOpenPeriod] = useState<string | null | undefined>(undefined);

  if (query.isPending) return <Skeleton height={200} />;
  if (query.isError) {
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load your payslips. This is on our side.
      </LoadFailed>
    );
  }

  const slips = query.data;

  if (slips.length === 0) {
    return (
      <section>
        <SectionHeading icon={Receipt}>My payslips</SectionHeading>
        <EmptyState icon={Receipt} className="mt-2.5">
          No payslips yet. One appears here each month, once HR has approved that month&apos;s payroll.
        </EmptyState>
      </section>
    );
  }

  // One entry per pay period, newest first (the API's order). Somebody with
  // two jobs has two slips in a period; they read as one month's pay.
  const periods: { key: string; monthId: string; label: string; slips: MyPayslipRow[] }[] = [];
  for (const slip of slips) {
    const key = `${slip.periodStart}|${slip.periodEnd}`;
    let period = periods.find((p) => p.key === key);
    if (!period) {
      period = { key, monthId: slip.periodEnd.slice(0, 7), label: payMonth(slip.periodEnd), slips: [] };
      periods.push(period);
    }
    period.slips.push(slip);
  }

  const latest = periods[0];
  const previous = periods[1];
  const latestSplit = splitOf(latest.slips);
  const latestPaid = latest.slips.every((s) => s.status === "paid");
  const change = previous ? latestSplit.net - splitOf(previous.slips).net : null;

  const year = new Date(latest.slips[0].periodEnd).getUTCFullYear();
  const yearSplit = splitOf(slips.filter((s) => new Date(s.periodEnd).getUTCFullYear() === year));

  // The six months ending at the latest payslip, oldest first. A month with
  // no payslip keeps its slot, empty, so a gap in pay reads as a gap.
  const columns: VizColumn[] = lastSixMonths(latest.monthId).map((month) => {
    const period = periods.find((x) => x.monthId === month.id);
    return { ...month, values: period ? { ...splitOf(period.slips) } : null };
  });

  // The newest period opens by default; `null` is the reader closing it.
  const open = openPeriod === undefined ? latest.key : openPeriod;

  return (
    <>
      <div className="grid gap-3 @3xl:grid-cols-2">
        {/* The one number this page leads with. */}
        <section className={cn(panelClass, "flex flex-col gap-1.5 p-5")}>
          <span className="text-xs text-muted-foreground">Take-home pay · {latest.label}</span>
          <span className="text-3xl leading-tight font-bold tracking-[-1px] text-ink @xl:text-4xl">{fmt(latestSplit.net)}</span>
          <div className="flex flex-wrap items-center gap-2">
            <Badge intent={latestPaid ? "ok" : "info"}>{latestPaid ? "Paid" : "Approved, not yet paid"}</Badge>
            <span className="text-xs text-muted-foreground">
              from a gross salary of {fmt(grossOf(latestSplit))}
              {latest.slips.length > 1 ? ` across ${latest.slips.length} jobs` : ""}
            </span>
          </div>
          {change !== null && change !== 0 && previous && (
            <span className="text-xs text-muted-foreground">
              {fmt(Math.abs(change))} {change > 0 ? "more" : "less"} than {previous.label}
            </span>
          )}
          <dl className="mt-auto flex flex-wrap gap-x-6 gap-y-1.5 border-t border-line pt-3.5">
            <div className="flex flex-col">
              <dt className="text-xs text-muted-foreground">Take home in {year}</dt>
              <dd className="text-base font-bold text-ink">{fmt(yearSplit.net)}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs text-muted-foreground">Tax and pension in {year}</dt>
              <dd className="text-base font-bold text-ink">{fmt(yearSplit.paye + yearSplit.rssb)}</dd>
            </div>
          </dl>
        </section>

        <section className={cn(panelClass, "flex flex-col gap-4 p-5")}>
          <PanelTitle title="Where your salary went" note={`${latest.label}, out of ${fmt(grossOf(latestSplit))} gross`} />
          <PaySplitBar split={latestSplit} />
        </section>
      </div>

      <section className={cn(panelClass, "flex flex-col gap-4 p-5")}>
        <PanelTitle title="Your pay, month by month" note="Press a month to see its payslips." />
        <StackedColumns
          series={PAY_PARTS}
          columns={columns}
          selectedId={periods.find((x) => x.key === open)?.monthId ?? null}
          onSelect={(monthId) => setOpenPeriod(periods.find((x) => x.monthId === monthId)?.key ?? null)}
          format={fmt}
          formatTick={rwfCompact}
          totalLabel="Gross salary"
        />
      </section>

      <section>
        <SectionHeading n={periods.length} icon={Receipt}>
          Payslips
        </SectionHeading>

        {periods.map((period) => {
          const isOpen = open === period.key;
          const paid = period.slips.every((s) => s.status === "paid");
          return (
            <RowList key={period.key}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenPeriod(isOpen ? null : period.key)}
                className="flex w-full cursor-pointer flex-wrap items-center gap-3 bg-transparent px-[18px] py-3 text-left hover:bg-hover"
              >
                <span className="flex-[1_1_8rem] text-sm font-semibold text-ink">{period.label}</span>
                {period.slips.length > 1 && (
                  <span className="text-2xs text-muted-foreground">salary from {period.slips.length} jobs</span>
                )}
                <span className="pms-num text-sm font-bold text-ink">Net {fmt(splitOf(period.slips).net)}</span>
                <Badge intent={paid ? "ok" : "info"}>{paid ? "Paid" : "Approved"}</Badge>
                <ChevronDown
                  aria-hidden="true"
                  className={cn("size-4 shrink-0 text-faint transition-transform", isOpen && "rotate-180")}
                  strokeWidth={2}
                />
              </button>
              {isOpen && period.slips.map((slip) => <SlipRow key={slip.id} slip={slip} />)}
            </RowList>
          );
        })}
      </section>
    </>
  );
}
