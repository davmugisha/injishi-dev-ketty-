import { Inject, Injectable } from '@nestjs/common';
import { provinceWords } from '@injishi/contracts';
import { and, asc, count, eq, isNull, ne, sql } from 'drizzle-orm';

import {
  landlordProfiles,
  orgMemberships,
  orgs,
  payoutAccounts,
  properties,
  rentalUnits,
  users,
} from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { ResidenceWorkspace } from '../domain/residence';
import type { DbOrTx } from './rentals-writers';

export type LandlordProfileRow = typeof landlordProfiles.$inferSelect;

/** The business as the contract and the setup steps read it. */
export interface LandlordOrgRow {
  legalName: string;
  tin: string | null;
  districtId: number | null;
  sectorId: number | null;
  villageId: number | null;
  addressText: string | null;
}

/** A building of the business: a `properties` row. */
export interface BuildingRow {
  id: string;
  name: string;
  sectorId: number | null;
  villageId: number | null;
  districtId: number | null;
  addressText: string | null;
}

/** Where a building is, by name, down to the village. */
export interface BuildingPlaceRow {
  name: string;
  addressText: string | null;
  village: string | null;
  cell: string | null;
  sector: string | null;
  district: string | null;
  province: string | null;
}

/**
 * The landlord's own records: the rentals profile, the business, and its
 * buildings. Both the profile and the first building are made the first time
 * a rentals route needs them, because a residence registration makes neither
 * (it has no branches, and the profile table is newer than every business
 * registered before migration 0074 backfilled it).
 */
