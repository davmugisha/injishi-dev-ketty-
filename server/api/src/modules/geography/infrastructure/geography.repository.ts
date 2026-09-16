import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Cell, District, Province, Sector, Village } from '@injishi/contracts';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import {
  cells,
  districts,
  provinces,
  sectors,
  villages,
} from '../../../database/drizzle/schema';

/**
 * Infrastructure layer: the only place that touches Drizzle for geography.
 * Returns rows already shaped to the @injishi/contracts wire types.
 */
@Injectable()
export class GeographyRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  findProvinces(): Promise<Province[]> {
    return this.db
      .select({ id: provinces.id, name: provinces.name })
      .from(provinces)
      .orderBy(provinces.name);
  }

  findDistricts(provinceId?: number): Promise<District[]> {
    return this.db
      .select({
        id: districts.id,
        name: districts.name,
        provinceId: districts.provinceId,
      })
      .from(districts)
      .where(provinceId ? eq(districts.provinceId, provinceId) : undefined)
      .orderBy(districts.name);
  }

  /**
   * Sectors, the third and last level the address picker asks for (D24).
   *
   * Ordered by name like the two above it, so the three pickers behave the
   * same way and the wizard never has to sort a list itself.
   */
  findSectors(districtId?: number): Promise<Sector[]> {
    return this.db
      .select({
        id: sectors.id,
        name: sectors.name,
        districtId: sectors.districtId,
      })
      .from(sectors)
      .where(districtId ? eq(sectors.districtId, districtId) : undefined)
      .orderBy(sectors.name);
  }

  /** Cells, the fourth level. Ordered by name like every level above it. */
  findCells(sectorId?: number): Promise<Cell[]> {
    return this.db
      .select({ id: cells.id, name: cells.name, sectorId: cells.sectorId })
      .from(cells)
      .where(sectorId ? eq(cells.sectorId, sectorId) : undefined)
      .orderBy(cells.name);
  }

  /** Villages, the fifth and finest level, and the only other stored one. */
  findVillages(cellId?: number): Promise<Village[]> {
    return this.db
      .select({ id: villages.id, name: villages.name, cellId: villages.cellId })
      .from(villages)
      .where(cellId ? eq(villages.cellId, cellId) : undefined)
      .orderBy(villages.name);
  }

  /**
   * Where one village sits, resolved all the way up to its sector.
   *
   * The coherence check both write paths need: an address names a sector and
   * may name a village, and nothing but this join can say whether the two
   * describe the same place. Returns null for an id no row carries, which is a
   * different refusal from "that village is somewhere else" and is worded
   * differently by the caller.
   */
  async findVillagePlacement(
    villageId: number,
  ): Promise<{ villageId: number; cellId: number; sectorId: number } | null> {
    const [row] = await this.db
      .select({
        villageId: villages.id,
        cellId: villages.cellId,
        sectorId: cells.sectorId,
      })
      .from(villages)
      .innerJoin(cells, eq(cells.id, villages.cellId))
      .where(eq(villages.id, villageId))
      .limit(1);
    return row ?? null;
  }
}
