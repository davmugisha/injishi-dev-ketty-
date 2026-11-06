import { Inject, Injectable } from '@nestjs/common';
import { asc, desc, eq, sql, type SQL } from 'drizzle-orm';

import {
  psfAssociations,
  psfClusters,
  psfFormFieldSettings,
  psfLevels,
  psfMembershipFormFields,
  psfMembershipTiers,
  psfSplitRates,
  psfTierFees,
  users,
} from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { PsfScope } from './psf-membership.repository';

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: T[] }).rows ?? []) as T[];
}
const n = (v: unknown): number => Number(v ?? 0);
const inScope = (column: SQL, scope: PsfScope): SQL => {
  if (scope === null) return sql`true`;
  if (scope.length === 0) return sql`false`;
  return sql`${column} IN (${sql.join(scope.map((id) => sql`${id}`), sql`, `)})`;
};

export interface PsfMoneyRow {
  districtId: number;
  districtName: string;
  provinceId: number;
  provinceName: string;
  totalRwf: number;
  districtRwf: number;
  headquartersRwf: number;
  payments: number;
  members: number;
}

/** What PSF's National Manager changes without a release (0137). */
@Injectable()
export class PsfSetupRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // --- The split -----------------------------------------------------------------

  async splitHistory(): Promise<{ districtPercent: number; setByName: string | null; at: Date }[]> {
    return this.db
      .select({ districtPercent: psfSplitRates.districtPercent, setByName: users.name, at: psfSplitRates.createdAt })
      .from(psfSplitRates)
      .leftJoin(users, eq(users.id, psfSplitRates.setByUserId))
      .orderBy(desc(psfSplitRates.createdAt))
      .limit(20);
  }

  async setSplit(districtPercent: number, userId: string): Promise<void> {
    await this.db.insert(psfSplitRates).values({ districtPercent, setByUserId: userId });
  }

  /** Every district the officer covers, with its fees in the period and its members today. */
  async money(scope: PsfScope, from: Date, to: Date, today: string): Promise<PsfMoneyRow[]> {
    const rows = rowsOf<Record<string, unknown>>(
      await this.db.execute(sql`
        SELECT d.id AS district_id, d.name AS district_name, p.id AS province_id, p.name AS province_name,
               coalesce(f.total, 0)::bigint AS total, coalesce(f.district, 0)::bigint AS district,
               coalesce(f.hq, 0)::bigint AS hq, coalesce(f.payments, 0)::int AS payments, coalesce(m.members, 0)::int AS members
          FROM districts d
          JOIN provinces p ON p.id = d.province_id
          LEFT JOIN (
            SELECT district_id, sum(amount_rwf) AS total, sum(district_rwf) AS district, sum(headquarters_rwf) AS hq,
                   count(DISTINCT source_kind || source_id::text) AS payments
              FROM psf_fee_allocations WHERE paid_at >= ${from} AND paid_at < ${to} GROUP BY district_id
          ) f ON f.district_id = d.id
          LEFT JOIN (
            SELECT o.district_id, count(DISTINCT m.org_id) AS members
              FROM psf_memberships m JOIN orgs o ON o.id = m.org_id
             WHERE m.ended_at IS NULL AND (m.expires_on IS NULL OR m.expires_on >= ${today}) GROUP BY o.district_id
          ) m ON m.district_id = d.id
         WHERE ${inScope(sql`d.id`, scope)}
         ORDER BY p.name, coalesce(f.total, 0) DESC, d.name`),
    );
    return rows.map((r) => ({
      districtId: n(r.district_id),
      districtName: String(r.district_name),
      provinceId: n(r.province_id),
      provinceName: String(r.province_name),
      totalRwf: n(r.total),
      districtRwf: n(r.district),
      headquartersRwf: n(r.hq),
      payments: n(r.payments),
      members: n(r.members),
    }));
  }

  // --- Levels and bands ----------------------------------------------------------

  levels(): Promise<(typeof psfLevels.$inferSelect)[]> {
    return this.db.select().from(psfLevels).orderBy(asc(psfLevels.sortOrder), asc(psfLevels.code));
  }

  async insertLevel(input: { code: string; nameEn: string; blurbEn: string | null; sortOrder: number; userId: string }): Promise<boolean> {
    const rows = await this.db
      .insert(psfLevels)
      .values({ code: input.code, nameEn: input.nameEn, blurbEn: input.blurbEn, sortOrder: input.sortOrder, updatedByUserId: input.userId })
      .onConflictDoNothing()
      .returning({ code: psfLevels.code });
    return rows.length > 0;
  }

  /** A level's change; retiring it retires its bands too, so nothing can be picked under it. */
  async updateLevel(code: string, patch: Partial<{ nameEn: string; blurbEn: string | null; sortOrder: number; active: boolean }>, userId: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .update(psfLevels)
        .set({ ...patch, updatedByUserId: userId, updatedAt: new Date() })
        .where(eq(psfLevels.code, code))
        .returning({ code: psfLevels.code });
      if (rows.length === 0) return false;
      if (patch.active === false) {
        await tx.update(psfMembershipTiers).set({ active: false, updatedByUserId: userId, updatedAt: new Date() }).where(eq(psfMembershipTiers.family, code));
      }
      return true;
    });
  }

  bands(): Promise<(typeof psfMembershipTiers.$inferSelect)[]> {
    return this.db.select().from(psfMembershipTiers).orderBy(asc(psfMembershipTiers.sortOrder), asc(psfMembershipTiers.code));
  }

  async bandMembers(): Promise<Map<string, number>> {
    const rows = rowsOf<Record<string, unknown>>(
      await this.db.execute(sql`SELECT tier_code, count(*)::int AS c FROM psf_memberships WHERE ended_at IS NULL GROUP BY tier_code`),
    );
    return new Map(rows.map((r) => [String(r.tier_code), n(r.c)]));
  }

  async insertBand(input: { code: string; family: string; nameEn: string; minRwf: number; maxRwf: number | null; cardBadge: string | null; sortOrder: number; userId: string }): Promise<boolean> {
    const rows = await this.db
      .insert(psfMembershipTiers)
      .values({
        code: input.code,
        family: input.family,
        nameEn: input.nameEn,
        priceKind: input.maxRwf === null ? 'minimum' : 'range',
        annualFeeMinRwf: input.minRwf,
        annualFeeMaxRwf: input.maxRwf,
        cardBadge: input.cardBadge,
        sortOrder: input.sortOrder,
        updatedByUserId: input.userId,
      })
      .onConflictDoNothing()
      .returning({ code: psfMembershipTiers.code });
    return rows.length > 0;
  }

  /**
   * A band's change. A new range clears the prices that no longer fit it, in the same transaction, so a
   * district is never left quoting a price its band refuses. Answers how many were cleared.
   */
  async updateBand(
    code: string,
    patch: { nameEn?: string; cardBadge?: string | null; minRwf?: number; maxRwf?: number | null; sortOrder?: number; active?: boolean },
    userId: string,
  ): Promise<number> {
    return this.db.transaction(async (tx) => {
      const { minRwf, maxRwf, ...rest } = patch;
      await tx
        .update(psfMembershipTiers)
        .set({
          ...rest,
          ...(minRwf !== undefined
            ? { priceKind: (maxRwf ?? null) === null ? ('minimum' as const) : ('range' as const), annualFeeRwf: null, annualFeeMinRwf: minRwf, annualFeeMaxRwf: maxRwf ?? null }
            : {}),
          updatedByUserId: userId,
          updatedAt: new Date(),
        })
        .where(eq(psfMembershipTiers.code, code));
      if (minRwf === undefined) return 0;
      const cleared = await tx
        .delete(psfTierFees)
        .where(
          sql`${psfTierFees.tierCode} = ${code} AND (${psfTierFees.annualFeeRwf} < ${minRwf}${
            (maxRwf ?? null) === null ? sql`` : sql` OR ${psfTierFees.annualFeeRwf} > ${maxRwf}`
          })`,
        )
        .returning({ tierCode: psfTierFees.tierCode });
      return cleared.length;
    });
  }

  // --- The form ------------------------------------------------------------------

  formSettings(): Promise<(typeof psfFormFieldSettings.$inferSelect)[]> {
    return this.db.select().from(psfFormFieldSettings);
  }

  async saveFormSetting(
    fieldKey: string,
    patch: Partial<{ label: string; helpText: string | null; required: boolean; visible: boolean; sortOrder: number }>,
    userId: string,
  ): Promise<void> {
    await this.db
      .insert(psfFormFieldSettings)
      .values({ fieldKey, ...patch, updatedByUserId: userId })
      .onConflictDoUpdate({ target: psfFormFieldSettings.fieldKey, set: { ...patch, updatedByUserId: userId, updatedAt: new Date() } });
  }

  extras(): Promise<(typeof psfMembershipFormFields.$inferSelect)[]> {
    return this.db.select().from(psfMembershipFormFields).orderBy(asc(psfMembershipFormFields.sortOrder), asc(psfMembershipFormFields.key));
  }

  async insertExtra(input: typeof psfMembershipFormFields.$inferInsert): Promise<boolean> {
    const rows = await this.db.insert(psfMembershipFormFields).values(input).onConflictDoNothing().returning({ id: psfMembershipFormFields.id });
    return rows.length > 0;
  }

  async updateExtra(id: string, patch: Partial<typeof psfMembershipFormFields.$inferInsert>): Promise<boolean> {
    const rows = await this.db
      .update(psfMembershipFormFields)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(psfMembershipFormFields.id, id))
      .returning({ id: psfMembershipFormFields.id });
    return rows.length > 0;
  }

  // --- The catalogue: sectors and associations ---------------------------------------

  /** A new sector, with the "other" association every sector needs for a business not on PSF's list. */
  async insertCluster(input: { code: string; nameEn: string; description: string | null; sortOrder: number; userId: string }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .insert(psfClusters)
        .values({ code: input.code, nameEn: input.nameEn, description: input.description, sortOrder: input.sortOrder, updatedByUserId: input.userId })
        .onConflictDoNothing()
        .returning({ code: psfClusters.code });
      if (rows.length === 0) return false;
      await tx
        .insert(psfAssociations)
        .values({ code: `${input.code}_other`, clusterCode: input.code, nameEn: 'Other', sortOrder: 999, updatedByUserId: input.userId })
        .onConflictDoNothing();
      return true;
    });
  }

  async updateCluster(code: string, patch: Partial<{ nameEn: string; description: string | null; sortOrder: number; active: boolean }>, userId: string): Promise<boolean> {
    const rows = await this.db
      .update(psfClusters)
      .set({ ...patch, updatedByUserId: userId, updatedAt: new Date() })
      .where(eq(psfClusters.code, code))
      .returning({ code: psfClusters.code });
    return rows.length > 0;
  }

  async insertAssociation(input: { code: string; clusterCode: string; nameEn: string; acronym: string | null; sortOrder: number; userId: string }): Promise<boolean> {
    const rows = await this.db
      .insert(psfAssociations)
      .values({ code: input.code, clusterCode: input.clusterCode, nameEn: input.nameEn, acronym: input.acronym, sortOrder: input.sortOrder, updatedByUserId: input.userId })
      .onConflictDoNothing()
      .returning({ code: psfAssociations.code });
    return rows.length > 0;
  }

  async updateAssociation(code: string, patch: Partial<{ nameEn: string; acronym: string | null; active: boolean }>, userId: string): Promise<boolean> {
    const rows = await this.db
      .update(psfAssociations)
      .set({ ...patch, updatedByUserId: userId, updatedAt: new Date() })
      .where(eq(psfAssociations.code, code))
      .returning({ code: psfAssociations.code });
    return rows.length > 0;
  }
}