@Injectable()
export class RentalsContextRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** The profile of the business with this workspace, when it has one. */
  async profileByWorkspace(workspaceId: string, db: DbOrTx = this.db): Promise<LandlordProfileRow | null> {
    const [row] = await db.select().from(landlordProfiles).where(eq(landlordProfiles.workspaceId, workspaceId)).limit(1);
    return row ?? null;
  }

  /** The landlord's profile, made with the starting defaults if it is missing. Idempotent. */
  async ensureProfile(r: ResidenceWorkspace): Promise<LandlordProfileRow> {
    await this.db
      .insert(landlordProfiles)
      .values({ orgId: r.orgId, workspaceId: r.workspaceId })
      .onConflictDoNothing({ target: landlordProfiles.orgId });
    const [row] = await this.db.select().from(landlordProfiles).where(eq(landlordProfiles.orgId, r.orgId)).limit(1);
    if (!row) throw new Error(`landlord profile for ${r.orgId} vanished`);
    return row;
  }

  async updateProfile(
    tx: DbOrTx,
    orgId: string,
    values: Partial<Omit<LandlordProfileRow, 'orgId' | 'workspaceId' | 'createdAt'>>,
  ): Promise<void> {
    await tx
      .update(landlordProfiles)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(landlordProfiles.orgId, orgId));
  }

  /** Mark setup finished, once. */
  async markSetupComplete(orgId: string): Promise<Date> {
    const now = new Date();
    await this.db
      .update(landlordProfiles)
      .set({ setupCompletedAt: now, updatedAt: now })
      .where(and(eq(landlordProfiles.orgId, orgId), isNull(landlordProfiles.setupCompletedAt)));
    return now;
  }

  async org(orgId: string): Promise<LandlordOrgRow> {
    const [row] = await this.db
      .select({
        legalName: orgs.legalName,
        tin: orgs.tin,
        districtId: orgs.districtId,
        sectorId: orgs.sectorId,
        villageId: orgs.villageId,
        addressText: orgs.addressText,
      })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1);
    if (!row) throw new Error(`org ${orgId} vanished`);
    return row;
  }

  /** The owner's name and account email: what the contract falls back to before a signatory is set. */
  async ownerContact(orgId: string): Promise<{ name: string | null; email: string } | null> {
    const [row] = await this.db
      .select({ name: users.name, email: users.email })
      .from(orgMemberships)
      .innerJoin(users, eq(users.id, orgMemberships.userId))
      .where(and(eq(orgMemberships.orgId, orgId), eq(orgMemberships.orgRole, 'owner'), eq(orgMemberships.status, 'active')))
      .orderBy(asc(orgMemberships.createdAt))
      .limit(1);
    return row ?? null;
  }

  /** The business's buildings that are not archived, oldest first. */
  async buildings(workspaceId: string): Promise<BuildingRow[]> {
    return this.db
      .select({
        id: properties.id,
        name: properties.name,
        sectorId: properties.sectorId,
        villageId: properties.villageId,
        districtId: properties.districtId,
        addressText: properties.addressText,
      })
      .from(properties)
      .where(and(eq(properties.workspaceId, workspaceId), isNull(properties.archivedAt)))
      .orderBy(asc(properties.createdAt), asc(properties.id));
  }

  /**
   * The business's first building, made from its registered name and address
   * when it has none. Serialised per org with an advisory lock, so two first
   * requests at once make one building, not two.
   */
  async ensureBuilding(r: ResidenceWorkspace): Promise<BuildingRow> {
    const existing = await this.buildings(r.workspaceId);
    if (existing[0]) return existing[0];
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`rentals-building:${r.orgId}`}))`);
      const [again] = await tx
        .select({ id: properties.id })
        .from(properties)
        .where(and(eq(properties.workspaceId, r.workspaceId), isNull(properties.archivedAt)))
        .limit(1);
      if (!again) {
        const [org] = await tx
          .select({
            legalName: orgs.legalName,
            districtId: orgs.districtId,
            sectorId: orgs.sectorId,
            villageId: orgs.villageId,
            addressText: orgs.addressText,
          })
          .from(orgs)
          .where(eq(orgs.id, r.orgId))
          .limit(1);
        if (!org) throw new Error(`org ${r.orgId} vanished`);
        await tx.insert(properties).values({
          orgId: r.orgId,
          workspaceId: r.workspaceId,
          name: org.legalName,
          sectorId: org.sectorId,
          villageId: org.villageId,
          districtId: org.districtId,
          addressText: org.addressText,
          isHeadOffice: true,
        });
      }
      const [row] = await tx
        .select({
          id: properties.id,
          name: properties.name,
          sectorId: properties.sectorId,
          villageId: properties.villageId,
          districtId: properties.districtId,
          addressText: properties.addressText,
        })
        .from(properties)
        .where(and(eq(properties.workspaceId, r.workspaceId), isNull(properties.archivedAt)))
        .orderBy(asc(properties.createdAt), asc(properties.id))
        .limit(1);
      if (!row) throw new Error(`building for ${r.orgId} vanished`);
      return row;
    });
  }

  /** A building's place by name, from its village up (or its sector, with no village). */
  async buildingPlace(propertyId: string): Promise<BuildingPlaceRow | null> {
    const { rows } = await this.db.execute<{
      name: string;
      address_text: string | null;
      village: string | null;
      cell: string | null;
      sector: string | null;
      district: string | null;
      province: string | null;
    }>(sql`
      select p.name, p.address_text, v.name as village, c.name as cell, s.name as sector,
             d.name as district, pr.name as province
        from properties p
        left join villages v on v.id = p.village_id
        left join cells c on c.id = v.cell_id
        left join sectors s on s.id = coalesce(c.sector_id, p.sector_id)
        left join districts d on d.id = coalesce(s.district_id, p.district_id)
        left join provinces pr on pr.id = d.province_id
       where p.id = ${propertyId}
    `);
    const row = rows[0];
    if (!row) return null;
    return {
      name: row.name,
      addressText: row.address_text,
      village: row.village,
      cell: row.cell,
      sector: row.sector,
      district: row.district,
      province: row.province ? provinceWords(row.province) : null,
    };
  }

  /** Units that are not retired, for the setup steps. */
  async unitCount(workspaceId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(rentalUnits)
      .where(and(eq(rentalUnits.workspaceId, workspaceId), ne(rentalUnits.state, 'retired')));
    return Number(row?.n ?? 0);
  }

  /** The active primary payout account, for the setup steps. */
  async primaryPayoutAccount(orgId: string): Promise<typeof payoutAccounts.$inferSelect | null> {
    const [row] = await this.db
      .select()
      .from(payoutAccounts)
      .where(and(eq(payoutAccounts.orgId, orgId), eq(payoutAccounts.status, 'active'), eq(payoutAccounts.isPrimary, true)))
      .limit(1);
    return row ?? null;
  }
}
