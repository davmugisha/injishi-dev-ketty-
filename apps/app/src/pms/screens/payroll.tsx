"use client";

/**
 * Payroll (HR module, first pass — no ADR yet, pending team review).
 *
 * Mirrors Team's shape (screens/team.tsx): gated the same way, on
 * `team.manage`, for the same reason — this is a disclosure about people's pay,
 * not operational data, and belongs to the owner/manager who already manage
 * the roster.
 *
 * A PAYSLIP IS WORKED OUT FROM THE MONTH THAT HAPPENED. The salary on record,
 * less a thirtieth for each rostered shift nobody clocked and each day of
 * unpaid leave, plus overtime past the end of a shift; then PAYE by band and
 * the RSSB and CBHI contributions on what was earned. Every payslip keeps the
 * lines it was computed from, shown under "Lines" and on its PDF. The rules
 * are in server/api/src/modules/payroll/domain/pay-rules.ts.
 *
 * THE RATES ARE NOT CONFIRMED. They are Rwanda's published rates as understood
 * when that file was written, and no accountant has checked them; the screen
 * says so beside the button that runs payroll.
 *
 * NO REAL MONEY MOVES YET. "Mark paid" flips a status, matching the mock
 * payment and EBM adapters elsewhere in this codebase.
 */

import { Input } from "@injishi/ui";
import { Banknote, ChartColumn, FileDown, Receipt } from "lucide-react";
import { Fragment, useState } from "react";

import { cn } from "@/lib/utils";

import { ActionButton, Badge, EmptyState, Initials, LoadFailed, SectionHeading, Skeleton, StatCard } from "../components/ui";
import {
  lastSixMonths,
  rwfCompact,
  StackedColumns,
  VIZ_OTHER,
  VIZ_SLOTS,
  type VizColumn,
  type VizSeries,
} from "../components/stacked-columns";
import { useCapability, useWorkspaceId } from "../data/capability";
import { downloadPayslipPdf } from "../data/payslip";
import { fmt, initials } from "../lib/format";
import { usePms } from "../store";
import {
  useApprovePayrollRun,
  useCreatePayrollRun,
  useDiscardPayrollRun,
  useMarkPayrollRunPaid,
  usePayrollCost,
  usePayrollRuns,
  usePayslips,
  useRecalculatePayrollRun,
  useSetCompensation,
  useStaffCompensation,
  type PayrollCostRow,
  type PayrollRunRow,
  type PayslipRow,
  type StaffCompensationRow,
} from "../data/ops";
import { PayslipLines, Person, RowList, hoursText, panelClass, rowClass } from "./hr-ui";

export function Payroll() {
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const { toast, toastError } = usePms();

  const compensation = useStaffCompensation(workspaceId);
  const runs = usePayrollRuns(workspaceId);
  const createRun = useCreatePayrollRun(workspaceId);

  // `undefined` until the reader chooses: the newest run opens by default, and
  // `null` is them closing it.
  const [selectedRunId, setSelectedRunId] = useState<string | null | undefined>(undefined);

  if (!can("team.manage")) {
    return <EmptyState style={{ padding: 26, fontSize: 13.5 }}>{reasonFor("team.manage")}</EmptyState>;
  }

  if (compensation.isPending || runs.isPending) {
    return (
      <div className="pms-enter flex max-w-page flex-col gap-4">
        <Skeleton height={40} />
        <Skeleton height={200} delay={60} />
      </div>
    );
  }

  if (compensation.isError || runs.isError) {
    return (
      <LoadFailed
        onRetry={() => {
          void compensation.refetch();
          void runs.refetch();
        }}
        retrying={compensation.isFetching || runs.isFetching}
      >
        We couldn&apos;t load payroll. Nothing here has changed — this is on our side.
      </LoadFailed>
    );
  }

  const staff = compensation.data ?? [];
  const runList = runs.data ?? [];
  const openId = selectedRunId === undefined ? (runList[0]?.id ?? null) : selectedRunId;

  const runThisMonth = () => {
    // The month in UTC, not in the browser's zone: the period is the
    // run's identity, and two laptops in two zones must name the same one.
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString();
    const periodEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0)).toISOString();
    createRun.mutate(
      { periodStart, periodEnd },
      {
        onSuccess: (run) => {
          // Back to the default, which opens the run just created.
          setSelectedRunId(undefined);
          toast(
            run.replaced
              ? "Payroll re-run from current salaries. This month's earlier run was replaced (demo only)."
              : "Payroll run created as a draft",
            "ok",
          );
        },
        onError: toastError,
      },
    );
  };

  return (
    <div className="pms-enter relative flex max-w-page flex-col gap-6">
      {/* --- Staff cost --- */}
      <StaffCost runs={runList} selectedRunId={openId} onSelectRun={(id) => setSelectedRunId(id)} />

      {/* --- Payroll runs --- */}
      <section>
        <SectionHeading
          n={runList.length}
          icon={Receipt}
          action={
            <ActionButton
              variant="primary"
              deniedReason={staff.length === 0 ? "Nobody to pay yet. Add people on the Employees tab." : undefined}
              pending={createRun.isPending}
              onClick={runThisMonth}
            >
              Run payroll for this month
            </ActionButton>
          }
        >
          Payroll runs
        </SectionHeading>
        <p className="mt-2 text-2xs text-muted-foreground">
          Pay is the month&apos;s salary, less missed shifts and unpaid leave, plus overtime, read from the roster
          and the clock. Tax and contributions use Rwanda&apos;s published rates, which an accountant has not yet
          confirmed. No money moves.
        </p>

        {runList.length === 0 ? (
          <EmptyState icon={Receipt} className="mt-2.5">
            No payroll runs yet.
          </EmptyState>
        ) : (
          runList.map((run) => (
            <RunCard
              key={run.id}
              run={run}
              open={openId === run.id}
              onToggle={() => setSelectedRunId(openId === run.id ? null : run.id)}
            />
          ))
        )}
      </section>

      <Salaries staff={staff} />
    </div>
  );
}

