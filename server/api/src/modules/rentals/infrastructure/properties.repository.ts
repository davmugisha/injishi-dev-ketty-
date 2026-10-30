import { Inject, Injectable } from '@nestjs/common';
import { provinceWords } from '@injishi/contracts';
import { and, eq, sql } from 'drizzle-orm';

import { leases, properties } from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { BuildingIds } from './rentals-overview.repository';

/** A building with where it is, level by level, as far as it is known. */
export interface PropertyPlaceRow {
  id: string;
  name: string;
  street: string | null;
  province: { id: number; name: string } | null;
  district: { id: number; name: string } | null;
  sector: { id: number; name: string } | null;
  cell: { id: number; name: string } | null;
  village: { id: number; name: string } | null;
  units: number;
}

/** Where a village sits, all the way up. */
export interface VillageChain {
  villageId: number;
  cellId: number;
  sectorId: number;
  districtId: number;
  provinceId: number;
}

/**
 * The landlord's buildings (`properties`) and where they are (blueprint 2.3,
 * `PUT properties/:id/location`). A building stores its village, sector and
 * district; the cell and province are read through the village.
 */
@Injectable()
export class PropertiesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(workspaceId: string, buildings: BuildingIds): Promise<PropertyPlaceRow[]> {
    const scope =
      buildings === null
        ? sql``
        : buildings.length === 0
          ? sql`and false`
          : sql`and p.id in (${sql.join(
              buildings.map((id) => sql`${id}::uuid`),
              sql`, `,
            )})`;
    const { rows } = await this.db.execute<{
      id: string;
      name: string;
      street: string | null;
      province_id: number | null;
      province: string | null;
      district_id: number | null;
      district: string | null;
      sector_id: number | null;
      sector: string | null;
      cell_id: number | null;
      cell: string | null;
      village_id: number | null;
      village: string | null;
      units: number;
    }>(sql`
      select p.id, p.name, p.address_text as street,
             pr.id as province_id, pr.name as province,
             d.id as district_id, d.name as district,
             s.id as sector_id, s.name as sector,
             c.id as cell_id, c.name as cell,
             v.id as village_id, v.name as village,
             (select count(*)::int from rental_units u where u.property_id = p.id and u.state <> 'retired') as units
        from properties p
        left join villages v on v.id = p.village_id
        left join cells c on c.id = v.cell_id
        left join sectors s on s.id = coalesce(c.sector_id, p.sector_id)
        left join districts d on d.id = coalesce(s.district_id, p.district_id)
        left join provinces pr on pr.id = d.province_id
       where p.workspace_id = ${workspaceId} and p.archived_at is null ${scope}
       order by p.created_at, p.id
    `);
    const ref = (id: number | null, name: string | null): { id: number; name: string } | null => (id !== null && name !== null ? { id: Number(id), name } : null);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      street: r.street,
      province: ref(r.province_id, r.province ? provinceWords(r.province) : null),
      district: ref(r.district_id, r.district),
      sector: ref(r.sector_id, r.sector),
      cell: ref(r.cell_id, r.cell),
      village: ref(r.village_id, r.village),
      units: Number(r.units),
    }));
  }

  /** The village's cell, sector, district and province, or null for an id no village has. */
  async villageChain(villageId: number): Promise<VillageChain | null> {
    const { rows } = await this.db.execute<{
      village_id: number;
      cell_id: number;
      sector_id: number;
      district_id: number;
      province_id: number;
    }>(sql`
      select v.id as village_id, c.id as cell_id, s.id as sector_id, d.id as district_id, d.province_id
        from villages v
        join cells c on c.id = v.cell_id
        join sectors s on s.id = c.sector_id
        join districts d on d.id = s.district_id
       where v.id = ${villageId}
    `);
    const row = rows[0];
    if (!row) return null;
    return {
      villageId: Number(row.village_id),
      cellId: Number(row.cell_id),
      sectorId: Number(row.sector_id),
      districtId: Number(row.district_id),
      provinceId: Number(row.province_id),
    };
  }

  async setLocation(
    propertyId: string,
    values: { villageId: number; sectorId: number; districtId: number; street: string | null },
  ): Promise<void> {
    await this.db
      .update(properties)
      .set({
        villageId: values.villageId,
        sectorId: values.sectorId,
        districtId: values.districtId,
        addressText: values.street,
        updatedAt: new Date(),
      })
      .where(eq(properties.id, propertyId));
  }

  /** Draft leases in the building: their contract names where it is. */
  async draftLeaseIds(propertyId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: leases.id })
      .from(leases)
      .where(and(eq(leases.propertyId, propertyId), eq(leases.status, 'draft')));
    return rows.map((r) => r.id);
  }
}
