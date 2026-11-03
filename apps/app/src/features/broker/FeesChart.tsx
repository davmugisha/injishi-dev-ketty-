"use client";

import type { BrokerFeeLine } from "@injishi/contracts";
import { CHART_COLOR, type DashboardPeriod, PeriodMenu, periodRange, sumByBucket, TrendArea } from "@injishi/ui";
import { useMemo, useState } from "react";

/**
 * The broker's fees over a period (2026-10-28): what landlords recorded as earned, by the day the lease
 * starts, and what they marked paid, by the day they paid, as areas. The period filter sits in the
 * header: this month day by day, or months. The gap between the two is still owed.
 */
export function FeesChart({
  fees,
  today,
  className,
}: {
  fees: readonly BrokerFeeLine[];
  today: string;
  className?: string;
}) {
  const [period, setPeriod] = useState<DashboardPeriod>("last_6");
  const range = useMemo(() => periodRange(period, today), [period, today]);
  const values = useMemo(() => {
    const live = fees.filter((f) => f.fee.status !== "void");
    return [
      sumByBucket(
        range,
        live,
        (f) => f.startDate,
        (f) => f.fee.amountRwf,
      ),
      sumByBucket(
        range,
        live.filter((f) => f.fee.status === "paid"),
        (f) => f.fee.paidAt?.slice(0, 10),
        (f) => f.fee.amountRwf,
      ),
    ];
  }, [fees, range]);
  return (
    <TrendArea
      className={className}
      title="Fees (RWF)"
      range={range}
      actions={<PeriodMenu value={period} onChange={setPeriod} />}
      series={[
        { key: "earned", label: "Earned", color: CHART_COLOR.cat(2) },
        { key: "paid", label: "Paid", color: CHART_COLOR.cat(1) },
      ]}
      values={values}
      height={240}
      empty={{ icon: "Wallet", title: `No fees in ${range.words}` }}
    />
  );
}