/* ── Salaries ───────────────────────────────────────────────────────────── */

/**
 * What each person is paid a month. A row shows the figure and nothing else
 * until somebody presses Edit — seven permanently open input boxes read as a
 * form to fill in, when on most visits nobody is changing anything.
 *
 * Somebody with two jobs has two rows, and each names its job, so "Solange
 * Uwera" twice is not a mystery.
 */
function Salaries({ staff }: { staff: readonly StaffCompensationRow[] }) {
  const workspaceId = useWorkspaceId();
  const { toast, toastError } = usePms();
  const setCompensation = useSetCompensation(workspaceId);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const monthly = staff.reduce((n, m) => n + m.baseSalaryRwf, 0);
  const people = [...staff].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "") || a.departmentName.localeCompare(b.departmentName));

  const save = (m: StaffCompensationRow) => {
    const value = Math.round(Number(draft));
    if (!value || value <= 0) {
      toast("Enter a salary above zero.", "warn");
      return;
    }
    setCompensation.mutate(
      { departmentMemberId: m.departmentMemberId, baseSalaryRwf: value },
      {
        onSuccess: () => {
          setEditing(null);
          toast(`${m.name ?? "Salary"}: ${fmt(value)} a month`, "ok");
        },
        onError: toastError,
      },
    );
  };

  return (
    <section>
      <SectionHeading
        n={staff.length}
        icon={Banknote}
        action={
          monthly > 0 && (
            <span className="text-sm text-muted-foreground">
              <span className="pms-num font-bold text-ink">{fmt(monthly)}</span> a month
            </span>
          )
        }
      >
        Salaries
      </SectionHeading>
      {people.length === 0 ? (
        <EmptyState icon={Banknote} className="mt-2.5">
          Nobody to pay yet. Add people on the Employees tab.
        </EmptyState>
      ) : (
        <RowList>
          {people.map((m, i) => {
            const isEditing = editing === m.departmentMemberId;
            return (
              <div key={m.id} className={cn(rowClass(i), "flex flex-wrap items-center gap-3")}>
                <Person
                  name={m.name ?? "Unknown"}
                  detail={[m.jobTitle, m.departmentName].filter(Boolean).join(" · ")}
                  className="basis-40"
                />

                {isEditing ? (
                  <>
                    <span className="text-sm text-muted-foreground">RWF</span>
                    <Input
                      type="number"
                      size="sm"
                      min={1}
                      autoFocus
                      aria-label={`Monthly salary for ${m.name ?? "this person"}`}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") save(m);
                        if (e.key === "Escape") setEditing(null);
                      }}
                      className="h-9 w-36 rounded border-line2 bg-card text-right text-sm"
                    />
                    <ActionButton variant="primary" pending={setCompensation.isPending} onClick={() => save(m)}>
                      Save
                    </ActionButton>
                    <ActionButton onClick={() => setEditing(null)}>Cancel</ActionButton>
                  </>
                ) : (
                  <>
                    {m.baseSalaryRwf > 0 ? (
                      <span className="pms-num text-sm font-bold text-ink">{fmt(m.baseSalaryRwf)}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Not set</span>
                    )}
                    <ActionButton
                      onClick={() => {
                        setEditing(m.departmentMemberId);
                        setDraft(m.baseSalaryRwf > 0 ? String(m.baseSalaryRwf) : "");
                      }}
                    >
                      {m.baseSalaryRwf > 0 ? "Edit" : "Set salary"}
                    </ActionButton>
                  </>
                )}
              </div>
            );
          })}
        </RowList>
      )}
    </section>
  );
}

