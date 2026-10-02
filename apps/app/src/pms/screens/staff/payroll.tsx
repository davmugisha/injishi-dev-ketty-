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
 */

import { Input } from "@injishi/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  ActionButton,
  Badge,
  EmptyState,
  LoadFailed,
  SectionHeading,
  Skeleton,
} from "../../components/ui";
import { useWorkspaceId } from "../../data/capability";
import { useCreatePayRun, usePayRuns } from "../../data/people";
import { fmt, todayIso } from "../../lib/format";
import { workspaceBase } from "../../lib/nav";
import { usePms } from "../../store";
import { Field, FormError, RowList, rowClass } from "./staff-ui";

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
  const runs = usePayRuns(workspaceId);
  const create = useCreatePayRun(workspaceId);
  const [period, setPeriod] = useState(todayIso().slice(0, 7));
  const base = `${workspaceBase(workspaceId)}/staff/payroll`;

  if (runs.isPending) {
    return (
      <div className="pms-enter flex max-w-wide flex-col gap-4">
        <Skeleton height={40} />
        <Skeleton height={160} delay={60} />
      </div>
    );
  }
  if (runs.isError) {
    return (
      <LoadFailed onRetry={() => void runs.refetch()} retrying={runs.isFetching}>
        We couldn&apos;t load pay runs. Nothing about them has changed — this is on our side.
      </LoadFailed>
    );
  }

  const list = runs.data.runs;
  const exists = list.some((r) => r.period === period);

  return (
    <div className="pms-enter flex max-w-wide flex-col gap-4">
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

      <section>
        <SectionHeading n={list.length}>Pay runs</SectionHeading>
        {list.length === 0 ? (
          <EmptyState className="mt-2.5 p-6">
            No pay run yet. Everyone with a contract in the month is on it, whether or not they have an account.
          </EmptyState>
        ) : (
          <RowList>
            {list.map((r, i) => (
              <Link
                key={r.id}
                href={`${base}/${r.id}`}
                data-pay-run={r.period}
                className={`${rowClass(i)} flex flex-wrap items-center gap-3 no-underline hover:bg-hover`}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-semibold text-ink">{monthName(r.period)}</span>
                  <span className="text-2xs text-muted-foreground">
                    {r.headcount} {r.headcount === 1 ? "person" : "people"}
                  </span>
                </span>
                <span className="pms-num text-right text-sm text-ink2">
                  <span className="block">{fmt(r.netRwf)} net</span>
                  <span className="block text-2xs text-muted-foreground">{fmt(r.grossRwf)} gross</span>
                </span>
                <Badge intent={r.status === "confirmed" ? "ok" : "warn"}>{r.status === "confirmed" ? "Confirmed" : "Draft"}</Badge>
              </Link>
            ))}
          </RowList>
        )}
      </section>
    </div>
  );
}
