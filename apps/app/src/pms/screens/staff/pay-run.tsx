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
 *
 * ONE PERSON'S PROBLEM IS NOT EVERYBODY'S. A draft used to list what blocked
 * it and keep Confirm shut, so a cook with no RSSB number on file stopped
 * twelve other people being paid, and the one way round it (holding that
 * payslip) was offered only for a negative net. The draft now sorts its people:
 *
 *   Ready to pay          their payslips, as before
 *   To put right first    a row a person: what is wrong, where to put it
 *                         right, and "Pay next month"
 *   Carried to next month who was left out, with the way back while it is
 *                         still a draft
 *
 * and "Confirm pay for the N who are ready" does both steps: it holds each
 * person still waiting, then confirms. Nothing new on the server: a hold is
 * `POST /ops/pay-runs/:id/hold`, exactly as one press of Hold always was, and
 * the way back is waiving the adjustment the hold wrote. What stops the whole
 * run (a rule missing, the business's RSSB employer number) stops it still.
 */

import {
  ListQuery,
  type PayAdjustment,
  type PayDeclarationKind,
  type PayExportKind,
  type PayFileResult,
  type PayRunBlocker,
  type PayRunDetail,
  type Payslip,
} from "@injishi/contracts";
import { Banknote, Landmark, ShieldCheck, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { ConfirmAction } from "../../components/confirm-action";
import { ObjectPage } from "../../components/object-page";
import {
  ActionButton,
  Badge,
  EmptyState,
  LoadFailed,
  SectionHeading,
  Skeleton,
} from "../../components/ui";
import { useWorkspaceId } from "../../data/capability";
import { openFileLink } from "../../data/people-file";
import { usePayRun, usePayRunCommand } from "../../data/people";
import {
  downloadPayPdf,
  useBuildPayFile,
  useHoldPayslip,
  usePayAdjustmentPage,
  usePayFiles,
  useWaivePayAdjustment,
} from "../../data/payroll";
import { dshortIso, fmt, kigaliDateOf } from "../../lib/format";
import { workspaceBase } from "../../lib/nav";
import { usePms } from "../../store";
import { ReasonForm, SIDE_GROUP, lineAmount, monthName, nextPeriodOf } from "./payroll-ui";
import { Avatar, Figure } from "./staff-look";
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

/** A held payslip is an open adjustment; the first hundred name who a run left out. */
const ADJUSTMENTS = ListQuery.parse({ pageSize: 100 });

/** Somebody the run cannot pay yet: every reason, and their payslip when the draft has one. */
interface Waiting {
  employeeId: string;
  name: string;
  blockers: PayRunBlocker[];
  slip: Payslip | undefined;
}

function peopleWaiting(blockers: readonly PayRunBlocker[], payslips: readonly Payslip[]): Waiting[] {
  const byPerson = new Map<string, Waiting>();
  for (const b of blockers) {
    if (b.employeeId === null) continue;
    const person = byPerson.get(b.employeeId) ?? {
      employeeId: b.employeeId,
      name: b.displayName,
      blockers: [],
      slip: payslips.find((p) => p.employeeId === b.employeeId),
    };
    person.blockers.push(b);
    byPerson.set(b.employeeId, person);
  }
  return [...byPerson.values()];
}

/** The server's sentence without the name it opens with: the row already says who. */
function said(b: PayRunBlocker): string {
  const rest = b.displayName && b.message.startsWith(b.displayName) ? b.message.slice(b.displayName.length).trim() : b.message;
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/** Where each reason is put right. */
function fixesOf(person: Waiting, staff: string): { href: string; label: string }[] {
  const fixes: { href: string; label: string }[] = [];
  const add = (href: string, label: string) => {
    if (!fixes.some((f) => f.label === label)) fixes.push({ href, label });
  };
  for (const b of person.blockers) {
    const remedies = b.remedies ?? [];
    if (b.code === "open_attendance") add(`${staff}/attendance`, "Clock them out");
    else if (b.code === "unvalidated_attendance") add(`${staff}/attendance`, "Validate it");
    else if (b.code === "negative_net") {
      if (remedies.includes("defer_installment")) add(`${staff}/payroll/loans`, "Defer an installment");
      if (remedies.includes("waive_adjustment")) add(`${staff}/payroll/adjustments`, "Waive a deduction");
    } else add(`${staff}/${person.employeeId}`, "Add it on their file");
  }
  return fixes;
}

/** A hold carries the month's earnings; a negative net with nothing earned has nothing to carry. */
const canCarry = (person: Waiting): boolean =>
  person.blockers.every((b) => b.code !== "negative_net" || (b.remedies ?? []).includes("hold_payslip"));

/** The reason the trail keeps beside a hold made because the person was not ready. */
const reasonOf = (person: Waiting): string => `Not ready when the others were paid. ${person.blockers.map(said).join(" ")}`.slice(0, 480);

const peopleText = (n: number): string => `${n} ${n === 1 ? "person" : "people"}`;

function RunBody({ detail }: { detail: PayRunDetail }) {
  const { toast } = usePms();
  const workspaceId = useWorkspaceId();
  const act = usePayRunCommand(workspaceId);
  const hold = useHoldPayslip(workspaceId);
  const waive = useWaivePayAdjustment(workspaceId);
  const adjustments = usePayAdjustmentPage(workspaceId, ADJUSTMENTS);
  const [holding, setHolding] = useState<{ employeeId: string; name: string } | null>(null);
  const [asking, setAsking] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<unknown>(null);
  const [printError, setPrintError] = useState<unknown>(null);
  const { run, payslips, blockers } = detail;
  const draft = run.status === "draft";
  const staff = `${workspaceBase(workspaceId)}/staff`;
  const refused = blockersOf(act.error) as PayRunBlocker[];
  const shownBlockers = refused.length > 0 ? refused : blockers;
  const month = monthName(run.period);
  const nextMonth = monthName(nextPeriodOf(run.period)).split(" ")[0] ?? "next month";

  // What stops everyone (a rule, a business setting), and what stops one person.
  const runWide = shownBlockers.filter((b) => b.employeeId === null);
  const waiting = peopleWaiting(shownBlockers, payslips);
  const waitingIds = new Set(waiting.map((w) => w.employeeId));
  const ready = draft ? payslips.filter((p) => !waitingIds.has(p.employeeId)) : payslips;
  const readyNet = ready.reduce((sum, p) => sum + p.netRwf, 0);
  const stuck = waiting.find((w) => !canCarry(w));
  const carried = (adjustments.data?.items ?? []).filter(
    (a) => a.source === "held_payslip" && a.correctsPeriod === run.period && a.status !== "waived",
  );
  const busy = progress !== null;

  const printAll = () => {
    if (!workspaceId) return;
    setPrintError(null);
    void downloadPayPdf(workspaceId, `/ops/pay-runs/${run.id}/payslips.pdf`).catch(setPrintError);
  };

  const carryOne = (person: Waiting) =>
    hold.mutate(
      { runId: run.id, employeeId: person.employeeId, reason: reasonOf(person) },
      {
        onSuccess: () => {
          // What a refused confirm listed is stale now; the run's own list is the truth.
          act.reset();
          toast(`${person.name} is left for ${nextMonth}. Their ${month.split(" ")[0]} pay goes with it.`, "ok");
        },
      },
    );

  /** Hold everybody still waiting, then confirm: the people who are ready are paid. */
  const payTheReady = async () => {
    setBulkError(null);
    const leftOut = waiting.length;
    const paid = ready.length;
    try {
      let n = 0;
      for (const person of waiting) {
        n += 1;
        setProgress(`Leaving ${person.name} for ${nextMonth} (${n} of ${leftOut})`);
        await hold.mutateAsync({ runId: run.id, employeeId: person.employeeId, reason: reasonOf(person) });
      }
      setProgress("Confirming");
      act.reset();
      await act.mutateAsync({ id: run.id, action: "confirm" });
      toast(`Pay for ${month} is confirmed for ${peopleText(paid)}${leftOut > 0 ? `; ${leftOut} wait for ${nextMonth}` : ""}`, "ok");
    } catch (error) {
      // A refused confirm lists its own reasons below; anything else is said here.
      if (blockersOf(error).length === 0) setBulkError(error);
    } finally {
      setProgress(null);
      setAsking(false);
    }
  };

  const bringBack = (a: PayAdjustment) =>
    waive.mutate(
      { id: a.id, reason: `Brought back into ${month}'s pay before it was confirmed` },
      {
        onSuccess: () =>
          act.mutate(
            { id: run.id, action: "recompute" },
            { onSuccess: () => toast(`${a.employee.displayName} is back in ${month}'s pay`, "ok") },
          ),
      },
    );

  const headline =
    runWide.length > 0
      ? `${month} cannot be confirmed yet`
      : waiting.length === 0
        ? payslips.length === 0
          ? "Nobody is on this run"
          : `All ${payslips.length} are ready to be paid`
        : ready.length === 0
          ? "Nobody is ready to be paid yet"
          : `${ready.length} of ${ready.length + waiting.length} are ready to be paid`;
  const advice =
    runWide.length > 0
      ? "What is listed first below stops the whole run, whoever is ready. Put it right, then compute again."
      : waiting.length === 0
        ? "Confirming freezes every payslip. After that they are paid from Payslips, and a correction goes on a later month."
        : ready.length === 0
          ? `${peopleText(waiting.length)} ${waiting.length === 1 ? "has" : "have"} something to put right first.`
          : `${peopleText(waiting.length)} ${waiting.length === 1 ? "has" : "have"} something to put right first. Put it right, or confirm pay for the ${ready.length} now: the ${waiting.length === 1 ? "other is" : "others are"} paid with ${nextMonth}.`;

  return (
    <ObjectPage
      title={`Pay for ${month}`}
      subtitle={
        draft
          ? `Draft, computed ${dshortIso(kigaliDateOf(run.computedAt))}`
          : `Confirmed ${dshortIso(kigaliDateOf(run.confirmedAt ?? ""))}. It never changes; a correction goes on a later month as an adjustment.`
      }
      status={draft ? { label: "Draft", intent: "warn" } : { label: "Confirmed", intent: "ok" }}
      lenses={[]}
      active=""
    >
      <div className="@container mt-5 flex max-w-wide flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
          <Figure icon={Banknote} n={fmt(run.grossRwf)} label="Gross" />
          <Figure icon={Landmark} n={fmt(run.payeRwf)} label="PAYE, to RRA" />
          <Figure icon={ShieldCheck} n={fmt(run.employeeContributionsRwf)} label="Employees' share, to RSSB" />
          <Figure icon={Wallet} n={fmt(run.netRwf)} label="Net to pay" tone="accent" />
        </div>
        <p className="text-2xs text-muted-foreground">
          The business also owes {fmt(run.employerContributionsRwf)} in employer contributions, declared and
          not deducted. Computed from{" "}
          {run.ruleVersions.map((r) => `${r.configType} version ${r.version}`).join(", ")}.
        </p>

        {draft ? (
          <section
            aria-label="Whether this run can be confirmed"
            data-run-state={runWide.length > 0 ? "stopped" : waiting.length > 0 ? "some" : "ready"}
            className={cn(
              "flex flex-col gap-3 rounded-card border px-5 py-4",
              runWide.length > 0 || waiting.length > 0 ? "border-card-bd bg-warn-bg" : "border-accent-text bg-accent-soft",
            )}
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <span className="flex min-w-64 flex-1 flex-col gap-1">
                <span className="text-base font-bold text-ink">{headline}</span>
                <span className="text-sm text-ink2">{advice}</span>
              </span>
              <span className="flex flex-wrap gap-2">
                <ActionButton
                  pending={act.isPending && act.variables?.action === "recompute"}
                  deniedReason={busy ? "Wait for the run to finish confirming." : undefined}
                  onClick={() => act.mutate({ id: run.id, action: "recompute" }, { onSuccess: () => toast("Computed again from today's rows", "ok") })}
                >
                  Compute again
                </ActionButton>
                {runWide.length === 0 && waiting.length === 0 && payslips.length > 0 && (
                  <ConfirmAction
                    variant="primary"
                    tone="primary"
                    confirmLabel={`Yes, confirm pay for ${payslips.length}`}
                    keepLabel="Not yet"
                    pending={act.isPending && act.variables?.action === "confirm"}
                    onConfirm={() => act.mutate({ id: run.id, action: "confirm" }, { onSuccess: () => toast(`Pay for ${month} confirmed`, "ok") })}
                  >
                    Confirm and freeze
                  </ConfirmAction>
                )}
                {runWide.length === 0 && waiting.length > 0 && ready.length > 0 && !asking && (
                  <ActionButton
                    variant="primary"
                    deniedReason={stuck ? `${stuck.name} cannot be left for next month: put that right by hand first.` : undefined}
                    onClick={() => setAsking(true)}
                  >
                    Confirm pay for the {ready.length} who are ready
                  </ActionButton>
                )}
              </span>
            </div>

            {asking && (
              <div className="flex flex-col gap-3 border-t border-line2 pt-3" data-pay-the-ready>
                <p className="text-sm text-ink">
                  This confirms pay for <strong>{peopleText(ready.length)}</strong>, {fmt(readyNet)} net, and leaves{" "}
                  <strong>{waiting.map((w) => w.name).join(", ")}</strong> out of {month.split(" ")[0]}. What they earned this
                  month is paid with {nextMonth}&apos;s run instead. Confirming freezes the payslips and cannot be undone.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <ActionButton variant="primary" pending={busy} onClick={() => void payTheReady()}>
                    {progress ?? `Yes, confirm pay for ${ready.length}`}
                  </ActionButton>
                  {!busy && <ActionButton onClick={() => setAsking(false)}>Not yet</ActionButton>}
                </div>
              </div>
            )}
            <FormError error={bulkError} />
            {refused.length === 0 && <FormError error={act.error} />}
          </section>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton onClick={printAll}>Print every payslip</ActionButton>
            <Link href={`${staff}/payroll/payslips`} className="text-sm text-muted-foreground underline-offset-2 hover:underline">
              Mark them paid in Payslips
            </Link>
          </div>
        )}
        <FormError error={printError} />

        {draft && runWide.length > 0 && (
          <section>
            <SectionHeading n={runWide.length}>This stops the whole run</SectionHeading>
            <RowList>
              {runWide.map((b, i) => (
                <div key={`${b.code}-${i}`} className={`${rowClass(i)} flex flex-wrap items-center gap-3`} data-blocker={b.code}>
                  <span className="min-w-0 flex-1 text-sm text-ink">{b.message}</span>
                  <Link
                    href={b.code === "missing_rssb_employer_number" ? `${staff}/payroll/settings` : `${staff}/payroll/rules`}
                    className="text-sm font-semibold text-accent-text no-underline hover:underline"
                  >
                    {b.code === "missing_rssb_employer_number" ? "Add it in Settings" : "See the rules in force"}
                  </Link>
                </div>
              ))}
            </RowList>
          </section>
        )}

        {draft && waiting.length > 0 && (
          <section>
            <SectionHeading n={waiting.length}>To put right first</SectionHeading>
            <RowList>
              {waiting.map((person, i) => (
                <div key={person.employeeId} className={`${rowClass(i)} flex flex-wrap items-center gap-x-3 gap-y-2`} data-waiting={person.employeeId}>
                  <Avatar name={person.name} size={36} />
                  <span className="flex min-w-48 flex-1 flex-col gap-0.5">
                    <Link href={`${staff}/${person.employeeId}`} className="w-fit text-sm font-semibold text-ink no-underline hover:underline">
                      {person.name}
                    </Link>
                    {person.blockers.map((b, n) => (
                      <span key={`${b.code}-${n}`} className="text-2xs text-warn" data-blocker={b.code}>
                        {said(b)}
                      </span>
                    ))}
                  </span>
                  {person.slip && <span className="pms-num text-sm text-ink2">{fmt(person.slip.netRwf)} net</span>}
                  {fixesOf(person, staff).map((fix) => (
                    <Link key={fix.label} href={fix.href} className="text-sm font-semibold text-accent-text no-underline hover:underline">
                      {fix.label}
                    </Link>
                  ))}
                  {canCarry(person) && (
                    <ConfirmAction
                      tone="primary"
                      confirmLabel={`Yes, pay with ${nextMonth}`}
                      keepLabel="Not yet"
                      disabled={busy}
                      pending={hold.isPending && hold.variables?.employeeId === person.employeeId}
                      onConfirm={() => carryOne(person)}
                    >
                      Pay next month
                    </ConfirmAction>
                  )}
                </div>
              ))}
            </RowList>
            <FormError error={busy ? null : hold.error} />
          </section>
        )}

        {carried.length > 0 && (
          <section>
            <SectionHeading n={carried.length}>{draft ? `Left for ${nextMonth}` : `Paid with ${nextMonth} instead`}</SectionHeading>
            <RowList>
              {carried.map((a, i) => (
                <div key={a.id} className={`${rowClass(i)} flex flex-wrap items-center gap-x-3 gap-y-2`} data-carried={a.employee.employeeId}>
                  <Avatar name={a.employee.displayName} size={36} />
                  <span className="flex min-w-48 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-semibold text-ink">{a.employee.displayName}</span>
                    <span className="text-2xs text-muted-foreground">{a.reason}</span>
                  </span>
                  <span className="pms-num text-sm text-ink2">{fmt(a.amountRwf)} earned</span>
                  {draft && a.status === "open" && (
                    <ActionButton
                      pending={waive.isPending && waive.variables?.id === a.id}
                      deniedReason={busy ? "Wait for the run to finish confirming." : undefined}
                      onClick={() => bringBack(a)}
                    >
                      Bring back
                    </ActionButton>
                  )}
                </div>
              ))}
            </RowList>
            <FormError error={waive.error} />
          </section>
        )}

        {holding && (
          <ReasonForm
            title={`Leave ${holding.name} for ${nextMonth}. Their earnings this month wait as an adjustment, and their installment moves a month on.`}
            action="Pay next month"
            pending={hold.isPending}
            error={hold.error}
            onCancel={() => setHolding(null)}
            onSubmit={(reason) =>
              hold.mutate(
                { runId: run.id, employeeId: holding.employeeId, reason },
                {
                  onSuccess: () => {
                    act.reset();
                    toast(`${holding.name} is left for ${nextMonth}`, "ok");
                    setHolding(null);
                  },
                },
              )
            }
          />
        )}

        {!draft && <Files runId={run.id} />}

        <section>
          <SectionHeading n={ready.length}>{draft ? "Ready to pay" : "Payslips"}</SectionHeading>
          {ready.length === 0 ? (
            <EmptyState className="mt-2.5 p-6">
              {payslips.length === 0 ? "Nobody has a contract in this month, so nobody is paid." : "Nobody yet: everyone on this run has something to put right first."}
            </EmptyState>
          ) : (
            <RowList>
              {ready.map((p, i) => (
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
          <Avatar name={slip.displayName} size={36} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-sm font-semibold text-ink">{slip.displayName}</span>
            <span className="pms-num text-2xs text-muted-foreground">
              {slip.employeeNumber} · {slip.payableDays}/30 days payable
            </span>
          </span>
          <span className="pms-num text-right text-sm text-ink2">
            <span className="block">{fmt(slip.netRwf)} net</span>
            <span className="block text-2xs text-muted-foreground">
              {fmt(slip.grossRwf)} gross{slip.nonIncomeRwf > 0 ? ` + ${fmt(slip.nonIncomeRwf)} not income` : ""}
            </span>
          </span>
          <Badge>{open ? "Hide lines" : "Lines"}</Badge>
        </button>
        {draft ? <ActionButton onClick={onHold}>Pay next month</ActionButton> : <ActionButton onClick={onPrint}>PDF</ActionButton>}
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
