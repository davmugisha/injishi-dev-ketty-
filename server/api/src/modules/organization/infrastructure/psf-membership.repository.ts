import {
  PSF_QUEUE_REGISTRATION_STATES,
  type Domain,
  type EnterpriseRegistrationKind,
  type OrgRegistrationStatus,
  type OrgRole,
  type PsfDeclineReason,
  type PsfOwnerGroup,
  type PsfStanding,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gt, inArray, isNull, lt, or, sql, type SQL } from 'drizzle-orm';
import { alias, type AnyPgColumn } from 'drizzle-orm/pg-core';

import {
  districts,
  identityDocuments,
  oboRegistrations,
  orgMemberships,
  orgs,
  oversightAssignments,
  provinces,
  psfAssociations,
  psfClusters,
  psfMembershipApplications,
  psfMembershipTiers,
  psfMemberships,
  sectors,
  userProfiles,
  users,
  verifiedIdentities,
  workspaces,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import type { Tx } from '../../listing-setup/infrastructure/insert-property';

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

/**
 * The districts an officer may see: null for the whole country, else the ids
 * (`districtScopeOf` in `@injishi/contracts`). An empty list sees nothing.
 */
export type PsfScope = readonly number[] | null;

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
export async function insertSelfDeclaredMembership(
  tx: Tx | Database,
  row: { orgId: string; membershipNumber: string; recordedByUserId: string },
): Promise<void> {
  await tx.insert(psfMemberships).values({ ...row, source: 'self_declared' });
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
  orgId: string;
  businessName: string;
  businessCode: string | null;
  domain: Domain;
  districtName: string | null;
  associationName: string | null;
  ownerGroups: PsfOwnerGroup[];
  requestedTierName: string;
  declaredFeeRwf: number | null;
  submittedAt: Date;
  queuedAt: Date | null;
  sortAt: Date;
  registrationStatus: OrgRegistrationStatus;
  officerHasStake: boolean;
}

/** An application as the officer reads it, with the business around it. */
export type PsfOfficerApplicationRow = PsfApplicationWithNames & {
  businessName: string;
  districtName: string | null;
  registrationStatus: OrgRegistrationStatus;
  officerHasStake: boolean;
  domain: Domain;
  businessCode: string | null;
  clusterName: string | null;
  associationName: string | null;
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
}

/** The register's filters, already validated and resolved. */
export interface PsfRegisterFilter {
  q?: string;
  districtId?: number;
  clusterCode?: string;
  associationCode?: string;
  tierCode?: string;
  standing?: PsfStanding;
  group?: PsfOwnerGroup;
  tin?: 'with' | 'without';
  kind?: 'enterprise' | 'hospitality';
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

/** A business's region, as a condition. Null scope is the whole country. */
function inScope(scope: PsfScope): SQL | undefined {
  if (scope === null) return undefined;
  if (scope.length === 0) return sql`false`;
  return inArray(orgs.districtId, [...scope]);
}

/**
 * The businesses PSF's register lists: a PSF business or a hotel, past its
 * registration fee and not refused. A residence is never a PSF business.
 */
const ON_REGISTER_SQL = sql`${orgs.domain}::text IN ('enterprise', 'hospitality')
  AND ${orgs.registrationStatus} NOT IN ('pending_payment', 'rejected')`;

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
  WHEN EXISTS (SELECT 1 FROM ${psfMemberships} m WHERE m.org_id = ${ORG_ID}) THEN 'lapsed'
  WHEN (SELECT a.status FROM ${psfMembershipApplications} a
         WHERE a.org_id = ${ORG_ID} AND a.status <> 'withdrawn'
         ORDER BY a.created_at DESC LIMIT 1) = 'declined' THEN 'declined'
  ELSE 'not_applied'
END)`;

/** The current membership, or the open application, of the business on this row. */
const CURRENT_MEMBERSHIP = sql`(SELECT m.id FROM ${psfMemberships} m
  WHERE m.org_id = ${ORG_ID} AND m.ended_at IS NULL LIMIT 1)`;
const OPEN_APPLICATION = sql`(SELECT a.id FROM ${psfMembershipApplications} a
  WHERE a.org_id = ${ORG_ID} AND a.status IN ('submitted', 'approved')
  ORDER BY a.created_at DESC LIMIT 1)`;

@Injectable()
export class PsfMembershipRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

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
        associationName: psfAssociations.nameEn,
        clusterName: psfClusters.nameEn,
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
      name: row.name,
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

  async queuePage(
    officerUserId: string,
    scope: PsfScope,
    after: { sortAt: Date; id: string } | undefined,
    limit: number,
  ): Promise<{ rows: PsfQueueRow[]; more: boolean }> {
    const sortAt = this.sortAt();
    const rows = await this.db
      .select({
        applicationId: psfMembershipApplications.id,
        orgId: orgs.id,
        businessName: orgs.legalName,
        businessCode: orgs.businessCode,
        domain: orgs.domain,
        districtName: districts.name,
        associationName: psfAssociations.nameEn,
        ownerGroups: orgs.ownerGroups,
        requestedTierName: psfMembershipTiers.nameEn,
        declaredFeeRwf: psfMembershipApplications.declaredFeeRwf,
        submittedAt: psfMembershipApplications.createdAt,
        queuedAt: psfMembershipApplications.queuedAt,
        sortAt: sortAt.mapWith((v: string | Date) => new Date(v)),
        registrationStatus: orgs.registrationStatus,
        officerHasStake: this.stakeSql(officerUserId).mapWith(Boolean),
      })
      .from(psfMembershipApplications)
      .innerJoin(orgs, eq(orgs.id, psfMembershipApplications.orgId))
      .innerJoin(
        psfMembershipTiers,
        eq(psfMembershipTiers.code, psfMembershipApplications.requestedTierCode),
      )
      .leftJoin(districts, eq(districts.id, orgs.districtId))
      .leftJoin(psfAssociations, eq(psfAssociations.code, orgs.psfAssociationCode))
      .where(
        and(
          this.inQueue(),
          inScope(scope),
          // Oldest first, so the cursor moves forward in time.
          after
            ? or(
                gt(sortAt, after.sortAt),
                and(sql`${sortAt} = ${after.sortAt}`, gt(psfMembershipApplications.id, after.id)),
              )
            : undefined,
        ),
      )
      .orderBy(asc(sortAt), asc(psfMembershipApplications.id))
      .limit(limit + 1);
    return { rows: rows.slice(0, limit), more: rows.length > limit };
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
  ): Promise<PsfOfficerApplicationRow | null> {
    const [row] = await this.db
      .select({
        application: psfMembershipApplications,
        requestedTierName: psfMembershipTiers.nameEn,
        submittedByName,
        businessName: orgs.legalName,
        districtName: districts.name,
        registrationStatus: orgs.registrationStatus,
        officerHasStake: this.stakeSql(officerUserId).mapWith(Boolean),
        domain: orgs.domain,
        businessCode: orgs.businessCode,
        clusterName: psfClusters.nameEn,
        associationName: psfAssociations.nameEn,
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
      .where(
        and(
          eq(psfMembershipApplications.id, applicationId),
          OPEN_STATUS_SQL,
          inArray(orgs.registrationStatus, [...PSF_QUEUE_REGISTRATION_STATES]),
          inScope(scope),
        ),
      )
      .limit(1);
    if (!row) return null;
    const { application, ...rest } = row;
    return { ...application, ...rest };
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
      ON_REGISTER_SQL,
      inScope(scope),
      f.districtId !== undefined ? eq(orgs.districtId, f.districtId) : undefined,
      f.associationCode ? eq(orgs.psfAssociationCode, f.associationCode) : undefined,
      f.clusterCode ? eq(psfAssociations.clusterCode, f.clusterCode) : undefined,
      f.group ? sql`${f.group}::psf_owner_group = ANY(${orgs.ownerGroups})` : undefined,
      f.tin === 'with' ? sql`${orgs.tin} IS NOT NULL` : f.tin === 'without' ? sql`${orgs.tin} IS NULL` : undefined,
      f.kind ? sql`${orgs.domain}::text = ${f.kind}` : undefined,
      f.standing ? sql`${STANDING_SQL} = ${f.standing}` : undefined,
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
        associationName: psfAssociations.nameEn,
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
      })
      .from(orgs)
      .leftJoin(districts, eq(districts.id, orgs.districtId))
      .leftJoin(sectors, eq(sectors.id, orgs.sectorId))
      .leftJoin(psfAssociations, eq(psfAssociations.code, orgs.psfAssociationCode))
      .leftJoin(psfClusters, eq(psfClusters.code, psfAssociations.clusterCode))
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
      rows: rows.slice(0, limit).map((r) => ({ ...r, standing: r.standing as PsfStanding })),
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
    byCluster: { key: string | null; label: string | null; count: number }[];
    byStanding: { key: PsfStanding; count: number }[];
    byGroup: { key: PsfOwnerGroup; count: number }[];
    byDistrict: { key: number | null; label: string | null; count: number }[];
  }> {
    const base = and(ON_REGISTER_SQL, inScope(scope));

    const [byCluster, byStanding, byGroup, byDistrict, waitingRows, paidRows] = await Promise.all([
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
      paidThisYearRwf: Number(paidRows[0]?.sum ?? 0),
      byCluster,
      byStanding: standing,
      byGroup: groupRows.map((r) => ({ key: r.key, count: Number(r.count) })),
      byDistrict,
    };
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
