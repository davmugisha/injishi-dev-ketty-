import {
  PSF_QUEUE_REGISTRATION_STATES,
  type Domain,
  type OrgRegistrationStatus,
  type OrgRole,
  type PsfDeclineReason,
} from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gt, inArray, isNull, lt, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import {
  districts,
  identityDocuments,
  oboRegistrations,
  orgMemberships,
  orgs,
  oversightAssignments,
  psfMembershipApplications,
  psfMembershipTiers,
  psfMemberships,
  userProfiles,
  users,
  workspaces,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import type { Tx } from '../../listing-setup/infrastructure/insert-property';

/**
 * PSF membership (ADR-056): the tier catalogue, the application as filed, and
 * the live membership. One repository for the three tables, because every
 * write that touches two of them has to happen in one transaction.
 */

export type NewPsfApplication = typeof psfMembershipApplications.$inferInsert;
export type PsfApplicationRow = typeof psfMembershipApplications.$inferSelect;
export type PsfTierRow = typeof psfMembershipTiers.$inferSelect;
export type PsfMembershipRow = typeof psfMemberships.$inferSelect;

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

/** What the applicant rule and the prefill read about a business. */
export interface PsfOrgFacts {
  id: string;
  domain: Domain;
  legalName: string;
  tin: string | null;
  addressText: string | null;
  accommodationClass: string | null;
  accommodationClassOther: string | null;
  registrationStatus: OrgRegistrationStatus;
  districtName: string | null;
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
  districtName: string | null;
  requestedTierName: string;
  submittedAt: Date;
  queuedAt: Date | null;
  sortAt: Date;
  registrationStatus: OrgRegistrationStatus;
  officerHasStake: boolean;
}

const submitter = alias(users, 'psf_submitter');

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
        districtName: districts.name,
        oboRegistrant: oboRegistrations.registrantUserId,
        oboClaimStatus: oboRegistrations.claimStatus,
        intendedOwnerName: oboRegistrations.intendedOwnerName,
        intendedOwnerNationalId: oboRegistrations.intendedOwnerNationalId,
        intendedOwnerEmail: oboRegistrations.intendedOwnerEmail,
      })
      .from(orgs)
      .leftJoin(districts, eq(districts.id, orgs.districtId))
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

  /** The business's workspace, for the links mail carries. */
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
        submittedByName: submitter.name,
      })
      .from(psfMembershipApplications)
      .innerJoin(
        psfMembershipTiers,
        eq(psfMembershipTiers.code, psfMembershipApplications.requestedTierCode),
      )
      .leftJoin(submitter, eq(submitter.id, psfMembershipApplications.submittedByUserId))
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
        name: users.name,
        phoneE164: userProfiles.phoneE164,
        dob: userProfiles.dob,
        gender: userProfiles.gender,
        nationalId: userProfiles.nationalId,
        documentType: identityDocuments.documentType,
        documentNumber: identityDocuments.documentNumber,
      })
      .from(users)
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
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

  // --- The catalogue ---------------------------------------------------------

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
        submittedByName: submitter.name,
      })
      .from(psfMembershipApplications)
      .innerJoin(
        psfMembershipTiers,
        eq(psfMembershipTiers.code, psfMembershipApplications.requestedTierCode),
      )
      .leftJoin(submitter, eq(submitter.id, psfMembershipApplications.submittedByUserId))
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

  /** Guarded: only a `submitted` application of THIS business moves. */
  async withdraw(orgId: string, applicationId: string, userId: string): Promise<boolean> {
    const moved = await this.db
      .update(psfMembershipApplications)
      .set({
        status: 'withdrawn',
        withdrawnAt: new Date(),
        withdrawnByUserId: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(psfMembershipApplications.id, applicationId),
          eq(psfMembershipApplications.orgId, orgId),
          eq(psfMembershipApplications.status, 'submitted'),
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

  /** In the queue: open, and the business past the TIN check in good standing (AC-8). */
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
    after: { sortAt: Date; id: string } | undefined,
    limit: number,
  ): Promise<{ rows: PsfQueueRow[]; more: boolean }> {
    const sortAt = this.sortAt();
    const rows = await this.db
      .select({
        applicationId: psfMembershipApplications.id,
        orgId: orgs.id,
        businessName: orgs.legalName,
        districtName: districts.name,
        requestedTierName: psfMembershipTiers.nameEn,
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
      .where(
        and(
          this.inQueue(),
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

  /** One application as the officer reads it, or null when it is not in the queue. */
  async officerApplication(
    officerUserId: string,
    applicationId: string,
  ): Promise<
    | (PsfApplicationWithNames & {
        businessName: string;
        districtName: string | null;
        registrationStatus: OrgRegistrationStatus;
        officerHasStake: boolean;
      })
    | null
  > {
    const [row] = await this.db
      .select({
        application: psfMembershipApplications,
        requestedTierName: psfMembershipTiers.nameEn,
        submittedByName: submitter.name,
        businessName: orgs.legalName,
        districtName: districts.name,
        registrationStatus: orgs.registrationStatus,
        officerHasStake: this.stakeSql(officerUserId).mapWith(Boolean),
      })
      .from(psfMembershipApplications)
      .innerJoin(orgs, eq(orgs.id, psfMembershipApplications.orgId))
      .innerJoin(
        psfMembershipTiers,
        eq(psfMembershipTiers.code, psfMembershipApplications.requestedTierCode),
      )
      .leftJoin(submitter, eq(submitter.id, psfMembershipApplications.submittedByUserId))
      .leftJoin(districts, eq(districts.id, orgs.districtId))
      .where(and(eq(psfMembershipApplications.id, applicationId), this.inQueue()))
      .limit(1);
    if (!row) return null;
    return {
      ...row.application,
      requestedTierName: row.requestedTierName,
      submittedByName: row.submittedByName,
      businessName: row.businessName,
      districtName: row.districtName,
      registrationStatus: row.registrationStatus,
      officerHasStake: row.officerHasStake,
    };
  }

  /**
   * Mark an application `member` (AC-11), as ONE transaction in the order
   * ADR-056 fixes: the guarded move first; if it moved nothing (decided,
   * withdrawn, or another officer won the race) write nothing else. Otherwise
   * end the current membership, write the confirmed one, and set the flag.
   */
  async decideMember(input: {
    applicationId: string;
    officerUserId: string;
    bodyCode: string;
    tierCode: string;
    membershipNumber: string;
    annualFeeRwf: number;
    startsOn: string;
    expiresOn: string;
  }): Promise<{ orgId: string } | null> {
    return this.db.transaction(async (tx) => {
      const now = new Date();
      const [moved] = await tx
        .update(psfMembershipApplications)
        .set({
          status: 'member',
          decidedAt: now,
          decidedByUserId: input.officerUserId,
          decisionBodyCode: input.bodyCode,
          updatedAt: now,
        })
        .where(
          and(
            eq(psfMembershipApplications.id, input.applicationId),
            eq(psfMembershipApplications.status, 'submitted'),
          ),
        )
        .returning({ orgId: psfMembershipApplications.orgId });
      if (!moved) return null;

      await tx
        .update(psfMemberships)
        .set({ endedAt: now, updatedAt: now })
        .where(and(eq(psfMemberships.orgId, moved.orgId), isNull(psfMemberships.endedAt)));
      await tx.insert(psfMemberships).values({
        orgId: moved.orgId,
        source: 'psf_confirmed',
        applicationId: input.applicationId,
        tierCode: input.tierCode,
        membershipNumber: input.membershipNumber,
        annualFeeRwf: input.annualFeeRwf,
        startsOn: input.startsOn,
        expiresOn: input.expiresOn,
        recordedByUserId: input.officerUserId,
      });
      await tx
        .update(orgs)
        .set({ psfMember: true, updatedAt: now })
        .where(eq(orgs.id, moved.orgId));
      return { orgId: moved.orgId };
    });
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

  /** Where the membership officer emails go (AC-9). */
  async membershipOfficerEmails(): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ email: users.email })
      .from(oversightAssignments)
      .innerJoin(users, eq(users.id, oversightAssignments.userId))
      .where(
        and(
          eq(oversightAssignments.oversightRole, 'psf_membership_officer'),
          isNull(oversightAssignments.revokedAt),
        ),
      );
    return rows.map((r) => r.email);
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
              sql`NOT EXISTS (SELECT 1 FROM ${psfMemberships}
                               WHERE ${psfMemberships.orgId} = ${orgs.id}
                                 AND ${psfMemberships.endedAt} IS NULL)`,
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
