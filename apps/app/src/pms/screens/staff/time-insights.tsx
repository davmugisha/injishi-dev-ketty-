"use client";

/**
 * Staff · Late and monthly (ADR-058, 058-time AC-TM13).
 *
 * Lateness and early leaving over a range, and each person's month: days
 * worked, worked and expected hours, overtime and how much of it is approved,
 * and how often they were late or left early. For holders of `people.manage`
 * only on this side; a person reads their own in self service and a reporting
 * manager their direct reports' (index contract 7).
 *
 * People come in name order and nothing is coloured good or bad. A figure is a
 * fact about a shift, not a ranking of the person.
 */

import { Input } from "@injishi/ui";
import { useState } from "react";

import { ActionButton, EmptyState, SectionHeading, SelectField } from "../../components/ui";
import { useWorkspaceId } from "../../data/capability";
import { useLateEarly, useMonthlySummary } from "../../data/time";
import { addDaysIso, dshortIso, todayIso } from "../../lib/format";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { Field, hoursText } from "./staff-ui";

const EVERY = "every";

export function TimeInsights() {
  const [view, setView] = useState<"late" | "month">("late");
  return (
    <div className="pms-enter flex max-w-page flex-col gap-4">
      <div className="flex gap-2" role="group" aria-label="Which insight">
        <ActionButton variant={view === "late" ? "primary" : "secondary"} onClick={() => setView("late")}>
          Late and early
        </ActionButton>
        <ActionButton variant={view === "month" ? "primary" : "secondary"} onClick={() => setView("month")}>
          Monthly summary
        </ActionButton>
      </div>
      {view === "late" ? <LateEarly /> : <Monthly />}
    </div>
  );
}

function BranchPick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { state } = usePms();
  const branches = currentGrant(state)?.branches ?? [];
  if (branches.length < 2) return null;
  return (
    <div className="w-56">
      <Field label="Branch">
        <SelectField
          label="Branch"
          value={value}
          onChange={(v) => onChange(v || EVERY)}
          options={[{ value: EVERY, label: "Every branch" }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
        />
      </Field>
    </div>
  );
}

const th = "px-3 py-2 text-left text-2xs font-bold text-muted-foreground";
const td = "px-3 py-2";

function LateEarly() {
  const workspaceId = useWorkspaceId();
  const today = todayIso();
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [branch, setBranch] = useState(EVERY);
  const report = useLateEarly(workspaceId, from, to, branch === EVERY ? undefined : branch);
  const rows = report.data?.rows ?? [];
  const tooWide = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) > 30 * 86_400_000;

  return (
    <section className="flex flex-col gap-3" aria-label="Late and early">
      <div className="flex flex-wrap items-end gap-3">
        <SectionHeading n={rows.length}>Late and early</SectionHeading>
        <span className="flex-1" />
        <Field label="From" htmlFor="le-from">
          <Input id="le-from" type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className="h-10 w-auto rounded border-line2 bg-card text-sm" />
        </Field>
        <Field label="To" htmlFor="le-to">
          <Input id="le-to" type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} className="h-10 w-auto rounded border-line2 bg-card text-sm" />
        </Field>
        <BranchPick value={branch} onChange={setBranch} />
      </div>
      {tooWide ? (
        <EmptyState className="p-5">Choose at most 31 days. A month starting {dshortIso(from)} ends {dshortIso(addDaysIso(from, 30))}.</EmptyState>
      ) : report.isError ? (
        <EmptyState className="p-5">These could not be read.</EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState className="p-5">{report.isPending ? "Reading…" : "Nobody was late or left early on a shift in these days."}</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-card border border-card-bd bg-card">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Late and early, by name</caption>
            <thead>
              <tr>
                <th scope="col" className={th}>Person</th>
                <th scope="col" className={th}>Day</th>
                <th scope="col" className={th}>Shift</th>
                <th scope="col" className={`${th} text-right`}>Late</th>
                <th scope="col" className={`${th} text-right`}>Early</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.recordId} className="border-t border-line" data-late-row={r.recordId}>
                  <td className={td}>
                    <span className="font-semibold text-foreground">{r.employee.displayName}</span>
                  </td>
                  <td className={`${td} pms-num`}>{dshortIso(r.workDate)}</td>
                  <td className={td}>{r.shiftName ?? ""}</td>
                  <td className={`${td} pms-num text-right`}>{r.lateMinutes > 0 ? `${r.lateMinutes} min` : ""}</td>
                  <td className={`${td} pms-num text-right`}>{r.earlyMinutes > 0 ? `${r.earlyMinutes} min` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Monthly() {
  const workspaceId = useWorkspaceId();
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const [branch, setBranch] = useState(EVERY);
  const summary = useMonthlySummary(workspaceId, month, branch === EVERY ? undefined : branch);
  const rows = summary.data?.rows ?? [];

  return (
    <section className="flex flex-col gap-3" aria-label="Monthly summary">
      <div className="flex flex-wrap items-end gap-3">
        <SectionHeading n={rows.length}>Monthly summary</SectionHeading>
        <span className="flex-1" />
        <Field label="Month" htmlFor="ms-month">
          <Input id="ms-month" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-10 w-auto rounded border-line2 bg-card text-sm" />
        </Field>
        <BranchPick value={branch} onChange={setBranch} />
      </div>
      {summary.isError ? (
        <EmptyState className="p-5">The month could not be read.</EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState className="p-5">{summary.isPending ? "Reading…" : "Nobody was rostered or worked this month."}</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-card border border-card-bd bg-card">
          <table className="w-full min-w-max border-collapse text-sm">
            <caption className="sr-only">The month of each person, by name</caption>
            <thead>
              <tr>
                <th scope="col" className={th}>Person</th>
                <th scope="col" className={`${th} text-right`}>Days</th>
                <th scope="col" className={`${th} text-right`}>Worked</th>
                <th scope="col" className={`${th} text-right`}>Rostered</th>
                <th scope="col" className={`${th} text-right`}>Overtime</th>
                <th scope="col" className={`${th} text-right`}>Approved</th>
                <th scope="col" className={`${th} text-right`}>Late</th>
                <th scope="col" className={`${th} text-right`}>Early</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.employee.employeeId} className="border-t border-line" data-month-row={r.employee.employeeId}>
                  <td className={td}>
                    <span className="flex flex-col gap-0.5">
                      <span className="font-semibold text-foreground">{r.employee.displayName}</span>
                      {r.employee.jobPositionTitle && <span className="text-2xs text-muted-foreground">{r.employee.jobPositionTitle}</span>}
                    </span>
                  </td>
                  <td className={`${td} pms-num text-right`}>{r.daysWorked}</td>
                  <td className={`${td} pms-num text-right`}>{hoursText(r.workedMinutes)}</td>
                  <td className={`${td} pms-num text-right`}>{hoursText(r.expectedMinutes)}</td>
                  <td className={`${td} pms-num text-right`}>{r.overtimeMinutes > 0 ? hoursText(r.overtimeMinutes) : ""}</td>
                  <td className={`${td} pms-num text-right`}>{r.approvedOvertimeMinutes > 0 ? hoursText(r.approvedOvertimeMinutes) : ""}</td>
                  <td className={`${td} pms-num text-right`}>{r.lateCount > 0 ? `${r.lateCount}×` : ""}</td>
                  <td className={`${td} pms-num text-right`}>{r.earlyCount > 0 ? `${r.earlyCount}×` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
