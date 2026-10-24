import type { EnterpriseRegistrationKind, OrgRegistrationStatus, PsfDeclineReason, PsfMembershipFamily, PsfOwnerGroup } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gt, isNull, sql } from 'drizzle-orm';

import {
  districts,
  orgRegistrationEvents,
  orgs,
  provinces,
  psfAssociations,
  psfClusters,
  psfIdentityChecks,
  psfMembershipApplications,
  psfMembershipTiers,
  psfMemberships,
  psfSubsectors,
  sectors,
  subscriptionInvoices,
} from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';

export type PsfIdentityCheckRow = typeof psfIdentityChecks.$inferSelect;

/** Everything the tracking page is built from, read by docID. */
export interface PsfTrackRow {
  applicationId: string;
  orgId: string;
  docId: string;
  /** The business's logo (2026-10-23), when it gave one. */
  logoObjectKey: string | null;
  status: 'submitted' | 'approved' | 'member' | 'declined' | 'withdrawn';
  createdAt: Date;
  queuedAt: Date | null;
  decidedAt: Date | null;
  declineReason: PsfDeclineReason | null;
  decisionNote: string | null;
  approvedMembershipNumber: string | null;
  approvedFeeRwf: number | null;
  paidAt: Date | null;
  paidAmountRwf: number | null;
  paymentRef: string | null;
  withdrawnAt: Date | null;
  declaredFeeRwf: number | null;
  firstName: string;
  lastName: string;
  phoneE164: string;
  applicantPhoneE164: string | null;
  applicantEmail: string | null;
  email: string;
  tierName: string;
  tierFamily: PsfMembershipFamily;
  businessName: string;
  businessCode: string | null;
  registrationStatus: OrgRegistrationStatus;
  registrationKind: EnterpriseRegistrationKind | null;
  ownerGroups: PsfOwnerGroup[];
  districtId: number | null;
  districtName: string | null;
  provinceName: string | null;
  sectorName: string | null;
  clusterName: string | null;
  subsectorName: string | null;
  associationName: string | null;
}

/**
 * The public PSF path's own reads and writes (2026-10-19): the National ID
 * checks the form runs before submit, and the application as its docID
 * finds it. Everything an officer reads stays in `PsfMembershipRepository`.
 */
