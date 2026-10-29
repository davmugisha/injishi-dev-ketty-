import {
  type AdminInvoice,
  AdminOboAuditResponse,
  AdminOboListResponse,
  AdminOrgDetail,
  type AdminOrgListQuery,
  AdminOrgListResponse,
  AdminOrgMoney,
  AdminOrgPeopleResponse,
  AdminOrgPropertiesResponse,
  AdminOrgReviewQueueResponse,
  AdminOrgSubscription,
  AdminOrgTimelineResponse,
  type ReviewCoverage,
} from '@injishi/contracts';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';

import { users } from '../../../database/drizzle/auth';
import { districts } from '../../../database/drizzle/geography';
import {
  auditEvents,
  recordAccessLogs,
} from '../../../database/drizzle/governance';
import {
  listings,
  properties,
  roomTypes,
  rooms,
} from '../../../database/drizzle/inventory';
import {
  ledgerAccounts,
  ledgerEntries,
  ledgerTransactions,
  payouts,
  subscriptionInvoices,
  subscriptionPlans,
  subscriptions,
} from '../../../database/drizzle/money';
import {
  oboRegistrations,
  orgCertificates,
  orgMemberships,
  orgRegistrationEvents,
  orgRegistrationReviews,
  orgs,
  oversightAssignments,
  tinVerifications,
  workspaces,
} from '../../../database/drizzle/org';
import { PsfMembershipService } from '../../../modules/organization/application/psf-membership.service';
import { TIN_RECHECK_CEILING } from '../../../modules/organization/domain/tin-recheck';
import { pendingTinAttemptsSql } from '../../../modules/organization/infrastructure/tin-recheck.sql';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

/** `timestamptz` reaches the wire as ISO 8601 UTC; `date` columns already are strings. */
const iso = (at: Date): string => at.toISOString();

/**
 * A money column that is nullable in Postgres and non-null in the contract.
 *
 * `subscription_invoices.amount_rwf` and `payouts.amount_rwf` are both `bigint`
 * WITHOUT `notNull` — a row can be written before its amount is settled.
 * `AdminInvoice.amountRwf` and `AdminPayout.amountRwf` are `z.number()`, so
 * sending the null would fail the response parse and 500 a page that has a
 * perfectly readable invoice on it. Zero is the honest stand-in: the console
 * shows RWF 0 against a row whose amount was never set, which is visibly wrong
 * in the right way. Widening the contract to nullable would instead push the
 * same question onto every reader of it.
 */
const rwf = (amount: number | null): number => amount ?? 0;

/**
 * The Businesses section of the admin console, read from the tables that own
 * each fact rather than from anything the console used to keep locally.
 *
 * Every method parses its payload through the `@injishi/contracts` schema
 * before returning it. That is not belt-and-braces: this service composes rows
 * from a dozen tables and derives four fields no column holds, and a derived
 * field is exactly the kind of thing that silently becomes `undefined`. Parsing
 * on the way out means the API cannot ship a shape it promised not to, and the
 * failure lands here — in a stack trace naming the field — rather than in the
 * browser as a blank panel nobody can explain.
 */
