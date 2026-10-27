import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';

import { storedObjects, unitPhotos, unitVideos } from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { DbOrTx } from './rentals-writers';

export interface UnitPhotoRow {
  id: string;
  storedObjectId: string;
  objectKey: string;
  position: number;
  caption: string | null;
}

export interface UnitVideoRow {
  id: string;
  storedObjectId: string;
  objectKey: string;
  posterObjectId: string | null;
  posterObjectKey: string | null;
  durationS: number;
  width: number | null;
  height: number | null;
  updatedAt: Date;
}

/**
 * A unit's photos (`unit_photos`, at most 20, 0 is the cover) and its video
 * tour (`unit_videos`, at most one). The objects themselves are the storage
 * module's; these rows say which unit shows them and in what order.
 */
@Injectable()
export class UnitMediaRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async photos(unitId: string, db: DbOrTx = this.db): Promise<UnitPhotoRow[]> {
    return db
      .select({
        id: unitPhotos.id,
        storedObjectId: unitPhotos.storedObjectId,
        objectKey: storedObjects.objectKey,
        position: unitPhotos.position,
        caption: unitPhotos.caption,
      })
      .from(unitPhotos)
      .innerJoin(storedObjects, eq(storedObjects.id, unitPhotos.storedObjectId))
      .where(eq(unitPhotos.unitId, unitId))
      .orderBy(asc(unitPhotos.position), asc(unitPhotos.createdAt));
  }

  async video(unitId: string): Promise<UnitVideoRow | null> {
    const { rows } = await this.db.execute<{
      id: string;
      stored_object_id: string;
      object_key: string;
      poster_object_id: string | null;
      poster_object_key: string | null;
      duration_s: number;
      width: number | null;
      height: number | null;
      updated_at: string | Date;
    }>(sql`
      select v.id, v.stored_object_id, o.object_key, v.poster_object_id, po.object_key as poster_object_key,
             v.duration_s, v.width, v.height, v.updated_at
        from unit_videos v
        join stored_objects o on o.id = v.stored_object_id
        left join stored_objects po on po.id = v.poster_object_id
       where v.unit_id = ${unitId}
    `);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      storedObjectId: row.stored_object_id,
      objectKey: row.object_key,
      posterObjectId: row.poster_object_id,
      posterObjectKey: row.poster_object_key,
      durationS: Number(row.duration_s),
      width: row.width === null ? null : Number(row.width),
      height: row.height === null ? null : Number(row.height),
      updatedAt: new Date(row.updated_at),
    };
  }

  /** Serialise photo changes of one unit, so two uploads at once can't pass 20 or take one place. */
  async lockUnit(tx: DbOrTx, unitId: string): Promise<void> {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`unit-media:${unitId}`}))`);
  }

  async insertPhoto(
    tx: DbOrTx,
    values: { unitId: string; workspaceId: string; storedObjectId: string; position: number },
  ): Promise<string> {
    const [row] = await tx.insert(unitPhotos).values(values).returning({ id: unitPhotos.id });
    if (!row) throw new Error('unit photo insert returned nothing');
    return row.id;
  }

  async setPosition(tx: DbOrTx, photoId: string, position: number): Promise<void> {
    await tx.update(unitPhotos).set({ position }).where(eq(unitPhotos.id, photoId));
  }

  async deletePhoto(tx: DbOrTx, photoId: string): Promise<void> {
    await tx.delete(unitPhotos).where(eq(unitPhotos.id, photoId));
  }

  /** Set the unit's video, replacing the one it had. */
  async upsertVideo(
    tx: DbOrTx,
    values: {
      unitId: string;
      workspaceId: string;
      storedObjectId: string;
      posterObjectId: string | null;
      durationS: number;
      width: number | null;
      height: number | null;
      uploadedByUserId: string;
    },
  ): Promise<void> {
    await tx
      .insert(unitVideos)
      .values(values)
      .onConflictDoUpdate({
        target: unitVideos.unitId,
        set: {
          storedObjectId: values.storedObjectId,
          posterObjectId: values.posterObjectId,
          durationS: values.durationS,
          width: values.width,
          height: values.height,
          uploadedByUserId: values.uploadedByUserId,
          updatedAt: new Date(),
        },
      });
  }

  async deleteVideo(tx: DbOrTx, unitId: string): Promise<void> {
    await tx.delete(unitVideos).where(eq(unitVideos.unitId, unitId));
  }
}
