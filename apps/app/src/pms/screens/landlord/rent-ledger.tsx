"use client";

/**
 * Rent ledger — every rent movement across the portfolio, month by month.
 *
 * **On real data** (2026-09-15). This lens was a `Placeholder` with a "next
 * design pass" badge, so a landlord who opened Finance found nothing at all.
 * It needs no new endpoint: `GET /ops/rent-roll` already returns every period
 * every lease has ever been charged. The Rent roll screen keeps only the
 * newest line per tenancy; this is the other half of the same read, the full
 * history.
 *
 * Money shown is what the server holds, never a recomputation: charged is
 * `amount_rwf`, collected is `paid_amount_rwf`, and outstanding is the
 * difference on rows that are not settled. A month's status is the rows' own.
 */

import type { OperatorRentCharge } from "@injishi/contracts";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

import { Badge, Chip, EmptyState, LoadFailed, SectionHeading, SelectField, Skeleton, StatCard, surfaceClass } from "../../components/ui";
import { useWorkspaceId } from "../../data/capability";
import { useRentRoll } from "../../data/ops";
import { dshortIso, fmt } from "../../lib/format";
import { useWorkspaceHref } from "../../lib/workspace-href";

const COLS = "minmax(64px,.6fr) minmax(150px,1.4fr) minmax(100px,1fr) minmax(100px,1fr) minmax(120px,1fr) auto";

/**
 * How many months get a chip of their own.
 *
 * The rest are reachable through the select beside them. Six chips was the
 * whole control while the demo held two months of rent; against a portfolio
 * with two years of history it made every month but the newest six
 * unreachable, which is a filter that silently hides most of the ledger.
 */
const CHIPPED_MONTHS = 6;

/** `Sep 2026` from the first-of-month date the server sends. */
function monthLabel(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

function totals(rows: readonly OperatorRentCharge[]) {
  const charged = rows.reduce((s, c) => s + (c.amountRwf ?? 0), 0);
  const collected = rows.reduce((s, c) => s + (c.paidAmountRwf ?? 0), 0);
  const outstanding = rows
    .filter((c) => c.status !== "paid")
    .reduce((s, c) => s + Math.max(0, (c.amountRwf ?? 0) - (c.paidAmountRwf ?? 0)), 0);
  return { charged, collected, outstanding };
}

export function RentLedger() {
  const workspaceId = useWorkspaceId();
  const href = useWorkspaceHref();
  const query = useRentRoll(workspaceId);
  const [month, setMonth] = useState<string | "all">("all");

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={64} delay={i * 70} />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load the rent ledger. Nothing has been written off — this is on our side.
      </LoadFailed>
    );
  }

  const charges = query.data?.charges ?? [];
  if (charges.length === 0) {
    return (
      <EmptyState>
        No rent has been charged yet. Every month raised on a lease is listed here, with what came in against it.
      </EmptyState>
    );
  }

  const months = [...new Set(charges.map((c) => c.periodMonth.slice(0, 10)))].sort().reverse();
  const visible = month === "all" ? months : months.filter((m) => m === month);
  const scope = charges.filter((c) => month === "all" || c.periodMonth.startsWith(month));
  const sum = totals(scope);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <Chip label="All months" n={months.length} active={month === "all"} onClick={() => setMonth("all")} />
        {months.slice(0, CHIPPED_MONTHS).map((m) => (
          <Chip
            key={m}
            label={monthLabel(m)}
            n={charges.filter((c) => c.periodMonth.startsWith(m)).length}
            active={month === m}
            onClick={() => setMonth(m)}
          />
        ))}
        {months.length > CHIPPED_MONTHS && (
          /* The complete control. Its value always mirrors the chips, so a
             month picked here and a month picked there cannot disagree. */
          <SelectField
            className="w-56"
            label="Jump to a month"
            value={month}
            onChange={(v) => setMonth(v === "" ? "all" : v)}
            options={[
              { value: "all", label: `All ${months.length} months` },
              ...months.map((m) => ({ value: m, label: monthLabel(m) })),
            ]}
          />
        )}
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
        <StatCard n={fmt(sum.charged)} label="Rent charged" />
        <StatCard n={fmt(sum.collected)} label="Collected" />
        <StatCard n={fmt(sum.outstanding)} label="Still owed" />
      </div>

      {visible.map((m) => {
        const rows = charges
          .filter((c) => c.periodMonth.startsWith(m))
          .sort((a, b) => (a.unitLabel ?? "").localeCompare(b.unitLabel ?? ""));
        const t = totals(rows);
        return (
          <section key={m} className="flex flex-col gap-2">
            <SectionHeading n={rows.length}>
              {monthLabel(m)} · {fmt(t.collected)} of {fmt(t.charged)} collected
            </SectionHeading>
            <div className={cn(surfaceClass, "scrollbar overflow-x-auto")}>
              <div className="min-w-[720px]">
                {rows.map((c, i) => {
                  const owed = Math.max(0, (c.amountRwf ?? 0) - (c.paidAmountRwf ?? 0));
                  return (
                    <div
                      key={c.id}
                      className={cn(
                        "grid items-center gap-2.5 px-[18px] py-2.5",
                        i === 0 ? "border-t border-transparent" : "border-t border-line",
                      )}
                      style={{ gridTemplateColumns: COLS }}
                    >
                      <span className="pms-num text-sm font-bold text-ink">{c.unitLabel ?? "—"}</span>
                      <Link
                        href={href(`/leases/${c.leaseId}/rent`)}
                        className="truncate text-sm font-semibold text-foreground no-underline"
                      >
                        {c.tenantName ?? "Tenant"}
                      </Link>
                      <span className="pms-num text-right text-sm text-ink">{fmt(c.amountRwf ?? 0)}</span>
                      <span className="pms-num text-right text-sm text-ink">
                        {c.paidAmountRwf ? fmt(c.paidAmountRwf) : "—"}
                      </span>
                      <span className="text-2xs text-muted-foreground">
                        {c.status === "paid"
                          ? c.paidAt
                            ? `Paid ${dshortIso(c.paidAt.slice(0, 10))}`
                            : "Paid"
                          : `${fmt(owed)} owed${c.dueDate ? ` · due ${dshortIso(c.dueDate)}` : ""}`}
                      </span>
                      <span className="flex justify-end">
                        <Badge intent={c.status === "paid" ? "ok" : c.status === "due" ? "info" : "bad"}>
                          {c.status}
                        </Badge>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}

      <p className="text-2xs text-muted-foreground">
        Rent is a tenancy payment — it never produces a tax invoice. Record a payment from the Rent roll.
      </p>
    </div>
  );
}
