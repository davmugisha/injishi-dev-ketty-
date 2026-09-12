"use client";

/**
 * Placements (F-R09) — every tenant this broker introduced, and where the fee
 * stands.
 *
 * The invariant the table is built around: a fee is *earned* when the lease
 * activates, not when the introduction happens. A placement that never becomes
 * a lease never pays. The reverse also holds and is worth saying out loud — if
 * the broker deregisters before activation, the fee still comes to them as the
 * original broker.
 */

import { fmt } from "../../lib/format";
import { usePms } from "../../store";
import { Badge, EmptyState, surfaceClass } from "../../components/ui";
import type { PlacementState } from "../../data/types";
import { cn } from "@/lib/utils";

const STATE_BADGE: Record<PlacementState, { label: string; intent: "ok" | "warn" | "info" | "neutral" }> = {
  disbursed: { label: "Fee disbursed", intent: "ok" },
  awaiting: { label: "Awaiting lease activation", intent: "warn" },
  progress: { label: "Placement in progress", intent: "info" },
  none: { label: "No placement yet", intent: "neutral" },
};

const COLS = "minmax(150px,1.4fr) minmax(140px,1.2fr) minmax(80px,.8fr) minmax(110px,1fr) minmax(140px,1.1fr)";

export function Placements() {
  const { broker } = usePms();

  return (
    <div className="pms-enter flex max-w-wide flex-col gap-3.5">
      <span className="text-xs text-muted-foreground">
        Your fee earns when the lease activates — paid out in full, no platform cut.
      </span>

      {broker.placements.length === 0 ? (
        <EmptyState>
          No placements yet. Reveal a landlord in the Directory and start one — the fee follows the lease.
        </EmptyState>
      ) : (
        <div className={cn(surfaceClass, "scrollbar overflow-x-auto")}>
          <div className="min-w-[720px]">
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
            {broker.placements.map((p, i) => {
              const badge = STATE_BADGE[p.st];
              // A placement with no tenant yet is a lead, not a row to shout
              // about — it reads muted until there is a name on it.
              const pending = p.st === "none";
              return (
                <div
                  key={`${p.landlord}-${i}`}
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
                    {p.tenant ? `${p.tenant} · ${p.unit}` : "—"}
                  </span>
                  <span className="truncate text-sm text-ink2">{p.landlord}</span>
                  <span className="pms-num text-xs text-muted-foreground">{p.lease ?? "—"}</span>
                  <span
                    className={cn(
                      "pms-num text-right text-sm font-bold whitespace-nowrap",
                      pending ? "text-muted-foreground" : "text-ink",
                    )}
                  >
                    {p.fee ? fmt(p.fee) : "—"}
                  </span>
                  <span>
                    <Badge intent={badge.intent}>{badge.label}</Badge>
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
