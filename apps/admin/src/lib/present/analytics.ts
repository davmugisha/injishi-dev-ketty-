import type {
  AdminAnalytics,
  AdminAnalyticsSeries,
  AdminSavedScope,
} from "@injishi/contracts";

import type { SectionRow } from "@/lib/types";

import { EMPTY, count, date, detail } from "./format";

/**
 * Analytics (F-A14).
 *
 * The totals are `AdminKpi[]`, the same shape the overview uses, and they are
 * mapped by `presentKpis` in `present/overview.ts` — not re-mapped here. One
 * KPI must read identically wherever it appears, and a second mapping is how
 * the same number ends up formatted two ways on two screens.
 */

/**
 * A series, reduced to the sentence a table row can hold.
 *
 * The points are NOT re-bucketed. Aggregation happened on the server, and two
 * different bucketings of the same events produce two different-looking truths;
 * the console draws what it was given.
 *
 * Nothing here is coloured. A series is a shape over time with no good or bad
 * direction that the contract states, and a green "up" on a metric nobody
 * declared a polarity for is the console inventing an opinion.
 */
export function presentSeries(series: AdminAnalyticsSeries): SectionRow {
  const points = series.points;
  const first = points[0];
  const last = points[points.length - 1];

  return {
    ref: series.key,
    subject: series.label,
    context:
      points.length === 0
        ? "no data in range"
        : detail(
            `${count(points.length)} points`,
            `${date(first!.at)} – ${date(last!.at)}`,
            `latest ${last!.value.toLocaleString("en-RW")}`,
          ),
    state: points.length === 0 ? "empty" : "series",
    intent: "default",
  };
}

/**
 * A saved scope.
 *
 * `metricSet` and `dateRange` cross as `unknown` and stay off the row. The
 * contract does not pin either shape, so what is shown is what is certain: who
 * saved it, where it applies, and when.
 */
export function presentSavedScope(scope: AdminSavedScope): SectionRow {
  return {
    ref: date(scope.createdAt),
    subject: scope.districtName ?? "all districts",
    context: detail(
      scope.ownerUserId ? `saved by ${scope.ownerUserId}` : "shared scope",
      scope.districtId !== null ? `district ${scope.districtId}` : null,
    ),
    state: scope.ownerUserId ? "personal" : "shared",
    intent: "default",
  };
}

/** What the section header can say about coverage without overstating it. */
export function presentAnalyticsSummary(data: AdminAnalytics): string {
  if (data.series.length === 0 && data.totals.length === 0) return EMPTY;
  return detail(
    `${count(data.totals.length)} totals`,
    `${count(data.series.length)} series`,
    `${count(data.savedScopes.length)} saved scopes`,
  );
}
