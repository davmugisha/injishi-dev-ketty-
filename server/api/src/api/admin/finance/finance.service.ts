import {
  AdminFailedChargeResponse,
  AdminLedgerResponse,
  AdminPayoutResponse,
  AdminReconRunResponse,
  type AdminListMeta,
  type AdminPayoutQuery,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { desc, eq, sql } from 'drizzle-orm';

import {
  ledgerAccounts,
  ledgerEntries,
  ledgerTransactions,
  orgs,
  payouts,
  reconciliationRuns,
  subscriptionInvoices,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

/** Paging query shape shared by every list route in this area. */
export interface PageQuery {
  page?: number;
  pageSize?: number;
}

/**
 * The console's Finance section, read from the book itself.
 *
 * Everything here is a READ. There is no money command on this surface: an
 * override is `money_overrides` with its dual-authorization CHECK behind it,
 * and a console that could move money with a GET would make that constraint
 * decorative. Finance staff look; they do not post.
 *
 * Three shapes recur and are stated once here rather than in every method:
 *
 * - **Money crosses as an integer plus a currency tag.** `amount()` is
 *   `bigint(mode: 'number')` — integer RWF, no minor unit — and the console
 *   formats it. A pre-formatted string on the wire would make the API the
 *   place a locale is decided, which is the browser's job and nobody else's.
 * - **Every money amount column in §8 is NULLABLE except `ledger_entries`.**
 *   `payouts.amount_rwf`, `subscription_invoices.amount_rwf`,
 *   `placement_fees.amount_rwf`, `registration_fees.amount_rwf` and
 *   `subscription_plans.price_rwf` all allow NULL while the contracts declare
 *   the field non-null. They are coalesced to 0 at the edge. Dropping the row
 *   instead would take money off a finance screen to satisfy a type, which is
 *   the one thing a reconciliation console must never do; and `null` cannot be
 *   widened into the contract without making every consumer handle a case that
 *   only ever means "a writer forgot".
 * - **An empty table answers 200 with `total: 0`.** A fresh platform has no
 *   ledger, and "no rows" is a true statement about it rather than a failure to
 *   load. Nothing here throws 404.
 */
@Injectable()
export class FinanceAdminService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * `GET /api/v1/admin/finance/ledger` — the platform-wide posting list.
   *
   * Three tables, because the wire row is deliberately not any one of them:
   * `ledger_entries` carries the amount and the account it hit,
   * `ledger_transactions` carries what moved the money (`kind`, `memo`,
   * `adapter_mode`, `occurred_at`), and `ledger_accounts` carries the CODE.
   * The code rather than the account uuid is what a finance staffer reconciles
   * against, so resolving it here saves the console a lookup it would get
   * wrong.
   *
   * `direction` is derived from the sign of `amount_rwf`, not stored. The book
   * is single-sided (ADR-016 D-b): one entry per money event, sign carrying
   * which way it went. The magnitude crosses the wire with a `direction`
   * beside it so the console never has to decide what a negative number means
   * — the decision this method exists to make once.
   *
   * Ordered newest first: a ledger is read from the end.
   */
  async ledger(query: PageQuery): Promise<AdminLedgerResponse> {
    const { page, pageSize, offset } = paging(query);

    const rows = await this.db
      .select({
        id: ledgerEntries.id,
        transactionId: ledgerEntries.transactionId,
        kind: ledgerTransactions.kind,
        adapterMode: ledgerTransactions.adapterMode,
        memo: ledgerTransactions.memo,
        accountCode: ledgerAccounts.code,
        amountRwf: ledgerEntries.amountRwf,
        currency: ledgerEntries.currency,
        occurredAt: ledgerTransactions.occurredAt,
      })
      .from(ledgerEntries)
      // Inner joins on purpose: both FKs are NOT NULL, so a row that cannot
      // resolve its transaction or its account is a broken book, not a row to
      // render with blanks.
      .innerJoin(
        ledgerTransactions,
        eq(ledgerTransactions.id, ledgerEntries.transactionId),
      )
      .innerJoin(ledgerAccounts, eq(ledgerAccounts.id, ledgerEntries.accountId))
      .orderBy(desc(ledgerTransactions.occurredAt), desc(ledgerEntries.id))
      .limit(pageSize)
      .offset(offset);

    const total = await this.countOf(
      this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(ledgerEntries)
        .innerJoin(
          ledgerTransactions,
          eq(ledgerTransactions.id, ledgerEntries.transactionId),
        )
        .innerJoin(
          ledgerAccounts,
          eq(ledgerAccounts.id, ledgerEntries.accountId),
        ),
    );

    return AdminLedgerResponse.parse({
      items: rows.map((r) => ({
        id: r.id,
        transactionId: r.transactionId,
        kind: r.kind,
        adapterMode: r.adapterMode,
        memo: r.memo,
        accountCode: r.accountCode,
        direction: r.amountRwf < 0 ? 'credit' : 'debit',
        // Magnitude, with the sign already spent on `direction` above. Sending
        // both would let a console negate a credit twice.
        amountRwf: Math.abs(r.amountRwf),
        currency: r.currency,
        occurredAt: r.occurredAt.toISOString(),
      })),
      meta: meta(total, page, pageSize),
    });
  }

  /**
   * `GET /api/v1/admin/finance/payouts` — money owed out, and where it is.
   *
   * `settledAt` and `failureReason` are read from `payouts.settled_at` and
   * `payouts.failure_reason` (migration 0029), and are null wherever those are.
   *
   * They were ALWAYS null before that migration, deliberately: the only
   * settlement-shaped column was `scheduled_release_at`, which says when a
   * payout MAY leave, and reading it as settlement rendered a `held` payout as
   * "settled on <date>" on a finance screen. Finance and orgs disagreed about
   * that once — finance sent the schedule, orgs sent null — and one contract
   * field meaning two things depending on which screen asked was worse than
   * the missing column. Both now read the same two columns.
   *
   * WHAT IS STILL TRUE, AND WHY THESE WILL STAY NULL FOR NOW: nothing in this
   * API writes a payout row at all — no processor, no adapter callback, no
   * disbursement path. The columns give the payout lifecycle somewhere to
   * record settlement when it is built; they do not build it. `status` remains
   * the authority on whether money moved.
   *
   * Filtered by `status` when the query names one — the finance worklist is
   * "what is held", and paging through everything to find it is not a worklist.
   */
  async payouts(query: AdminPayoutQuery): Promise<AdminPayoutResponse> {
    const { page, pageSize, offset } = paging(query);
    const where = query.status ? eq(payouts.status, query.status) : undefined;

    const rows = await this.db
      .select({
        id: payouts.id,
        workspaceId: payouts.workspaceId,
        amountRwf: payouts.amountRwf,
        currency: payouts.currency,
        status: payouts.status,
        createdAt: payouts.createdAt,
        scheduledReleaseAt: payouts.scheduledReleaseAt,
        settledAt: payouts.settledAt,
        failureReason: payouts.failureReason,
      })
      .from(payouts)
      .where(where)
      .orderBy(desc(payouts.createdAt))
      .limit(pageSize)
      .offset(offset);

    const total = await this.countOf(
      this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(payouts)
        .where(where),
    );

    return AdminPayoutResponse.parse({
      items: rows.map((r) => ({
        id: r.id,
        workspaceId: r.workspaceId,
        // Nullable column, non-null contract: see the class comment.
        amountRwf: r.amountRwf ?? 0,
        currency: r.currency,
        status: r.status,
        failureReason: r.failureReason,
        createdAt: r.createdAt.toISOString(),
        // The recorded settlement, never the schedule. See the method comment.
        settledAt: r.settledAt?.toISOString() ?? null,
      })),
      meta: meta(total, page, pageSize),
    });
  }

  /**
   * `GET /api/v1/admin/finance/failed-charges` — invoices that came back
   * `failed`.
   *
   * `subscription_invoices` is, despite its name, the org's WHOLE invoice
   * ledger (D21): a row is a registration fee or a subscription charge, and
   * `invoice_kind` says which. Both can fail and both belong on this list —
   * a registration stuck at `pending_payment` because its fee charge failed is
   * exactly the case a staffer opens this screen for — so the query filters on
   * `status` alone and lets `invoiceKind` travel to the console.
   *
   * The failed value is `'failed'` from `subscription_invoice_status`
   * (`pending | paid | failed`); the enum is the spelling, not a guess.
   *
   * The org's identity rides along because the answer to a failed charge is to
   * contact a business, and a uuid is not something anyone can telephone. The
   * join is inner: `org_id` is NOT NULL and an invoice whose org does not
   * resolve is a broken row, not a row to show anonymously.
   */
  async failedCharges(query: PageQuery): Promise<AdminFailedChargeResponse> {
    const { page, pageSize, offset } = paging(query);
    const where = eq(subscriptionInvoices.status, 'failed');

    const rows = await this.db
      .select({
        invoiceId: subscriptionInvoices.id,
        orgId: subscriptionInvoices.orgId,
        orgName: orgs.legalName,
        invoiceKind: subscriptionInvoices.invoiceKind,
        amountRwf: subscriptionInvoices.amountRwf,
        currency: subscriptionInvoices.currency,
        status: subscriptionInvoices.status,
        createdAt: subscriptionInvoices.createdAt,
      })
      .from(subscriptionInvoices)
      .innerJoin(orgs, eq(orgs.id, subscriptionInvoices.orgId))
      .where(where)
      .orderBy(desc(subscriptionInvoices.createdAt))
      .limit(pageSize)
      .offset(offset);

    const total = await this.countOf(
      this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(subscriptionInvoices)
        .innerJoin(orgs, eq(orgs.id, subscriptionInvoices.orgId))
        .where(where),
    );

    return AdminFailedChargeResponse.parse({
      items: rows.map((r) => ({
        invoiceId: r.invoiceId,
        orgId: r.orgId,
        orgName: r.orgName,
        invoiceKind: r.invoiceKind,
        // Nullable column, non-null contract: see the class comment.
        amountRwf: r.amountRwf ?? 0,
        currency: r.currency,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
      meta: meta(total, page, pageSize),
    });
  }

  /**
   * `GET /api/v1/admin/finance/reconciliation-runs` — the match against the
   * payment adapter.
   *
   * FIVE OF THIS ROW'S SEVEN FIELDS HAVE NO COLUMN. `reconciliation_runs` is
   * `{ id, status, report jsonb, adapter_mode, ran_at }` and nothing else, so
   * `windowStart`, `windowEnd`, `entryCount`, `matchedCount` and
   * `discrepancyCount` are read OUT OF the report blob.
   *
   * They are read defensively, and the defence is the point rather than
   * politeness: `report` is nullable, nothing in this repository writes it yet,
   * and the first writer's key casing is not settled — so both `windowStart`
   * and `window_start` are accepted. A console that reached into an untyped
   * blob and got `undefined` where it expected a number would render `NaN`, and
   * a service that trusted the blob would 500 the whole Finance screen because
   * one old run was written by a previous shape. Neither is an acceptable way
   * to lose a reconciliation report.
   *
   * A missing count reads as 0 because the contract is
   * `int().nonnegative()`, and "the report did not say" and "zero" are
   * genuinely the same statement for a count nobody recorded. A missing window
   * bound stays `null`, because a date is not zero.
   */
  async reconciliationRuns(query: PageQuery): Promise<AdminReconRunResponse> {
    const { page, pageSize, offset } = paging(query);

    const rows = await this.db
      .select({
        id: reconciliationRuns.id,
        report: reconciliationRuns.report,
        ranAt: reconciliationRuns.ranAt,
      })
      .from(reconciliationRuns)
      .orderBy(desc(reconciliationRuns.ranAt))
      .limit(pageSize)
      .offset(offset);

    const total = await this.countOf(
      this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(reconciliationRuns),
    );

    return AdminReconRunResponse.parse({
      items: rows.map((r) => {
        const report = asRecord(r.report);
        return {
          id: r.id,
          windowStart: reportTimestamp(report, 'windowStart', 'window_start'),
          windowEnd: reportTimestamp(report, 'windowEnd', 'window_end'),
          entryCount: reportCount(report, 'entryCount', 'entry_count'),
          matchedCount: reportCount(report, 'matchedCount', 'matched_count'),
          discrepancyCount: reportCount(
            report,
            'discrepancyCount',
            'discrepancy_count',
          ),
          ranAt: r.ranAt.toISOString(),
        };
      }),
      meta: meta(total, page, pageSize),
    });
  }

  /**
   * Runs a `count(*)` query and returns 0 when it comes back empty.
   *
   * `count(*)` over an empty table still returns one row containing 0, so the
   * fallback is for the shape of the result rather than for the data — but
   * writing `rows[0].n` unguarded is how a list route learns to throw on a
   * fresh database, and this area's whole contract is that empty is 200.
   */
  private async countOf(
    query: Promise<Array<{ n: number }>>,
  ): Promise<number> {
    const [row] = await query;
    return row?.n ?? 0;
  }
}

/** 1-based page, 25 by default, capped by the contract's query schema at 100. */
function paging(query: PageQuery): {
  page: number;
  pageSize: number;
  offset: number;
} {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;
  return { page, pageSize, offset: (page - 1) * pageSize };
}

/**
 * `total` is the count BEFORE paging, so the console can say "1-25 of 380"
 * without a second request.
 */
function meta(total: number, page: number, pageSize: number): AdminListMeta {
  return { total, page, pageSize };
}

/** A jsonb column is `unknown`; narrow it to something indexable, or to `{}`. */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * A count out of the report blob, under either casing.
 *
 * Anything that is not a finite non-negative number — absent, null, a string, a
 * float, NaN — reads as 0 rather than being coerced, because `Number("clean")`
 * is `NaN` and `NaN` parses out of the contract as a thrown error on a screen
 * that was only meant to show a report.
 */
function reportCount(
  report: Record<string, unknown>,
  ...keys: string[]
): number {
  for (const key of keys) {
    const value = report[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      return Math.trunc(value);
    }
  }
  return 0;
}

/**
 * A window bound out of the report blob, normalised to ISO 8601 UTC.
 *
 * Accepts a string or an epoch number and rejects anything `Date` cannot parse,
 * because `new Date("last tuesday").toISOString()` throws — inside a `.map()`
 * over a page of runs, that is a 500 for the whole screen caused by one bad
 * report.
 */
function reportTimestamp(
  report: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = report[key];
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    const at = new Date(value);
    if (!Number.isNaN(at.getTime())) return at.toISOString();
  }
  return null;
}
