"use client";

/**
 * Broker earnings (F-R08) — the placement-fee ledger.
 *
 * Reads `GET /ops/broker/earnings`: the broker's own `placement_fees`, and the
 * reveal credit balance. It used to read three invented fees from
 * `data/broker.ts`. The totals are summed by the server from the same rows the
 * list shows, so the cards and the lines cannot disagree.
 *
 * Injishi takes no cut of a broker fee: what the landlord agreed is what
 * disburses. The split between *pending* and *disbursed* is the only status
 * that matters, because pending means the fee has not been paid out yet.
 */

import { cn } from "@/lib/utils";
import { Badge, EmptyState, LoadFailed, Skeleton, StatCard, surfaceClass } from "../../components/ui";
import { useBrokerEarnings } from "../../data/broker-ops";
import { useWorkspaceId } from "../../data/capability";
import { dshortIso, fmt } from "../../lib/format";

export function Earnings() {
  const workspaceId = useWorkspaceId();
  const query = useBrokerEarnings(workspaceId);

  if (query.isPending) {
    return (
      <div className="pms-enter flex max-w-wide flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={64} delay={i * 60} />
          ))}
        </div>
        <Skeleton height={160} delay={180} />
      </div>
    );
  }

  if (query.isError) {
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load your earnings. Nothing you earned is lost. {query.error.message}
      </LoadFailed>
    );
  }

  const { disbursedThisYearRwf, pendingRwf, balance, fees } = query.data;

  return (
    <div className="pms-enter flex max-w-wide flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard n={fmt(disbursedThisYearRwf)} label="Disbursed to you this year" />
        <StatCard n={fmt(pendingRwf)} label="Pending payout" />
        <StatCard n={String(balance)} label="Contact reveals left" />
      </div>

      {fees.length === 0 ? (
        <EmptyState>
          Nothing earned yet. A placement fee appears here once a landlord records you on a lease.
        </EmptyState>
      ) : (
        <div className={cn(surfaceClass, "overflow-hidden")}>
          {fees.map((fee, i) => {
            const who = [fee.tenantName, fee.landlordName].filter(Boolean).join(" · ");
            return (
              <div
                key={fee.id}
                className={cn(
                  "flex items-center gap-3 px-[18px] py-3",
                  i === 0 ? "border-t border-transparent" : "border-t border-line",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">
                    Placement fee{who ? ` · ${who}` : ""}
                  </span>
                  <span className="block text-2xs text-muted-foreground">
                    {fee.status === "disbursed"
                      ? `Paid ${dshortIso(fee.updatedAt)}`
                      : "Earns when the lease activates, then pays out"}
                    {fee.unitLabel ? ` · Unit ${fee.unitLabel}` : ""}
                  </span>
                </span>
                <span className="pms-num text-sm font-bold whitespace-nowrap text-ink">
                  {fee.amountRwf === null ? "—" : fmt(fee.amountRwf)}
                </span>
                <Badge intent={fee.status === "disbursed" ? "ok" : "warn"}>
                  {fee.status === "disbursed" ? "Disbursed" : "Pending"}
                </Badge>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-2xs text-muted-foreground">
        Placement fees disburse in full to your mobile money. Injishi takes no cut of broker fees.
      </p>
    </div>
  );
}