@Injectable()
export class PsfPublicRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // --- National ID checks ----------------------------------------------------

  async createCheck(input: { documentNumber: string; codeHash: string; codeExpiresAt: Date }): Promise<string> {
    const [row] = await this.db.insert(psfIdentityChecks).values(input).returning({ id: psfIdentityChecks.id });
    if (!row) throw new Error('Identity check insert returned no row.');
    return row.id;
  }

  async check(id: string): Promise<PsfIdentityCheckRow | null> {
    const [row] = await this.db.select().from(psfIdentityChecks).where(eq(psfIdentityChecks.id, id)).limit(1);
    return row ?? null;
  }

  async countWrongAttempt(id: string): Promise<void> {
    await this.db
      .update(psfIdentityChecks)
      .set({ attempts: sql`${psfIdentityChecks.attempts} + 1`, updatedAt: new Date() })
      .where(eq(psfIdentityChecks.id, id));
  }

  async deleteCheck(id: string): Promise<void> {
    await this.db.delete(psfIdentityChecks).where(eq(psfIdentityChecks.id, id));
  }

  /** The code was right: keep who the register named, and the token the submit spends. */
  async verifyCheck(id: string, input: {
    person: NonNullable<PsfIdentityCheckRow['person']>;
    tokenHash: string;
    tokenExpiresAt: Date;
  }): Promise<void> {
    await this.db
      .update(psfIdentityChecks)
      .set({ ...input, verifiedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(psfIdentityChecks.id, id), isNull(psfIdentityChecks.verifiedAt)));
  }

  /** A verified, unspent, unexpired check for this token, or null. */
  async checkByToken(tokenHash: string): Promise<PsfIdentityCheckRow | null> {
    const [row] = await this.db
      .select()
      .from(psfIdentityChecks)
      .where(
        and(
          eq(psfIdentityChecks.tokenHash, tokenHash),
          isNull(psfIdentityChecks.spentAt),
          gt(psfIdentityChecks.tokenExpiresAt, new Date()),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /** Whether a logo key is already some business's: a key is used by one business only. */
  async logoInUse(objectKey: string): Promise<boolean> {
    const [row] = await this.db.select({ id: orgs.id }).from(orgs).where(eq(orgs.logoObjectKey, objectKey)).limit(1);
    return Boolean(row);
  }

  /** Spend a token, once: false when another submit spent it first. */
  async spendCheck(id: string): Promise<boolean> {
    const rows = await this.db
      .update(psfIdentityChecks)
      .set({ spentAt: new Date(), updatedAt: new Date() })
      .where(and(eq(psfIdentityChecks.id, id), isNull(psfIdentityChecks.spentAt)))
      .returning({ id: psfIdentityChecks.id });
    return rows.length > 0;
  }

  /** Give a token back when the submit it was spent on wrote nothing. */
  async unspendCheck(id: string): Promise<void> {
    await this.db.update(psfIdentityChecks).set({ spentAt: null, updatedAt: new Date() }).where(eq(psfIdentityChecks.id, id));
  }

  /** Checks older than a day hold a person's name for no reason: the sweep drops them. */
  async purgeOldChecks(): Promise<number> {
    const rows = await this.db
      .delete(psfIdentityChecks)
      .where(sql`${psfIdentityChecks.createdAt} < now() - interval '1 day'`)
      .returning({ id: psfIdentityChecks.id });
    return rows.length;
  }

  // --- The application, by docID ---------------------------------------------

  async byDocId(docId: string): Promise<PsfTrackRow | null> {
    const [row] = await this.db
      .select({
        applicationId: psfMembershipApplications.id,
        orgId: orgs.id,
        docId: psfMembershipApplications.docId,
        status: psfMembershipApplications.status,
        createdAt: psfMembershipApplications.createdAt,
        queuedAt: psfMembershipApplications.queuedAt,
        decidedAt: psfMembershipApplications.decidedAt,
        declineReason: psfMembershipApplications.declineReason,
        decisionNote: psfMembershipApplications.decisionNote,
        approvedMembershipNumber: psfMembershipApplications.approvedMembershipNumber,
        approvedFeeRwf: psfMembershipApplications.approvedFeeRwf,
        paidAt: psfMembershipApplications.paidAt,
        paidAmountRwf: psfMembershipApplications.paidAmountRwf,
        paymentRef: psfMembershipApplications.paymentRef,
        withdrawnAt: psfMembershipApplications.withdrawnAt,
        declaredFeeRwf: psfMembershipApplications.declaredFeeRwf,
        firstName: psfMembershipApplications.firstName,
        lastName: psfMembershipApplications.lastName,
        phoneE164: psfMembershipApplications.phoneE164,
        applicantPhoneE164: psfMembershipApplications.applicantPhoneE164,
        applicantEmail: psfMembershipApplications.applicantEmail,
        email: psfMembershipApplications.email,
        tierName: psfMembershipTiers.nameEn,
        tierFamily: psfMembershipTiers.family,
        businessName: orgs.legalName,
        logoObjectKey: orgs.logoObjectKey,
        businessCode: orgs.businessCode,
        registrationStatus: orgs.registrationStatus,
        registrationKind: orgs.registrationKind,
        ownerGroups: orgs.ownerGroups,
        districtId: orgs.districtId,
        districtName: districts.name,
        provinceName: provinces.name,
        sectorName: sectors.name,
        clusterName: psfClusters.nameEn,
        subsectorName: sql<string | null>`coalesce(${orgs.psfSubsectorOther}, ${psfSubsectors.nameEn})`,
        // The name a business typed, when PSF's list did not have its association.
        associationName: sql<string | null>`coalesce(${orgs.psfAssociationOther}, ${psfAssociations.nameEn})`,
      })
      .from(psfMembershipApplications)
      .innerJoin(orgs, eq(orgs.id, psfMembershipApplications.orgId))
      .innerJoin(psfMembershipTiers, eq(psfMembershipTiers.code, psfMembershipApplications.requestedTierCode))
      .leftJoin(districts, eq(districts.id, orgs.districtId))
      .leftJoin(provinces, eq(provinces.id, districts.provinceId))
      .leftJoin(sectors, eq(sectors.id, orgs.sectorId))
      .leftJoin(psfAssociations, eq(psfAssociations.code, orgs.psfAssociationCode))
      .leftJoin(psfClusters, eq(psfClusters.code, psfAssociations.clusterCode))
      .leftJoin(psfSubsectors, eq(psfSubsectors.id, orgs.psfSubsectorId))
      .where(eq(psfMembershipApplications.docId, docId))
      .limit(1);
    return row ?? null;
  }

  /** The membership an application became, when it became one. */
  async membershipFor(applicationId: string): Promise<{
    membershipNumber: string;
    annualFeeRwf: number | null;
    startsOn: string | null;
    expiresOn: string | null;
    endedAt: Date | null;
  } | null> {
    const [row] = await this.db
      .select({
        membershipNumber: psfMemberships.membershipNumber,
        annualFeeRwf: psfMemberships.annualFeeRwf,
        startsOn: psfMemberships.startsOn,
        expiresOn: psfMemberships.expiresOn,
        endedAt: psfMemberships.endedAt,
      })
      .from(psfMemberships)
      .where(eq(psfMemberships.applicationId, applicationId))
      .limit(1);
    return row ?? null;
  }

  /** When the business's registration fee was paid, and how much it was. */
  async registrationFee(orgId: string): Promise<{ amountRwf: number; status: string; paidAt: Date | null } | null> {
    const [invoice] = await this.db
      .select({ amountRwf: subscriptionInvoices.amountRwf, status: subscriptionInvoices.status, updatedAt: subscriptionInvoices.updatedAt })
      .from(subscriptionInvoices)
      .where(and(eq(subscriptionInvoices.orgId, orgId), eq(subscriptionInvoices.invoiceKind, 'registration_fee')))
      .limit(1);
    if (!invoice) return null;
    return { amountRwf: invoice.amountRwf ?? 0, status: invoice.status, paidAt: invoice.status === 'paid' ? invoice.updatedAt : null };
  }

  /** The business's registration moves, oldest first, for the timeline. */
  async registrationEvents(orgId: string): Promise<{ to: OrgRegistrationStatus; at: Date }[]> {
    const rows = await this.db
      .select({ to: orgRegistrationEvents.toStatus, at: orgRegistrationEvents.occurredAt })
      .from(orgRegistrationEvents)
      .where(eq(orgRegistrationEvents.orgId, orgId))
      .orderBy(asc(orgRegistrationEvents.occurredAt));
    return rows;
  }
}
