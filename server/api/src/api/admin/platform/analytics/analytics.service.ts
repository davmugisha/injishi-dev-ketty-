import { Inject, Injectable } from '@nestjs/common';
import { desc, eq, gte, sql } from 'drizzle-orm';
import {
  AdminAnalytics,
  type AdminAnalyticsSeries,
  type AdminKpi,
  type AdminSavedScope,
} from '@injishi/contracts';

import { analyticsEvents } from '../../../../database/drizzle/events';
import { districts } from '../../../../database/drizzle/geography';
import { savedDashboardScopes } from '../../../../database/drizzle/governance';
import {
  DRIZZLE,
  type Database,
} from '../../../../shared/database/database.module';
import { REPORTING_WINDOW_DAYS, reportingWindow } from '../reporting-window';

/**
 * How many named series the chart carries at most, largest first.
 *
 * `analytics_events.event_name` is a free text column written by whatever fires
 * the event, so the number of distinct names is unbounded by construction. An
 * uncapped response would grow with the product's instrumentation until this
 * screen is the slowest thing in the console — and a chart with ninety lines
 * communicates nothing anyway. The cap is applied by TOTAL VOLUME so the series
 * that are dropped are the ones with least to say.
 */
const MAX_SERIES = 12;

/**
 * `GET /api/v1/admin/analytics` (INTERFACE.md §13).
 *
 * Every point is a real bucket of real rows. There is no interpolation, no
 * zero-filling of empty days and no synthetic baseline: the series is exactly
 * what `analytics_events` holds, bucketed by day, and a day with no events
 * simply has no point. Zero-filling would be the more attractive chart and the
 * less true one — it makes "we stopped recording" and "nothing happened"
 * identical, and those are the two answers this screen exists to separate.
 */
@Injectable()
export class AdminAnalyticsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async read(): Promise<AdminAnalytics> {
    const window = reportingWindow();

    const [totals, series, savedScopes] = await Promise.all([
      this.totals(window.start, window.previousStart),
      this.series(window.start),
      this.savedScopes(),
    ]);

