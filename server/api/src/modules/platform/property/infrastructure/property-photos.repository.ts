import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';

import { propertyPhotos, roomTypes } from '../../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../../shared/database/database.module';

/** One photograph row, before a signed URL is added to it. */
export interface PropertyPhotoRow {
  id: string;
  propertyId: string;
  objectKey: string;
  position: number;
  isCover: boolean;
  caption: string | null;
  /** 0118: the room type it shows; null is the property. */
  roomTypeId: string | null;
}

/**
 * A property's photographs (ADR-053, AC-I3).
 *
 * ## Two invariants live here, and both are database constraints first
 *
 * `property_photos_position_uk` says one photograph per slot, and
 * `property_photos_cover_uk` says exactly one cover. Every write below is shaped
 * so it cannot fight those: a reorder renumbers in ONE statement rather than row
 * by row, and setting a cover clears the old one in the same transaction.
 *
 * Renumbering row by row is the bug this avoids. Swapping positions 0 and 1 as
 * two updates hits the unique index halfway through, and the usual workaround —
 * move one to a temporary position, then back — is three statements where one
 * will do.
 */
@Injectable()
export class PropertyPhotosRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Every photograph on a property, in the operator's order. */
  async listForProperty(propertyId: string): Promise<PropertyPhotoRow[]> {
    return this.db
      .select({
        id: propertyPhotos.id,
        propertyId: propertyPhotos.propertyId,
        objectKey: propertyPhotos.objectKey,
        position: propertyPhotos.position,
        isCover: propertyPhotos.isCover,
        caption: propertyPhotos.caption,
        roomTypeId: propertyPhotos.roomTypeId,
      })
      .from(propertyPhotos)
      .where(eq(propertyPhotos.propertyId, propertyId))
      .orderBy(asc(propertyPhotos.position));
  }

  /** How many photographs a property has. The publish condition, and AC-I7's. */
  async countForProperty(propertyId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(propertyPhotos)
      .where(eq(propertyPhotos.propertyId, propertyId));
    return Number(row?.count ?? 0);
  }

  /** 0118: whether a room type is on this property, so a photograph cannot be filed under another's. */
  async roomTypeOnProperty(roomTypeId: string, propertyId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: roomTypes.id })
      .from(roomTypes)
      .where(and(eq(roomTypes.id, roomTypeId), eq(roomTypes.propertyId, propertyId)))
      .limit(1);
    return row !== undefined;
  }

  /** One photograph, with the property it belongs to, for the containment check. */
  async find(photoId: string): Promise<PropertyPhotoRow | null> {
    const [row] = await this.db
      .select({
        id: propertyPhotos.id,
        propertyId: propertyPhotos.propertyId,
        objectKey: propertyPhotos.objectKey,
        position: propertyPhotos.position,
        isCover: propertyPhotos.isCover,
        caption: propertyPhotos.caption,
        roomTypeId: propertyPhotos.roomTypeId,
      })
      .from(propertyPhotos)
      .where(eq(propertyPhotos.id, photoId))
      .limit(1);
    return row ?? null;
  }

  /**
   * Attach an uploaded object to a property.
   *
   * **The first photograph becomes the cover whatever the caller asked for.** A
   * property with photographs and no cover has nothing to show in a search
   * result, and the operator did not choose that state, so it is not one the
   * write path can leave them in.
   *
   * The position defaults to the end, which is what an operator adding one
   * expects. An explicit position shifts everything from it upward, in one
   * statement, so the unique index is never transiently violated.
   */
  async attach(input: {
    propertyId: string;
    objectKey: string;
    position: number | null;
    isCover: boolean;
    caption: string | null;
    roomTypeId?: string | null;
  }): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({
          count: sql<number>`count(*)`,
          nextPosition: sql<number>`coalesce(max(${propertyPhotos.position}) + 1, 0)`,
        })
        .from(propertyPhotos)
        .where(eq(propertyPhotos.propertyId, input.propertyId));

      const count = Number(existing?.count ?? 0);
      const end = Number(existing?.nextPosition ?? 0);
      const position =
        input.position === null ? end : Math.min(input.position, end);
      const isCover = count === 0 ? true : input.isCover;

      if (position < end) {
        // Make room. One statement, descending through the index, so no two rows
        // ever hold the same slot mid-flight.
        await tx
          .update(propertyPhotos)
          .set({ position: sql`${propertyPhotos.position} + 1` })
          .where(
            and(
              eq(propertyPhotos.propertyId, input.propertyId),
              sql`${propertyPhotos.position} >= ${position}`,
            ),
          );
      }

      if (isCover && count > 0) {
        await tx
          .update(propertyPhotos)
          .set({ isCover: false })
          .where(
            and(
              eq(propertyPhotos.propertyId, input.propertyId),
              eq(propertyPhotos.isCover, true),
            ),
          );
      }

      await tx.insert(propertyPhotos).values({
        propertyId: input.propertyId,
        objectKey: input.objectKey,
        position,
        isCover,
        caption: input.caption,
        roomTypeId: input.roomTypeId ?? null,
      });
    });
  }

  /**
   * Apply a whole new order, and a cover, in one transaction.
   *
   * Positions are pushed far out of the way first (`+ 1000000`) and then written
   * to their final values. Two statements rather than one clever one, because the
   * alternative is a per-row dance around `property_photos_position_uk` that only
   * works if the rows happen to be visited in a lucky order.
   */
  async reorder(input: {
    propertyId: string;
    photos: {
      id: string;
      position: number;
      isCover?: boolean;
      caption?: string | null;
    }[];
  }): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(propertyPhotos)
        .set({ position: sql`${propertyPhotos.position} + 1000000` })
        .where(eq(propertyPhotos.propertyId, input.propertyId));

      const cover = input.photos.find((p) => p.isCover === true);
      if (cover) {
        await tx
          .update(propertyPhotos)
          .set({ isCover: false })
          .where(
            and(
              eq(propertyPhotos.propertyId, input.propertyId),
              eq(propertyPhotos.isCover, true),
            ),
          );
      }

      for (const photo of input.photos) {
        const patch: Record<string, unknown> = { position: photo.position };
        if (photo.caption !== undefined) patch.caption = photo.caption;
        if (cover) patch.isCover = photo.id === cover.id;
        await tx
          .update(propertyPhotos)
          .set(patch)
          .where(
            and(
              eq(propertyPhotos.id, photo.id),
              // Scoped to the property as well as the id, so a caller cannot
              // renumber another property's photograph by naming its id here.
              eq(propertyPhotos.propertyId, input.propertyId),
            ),
          );
      }
    });
  }

  /**
   * Remove a photograph, close the gap, and keep a cover.
   *
   * Deleting the cover PROMOTES the next one rather than leaving the property
   * with none, for the same reason the first attach becomes the cover: no operator
   * chose "photographs but no cover", so no write path may produce it.
   */
  async remove(input: { propertyId: string; photoId: string }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [removed] = await tx
        .delete(propertyPhotos)
        .where(
          and(
            eq(propertyPhotos.id, input.photoId),
            eq(propertyPhotos.propertyId, input.propertyId),
          ),
        )
        .returning({
          position: propertyPhotos.position,
          isCover: propertyPhotos.isCover,
        });
      if (!removed) return false;

      // Close the gap, so positions stay dense and a later reorder reads sensibly.
      await tx
        .update(propertyPhotos)
        .set({ position: sql`${propertyPhotos.position} - 1` })
        .where(
          and(
            eq(propertyPhotos.propertyId, input.propertyId),
            sql`${propertyPhotos.position} > ${removed.position}`,
          ),
        );

      if (removed.isCover) {
        const [next] = await tx
          .select({ id: propertyPhotos.id })
          .from(propertyPhotos)
          .where(eq(propertyPhotos.propertyId, input.propertyId))
          .orderBy(asc(propertyPhotos.position))
          .limit(1);
        if (next) {
          await tx
            .update(propertyPhotos)
            .set({ isCover: true })
            .where(eq(propertyPhotos.id, next.id));
        }
      }

      return true;
    });
  }
}
