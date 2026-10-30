import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';

import {
  amenities,
  properties,
  propertyAmenities,
} from '../../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../../shared/database/database.module';

export interface PropertyRow {
  id: string;
  workspaceId: string;
}

export interface AmenityRow {
  code: string;
  category: string | null;
  label: string;
  offered: boolean;
}

/**
 * The amenity catalog and what one property offers from it
 * (ADR-012 step 4, `amenity.manage`).
 *
 * `amenities` is a shared CATALOG with no workspace: every property picks from
 * the same list, which is what makes "properties with a pool" answerable across
 * the platform. `property_amenities` is the per property choice, and that is
 * the only thing this command writes.
 */
@Injectable()
export class AmenitiesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** The property, unscoped, so the caller can prove it with `assertOwned`. */
  async findProperty(propertyId: string): Promise<PropertyRow | null> {
    const [row] = await this.db
      .select({ id: properties.id, workspaceId: properties.workspaceId })
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);

    return row ?? null;
  }

  /**
   * The whole catalog, with a flag for what this property offers.
   *
   * A left join rather than two lists, because the screen's question is "which
   * of these do we have", and answering it in the browser means shipping the
   * catalog twice and joining it there.
   */
  async listForProperty(propertyId: string): Promise<AmenityRow[]> {
    const rows = await this.db
      .select({
        code: amenities.code,
        category: amenities.category,
        labelEn: amenities.labelEn,
        offeredCode: propertyAmenities.amenityCode,
      })
      .from(amenities)
      .leftJoin(
        propertyAmenities,
        and(
          eq(propertyAmenities.amenityCode, amenities.code),
          eq(propertyAmenities.propertyId, propertyId),
        ),
      )
      .orderBy(asc(amenities.category), asc(amenities.code));

    return rows.map((row) => ({
      code: row.code,
      category: row.category,
      /*
       * The catalog's own English name.
       *
       * This used to send `row.code`, under a comment saying the catalog
       * carried no display name column. It carries two — `label_en` and
       * `label_rw` — and has since the table was written, so every operator was
       * shown "hotwater" and "toiletries" where the row said "Hot water" and
       * "Toiletries". The comment was the error; the column was there.
       *
       * ENGLISH, for now, and that is a stated limit rather than a decision.
       * `label_rw` is populated too, and picking between them is a locale
       * question that F-A20 owns. Serving one language is a smaller wrong than
       * serving a primary key.
       *
       * A code with no name falls back to the code, because an amenity with a
       * blank label would be an unlabelled toggle.
       */
      label: row.labelEn ?? row.code,
      offered: row.offeredCode !== null,
    }));
  }

  /** Does the catalog know this code? */
  async catalogHas(code: string): Promise<boolean> {
    const [row] = await this.db
      .select({ code: amenities.code })
      .from(amenities)
      .where(eq(amenities.code, code))
      .limit(1);

    return Boolean(row);
  }

  /**
   * Offer an amenity. Doing it twice is not an error, it is the same fact.
   *
   * The composite primary key makes the repeat a conflict at the database
   * level, and `DO NOTHING` turns that into the honest answer rather than a
   * 500 the desk cannot act on.
   */
  async add(propertyId: string, amenityCode: string): Promise<void> {
    await this.db
      .insert(propertyAmenities)
      .values({ propertyId, amenityCode })
      .onConflictDoNothing();
  }

  async remove(propertyId: string, amenityCode: string): Promise<void> {
    await this.db
      .delete(propertyAmenities)
      .where(
        and(
          eq(propertyAmenities.propertyId, propertyId),
          eq(propertyAmenities.amenityCode, amenityCode),
        ),
      );
  }
}
