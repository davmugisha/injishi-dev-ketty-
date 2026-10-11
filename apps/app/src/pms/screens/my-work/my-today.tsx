"use client";

/**
 * My work · Today (ADR-058, 058-self-service).
 *
 * What somebody arriving for a shift wants in one look: the clock, the shifts
 * of this week and next, and the three figures people ask the office for most
 * (the leave they have left, the month so far, the last payslip), each a link
 * to the lens that holds the rest.
 *
 * The roster here is the PUBLISHED one (AC-TM2). A week the manager is still
 * drafting reads as nothing yet, which is what it is.
 */

import Link from "next/link";

import { cn } from "@/lib/utils";

import { EmptyState, LoadFailed, SectionHeading } from "../../components/ui";
import { useMyLeaveBalances, useMyLeaveRequests, useMyMonth, useMyPayslips, useMyRoster } from "../../data/my-work";
import { addDaysIso, dshortIso, fmt, todayIso } from "../../lib/format";
import { clock, daysText, hoursText } from "../staff/staff-ui";
import { ClockCard } from "./clock-card";
import { Loading, Panel, dayText, mondayOf, monthText } from "./my-work-ui";

/** Two weeks of shifts, a row a day: this week, then next. */
function Shifts({ employeeId }: { employeeId: string }) {
  const today = todayIso();
  const from = mondayOf(today);
  const roster = useMyRoster(employeeId, from, addDaysIso(from, 13));

  if (roster.isPending) return <Loading rows={2} />;
  if (roster.isError) {
    return (
      <LoadFailed onRetry={() => void roster.refetch()} retrying={roster.isFetching}>
        We couldn&apos;t load your shifts. Nothing is lost. Try again.
      </LoadFailed>
    );
  }

  const byDay = new Map<string, typeof roster.data.entries>();
  for (const entry of roster.data.entries) byDay.set(entry.workDate, [...(byDay.get(entry.workDate) ?? []), entry]);
  const days = Array.from({ length: 14 }, (_, i) => addDaysIso(from, i));
  const any = roster.data.entries.some((e) => e.status === "scheduled");

  if (!any) {
    return (
      <EmptyState>
        No shifts are published for you this week or next. Your manager publishes the roster; ask them if you expected
        one.
      </EmptyState>
    );
  }

  return (
    <Panel className="overflow-hidden">
      <ul aria-label="Your shifts, this week and next">
        {days.map((day, index) => {
          const entries = (byDay.get(day) ?? []).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
          const working = entries.filter((e) => e.status === "scheduled");
          const cancelled = entries.find((e) => e.status === "cancelled");
          const isToday = day === today;
          return (
            <li
              key={day}
              aria-current={isToday ? "date" : undefined}
              className={cn(
                "flex flex-wrap items-baseline gap-x-4 gap-y-0.5 px-[18px] py-2.5",
                index > 0 && "border-t border-line",
                // The week turns over at Monday: a heavier rule says so.
                index === 7 && "border-t-line2",
                isToday && "bg-accent-soft",
                day < today && "opacity-60",
              )}
            >
              <span className={cn("pms-num w-24 shrink-0 text-sm", isToday ? "font-bold text-accent-text" : "text-ink2")}>
                {isToday ? "Today" : dayText(day)}
              </span>
              {working.length > 0 ? (
                <span className="flex min-w-0 flex-col">
                  {working.map((e) => (
                    <span key={e.id} className="text-sm text-ink">
                      <span className="font-semibold">{e.shiftName}</span>{" "}
                      <span className="pms-num text-ink2">
                        {clock(e.startsAt)} to {clock(e.endsAt)}
                      </span>
                    </span>
                  ))}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {cancelled ? `Off: ${cancelled.cancelReason ?? "the shift was cancelled"}` : "Off"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/** The other lenses a figure on Today leads to. */
type Further = "time" | "leave" | "pay";

/**
 * One figure, and the way to the lens that explains it: a link where lenses
 * are addresses, a button on the phone surface, where they are not.
 */
function Figure({
  label,
  value,
  hint,
  href,
  onPress,
}: {
  label: string;
  value: string;
  hint: string;
  href: string;
  onPress?: () => void;
}) {
  const className =
    "flex min-w-0 flex-col gap-0.5 rounded-card border border-card-bd bg-card px-4 py-3.5 text-left no-underline hover:bg-hover";
  const body = (
    <>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate text-xl font-bold tracking-[-0.3px] text-ink">{value}</span>
      <span className="truncate text-2xs text-muted-foreground">{hint}</span>
    </>
  );
  return onPress ? (
    <button type="button" onClick={onPress} className={className}>
      {body}
    </button>
  ) : (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}

function Figures({ employeeId, base, onOpen }: { employeeId: string; base: string; onOpen?: (lens: Further) => void }) {
  const month = todayIso().slice(0, 7);
  const balances = useMyLeaveBalances(employeeId);
  const requests = useMyLeaveRequests(employeeId);
  const summary = useMyMonth(employeeId, month);
  const payslips = useMyPayslips(employeeId);

  // The type with a balance that most people mean by "my leave": annual when
  // the business keeps one under that code, else the first type that counts.
  const kept = (balances.data?.balances ?? []).filter((b) => b.balanceDays !== null);
  const annual = kept.find((b) => b.leaveType.code === "annual") ?? kept[0] ?? null;
  const waiting = (requests.data?.requests ?? []).filter((r) => r.status === "requested").length;
  const s = summary.data?.summary ?? null;
  const latest = [...(payslips.data?.payslips ?? [])].sort((a, b) => b.period.localeCompare(a.period))[0] ?? null;

  return (
    <div className="grid grid-cols-1 gap-3 @xl:grid-cols-3">
      <Figure
        label={annual ? `${annual.leaveType.name} left` : "Leave"}
        value={balances.isPending ? "…" : annual ? daysText(annual.balanceDays ?? 0) : "No balance kept"}
        hint={waiting > 0 ? `${waiting} request${waiting === 1 ? "" : "s"} waiting for an answer` : "Ask for leave, see every request"}
        href={`${base}/leave`}
        onPress={onOpen ? () => onOpen("leave") : undefined}
      />
      <Figure
        label={`Worked in ${monthText(month)}`}
        value={summary.isPending ? "…" : s ? `${s.daysWorked} day${s.daysWorked === 1 ? "" : "s"}` : "Nothing yet"}
        hint={
          s
            ? `${hoursText(s.workedMinutes)} of ${hoursText(s.expectedMinutes)} rostered${s.lateCount > 0 ? `, late ${s.lateCount} time${s.lateCount === 1 ? "" : "s"}` : ""}`
            : "Your clock ins and outs, day by day"
        }
        href={`${base}/time`}
        onPress={onOpen ? () => onOpen("time") : undefined}
      />
      <Figure
        label={latest ? `Net pay, ${monthText(latest.period)}` : "Pay"}
        value={payslips.isPending ? "…" : latest ? fmt(latest.netRwf) : "No payslip yet"}
        hint={latest ? (latest.paidAt ? `Paid on ${dshortIso(latest.paidAt)}` : "Confirmed, not yet paid") : "A payslip appears once a month is confirmed"}
        href={`${base}/pay`}
        onPress={onOpen ? () => onOpen("pay") : undefined}
      />
    </div>
  );
}

export function MyToday({
  employeeId,
  base,
  onOpen,
}: {
  employeeId: string;
  /** Where the lenses live: `/w/<id>/my-work`. */
  base: string;
  /** Open another lens without an address, for a surface that has none. */
  onOpen?: (lens: Further) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 items-start gap-5 @3xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <ClockCard employeeId={employeeId} />
        <div className="flex min-w-0 flex-col gap-2.5">
          <SectionHeading>Your shifts</SectionHeading>
          <Shifts employeeId={employeeId} />
        </div>
      </div>
      <Figures employeeId={employeeId} base={base} onOpen={onOpen} />
    </div>
  );
}