/* ── Staff cost, month by month ─────────────────────────────────────────── */

/** Past this many departments the smallest fold into "Other": the ramp has five steps and a sixth is never invented. */
const MAX_DEPARTMENT_SERIES = VIZ_SLOTS.length;

/**
 * What staff cost the business each month, split by department.
 *
 * COST, not net pay: gross salaries plus the employer's own RSSB share, which
 * is money the business pays that no payslip's net shows. A draft run counts,
 * labelled as one, because the owner looking at this is usually deciding
 * whether to approve it.
 *
 * A department keeps one colour across every month. Colours are handed out
 * once, by total cost across all runs (largest first, name as the tiebreak),
 * so the order does not shuffle when one month's figures change.
 */
function StaffCost({
  runs,
  selectedRunId,
  onSelectRun,
}: {
  runs: readonly PayrollRunRow[];
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
}) {
  const workspaceId = useWorkspaceId();
  const cost = usePayrollCost(workspaceId);
  const rows: PayrollCostRow[] = cost.data ?? [];

  if (cost.isPending) return <Skeleton height={220} />;
  if (cost.isError || rows.length === 0) return null;

  const costOf = (r: PayrollCostRow) => r.grossRwf + r.employerRssbRwf;
  const monthOf = (periodEnd: string) => periodEnd.slice(0, 7);

  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.departmentName, (totals.get(r.departmentName) ?? 0) + costOf(r));
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name);
  const named = ranked.length > MAX_DEPARTMENT_SERIES ? ranked.slice(0, MAX_DEPARTMENT_SERIES - 1) : ranked;
  const folds = ranked.length > named.length;
  const series: VizSeries[] = [
    ...named.map((name, i) => ({ key: name, label: name, color: VIZ_SLOTS[i] })),
    ...(folds ? [{ key: "__other", label: "Other departments", color: VIZ_OTHER }] : []),
  ];
  const seriesKey = (department: string) => (named.includes(department) ? department : "__other");

  // Newest first, the order the runs list is in.
  const latestMonth = runs.map((r) => monthOf(r.periodEnd)).sort().at(-1) ?? monthOf(rows[rows.length - 1].periodEnd);
  const columns: VizColumn[] = lastSixMonths(latestMonth).map((month) => {
    const inMonth = rows.filter((r) => monthOf(r.periodEnd) === month.id);
    if (inMonth.length === 0) return { ...month, values: null };
    const values: Record<string, number> = {};
    for (const r of inMonth) values[seriesKey(r.departmentName)] = (values[seriesKey(r.departmentName)] ?? 0) + costOf(r);
    const status = inMonth[0].status;
    return { ...month, values, note: status === "paid" ? "Paid" : status === "approved" ? "Approved, not yet paid" : "Draft, not yet approved" };
  });

  const runForMonth = (monthId: string) => runs.find((r) => monthOf(r.periodEnd) === monthId);
  const selectedMonth = runs.find((r) => r.id === selectedRunId);
  const latest = columns.filter((c) => c.values).at(-1);
  const previous = columns.filter((c) => c.values).at(-2);
  const sum = (c: VizColumn | undefined) => (c?.values ? Object.values(c.values).reduce((n, v) => n + v, 0) : 0);
  const change = previous ? sum(latest) - sum(previous) : null;

  return (
    <section>
      <SectionHeading icon={ChartColumn}>Staff cost</SectionHeading>
      <div className={cn(panelClass, "mt-2.5 flex flex-col gap-4 p-5")}>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Staff cost · {latest?.long}</span>
          <span className="text-3xl leading-tight font-bold tracking-[-0.6px] text-ink">{fmt(sum(latest))}</span>
          <span className="text-xs text-muted-foreground">
            {latest?.note}
            {change !== null && change !== 0 && previous
              ? ` · ${fmt(Math.abs(change))} ${change > 0 ? "more" : "less"} than ${previous.long}`
              : ""}
          </span>
        </div>

        <StackedColumns
          series={series}
          columns={columns}
          selectedId={selectedMonth ? monthOf(selectedMonth.periodEnd) : null}
          onSelect={(monthId) => {
            const run = runForMonth(monthId);
            if (run) onSelectRun(run.id);
          }}
          format={fmt}
          formatTick={rwfCompact}
          totalLabel="Staff cost"
        />
      </div>
    </section>
  );
}

