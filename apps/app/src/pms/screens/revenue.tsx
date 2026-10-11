"use client";

/**
 * Revenue by department (USALI, F-P01) — where the department tag on every
 * revenue charge rolls up.
 *
 * Reads `GET /ops/revenue` for one month. It says what each revenue centre
 * EARNED, net of voids and exclusive of tax, and stops there.
 *
 * **It used to show a full departmental P&L, and every number in it was
 * invented.** Direct costs, undistributed expenses and the Gross Operating
 * Profit came from the demo store because nothing else could supply them: there
 * is no expense ledger, so no cost has ever been recorded anywhere. A GOP built
 * on made-up costs is worse than no GOP, because an owner acts on it. The cost
 * side comes back when something records costs.
 */

import type { OperatorRevenue } from "@injishi/contracts";
import { BarList, Button } from "@injishi/ui";
import { KPI, KPIGroup } from "@injishi/ui/kpi";
import { NumberValue } from "@injishi/ui/number-value";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { ActionButton, Badge, EmptyState, LoadFailed, Skeleton, surfaceClass } from "../components/ui";
import { Icon } from "../components/icon";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useRevenue } from "../data/ops";
import { fmt, todayIso } from "../lib/format";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** `2026-09` → `September 2026`. */
function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** Step a `YYYY-MM` month by `delta`, across year boundaries. */
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/**
 * A department's share of the month, as a word beside its bar.
 *
 * Worked out from the two figures the server sent, never stored. Under half a
 * percent reads "under 1%" rather than "0%": a department that took money did
 * not take none. Nothing is shown when the month took nothing, because a share
 * of zero is not a number.
 */
function ShareOfTotal({ part, total }: { part: number; total: number }) {
  if (total <= 0) return null;
  const pct = (Math.max(part, 0) / total) * 100;
  const text = pct > 0 && pct < 0.5 ? "under 1%" : `${Math.round(pct)}%`;
  return (
    <span className="pms-num inline-block min-w-14 text-right text-xs text-muted-foreground">
      {text}
      <span className="sr-only"> of the month</span>
    </span>
  );
}

/**
 * The month at a glance, above the departments: what came in, how that
 * compares with the month before, which department carried most of it, and how
 * many took any money at all. HeroUI Pro's KPI strip (`@injishi/ui/kpi`).
 *
 * Every figure is worked out from the two reads the screen makes (this month
 * and the one before), never stored. The comparison is shown only when last
 * month took money: a change from zero is not a percentage, and an owner told
 * "+100%" about a new property learns nothing.
 */
function RevenueFigures({
  month,
  data,
  previous,
}: {
  month: string;
  data: OperatorRevenue;
  previous: OperatorRevenue | undefined;
}) {
  const earning = data.departments.filter((d) => d.revenueRwf > 0).length;
  const top = [...data.departments].sort((a, b) => b.revenueRwf - a.revenueRwf)[0];
  const change = previous && previous.totalRwf > 0 ? (data.totalRwf - previous.totalRwf) / previous.totalRwf : null;
  const trend = change === null ? null : change > 0.005 ? "up" : change < -0.005 ? "down" : "neutral";
  const lastMonth = monthLabel(shiftMonth(month, -1));

  return (
    <KPIGroup>
      <KPI>
        <KPI.Header>
          <KPI.Icon status="success">
            <Icon name="wallet" size={16} />
          </KPI.Icon>
          <KPI.Title>Revenue, {monthLabel(month)}</KPI.Title>
        </KPI.Header>
        <KPI.Content>
          <KPI.Value locale="en-US" maximumFractionDigits={0} value={data.totalRwf}>
            <NumberValue.Prefix>RWF{"\u00a0"}</NumberValue.Prefix>
          </KPI.Value>
          {trend !== null && change !== null && (
            <KPI.Trend trend={trend}>
              {`${change > 0 ? "+" : ""}${Math.round(change * 100)}%`}
              <span className="sr-only"> against {lastMonth}</span>
            </KPI.Trend>
          )}
        </KPI.Content>
      </KPI>
      <KPIGroup.Separator />
      <KPI>
        <KPI.Header>
          <KPI.Icon>
            <Icon name="trending-up" size={16} />
          </KPI.Icon>
          <KPI.Title>Top department</KPI.Title>
        </KPI.Header>
        <KPI.Content>
          {top && top.revenueRwf > 0 && data.totalRwf > 0 ? (
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-lg font-semibold text-foreground">{top.name}</span>
              <span className="text-xs text-muted-foreground">
                {Math.round((top.revenueRwf / data.totalRwf) * 100)}% of the month
              </span>
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">Nothing taken yet this month</span>
          )}
        </KPI.Content>
      </KPI>
      <KPIGroup.Separator />
      <KPI>
        <KPI.Header>
          <KPI.Icon>
            <Icon name="building-2" size={16} />
          </KPI.Icon>
          <KPI.Title>Departments that took money</KPI.Title>
        </KPI.Header>
        <KPI.Content>
          <KPI.Value value={earning}>
            <NumberValue.Suffix>{` of ${data.departments.length}`}</NumberValue.Suffix>
          </KPI.Value>
        </KPI.Content>
      </KPI>
    </KPIGroup>
  );
}

