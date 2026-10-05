"use client";

/**
 * Staff · Payroll (ADR-058, AC-Y1 to AC-Y4).
 *
 * One run per month. A draft is a preview that can be computed again as the
 * month changes; confirming computes it once more and freezes it, and a
 * confirmed run never changes. Confirm is refused, with every reason listed,
 * while anyone covered lacks an RSSB number or an ID, or has attendance in the
 * month still open or waiting for validation.
 *
 * PAYE and RSSB come from rule rows effective on the month's first day. With
 * none in force the run is refused, naming the rule; nothing here guesses a
 * rate. On a sample database those rows are placeholders marked DEMO SAMPLE
 * DATA, and the run page says which rule rows it used.
 *
 * The runs are the shared `DataView` over `PAY_RUN_LIST` (058-list-framework).
 * Its totals are the business's, never a person's, so they may sort.
 */

import { ListQuery, PAY_RUN_LIST, type PayRun } from "@injishi/contracts";
import { DataView, Input, type DataColumn } from "@injishi/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ActionButton, Badge, SectionHeading } from "../../components/ui";
import { useWorkspaceId } from "../../data/capability";
import { useListUrl, useSavedViewsFor } from "../../data/lists";
import { useCreatePayRun, usePayRunPage } from "../../data/people";
import { fmt, todayIso } from "../../lib/format";
import { workspaceBase } from "../../lib/nav";
import { usePms } from "../../store";
import { Field, FormError } from "./staff-ui";

/** `September 2026` from `2026-09`. */
export function monthName(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

export function Payroll() {
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
    <div className="pms-enter flex max-w-page flex-col gap-4">
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
          <Field label="Month" hint="A draft can be computed again until it is confirmed." htmlFor="pay-month">
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
    </div>
  );
}
