"use client";

/**
 * Payroll (HR module, first pass — no ADR yet, pending team review).
 *
 * Mirrors Team's shape (screens/team.tsx): gated the same way, on
 * `team.manage`, for the same reason — this is a disclosure about people's pay,
 * not operational data, and belongs to the owner/manager who already manage
 * the roster.
 *
 * NO REAL MONEY MOVES YET. "Mark paid" flips a status, matching the mock
 * payment and EBM adapters elsewhere in this codebase. PAYE and RSSB are
 * mock flat rates (server/api/src/modules/payroll/application/payroll.service.ts)
 * — not the real progressive Rwandan brackets.
 */

import { useState } from "react";

import {
  ActionButton,
  Badge,
  EmptyState,
  LoadFailed,
  SectionHeading,
  Skeleton,
} from "../components/ui";
import { useCapability, useWorkspaceId } from "../data/capability";
import {
  useApprovePayrollRun,
  useCreatePayrollRun,
  useMarkPayrollRunPaid,
  usePayrollRuns,
  usePayslips,
  useSetCompensation,
  useStaffCompensation,
} from "../data/ops";

function rwf(amount: number): string {
  return new Intl.NumberFormat("en-RW", { style: "currency", currency: "RWF", maximumFractionDigits: 0 }).format(amount);
}

export function Payroll() {
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();

  const compensation = useStaffCompensation(workspaceId);
  const runs = usePayrollRuns(workspaceId);
  const setCompensation = useSetCompensation(workspaceId);
  const createRun = useCreatePayrollRun(workspaceId);

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const payslips = usePayslips(workspaceId, selectedRunId);
  const approveRun = useApprovePayrollRun(workspaceId);
  const markPaid = useMarkPayrollRunPaid(workspaceId);

  const [salaryDraft, setSalaryDraft] = useState<Record<string, string>>({});

  if (!can("team.manage")) {
    return (
      <EmptyState style={{ padding: 26, fontSize: 13.5 }}>{reasonFor("team.manage")}</EmptyState>
    );
  }

  if (compensation.isPending || runs.isPending) {
    return (
      <div className="pms-enter flex max-w-wide flex-col gap-4">
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

  return (
    <div className="pms-enter flex max-w-wide flex-col gap-6">
      <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
        Mock figures for now — PAYE and RSSB use flat placeholder rates, not the
        real brackets. No real money moves; marking a run paid is a record, not
        a transfer.
      </span>

      {/* --- Salaries --- */}
      <section>
        <SectionHeading n={staff.length}>Salaries</SectionHeading>
        <div
          style={{
            marginTop: 10,
            background: "var(--card)",
            border: "1px solid var(--card-bd)",
            borderRadius: "var(--radius-surface)",
            overflow: "hidden",
          }}
        >
          {staff.length === 0 ? (
            <EmptyState className="p-6">No staff have a salary set yet.</EmptyState>
          ) : (
            staff.map((m, i) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 18px",
                  borderTop: i === 0 ? "1px solid transparent" : "1px solid var(--line)",
                }}
              >
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
                  {m.name ?? "Not signed in yet"}
                </span>
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                  Current: {rwf(m.baseSalaryRwf)}
                </span>
                <input
                  type="number"
                  placeholder="New salary (RWF)"
                  value={salaryDraft[m.departmentMemberId] ?? ""}
                  onChange={(e) =>
                    setSalaryDraft((prev) => ({ ...prev, [m.departmentMemberId]: e.target.value }))
                  }
                  style={{
                    width: 140,
                    padding: "6px 10px",
                    fontSize: 12.5,
                    color: "var(--ink)",
                    background: "var(--card)",
                    border: "1px solid var(--card-bd)",
                    borderRadius: 6,
                  }}
                />
                <ActionButton
                  disabled={!salaryDraft[m.departmentMemberId] || setCompensation.isPending}
                  onClick={() => {
                    const value = Number(salaryDraft[m.departmentMemberId]);
                    if (!value || value <= 0) return;
                    setCompensation.mutate(
                      { departmentMemberId: m.departmentMemberId, baseSalaryRwf: value },
                      {
                        onSuccess: () =>
                          setSalaryDraft((prev) => ({ ...prev, [m.departmentMemberId]: "" })),
                      },
                    );
                  }}
                >
                  Set
                </ActionButton>
              </div>
            ))
          )}
        </div>
      </section>

      {/* --- Payroll runs --- */}
      <section>
        <SectionHeading n={runList.length}>Payroll runs</SectionHeading>

        <ActionButton
          style={{ marginTop: 10 }}
          disabled={createRun.isPending || staff.length === 0}
          onClick={() => {
            const now = new Date();
            const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
            createRun.mutate({ periodStart, periodEnd });
          }}
        >
          Run payroll for this month
        </ActionButton>

        <div
          style={{
            marginTop: 10,
            background: "var(--card)",
            border: "1px solid var(--card-bd)",
            borderRadius: "var(--radius-surface)",
            overflow: "hidden",
          }}
        >
          {runList.length === 0 ? (
            <EmptyState className="p-6">No payroll runs yet.</EmptyState>
          ) : (
            runList.map((run, i) => (
              <div key={run.id}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 18px",
                    borderTop: i === 0 ? "1px solid transparent" : "1px solid var(--line)",
                    cursor: "pointer",
                  }}
                  onClick={() => setSelectedRunId(run.id === selectedRunId ? null : run.id)}
                >
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>
                    {new Date(run.periodStart).toLocaleDateString()} –{" "}
                    {new Date(run.periodEnd).toLocaleDateString()}
                  </span>
                  <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                    Net: {rwf(run.totalNetRwf)}
                  </span>
                  <Badge intent={run.status === "paid" ? "accent" : "info"}>{run.status}</Badge>
                  {run.status === "draft" && (
                    <ActionButton
                      disabled={approveRun.isPending}
                      onClick={() => {
                        approveRun.mutate({ payrollRunId: run.id });
                      }}
                    >
                      Approve
                    </ActionButton>
                  )}
                  {run.status === "approved" && (
                    <ActionButton
                      disabled={markPaid.isPending}
                      onClick={() => {
                        markPaid.mutate({ payrollRunId: run.id });
                      }}
                    >
                      Mark paid
                    </ActionButton>
                  )}
                </div>

                {selectedRunId === run.id && (
                  <div style={{ padding: "10px 18px 16px 18px", background: "var(--card)" }}>
                    {payslips.isPending ? (
                      <Skeleton height={80} />
                    ) : payslips.isError ? (
                      <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                        Couldn&apos;t load payslips for this run.
                      </span>
                    ) : (payslips.data ?? []).length === 0 ? (
                      <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
                        No payslips on this run.
                      </span>
                    ) : (
                      (payslips.data ?? []).map((p) => (
                        <div
                          key={p.id}
                          style={{
                            display: "flex",
                            gap: 12,
                            padding: "8px 0",
                            fontSize: 12.5,
                            color: "var(--ink)",
                            borderTop: "1px solid var(--line)",
                          }}
                        >
                          <span style={{ flex: 1, color: "var(--ink)" }}>{p.name ?? "Unknown"}</span>
                          <span style={{ color: "var(--ink)" }}>Gross: {rwf(p.grossRwf)}</span>
                          <span style={{ color: "var(--ink)" }}>PAYE: {rwf(p.payeRwf)}</span>
                          <span style={{ color: "var(--ink)" }}>RSSB: {rwf(p.rssbEmployeeRwf)}</span>
                          <span style={{ fontWeight: 600, color: "var(--ink)" }}>Net: {rwf(p.netRwf)}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}