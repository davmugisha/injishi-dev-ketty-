"use client";

/**
 * Compliance & filing (F-R11) — rental income, month by month, in the shape the
 * RRA declaration asks for.
 *
 * A lease never produces a tax invoice, so there is nothing to reconcile from
 * invoices: this summary *is* the record. It exists so filing season is a
 * download rather than an evening with a calculator.
 */

import { Card } from "@injishi/ui";
import { fmt } from "../../lib/format";
import { usePms } from "../../store";
import { ActionButton, SectionHeading, StatCard, surfaceClass } from "../../components/ui";
import { cn } from "@/lib/utils";

export function Compliance() {
  const { residence, toast } = usePms();
  const { filing } = residence;

  const total = filing.months.reduce((a, m) => a + m[1], 0);
  const peak = Math.max(...filing.months.map((m) => m[1]), 1);
  const active = residence.leases.filter((l) => l.st === "active" || l.st === "ending").length;

  return (
    <div className="pms-enter flex max-w-wide flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard n={fmt(total)} label="Rental income · 2026 to date" />
        <StatCard n={String(active)} label="Tenancies contributing" />
        <StatCard n={filing.due} label="Declaration due" />
      </div>

      <section>
        <SectionHeading>Rent collected — 2026, month by month</SectionHeading>
        <div className={cn(surfaceClass, "mt-2.5 overflow-hidden")}>
          {filing.months.map(([month, amt], i) => (
            <div
              key={month}
              className={cn(
                "flex items-center gap-3 px-[18px] py-2.5",
                i === 0 ? "border-t border-transparent" : "border-t border-line",
              )}
            >
              <span className="w-[130px] shrink-0 text-sm font-medium text-ink">{month}</span>
              <span className="pms-num w-[110px] shrink-0 text-right text-sm font-semibold text-ink">
                {fmt(amt)}
              </span>
              {/* The bar is the point: the March step-up is a lease starting. */}
              <span className="flex h-2 flex-1 overflow-hidden rounded-full bg-field">
                <span className="h-full rounded-full bg-primary" style={{ width: `${(amt / peak) * 100}%` }} />
              </span>
            </div>
          ))}
        </div>
      </section>

      <Card className={cn(surfaceClass, "flex-row flex-wrap items-center gap-3 px-[18px] py-4 shadow-none")}>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">
            Filing summary — ready when RRA season comes
          </span>
          <span className="block text-xs text-muted-foreground">
            Every rent payment, per unit and per month, in the shape the declaration asks for. Nothing to assemble by
            hand.
          </span>
        </span>
        {/* IT DOWNLOADED NOTHING. This button raised "Filing summary
            downloaded" and produced no file — there is no export endpoint — so
            a landlord could go looking in their Downloads folder at filing
            season for a document that was never made. It says where the figures
            actually are until there is a file to hand over. */}
        <ActionButton
          variant="primary"
          className="h-11"
          onClick={() =>
            toast(
              `The download isn't ready yet — nothing was saved to your device. Every payment behind the ${fmt(total)} is on the Rent roll.`,
              "neutral",
            )
          }
        >
          Download summary
        </ActionButton>
      </Card>

      <p className="text-2xs text-muted-foreground">
        Rent is a tenancy payment, so none of this produces a tax invoice. The declaration is due {filing.due} —
        Injishi keeps the record current so the filing is a download, not a reconstruction.
      </p>
    </div>
  );
}
