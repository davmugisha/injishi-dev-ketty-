"use client";

/**
 * Staff · Payroll (ADR-058 AC-Y1 to AC-Y4; 058-payroll in full).
 *
 * Nine sections, each a route segment under `/staff/payroll`: the Overview
 * (the dashboard above the runs), Payslips across runs with their paid status,
 * every Contract, Loans and advances, Claims, Adjustments, the allowances and
 * deductions with the structures that group them, the national Rules in force
 * and the payroll Settings. A section the grant does not reach is not offered,
 * and typed by URL it says so rather than opening empty.
 *
 * One run per month. A draft is a preview that can be computed again as the
 * month changes; confirming computes it once more and freezes it, and a
 * confirmed run never changes: a correction is an adjustment on a later month.
 * PAYE, RSSB, overtime and a leaver's settlement come from rule rows in force;
 * with one missing, the run that needs it is refused in words, never paid at
 * zero. On a sample database those rows are placeholders marked DEMO SAMPLE
 * DATA.
 */

import { ListQuery, PAY_RUN_LIST, type PayRun } from "@injishi/contracts";
import { BarList, DataView, Input, type DataColumn } from "@injishi/ui";
import { Coins, CreditCard, Receipt, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ComponentType } from "react";

import { ActionButton, Badge, EmptyState, SectionHeading } from "../../components/ui";
import { useWorkspaceId } from "../../data/capability";
import { useListUrl, useSavedViewsFor } from "../../data/lists";
import { useCreatePayRun, usePayRunPage } from "../../data/people";
import { usePayrollDashboard } from "../../data/payroll";
import { fmt, todayIso } from "../../lib/format";
import { workspaceBase } from "../../lib/nav";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { PayAdjustments } from "./payroll-adjustments";
import { PayClaims } from "./payroll-claims";
import { PayComponents } from "./payroll-components";
import { PayContracts } from "./payroll-contracts";
import { PayLoans } from "./payroll-loans";
import { Payslips } from "./payroll-payslips";
import { PayRules } from "./payroll-rules";
import { PaySettings } from "./payroll-settings";
import { PAYROLL_SECTIONS, PayrollNav, monthName, type PayrollSection } from "./payroll-ui";
import { Figure } from "./staff-look";
import { Field, FormError } from "./staff-ui";

export { monthName } from "./payroll-ui";

const SECTION_SCREEN: Record<PayrollSection, ComponentType> = {
  overview: Overview,
  payslips: Payslips,
  contracts: PayContracts,
  loans: PayLoans,
  claims: PayClaims,
  adjustments: PayAdjustments,
  components: PayComponents,
  rules: PayRules,
  settings: PaySettings,
};

export function Payroll({ section = "overview" }: { section?: string }) {
  const { state } = usePms();
  const workspaceId = useWorkspaceId();
  const permissions = currentGrant(state)?.permissions ?? [];
  const reachable = PAYROLL_SECTIONS.filter((s) => s.anyPermission.some((p) => permissions.includes(p)));
  const asked = PAYROLL_SECTIONS.find((s) => s.key === section)?.key ?? "overview";
  // `/staff/payroll` itself is the Overview. Somebody who writes contracts but
  // does not run pay lands on Contracts instead of a refusal at the door.
  const active = asked === "overview" && !reachable.some((s) => s.key === "overview") ? (reachable[0]?.key ?? asked) : asked;
  const allowed = reachable.some((s) => s.key === active);
  const Screen = SECTION_SCREEN[active];

  return (
    <div className="flex flex-col gap-4">
      {reachable.length > 1 && <PayrollNav base={`${workspaceBase(workspaceId)}/staff`} active={active} sections={reachable} />}
      {allowed ? (
        <Screen />
      ) : (
        <EmptyState style={{ padding: 26, fontSize: 13.5 }}>
          Your role does not open this part of Payroll. An owner can change what your role allows in Team &amp;
          Departments.
        </EmptyState>
      )}
    </div>
  );
}

function Overview() {
  return (
    <div className="pms-enter flex max-w-page flex-col gap-6">
      <Dashboard />
      <Runs />
    </div>
  );
}

