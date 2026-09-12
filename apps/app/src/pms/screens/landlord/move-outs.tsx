"use client";

/**
 * Move-outs and deposits (F-R06).
 *
 * **On real data** (ADR-035, D-f wave 1). Reads `GET /api/v1/ops/leases` for the
 * notice list and `GET /ops/deposits` for the money, and commands
 * `POST /ops/leases/:id/advance` and `POST /ops/deposits/:id/return` — the
 * second with an `Idempotency-Key`, because it moves money (D-h). The demo store
 * is gone from this screen (D-i).
 *
 * A deposit is HELD, not earned. It stays visible as the tenant's money until
 * the move-out review returns it, and like rent it never produces a tax invoice.
 *
 * **THE DEDUCTION LIST IS GONE, AND THE CONTRACT IS WHY.** The demo let an
 * operator stack up line items client side and then derived the refund as
 * whatever was left. `ReturnDepositRequest` names BOTH halves explicitly, and
 * the server checks that they add up to what was held — because a derived
 * remainder hides an arithmetic mistake instead of refusing it. So this screen
 * asks for both numbers and shows, before the button is live, whether they
 * balance. It is one settlement, not a running tally, which is also what the
 * `caution_holds` row can actually store.
 *
 * `reason` is required whenever anything is kept. Money withheld from a tenant
 * with no stated reason is the dispute this table exists to settle.
 */

// `Card` is not in the shared package and does not need to be: it was a div
// wearing `surfaceClass`, which this file already imports.
import { Input } from "@injishi/ui";
import { cn } from "@/lib/utils";
import type { OperatorDeposit } from "@injishi/contracts";
import { useState } from "react";
import { Badge, EmptyState, LoadFailed, SectionHeading, Skeleton, surfaceClass } from "../../components/ui";
import { ConfirmAction } from "../../components/confirm-action";
import { useCapability, useWorkspaceId } from "../../data/capability";
import { useAdvanceLease, useDeposits, useLeases, useReturnDeposit } from "../../data/ops";
import { fmt } from "../../lib/format";
import { usePms } from "../../store";

/** What the operator has typed into one deposit's settlement form. */
interface Settlement {
  refund: string;
  keep: string;
  reason: string;
}

const BLANK: Settlement = { refund: "", keep: "", reason: "" };

