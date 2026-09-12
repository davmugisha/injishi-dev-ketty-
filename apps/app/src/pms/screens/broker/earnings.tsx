"use client";

/**
 * Broker earnings (F-R10) — the placement-fee ledger.
 *
 * Injishi takes no cut of a broker fee: what the landlord agreed is what
 * disburses. The split between *pending* and *disbursed* is the only status
 * that matters, because pending means the lease has not activated yet.
 */

import { fmt } from "../../lib/format";
import { usePms } from "../../store";
import { Badge, EmptyState, StatCard, surfaceClass } from "../../components/ui";
import { cn } from "@/lib/utils";

export function Earnings() {
  const { broker } = usePms();

  const disbursed = broker.ledger.filter((l) => l[3] === "disbursed");
  const pending = broker.ledger.filter((l) => l[3] === "pending");
  const sum = (rows: typeof broker.ledger) => rows.reduce((a, l) => a + l[2], 0);

  return (
    <div className="pms-enter flex max-w-wide flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard n={fmt(sum(disbursed))} label="Disbursed to you this year" />
        <StatCard n={fmt(sum(pending))} label="Pending — earns when the lease activates" />
        <StatCard n={String(broker.reveals)} label="Contact reveals left" />
      </div>

      {broker.ledger.length === 0 ? (
        <EmptyState>
          Nothing earned yet. A placement fee appears here the moment the lease behind it activates.
        </EmptyState>
      ) : (
        <div className={cn(surfaceClass, "overflow-hidden")}>
          {broker.ledger.map(([label, sub, amt, st], i) => (
            <div
              key={label}
              className={cn(
                "flex items-center gap-3 px-[18px] py-3",
                i === 0 ? "border-t border-transparent" : "border-t border-line",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{label}</span>
                <span className="block text-2xs text-muted-foreground">{sub}</span>
              </span>
              <span className="pms-num text-sm font-bold whitespace-nowrap text-ink">{fmt(amt)}</span>
              <Badge intent={st === "disbursed" ? "ok" : "warn"}>{st === "disbursed" ? "Disbursed" : "Pending"}</Badge>
            </div>
          ))}
        </div>
      )}

      <p className="text-2xs text-muted-foreground">
        Placement fees disburse in full to your mobile money — Injishi takes no cut of broker fees.
      </p>
    </div>
  );
}