/* ── A payroll run ──────────────────────────────────────────────────────── */

const RUN_STEPS = ["draft", "approved", "paid"] as const;
const RUN_STEP_LABEL: Record<(typeof RUN_STEPS)[number], string> = {
  draft: "Draft",
  approved: "Approved",
  paid: "Paid",
};

/** A plain grouped figure. The column header carries the currency. */
function num(amount: number): string {
  return new Intl.NumberFormat("en-RW", { maximumFractionDigits: 0 }).format(amount);
}

/** A stored UTC date, read as that date wherever the browser is. */
function utcDay(iso: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleDateString(undefined, { timeZone: "UTC", ...options });
}

/** Draft → Approved → Paid, with where this run has got to. */
function RunSteps({ status }: { status: string }) {
  const at = RUN_STEPS.indexOf(status as (typeof RUN_STEPS)[number]);
  return (
    <ol aria-label={`Run status: ${status}`} className="flex items-center gap-2">
      {RUN_STEPS.map((step, i) => {
        const reached = at >= i;
        return (
          <li key={step} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden className={cn("h-0.5 w-7 rounded-full", reached ? "bg-primary" : "bg-line")} />}
            <span
              aria-hidden
              className={cn("size-2.5 rounded-full border-2", reached ? "border-primary bg-primary" : "border-line2 bg-transparent")}
            />
            <span className={cn("text-xs", at === i ? "font-bold" : "font-medium", reached ? "text-ink" : "text-muted-foreground")}>
              {RUN_STEP_LABEL[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const headCell = "py-2 pr-3 text-2xs font-bold tracking-[0.05em] uppercase text-[var(--muted2)]";
const figureCell = "pms-num py-2.5 pr-3 text-right align-top";

/** `payslip-2026-10-beatha-mukandayisenga.pdf`, for when the browser cannot read the name the API sent. */
function pdfName(periodEnd: string, name: string | null): string {
  const who = (name ?? "employee").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `payslip-${periodEnd.slice(0, 7)}-${who || "employee"}.pdf`;
}

function RunCard({
  run,
  open,
  onToggle,
}: {
  run: PayrollRunRow;
  open: boolean;
  onToggle: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const { toast, toastError } = usePms();
  const payslips = usePayslips(workspaceId, open ? run.id : null);
  const approveRun = useApprovePayrollRun(workspaceId);
  const markPaid = useMarkPayrollRunPaid(workspaceId);
  const recalculate = useRecalculatePayrollRun(workspaceId);
  const discard = useDiscardPayrollRun(workspaceId);
  // The payslips whose lines are open, and the one whose PDF is being made.
  const [openSlips, setOpenSlips] = useState<ReadonlySet<string>>(new Set());
  const [downloading, setDownloading] = useState<string | null>(null);

  const slips = (payslips.data ?? [])
    .slice()
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "") || a.departmentName.localeCompare(b.departmentName));
  const total = (pick: (p: PayslipRow) => number) => slips.reduce((n, p) => n + pick(p), 0);
  const gross = total((p) => p.grossRwf);
  const paye = total((p) => p.payeRwf);
  const rssb = total((p) => p.rssbEmployeeRwf);
  const employerRssb = total((p) => p.rssbEmployerRwf);
  const net = total((p) => p.netRwf);
  const people = new Set(slips.map((p) => p.name ?? p.departmentMemberId)).size;
  const missed = total((p) => p.attendance?.missedDays ?? 0);
  const overtime = total((p) => p.attendance?.overtimeMinutes ?? 0);

  const toggleSlip = (id: string) =>
    setOpenSlips((ids) => {
      const next = new Set(ids);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const download = (slip: PayslipRow) => {
    if (!workspaceId || downloading) return;
    setDownloading(slip.id);
    downloadPayslipPdf(workspaceId, `/ops/payroll/payslips/${slip.id}/pdf`, pdfName(run.periodEnd, slip.name))
      .catch(toastError)
      .finally(() => setDownloading(null));
  };

  return (
    <article className={cn(panelClass, "mt-3 overflow-hidden")}>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="flex min-w-0 flex-[1_1_14rem] cursor-pointer flex-col gap-0.5 bg-transparent text-left"
        >
          <span className="text-base font-semibold text-ink">{utcDay(run.periodEnd, { month: "long", year: "numeric" })}</span>
          <span className="text-2xs text-muted-foreground">
            {utcDay(run.periodStart, { day: "numeric", month: "short" })} to{" "}
            {utcDay(run.periodEnd, { day: "numeric", month: "short", year: "numeric" })} ·{" "}
            <span className="font-semibold text-accent-text">{open ? "Hide payslips" : "View payslips"}</span>
          </span>
        </button>

        <RunSteps status={run.status} />

        <div className="flex flex-col text-right">
          <span className="text-2xs text-muted-foreground">Net pay</span>
          <span className="pms-num text-base font-bold text-ink">{fmt(run.totalNetRwf)}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {run.status === "draft" && (
            <>
              <ActionButton
                pending={recalculate.isPending}
                onClick={() =>
                  recalculate.mutate(
                    { payrollRunId: run.id },
                    { onSuccess: () => toast("Run recalculated from today's salaries and attendance", "ok"), onError: toastError },
                  )
                }
              >
                Recalculate
              </ActionButton>
              <ActionButton
                pending={discard.isPending}
                onClick={() =>
                  discard.mutate(
                    { payrollRunId: run.id },
                    { onSuccess: () => toast("Draft run discarded", "ok"), onError: toastError },
                  )
                }
              >
                Discard
              </ActionButton>
              <ActionButton
                variant="primary"
                pending={approveRun.isPending}
                onClick={() =>
                  approveRun.mutate(
                    { payrollRunId: run.id },
                    { onSuccess: () => toast("Run approved. Employees can now see their payslips.", "ok"), onError: toastError },
                  )
                }
              >
                Approve
              </ActionButton>
            </>
          )}
          {run.status === "approved" && (
            <ActionButton
              variant="primary"
              pending={markPaid.isPending}
              onClick={() =>
                markPaid.mutate(
                  { payrollRunId: run.id },
                  { onSuccess: () => toast("Run marked paid", "ok"), onError: toastError },
                )
              }
            >
              Mark paid
            </ActionButton>
          )}
          {run.status === "paid" && <Badge intent="ok">Paid</Badge>}
        </div>
      </header>

      {open && (
        <div className="flex flex-col gap-4 border-t border-line px-5 pt-4 pb-5">
          {payslips.isPending ? (
            <Skeleton height={120} />
          ) : payslips.isError ? (
            <p className="text-sm text-muted-foreground">Couldn&apos;t load payslips for this run.</p>
          ) : slips.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payslips on this run.</p>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <StatCard
                  n={fmt(net)}
                  label={`Net pay to staff · ${people} ${people === 1 ? "person" : "people"}, ${slips.length} ${slips.length === 1 ? "payslip" : "payslips"}`}
                />
                <StatCard n={fmt(paye + rssb)} label="Tax and contributions withheld" />
                <StatCard n={fmt(gross + employerRssb)} label="Cost to the business" />
              </div>

              {(missed > 0 || overtime > 0) && (
                <p className="text-sm text-ink2">
                  From the roster and the clock:
                  {missed > 0 ? ` ${missed} missed ${missed === 1 ? "shift" : "shifts"} taken off` : ""}
                  {missed > 0 && overtime > 0 ? "," : ""}
                  {overtime > 0 ? ` ${hoursText(overtime)} of overtime added` : ""}.
                  {run.status === "draft" ? " Correct a day on the Attendance tab, then Recalculate." : ""}
                </p>
              )}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[52rem] text-sm">
                  <caption className="sr-only">Payslips</caption>
                  <thead>
                    <tr className="border-b border-line text-left">
                      <th scope="col" className={headCell}>Employee</th>
                      <th scope="col" className={headCell}>The month</th>
                      <th scope="col" className={cn(headCell, "text-right")}>Gross (RWF)</th>
                      <th scope="col" className={cn(headCell, "text-right")}>PAYE</th>
                      <th scope="col" className={cn(headCell, "text-right")}>RSSB, CBHI</th>
                      <th scope="col" className={cn(headCell, "text-right")}>Net pay</th>
                      <th scope="col" className={cn(headCell, "pr-0 text-right")}>
                        <span className="sr-only">Lines and PDF</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {slips.map((p) => {
                      const shown = openSlips.has(p.id);
                      const a = p.attendance;
                      const rostered = a !== null && (a.rosteredDays > 0 || a.workedDays > 0);
                      const notes = a
                        ? [
                            a.missedDays > 0 ? `${a.missedDays} missed` : null,
                            a.unpaidLeaveDays > 0 ? `${a.unpaidLeaveDays} unpaid leave` : null,
                            a.lateDays > 0 ? `${a.lateDays} late` : null,
                            a.overtimeMinutes > 0 ? `${hoursText(a.overtimeMinutes)} over` : null,
                          ].filter(Boolean)
                        : [];
                      return (
                        <Fragment key={p.id}>
                          <tr className={cn(!shown && "border-b border-line")}>
                            <td className="py-2.5 pr-3 align-top">
                              <span className="flex min-w-0 items-center gap-2.5">
                                <Initials size={30}>{initials(p.name ?? "?")}</Initials>
                                <span className="flex min-w-0 flex-col gap-0.5">
                                  <span className="truncate font-semibold text-ink">{p.name ?? "Unknown"}</span>
                                  <span className="truncate text-2xs text-muted-foreground">
                                    {[p.jobTitle, p.departmentName].filter(Boolean).join(" · ")}
                                  </span>
                                </span>
                              </span>
                            </td>
                            <td className="py-2.5 pr-3 align-top">
                              {a && rostered ? (
                                <span className="flex flex-col gap-0.5">
                                  <span className="pms-num text-ink">
                                    {a.workedDays} of {a.rosteredDays} shifts
                                  </span>
                                  {notes.length > 0 && (
                                    <span className={cn("pms-num text-2xs", a.missedDays > 0 ? "text-warn" : "text-muted-foreground")}>
                                      {notes.join(" · ")}
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-2xs text-faint">{a ? "Not rostered" : "Before attendance was read"}</span>
                              )}
                            </td>
                            <td className={cn(figureCell, "text-ink")}>{num(p.grossRwf)}</td>
                            <td className={cn(figureCell, "text-muted-foreground")}>− {num(p.payeRwf)}</td>
                            <td className={cn(figureCell, "text-muted-foreground")}>− {num(p.rssbEmployeeRwf)}</td>
                            <td className={cn(figureCell, "font-bold text-ink")}>{num(p.netRwf)}</td>
                            <td className="py-2 align-top">
                              <span className="flex justify-end gap-2">
                                {p.lines.length > 0 && (
                                  <ActionButton aria-expanded={shown} onClick={() => toggleSlip(p.id)}>
                                    {shown ? "Hide lines" : "Lines"}
                                  </ActionButton>
                                )}
                                <ActionButton icon={FileDown} pending={downloading === p.id} onClick={() => download(p)}>
                                  PDF
                                </ActionButton>
                              </span>
                            </td>
                          </tr>
                          {shown && (
                            <tr className="border-b border-line">
                              <td colSpan={7} className="pb-3">
                                <div className="rounded border border-line bg-field px-4 py-3">
                                  <PayslipLines lines={p.lines} />
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold text-ink">
                      <th scope="row" className="pt-3 pr-3 text-left">Total</th>
                      <td />
                      <td className={cn(figureCell, "pt-3 pb-0")}>{num(gross)}</td>
                      <td className={cn(figureCell, "pt-3 pb-0")}>− {num(paye)}</td>
                      <td className={cn(figureCell, "pt-3 pb-0")}>− {num(rssb)}</td>
                      <td className={cn(figureCell, "pt-3 pb-0")}>{num(net)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </article>
  );
}
