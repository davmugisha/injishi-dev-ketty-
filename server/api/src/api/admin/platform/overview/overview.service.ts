import { Inject, Injectable } from '@nestjs/common';
import { desc, eq, sql } from 'drizzle-orm';
import {
  AdminOverview,
  type AdminDistrictDensity,
  type AdminInvoiceKind,
  type AdminKpi,
  type AdminRevenueLine,
  type AdminWorkQueueItem,
} from '@injishi/contracts';

import {
  dataSubjectRequests,
  escalations,
} from '../../../../database/drizzle/governance';
import { districts } from '../../../../database/drizzle/geography';
import { bookings } from '../../../../database/drizzle/hospitality';
import { subscriptionInvoices } from '../../../../database/drizzle/money';
import { orgs } from '../../../../database/drizzle/org';
import {
  DRIZZLE,
  type Database,
} from '../../../../shared/database/database.module';
import { PlatformHealthSnapshotService } from '../health-snapshots.service';
import { REPORTING_WINDOW_DAYS, reportingWindow } from '../reporting-window';

/**
 * v1 is single-currency and the `currency()` column defaults to `RWF`, so an
 * amount read off a row already carries its tag. This constant answers the one
 * case a row cannot: a revenue line with NO invoices behind it, which still has
 * to say what currency its zero is denominated in.
 */
const PLATFORM_CURRENCY = 'RWF';

/**
 * The revenue lines the screen always shows, in order.
 *
 * Both are emitted even at zero. A line that disappears when it earns nothing
 * makes "we collected no registration fees this month" indistinguishable from
 * "registration fees are not a thing we bill for", and the first is the fact
 * somebody opened this screen to learn.
 */
const REVENUE_LINES: { kind: AdminInvoiceKind; label: string }[] = [
  { kind: 'registration_fee', label: 'Registration fees' },
  { kind: 'subscription', label: 'Subscriptions' },
];

/**
 * `GET /api/v1/admin/overview` — the console's landing screen, computed.
 *
 * Every number below comes out of a table. That is the whole point of this
 * service: the screen it feeds previously rendered a hand-written array, and a
 * KPI strip that is always right is worse than no KPI strip, because it is
 * believed. Where a figure genuinely cannot be computed the field is `null`
 * rather than 0 — see `previousValue` on the two state counts.
 *
 * Empty is 200. A fresh database has no orgs, no bookings, no invoices and no
 * health snapshots, and this answers zeros and empty arrays for all of them. A
 * console that errored instead would be saying the platform is broken when the
 * true statement is that nothing has happened yet.
 */