export function Revenue() {
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const current = todayIso().slice(0, 7);
  const [month, setMonth] = useState(current);

  const mayRead = can("money.view");
  // A null workspace disables the read, so a caller without the permission
  // never spends a round trip to be told what the array already says.
  const query = useRevenue(mayRead ? workspaceId : null, month);
  // Last month, for the comparison on the figures strip. The same read, one
  // month back; it costs one request and is cached like the first.
  const previousQuery = useRevenue(mayRead ? workspaceId : null, shiftMonth(month, -1));

  if (!mayRead) {
    return (
      <EmptyState style={{ padding: 26, fontSize: 13.5 }}>
        {reasonFor("money.view")}
      </EmptyState>
    );
  }

  const data = query.data;

  return (
    <div className="pms-enter" style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Button variant="outline" size="icon" shape="rounded" aria-label="Previous month" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
          <Icon name="chevron-left" size={16} />
        </Button>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", minWidth: 128, textAlign: "center" }}>{monthLabel(month)}</span>
        <Button
          variant="outline"
          size="icon"
          shape="rounded"
          aria-label="Next month"
          disabled={month >= current}
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
        >
          <Icon name="chevron-right" size={16} />
        </Button>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          Every revenue charge names a department — this is where they roll up. Tax exclusive, net of voids.
        </span>
      </div>

      {query.isPending ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton height={44} />
          <Skeleton height={160} delay={60} />
        </div>
      ) : query.isError ? (
        /* Unreachable is not a month with no takings. An owner told "zero"
           would go looking for money that is not missing. */
        <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
          We couldn&apos;t load revenue. Every shilling taken is still recorded — this is
          on our side, not an empty month.
        </LoadFailed>
      ) : data && data.departments.length === 0 ? (
        <EmptyState style={{ padding: 26, fontSize: 13.5 }}>
          This property has no revenue centres yet. Departments are set up under People.
        </EmptyState>
      ) : data ? (
        /* The shared bar chart, not a hand-built one. The old bars were pills
           clipped inside a track, and nothing in the row said what share of
           the month a department carried. Departments keep the order the
           server sends, so each one sits in the same place month to month. */
        <>
        <RevenueFigures month={month} data={data} previous={previousQuery.data} />
        <div className={cn(surfaceClass, "overflow-hidden")}>
          <BarList
            className="px-[18px] py-4"
            aria-label={`Revenue by department, ${monthLabel(month)}`}
            rows={data.departments.map((d) => ({
              key: d.departmentId,
              label: (
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{d.name}</span>
                  {d.status === "archived" && <Badge intent="neutral">Retired</Badge>}
                </span>
              ),
              value: d.revenueRwf,
              display: fmt(d.revenueRwf),
              detail: <ShareOfTotal part={d.revenueRwf} total={data.totalRwf} />,
            }))}
          />
          <div className="flex items-center justify-between gap-3 border-t border-line2 bg-field px-[18px] py-3 text-sm font-bold text-foreground">
            <span>Total revenue</span>
            <span className="pms-num whitespace-nowrap">{fmt(data.totalRwf)}</span>
          </div>
        </div>
        </>
      ) : null}

      <p style={{ fontSize: 12, color: "var(--muted)", maxWidth: 620 }}>
        Direct costs, undistributed expenses and Gross Operating Profit appear here once costs are
        recorded. Nothing records a cost yet, so there is no honest figure to show.
      </p>
    </div>
  );
}
