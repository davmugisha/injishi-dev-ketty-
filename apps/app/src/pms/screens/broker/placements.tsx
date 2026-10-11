"use client";

/**
 * Placements (F-R02, FL19) — every tenant this broker introduced, and where the
 * fee stands.
 *
 * Reads `GET /ops/broker/placements`: the broker's own `tenant_placements`, the
 * lease each became, and the fee that lease raised. It used to read four
 * invented rows from `data/broker.ts`.
 *
 * The invariant the table is built around: a fee is *earned* when the lease
 * activates, not when the introduction happens. A placement that never becomes
 * a lease never pays. The reverse also holds and is worth saying out loud: if
 * the broker deregisters before activation, the fee still comes to them as the
 * original broker.
 */

import type { BrokerPlacement } from "@injishi/contracts";
import { cn } from "@/lib/utils";
import { Badge, EmptyState, LoadFailed, Skeleton, surfaceClass } from "../../components/ui";
import { useBrokerPlacements } from "../../data/broker-ops";
import { useWorkspaceId } from "../../data/capability";
import { dshortIso, fmt } from "../../lib/format";

type Intent = "ok" | "warn" | "info" | "neutral";

/** Where a placement stands, read from the placement, its lease and its fee together. */
function stateOf(p: BrokerPlacement): { label: string; intent: Intent } {
  if (p.status === "abandoned") return { label: "Abandoned", intent: "neutral" };
  if (p.status === "unavailable") return { label: "Unit no longer available", intent: "neutral" };
  if (p.status === "initiated") return { label: "Placement in progress", intent: "info" };
  if (p.fee?.status === "disbursed") return { label: "Fee disbursed", intent: "ok" };
  if (p.lease?.status === "active") return { label: "Earned, awaiting payout", intent: "warn" };
  return { label: "Awaiting lease activation", intent: "warn" };
}

const COLS = "minmax(150px,1.4fr) minmax(140px,1.2fr) minmax(90px,.8fr) minmax(110px,1fr) minmax(160px,1.1fr)";

export function Placements() {
  const workspaceId = useWorkspaceId();
  const query = useBrokerPlacements(workspaceId);

  if (query.isPending) {
    return (
      <div className="pms-enter flex max-w-wide flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={48} delay={i * 60} />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load your placements. {query.error.message}
      </LoadFailed>
    );
  }

  const placements = query.data.placements;

  return (
    <div className="pms-enter flex max-w-wide flex-col gap-3.5">
      <span className="text-xs text-muted-foreground">
        Your fee earns when the lease activates. It is paid out in full, with no platform cut.
      </span>

      {placements.length === 0 ? (
        <EmptyState>
          No placements yet. Reveal a landlord in the Directory and start one. The fee follows the lease.
        </EmptyState>
      ) : (
        <div className={cn(surfaceClass, "scrollbar overflow-x-auto")}>
          <div className="min-w-[740px]">
            <div
              className="grid gap-2.5 border-b border-line px-[18px] py-[11px] text-2xs font-bold tracking-[0.05em] uppercase text-[var(--muted2)]"
              style={{ gridTemplateColumns: COLS }}
            >
              <span>Tenant · unit</span>
              <span>Landlord</span>
              <span>Lease</span>
              <span className="text-right">Your fee</span>
              <span>State</span>
            </div>
            {placements.map((p, i) => {
              const state = stateOf(p);
              // A placement with no tenant yet is a lead, not a row to shout
              // about: it reads muted until there is a name on it.
              const pending = !p.lease;
              return (
                <div
                  key={p.id}
                  className={cn(
                    "grid items-center gap-2.5 px-[18px] py-[11px]",
                    i === 0 ? "border-t border-transparent" : "border-t border-line",
                  )}
                  style={{ gridTemplateColumns: COLS }}
                >
                  <span
                    className={cn(
                      "min-w-0 truncate text-sm font-semibold",
                      pending ? "text-muted-foreground" : "text-ink",
                    )}
                  >
                    {p.lease
                      ? [p.lease.tenantName ?? "Tenant not named", p.lease.unitLabel && `Unit ${p.lease.unitLabel}`]
                          .filter(Boolean)
                          .join(" · ")
                      : `No tenant yet · started ${dshortIso(p.initiatedAt)}`}
                  </span>
                  <span className="min-w-0 truncate text-sm text-ink2">
                    {p.propertyName ?? p.landlordName ?? "—"}
                  </span>
                  <span className="pms-num text-xs text-muted-foreground">
                    {p.lease?.startDate ? `From ${dshortIso(p.lease.startDate)}` : p.lease ? "Not started" : "—"}
                  </span>
                  <span
                    className={cn(
                      "pms-num text-right text-sm font-bold whitespace-nowrap",
                      pending ? "text-muted-foreground" : "text-ink",
                    )}
                  >
                    {p.fee?.amountRwf != null ? fmt(p.fee.amountRwf) : "—"}
                  </span>
                  <span>
                    <Badge intent={state.intent}>{state.label}</Badge>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-2xs text-muted-foreground">
        If a lease never activates, no fee is earned. If you deregister before activation, the fee still comes to you
        as the original broker.
      </p>
    </div>
  );
}
