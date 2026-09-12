import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { District, Province, Sector } from '@injishi/contracts';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { districts, provinces, sectors } from '../../../database/drizzle/schema';

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
}
