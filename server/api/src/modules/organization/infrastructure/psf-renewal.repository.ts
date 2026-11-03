import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm';

import {
  orgs,
  psfMembershipApplications,
  psfMembershipRenewals,
  psfMembershipTiers,
  psfMemberships,
} from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';

export type PsfRenewalRow = typeof psfMembershipRenewals.$inferSelect;
export type PsfLatestMembership = typeof psfMemberships.$inferSelect & { tierName: string | null };

/**
 * PSF membership renewals (2026-11-02, migration 0126). A renewal is one row
 * per attempt; a paid one either extends the current membership (renewed
 * early) or opens a new one under the same number (renewed after it lapsed).
 */
@Injectable()
export class PsfRenewalRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * The docID and phone a membership number reaches (2026-11-02): its newest membership row, the
   * application it stands on (else the business's newest one), and the phone that application gave.
   */
  async trackingByMembershipNumber(membershipNumber: string): Promise<{ docId: string; phoneE164: string | null } | null> {
    const [m] = await this.db
      .select({ orgId: psfMemberships.orgId, applicationId: psfMemberships.applicationId })
      .from(psfMemberships)
      .where(sql`upper(${psfMemberships.membershipNumber}) = ${membershipNumber}`)
      .orderBy(desc(psfMemberships.createdAt))
      .limit(1);
    if (!m) return null;
    const [app] = await this.db
      .select({
        docId: psfMembershipApplications.docId,
        phone: sql<string | null>`coalesce(${psfMembershipApplications.applicantPhoneE164}, ${psfMembershipApplications.phoneE164})`,
      })
      .from(psfMembershipApplications)
      .where(eq(psfMembershipApplications.orgId, m.orgId))
      .orderBy(sql`${psfMembershipApplications.id} = ${m.applicationId ?? sql`NULL`} DESC NULLS LAST`, desc(psfMembershipApplications.createdAt))
      .limit(1);
    return app ? { docId: app.docId, phoneE164: app.phone } : null;
  }

  /** A business by its code (2026-11-02), old `GIS0005` or new `GIS-4K7Q-92`: its newest application's docID and phone. */
  async trackingByBusinessCode(businessCode: string): Promise<{ docId: string; phoneE164: string | null } | null> {
    const [app] = await this.db
      .select({
        docId: psfMembershipApplications.docId,
        phone: sql<string | null>`coalesce(${psfMembershipApplications.applicantPhoneE164}, ${psfMembershipApplications.phoneE164})`,
      })
      .from(psfMembershipApplications)
      .innerJoin(orgs, eq(orgs.id, psfMembershipApplications.orgId))
      .where(eq(orgs.businessCode, businessCode))
      .orderBy(desc(psfMembershipApplications.createdAt))
      .limit(1);
    return app ? { docId: app.docId, phoneE164: app.phone } : null;
  }

  /** The business's newest membership, current or ended. */
  async latestMembership(orgId: string): Promise<PsfLatestMembership | null> {
    const [row] = await this.db
      .select({ membership: psfMemberships, tierName: psfMembershipTiers.nameEn })
      .from(psfMemberships)
      .leftJoin(psfMembershipTiers, eq(psfMembershipTiers.code, psfMemberships.tierCode))
      .where(eq(psfMemberships.orgId, orgId))
      .orderBy(desc(psfMemberships.createdAt))
      .limit(1);
    return row ? { ...row.membership, tierName: row.tierName } : null;
  }

  async pending(orgId: string): Promise<(PsfRenewalRow & { tierName: string }) | null> {
    const [row] = await this.db
      .select({ renewal: psfMembershipRenewals, tierName: psfMembershipTiers.nameEn })
      .from(psfMembershipRenewals)
      .innerJoin(psfMembershipTiers, eq(psfMembershipTiers.code, psfMembershipRenewals.tierCode))
      .where(and(eq(psfMembershipRenewals.orgId, orgId), eq(psfMembershipRenewals.status, 'pending')))
      .limit(1);
    return row ? { ...row.renewal, tierName: row.tierName } : null;
  }

  /**
   * A new attempt. A prompt still pending for another band or amount is given
   * up first, so the one-pending index holds and the new charge has its own key.
   */
  async start(input: {
    orgId: string;
    membershipId: string;
    applicationId: string | null;
    membershipNumber: string;
    tierCode: string;
    amountRwf: number;
    payerPhoneE164: string;
    startsOn: string;
    expiresOn: string;
  }): Promise<PsfRenewalRow> {
    return this.db.transaction(async (tx) => {
      await tx
        .update(psfMembershipRenewals)
        .set({ status: 'failed', failure: 'Replaced by a new renewal.', updatedAt: new Date() })
        .where(and(eq(psfMembershipRenewals.orgId, input.orgId), eq(psfMembershipRenewals.status, 'pending')));
      const [row] = await tx.insert(psfMembershipRenewals).values(input).returning();
      return row!;
    });
  }

  async fail(id: string, failure: string): Promise<void> {
    await this.db
      .update(psfMembershipRenewals)
      .set({ status: 'failed', failure, updatedAt: new Date() })
      .where(and(eq(psfMembershipRenewals.id, id), eq(psfMembershipRenewals.status, 'pending')));
  }

  /**
   * Settle a paid renewal, once: the guarded `pending → paid` move decides
   * which caller applies it. A membership still current is extended in place
   * (band, fee and end date; the 30 day reminder is armed again); one that
   * ended gets a new row under the same number, of the same kind.
   */
  async applyPaid(input: {
    renewalId: string;
    paidAt: Date;
    paymentRef: string;
    paymentMode: 'mock' | 'live';
  }): Promise<PsfRenewalRow | null> {
    return this.db.transaction(async (tx) => {
      const [renewal] = await tx
        .select()
        .from(psfMembershipRenewals)
        .where(and(eq(psfMembershipRenewals.id, input.renewalId), eq(psfMembershipRenewals.status, 'pending')))
        .for('update');
      if (!renewal) return null;
      const [renewed] = await tx.select().from(psfMemberships).where(eq(psfMemberships.id, renewal.membershipId));
      if (!renewed) return null;

      let resultId: string;
      // Extended in place only when the year runs straight on; a membership past
      // its end date that the sweep has not ended yet starts again, gap and all.
      const continuous = !renewed.endedAt && renewed.expiresOn !== null && renewal.startsOn === dayAfter(renewed.expiresOn);
      if (continuous) {
        await tx
          .update(psfMemberships)
          .set({
            tierCode: renewal.tierCode,
            annualFeeRwf: renewal.amountRwf,
            expiresOn: renewal.expiresOn,
            expiryRemindedAt: null,
            updatedAt: input.paidAt,
          })
          .where(eq(psfMemberships.id, renewed.id));
        resultId = renewed.id;
      } else {
        // Another membership may have started since (a new application): it stands, and this one ends it.
        await tx
          .update(psfMemberships)
          .set({ endedAt: input.paidAt, updatedAt: input.paidAt })
          .where(and(eq(psfMemberships.orgId, renewal.orgId), isNull(psfMemberships.endedAt)));
        const [created] = await tx
          .insert(psfMemberships)
          .values({
            orgId: renewal.orgId,
            source: renewed.source,
            applicationId: renewed.applicationId,
            tierCode: renewal.tierCode,
            membershipNumber: renewal.membershipNumber,
            annualFeeRwf: renewal.amountRwf,
            startsOn: renewal.startsOn,
            expiresOn: renewal.expiresOn,
            recordedByUserId: renewed.recordedByUserId,
          })
          .returning({ id: psfMemberships.id });
        resultId = created!.id;
      }
      await tx.update(orgs).set({ psfMember: true, updatedAt: input.paidAt }).where(eq(orgs.id, renewal.orgId));
      const [paid] = await tx
        .update(psfMembershipRenewals)
        .set({
          status: 'paid',
          paidAt: input.paidAt,
          paymentRef: input.paymentRef,
          paymentMode: input.paymentMode,
          resultMembershipId: resultId,
          failure: null,
          updatedAt: input.paidAt,
        })
        .where(eq(psfMembershipRenewals.id, renewal.id))
        .returning();
      return paid ?? null;
    });
  }

  async recordRemittance(id: string, ref: string): Promise<void> {
    await this.db
      .update(psfMembershipRenewals)
      .set({ remittedAt: new Date(), remittanceRef: ref, updatedAt: new Date() })
      .where(and(eq(psfMembershipRenewals.id, id), eq(psfMembershipRenewals.status, 'paid')));
  }

  /** Every paid renewal of one business, newest first. */
  async paidOf(orgId: string): Promise<(PsfRenewalRow & { tierName: string })[]> {
    const rows = await this.db
      .select({ renewal: psfMembershipRenewals, tierName: psfMembershipTiers.nameEn })
      .from(psfMembershipRenewals)
      .innerJoin(psfMembershipTiers, eq(psfMembershipTiers.code, psfMembershipRenewals.tierCode))
      .where(and(eq(psfMembershipRenewals.orgId, orgId), eq(psfMembershipRenewals.status, 'paid')))
      .orderBy(desc(psfMembershipRenewals.paidAt));
    return rows.map((r) => ({ ...r.renewal, tierName: r.tierName }));
  }

  /** Paid renewals between two Kigali dates, inclusive, for the consoles. */
  async paidBetween(from: string, to: string): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(psfMembershipRenewals)
      .where(
        and(
          eq(psfMembershipRenewals.status, 'paid'),
          gte(sql`(${psfMembershipRenewals.paidAt} AT TIME ZONE 'Africa/Kigali')::date`, from),
          lte(sql`(${psfMembershipRenewals.paidAt} AT TIME ZONE 'Africa/Kigali')::date`, to),
        ),
      );
    return row?.n ?? 0;
  }
}

function dayAfter(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}