@Injectable()
export class AdminOverviewService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly snapshots: PlatformHealthSnapshotService,
  ) {}

  async read(): Promise<AdminOverview> {
    const window = reportingWindow();

    const [
      orgTotals,
      bookingTotals,
      revenue,
      density,
      pending,
      adapters,
      queues,
    ] = await Promise.all([
      this.orgTotals(window.start),
      this.bookingTotals(window.start, window.previousStart),
      this.revenueLines(window.start, window.previousStart),
      this.districtDensity(window.start),
      this.pendingWork(),
      this.snapshots.adapters(),
      this.snapshots.queues(),
    ]);

    const collected = revenue.reduce((sum, line) => sum + line.amountRwf, 0);
    const collectedBefore = revenue.reduce(
      (sum, line) => sum + (line.previousAmountRwf ?? 0),
      0,
    );

    const kpis: AdminKpi[] = [
      {
        key: 'orgs.total',
        label: 'Registered businesses',
        value: orgTotals.total,
        unit: 'count',
        // Honest, because `created_at` is a fact the row keeps: this is how
        // many businesses existed when the window opened.
        previousValue: orgTotals.totalBeforeWindow,
      },
      {
        key: 'orgs.active',
        label: 'Active businesses',
        value: orgTotals.active,
        unit: 'count',
        // NULL, and it has to be. `orgs.registration_status` is a CURRENT
        // state with no history behind it — nothing records when a row became
        // active. Counting today's active orgs that happen to predate the
        // window would answer a different question while looking like this
        // one, which is the failure a null avoids. A real comparison needs the
        // transition written to `audit_events`, not a guess here.
        previousValue: null,
      },
      {
        key: 'orgs.awaiting_review',
        label: 'Awaiting review',
        value: orgTotals.awaitingReview,
        unit: 'count',
        // Same reason: a queue depth has no recorded past.
        previousValue: null,
      },
      {
        key: 'bookings.created',
        label: `Bookings (${REPORTING_WINDOW_DAYS} days)`,
        value: bookingTotals.current,
        unit: 'count',
        previousValue: bookingTotals.previous,
      },
      {
        key: 'revenue.collected',
        label: `Collected (${REPORTING_WINDOW_DAYS} days)`,
        value: collected,
        unit: 'rwf',
        previousValue: collectedBefore,
      },
      {
        key: 'districts.covered',
        label: 'Districts with a business',
        value: orgTotals.districtsCovered,
        unit: 'count',
        previousValue: orgTotals.districtsCoveredBeforeWindow,
      },
    ];

    const workQueue: AdminWorkQueueItem[] = [
      {
        key: 'orgs.review',
        count: orgTotals.awaitingReview,
        title: 'Businesses awaiting review',
        detail: 'Submitted, TIN-verified or field-verified and not yet decided',
        href: '/businesses',
      },
      {
        key: 'escalations.open',
        count: pending.openEscalations,
        title: 'Open escalations',
        detail: 'Raised and not yet resolved',
        href: '/moderation',
      },
      {
        key: 'dsr.open',
        count: pending.openDataSubjectRequests,
        title: 'Data subject requests',
        detail: 'Received and not yet fulfilled',
        href: '/compliance',
      },
      {
        key: 'invoices.failed',
        count: pending.failedInvoices,
        title: 'Failed charges',
        detail: 'Invoices the payment adapter refused',
        href: '/finance',
      },
    ];

    // Parsed before it leaves. The contract is the one definition of this shape
    // and the console parses the same schema on arrival; validating here means
    // a mapping mistake fails in the API's own logs rather than as a blank
    // panel somebody has to bisect from a browser.
    return AdminOverview.parse({
      kpis,
      revenue,
      density,
      workQueue,
      adapters,
      queues,
    });
  }

  /**
   * Six counts off `orgs` in ONE pass.
   *
   * `count(*) FILTER (WHERE …)` rather than six round trips: the aggregate is
   * evaluated over a single scan, and — more importantly — all six figures
   * describe the SAME instant. Separate queries can be interleaved with a
   * registration and produce a total that does not equal the sum of its parts,
   * which is exactly the arithmetic a reader trusts without checking.
   *
   * `pending_payment` is deliberately absent from `awaitingReview`: that org
   * has not paid its registration fee, so no reviewer is blocked on it — the
   * registrant is blocked on themselves (D23). Counting it would fill a
   * government officer's queue with rows they cannot act on.
   */
  private async orgTotals(windowStart: Date): Promise<{
    total: number;
    totalBeforeWindow: number;
    active: number;
    awaitingReview: number;
    districtsCovered: number;
    districtsCoveredBeforeWindow: number;
  }> {
    const [row] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        totalBeforeWindow: sql<number>`count(*) filter (where ${orgs.createdAt} < ${windowStart})::int`,
        active: sql<number>`count(*) filter (where ${orgs.registrationStatus} = 'active')::int`,
        awaitingReview: sql<number>`count(*) filter (where ${orgs.registrationStatus} in ('submitted', 'tin_verified', 'field_verified'))::int`,
        districtsCovered: sql<number>`count(distinct ${orgs.districtId})::int`,
        districtsCoveredBeforeWindow: sql<number>`count(distinct ${orgs.districtId}) filter (where ${orgs.createdAt} < ${windowStart})::int`,
      })
      .from(orgs);

    // An aggregate over an empty table still returns one row of zeros, so the
    // fallbacks are defensive rather than expected — but they are cheaper than
    // a 500 on the landing screen if that ever stops being true.
    return {
      total: row?.total ?? 0,
      totalBeforeWindow: row?.totalBeforeWindow ?? 0,
      active: row?.active ?? 0,
      awaitingReview: row?.awaitingReview ?? 0,
      districtsCovered: row?.districtsCovered ?? 0,
      districtsCoveredBeforeWindow: row?.districtsCoveredBeforeWindow ?? 0,
    };
  }

  /** Bookings created in the window, and in the window immediately before it. */
  private async bookingTotals(
    windowStart: Date,
    previousStart: Date,
  ): Promise<{ current: number; previous: number }> {
    const [row] = await this.db
      .select({
        current: sql<number>`count(*) filter (where ${bookings.createdAt} >= ${windowStart})::int`,
        previous: sql<number>`count(*) filter (where ${bookings.createdAt} >= ${previousStart} and ${bookings.createdAt} < ${windowStart})::int`,
      })
      .from(bookings);

    return { current: row?.current ?? 0, previous: row?.previous ?? 0 };
  }

  /**
   * Money actually COLLECTED, per invoice kind, in each window.
   *
   * `status = 'paid'` is the whole difference between revenue and hope. A
   * pending invoice is a charge that may still fail — it lands in the work
   * queue below when it does — and summing it here would report income the
   * platform does not have.
   */
  private async revenueLines(
    windowStart: Date,
    previousStart: Date,
  ): Promise<AdminRevenueLine[]> {
    const rows = await this.db
      .select({
        invoiceKind: subscriptionInvoices.invoiceKind,
        // v1 is single-currency; `min()` READS the tag the rows carry rather
        // than asserting one, and grouping stays on the kind alone.
        currency: sql<string | null>`min(${subscriptionInvoices.currency})`,
        // `::bigint` keeps a large RWF total exact in Postgres; node-postgres
        // hands bigint back as a string, hence `Number()` below. RWF has no
        // minor unit, so these are whole francs and never cents.
        currentRwf: sql<string>`coalesce(sum(${subscriptionInvoices.amountRwf}) filter (where ${subscriptionInvoices.createdAt} >= ${windowStart}), 0)::bigint`,
        previousRwf: sql<string>`coalesce(sum(${subscriptionInvoices.amountRwf}) filter (where ${subscriptionInvoices.createdAt} >= ${previousStart} and ${subscriptionInvoices.createdAt} < ${windowStart}), 0)::bigint`,
      })
      .from(subscriptionInvoices)
      .where(eq(subscriptionInvoices.status, 'paid'))
      .groupBy(subscriptionInvoices.invoiceKind);

    const byKind = new Map(rows.map((row) => [row.invoiceKind, row]));

    return REVENUE_LINES.map(({ kind, label }) => {
      const row = byKind.get(kind);
      return {
        line: label,
        amountRwf: Number(row?.currentRwf ?? 0),
        // `char(3)` is blank-padded by Postgres, so trim before trusting it.
        currency: row?.currency?.trim() || PLATFORM_CURRENCY,
        previousAmountRwf: Number(row?.previousRwf ?? 0),
      };
    });
  }

  /**
   * Businesses per district, read from the `districts` table.
   *
   * The district list is NOT written down here. Rwanda's districts live in
   * `districts`, seeded from the official codes, and a copy in this file would
   * be a second answer to "what districts are there" that nothing keeps in
   * step. A LEFT JOIN so a district with no businesses still appears: a
   * coverage gap is precisely what this panel exists to show, and a district
   * that vanishes when it has nothing reads as full coverage.
   *
   * `previousOrgCount` is a real historical count — `created_at` is a fact the
   * org row keeps, so "how many were here when the window opened" is answerable
   * without a history table, unlike the status counts above.
   */
  private districtDensity(windowStart: Date): Promise<AdminDistrictDensity[]> {
    return this.db
      .select({
        districtId: districts.id,
        districtName: districts.name,
        orgCount: sql<number>`count(${orgs.id})::int`,
        previousOrgCount: sql<number>`count(${orgs.id}) filter (where ${orgs.createdAt} < ${windowStart})::int`,
      })
      .from(districts)
      .leftJoin(orgs, eq(orgs.districtId, districts.id))
      .groupBy(districts.id, districts.name)
      .orderBy(desc(sql`count(${orgs.id})`), districts.name);
  }

  /**
   * The three "somebody has to deal with this" counts that do not come off
   * `orgs`. The fourth work-queue row reuses `orgTotals.awaitingReview` rather
   * than counting the same predicate twice.
   *
   * `::int` on every count because Postgres `count()` is `bigint` and
   * node-postgres would otherwise hand back the string `"3"` — which
   * `AdminWorkQueueItem` refuses loudly here, rather than becoming a queue that
   * sorts 10 before 9 in a browser.
   */
  private async pendingWork(): Promise<{
    openEscalations: number;
    openDataSubjectRequests: number;
    failedInvoices: number;
  }> {
    const [escalationRows, requestRows, invoiceRows] = await Promise.all([
      this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(escalations)
        .where(eq(escalations.state, 'open')),
      this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(dataSubjectRequests)
        .where(eq(dataSubjectRequests.state, 'received')),
      this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(subscriptionInvoices)
        .where(eq(subscriptionInvoices.status, 'failed')),
    ]);

    return {
      openEscalations: escalationRows[0]?.n ?? 0,
      openDataSubjectRequests: requestRows[0]?.n ?? 0,
      failedInvoices: invoiceRows[0]?.n ?? 0,
    };
  }
}
