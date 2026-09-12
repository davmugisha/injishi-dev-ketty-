"use client";

import { Badge, BarList } from "@injishi/ui";
import type { DistrictDensity } from "@/lib/types";
import { useAdminUi } from "@/lib/store";

/**
 * Density hero — follows the global district filter.
 *
 * STILL A CLIENT COMPONENT, and only for that reason: the filter lives in the
 * topbar's store and this list has to react to it without a round trip. The
 * rows themselves are read on the server and arrive as props, so nothing about
 * WHICH districts exist or how many businesses each holds is decided in the
 * browser any more.
 *
 * A district the filter sets aside is DE-EMPHASISED, not faded. Its bar goes to
 * the chart's muted grey and keeps its length, so the picked district still
 * reads against the rest; its name and count stay legible. The old treatment
 * dropped the whole row to 30% opacity, which put the names and counts of 29
 * districts under any contrast floor the moment one was picked.
 */
export function DensityList({ rows }: { rows: DistrictDensity[] }) {
  const district = useAdminUi((s) => s.district);

  return (
    <div className="mt-4 rounded-card border border-border bg-field p-4">
      <BarList
        aria-label="Businesses registered per district, busiest first"
        rows={rows.map((row) => ({
          key: row.key,
          label: row.label,
          value: row.count,
          display: row.count,
          muted: district !== "all" && district !== row.key,
          detail: row.momBadge ? (
            <Badge variant={row.momBadge.intent} className="min-w-16 justify-center">
              {row.momBadge.text}
              <span className="sr-only"> vs last month</span>
            </Badge>
          ) : null,
        }))}
      />
    </div>
  );
}
