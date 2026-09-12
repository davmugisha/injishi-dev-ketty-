import { AdminAnalytics } from "@injishi/contracts";

import { apiGet, type ApiResult } from "./server";

/**
 * Analytics (F-A14) — `GET /api/v1/admin/analytics`.
 *
 * P: `admin.analytics.view`. Totals, time series aggregated from
 * `analytics_events`, and the saved scopes staff have kept.
 *
 * The series arrive as raw `{ at, value }` points. Aggregation happened on the
 * server; the console draws them and does not re-bucket, because two different
 * bucketings of the same events produce two different-looking truths.
 */
export function getAnalytics(): Promise<ApiResult<AdminAnalytics>> {
  return apiGet("/api/v1/admin/analytics", AdminAnalytics);
}