@Injectable()
export class AdminOrgsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    /** PSF membership for the business detail (ADR-056 AC-20). */
    private readonly psf: PsfMembershipService,
  ) {}

  // -------------------------------------------------------------------------
  // GET /admin/orgs
  // -------------------------------------------------------------------------

  async listOrgs(query: AdminOrgListQuery): Promise<AdminOrgListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const filters: SQL[] = [];
    if (query.q) {
      // Free text over the three things staff actually paste into a search box:
      // the trading name and the two identifiers. `tin` and `upi` are both
      // nullable and exactly one is set per domain (`orgs_identifier_shape`),
      // so an OR across them is one search for "whichever identifier this
      // business has" rather than two searches the caller has to choose between.
      const like = `%${query.q}%`;
      const match = or(
        ilike(orgs.legalName, like),
        ilike(orgs.tin, like),
        ilike(orgs.upi, like),
      );
      if (match) filters.push(match);
    }
    if (query.districtId !== undefined) {
      filters.push(eq(orgs.districtId, query.districtId));
    }
    if (query.domain !== undefined) filters.push(eq(orgs.domain, query.domain));
    if (query.registrationStatus !== undefined) {
      filters.push(eq(orgs.registrationStatus, query.registrationStatus));
    }
    const where = filters.length > 0 ? and(...filters) : undefined;

    const rows = await this.db
      .select(orgRowColumns)
      .from(orgs)
      .leftJoin(districts, eq(districts.id, orgs.districtId))
      // `subscriptions_org_uk` makes this at most one row per org, so the join
      // cannot fan a business out into duplicates on the page.
      .leftJoin(subscriptions, eq(subscriptions.orgId, orgs.id))
      .leftJoin(
        subscriptionPlans,
        eq(subscriptionPlans.id, subscriptions.planId),
      )
      .where(where)
      .orderBy(desc(orgs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    // Counted before paging, and counted on `orgs` alone: the joins above are
    // all onto at-most-one rows, so they cannot change the total, and repeating
    // them here would only make the count slower.
    const [counted] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(orgs)
      .where(where);

    return AdminOrgListResponse.parse({
      items: rows.map(toOrgRow),
      meta: { total: counted?.n ?? 0, page, pageSize },
    });
  }

  // -------------------------------------------------------------------------
  // GET /admin/orgs/review-queue
  // -------------------------------------------------------------------------

  /**
   * The businesses sitting at a registration gate.
   *
   * `pending_payment` is deliberately NOT in the queue: the fee settling is the
   * only exit from that state, which is what keeps an unpaid registration out
   * of a government officer's list. `active`, `rejected` and `suspended` are
   * outcomes rather than waits — and a rejected business re-enters at
   * `submitted`, so it comes back here under its own status.
   */
  async reviewQueue(
    page: number,
    pageSize: number,
  ): Promise<AdminOrgReviewQueueResponse> {
    const where = inArray(orgs.registrationStatus, [
      'submitted',
      'tin_verified',
      'field_verified',
      'approved',
    ]);

    const rows = await this.db
      .select({
        orgId: orgs.id,
        legalName: orgs.legalName,
        districtName: districts.name,
        domain: orgs.domain,
        registrationStatus: orgs.registrationStatus,
        /*
         * `submittedAt` is the newest move INTO `submitted` (ADR-053, AC-R7).
         *
         * This comment used to say the value was derived from the earliest
         * review decision because nothing recorded a submission, and to replace
         * it the day the pipeline wrote a real timestamp. `org_registration_events`
         * is that day. The old derivation stays only as the fallback for a
         * business that was submitted before the event log existed, where it is
         * still the closest true bound the database holds.
         *
         * Every subquery here sits in the select list of a query WITH JOINS, which
         * is what makes Drizzle qualify the column names. In a join free query the
         * same template would silently compare a table to itself; see
         * `platform/property/infrastructure/inventory.repository.ts`.
         */
        submittedAt: sql<Date | string | null>`coalesce(
          (select max(${orgRegistrationEvents.occurredAt})
             from ${orgRegistrationEvents}
            where ${orgRegistrationEvents.orgId} = ${orgs.id}
              and ${orgRegistrationEvents.toStatus} = 'submitted'),
          (select min(${orgRegistrationReviews.decidedAt})
             from ${orgRegistrationReviews}
            where ${orgRegistrationReviews.orgId} = ${orgs.id}),
          ${orgs.createdAt}
        )`,
        /**
         * When it entered the stage it is in NOW. Null before the event log, and
         * deliberately NOT given the fallback above: a wait in a stage is exactly
         * the figure ADR-053 exists to make measurable, and an estimate shown as
         * a measurement would be the thing it was built to replace.
         */
        stageEnteredAt: sql<Date | string | null>`(
          select max(${orgRegistrationEvents.occurredAt})
            from ${orgRegistrationEvents}
           where ${orgRegistrationEvents.orgId} = ${orgs.id}
             and ${orgRegistrationEvents.toStatus} = ${orgs.registrationStatus}
        )`,
        /**
         * Every automatic RRA retry used, and still no answer (AC-R5). Read
         * through `pendingTinAttemptsSql`, the same definition the sweep uses to
         * decide what to retry, so the two can never disagree about a business.
         */
        stalled: sql<boolean>`exists (
          select 1
            from (${pendingTinAttemptsSql()}) as pending
           where pending.org_id = ${orgs.id}
             and pending.attempts >= ${TIN_RECHECK_CEILING}
        )`,
        /**
         * `tin_verifications` is the RRA outcome and the only place it lands —
         * `org_registration_reviews_stage_shape` keeps the two HUMAN gates out
         * of that table, so this cannot accidentally count an officer's pass.
         */
        tinVerified: sql<boolean>`exists (
          select 1 from ${tinVerifications}
           where ${tinVerifications.orgId} = ${orgs.id}
             and ${tinVerifications.result} = 'verified'
        )`,
        /**
         * Can an officer take this business's CURRENT stage? (ADR-053, AC-G9)
         *
         * `tin_verified` waits on a field verifier and `field_verified` on an
         * approver; each is covered when a live assignment for that function
         * reaches the business's district, where a country grant reaches every
         * district and a province grant its own districts, the rule
         * `districtScopeOf` states in `@injishi/contracts`. `submitted` waits on
         * RRA and `approved` on the owner's claim, so neither is owed an officer.
         *
         * Computed here at read time rather than by a sweep, so a revoke is
         * reflected on the next read with no job to run. This query joins
         * `districts`, which is what lets the template name its province.
         */
        coverage: sql<ReviewCoverage>`case
          when ${orgs.registrationStatus} in ('tin_verified', 'field_verified') then
            case when exists (
              select 1 from ${oversightAssignments} oa
               where oa.revoked_at is null
                 and oa.oversight_role = (case when ${orgs.registrationStatus} = 'tin_verified'
                                               then 'business_field_verifier'
                                               else 'business_approver' end)::oversight_role
                 and (oa.scope_level = 'country'
                      or (oa.scope_level = 'province' and oa.province_id = ${districts.provinceId})
                      or (oa.scope_level = 'district' and oa.district_id = ${orgs.districtId}))
            ) then 'covered' else 'uncovered' end
          else 'not_applicable'
        end`,
      })
      .from(orgs)
      .leftJoin(districts, eq(districts.id, orgs.districtId))
      .where(where)
      // Oldest first. A review queue is worked from the front, and sorting it
      // newest-first would starve the business that has waited longest.
      .orderBy(orgs.createdAt)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [counted] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(orgs)
      .where(where);

    // The newest decision per org, fetched for the page rather than as four
    // correlated subqueries: `lastDecision` is four fields off ONE row, and
    // per-field subqueries could straddle two different rows the moment two
    // decisions share a timestamp.
    const orgIds = rows.map((r) => r.orgId);
    const decisions = orgIds.length
      ? await this.db
          .select({
            orgId: orgRegistrationReviews.orgId,
            decision: orgRegistrationReviews.decision,
            reasonCode: orgRegistrationReviews.reasonCode,
            decidedAt: orgRegistrationReviews.decidedAt,
            oversightRole: orgRegistrationReviews.oversightRole,
          })
          .from(orgRegistrationReviews)
          .where(inArray(orgRegistrationReviews.orgId, orgIds))
          .orderBy(desc(orgRegistrationReviews.decidedAt))
      : [];

    const newest = new Map<string, (typeof decisions)[number]>();
    for (const d of decisions) if (!newest.has(d.orgId)) newest.set(d.orgId, d);

    return AdminOrgReviewQueueResponse.parse({
      items: rows.map((r) => {
        const last = newest.get(r.orgId);
        return {
          orgId: r.orgId,
          legalName: r.legalName,
          districtName: r.districtName,
          domain: r.domain,
          registrationStatus: r.registrationStatus,
          submittedAt: r.submittedAt ? iso(new Date(r.submittedAt)) : null,
          stageEnteredAt: r.stageEnteredAt
            ? iso(new Date(r.stageEnteredAt))
            : null,
          stalled: Boolean(r.stalled),
          coverage: r.coverage,
          lastDecision: last
            ? {
                decision: last.decision,
                reasonCode: last.reasonCode,
                decidedAt: iso(last.decidedAt),
                oversightRole: last.oversightRole,
              }
            : null,
          tinVerified: r.tinVerified,
        };
      }),
      meta: { total: counted?.n ?? 0, page, pageSize },
    });
  }

  // -------------------------------------------------------------------------
  // GET /admin/orgs/obo   (PII: reason required)
  // -------------------------------------------------------------------------

  /**
   * The on-behalf-of register: businesses somebody registered FOR their owner.
   *
   * `obo_registrations.intended_owner_national_id` is on the table and is not
   * selected. Not masked — not read at all, because a column that never leaves
   * the database cannot leak from a log, a cache or a screenshot, and nothing
   * on this screen needs it. `AdminOboRow` has no field for it either, so this
   * is the contract and the query agreeing rather than the query being careful.
   */
  async listObo(
    actorUserId: string,
    reason: string,
    page: number,
    pageSize: number,
  ): Promise<AdminOboListResponse> {
    // Written BEFORE the read. An access log written after a successful answer
    // records only the reads that worked, which is the wrong half.
    await this.logAccess(actorUserId, reason, null, null);

    const rows = await this.db
      .select({
        id: oboRegistrations.id,
        orgId: oboRegistrations.orgId,
        orgName: orgs.legalName,
        districtName: districts.name,
        registrantUserId: oboRegistrations.registrantUserId,
        registrantName: users.name,
        intendedOwnerName: oboRegistrations.intendedOwnerName,
        intendedOwnerEmail: oboRegistrations.intendedOwnerEmail,
        claimStatus: oboRegistrations.claimStatus,
        payoutLocked: oboRegistrations.payoutLocked,
        claimedAt: oboRegistrations.claimedAt,
      })
      .from(oboRegistrations)
      .innerJoin(orgs, eq(orgs.id, oboRegistrations.orgId))
      .leftJoin(districts, eq(districts.id, orgs.districtId))
      .leftJoin(users, eq(users.id, oboRegistrations.registrantUserId))
      .orderBy(desc(oboRegistrations.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [counted] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(oboRegistrations);

    return AdminOboListResponse.parse({
      items: rows.map((r) => ({
        id: r.id,
        orgId: r.orgId,
        orgName: r.orgName,
        districtName: r.districtName,
        registrantUserId: r.registrantUserId,
        registrantName: r.registrantName,
        intendedOwnerName: r.intendedOwnerName,
        intendedOwnerEmail: r.intendedOwnerEmail,
        claimStatus: r.claimStatus,
        payoutLocked: r.payoutLocked,
        claimedAt: r.claimedAt ? iso(r.claimedAt) : null,
      })),
      meta: { total: counted?.n ?? 0, page, pageSize },
    });
  }

  // -------------------------------------------------------------------------
  // GET /admin/orgs/:orgId
  // -------------------------------------------------------------------------

  /**
   * One business in full.
   *
   * This is the one route in the section that may 404, and the difference is
   * not a slip: an empty LIST is a true statement about the platform, while an
   * org id naming no row is a wrong question. Answering it with a hollow object
   * would put a business on screen that does not exist.
   */
  async orgDetail(orgId: string): Promise<AdminOrgDetail> {
    const [row] = await this.db
      .select({
        ...orgRowColumns,
        addressText: orgs.addressText,
        sectorId: orgs.sectorId,
        villageId: orgs.villageId,
        // Every stage, `pending_payment` and `suspended` included (AC-R7). The
        // query has joins, so this subquery's column names are qualified.
        stageEnteredAt: sql<Date | string | null>`(
          select max(${orgRegistrationEvents.occurredAt})
            from ${orgRegistrationEvents}
           where ${orgRegistrationEvents.orgId} = ${orgs.id}
             and ${orgRegistrationEvents.toStatus} = ${orgs.registrationStatus}
        )`,
      })
      .from(orgs)
      .leftJoin(districts, eq(districts.id, orgs.districtId))
      .leftJoin(subscriptions, eq(subscriptions.orgId, orgs.id))
      .leftJoin(
        subscriptionPlans,
        eq(subscriptionPlans.id, subscriptions.planId),
      )
      .where(eq(orgs.id, orgId))
      .limit(1);

    if (!row) throw new NotFoundException('No such business.');

    // Three counts the list row does not pay for. Separate statements rather
    // than three correlated subqueries: each is an index seek on one column,
    // and the version that reads as three sentences is the one that stays right
    // when a fourth count is added.
    const [members] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(orgMemberships)
      .where(eq(orgMemberships.orgId, orgId));
    const [props] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(properties)
      .where(eq(properties.orgId, orgId));
    const [certs] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(orgCertificates)
      .where(eq(orgCertificates.orgId, orgId));

    return AdminOrgDetail.parse({
      ...toOrgRow(row),
      stageEnteredAt: row.stageEnteredAt
        ? iso(new Date(row.stageEnteredAt))
        : null,
      addressText: row.addressText,
      sectorId: row.sectorId,
      villageId: row.villageId,
      memberCount: members?.n ?? 0,
      propertyCount: props?.n ?? 0,
      certificateCount: certs?.n ?? 0,
      psf: row.domain === 'hospitality' ? await this.psf.adminView(orgId) : null,
    });
  }

  // -------------------------------------------------------------------------
  // GET /admin/orgs/:orgId/people   (PII: reason required)
  // -------------------------------------------------------------------------

  /**
   * Everyone inside one business, removed members included.
   *
   * A removed member is still listed, because the question staff ask on this
   * screen is "who had access to this business", and a row that vanishes on
   * removal cannot answer it. `status` crosses as the `org_membership_status`
   * enum the column has carried since ADR-053 (AC-R10); `AdminOrgMember.status`
   * promises the same two values the database enforces.
   */
  async orgPeople(
    orgId: string,
    actorUserId: string,
    reason: string,
    page: number,
    pageSize: number,
  ): Promise<AdminOrgPeopleResponse> {
    await this.logAccess(actorUserId, reason, null, orgId);

    const rows = await this.db
      .select({
        userId: orgMemberships.userId,
        name: users.name,
        email: users.email,
        orgRole: orgMemberships.orgRole,
        status: orgMemberships.status,
        joinedAt: orgMemberships.createdAt,
        removedAt: orgMemberships.removedAt,
      })
      .from(orgMemberships)
      .innerJoin(users, eq(users.id, orgMemberships.userId))
      .where(eq(orgMemberships.orgId, orgId))
      .orderBy(orgMemberships.createdAt)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [counted] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(orgMemberships)
      .where(eq(orgMemberships.orgId, orgId));

    return AdminOrgPeopleResponse.parse({
      items: rows.map((r) => ({
        userId: r.userId,
        name: r.name,
        email: r.email,
        orgRole: r.orgRole,
        status: r.status,
        joinedAt: iso(r.joinedAt),
        removedAt: r.removedAt ? iso(r.removedAt) : null,
      })),
      meta: { total: counted?.n ?? 0, page, pageSize },
    });
  }

  // -------------------------------------------------------------------------
  // GET /admin/orgs/:orgId/properties
  // -------------------------------------------------------------------------

  async orgProperties(
    orgId: string,
    page: number,
    pageSize: number,
  ): Promise<AdminOrgPropertiesResponse> {
    const rows = await this.db
      .select({
        id: properties.id,
        name: properties.name,
        // `properties` has NO domain column. The owning org's branch is what
        // decides whether a property is a hotel or a rental building, so the
        // fact is read from `orgs` — which is also why this join is inner: a
        // property with no org has no domain, and there is no such row.
        domain: orgs.domain,
        districtName: districts.name,
        roomTypeCount: sql<number>`(
          select count(*) from ${roomTypes}
           where ${roomTypes.propertyId} = ${properties.id}
        )::int`,
        roomCount: sql<number>`(
          select count(*) from ${rooms}
           where ${rooms.propertyId} = ${properties.id}
        )::int`,
        listingCount: sql<number>`(
          select count(*) from ${listings}
           where ${listings.propertyId} = ${properties.id}
        )::int`,
        // `listings_property_uk` makes this at most one listing per property,
        // so "published" is a property of that single row rather than of a set.
        // It is what makes the property visible to the public marketplace.
        published: sql<boolean>`exists (
          select 1 from ${listings}
           where ${listings.propertyId} = ${properties.id}
             and ${listings.status} = 'published'
        )`,
        // ADR-054 AC-R4: which branch is the head office, and which are retired.
        isHeadOffice: properties.isHeadOffice,
        rraBranchId: properties.rraBranchId,
        archivedAt: properties.archivedAt,
      })
      .from(properties)
      .innerJoin(orgs, eq(orgs.id, properties.orgId))
      .leftJoin(districts, eq(districts.id, properties.districtId))
      .where(eq(properties.orgId, orgId))
      // Head office first, then by name, the order every branch list uses.
      .orderBy(desc(properties.isHeadOffice), properties.name)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [counted] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(properties)
      .where(eq(properties.orgId, orgId));

    return AdminOrgPropertiesResponse.parse({
      items: rows.map((r) => ({
        ...r,
        archivedAt: r.archivedAt?.toISOString() ?? null,
      })),
      meta: { total: counted?.n ?? 0, page, pageSize },
    });
  }

  // -------------------------------------------------------------------------
  // GET /admin/orgs/:orgId/subscription
  // -------------------------------------------------------------------------

  async orgSubscription(orgId: string): Promise<AdminOrgSubscription> {
    const [sub] = await this.db
      .select({
        id: subscriptions.id,
        planName: subscriptionPlans.name,
        status: subscriptions.status,
        currentPeriodStart: subscriptions.currentPeriodStart,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        canceledAt: subscriptions.canceledAt,
      })
      .from(subscriptions)
      .leftJoin(
        subscriptionPlans,
        eq(subscriptionPlans.id, subscriptions.planId),
      )
      .where(eq(subscriptions.orgId, orgId))
      .limit(1);

    // Every invoice, not only the subscription ones: an org still in the
    // pipeline holds a registration fee and no subscription at all, and a
    // screen showing nothing for it would look broken rather than early.
    const invoices = await this.invoicesFor(orgId);

    return AdminOrgSubscription.parse({
      subscription: sub
        ? {
            id: sub.id,
            planName: sub.planName,
            status: sub.status,
            // `date` columns arrive as 'YYYY-MM-DD' and stay that way: a
            // billing period is a calendar fact, and turning it into an instant
            // moves it across a timezone on the way to the browser.
            currentPeriodStart: sub.currentPeriodStart,
            currentPeriodEnd: sub.currentPeriodEnd,
            canceledAt: sub.canceledAt ? iso(sub.canceledAt) : null,
          }
        : null,
      invoices,
    });
  }

  // -------------------------------------------------------------------------
  // GET /admin/orgs/:orgId/money
  // -------------------------------------------------------------------------

  async orgMoney(orgId: string): Promise<AdminOrgMoney> {
    const invoices = await this.invoicesFor(orgId);
    // Lifted out by kind rather than by position: it is the one charge that
    // happens once per org ever, and `subscription_invoices_registration_fee_uk`
    // is a partial unique index that makes "at most one" true by construction.
    const registrationFee =
      invoices.find((i) => i.invoiceKind === 'registration_fee') ?? null;

    // Money is booked against a WORKSPACE, not an org: `payouts.workspace_id`
    // and `ledger_entries.workspace_id` are the columns that exist. An org can
    // hold more than one workspace, so this resolves the set rather than
    // assuming a single row and quietly dropping the rest of the money.
    const spaces = await this.db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.orgId, orgId));
    const workspaceIds = spaces.map((w) => w.id);

    if (workspaceIds.length === 0) {
      // A business with no workspace has no payouts and no ledger, which is a
      // true answer and not a missing one. Returning here rather than issuing
      // two `IN ()` queries that can only match nothing.
      return AdminOrgMoney.parse({
        registrationFee,
        invoices,
        payouts: [],
        ledger: [],
      });
    }

    const payoutRows = await this.db
      .select({
        id: payouts.id,
        workspaceId: payouts.workspaceId,
        amountRwf: payouts.amountRwf,
        currency: payouts.currency,
        status: payouts.status,
        createdAt: payouts.createdAt,
        settledAt: payouts.settledAt,
        failureReason: payouts.failureReason,
      })
      .from(payouts)
      .where(inArray(payouts.workspaceId, workspaceIds))
      .orderBy(desc(payouts.createdAt));

    const ledgerRows = await this.db
      .select({
        id: ledgerEntries.id,
        transactionId: ledgerEntries.transactionId,
        kind: ledgerTransactions.kind,
        adapterMode: ledgerTransactions.adapterMode,
        memo: ledgerTransactions.memo,
        // The human-facing code from `ledger_accounts`, not the account uuid:
        // the code is what a finance staffer actually reconciles against.
        accountCode: ledgerAccounts.code,
        amountRwf: ledgerEntries.amountRwf,
        currency: ledgerEntries.currency,
        occurredAt: ledgerTransactions.occurredAt,
      })
      .from(ledgerEntries)
      .innerJoin(
        ledgerTransactions,
        eq(ledgerTransactions.id, ledgerEntries.transactionId),
      )
      .innerJoin(ledgerAccounts, eq(ledgerAccounts.id, ledgerEntries.accountId))
      .where(inArray(ledgerEntries.workspaceId, workspaceIds))
      .orderBy(desc(ledgerTransactions.occurredAt));

    return AdminOrgMoney.parse({
      registrationFee,
      invoices,
      payouts: payoutRows.map((p) => ({
        id: p.id,
        workspaceId: p.workspaceId,
        amountRwf: rwf(p.amountRwf),
        currency: p.currency,
        status: p.status,
        /*
         * Read from the two columns migration 0029 added, exactly as
         * `finance.service.ts` reads them, so the business record and the
         * finance screen cannot give one payout two different settlement
         * dates. `scheduled_release_at` is still NOT a substitute for either:
         * it says when a payout MAY leave, so reading it as a settlement would
         * show a held payout as paid. Null until something records them — and
         * nothing in this API writes payouts yet.
         */
        failureReason: p.failureReason,
        settledAt: p.settledAt ? iso(p.settledAt) : null,
        createdAt: iso(p.createdAt),
      })),
      ledger: ledgerRows.map((e) => ({
        id: e.id,
        transactionId: e.transactionId,
        kind: e.kind,
        adapterMode: e.adapterMode,
        memo: e.memo,
        accountCode: e.accountCode,
        // Derived from the sign, which is where double entry keeps it, and then
        // the amount crosses unsigned. A signed amount BESIDE a direction is
        // two answers to one question, and the two drift the first time
        // something writes a negative credit.
        direction: e.amountRwf < 0 ? 'credit' : 'debit',
        amountRwf: Math.abs(e.amountRwf),
        currency: e.currency,
        occurredAt: iso(e.occurredAt),
      })),
    });
  }

  // -------------------------------------------------------------------------
  // GET /admin/orgs/:orgId/timeline
  // -------------------------------------------------------------------------

  async orgTimeline(
    orgId: string,
    page: number,
    pageSize: number,
  ): Promise<AdminOrgTimelineResponse> {
    const where = and(
      eq(auditEvents.subjectType, 'org'),
      eq(auditEvents.subjectId, orgId),
    );

    const rows = await this.db
      .select(timelineColumns)
      .from(auditEvents)
      // Left, not inner: `actor_user_id` is nullable because the platform
      // itself acts. An expiry sweep has no actor, and an inner join would drop
      // exactly the events nobody was watching.
      .leftJoin(users, eq(users.id, auditEvents.actorUserId))
      .where(where)
      .orderBy(desc(auditEvents.occurredAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [counted] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(auditEvents)
      .where(where);

    return AdminOrgTimelineResponse.parse({
      items: rows.map(toTimelineEvent),
      meta: { total: counted?.n ?? 0, page, pageSize },
    });
  }

  // -------------------------------------------------------------------------
  // GET /admin/orgs/:orgId/obo-audit
  // -------------------------------------------------------------------------

  /**
   * Both trails for one on-behalf-of registration, unpaged on purpose: the
   * question is "show me everything that happened here", and an answer split
   * across two independent paginations cannot be read as one story. An OBO
   * registration's history is bounded, which is what makes that affordable.
   *
   * The subjects are the org AND its `obo_registrations` rows, because
   * `audit_subject_type` has no `obo` value — a module writing about the claim
   * names either the org or the registration id, and asking for only one of
   * them would quietly drop half the history.
   */
  async oboAudit(orgId: string): Promise<AdminOboAuditResponse> {
    const oboRows = await this.db
      .select({ id: oboRegistrations.id })
      .from(oboRegistrations)
      .where(eq(oboRegistrations.orgId, orgId));

    const subjectIds = [orgId, ...oboRows.map((o) => o.id)];

    const events = await this.db
      .select(timelineColumns)
      .from(auditEvents)
      .leftJoin(users, eq(users.id, auditEvents.actorUserId))
      .where(inArray(auditEvents.subjectId, subjectIds))
      .orderBy(desc(auditEvents.occurredAt));

    const accessLogs = await this.db
      .select({
        id: recordAccessLogs.id,
        actorUserId: recordAccessLogs.actorUserId,
        actorName: users.name,
        subjectUserId: recordAccessLogs.subjectUserId,
        subjectRef: recordAccessLogs.subjectRef,
        dataClass: recordAccessLogs.dataClass,
        reason: recordAccessLogs.reason,
        occurredAt: recordAccessLogs.occurredAt,
      })
      .from(recordAccessLogs)
      .leftJoin(users, eq(users.id, recordAccessLogs.actorUserId))
      .where(inArray(recordAccessLogs.subjectRef, subjectIds))
      .orderBy(desc(recordAccessLogs.occurredAt));

    return AdminOboAuditResponse.parse({
      events: events.map(toTimelineEvent),
      accessLogs: accessLogs.map((l) => ({
        id: l.id,
        actorUserId: l.actorUserId,
        actorName: l.actorName,
        subjectUserId: l.subjectUserId,
        subjectRef: l.subjectRef,
        dataClass: l.dataClass,
        reason: l.reason,
        occurredAt: iso(l.occurredAt),
      })),
    });
  }

  // -------------------------------------------------------------------------
  // Shared readers
  // -------------------------------------------------------------------------

  /**
   * The org's whole invoice ledger. `subscription_invoices` is misnamed: its
   * `invoice_kind` discriminator carries the one-time registration fee too,
   * which is why both money routes read the same rows through one method rather
   * than each writing its own WHERE and disagreeing about what counts.
   */
  private async invoicesFor(orgId: string): Promise<AdminInvoice[]> {
    const rows = await this.db
      .select({
        id: subscriptionInvoices.id,
        invoiceKind: subscriptionInvoices.invoiceKind,
        amountRwf: subscriptionInvoices.amountRwf,
        currency: subscriptionInvoices.currency,
        status: subscriptionInvoices.status,
        periodStart: subscriptionInvoices.periodStart,
        periodEnd: subscriptionInvoices.periodEnd,
        createdAt: subscriptionInvoices.createdAt,
      })
      .from(subscriptionInvoices)
      .where(eq(subscriptionInvoices.orgId, orgId))
      .orderBy(desc(subscriptionInvoices.createdAt));

    return rows.map((r) => ({
      id: r.id,
      invoiceKind: r.invoiceKind,
      amountRwf: rwf(r.amountRwf),
      currency: r.currency,
      status: r.status,
      // Null on exactly the registration-fee rows, which
      // `subscription_invoices_kind_shape` enforces — it covers no period.
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      createdAt: iso(r.createdAt),
    }));
  }

  /**
   * Record that a staff member read somebody else's data, and why.
   *
   * `subjectRef` is the org for a per-business read and null for the OBO
   * register, where the subject is the register itself rather than one row.
   * Writing 25 subject rows for one page view would bury the reads that matter
   * under the reads that are only paging.
   */
  private async logAccess(
    actorUserId: string,
    reason: string,
    subjectUserId: string | null,
    subjectRef: string | null,
  ): Promise<void> {
    await this.db.insert(recordAccessLogs).values({
      actorUserId,
      subjectUserId,
      subjectRef,
      // Names and email addresses, which is what both PII routes here return.
      // Not `national_id`: no route in this section reads one, masked or
      // otherwise, so claiming that class would overstate what was disclosed.
      dataClass: 'contact',
      reason,
    });
  }
}

/**
 * The columns behind `AdminOrgRow`, shared by the list and the detail so the
 * two cannot drift into describing the same business differently.
 */
const orgRowColumns = {
  id: orgs.id,
  legalName: orgs.legalName,
  domain: orgs.domain,
  rdbEntityGroup: orgs.rdbEntityGroup,
  accommodationClass: orgs.accommodationClass,
  residenceClass: orgs.residenceClass,
  tourismLicenseNumber: orgs.tourismLicenseNumber,
  chamberOfTourismMember: orgs.chamberOfTourismMember,
  psfMember: orgs.psfMember,
  eacStarGrade: orgs.eacStarGrade,
  tin: orgs.tin,
  upi: orgs.upi,
  registrationStatus: orgs.registrationStatus,
  districtId: orgs.districtId,
  districtName: districts.name,
  // Derived, not stored: an OBO registration is held by someone who is not the
  // owner, and that changes how staff read every other field beside it. EXISTS
  // rather than a join, so a second `obo_registrations` row for one org could
  // not duplicate the business on the page.
  isObo: sql<boolean>`exists (
    select 1 from ${oboRegistrations}
     where ${oboRegistrations.orgId} = ${orgs.id}
  )`,
  subscriptionStatus: subscriptions.status,
  subscriptionPlanName: subscriptionPlans.name,
  createdAt: orgs.createdAt,
};

/** `createdAt` is the only column needing a conversion; the rest cross as read. */
function toOrgRow<T extends { createdAt: Date }>(
  row: T,
): Omit<T, 'createdAt'> & { createdAt: string } {
  return { ...row, createdAt: iso(row.createdAt) };
}

/**
 * The columns behind `AdminTimelineEvent`, shared by the org timeline and the
 * OBO audit. `payload_diff` and `prev_hash` are on the table and are not here:
 * a timeline says what happened, and a diff of the row is a different screen.
 */
const timelineColumns = {
  id: auditEvents.id,
  eventType: auditEvents.eventType,
  subjectType: auditEvents.subjectType,
  actorUserId: auditEvents.actorUserId,
  actorName: users.name,
  reason: auditEvents.reason,
  occurredAt: auditEvents.occurredAt,
};

function toTimelineEvent<T extends { occurredAt: Date }>(
  row: T,
): Omit<T, 'occurredAt'> & { occurredAt: string } {
  return { ...row, occurredAt: iso(row.occurredAt) };
}