/** The months so far and what is still open (AC-PY15): the business's totals, never a person's. */
function Dashboard() {
  const workspaceId = useWorkspaceId();
  const dashboard = usePayrollDashboard(workspaceId);
  const base = `${workspaceBase(workspaceId)}/staff/payroll`;
  const d = dashboard.data;
  if (!d) return null;
  const latest = d.months[0];
  const months = d.months.slice(0, 6);
  return (
    <section className="@container flex flex-col gap-3" aria-label="Payroll at a glance">
      <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
        <Figure icon={Wallet} n={latest ? fmt(latest.netRwf) : "—"} label={latest ? `Net pay, ${monthName(latest.period)}` : "No run yet"} tone="accent" />
        <Figure icon={Coins} n={String(d.unpaidPayslips)} label="Payslips waiting to be paid" tone={d.unpaidPayslips > 0 ? "warn" : "neutral"} href={`${base}/payslips`} />
        <Figure icon={Receipt} n={String(d.claimsWaiting)} label="Claims to decide" tone={d.claimsWaiting > 0 ? "warn" : "neutral"} href={`${base}/claims`} />
        <Figure icon={CreditCard} n={fmt(d.openLoansRwf)} label="Still owed on loans" href={`${base}/loans`} />
      </div>
      {months.length > 0 && (
        <div className="rounded-card border border-card-bd bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-ink">Net pay by month</h3>
          <BarList
            aria-label="Net pay by month"
            rows={months.map((m) => ({
              key: m.period,
              label: monthName(m.period),
              value: m.netRwf,
              display: fmt(m.netRwf),
              detail: `${m.headcount} ${m.headcount === 1 ? "person" : "people"} · PAYE ${fmt(m.payeRwf)}${m.status === "draft" ? " · draft" : ""}`,
              muted: m.status === "draft",
            }))}
          />
        </div>
      )}
      {d.adjustmentsOpen > 0 && (
        <p className="text-2xs text-muted-foreground">
          {d.adjustmentsOpen} adjustment{d.adjustmentsOpen === 1 ? "" : "s"} wait for the next open month.{" "}
          <Link href={`${base}/adjustments`} className="underline-offset-2 hover:underline">
            See them
          </Link>
        </p>
      )}
    </section>
  );
}

function Runs() {
  const { toast } = usePms();
  const router = useRouter();
  const workspaceId = useWorkspaceId();
  const create = useCreatePayRun(workspaceId);
  const [period, setPeriod] = useState(todayIso().slice(0, 7));
  const base = `${workspaceBase(workspaceId)}/staff/payroll`;
  const { defaultView, savedViews } = useSavedViewsFor(workspaceId, PAY_RUN_LIST.key);
  const list = useListUrl(PAY_RUN_LIST, "full", defaultView);
  const page = usePayRunPage(workspaceId, list.state.query);
  // One run per month: whether the month chosen already has one, asked of the route itself.
  const sameMonth = usePayRunPage(
    workspaceId,
    ListQuery.parse({ filters: [{ field: "periodStart", op: "eq", value: `${period}-01` }], pageSize: 10 }),
  );
  const exists = (sameMonth.data?.total ?? 0) > 0;

  const columns: DataColumn<PayRun>[] = [
    {
      key: "periodStart",
      header: "Month",
      cell: (r) => (
        <Link href={`${base}/${r.id}`} data-pay-run={r.period} className="font-semibold text-foreground no-underline hover:underline">
          {monthName(r.period)}
        </Link>
      ),
    },
    { key: "headcount", header: "People", align: "end", cell: (r) => r.headcount },
    { key: "grossRwf", header: "Gross", align: "end", cell: (r) => fmt(r.grossRwf) },
    { key: "netRwf", header: "Net", align: "end", cell: (r) => fmt(r.netRwf) },
    {
      key: "status",
      header: "Status",
      cell: (r) => <Badge intent={r.status === "confirmed" ? "ok" : "warn"}>{r.status === "confirmed" ? "Confirmed" : "Draft"}</Badge>,
    },
  ];

  return (
    <>
      <form
        className="flex flex-wrap items-end gap-3 rounded-card border border-card-bd bg-card p-4"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (exists) return;
          create.mutate(
            { period },
            {
              onSuccess: (detail) => {
                toast(`Draft pay run for ${monthName(detail.run.period)} computed`, "ok");
                router.push(`${base}/${detail.run.id}`);
              },
            },
          );
        }}
      >
        <div className="min-w-0 flex-1">
          <Field label="Month" hint="A draft can be computed again until it is confirmed. Settings can draft it by itself." htmlFor="pay-month">
            <Input id="pay-month" type="month" value={period} onChange={(e) => e.target.value && setPeriod(e.target.value)} className="h-10 w-auto rounded border-line2 bg-card text-sm" />
          </Field>
        </div>
        <ActionButton
          variant="primary"
          type="submit"
          pending={create.isPending}
          deniedReason={exists ? `${monthName(period)} already has a run` : undefined}
        >
          {create.isPending ? "Computing" : `Run pay for ${monthName(period)}`}
        </ActionButton>
        <div className="w-full">
          <FormError error={create.error} />
        </div>
      </form>

      <section className="flex flex-col gap-3">
        <SectionHeading n={page.data?.total}>Pay runs</SectionHeading>
        <DataView
          spec={PAY_RUN_LIST}
          reader="full"
          state={list.state}
          onStateChange={list.setState}
          dropped={list.dropped}
          onDismissDropped={list.dismissDropped}
          page={page.data}
          status={page.isError ? "error" : page.isPending ? "loading" : "ready"}
          onRetry={() => void page.refetch()}
          columns={columns}
          getRowId={(r) => r.id}
          labelOf={(r) => monthName(r.period)}
          caption="Pay runs"
          savedViews={savedViews}
          empty={{
            title: "No pay run yet",
            body: "Everyone with a contract in the month is on it, whether or not they have an account.",
          }}
        />
      </section>
    </>
  );
}
