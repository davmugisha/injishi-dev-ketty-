"use client";

/**
 * One pay run (ADR-058, AC-Y1 to AC-Y4): its totals, what blocks confirming it,
 * and every payslip with the lines its figures are the sums of.
 *
 * Each amount on a payslip is a sum of its lines, and the lines say how they
 * were reached ("210000 a month × 15/30"), so an owner can check a figure by
 * hand before freezing it.
 */

import type { PayRunDetail, Payslip } from "@injishi/contracts";
import Link from "next/link";
import { useState } from "react";

import { ObjectPage } from "../../components/object-page";
import {
  ActionButton,
  Badge,
  EmptyState,
  LoadFailed,
  SectionHeading,
  Skeleton,
  StatCard,
} from "../../components/ui";
import { useWorkspaceId } from "../../data/capability";
import { usePayRun, usePayRunCommand } from "../../data/people";
import { dshortIso, fmt } from "../../lib/format";
import { workspaceBase } from "../../lib/nav";
import { usePms } from "../../store";
import { monthName } from "./payroll";
import { FormError, RowList, blockersOf, rowClass } from "./staff-ui";

export function PayRunPage({ runId }: { runId: string }) {
  const workspaceId = useWorkspaceId();
  const query = usePayRun(workspaceId, runId);

  if (query.isPending) {
    return (
      <div className="pms-enter flex max-w-wide flex-col gap-4">
        <Skeleton height={40} />
        <Skeleton height={260} delay={60} />
      </div>
    );
  }
  if (query.isError) {
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load this pay run. Nothing on it has changed — this is on our side.
      </LoadFailed>
    );
  }
  return <RunBody detail={query.data} />;
}

function RunBody({ detail }: { detail: PayRunDetail }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const act = usePayRunCommand(workspaceId);
  const { run, payslips, blockers } = detail;
  const draft = run.status === "draft";
  const staff = `${workspaceBase(workspaceId)}/staff`;
  const refused = blockersOf(act.error);
  const shownBlockers = refused.length > 0 ? refused : blockers;

  return (
    <ObjectPage
      title={`Pay for ${monthName(run.period)}`}
      subtitle={
        draft
          ? `Draft, computed ${dshortIso(run.computedAt)}`
          : `Confirmed ${dshortIso(run.confirmedAt ?? "")}. It never changes; a correction goes on a later run.`
      }
      status={draft ? { label: "Draft", intent: "warn" } : { label: "Confirmed", intent: "ok" }}
      lenses={[]}
      active=""
    >
      <div className="mt-5 flex max-w-wide flex-col gap-6">
        <div className="grid gap-3 md:grid-cols-4">
          <StatCard n={fmt(run.grossRwf)} label="Gross" />
          <StatCard n={fmt(run.payeRwf)} label="PAYE" />
          <StatCard n={fmt(run.employeeContributionsRwf)} label="Employee contributions" />
          <StatCard n={fmt(run.netRwf)} label="Net to pay" />
        </div>
        <p className="text-2xs text-muted-foreground">
          The business also owes {fmt(run.employerContributionsRwf)} in employer contributions, declared and
          not deducted. Computed from{" "}
          {run.ruleVersions.map((r) => `${r.configType} version ${r.version}`).join(" and ")}.
        </p>

        {draft && (
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton
              pending={act.isPending && act.variables?.action === "recompute"}
              onClick={() => act.mutate({ id: run.id, action: "recompute" }, { onSuccess: () => toast("Computed again from today's rows", "ok") })}
            >
              Compute again
            </ActionButton>
            <ActionButton
              variant="primary"
              pending={act.isPending && act.variables?.action === "confirm"}
              deniedReason={shownBlockers.length > 0 ? "Fix what is listed below first" : undefined}
              onClick={() => act.mutate({ id: run.id, action: "confirm" }, { onSuccess: () => toast(`Pay for ${monthName(run.period)} confirmed`, "ok") })}
            >
              Confirm and freeze
            </ActionButton>
          </div>
        )}
        {refused.length === 0 && <FormError error={act.error} />}

        {draft && shownBlockers.length > 0 && (
          <section>
            <SectionHeading n={shownBlockers.length}>Before this can be confirmed</SectionHeading>
            <RowList>
              {shownBlockers.map((b, i) => (
                <Link key={`${b.employeeId}-${i}`} href={`${staff}/${b.employeeId}`} className={`${rowClass(i)} block text-sm text-ink no-underline hover:bg-hover`}>
                  {b.message}
                </Link>
              ))}
            </RowList>
          </section>
        )}

        <section>
          <SectionHeading n={payslips.length}>Payslips</SectionHeading>
          {payslips.length === 0 ? (
            <EmptyState className="mt-2.5 p-6">Nobody has a contract in this month, so nobody is paid.</EmptyState>
          ) : (
            <RowList>
              {payslips.map((p, i) => (
                <SlipRow key={p.id} slip={p} index={i} />
              ))}
            </RowList>
          )}
        </section>
      </div>
    </ObjectPage>
  );
}

function SlipRow({ slip, index }: { slip: Payslip; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={rowClass(index)} data-payslip={slip.employeeNumber}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-3 bg-transparent text-left"
      >
        <span className="pms-num w-14 shrink-0 text-2xs text-muted-foreground">{slip.employeeNumber}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-semibold text-ink">{slip.displayName}</span>
          <span className="pms-num text-2xs text-muted-foreground">{slip.payableDays}/30 payable</span>
        </span>
        <span className="pms-num text-right text-sm text-ink2">
          <span className="block">{fmt(slip.netRwf)} net</span>
          <span className="block text-2xs text-muted-foreground">{fmt(slip.grossRwf)} gross</span>
        </span>
        <Badge>{open ? "Hide lines" : "Lines"}</Badge>
      </button>
      {open && (
        <table className="mt-3 w-full border-t border-line text-sm">
          <tbody>
            {slip.lines.map((l, i) => (
              <tr key={`${l.code}-${l.side}-${i}`} className="border-b border-line last:border-b-0">
                <td className="py-1.5 pr-3 text-ink">{l.label}</td>
                <td className="py-1.5 pr-3 text-2xs text-muted-foreground">{l.basis}</td>
                <td className="pms-num py-1.5 text-right text-ink2">
                  {l.side === "earning" ? "" : l.side === "employer" ? "(employer) " : "−"}
                  {fmt(Math.abs(l.amountRwf))}
                  {l.side === "earning" && l.amountRwf < 0 ? " off" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
