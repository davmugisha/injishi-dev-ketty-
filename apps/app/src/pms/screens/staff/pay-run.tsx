"use client";

/**
 * One pay run (ADR-058, AC-Y1 to AC-Y4; 058-payroll AC-PY7, AC-PY10 to
 * AC-PY12): its totals, what blocks confirming it and how to clear each, and
 * every payslip with the lines its figures are the sums of.
 *
 * Each amount on a payslip is a sum of its lines, and the lines say how they
 * were reached ("210000 a month × 15.48/30"), so an owner can check a figure by
 * hand before freezing it. A draft may hold one person's payslip to next month
 * (their month's earnings wait as an adjustment, their installment moves on);
 * a person who would be paid less than nothing blocks the run until an
 * installment is deferred, a deduction waived or the payslip held. A confirmed
 * run prints as one PDF, and builds the bank and MoMo files and the PAYE and
 * RSSB declarations, each stored and fetched again as a five minute link.
 */

import type { PayDeclarationKind, PayExportKind, PayFileResult, PayRunBlocker, PayRunDetail, Payslip } from "@injishi/contracts";
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
import { openFileLink } from "../../data/people-file";
import { usePayRun, usePayRunCommand } from "../../data/people";
import { downloadPayPdf, useBuildPayFile, useHoldPayslip, usePayFiles } from "../../data/payroll";
import { dshortIso, fmt, kigaliDateOf } from "../../lib/format";
import { workspaceBase } from "../../lib/nav";
import { usePms } from "../../store";
import { ReasonForm, SIDE_GROUP, lineAmount, monthName } from "./payroll-ui";
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
  const hold = useHoldPayslip(workspaceId);
  const [holding, setHolding] = useState<{ employeeId: string; name: string } | null>(null);
  const [printError, setPrintError] = useState<unknown>(null);
  const { run, payslips, blockers } = detail;
  const draft = run.status === "draft";
  const staff = `${workspaceBase(workspaceId)}/staff`;
  const refused = blockersOf(act.error) as PayRunBlocker[];
  const shownBlockers = refused.length > 0 ? refused : blockers;

  const printAll = () => {
    if (!workspaceId) return;
    setPrintError(null);
    void downloadPayPdf(workspaceId, `/ops/pay-runs/${run.id}/payslips.pdf`).catch(setPrintError);
  };

  return (
    <ObjectPage
      title={`Pay for ${monthName(run.period)}`}
      subtitle={
        draft
          ? `Draft, computed ${dshortIso(kigaliDateOf(run.computedAt))}`
          : `Confirmed ${dshortIso(kigaliDateOf(run.confirmedAt ?? ""))}. It never changes; a correction goes on a later month as an adjustment.`
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
          {run.ruleVersions.map((r) => `${r.configType} version ${r.version}`).join(", ")}.
        </p>

        {draft ? (
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
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton onClick={printAll}>Print every payslip</ActionButton>
            <Link href={`${staff}/payroll/payslips`} className="text-sm text-muted-foreground underline-offset-2 hover:underline">
              Mark them paid in Payslips
            </Link>
          </div>
        )}
        {refused.length === 0 && <FormError error={act.error} />}
        <FormError error={printError} />

        {holding && (
          <ReasonForm
            title={`Hold ${holding.name}'s payslip to next month. Their earnings this month wait as an adjustment, and their installment moves a month on.`}
            action="Hold"
            pending={hold.isPending}
            error={hold.error}
            onCancel={() => setHolding(null)}
            onSubmit={(reason) =>
              hold.mutate(
                { runId: run.id, employeeId: holding.employeeId, reason },
                {
                  onSuccess: () => {
                    toast(`${holding.name}'s payslip is held to next month`, "ok");
                    setHolding(null);
                  },
                },
              )
            }
          />
        )}

        {draft && shownBlockers.length > 0 && (
          <section>
            <SectionHeading n={shownBlockers.length}>Before this can be confirmed</SectionHeading>
            <RowList>
              {shownBlockers.map((b, i) => (
                <BlockerRow
                  key={`${b.employeeId}-${b.code}-${i}`}
                  blocker={b}
                  index={i}
                  staff={staff}
                  onHold={() => b.employeeId && setHolding({ employeeId: b.employeeId, name: b.displayName })}
                />
              ))}
            </RowList>
          </section>
        )}

        {!draft && <Files runId={run.id} />}

        <section>
          <SectionHeading n={payslips.length}>Payslips</SectionHeading>
          {payslips.length === 0 ? (
            <EmptyState className="mt-2.5 p-6">Nobody has a contract in this month, so nobody is paid.</EmptyState>
          ) : (
            <RowList>
              {payslips.map((p, i) => (
                <SlipRow
                  key={p.id}
                  slip={p}
                  index={i}
                  draft={draft}
                  onHold={() => setHolding({ employeeId: p.employeeId, name: p.displayName })}
                  onPrint={() => {
                    if (!workspaceId) return;
                    setPrintError(null);
                    void downloadPayPdf(workspaceId, `/ops/payslips/${p.id}/pdf`).catch(setPrintError);
                  }}
                />
              ))}
            </RowList>
          )}
        </section>
      </div>
    </ObjectPage>
  );
}

