import {
  PSF_QUEUE_REGISTRATION_STATES,
  PSF_RENEWAL_WINDOW_DAYS,
  type Domain,
  type EnterpriseRegistrationKind,
  type OrgRegistrationStatus,
  type OrgRole,
  type PsfBranchStatus,
  type PsfDeclineReason,
  type PsfMembershipFamily,
  type PsfOwnerGroup,
  type PsfStanding,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, lt, or, sql, type SQL } from 'drizzle-orm';
import { alias, type AnyPgColumn } from 'drizzle-orm/pg-core';

import {
  districts,
  identityDocuments,
  oboRegistrations,
  orgMemberships,
  orgs,
  oversightAssignments,
  provinces,
  psfApplicationBranches,
  psfAssociations,
  psfClusters,
  psfMembershipApplications,
  psfMembershipFormFields,
  psfMemberList,
  psfMembershipClaims,
  psfMembershipRenewals,
  psfMembershipTiers,
  psfMemberships,
  psfSubsectorAssociations,
  psfSubsectors,
  psfTierFees,
  sectors,
  subscriptionInvoices,
  userProfiles,
  users,
  verifiedIdentities,
  workspaces,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import type { Tx } from '../../platform/property/infrastructure/insert-property';
import { AuditWriter } from '../../../shared/audit/audit-writer';

/**
 * PSF membership (ADR-056, widened by the PSF path): the tier catalogue, the
 * sector catalogue, the application as filed, and the live membership. One
 * repository for these tables, because every write that touches two of them
 * has to happen in one transaction.
 */

export type NewPsfApplication = typeof psfMembershipApplications.$inferInsert;
export type PsfApplicationRow = typeof psfMembershipApplications.$inferSelect;
export type PsfTierRow = typeof psfMembershipTiers.$inferSelect;
export type PsfMembershipRow = typeof psfMemberships.$inferSelect;
export type PsfClusterRow = typeof psfClusters.$inferSelect;
export type PsfAssociationRow = typeof psfAssociations.$inferSelect;
export type PsfClaimRow = typeof psfMembershipClaims.$inferSelect;
type PsfMemberListRow = typeof psfMemberList.$inferSelect;

/** A claim in an officer's list, with what PSF's own list says about the number. */
export interface PsfClaimListRow
  extends Pick<PsfClaimRow, 'id' | 'orgId' | 'membershipNumber' | 'status' | 'claimedAt' | 'decidedAt' | 'decisionNote' | 'matchedBy'> {
  legalName: string;
  businessCode: string | null;
  tin: string | null;
  districtId: number | null;
  districtName: string | null;
  claimedByName: string | null;
  decidedByName: string | null;
  listedName: string | null;
  listedTin: string | null;
  listedTier: string | null;
  listedExpires: string | null;
  listedNumber: string | null;
}

/** One claim with its business's district, for the scope check. */
export type PsfClaimInScope = Pick<PsfClaimRow, 'id' | 'orgId' | 'membershipNumber' | 'status'> & { districtId: number | null };

/** An open claim PSF's list confirms, with the list's tier and dates. */
export type PsfListedClaim = Pick<PsfMemberListRow, 'tierCode' | 'startsOn' | 'expiresOn' | 'uploadedByUserId'> & {
  claimId: string;
  orgId: string;
  membershipNumber: string;
};

/**
 * The districts an officer may see: null for the whole country, else the ids
 * (`districtScopeOf` in `@injishi/contracts`). An empty list sees nothing.
 */
export type PsfScope = readonly number[] | null;

/** One branch as the officer reads it, with its place in words. */
export interface PsfBranchRow {
  id: string;
  applicationId: string;
  districtId: number;
  districtName: string | null;
  sectorName: string | null;
  street: string;
  status: PsfBranchStatus;
  decisionNote: string | null;
  decidedAt: Date | null;
}

/** A branch to file with a public application (2026-10-23). */
export interface NewPsfBranch {
  districtId: number;
  sectorId: number;
  street: string;
}

/** Files the branches of a just-created application, inside its transaction. */
export async function insertPsfBranches(
  tx: Tx | Database,
  applicationId: string,
  orgId: string,
  branches: readonly NewPsfBranch[],
): Promise<void> {
  if (branches.length === 0) return;
  await tx.insert(psfApplicationBranches).values(
    branches.map((b) => ({
      applicationId,
      orgId,
      districtId: b.districtId,
      sectorId: b.sectorId,
      street: b.street,
    })),
  );
}

/** A second open application for the same business (AC-16). */
export class OpenPsfApplicationExists extends Error {
  constructor() {
    super('This business already has an open PSF application.');
  }
}

function isOpenApplicationClash(err: unknown): boolean {
  const candidates = [err, (err as { cause?: unknown })?.cause];
  return candidates.some(
    (e) =>
      typeof e === 'object' &&
      e !== null &&
      (e as { code?: string }).code === '23505' &&
      (e as { constraint?: string }).constraint ===
        'psf_membership_applications_one_open_uk',
  );
}

/**
 * THE one insert for an application, whichever door it came through: the
 * registration create transaction (ADR-056 build step 8) and the workspace
 * (step 4) both write through here, so a filed form has one shape.
 */
export async function insertPsfApplication(
  tx: Tx | Database,
  row: NewPsfApplication,
): Promise<{ id: string }> {
  try {
    const [created] = await tx
      .insert(psfMembershipApplications)
      .values(row)
      .returning({ id: psfMembershipApplications.id });
    if (!created) throw new Error('PSF application insert returned no row.');
    return created;
  } catch (error) {
    if (isOpenApplicationClash(error)) throw new OpenPsfApplicationExists();
    throw error;
  }
}

/** A self declared membership, written with a Yes and a number (AC-7). */
/**
 * A membership number typed at registration (0121, 2026-10-30): a CLAIM, never a membership, until PSF
 * confirms it. When PSF's own list holds the number with this business's TIN, and gives a tier and dates,
 * it is confirmed here, in the registration's transaction, as a `psf_record` membership. Anything else
 * waits for a PSF District Manager.
 */
export async function fileMembershipClaim(
  tx: Tx | Database,
  row: { orgId: string; membershipNumber: string | null; tin: string | null; claimedByUserId: string },
): Promise<{ confirmed: boolean }> {
  const [claim] = await tx
    .insert(psfMembershipClaims)
    .values({ orgId: row.orgId, membershipNumber: row.membershipNumber, claimedByUserId: row.claimedByUserId })
    .returning({ id: psfMembershipClaims.id });
  // A claim with no number (its card only, 0131) waits for an officer, who types the number from the card.
  if (!claim || !row.tin || !row.membershipNumber) return { confirmed: false };
  const [listed] = await tx
    .select()
    .from(psfMemberList)
    .where(eq(psfMemberList.membershipNumber, row.membershipNumber))
    .limit(1);
  if (!listed || listed.tin !== row.tin || !listed.tierCode || !listed.startsOn || !listed.expiresOn) {
    return { confirmed: false };
  }
  await confirmClaimRow(tx, {
    claimId: claim.id,
    orgId: row.orgId,
    membershipNumber: row.membershipNumber,
    tierCode: listed.tierCode,
    startsOn: listed.startsOn,
    expiresOn: listed.expiresOn,
    decidedByUserId: listed.uploadedByUserId,
    matchedBy: 'member_list',
    note: null,
  });
  return { confirmed: true };
}

/** Confirm one open claim: write its `psf_record` membership and close the claim on it. */
async function confirmClaimRow(
  tx: Tx | Database,
  c: {
    claimId: string;
    orgId: string;
    membershipNumber: string;
    tierCode: string;
    startsOn: string;
    expiresOn: string;
    decidedByUserId: string;
    matchedBy: 'member_list' | 'officer';
    note: string | null;
  },
): Promise<string> {
  // A business has one current membership: an older one ends as this one begins.
  await tx
    .update(psfMemberships)
    .set({ endedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(psfMemberships.orgId, c.orgId), isNull(psfMemberships.endedAt)));
  const [membership] = await tx
    .insert(psfMemberships)
    .values({
      orgId: c.orgId,
      source: 'psf_record',
      tierCode: c.tierCode,
      membershipNumber: c.membershipNumber,
      startsOn: c.startsOn,
      expiresOn: c.expiresOn,
      recordedByUserId: c.decidedByUserId,
    })
    .returning({ id: psfMemberships.id });
  await tx
    .update(psfMembershipClaims)
    .set({
      status: 'confirmed',
      decidedByUserId: c.decidedByUserId,
      decidedAt: new Date(),
      decisionNote: c.note,
      matchedBy: c.matchedBy,
      membershipId: membership?.id ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(psfMembershipClaims.id, c.claimId), eq(psfMembershipClaims.status, 'claimed')));
  return membership?.id ?? '';
}

/** What the applicant rule, the prefill and PSF's view read about a business. */
export interface PsfOrgFacts {
  id: string;
  domain: Domain;
  legalName: string;
  tin: string | null;
  addressText: string | null;
  accommodationClass: string | null;
  accommodationClassOther: string | null;
  registrationStatus: OrgRegistrationStatus;
  districtId: number | null;
  districtName: string | null;
  businessCode: string | null;
  registrationKind: EnterpriseRegistrationKind | null;
  registrationNumber: string | null;
  ownerGroups: PsfOwnerGroup[];
  associationName: string | null;
  clusterName: string | null;
  subsectorName: string | null;
  obo: {
    registrantUserId: string;
    claimStatus: 'registrant_held' | 'owner_claimed' | 'expired';
    intendedOwnerName: string;
    intendedOwnerNationalId: string | null;
    intendedOwnerEmail: string | null;
  } | null;
}

/** An application with the names its readers need beside it. */
export interface PsfApplicationWithNames extends PsfApplicationRow {
  requestedTierName: string;
  submittedByName: string | null;
}

/** One row of the officer's queue. */
export interface PsfQueueRow {
  applicationId: string;
  /** Null when it came through the public PSF form, with nobody signed in. */
  submittedByUserId: string | null;
  /** New, or a card holder joining the new module (0132). */
  intake: 'new' | 'card_holder';
  orgId: string;
  businessName: string;
  businessCode: string | null;
  domain: Domain;
  districtName: string | null;
  associationName: string | null;
  subsectorName: string | null;
  ownerGroups: PsfOwnerGroup[];
  requestedTierName: string;
  declaredFeeRwf: number | null;
  submittedAt: Date;
  queuedAt: Date | null;
  sortAt: Date;
  registrationStatus: OrgRegistrationStatus;
  officerHasStake: boolean;
  districtId: number | null;
  docId: string;
  clusterName: string | null;
  paidAmountRwf: number | null;
  /** Branches in the officer's region still waiting on PSF. */
  branchesPending: number;
}

/** The queue's filters, validated and resolved. */
export interface PsfQueueFilter {
  q?: string;
  cluster?: string;
  family?: string;
  group?: PsfOwnerGroup;
  sort: 'newest' | 'oldest' | 'amount';
}

/** An application as the officer reads it, with the business around it. */
export type PsfOfficerApplicationRow = PsfApplicationWithNames & {
  businessName: string;
  districtId: number | null;
  districtName: string | null;
  registrationStatus: OrgRegistrationStatus;
  officerHasStake: boolean;
  domain: Domain;
  businessCode: string | null;
  clusterName: string | null;
  associationName: string | null;
  subsectorName: string | null;
  ownerGroups: PsfOwnerGroup[];
  registrationKind: EnterpriseRegistrationKind | null;
};

/** One business on the officer's register. */
export interface PsfBusinessRegisterRow {
  orgId: string;
  businessCode: string | null;
  legalName: string;
  domain: Domain;
  districtId: number | null;
  districtName: string | null;
  sectorName: string | null;
  clusterCode: string | null;
  clusterName: string | null;
  subsectorName: string | null;
  associationName: string | null;
  associationAcronym: string | null;
  ownerGroups: PsfOwnerGroup[];
  registrationKind: EnterpriseRegistrationKind | null;
  hasTin: boolean;
  registeredAt: Date;
  standing: PsfStanding;
  tierName: string | null;
  membershipNumber: string | null;
  expiresOn: string | null;
  openApplicationId: string | null;
  /** Paid in through Injishi: membership fees, and any registration fee. */
  paidRwf: number;
  lastPaidAt: Date | null;
  /** Branches on its newest application (2026-10-23). */
  branchCount: number;
  paymentDue: {
    amountRwf: number | null;
    since: string;
    docId: string | null;
    contactName: string;
    phoneE164: string | null;
    email: string | null;
    lastRemindedAt: string | null;
  } | null;
}

/** The register's filters, already validated and resolved. */
export interface PsfRegisterFilter {
  q?: string;
  districtId?: number;
  clusterCode?: string;
  subsectorId?: string;
  associationCode?: string;
  tierCode?: string;
  standing?: PsfStanding;
  /** A current membership inside its renewal window (2026-11-02). */
  renewal?: 'due';
  /** An application sent and not paid (2026-11-02). */
  payment?: 'due';
  group?: PsfOwnerGroup;
  tin?: 'with' | 'without';
  kind?: 'enterprise' | 'hospitality';
  /** One business, for its own page. */
  orgId?: string;
}

const submitter = alias(users, 'psf_submitter');
const submitterIdentity = alias(verifiedIdentities, 'psf_submitter_identity');

/**
 * What to call a person: the rule `OrganizationRepository.displayNameFor`
 * applies, in SQL. The verified legal name first, because `users.name` is empty
 * for everyone who signed up with an emailed code, which left "sent on your
 * behalf by" with no name (ADR-056 AC-17) and the apply form with no name to
 * start from (AC-3, AC-16).
 */
function displayName(
  user: { name: AnyPgColumn },
  identity: { legalFullName: AnyPgColumn },
): SQL<string | null> {
  return sql<string | null>`coalesce(
    nullif(trim(${identity.legalFullName}), ''),
    nullif(trim(${user.name}), '')
  )`;
}

const submittedByName = displayName(submitter, submitterIdentity);

/** Open is `submitted` (with PSF) or `approved` (waiting on the payment). */
const OPEN_STATUS_SQL = inArray(psfMembershipApplications.status, ['submitted', 'approved']);

/** The business's subtype in words: the one it picked, or the one it typed. */
const SUBSECTOR_NAME = sql<string | null>`coalesce(${orgs.psfSubsectorOther}, ${psfSubsectors.nameEn})`;

/** A business's region, as a condition. Null scope is the whole country. */
function inScope(scope: PsfScope): SQL | undefined {
  if (scope === null) return undefined;
  if (scope.length === 0) return sql`false`;
  return inArray(orgs.districtId, [...scope]);
}

/** The application on the outer row, named in full, for the same reason as `ORG_ID`. */
const APPLICATION_ID = sql.raw('"psf_membership_applications"."id"');

/**
 * The branches of the outer row's application inside a region (2026-10-23),
 * as a condition on the branch alias `b`. Null scope is the whole country.
 */
function branchPlace(scope: PsfScope): SQL {
  if (scope === null) return sql``;
  if (scope.length === 0) return sql` AND false`;
  return sql` AND b.district_id IN (${sql.join(
    scope.map((d) => sql`${d}`),
    sql`, `,
  )})`;
}

/** The application has a branch in the region; `pending` narrows to the undecided ones. */
function branchInScope(scope: PsfScope, pendingOnly: boolean): SQL {
  return sql`EXISTS (SELECT 1 FROM ${psfApplicationBranches} b
                      WHERE b.application_id = ${APPLICATION_ID}${pendingOnly ? sql` AND b.status = 'pending'` : sql``}${branchPlace(scope)})`;
}

/** How many of the application's branches in the region still wait on PSF. */
function branchesPendingIn(scope: PsfScope): SQL<number> {
  return sql<number>`(SELECT count(*)::int FROM ${psfApplicationBranches} b
                       WHERE b.application_id = ${APPLICATION_ID} AND b.status = 'pending'${branchPlace(scope)})`;
}

/**
 * An application whose branch waits on an officer: the business is not
 * declined or withdrawn, so a branch can still be admitted after the head
 * office's decision, and paid past its registration fee.
 */
function branchWaitsOn(scope: PsfScope): SQL | undefined {
  return and(
    inArray(psfMembershipApplications.status, ['submitted', 'approved', 'member']),
    inArray(orgs.registrationStatus, [...PSF_QUEUE_REGISTRATION_STATES]),
    branchInScope(scope, true),
  );
}

/**
 * The businesses PSF's register lists: a PSF business or a hotel, past its
 * registration fee and not refused. A residence is never a PSF business.
 */
const ON_REGISTER_SQL = sql`${orgs.domain}::text IN ('enterprise', 'hospitality')
  AND ${orgs.registrationStatus} NOT IN ('pending_payment', 'rejected')`;

/**
 * The register, with the businesses still waiting for a payment (2026-11-02): read when the officer asks
 * for those, or opens one, so a business whose payment at submit did not go through can be reached.
 */
const ON_REGISTER_OR_UNPAID_SQL = sql`${orgs.domain}::text IN ('enterprise', 'hospitality')
  AND ${orgs.registrationStatus} <> 'rejected'`;

/** A search pattern without the dashes and spaces people type inside a code, for the code's compact form. */
function compactLike(like: string): string {
  return like.replace(/[\s-]/g, '');
}

/**
 * The business on the outer row, named in full. Inside a correlated subquery an
 * interpolated `${orgs.id}` is NOT safe: Drizzle leaves column names unqualified
 * when a query reads one table, and a bare "id" inside `FROM psf_memberships m`
 * binds to the membership's own id, so the subquery silently matches nothing.
 */
const ORG_ID = sql.raw('"orgs"."id"');

/**
 * Where a business stands with PSF, derived from its rows (`PsfStanding`).
 * One expression, read by the register's column, its filter and its counts, so
 * the three can never disagree.
 */
const STANDING_SQL = sql<PsfStanding>`(CASE
  WHEN EXISTS (SELECT 1 FROM ${psfMemberships} m
                WHERE m.org_id = ${ORG_ID} AND m.ended_at IS NULL) THEN 'member'
  WHEN EXISTS (SELECT 1 FROM ${psfMembershipApplications} a
                WHERE a.org_id = ${ORG_ID} AND a.status = 'approved') THEN 'awaiting_payment'
  WHEN EXISTS (SELECT 1 FROM ${psfMembershipApplications} a
                WHERE a.org_id = ${ORG_ID} AND a.status = 'submitted') THEN 'applied'
  WHEN EXISTS (SELECT 1 FROM ${psfMembershipClaims} c
                WHERE c.org_id = ${ORG_ID} AND c.status = 'claimed') THEN 'claimed'
  WHEN EXISTS (SELECT 1 FROM ${psfMemberships} m WHERE m.org_id = ${ORG_ID}) THEN 'lapsed'
  WHEN (SELECT a.status FROM ${psfMembershipApplications} a
         WHERE a.org_id = ${ORG_ID} AND a.status <> 'withdrawn'
         ORDER BY a.created_at DESC LIMIT 1) = 'declined' THEN 'declined'
  ELSE 'not_applied'
END)`;

/**
 * A current membership inside its renewal window: 60 days before its end date,
 * or past it and not yet ended by the sweep (2026-11-02).
 */
const RENEWAL_DUE_SQL = sql`EXISTS (SELECT 1 FROM ${psfMemberships} m
  WHERE m.org_id = ${ORG_ID} AND m.ended_at IS NULL
    AND m.expires_on <= ((now() AT TIME ZONE 'Africa/Kigali')::date + ${PSF_RENEWAL_WINDOW_DAYS}::int))`;

/**
 * An application sent and not paid (2026-11-02): the public form's payment at submit that did not go
 * through (the business still `pending_payment`), or an approval still to pay.
 */
const UNPAID_APPLICATION_WHERE = sql`a.org_id = "orgs"."id" AND a.paid_at IS NULL
  AND ((a.status = 'submitted' AND "orgs"."registration_status" = 'pending_payment') OR a.status = 'approved')`;
const PAYMENT_DUE_SQL = sql`EXISTS (SELECT 1 FROM ${psfMembershipApplications} a WHERE ${UNPAID_APPLICATION_WHERE})`;
/** That application's amount, docID and contact, and the last reminder sent: one JSON value per row. */
const PAYMENT_DUE_JSON = sql<{
  amountRwf: number | null;
  since: string;
  docId: string | null;
  contactName: string;
  phoneE164: string | null;
  email: string | null;
  lastRemindedAt: string | null;
} | null>`(SELECT json_build_object(
    'amountRwf', coalesce(a.approved_fee_rwf, a.declared_fee_rwf),
    'since', coalesce(a.decided_at, a.created_at),
    'docId', a.doc_id,
    'contactName', trim(a.first_name || ' ' || a.last_name),
    'phoneE164', coalesce(a.applicant_phone_e164, a.phone_e164),
    'email', coalesce(a.applicant_email, nullif(a.email, '')),
    'lastRemindedAt', (SELECT max(e.occurred_at) FROM audit_events e
                        WHERE e.subject_type = 'org' AND e.subject_id = "orgs"."id" AND e.event_type = 'psf.payment.reminded'))
  FROM ${psfMembershipApplications} a WHERE ${UNPAID_APPLICATION_WHERE}
  ORDER BY a.created_at DESC LIMIT 1)`;

/** The current membership, or the open application, of the business on this row. */
const CURRENT_MEMBERSHIP = sql`(SELECT m.id FROM ${psfMemberships} m
  WHERE m.org_id = ${ORG_ID} AND m.ended_at IS NULL LIMIT 1)`;
/**
 * What a business has paid through Injishi: every membership fee, and a
 * registration fee where one was paid (a hotel's, or a PSF business's from
 * before the fee was dropped, 2026-10-23); and when it last paid. Nothing is
 * refunded. Correlated on the register's own row.
 */
const PAID_RWF = sql<number>`(
  coalesce((SELECT sum(i.amount_rwf) FROM ${subscriptionInvoices} i
             WHERE i.org_id = ${ORG_ID} AND i.invoice_kind = 'registration_fee' AND i.status = 'paid'), 0)
  + coalesce((SELECT sum(a.paid_amount_rwf) FROM ${psfMembershipApplications} a WHERE a.org_id = ${ORG_ID} AND a.paid_at IS NOT NULL), 0)
  + coalesce((SELECT sum(r.amount_rwf) FROM ${psfMembershipRenewals} r WHERE r.org_id = ${ORG_ID} AND r.status = 'paid'), 0)
)::int`;
const LAST_PAID_AT = sql<Date | null>`greatest(
  (SELECT max(i.updated_at) FROM ${subscriptionInvoices} i
    WHERE i.org_id = ${ORG_ID} AND i.invoice_kind = 'registration_fee' AND i.status = 'paid'),
  (SELECT max(a.paid_at) FROM ${psfMembershipApplications} a WHERE a.org_id = ${ORG_ID}),
  (SELECT max(r.paid_at) FROM ${psfMembershipRenewals} r WHERE r.org_id = ${ORG_ID} AND r.status = 'paid')
)`;

/**
 * A business's branches are the ones its NEWEST application listed
 * (2026-10-23): a business that applies again lists where it trades now, and
 * an older application's list is history.
 */
const NEWEST_APPLICATION = sql`(SELECT a.id FROM ${psfMembershipApplications} a
  WHERE a.org_id = ${ORG_ID} ORDER BY a.created_at DESC LIMIT 1)`;

const BRANCH_COUNT = sql<number>`(SELECT count(*)::int FROM ${psfApplicationBranches} b
  WHERE b.application_id = ${NEWEST_APPLICATION})`;

/**
 * A business with a branch in the region (2026-10-23): a district manager
 * discovers it on their register even though its head office is elsewhere.
 */
function hasBranchIn(scope: PsfScope): SQL {
  return sql`EXISTS (SELECT 1 FROM ${psfApplicationBranches} b
                      WHERE b.application_id = ${NEWEST_APPLICATION}${branchPlace(scope)})`;
}

const OPEN_APPLICATION = sql`(SELECT a.id FROM ${psfMembershipApplications} a
  WHERE a.org_id = ${ORG_ID} AND a.status IN ('submitted', 'approved')
  ORDER BY a.created_at DESC LIMIT 1)`;

@Injectable()
export class PsfMembershipRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // ── Membership claims (0121) ───────────────────────────────────────────────────────────────────────

  /** The business holding this number as its current membership, if any. */
  async currentHolderOf(membershipNumber: string): Promise<string | null> {
    const [row] = await this.db
      .select({ orgId: psfMemberships.orgId })
      .from(psfMemberships)
      .where(and(eq(psfMemberships.membershipNumber, membershipNumber), isNull(psfMemberships.endedAt)))
      .limit(1);
    return row?.orgId ?? null;
  }

  /** Claims in a region, newest first, with what PSF's own list says about each number. */
  async claims(
    scope: PsfScope,
    status: PsfClaimRow['status'] | undefined,
  ): Promise<{ rows: PsfClaimListRow[]; counts: { status: PsfClaimRow['status']; n: number }[] }> {
    const claimer = alias(users, 'claimer');
    const decider = alias(users, 'decider');
    const rows = await this.db
      .select({
        id: psfMembershipClaims.id,
        orgId: psfMembershipClaims.orgId,
        legalName: orgs.legalName,
        businessCode: orgs.businessCode,
        tin: orgs.tin,
        districtId: orgs.districtId,
        districtName: districts.name,
        membershipNumber: psfMembershipClaims.membershipNumber,
        status: psfMembershipClaims.status,
        claimedAt: psfMembershipClaims.claimedAt,
        claimedByName: claimer.name,
        decidedAt: psfMembershipClaims.decidedAt,
        decidedByName: decider.name,
        decisionNote: psfMembershipClaims.decisionNote,
        matchedBy: psfMembershipClaims.matchedBy,
        listedName: psfMemberList.legalName,
        listedTin: psfMemberList.tin,
        listedTier: psfMemberList.tierCode,
        listedExpires: psfMemberList.expiresOn,
        listedNumber: psfMemberList.membershipNumber,
      })
      .from(psfMembershipClaims)
      .innerJoin(orgs, eq(orgs.id, psfMembershipClaims.orgId))
      .leftJoin(districts, eq(districts.id, orgs.districtId))
      .leftJoin(claimer, eq(claimer.id, psfMembershipClaims.claimedByUserId))
      .leftJoin(decider, eq(decider.id, psfMembershipClaims.decidedByUserId))
      .leftJoin(psfMemberList, eq(psfMemberList.membershipNumber, psfMembershipClaims.membershipNumber))
      .where(and(inScope(scope), status ? eq(psfMembershipClaims.status, status) : undefined))
      .orderBy(desc(psfMembershipClaims.claimedAt))
      .limit(500);
    const counts = await this.db
      .select({ status: psfMembershipClaims.status, n: sql<number>`count(*)::int` })
      .from(psfMembershipClaims)
      .innerJoin(orgs, eq(orgs.id, psfMembershipClaims.orgId))
      .where(inScope(scope))
      .groupBy(psfMembershipClaims.status);
    return { rows, counts };
  }

  /** One claim with its business's district, for the scope check before a decision. */
  async claim(id: string): Promise<PsfClaimInScope | null> {
    const [row] = await this.db
      .select({
        id: psfMembershipClaims.id,
        orgId: psfMembershipClaims.orgId,
        membershipNumber: psfMembershipClaims.membershipNumber,
        status: psfMembershipClaims.status,
        districtId: orgs.districtId,
      })
      .from(psfMembershipClaims)
      .innerJoin(orgs, eq(orgs.id, psfMembershipClaims.orgId))
      .where(eq(psfMembershipClaims.id, id))
      .limit(1);
    return row ?? null;
  }

  /**
   * What a member's certificate prints, from its current membership (2026-11-02): read for a member PSF
   * confirmed from its card as for one that applied. The docID is its member application's, when it has one.
   */
  async memberCertificateFacts(orgId: string): Promise<{
    legalName: string;
    businessCode: string | null;
    districtName: string | null;
    logoObjectKey: string | null;
    membershipNumber: string;
    startsOn: string | null;
    expiresOn: string | null;
    tierFamily: PsfMembershipFamily;
    docId: string | null;
  } | null> {
    const [row] = await this.db
      .select({
        legalName: orgs.legalName,
        businessCode: orgs.businessCode,
        districtName: districts.name,
        logoObjectKey: orgs.logoObjectKey,
        membershipNumber: psfMemberships.membershipNumber,
        startsOn: psfMemberships.startsOn,
        expiresOn: psfMemberships.expiresOn,
        tierFamily: psfMembershipTiers.family,
        docId: sql<string | null>`(SELECT a.doc_id FROM ${psfMembershipApplications} a
          WHERE a.org_id = ${orgs.id} AND a.status = 'member' AND a.doc_id IS NOT NULL
          ORDER BY a.decided_at DESC NULLS LAST LIMIT 1)`,
      })
      .from(psfMemberships)
      .innerJoin(orgs, eq(orgs.id, psfMemberships.orgId))
      .innerJoin(psfMembershipTiers, eq(psfMembershipTiers.code, psfMemberships.tierCode))
      .leftJoin(districts, eq(districts.id, orgs.districtId))
      .where(and(eq(psfMemberships.orgId, orgId), isNull(psfMemberships.endedAt)))
      .limit(1);
    return row ?? null;
  }

  /** The latest claim PSF confirmed for a business (2026-11-03): who sent the card, who confirmed it, when. */
  async latestConfirmedClaim(orgId: string): Promise<{ claimedByUserId: string; decidedByUserId: string | null; decidedAt: Date | null; claimedAt: Date } | null> {
    const [row] = await this.db
      .select({
        claimedByUserId: psfMembershipClaims.claimedByUserId,
        decidedByUserId: psfMembershipClaims.decidedByUserId,
        decidedAt: psfMembershipClaims.decidedAt,
        claimedAt: psfMembershipClaims.claimedAt,
      })
      .from(psfMembershipClaims)
      .where(and(eq(psfMembershipClaims.orgId, orgId), eq(psfMembershipClaims.status, 'confirmed')))
      .orderBy(desc(psfMembershipClaims.decidedAt))
      .limit(1);
    // A claim always has its claimant; one without (a row from PSF's member list alone) files no record.
    return row?.claimedByUserId ? { ...row, claimedByUserId: row.claimedByUserId } : null;
  }

  /** The business a current membership's number, or the business's code, names (2026-11-03); null when neither. */
  async memberOrgOf(membershipNumber: string, businessCode: string | null): Promise<string | null> {
    const [row] = await this.db
      .select({ orgId: psfMemberships.orgId })
      .from(psfMemberships)
      .innerJoin(orgs, eq(orgs.id, psfMemberships.orgId))
      .where(
        and(
          isNull(psfMemberships.endedAt),
          sql`${psfMemberships.source} <> 'self_declared'`,
          businessCode
            ? or(sql`upper(${psfMemberships.membershipNumber}) = upper(${membershipNumber})`, eq(orgs.businessCode, businessCode))
            : sql`upper(${psfMemberships.membershipNumber}) = upper(${membershipNumber})`,
        ),
      )
      .limit(1);
    return row?.orgId ?? null;
  }

  /** The docID of the business's latest PSF application (2026-11-02), for its mails' links; null with none. */
  async latestDocId(orgId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ docId: psfMembershipApplications.docId })
      .from(psfMembershipApplications)
      .where(and(eq(psfMembershipApplications.orgId, orgId), sql`${psfMembershipApplications.status} <> 'withdrawn'`))
      .orderBy(desc(psfMembershipApplications.createdAt))
      .limit(1);
    return row?.docId ?? null;
  }

  /** The latest membership carrying a number, for its card (2026-11-02); ended ones included, to say lapsed. */
  async memberCardByNumber(membershipNumber: string, businessCode: string | null = null): Promise<{
    legalName: string;
    businessCode: string | null;
    districtName: string | null;
    membershipNumber: string;
    startsOn: string | null;
    expiresOn: string | null;
    endedAt: Date | null;
    tierFamily: PsfMembershipFamily;
    tierName: string;
  } | null> {
    const [row] = await this.db
      .select({
        legalName: orgs.legalName,
        businessCode: orgs.businessCode,
        districtName: districts.name,
        membershipNumber: psfMemberships.membershipNumber,
        startsOn: psfMemberships.startsOn,
        expiresOn: psfMemberships.expiresOn,
        endedAt: psfMemberships.endedAt,
        tierFamily: psfMembershipTiers.family,
        tierName: psfMembershipTiers.nameEn,
      })
      .from(psfMemberships)
      .innerJoin(orgs, eq(orgs.id, psfMemberships.orgId))
      .innerJoin(psfMembershipTiers, eq(psfMembershipTiers.code, psfMemberships.tierCode))
      .leftJoin(districts, eq(districts.id, orgs.districtId))
      // By its number, or by the business's code (2026-11-02): both are printed on the certificate.
      .where(
        and(
          businessCode
            ? or(sql`upper(${psfMemberships.membershipNumber}) = upper(${membershipNumber})`, eq(orgs.businessCode, businessCode))
            : sql`upper(${psfMemberships.membershipNumber}) = upper(${membershipNumber})`,
          sql`${psfMemberships.source} <> 'self_declared'`,
        ),
      )
      .orderBy(sql`${psfMemberships.endedAt} IS NULL DESC`, desc(psfMemberships.createdAt))
      .limit(1);
    return row ?? null;
  }

  async confirmClaim(c: Parameters<typeof confirmClaimRow>[1]): Promise<void> {
    await this.db.transaction((tx) => confirmClaimRow(tx, c).then(() => undefined));
  }

  async rejectClaim(id: string, decidedByUserId: string, reason: string): Promise<boolean> {
    const done = await this.db
      .update(psfMembershipClaims)
      .set({ status: 'rejected', decidedByUserId, decidedAt: new Date(), decisionNote: reason, matchedBy: 'officer', updatedAt: new Date() })
      .where(and(eq(psfMembershipClaims.id, id), eq(psfMembershipClaims.status, 'claimed')))
      .returning({ id: psfMembershipClaims.id });
    return done.length > 0;
  }

  /** PSF's own list: rows replaced by number. */
  async upsertMemberList(
    rows: { membershipNumber: string; legalName: string | null; tin: string | null; tierCode: string | null; startsOn: string | null; expiresOn: string | null }[],
    uploadedByUserId: string,
  ): Promise<void> {
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500).map((r) => ({ ...r, uploadedByUserId, uploadedAt: new Date() }));
      await this.db
        .insert(psfMemberList)
        .values(chunk)
        .onConflictDoUpdate({
          target: psfMemberList.membershipNumber,
          set: {
            legalName: sql`excluded.legal_name`,
            tin: sql`excluded.tin`,
            tierCode: sql`excluded.tier_code`,
            startsOn: sql`excluded.starts_on`,
            expiresOn: sql`excluded.expires_on`,
            uploadedByUserId: sql`excluded.uploaded_by_user_id`,
            uploadedAt: sql`excluded.uploaded_at`,
          },
        });
    }
  }

  /** Open claims PSF's list now confirms: number and TIN match, and the row has a tier and dates. */
  async claimsTheListConfirms(): Promise<PsfListedClaim[]> {
    const rows = await this.db
      .select({
        claimId: psfMembershipClaims.id,
        orgId: psfMembershipClaims.orgId,
        membershipNumber: psfMembershipClaims.membershipNumber,
        tierCode: psfMemberList.tierCode,
        startsOn: psfMemberList.startsOn,
        expiresOn: psfMemberList.expiresOn,
        uploadedByUserId: psfMemberList.uploadedByUserId,
      })
      .from(psfMembershipClaims)
      .innerJoin(orgs, eq(orgs.id, psfMembershipClaims.orgId))
      .innerJoin(psfMemberList, eq(psfMemberList.membershipNumber, psfMembershipClaims.membershipNumber))
      .where(
        and(
          eq(psfMembershipClaims.status, 'claimed'),
          sql`${psfMemberList.tin} = ${orgs.tin}`,
          sql`${psfMemberList.tierCode} IS NOT NULL AND ${psfMemberList.startsOn} IS NOT NULL AND ${psfMemberList.expiresOn} IS NOT NULL`,
        ),
      );
    // Matched on the number, so every row has one; a card-only claim (0131) never matches the list.
    return rows.filter((r): r is typeof r & { membershipNumber: string } => r.membershipNumber !== null);
  }

  async memberListSummary(): Promise<{ rows: number; uploadedAt: Date | null }> {
    const [r] = await this.db
      .select({ n: sql<number>`count(*)::int`, at: sql<Date | null>`max(${psfMemberList.uploadedAt})` })
      .from(psfMemberList);
    return { rows: r?.n ?? 0, uploadedAt: r?.at ? new Date(r.at) : null };
  }

  /** Tier codes PSF uses, for checking a list's rows. */
  async tierCodes(): Promise<string[]> {
    const rows = await this.db.select({ code: psfMembershipTiers.code }).from(psfMembershipTiers);
    return rows.map((r) => r.code);
  }

  // --- Reads about a business ------------------------------------------------

  async orgFacts(orgId: string): Promise<PsfOrgFacts | null> {
    const [row] = await this.db
      .select({
        id: orgs.id,
        domain: orgs.domain,
        legalName: orgs.legalName,
        tin: orgs.tin,
        addressText: orgs.addressText,
        accommodationClass: orgs.accommodationClass,
        accommodationClassOther: orgs.accommodationClassOther,
        registrationStatus: orgs.registrationStatus,
        districtId: orgs.districtId,
        districtName: districts.name,
        businessCode: orgs.businessCode,
        registrationKind: orgs.registrationKind,
        registrationNumber: orgs.registrationNumber,
        ownerGroups: orgs.ownerGroups,
        // The name a business typed, when PSF's list did not have its association.
        associationName: sql<string | null>`coalesce(${orgs.psfAssociationOther}, ${psfAssociations.nameEn})`,
        clusterName: psfClusters.nameEn,
        subsectorName: SUBSECTOR_NAME,
        oboRegistrant: oboRegistrations.registrantUserId,
        oboClaimStatus: oboRegistrations.claimStatus,
        intendedOwnerName: oboRegistrations.intendedOwnerName,
        intendedOwnerNationalId: oboRegistrations.intendedOwnerNationalId,
        intendedOwnerEmail: oboRegistrations.intendedOwnerEmail,
      })
      .from(orgs)
      .leftJoin(districts, eq(districts.id, orgs.districtId))
      .leftJoin(psfAssociations, eq(psfAssociations.code, orgs.psfAssociationCode))
      .leftJoin(psfClusters, eq(psfClusters.code, psfAssociations.clusterCode))
      .leftJoin(psfSubsectors, eq(psfSubsectors.id, orgs.psfSubsectorId))
      .leftJoin(oboRegistrations, eq(oboRegistrations.orgId, orgs.id))
      .where(eq(orgs.id, orgId))
      .limit(1);
    if (!row) return null;
    const {
      oboRegistrant,
      oboClaimStatus,
      intendedOwnerName,
      intendedOwnerNationalId,
      intendedOwnerEmail,
      ...org
    } = row;
    return {
      ...org,
      obo:
        oboRegistrant && oboClaimStatus
          ? {
              registrantUserId: oboRegistrant,
              claimStatus: oboClaimStatus,
              intendedOwnerName: intendedOwnerName ?? '',
              intendedOwnerNationalId,
              intendedOwnerEmail,
            }
          : null,
    };
  }

  /** The business's workspace, for the links mail carries and the payment seam. */
  async workspaceIdFor(orgId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(and(eq(workspaces.orgId, orgId), eq(workspaces.kind, 'business')))
      .limit(1);
    return row?.id ?? null;
  }

  /** One application with its names, whatever its state. */
  async applicationById(applicationId: string): Promise<PsfApplicationWithNames | null> {
    const [row] = await this.db
      .select({
        application: psfMembershipApplications,
        requestedTierName: psfMembershipTiers.nameEn,
        submittedByName,
      })
      .from(psfMembershipApplications)
      .innerJoin(
        psfMembershipTiers,
        eq(psfMembershipTiers.code, psfMembershipApplications.requestedTierCode),
      )
      .leftJoin(submitter, eq(submitter.id, psfMembershipApplications.submittedByUserId))
      .leftJoin(submitterIdentity, eq(submitterIdentity.userId, submitter.id))
      .where(eq(psfMembershipApplications.id, applicationId))
      .limit(1);
    return row
      ? { ...row.application, requestedTierName: row.requestedTierName, submittedByName: row.submittedByName }
      : null;
  }

  /** The caller's role in the business, from an ACTIVE membership only. */
  async activeRole(orgId: string, userId: string): Promise<OrgRole | null> {
    const [row] = await this.db
      .select({ orgRole: orgMemberships.orgRole })
      .from(orgMemberships)
      .where(
        and(
          eq(orgMemberships.orgId, orgId),
          eq(orgMemberships.userId, userId),
          eq(orgMemberships.status, 'active'),
        ),
      )
      .limit(1);
    return row?.orgRole ?? null;
  }

  /**
   * Every user who holds an active owner membership of the business, with the
   * email mail goes to. The service filters these through the applicant rule.
   */
  async activeOwners(orgId: string): Promise<{ userId: string; email: string; name: string | null }[]> {
    return this.db
      .select({ userId: users.id, email: users.email, name: users.name })
      .from(orgMemberships)
      .innerJoin(users, eq(users.id, orgMemberships.userId))
      .where(
        and(
          eq(orgMemberships.orgId, orgId),
          eq(orgMemberships.orgRole, 'owner'),
          eq(orgMemberships.status, 'active'),
        ),
      );
  }

  /**
   * The person the newest application names, for a business with no owner
   * account (the public PSF form): where its news goes, and the docID it is
   * tracked by.
   */
  async publicApplicant(orgId: string): Promise<{
    docId: string;
    name: string;
    email: string | null;
    phoneE164: string | null;
  } | null> {
    const [row] = await this.db
      .select({
        docId: psfMembershipApplications.docId,
        firstName: psfMembershipApplications.firstName,
        lastName: psfMembershipApplications.lastName,
        email: psfMembershipApplications.applicantEmail,
        phoneE164: psfMembershipApplications.applicantPhoneE164,
      })
      .from(psfMembershipApplications)
      .where(and(eq(psfMembershipApplications.orgId, orgId), isNull(psfMembershipApplications.submittedByUserId)))
      .orderBy(desc(psfMembershipApplications.createdAt))
      .limit(1);
    if (!row) return null;
    return { docId: row.docId, name: `${row.firstName} ${row.lastName}`.trim(), email: row.email, phoneE164: row.phoneE164 };
  }

  /** What the apply form can start from about a person. */
  async personFacts(userId: string): Promise<{
    email: string;
    name: string | null;
    phoneE164: string | null;
    dob: string | null;
    gender: 'female' | 'male' | 'other' | 'prefer_not_to_say' | null;
    documentType: 'national_id' | 'passport' | 'other' | null;
    documentNumber: string | null;
  } | null> {
    const [row] = await this.db
      .select({
        email: users.email,
        name: displayName(users, verifiedIdentities),
        // The name You saved (2026-11-03), for a person whose ID was checked by its number alone.
        profileName: userProfiles.displayName,
        phoneE164: userProfiles.phoneE164,
        dob: userProfiles.dob,
        gender: userProfiles.gender,
        nationalId: userProfiles.nationalId,
        documentType: identityDocuments.documentType,
        documentNumber: identityDocuments.documentNumber,
      })
      .from(users)
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .leftJoin(verifiedIdentities, eq(verifiedIdentities.userId, users.id))
      .leftJoin(
        identityDocuments,
        and(
          eq(identityDocuments.identityId, users.id),
          eq(identityDocuments.status, 'active'),
          eq(identityDocuments.isPrimary, true),
        ),
      )
      .where(eq(users.id, userId))
      .limit(1);
    if (!row) return null;
    const documentType = row.documentType ?? (row.nationalId ? 'national_id' : null);
    return {
      email: row.email,
      name: row.name?.trim() || row.profileName?.trim() || null,
      phoneE164: row.phoneE164,
      dob: row.dob,
      gender: row.gender,
      documentType,
      documentNumber: row.documentNumber ?? row.nationalId,
    };
  }

  // --- The tier catalogue ----------------------------------------------------

  async tiers(activeOnly: boolean): Promise<PsfTierRow[]> {
    return this.db
      .select()
      .from(psfMembershipTiers)
      .where(activeOnly ? eq(psfMembershipTiers.active, true) : undefined)
      .orderBy(asc(psfMembershipTiers.sortOrder), asc(psfMembershipTiers.code));
  }

  async tier(code: string): Promise<PsfTierRow | null> {
    const [row] = await this.db
      .select()
      .from(psfMembershipTiers)
      .where(eq(psfMembershipTiers.code, code))
      .limit(1);
    return row ?? null;
  }

  // --- Dynamic membership form fields (2026-10-26) -----------------------------

  async formFields(activeOnly: boolean): Promise<(typeof psfMembershipFormFields.$inferSelect)[]> {
    return this.db
      .select()
      .from(psfMembershipFormFields)
      .where(activeOnly ? eq(psfMembershipFormFields.active, true) : undefined)
      .orderBy(asc(psfMembershipFormFields.sortOrder), asc(psfMembershipFormFields.key));
  }

  async formField(id: string): Promise<(typeof psfMembershipFormFields.$inferSelect) | null> {
    const [row] = await this.db
      .select()
      .from(psfMembershipFormFields)
      .where(eq(psfMembershipFormFields.id, id))
      .limit(1);
    return row ?? null;
  }

  async insertFormField(input: {
    key: string;
    label: string;
    helpText: string | null;
    fieldType: string;
    required: boolean;
    options: string[];
    sortOrder: number;
  }): Promise<(typeof psfMembershipFormFields.$inferSelect)> {
    const [row] = await this.db.insert(psfMembershipFormFields).values(input).returning();
    return row!;
  }

  async updateFormField(
    id: string,
    patch: Partial<{
      label: string;
      helpText: string | null;
      required: boolean;
      options: string[];
      sortOrder: number;
      active: boolean;
    }>,
  ): Promise<(typeof psfMembershipFormFields.$inferSelect) | null> {
    const [row] = await this.db
      .update(psfMembershipFormFields)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(psfMembershipFormFields.id, id))
      .returning();
    return row ?? null;
  }

  // --- What a band costs, by place (2026-10-20) ---------------------------------

  /** The national prices, and the district's own when one is named. */
  async tierFees(districtId: number | null): Promise<
    { tierCode: string; districtId: number | null; annualFeeRwf: number; updatedAt: Date; updatedByName: string | null }[]
  > {
    return this.db
      .select({
        tierCode: psfTierFees.tierCode,
        districtId: psfTierFees.districtId,
        annualFeeRwf: psfTierFees.annualFeeRwf,
        updatedAt: psfTierFees.updatedAt,
        updatedByName: sql<string | null>`coalesce(nullif(trim(${verifiedIdentities.legalFullName}), ''), nullif(trim(${users.name}), ''))`,
      })
      .from(psfTierFees)
      .leftJoin(users, eq(users.id, psfTierFees.setByUserId))
      .leftJoin(verifiedIdentities, eq(verifiedIdentities.userId, users.id))
      .where(
        districtId === null
          ? isNull(psfTierFees.districtId)
          : or(isNull(psfTierFees.districtId), eq(psfTierFees.districtId, districtId)),
      );
  }

  /** Set a band's price for a place, or clear it (`amountRwf` null). */
  async setTierFee(input: { tierCode: string; districtId: number | null; amountRwf: number | null; userId: string }): Promise<void> {
    const place = input.districtId === null ? isNull(psfTierFees.districtId) : eq(psfTierFees.districtId, input.districtId);
    if (input.amountRwf === null) {
      await this.db.delete(psfTierFees).where(and(eq(psfTierFees.tierCode, input.tierCode), place));
      return;
    }
    await this.db.execute(sql`
      INSERT INTO ${psfTierFees} (tier_code, district_id, annual_fee_rwf, set_by_user_id)
      VALUES (${input.tierCode}, ${input.districtId}, ${input.amountRwf}, ${input.userId})
      ON CONFLICT (tier_code, coalesce(district_id, 0))
      DO UPDATE SET annual_fee_rwf = EXCLUDED.annual_fee_rwf, set_by_user_id = EXCLUDED.set_by_user_id, updated_at = now()`);
  }

  async districtName(districtId: number): Promise<string | null> {
    const [row] = await this.db.select({ name: districts.name }).from(districts).where(eq(districts.id, districtId)).limit(1);
    return row?.name ?? null;
  }

  // --- The sector catalogue --------------------------------------------------

  async clusters(activeOnly: boolean): Promise<PsfClusterRow[]> {
    return this.db
      .select()
      .from(psfClusters)
      .where(activeOnly ? eq(psfClusters.active, true) : undefined)
      .orderBy(asc(psfClusters.sortOrder), asc(psfClusters.code));
  }

  async associations(activeOnly: boolean): Promise<PsfAssociationRow[]> {
    return this.db
      .select()
      .from(psfAssociations)
      .where(activeOnly ? eq(psfAssociations.active, true) : undefined)
      .orderBy(asc(psfAssociations.sortOrder), asc(psfAssociations.nameEn));
  }

  // --- Subtypes (2026-10-20) ---------------------------------------------------

  /**
   * The subtypes a reader may see: national ones, and those of the districts
   * named (`districtIds` null for every district, as admin and the country
   * officer read them). Inactive ones only when asked.
   */
  async subsectors(districtIds: readonly number[] | null, includeInactive = false): Promise<
    (typeof psfSubsectors.$inferSelect & { districtName: string | null; associationCodes: string[] })[]
  > {
    const where = and(
      includeInactive ? undefined : eq(psfSubsectors.active, true),
      districtIds === null
        ? undefined
        : districtIds.length
          ? or(isNull(psfSubsectors.districtId), inArray(psfSubsectors.districtId, [...districtIds]))
          : isNull(psfSubsectors.districtId),
    );
    const rows = await this.db
      .select({ s: psfSubsectors, districtName: districts.name })
      .from(psfSubsectors)
      .leftJoin(districts, eq(districts.id, psfSubsectors.districtId))
      .where(where)
      .orderBy(asc(psfSubsectors.sortOrder), asc(psfSubsectors.nameEn));
    const links = rows.length
      ? await this.db
          .select()
          .from(psfSubsectorAssociations)
          .where(inArray(psfSubsectorAssociations.subsectorId, rows.map((r) => r.s.id)))
      : [];
    return rows.map((r) => ({
      ...r.s,
      districtName: r.districtName,
      associationCodes: links.filter((l) => l.subsectorId === r.s.id).map((l) => l.associationCode),
    }));
  }

  async subsector(id: string): Promise<typeof psfSubsectors.$inferSelect | null> {
    const [row] = await this.db.select().from(psfSubsectors).where(eq(psfSubsectors.id, id)).limit(1);
    return row ?? null;
  }

  /** Add a subtype with its associations. False when the name is taken in that place. */
  async insertSubsector(input: {
    clusterCode: string;
    nameEn: string;
    districtId: number | null;
    associationCodes: string[];
    userId: string;
  }): Promise<string | null> {
    try {
      return await this.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(psfSubsectors)
          .values({
            clusterCode: input.clusterCode,
            nameEn: input.nameEn,
            districtId: input.districtId,
            createdByUserId: input.userId,
            updatedByUserId: input.userId,
          })
          .returning({ id: psfSubsectors.id });
        if (!row) throw new Error('Subtype insert returned no row.');
        if (input.associationCodes.length) {
          await tx
            .insert(psfSubsectorAssociations)
            .values(input.associationCodes.map((code) => ({ subsectorId: row.id, associationCode: code })));
        }
        return row.id;
      });
    } catch (error) {
      if ((error as { code?: string; cause?: { code?: string } }).code === '23505' || (error as { cause?: { code?: string } }).cause?.code === '23505') {
        return null;
      }
      throw error;
    }
  }

  async updateSubsector(
    id: string,
    input: { nameEn?: string; active?: boolean; sortOrder?: number; associationCodes?: string[]; userId: string },
  ): Promise<boolean> {
    try {
      await this.db.transaction(async (tx) => {
        await tx
          .update(psfSubsectors)
          .set({
            ...(input.nameEn !== undefined ? { nameEn: input.nameEn } : {}),
            ...(input.active !== undefined ? { active: input.active } : {}),
            ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
            updatedByUserId: input.userId,
            updatedAt: new Date(),
          })
          .where(eq(psfSubsectors.id, id));
        if (input.associationCodes) {
          await tx.delete(psfSubsectorAssociations).where(eq(psfSubsectorAssociations.subsectorId, id));
          if (input.associationCodes.length) {
            await tx
              .insert(psfSubsectorAssociations)
              .values(input.associationCodes.map((code) => ({ subsectorId: id, associationCode: code })));
          }
        }
      });
      return true;
    } catch (error) {
      if ((error as { code?: string }).code === '23505' || (error as { cause?: { code?: string } }).cause?.code === '23505') return false;
      throw error;
    }
  }

  /** An association a business may still name: it, and its cluster, active. */
  async activeAssociation(code: string): Promise<PsfAssociationRow | null> {
    const [row] = await this.db
      .select({ association: psfAssociations })
      .from(psfAssociations)
      .innerJoin(psfClusters, eq(psfClusters.code, psfAssociations.clusterCode))
      .where(
        and(
          eq(psfAssociations.code, code),
          eq(psfAssociations.active, true),
          eq(psfClusters.active, true),
        ),
      )
      .limit(1);
    return row?.association ?? null;
  }

  // --- Applications and memberships of one business --------------------------

  async currentMembership(
    orgId: string,
  ): Promise<(PsfMembershipRow & { tierName: string | null }) | null> {
    const [row] = await this.db
      .select({ membership: psfMemberships, tierName: psfMembershipTiers.nameEn })
      .from(psfMemberships)
      .leftJoin(psfMembershipTiers, eq(psfMembershipTiers.code, psfMemberships.tierCode))
      .where(and(eq(psfMemberships.orgId, orgId), isNull(psfMemberships.endedAt)))
      .limit(1);
    return row ? { ...row.membership, tierName: row.tierName } : null;
  }

  /** Every application the business ever sent, newest first. */
  async applications(orgId: string): Promise<PsfApplicationWithNames[]> {
    const rows = await this.db
      .select({
        application: psfMembershipApplications,
        requestedTierName: psfMembershipTiers.nameEn,
        submittedByName,
      })
      .from(psfMembershipApplications)
      .innerJoin(
        psfMembershipTiers,
        eq(psfMembershipTiers.code, psfMembershipApplications.requestedTierCode),
      )
      .leftJoin(submitter, eq(submitter.id, psfMembershipApplications.submittedByUserId))
      .leftJoin(submitterIdentity, eq(submitterIdentity.userId, submitter.id))
      .where(eq(psfMembershipApplications.orgId, orgId))
      .orderBy(desc(psfMembershipApplications.createdAt));
    return rows.map((r) => ({
      ...r.application,
      requestedTierName: r.requestedTierName,
      submittedByName: r.submittedByName,
    }));
  }

  async insertApplication(row: NewPsfApplication): Promise<{ id: string }> {
    return insertPsfApplication(this.db, row);
  }

  /**
   * Guarded: only an OPEN application of THIS business moves. An approved one
   * may be withdrawn too: a business that decides not to pay says so, rather
   * than leaving PSF's approval waiting forever.
   */
  async withdraw(orgId: string, applicationId: string, userId: string): Promise<boolean> {
    const moved = await this.db
      .update(psfMembershipApplications)
      .set({
        status: 'withdrawn',
        withdrawnAt: new Date(),
        withdrawnByUserId: userId,
        // An approval withdrawn is no longer a decision anyone stands behind.
        decidedAt: null,
        decidedByUserId: null,
        decisionBodyCode: null,
        approvedMembershipNumber: null,
        approvedFeeRwf: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(psfMembershipApplications.id, applicationId),
          eq(psfMembershipApplications.orgId, orgId),
          OPEN_STATUS_SQL,
        ),
      )
      .returning({ id: psfMembershipApplications.id });
    return moved.length > 0;
  }

  /**
   * Stamp the first time an open application entered PSF's queue. Returns the
   * ids it stamped, and ONLY those: the officer email is keyed on this, so a
   * second call, a race or a re entry into the queue sends nothing.
   */
  async markQueued(orgId: string): Promise<string[]> {
    const stamped = await this.db
      .update(psfMembershipApplications)
      .set({ queuedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(psfMembershipApplications.orgId, orgId),
          eq(psfMembershipApplications.status, 'submitted'),
          isNull(psfMembershipApplications.queuedAt),
        ),
      )
      .returning({ id: psfMembershipApplications.id });
    return stamped.map((r) => r.id);
  }

  /** Businesses in a queue state holding an application nobody stamped yet. */
  async unstampedQueuedOrgs(): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ orgId: psfMembershipApplications.orgId })
      .from(psfMembershipApplications)
      .innerJoin(orgs, eq(orgs.id, psfMembershipApplications.orgId))
      .where(
        and(
          eq(psfMembershipApplications.status, 'submitted'),
          isNull(psfMembershipApplications.queuedAt),
          inArray(orgs.registrationStatus, [...PSF_QUEUE_REGISTRATION_STATES]),
        ),
      );
    return rows.map((r) => r.orgId);
  }

  // --- The officer's queue ---------------------------------------------------

  /**
   * Does this officer hold a stake in the business (AC-14): an active role, or
   * being the person who registered it on someone's behalf.
   */
  private stakeSql(officerUserId: string): SQL<boolean> {
    return sql<boolean>`(
      EXISTS (SELECT 1 FROM ${orgMemberships}
               WHERE ${orgMemberships.orgId} = ${orgs.id}
                 AND ${orgMemberships.userId} = ${officerUserId}
                 AND ${orgMemberships.status} = 'active')
      OR EXISTS (SELECT 1 FROM ${oboRegistrations}
                  WHERE ${oboRegistrations.orgId} = ${orgs.id}
                    AND ${oboRegistrations.registrantUserId} = ${officerUserId})
    )`;
  }

  /** In the queue: waiting on PSF, and the business past the TIN check in good standing (AC-8). */
  private inQueue(): SQL | undefined {
    return and(
      eq(psfMembershipApplications.status, 'submitted'),
      inArray(orgs.registrationStatus, [...PSF_QUEUE_REGISTRATION_STATES]),
    );
  }

  private sortAt(): SQL<Date> {
    return sql<Date>`coalesce(${psfMembershipApplications.queuedAt}, ${psfMembershipApplications.createdAt})`;
  }

  /**
   * The queue, filtered and sorted as the console asks: newest first unless
   * told otherwise. Paged by offset, because three orders cannot share one
   * keyset cursor, and a queue is short enough for an offset to be honest.
   */
  async queuePage(
    officerUserId: string,
    scope: PsfScope,
    filter: PsfQueueFilter,
    offset: number,
    limit: number,
  ): Promise<{ rows: PsfQueueRow[]; more: boolean; total: number }> {
    const sortAt = this.sortAt();
    const q = filter.q?.trim();
    const like = q ? `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null;
    const where = and(
      // The business is the officer's to decide, or one of its branches is.
      or(and(this.inQueue(), inScope(scope)), branchWaitsOn(scope)),
      filter.cluster ? eq(psfAssociations.clusterCode, filter.cluster) : undefined,
      filter.family ? sql`${psfMembershipTiers.family} = ${filter.family}` : undefined,
      filter.group ? sql`${filter.group}::psf_owner_group = ANY(${orgs.ownerGroups})` : undefined,
      like
        ? or(
            sql`${orgs.legalName} ILIKE ${like}`,
            sql`${orgs.businessCode} ILIKE ${like}`,
            // A code typed without its dashes (2026-11-02): `gis4k7q92` finds `GIS-4K7Q-92`.
            sql`replace(${orgs.businessCode}, '-', '') ILIKE ${compactLike(like)}`,
            sql`${psfMembershipApplications.docId} ILIKE ${like}`,
          )
        : undefined,
    );
    const order =
      filter.sort === 'oldest'
        ? [asc(sortAt), asc(psfMembershipApplications.id)]
        : filter.sort === 'amount'
          ? [sql`${psfMembershipApplications.declaredFeeRwf} DESC NULLS LAST`, desc(sortAt)]
          : [desc(sortAt), desc(psfMembershipApplications.id)];
    const rows = await this.db
      .select({
        applicationId: psfMembershipApplications.id,
        submittedByUserId: psfMembershipApplications.submittedByUserId,
        intake: psfMembershipApplications.intake,
        orgId: orgs.id,
        businessName: orgs.legalName,
        businessCode: orgs.businessCode,
        domain: orgs.domain,
        districtName: districts.name,
        // The name a business typed, when PSF's list did not have its association.
        associationName: sql<string | null>`coalesce(${orgs.psfAssociationOther}, ${psfAssociations.nameEn})`,
        subsectorName: SUBSECTOR_NAME,
        clusterName: psfClusters.nameEn,
        ownerGroups: orgs.ownerGroups,
        requestedTierName: psfMembershipTiers.nameEn,
        declaredFeeRwf: psfMembershipApplications.declaredFeeRwf,
        paidAmountRwf: psfMembershipApplications.paidAmountRwf,
        submittedAt: psfMembershipApplications.createdAt,
        queuedAt: psfMembershipApplications.queuedAt,
        sortAt: sortAt.mapWith((v: string | Date) => new Date(v)),
        registrationStatus: orgs.registrationStatus,
        officerHasStake: this.stakeSql(officerUserId).mapWith(Boolean),
        districtId: orgs.districtId,
        docId: psfMembershipApplications.docId,
        branchesPending: branchesPendingIn(scope).mapWith(Number),
      })
      .from(psfMembershipApplications)
      .innerJoin(orgs, eq(orgs.id, psfMembershipApplications.orgId))
      .innerJoin(psfMembershipTiers, eq(psfMembershipTiers.code, psfMembershipApplications.requestedTierCode))
      .leftJoin(districts, eq(districts.id, orgs.districtId))
      .leftJoin(psfAssociations, eq(psfAssociations.code, orgs.psfAssociationCode))
      .leftJoin(psfClusters, eq(psfClusters.code, psfAssociations.clusterCode))
      .leftJoin(psfSubsectors, eq(psfSubsectors.id, orgs.psfSubsectorId))
      .where(where)
      .orderBy(...order)
      .limit(limit + 1)
      .offset(offset);
    const [counted] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(psfMembershipApplications)
      .innerJoin(orgs, eq(orgs.id, psfMembershipApplications.orgId))
      .innerJoin(psfMembershipTiers, eq(psfMembershipTiers.code, psfMembershipApplications.requestedTierCode))
      .leftJoin(psfAssociations, eq(psfAssociations.code, orgs.psfAssociationCode))
      .where(where);
    return { rows: rows.slice(0, limit), more: rows.length > limit, total: counted?.n ?? 0 };
  }

  /**
   * One application as the officer reads it, or null when it is outside their
   * region or not one PSF has in hand: waiting on PSF (the queue) or approved
   * and waiting on the payment, which the register opens.
   */
  async officerApplication(
    officerUserId: string,
    scope: PsfScope,
    applicationId: string,
    /** True for a read: a decided application opens too, from the decision log. */
    includeDecided = false,
    /** True for a read: a branch in the region opens the application too (2026-10-23). */
    throughBranch = false,
  ): Promise<PsfOfficerApplicationRow | null> {
    const [row] = await this.db
      .select({
        application: psfMembershipApplications,
        requestedTierName: psfMembershipTiers.nameEn,
        submittedByName,
        businessName: orgs.legalName,
        districtId: orgs.districtId,
        districtName: districts.name,
        registrationStatus: orgs.registrationStatus,
        officerHasStake: this.stakeSql(officerUserId).mapWith(Boolean),
        domain: orgs.domain,
        businessCode: orgs.businessCode,
        clusterName: psfClusters.nameEn,
        // The name a business typed, when PSF's list did not have its association.
        associationName: sql<string | null>`coalesce(${orgs.psfAssociationOther}, ${psfAssociations.nameEn})`,
        subsectorName: SUBSECTOR_NAME,
        ownerGroups: orgs.ownerGroups,
        registrationKind: orgs.registrationKind,
      })
      .from(psfMembershipApplications)
      .innerJoin(orgs, eq(orgs.id, psfMembershipApplications.orgId))
      .innerJoin(
        psfMembershipTiers,
        eq(psfMembershipTiers.code, psfMembershipApplications.requestedTierCode),
      )
      .leftJoin(submitter, eq(submitter.id, psfMembershipApplications.submittedByUserId))
      .leftJoin(submitterIdentity, eq(submitterIdentity.userId, submitter.id))
      .leftJoin(districts, eq(districts.id, orgs.districtId))
      .leftJoin(psfAssociations, eq(psfAssociations.code, orgs.psfAssociationCode))
      .leftJoin(psfClusters, eq(psfClusters.code, psfAssociations.clusterCode))
      .leftJoin(psfSubsectors, eq(psfSubsectors.id, orgs.psfSubsectorId))
      .where(
        and(
          eq(psfMembershipApplications.id, applicationId),
          includeDecided ? undefined : OPEN_STATUS_SQL,
          includeDecided ? undefined : inArray(orgs.registrationStatus, [...PSF_QUEUE_REGISTRATION_STATES]),
          throughBranch && scope !== null ? or(inScope(scope), branchInScope(scope, false)) : inScope(scope),
        ),
      )
      .limit(1);
    if (!row) return null;
    const { application, ...rest } = row;
    return { ...application, ...rest };
  }

  /** A business's branches, from its newest application, with their place in words. */
  async orgBranches(orgId: string): Promise<(PsfBranchRow & { provinceName: string | null })[]> {
    const [newest] = await this.db
      .select({ id: psfMembershipApplications.id })
      .from(psfMembershipApplications)
      .where(eq(psfMembershipApplications.orgId, orgId))
      .orderBy(desc(psfMembershipApplications.createdAt))
      .limit(1);
    if (!newest) return [];
    const rows = await this.branchesOf(newest.id);
    const ids = [...new Set(rows.map((r) => r.districtId))];
    const named = ids.length
      ? await this.db
          .select({ id: districts.id, province: provinces.name })
          .from(districts)
          .leftJoin(provinces, eq(provinces.id, districts.provinceId))
          .where(inArray(districts.id, ids))
      : [];
    return rows.map((r) => ({ ...r, provinceName: named.find((n) => n.id === r.districtId)?.province ?? null }));
  }

  /** The branches an application listed, in the order they were filed. */
  async branchesOf(applicationId: string): Promise<PsfBranchRow[]> {
    return this.db
      .select({
        id: psfApplicationBranches.id,
        applicationId: psfApplicationBranches.applicationId,
        districtId: psfApplicationBranches.districtId,
        districtName: districts.name,
        sectorName: sectors.name,
        street: psfApplicationBranches.street,
        status: psfApplicationBranches.status,
        decisionNote: psfApplicationBranches.decisionNote,
        decidedAt: psfApplicationBranches.decidedAt,
      })
      .from(psfApplicationBranches)
      .leftJoin(districts, eq(districts.id, psfApplicationBranches.districtId))
      .leftJoin(sectors, eq(sectors.id, psfApplicationBranches.sectorId))
      .where(eq(psfApplicationBranches.applicationId, applicationId))
      .orderBy(asc(psfApplicationBranches.createdAt), asc(psfApplicationBranches.id));
  }

  /**
   * Admit or decline one branch, guarded like every move: only a branch still
   * waiting moves, so two officers cannot both decide it.
   */
  async decideBranch(input: {
    applicationId: string;
    branchId: string;
    officerUserId: string;
    status: 'admitted' | 'declined';
    note: string | null;
  }): Promise<boolean> {
    const now = new Date();
    const moved = await this.db
      .update(psfApplicationBranches)
      .set({
        status: input.status,
        decidedAt: now,
        decidedByUserId: input.officerUserId,
        decisionNote: input.note,
        updatedAt: now,
      })
      .where(
        and(
          eq(psfApplicationBranches.id, input.branchId),
          eq(psfApplicationBranches.applicationId, input.applicationId),
          eq(psfApplicationBranches.status, 'pending'),
        ),
      )
      .returning({ id: psfApplicationBranches.id });
    return moved.length > 0;
  }

  /**
   * Approve an application (AC-11 as the PSF path changed it): `submitted →
   * approved`, guarded like every move. The membership waits for the payment.
   */
  async approve(input: {
    applicationId: string;
    officerUserId: string;
    bodyCode: string;
    membershipNumber: string;
    feeRwf: number;
    note: string | null;
  }): Promise<{ orgId: string } | null> {
    const now = new Date();
    const [moved] = await this.db
      .update(psfMembershipApplications)
      .set({
        status: 'approved',
        decidedAt: now,
        decidedByUserId: input.officerUserId,
        decisionBodyCode: input.bodyCode,
        decisionNote: input.note,
        approvedMembershipNumber: input.membershipNumber,
        approvedFeeRwf: input.feeRwf,
        updatedAt: now,
      })
      .where(
        and(
          eq(psfMembershipApplications.id, input.applicationId),
          eq(psfMembershipApplications.status, 'submitted'),
        ),
      )
      .returning({ orgId: psfMembershipApplications.orgId });
    return moved ?? null;
  }

  /** Decline (AC-12). Guarded like every other move. */
  async decline(input: {
    applicationId: string;
    officerUserId: string;
    bodyCode: string;
    reason: PsfDeclineReason;
    note: string | null;
  }): Promise<{ orgId: string } | null> {
    const now = new Date();
    const [moved] = await this.db
      .update(psfMembershipApplications)
      .set({
        status: 'declined',
        decidedAt: now,
        decidedByUserId: input.officerUserId,
        decisionBodyCode: input.bodyCode,
        declineReason: input.reason,
        decisionNote: input.note,
        // A paid application keeps its fee: nothing is refunded (2026-10-23).
        updatedAt: now,
      })
      .where(
        and(
          eq(psfMembershipApplications.id, input.applicationId),
          eq(psfMembershipApplications.status, 'submitted'),
        ),
      )
      .returning({ orgId: psfMembershipApplications.orgId });
    return moved ?? null;
  }

  /**
   * The payment that makes an approved application a membership, as ONE
   * transaction: the guarded move first (`approved → member`, with the
   * payment on it); if it moved nothing (paid already, withdrawn, raced) write
   * nothing else. Otherwise end the current membership, write the confirmed
   * one, and set the business's flag.
   */
  async recordPayment(input: {
    applicationId: string;
    orgId: string;
    amountRwf: number;
    paymentRef: string;
    paymentMode: 'mock' | 'live';
    paidAt: Date;
    startsOn: string;
    expiresOn: string;
    recordedByUserId: string;
  }): Promise<{ tierCode: string; membershipNumber: string } | null> {
    return this.db.transaction(async (tx) => {
      const [moved] = await tx
        .update(psfMembershipApplications)
        .set({
          status: 'member',
          paidAt: input.paidAt,
          paidAmountRwf: input.amountRwf,
          paymentRef: input.paymentRef,
          paymentMode: input.paymentMode,
          updatedAt: input.paidAt,
        })
        .where(
          and(
            eq(psfMembershipApplications.id, input.applicationId),
            eq(psfMembershipApplications.orgId, input.orgId),
            eq(psfMembershipApplications.status, 'approved'),
          ),
        )
        .returning({
          tierCode: psfMembershipApplications.requestedTierCode,
          membershipNumber: psfMembershipApplications.approvedMembershipNumber,
        });
      if (!moved || !moved.membershipNumber) return null;

      await tx
        .update(psfMemberships)
        .set({ endedAt: input.paidAt, updatedAt: input.paidAt })
        .where(and(eq(psfMemberships.orgId, input.orgId), isNull(psfMemberships.endedAt)));
      await tx.insert(psfMemberships).values({
        orgId: input.orgId,
        source: 'psf_confirmed',
        applicationId: input.applicationId,
        tierCode: moved.tierCode,
        membershipNumber: moved.membershipNumber,
        annualFeeRwf: input.amountRwf,
        startsOn: input.startsOn,
        expiresOn: input.expiresOn,
        recordedByUserId: input.recordedByUserId,
      });
      await tx
        .update(orgs)
        .set({ psfMember: true, updatedAt: input.paidAt })
        .where(eq(orgs.id, input.orgId));
      return { tierCode: moved.tierCode, membershipNumber: moved.membershipNumber };
    });
  }

  /**
   * The membership fee a public application paid at submit, before PSF has
   * seen it. Guarded: only an unpaid application still with PSF takes one.
   */
  async recordPrepayment(input: {
    applicationId: string;
    amountRwf: number;
    paymentRef: string;
    paymentMode: 'mock' | 'live';
    paidAt: Date;
  }): Promise<boolean> {
    const rows = await this.db
      .update(psfMembershipApplications)
      .set({
        paidAt: input.paidAt,
        paidAmountRwf: input.amountRwf,
        paymentRef: input.paymentRef,
        paymentMode: input.paymentMode,
        updatedAt: input.paidAt,
      })
      .where(
        and(
          eq(psfMembershipApplications.id, input.applicationId),
          eq(psfMembershipApplications.status, 'submitted'),
          isNull(psfMembershipApplications.paidAt),
        ),
      )
      .returning({ id: psfMembershipApplications.id });
    return rows.length > 0;
  }

  /**
   * Approve a paid application: it becomes a member in the same move
   * (`submitted → member`), with the membership starting today. One
   * transaction, like `recordPayment`, which this is the paid-first twin of.
   */
  async approvePaid(input: {
    applicationId: string;
    officerUserId: string;
    bodyCode: string;
    membershipNumber: string;
    note: string | null;
    startsOn: string;
    expiresOn: string;
  }): Promise<{ orgId: string; amountRwf: number; tierCode: string } | null> {
    return this.db.transaction(async (tx) => {
      const now = new Date();
      const [moved] = await tx
        .update(psfMembershipApplications)
        .set({
          status: 'member',
          decidedAt: now,
          decidedByUserId: input.officerUserId,
          decisionBodyCode: input.bodyCode,
          decisionNote: input.note,
          approvedMembershipNumber: input.membershipNumber,
          approvedFeeRwf: sql`${psfMembershipApplications.paidAmountRwf}`,
          updatedAt: now,
        })
        .where(
          and(
            eq(psfMembershipApplications.id, input.applicationId),
            eq(psfMembershipApplications.status, 'submitted'),
            sql`${psfMembershipApplications.paidAt} IS NOT NULL`,
          ),
        )
        .returning({
          orgId: psfMembershipApplications.orgId,
          amountRwf: psfMembershipApplications.paidAmountRwf,
          tierCode: psfMembershipApplications.requestedTierCode,
        });
      if (!moved || moved.amountRwf === null) return null;
      await tx
        .update(psfMemberships)
        .set({ endedAt: now, updatedAt: now })
        .where(and(eq(psfMemberships.orgId, moved.orgId), isNull(psfMemberships.endedAt)));
      await tx.insert(psfMemberships).values({
        orgId: moved.orgId,
        source: 'psf_confirmed',
        applicationId: input.applicationId,
        tierCode: moved.tierCode,
        membershipNumber: input.membershipNumber,
        annualFeeRwf: moved.amountRwf,
        startsOn: input.startsOn,
        expiresOn: input.expiresOn,
        recordedByUserId: input.officerUserId,
      });
      await tx.update(orgs).set({ psfMember: true, updatedAt: now }).where(eq(orgs.id, moved.orgId));
      return { orgId: moved.orgId, amountRwf: moved.amountRwf, tierCode: moved.tierCode };
    });
  }

  /**
   * A card holder confirmed (2026-11-02): a member at once, under its new number and the year on its
   * card, with no fee taken now. Guarded on `submitted`, so a race decides once.
   */
  async approveCardHolder(input: {
    applicationId: string;
    officerUserId: string;
    bodyCode: string;
    membershipNumber: string;
    note: string | null;
    startsOn: string;
    expiresOn: string;
  }): Promise<{ orgId: string; tierCode: string } | null> {
    return this.db.transaction(async (tx) => {
      const now = new Date();
      const [moved] = await tx
        .update(psfMembershipApplications)
        .set({
          status: 'member',
          decidedAt: now,
          decidedByUserId: input.officerUserId,
          decisionBodyCode: input.bodyCode,
          decisionNote: input.note,
          approvedMembershipNumber: input.membershipNumber,
          updatedAt: now,
        })
        .where(
          and(
            eq(psfMembershipApplications.id, input.applicationId),
            eq(psfMembershipApplications.status, 'submitted'),
            eq(psfMembershipApplications.intake, 'card_holder'),
          ),
        )
        .returning({ orgId: psfMembershipApplications.orgId, tierCode: psfMembershipApplications.requestedTierCode });
      if (!moved) return null;
      await tx
        .update(psfMemberships)
        .set({ endedAt: now, updatedAt: now })
        .where(and(eq(psfMemberships.orgId, moved.orgId), isNull(psfMemberships.endedAt)));
      // PSF's own record of a member (`psf_record`): the shape check keeps its application id empty, so
      // the membership stands on the card PSF checked; the application still says member, with the number.
      await tx.insert(psfMemberships).values({
        orgId: moved.orgId,
        source: 'psf_record',
        tierCode: moved.tierCode,
        membershipNumber: input.membershipNumber,
        startsOn: input.startsOn,
        expiresOn: input.expiresOn,
        recordedByUserId: input.officerUserId,
      });
      await tx.update(orgs).set({ psfMember: true, updatedAt: now }).where(eq(orgs.id, moved.orgId));
      return moved;
    });
  }

  /** Everything the business has done with PSF through Injishi, for the officer's detail. */
  async businessHistory(orgId: string): Promise<{
    registeredAt: Date | null;
    registrationFee: { amountRwf: number; paidAt: Date | null } | null;
    applications: (PsfApplicationRow & { tierName: string })[];
    memberships: (PsfMembershipRow & { tierName: string | null })[];
  }> {
    const [org] = await this.db.select({ createdAt: orgs.createdAt }).from(orgs).where(eq(orgs.id, orgId)).limit(1);
    const [invoice] = await this.db
      .select({ amountRwf: subscriptionInvoices.amountRwf, status: subscriptionInvoices.status, updatedAt: subscriptionInvoices.updatedAt })
      .from(subscriptionInvoices)
      .where(and(eq(subscriptionInvoices.orgId, orgId), eq(subscriptionInvoices.invoiceKind, 'registration_fee')))
      .limit(1);
    const apps = await this.db
      .select({ a: psfMembershipApplications, tierName: psfMembershipTiers.nameEn })
      .from(psfMembershipApplications)
      .innerJoin(psfMembershipTiers, eq(psfMembershipTiers.code, psfMembershipApplications.requestedTierCode))
      .where(eq(psfMembershipApplications.orgId, orgId))
      .orderBy(desc(psfMembershipApplications.createdAt));
    const ms = await this.db
      .select({ m: psfMemberships, tierName: psfMembershipTiers.nameEn })
      .from(psfMemberships)
      .leftJoin(psfMembershipTiers, eq(psfMembershipTiers.code, psfMemberships.tierCode))
      .where(eq(psfMemberships.orgId, orgId))
      .orderBy(desc(psfMemberships.createdAt));
    return {
      registeredAt: org?.createdAt ?? null,
      registrationFee: invoice ? { amountRwf: invoice.amountRwf ?? 0, paidAt: invoice.status === 'paid' ? invoice.updatedAt : null } : null,
      applications: apps.map((r) => ({ ...r.a, tierName: r.tierName })),
      memberships: ms.map((r) => ({ ...r.m, tierName: r.tierName })),
    };
  }

  /** The person on a business's newest application, as filed. */
  async newestApplicationContact(orgId: string): Promise<{
    firstName: string;
    lastName: string;
    contactRole: PsfApplicationRow['contactRole'];
    phoneE164: string;
    email: string;
  } | null> {
    const [row] = await this.db
      .select({
        firstName: psfMembershipApplications.firstName,
        lastName: psfMembershipApplications.lastName,
        contactRole: psfMembershipApplications.contactRole,
        phoneE164: psfMembershipApplications.phoneE164,
        email: psfMembershipApplications.email,
      })
      .from(psfMembershipApplications)
      .where(eq(psfMembershipApplications.orgId, orgId))
      .orderBy(desc(psfMembershipApplications.createdAt))
      .limit(1);
    return row ?? null;
  }

  /** Record that a paid fee was passed on to PSF. Once: a remitted row stays remitted. */
  async recordRemittance(applicationId: string, remittanceRef: string): Promise<void> {
    await this.db
      .update(psfMembershipApplications)
      .set({ remittedAt: new Date(), remittanceRef, updatedAt: new Date() })
      .where(
        and(
          eq(psfMembershipApplications.id, applicationId),
          isNull(psfMembershipApplications.remittedAt),
          sql`${psfMembershipApplications.paidAt} IS NOT NULL`,
        ),
      );
  }

  /**
   * Where the membership officer emails go (AC-9): every active officer whose
   * region covers the business's district. A business with no district reaches
   * country officers only, the same rule `scopeCoversDistrict` applies.
   */
  async membershipOfficerEmails(districtId: number | null): Promise<string[]> {
    const covers =
      districtId === null
        ? eq(oversightAssignments.scopeLevel, 'country')
        : or(
            eq(oversightAssignments.scopeLevel, 'country'),
            and(eq(oversightAssignments.scopeLevel, 'district'), eq(oversightAssignments.districtId, districtId)),
            and(
              eq(oversightAssignments.scopeLevel, 'province'),
              sql`${oversightAssignments.provinceId} = (SELECT d.province_id FROM ${districts} d WHERE d.id = ${districtId})`,
            ),
          );
    const rows = await this.db
      .selectDistinct({ email: users.email })
      .from(oversightAssignments)
      .innerJoin(users, eq(users.id, oversightAssignments.userId))
      .where(
        and(
          eq(oversightAssignments.oversightRole, 'psf_membership_officer'),
          isNull(oversightAssignments.revokedAt),
          covers,
        ),
      );
    return rows.map((r) => r.email);
  }

  // --- The officer's register of businesses ----------------------------------

  /** The register's filters as one condition, on top of its base and the scope. */
  private registerWhere(scope: PsfScope, f: PsfRegisterFilter): SQL | undefined {
    const q = f.q?.trim();
    const like = q ? `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null;
    return and(
      // One business by id, or those waiting for a payment, are read past the register's own rule.
      f.payment === 'due' || f.orgId ? ON_REGISTER_OR_UNPAID_SQL : ON_REGISTER_SQL,
      f.payment === 'due' ? PAYMENT_DUE_SQL : undefined,
      // Its head office in the region, or one of its branches (2026-10-23).
      scope === null ? undefined : or(inScope(scope), hasBranchIn(scope)),
      f.orgId ? eq(orgs.id, f.orgId) : undefined,
      f.districtId !== undefined ? eq(orgs.districtId, f.districtId) : undefined,
      f.associationCode ? eq(orgs.psfAssociationCode, f.associationCode) : undefined,
      f.subsectorId ? eq(orgs.psfSubsectorId, f.subsectorId) : undefined,
      f.clusterCode ? eq(psfAssociations.clusterCode, f.clusterCode) : undefined,
      f.group ? sql`${f.group}::psf_owner_group = ANY(${orgs.ownerGroups})` : undefined,
      f.tin === 'with' ? sql`${orgs.tin} IS NOT NULL` : f.tin === 'without' ? sql`${orgs.tin} IS NULL` : undefined,
      f.kind ? sql`${orgs.domain}::text = ${f.kind}` : undefined,
      f.standing ? sql`${STANDING_SQL} = ${f.standing}` : undefined,
      f.renewal === 'due' ? RENEWAL_DUE_SQL : undefined,
      f.tierCode
        ? sql`coalesce(
            (SELECT m.tier_code FROM ${psfMemberships} m WHERE m.org_id = ${ORG_ID} AND m.ended_at IS NULL LIMIT 1),
            (SELECT a.requested_tier_code FROM ${psfMembershipApplications} a
              WHERE a.org_id = ${ORG_ID} AND a.status IN ('submitted', 'approved') LIMIT 1)
          ) = ${f.tierCode}`
        : undefined,
      like
        ? or(
            sql`${orgs.legalName} ILIKE ${like}`,
            sql`${orgs.businessCode} ILIKE ${like}`,
            // A code typed without its dashes (2026-11-02): `gis4k7q92` finds `GIS-4K7Q-92`.
            sql`replace(${orgs.businessCode}, '-', '') ILIKE ${compactLike(like)}`,
            sql`${orgs.tin} ILIKE ${like}`,
          )
        : undefined,
    );
  }

  async registerPage(
    scope: PsfScope,
    filter: PsfRegisterFilter,
    after: { sortAt: Date; id: string } | undefined,
    limit: number,
  ): Promise<{ rows: PsfBusinessRegisterRow[]; more: boolean; total: number }> {
    const where = this.registerWhere(scope, filter);
    const currentTier = alias(psfMembershipTiers, 'psf_current_tier');
    const openTier = alias(psfMembershipTiers, 'psf_open_tier');
    const current = alias(psfMemberships, 'psf_current');
    const open = alias(psfMembershipApplications, 'psf_open');

    const rows = await this.db
      .select({
        orgId: orgs.id,
        businessCode: orgs.businessCode,
        legalName: orgs.legalName,
        domain: orgs.domain,
        districtId: orgs.districtId,
        districtName: districts.name,
        sectorName: sectors.name,
        clusterCode: psfClusters.code,
        clusterName: psfClusters.nameEn,
        subsectorName: SUBSECTOR_NAME,
        // The name a business typed, when PSF's list did not have its association.
        associationName: sql<string | null>`coalesce(${orgs.psfAssociationOther}, ${psfAssociations.nameEn})`,
        associationAcronym: psfAssociations.acronym,
        ownerGroups: orgs.ownerGroups,
        registrationKind: orgs.registrationKind,
        hasTin: sql<boolean>`${orgs.tin} IS NOT NULL`.mapWith(Boolean),
        registeredAt: orgs.createdAt,
        standing: STANDING_SQL,
        tierName: sql<string | null>`coalesce(${currentTier.nameEn}, ${openTier.nameEn})`,
        membershipNumber: sql<string | null>`coalesce(${current.membershipNumber}, ${open.approvedMembershipNumber})`,
        expiresOn: current.expiresOn,
        openApplicationId: open.id,
        paidRwf: PAID_RWF.mapWith(Number),
        lastPaidAt: LAST_PAID_AT,
        branchCount: BRANCH_COUNT.mapWith(Number),
        paymentDue: PAYMENT_DUE_JSON,
      })
      .from(orgs)
      .leftJoin(districts, eq(districts.id, orgs.districtId))
      .leftJoin(sectors, eq(sectors.id, orgs.sectorId))
      .leftJoin(psfAssociations, eq(psfAssociations.code, orgs.psfAssociationCode))
      .leftJoin(psfClusters, eq(psfClusters.code, psfAssociations.clusterCode))
      .leftJoin(psfSubsectors, eq(psfSubsectors.id, orgs.psfSubsectorId))
      .leftJoin(current, sql`${current.id} = ${CURRENT_MEMBERSHIP}`)
      .leftJoin(currentTier, eq(currentTier.code, current.tierCode))
      .leftJoin(open, sql`${open.id} = ${OPEN_APPLICATION}`)
      .leftJoin(openTier, eq(openTier.code, open.requestedTierCode))
      .where(
        and(
          where,
          // Newest first, so the cursor moves back in time.
          after
            ? or(lt(orgs.createdAt, after.sortAt), and(eq(orgs.createdAt, after.sortAt), lt(orgs.id, after.id)))
            : undefined,
        ),
      )
      .orderBy(desc(orgs.createdAt), desc(orgs.id))
      .limit(limit + 1);

    const [counted] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(orgs)
      .leftJoin(psfAssociations, eq(psfAssociations.code, orgs.psfAssociationCode))
      .where(where);

    return {
      rows: rows
        .slice(0, limit)
        .map((r) => ({ ...r, standing: r.standing as PsfStanding, lastPaidAt: r.lastPaidAt ? new Date(r.lastPaidAt) : null })),
      more: rows.length > limit,
      total: counted?.n ?? 0,
    };
  }

  /** The officer's region at a glance: totals and counts under each heading. */
  async registerSummary(scope: PsfScope, yearStart: Date): Promise<{
    total: number;
    members: number;
    waiting: number;
    paidThisYearRwf: number;
    renewalDue: number;
    renewedThisYear: number;
    awaitingPayment: number;
    byCluster: { key: string | null; label: string | null; count: number }[];
    byStanding: { key: PsfStanding; count: number }[];
    byGroup: { key: PsfOwnerGroup; count: number }[];
    byDistrict: { key: number | null; label: string | null; count: number }[];
  }> {
    const base = and(ON_REGISTER_SQL, inScope(scope));

    const [byCluster, byStanding, byGroup, byDistrict, waitingRows, paidRows, dueRows, renewedRows, unpaidRows] = await Promise.all([
      this.db
        .select({ key: psfClusters.code, label: psfClusters.nameEn, count: sql<number>`count(*)::int` })
        .from(orgs)
        .leftJoin(psfAssociations, eq(psfAssociations.code, orgs.psfAssociationCode))
        .leftJoin(psfClusters, eq(psfClusters.code, psfAssociations.clusterCode))
        .where(base)
        .groupBy(psfClusters.code, psfClusters.nameEn, psfClusters.sortOrder)
        .orderBy(asc(psfClusters.sortOrder)),
      this.db
        .select({ key: STANDING_SQL, count: sql<number>`count(*)::int` })
        .from(orgs)
        .where(base)
        .groupBy(sql`1`),
      this.db.execute<{ key: PsfOwnerGroup; count: number }>(
        sql`SELECT g.grp::text AS key, count(*)::int AS count
              FROM ${orgs}
              LEFT JOIN ${psfAssociations} ON ${psfAssociations.code} = ${orgs.psfAssociationCode}
              CROSS JOIN LATERAL unnest(${orgs.ownerGroups}) AS g(grp)
             WHERE ${base}
             GROUP BY g.grp
             ORDER BY g.grp`,
      ),
      this.db
        .select({ key: orgs.districtId, label: districts.name, count: sql<number>`count(*)::int` })
        .from(orgs)
        .leftJoin(districts, eq(districts.id, orgs.districtId))
        .where(base)
        .groupBy(orgs.districtId, districts.name)
        .orderBy(desc(sql`count(*)`), asc(districts.name)),
      this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(psfMembershipApplications)
        .innerJoin(orgs, eq(orgs.id, psfMembershipApplications.orgId))
        .where(and(base, this.inQueue())),
      this.db
        .select({ sum: sql<number>`coalesce(sum(${psfMembershipApplications.paidAmountRwf}), 0)::bigint` })
        .from(psfMembershipApplications)
        .innerJoin(orgs, eq(orgs.id, psfMembershipApplications.orgId))
        .where(
          and(
            inScope(scope),
            sql`${psfMembershipApplications.paidAt} >= ${yearStart}`,
          ),
        ),
      this.db.select({ n: sql<number>`count(*)::int` }).from(orgs).where(and(base, RENEWAL_DUE_SQL)),
      this.db
        .select({ n: sql<number>`count(*)::int`, sum: sql<number>`coalesce(sum(${psfMembershipRenewals.amountRwf}), 0)::bigint` })
        .from(psfMembershipRenewals)
        .innerJoin(orgs, eq(orgs.id, psfMembershipRenewals.orgId))
        .where(and(inScope(scope), eq(psfMembershipRenewals.status, 'paid'), sql`${psfMembershipRenewals.paidAt} >= ${yearStart}`)),
      this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(orgs)
        .where(and(ON_REGISTER_OR_UNPAID_SQL, inScope(scope), PAYMENT_DUE_SQL)),
    ]);

    const standing = byStanding.map((r) => ({ key: r.key as PsfStanding, count: r.count }));
    // node-postgres puts the rows on `.rows`; some drivers return the array.
    const groupRows = Array.isArray(byGroup)
      ? (byGroup as { key: PsfOwnerGroup; count: number }[])
      : ((byGroup as { rows?: { key: PsfOwnerGroup; count: number }[] }).rows ?? []);
    return {
      total: byDistrict.reduce((n, r) => n + r.count, 0),
      members: standing.find((s) => s.key === 'member')?.count ?? 0,
      waiting: waitingRows[0]?.n ?? 0,
      paidThisYearRwf: Number(paidRows[0]?.sum ?? 0) + Number(renewedRows[0]?.sum ?? 0),
      renewalDue: dueRows[0]?.n ?? 0,
      awaitingPayment: unpaidRows[0]?.n ?? 0,
      renewedThisYear: renewedRows[0]?.n ?? 0,
      byCluster,
      byStanding: standing,
      byGroup: groupRows.map((r) => ({ key: r.key, count: Number(r.count) })),
      byDistrict,
    };
  }

  /** A payment reminder, on the record: it is also how a second one the same day is held back. */
  async recordPaymentReminder(orgId: string, actorUserId: string, districtId: number | null): Promise<void> {
    await AuditWriter.write(this.db, {
      actorUserId,
      subjectType: 'org',
      subjectId: orgId,
      eventType: 'psf.payment.reminded',
      districtId,
    });
  }

  /** District and province names, to say an officer's region in words. */
  async regionNames(districtIds: number[], provinceIds: number[]): Promise<{
    districts: Map<number, string>;
    provinces: Map<number, string>;
  }> {
    const [d, p] = await Promise.all([
      districtIds.length
        ? this.db.select({ id: districts.id, name: districts.name }).from(districts).where(inArray(districts.id, districtIds))
        : Promise.resolve([]),
      provinceIds.length
        ? this.db.select({ id: provinces.id, name: provinces.name }).from(provinces).where(inArray(provinces.id, provinceIds))
        : Promise.resolve([]),
    ]);
    return {
      districts: new Map(d.map((r) => [r.id, r.name])),
      provinces: new Map(p.map((r) => [r.id, r.name])),
    };
  }

  /** The districts of each province, for `districtScopeOf`. */
  async districtsByProvince(provinceIds: number[]): Promise<Map<number, number[]>> {
    if (provinceIds.length === 0) return new Map();
    const rows = await this.db
      .select({ id: districts.id, provinceId: districts.provinceId })
      .from(districts)
      .where(inArray(districts.provinceId, provinceIds));
    const out = new Map<number, number[]>();
    for (const r of rows) out.set(r.provinceId, [...(out.get(r.provinceId) ?? []), r.id]);
    return out;
  }

  // --- Expiry (AC-18) ---------------------------------------------------------

  /**
   * End every confirmed membership whose expiry date is before `today`, and
   * clear the business's flag in the same transaction when nothing current is
   * left. Returns the businesses it ended, and only those, so a rerun on the
   * same day ends nothing and mails nothing.
   */
  async endExpired(today: string): Promise<{ orgId: string; membershipNumber: string }[]> {
    return this.db.transaction(async (tx) => {
      const ended = await tx
        .update(psfMemberships)
        .set({ endedAt: new Date(), updatedAt: new Date() })
        .where(and(isNull(psfMemberships.endedAt), lt(psfMemberships.expiresOn, today)))
        .returning({ orgId: psfMemberships.orgId, membershipNumber: psfMemberships.membershipNumber });
      const orgIds = [...new Set(ended.map((e) => e.orgId))];
      if (orgIds.length > 0) {
        await tx
          .update(orgs)
          .set({ psfMember: false, updatedAt: new Date() })
          .where(
            and(
              inArray(orgs.id, orgIds),
              sql`NOT EXISTS (SELECT 1 FROM ${psfMemberships} m
                               WHERE m.org_id = ${ORG_ID}
                                 AND m.ended_at IS NULL)`,
            ),
          );
      }
      return ended;
    });
  }

  /**
   * Stamp and return the memberships whose 30 day reminder is due, once each:
   * the stamp and the pick are one guarded update.
   */
  async claimExpiryReminders(
    today: string,
    horizon: string,
  ): Promise<{ orgId: string; membershipNumber: string; expiresOn: string }[]> {
    const rows = await this.db
      .update(psfMemberships)
      .set({ expiryRemindedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          isNull(psfMemberships.endedAt),
          isNull(psfMemberships.expiryRemindedAt),
          sql`${psfMemberships.expiresOn} >= ${today}`,
          sql`${psfMemberships.expiresOn} <= ${horizon}`,
        ),
      )
      .returning({
        orgId: psfMemberships.orgId,
        membershipNumber: psfMemberships.membershipNumber,
        expiresOn: psfMemberships.expiresOn,
      });
    return rows.map((r) => ({ ...r, expiresOn: r.expiresOn ?? horizon }));
  }
}