    return AdminAnalytics.parse({ totals, series, savedScopes });
  }

  /**
   * Three headline numbers off `analytics_events`, both windows, one scan.
   *
   * `opaque_actor_id` is what the platform records instead of a user id on an
   * analytics row, so "actors" is the closest honest thing to an active-user
   * count — it is a count of distinct pseudonyms, which is why the label says
   * so rather than saying "users".
   */
  private async totals(
    windowStart: Date,
    previousStart: Date,
  ): Promise<AdminKpi[]> {
    const [row] = await this.db
      .select({
        events: sql<number>`count(*) filter (where ${analyticsEvents.occurredAt} >= ${windowStart})::int`,
        previousEvents: sql<number>`count(*) filter (where ${analyticsEvents.occurredAt} >= ${previousStart} and ${analyticsEvents.occurredAt} < ${windowStart})::int`,
        actors: sql<number>`count(distinct ${analyticsEvents.opaqueActorId}) filter (where ${analyticsEvents.occurredAt} >= ${windowStart})::int`,
        previousActors: sql<number>`count(distinct ${analyticsEvents.opaqueActorId}) filter (where ${analyticsEvents.occurredAt} >= ${previousStart} and ${analyticsEvents.occurredAt} < ${windowStart})::int`,
        eventTypes: sql<number>`count(distinct ${analyticsEvents.eventName}) filter (where ${analyticsEvents.occurredAt} >= ${windowStart})::int`,
        previousEventTypes: sql<number>`count(distinct ${analyticsEvents.eventName}) filter (where ${analyticsEvents.occurredAt} >= ${previousStart} and ${analyticsEvents.occurredAt} < ${windowStart})::int`,
      })
      .from(analyticsEvents);

    return [
      {
        key: 'analytics.events',
        label: `Events (${REPORTING_WINDOW_DAYS} days)`,
        value: row?.events ?? 0,
        unit: 'count',
        previousValue: row?.previousEvents ?? 0,
      },
      {
        key: 'analytics.actors',
        label: 'Distinct actors',
        value: row?.actors ?? 0,
        unit: 'count',
        previousValue: row?.previousActors ?? 0,
      },
      {
        key: 'analytics.event_types',
        label: 'Event types seen',
        value: row?.eventTypes ?? 0,
        unit: 'count',
        previousValue: row?.previousEventTypes ?? 0,
      },
    ];
  }

  /**
   * One series per event name, bucketed by day.
   *
   * Bucketing happens in Postgres, not here: `date_trunc` over the window is
   * one grouped scan, where pulling raw rows and counting them in Node would
   * move the whole window's events across the wire to be thrown away. The
   * bucket width is a SERVER decision carried implicitly by the spacing of the
   * points — the contract says the console plots what it is given and never
   * re-buckets, because two bucketings of the same events are two different
   * answers to one question.
   *
   * `date_trunc` on a `timestamptz` truncates in the session time zone. That is
   * left alone deliberately rather than pinned to UTC: the platform serves one
   * country, and a "day" that a Kigali reader recognises is the useful one.
   */
  private async series(windowStart: Date): Promise<AdminAnalyticsSeries[]> {
    const bucket = sql<Date>`date_trunc('day', ${analyticsEvents.occurredAt})`;

    const rows = await this.db
      .select({
        eventName: analyticsEvents.eventName,
        at: bucket,
        value: sql<number>`count(*)::int`,
      })
      .from(analyticsEvents)
      .where(gte(analyticsEvents.occurredAt, windowStart))
      .groupBy(analyticsEvents.eventName, bucket)
      .orderBy(analyticsEvents.eventName, bucket);

    // Grouped in insertion order, so the points inside each series stay in the
    // order the `ORDER BY` produced — ascending by bucket, which is the order a
    // chart needs and the one a re-sort in the browser would have to redo.
    const byName = new Map<string, { at: string; value: number }[]>();
    const volume = new Map<string, number>();

    for (const row of rows) {
      const points = byName.get(row.eventName) ?? [];
      points.push({ at: new Date(row.at).toISOString(), value: row.value });
      byName.set(row.eventName, points);
      volume.set(row.eventName, (volume.get(row.eventName) ?? 0) + row.value);
    }

    return [...byName.entries()]
      .sort((a, b) => (volume.get(b[0]) ?? 0) - (volume.get(a[0]) ?? 0))
      .slice(0, MAX_SERIES)
      .map(([key, points]) => ({
        key,
        // The event name IS the label. Inventing a prettier one here would be a
        // second vocabulary for the same events, and the console would then
        // show a name that appears nowhere in the data it came from.
        label: key,
        points,
      }));
  }

  /**
   * Saved dashboard scopes, newest first, with the district name resolved.
   *
   * LEFT JOIN because `district_id` is nullable and null means "every district"
   * — an INNER JOIN would silently drop exactly the platform-wide scopes, which
   * are the ones most likely to be saved.
   */
  private async savedScopes(): Promise<AdminSavedScope[]> {
    const rows = await this.db
      .select({
        id: savedDashboardScopes.id,
        ownerUserId: savedDashboardScopes.ownerUserId,
        metricSet: savedDashboardScopes.metricSet,
        districtId: savedDashboardScopes.districtId,
        districtName: districts.name,
        dateRange: savedDashboardScopes.dateRange,
        createdAt: savedDashboardScopes.createdAt,
      })
      .from(savedDashboardScopes)
      .leftJoin(districts, eq(districts.id, savedDashboardScopes.districtId))
      .orderBy(desc(savedDashboardScopes.createdAt));

    return rows.map((row) => ({
      id: row.id,
      ownerUserId: row.ownerUserId,
      metricSet: row.metricSet,
      districtId: row.districtId,
      districtName: row.districtName,
      dateRange: row.dateRange,
      // ISO 8601 UTC, per the seam's time rule — a `Date` would survive JSON
      // as a string anyway, but only by accident of the serializer.
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