/** One reason the run cannot be confirmed, with the remedies that clear it. */
function BlockerRow({ blocker, index, staff, onHold }: { blocker: PayRunBlocker; index: number; staff: string; onHold: () => void }) {
  const remedies = blocker.remedies ?? [];
  // A rule or a business setting blocks the whole run, not a person.
  const fixAt =
    blocker.code === "missing_rssb_employer_number"
      ? `${staff}/payroll/settings`
      : blocker.employeeId === null
        ? `${staff}/payroll/rules`
        : `${staff}/${blocker.employeeId}`;
  return (
    <div className={`${rowClass(index)} flex flex-wrap items-center gap-3`} data-blocker={blocker.code}>
      <Link href={fixAt} className="min-w-0 flex-1 text-sm text-ink no-underline hover:underline">
        {blocker.message}
      </Link>
      {remedies.includes("defer_installment") && (
        <Link href={`${staff}/payroll/loans`} className="text-sm font-semibold text-accent-text no-underline hover:underline">
          Defer an installment
        </Link>
      )}
      {remedies.includes("waive_adjustment") && (
        <Link href={`${staff}/payroll/adjustments`} className="text-sm font-semibold text-accent-text no-underline hover:underline">
          Waive a deduction
        </Link>
      )}
      {remedies.includes("hold_payslip") && <ActionButton onClick={onHold}>Hold to next month</ActionButton>}
    </div>
  );
}

const FILE_LABEL: Record<PayExportKind | PayDeclarationKind, string> = {
  bank: "Bank transfer file",
  momo: "MoMo payment file",
  paye: "PAYE declaration",
  rssb: "RSSB declaration",
};