/** Digits only. An empty field is zero, which is a real answer here. */
function amount(v: string): number {
  const n = parseInt(v.replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

function day(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "—";
}

export function MoveOuts() {
  const { toast, toastError } = usePms();
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();

  const leasesQuery = useLeases(workspaceId);
  const depositsQuery = useDeposits(workspaceId);
  const advance = useAdvanceLease(workspaceId);
  const returnDeposit = useReturnDeposit(workspaceId);

  const [draft, setDraft] = useState<Record<string, Settlement>>({});
  const get = (id: string) => draft[id] ?? BLANK;
  const set = (id: string, patch: Partial<Settlement>) =>
    setDraft((d) => ({ ...d, [id]: { ...get(id), ...patch } }));

  const mayAdvance = can("lease.advance");
  const advanceDenied = mayAdvance ? undefined : reasonFor("lease.advance");
  const mayReturn = can("deposit.return");
  const returnDenied = mayReturn ? undefined : reasonFor("deposit.return");

  const pending = leasesQuery.isPending || depositsQuery.isPending;
  const failed = leasesQuery.isError || depositsQuery.isError;
  /** Is THIS deposit the one being settled? Not "is anything settling". */
  const settling = (holdId: string) =>
    returnDeposit.isPending && returnDeposit.variables?.holdId === holdId;

  if (pending) {
    return (
      <div className="pms-enter flex max-w-page flex-col gap-5">
        <Skeleton height={90} />
        <Skeleton height={180} delay={60} />
      </div>
    );
  }

  if (failed) {
    /* A failed read is not "nobody is moving out". A deposit that should have
       gone back last week is exactly what this silence would hide. */
    return (
      <LoadFailed
        onRetry={() => {
          void leasesQuery.refetch();
          void depositsQuery.refetch();
        }}
        retrying={leasesQuery.isFetching || depositsQuery.isFetching}
      >
        We couldn&apos;t load move-outs and deposits. Every deposit is still held — this is
        on our side, not an empty list.
      </LoadFailed>
    );
  }

  // Ending = notice given, still living there.
  const ending = (leasesQuery.data?.leases ?? []).filter((l) => l.status === "ending");
  const deposits = depositsQuery.data?.deposits ?? [];
  const held = deposits.filter((d) => d.status === "held");
  const settled = deposits.filter((d) => d.status !== "held");

  function settle(d: OperatorDeposit) {
    const s = get(d.id);
    const refundedRwf = amount(s.refund);
    const forfeitedRwf = amount(s.keep);
    const reason = s.reason.trim();
    if (forfeitedRwf > 0 && !reason) {
      toast("Say why part of the deposit is being kept — the tenant sees it.", "warn");
      return;
    }
    returnDeposit.mutate(
      { holdId: d.id, refundedRwf, forfeitedRwf, ...(reason ? { reason } : {}) },
      {
        onSuccess: () => {
          setDraft((prev) => ({ ...prev, [d.id]: BLANK }));
          toast(
            forfeitedRwf > 0
              ? `${fmt(refundedRwf)} is going back to ${d.tenantName ?? "the tenant"}, and ${fmt(forfeitedRwf)} is kept. They see your reason.`
              : `${fmt(refundedRwf)} is going back to ${d.tenantName ?? "the tenant"} in full.`,
            "ok",
          );
        },
        onError: toastError,
      },
    );
  }

  return (
    <div className="pms-enter flex max-w-page flex-col gap-5">
      <span className="text-xs text-muted-foreground">
        A deposit stays held until the move-out review — and like rent, it never produces a
        tax invoice.
      </span>

      <section>
        <SectionHeading n={ending.length}>Notice given</SectionHeading>
        {ending.length === 0 ? (
          <EmptyState className="mt-2.5 p-5">
            Nobody is moving out. A tenancy appears here the day notice is given.
          </EmptyState>
        ) : (
          <div className="mt-2.5 flex flex-col gap-3">
            {ending.map((l) => (
              <div key={l.id} className={cn(surfaceClass, "px-[18px] py-4")}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">
                      {l.tenantName ?? "Unnamed tenant"}
                    </span>
                    <span className="pms-num block text-2xs text-muted-foreground">
                      {[l.unitLabel, `lease ends ${day(l.endDate)}`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <Badge intent="warn">Moving out {day(l.endDate)}</Badge>
                  {/* This ENDS the tenancy — the unit comes back on the market
                      and the deposit moves to review — so it asks once. Only
                      this card waits, not every card on the list. */}
                  <ConfirmAction
                    variant="primary"
                    onConfirm={() =>
                      advance.mutate(
                        { leaseId: l.id, to: "ended" },
                        {
                          onSuccess: () =>
                            toast(
                              `${l.tenantName ?? "This tenant"} is moved out. Their deposit is in review below.`,
                              "ok",
                            ),
                          onError: toastError,
                        },
                      )
                    }
                    confirmLabel="Yes, end it and review the deposit"
                    deniedReason={advanceDenied}
                    pending={advance.isPending && advance.variables?.leaseId === l.id}
                  >
                    {advance.isPending && advance.variables?.leaseId === l.id
                      ? "Ending the tenancy"
                      : "Start move-out review"}
                  </ConfirmAction>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeading n={held.length}>Deposit review</SectionHeading>
        {held.length === 0 ? (
          <EmptyState className="mt-2.5 p-5">
            No deposits waiting. Once a tenant is out, their deposit lands here for review.
          </EmptyState>
        ) : (
          <div className="mt-2.5 flex flex-col gap-3">
            {held.map((d) => {
              const s = get(d.id);
              const refund = amount(s.refund);
              const keep = amount(s.keep);
              const total = d.amountRwf ?? 0;
              const balances = refund + keep === total;
              const needsReason = keep > 0 && !s.reason.trim();
              // Not ready, rather than not allowed: the two amounts have to add
              // up and a deduction has to be explained before this can go.
              const off = !balances || needsReason;
              return (
                <div key={d.id} className={cn(surfaceClass, "px-[18px] py-4")}>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">
                        {d.tenantName ?? "Unnamed tenant"}
                      </span>
                      <span className="pms-num block text-2xs text-muted-foreground">
                        {[d.unitLabel, `deposit ${fmt(total)} held since ${day(d.heldAt)}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <Badge intent="info">Deposit in review</Badge>
                  </div>

                  <div className="mt-3.5 rounded border border-line2 bg-field px-3.5 py-3">
                    <div className="text-2xs font-bold tracking-[0.06em] uppercase text-[var(--muted2)]">
                      Settlement — the two amounts must add up to {fmt(total)}
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <label className="flex min-w-[140px] flex-1 flex-col gap-1">
                        <span className="text-2xs text-muted-foreground">Return to tenant</span>
                        <Input
                          value={s.refund}
                          onChange={(e) => set(d.id, { refund: e.target.value })}
                          inputMode="numeric"
                          placeholder="RWF"
                          aria-label={`Amount to return to ${d.tenantName ?? "the tenant"}`}
                          className="h-10 rounded border-line2 bg-card text-sm"
                        />
                      </label>
                      <label className="flex min-w-[140px] flex-1 flex-col gap-1">
                        <span className="text-2xs text-muted-foreground">Keep</span>
                        <Input
                          value={s.keep}
                          onChange={(e) => set(d.id, { keep: e.target.value })}
                          inputMode="numeric"
                          placeholder="RWF"
                          aria-label={`Amount to keep from ${d.tenantName ?? "the tenant"}`}
                          className="h-10 rounded border-line2 bg-card text-sm"
                        />
                      </label>
                    </div>

                    {keep > 0 && (
                      <Input
                        value={s.reason}
                        onChange={(e) => set(d.id, { reason: e.target.value })}
                        placeholder="Why part of it is being kept — the tenant sees this"
                        aria-label="Reason for keeping part of the deposit"
                        maxLength={1000}
                        className="mt-2 h-10 w-full rounded border-line2 bg-card text-sm"
                      />
                    )}

                    {/* Said before the press, not after the refusal. The server
                        checks the same sum; this only saves a round trip. */}
                    {!balances && (
                      <div className="mt-2 text-xs font-semibold text-bad">
                        {fmt(refund)} + {fmt(keep)} is {fmt(refund + keep)}, and {fmt(total)} was
                        held.
                      </div>
                    )}

                    {/* Money leaving, once. The armed label repeats the figure
                        because the two fields above are easy to transpose. */}
                    <ConfirmAction
                      variant="primary"
                      tone="primary"
                      className="mt-3 h-11"
                      fullWidth
                      onConfirm={() => settle(d)}
                      confirmLabel={`Yes, return ${fmt(refund)}${keep > 0 ? ` and keep ${fmt(keep)}` : ""}`}
                      deniedReason={returnDenied}
                      disabled={off}
                      pending={settling(d.id)}
                    >
                      {settling(d.id)
                        ? `Returning ${fmt(refund)}`
                        : `Settle — return ${fmt(refund)} to ${(d.tenantName ?? "the tenant").split(" ")[0]}`}
                    </ConfirmAction>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {settled.length > 0 && (
        <section>
          <SectionHeading n={settled.length}>Settled</SectionHeading>
          <div className={cn(surfaceClass, "mt-2.5 overflow-hidden")}>
            {settled.map((d, i) => (
              <div
                key={d.id}
                className={cn(
                  "flex items-center gap-3 px-[18px] py-3",
                  i === 0 ? "border-t border-transparent" : "border-t border-line",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">
                    {d.tenantName ?? "Unnamed tenant"}
                  </span>
                  <span className="pms-num block text-2xs text-muted-foreground">
                    {[
                      d.unitLabel,
                      d.settlement ? `returned ${fmt(d.settlement.refundedRwf ?? 0)}` : null,
                      d.settlement && (d.settlement.forfeitedRwf ?? 0) > 0
                        ? `kept ${fmt(d.settlement.forfeitedRwf ?? 0)}`
                        : null,
                      d.settlement?.reason,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <Badge intent={d.status === "refunded" ? "ok" : "warn"}>
                  {d.status === "refunded" ? "Deposit returned" : "Partly kept"}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="text-2xs text-muted-foreground">
        The tenant sees the same review from their side — deposit held, what was kept and
        why, and the return the moment it happens.
      </p>
    </div>
  );
}