/** The files a confirmed run builds (AC-PY10, AC-PY12), each kept and fetched again as a five minute link. */
function Files({ runId }: { runId: string }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const files = usePayFiles(workspaceId, runId, true);
  const build = useBuildPayFile(workspaceId);
  const [last, setLast] = useState<PayFileResult | null>(null);
  const [openError, setOpenError] = useState<unknown>(null);

  const make = (kind: PayExportKind | PayDeclarationKind) =>
    build.mutate(
      { runId, kind },
      {
        onSuccess: (out) => {
          setLast(out);
          toast(`${FILE_LABEL[kind]} built`, "ok");
        },
      },
    );

  return (
    <section className="flex flex-col gap-3" aria-label="Files">
      <SectionHeading n={files.data?.files.length}>Files</SectionHeading>
      <p className="text-2xs text-muted-foreground">
        Every file says PROVISIONAL FORMAT on its first line until a bank&apos;s or the authority&apos;s own format is set.
        The bank and MoMo files pay each person by their primary pay account.
      </p>
      <div className="flex flex-wrap gap-2">
        {(["bank", "momo", "paye", "rssb"] as const).map((kind) => (
          <ActionButton key={kind} pending={build.isPending && build.variables?.kind === kind} onClick={() => make(kind)}>
            {FILE_LABEL[kind]}
          </ActionButton>
        ))}
      </div>
      <FormError error={build.error ?? openError} />
      {last && (
        <div className="rounded-card border border-card-bd bg-card p-4" data-built-file={last.file.kind}>
          <p className="text-sm text-ink">
            {FILE_LABEL[last.file.kind]} ready.{" "}
            <a href={last.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-text underline-offset-2 hover:underline">
              Open it
            </a>{" "}
            <span className="text-2xs text-muted-foreground">(the link lasts five minutes; Download below asks for a new one)</span>
          </p>
          {last.leftOut.length > 0 && (
            <>
              <p className="mt-3 text-sm font-semibold text-ink">Left out of it: pay them another way</p>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-ink2">
                {last.leftOut.map((l) => (
                  <li key={l.employeeId}>
                    {l.displayName}: {l.reason}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      {(files.data?.files ?? []).length > 0 && (
        <RowList>
          {(files.data?.files ?? []).map((f, i) => (
            <div key={f.id} className={`${rowClass(i)} flex flex-wrap items-center gap-3`} data-pay-file={f.kind}>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold text-ink">{FILE_LABEL[f.kind]}</span>
                <span className="text-2xs text-muted-foreground">
                  {dshortIso(kigaliDateOf(f.createdAt))}
                  {f.createdByName ? ` by ${f.createdByName}` : ""}
                  {f.rowCount !== null ? ` · ${f.rowCount} ${f.rowCount === 1 ? "person" : "people"}` : ""}
                  {f.totalRwf !== null ? ` · ${fmt(f.totalRwf)}` : ""}
                  {f.formatVersion ? ` · ${f.formatVersion}` : ""}
                </span>
              </span>
              <ActionButton
                onClick={() => {
                  if (!workspaceId) return;
                  setOpenError(null);
                  void openFileLink(workspaceId, `/ops/pay-files/${f.id}`).catch(setOpenError);
                }}
              >
                Download
              </ActionButton>
            </div>
          ))}
        </RowList>
      )}
    </section>
  );
}

function SlipRow({
  slip,
  index,
  draft,
  onHold,
  onPrint,
}: {
  slip: Payslip;
  index: number;
  draft: boolean;
  onHold: () => void;
  onPrint: () => void;
}) {
  const [open, setOpen] = useState(false);
  const groups = (["earning", "employee", "deduction", "passthrough", "employer"] as const)
    .map((side) => ({ side, lines: slip.lines.filter((l) => l.side === side) }))
    .filter((g) => g.lines.length > 0);
  return (
    <div className={rowClass(index)} data-payslip={slip.employeeNumber}>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-3 bg-transparent text-left"
        >
          <span className="pms-num w-14 shrink-0 text-2xs text-muted-foreground">{slip.employeeNumber}</span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-sm font-semibold text-ink">{slip.displayName}</span>
            <span className="pms-num text-2xs text-muted-foreground">{slip.payableDays}/30 payable</span>
          </span>
          <span className="pms-num text-right text-sm text-ink2">
            <span className="block">{fmt(slip.netRwf)} net</span>
            <span className="block text-2xs text-muted-foreground">
              {fmt(slip.grossRwf)} gross{slip.nonIncomeRwf > 0 ? ` + ${fmt(slip.nonIncomeRwf)} not income` : ""}
            </span>
          </span>
          <Badge>{open ? "Hide lines" : "Lines"}</Badge>
        </button>
        {draft ? <ActionButton onClick={onHold}>Hold</ActionButton> : <ActionButton onClick={onPrint}>PDF</ActionButton>}
      </div>
      {open && (
        <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
          {groups.map((g) => (
            <table key={g.side} className="w-full text-sm">
              <caption className="pb-1 text-left text-2xs font-bold tracking-[0.08em] uppercase text-[var(--muted2)]">
                {SIDE_GROUP[g.side]}
              </caption>
              <tbody>
                {g.lines.map((l, i) => (
                  <tr key={`${l.code}-${i}`} className="border-b border-line last:border-b-0">
                    <td className="py-1.5 pr-3 text-ink">
                      {l.label}
                      {l.side === "earning" && l.taxable === false && <span className="text-2xs text-muted-foreground"> · not taxed</span>}
                      {l.side === "deduction" && l.beforeTax && <span className="text-2xs text-muted-foreground"> · before tax</span>}
                    </td>
                    <td className="py-1.5 pr-3 text-2xs text-muted-foreground">{l.basis}</td>
                    <td className="pms-num py-1.5 text-right text-ink2">{lineAmount(l)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      )}
    </div>
  );
}
