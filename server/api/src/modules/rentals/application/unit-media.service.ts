import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  UNIT_PHOTO_MAX,
  UNIT_PHOTO_MAX_BYTES,
  UNIT_VIDEO_POSTER_MAX_BYTES,
  type UnitMediaView,
  type UnitPhotoView,
  type UnitVideoFields,
  type UnitVideoView,
} from '@injishi/contracts';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { UnitMediaStorage, type StagedFile, type StoredMedia } from '../../storage/application/unit-media-storage';
import { assertBuildingInScope, assertResidence } from '../domain/residence';
import { UnitMediaRepository, type UnitPhotoRow, type UnitVideoRow } from '../infrastructure/unit-media.repository';
import { RentalsAuditWriter } from '../infrastructure/rentals-writers';
import { UnitsRepository, type UnitListRow } from '../infrastructure/units.repository';

/** One uploaded file as the controller read it. */
export interface UploadedPhoto {
  body: Buffer;
  filename: string;
}

/**
 * A unit's photos and video tour (blueprint 2.3, WP 2.3). Up to 20 photos in
 * the landlord's order, the first being the cover; one video of 1 to 180
 * seconds with a poster still. The unit must be the caller's (its workspace
 * and branch scope) and not retired. Objects a change leaves behind (a removed
 * photo, a replaced video) are removed after the change is saved; objects a
 * failed change made are removed at once.
 */
@Injectable()
export class UnitMediaService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly units: UnitsRepository,
    private readonly media: UnitMediaRepository,
    private readonly storage: UnitMediaStorage,
    private readonly audit: RentalsAuditWriter,
  ) {}

  /** 404 or 409 before an upload is read, so a refused request does not stream 100 MB first. */
  async assertChangeable(ws: ScopedWorkspace, unitId: string): Promise<void> {
    await this.changeable(ws, unitId);
  }

  async view(ws: ScopedWorkspace, unitId: string): Promise<UnitMediaView> {
    await this.owned(ws, unitId);
    return this.present(unitId);
  }

  async addPhoto(ws: ScopedWorkspace, userId: string, unitId: string, file: UploadedPhoto): Promise<UnitPhotoView> {
    const unit = await this.changeable(ws, unitId);
    if ((await this.media.photos(unitId)).length >= UNIT_PHOTO_MAX) throw full(unit.label);
    const stored = await this.storage.putPhoto({
      body: file.body,
      filename: file.filename,
      maxBytes: UNIT_PHOTO_MAX_BYTES,
      uploadedByUserId: userId,
      workspaceId: unit.workspaceId,
    });
    let photoId: string;
    let position: number;
    try {
      ({ photoId, position } = await this.db.transaction(async (tx) => {
        await this.media.lockUnit(tx, unitId);
        const photos = await this.media.photos(unitId, tx);
        if (photos.length >= UNIT_PHOTO_MAX) throw full(unit.label);
        const at = photos.length;
        const id = await this.media.insertPhoto(tx, {
          unitId,
          workspaceId: unit.workspaceId,
          storedObjectId: stored.id,
          position: at,
        });
        await this.audit.write(tx, {
          actorUserId: userId,
          subjectType: 'rental_unit',
          subjectId: unitId,
          eventType: 'rental_unit.photo_added',
          diff: { photoId: id, position: at },
        });
        return { photoId: id, position: at };
      }));
    } catch (error) {
      await this.storage.remove([stored.id]);
      throw error;
    }
    return { id: photoId, url: await this.storage.signedUrl(stored.objectKey), position, caption: null };
  }

  /** Every photo of the unit in its new order; the first becomes the cover. */
  async reorderPhotos(ws: ScopedWorkspace, userId: string, unitId: string, photoIds: readonly string[]): Promise<UnitMediaView> {
    await this.changeable(ws, unitId);
    await this.db.transaction(async (tx) => {
      await this.media.lockUnit(tx, unitId);
      const photos = await this.media.photos(unitId, tx);
      const known = new Set(photos.map((p) => p.id));
      if (photoIds.length !== photos.length || photoIds.some((id) => !known.has(id))) {
        throw new BadRequestException({
          message: 'Validation failed',
          issues: [{ code: 'custom', path: ['photoIds'], message: 'The photos changed meanwhile. Reload them and try again.' }],
        });
      }
      for (const [position, id] of photoIds.entries()) await this.media.setPosition(tx, id, position);
      await this.audit.write(tx, {
        actorUserId: userId,
        subjectType: 'rental_unit',
        subjectId: unitId,
        eventType: 'rental_unit.photos_reordered',
        diff: { cover: photoIds[0] },
      });
    });
    return this.present(unitId);
  }

  async removePhoto(ws: ScopedWorkspace, userId: string, unitId: string, photoId: string): Promise<UnitMediaView> {
    await this.changeable(ws, unitId);
    const removed = await this.db.transaction(async (tx) => {
      await this.media.lockUnit(tx, unitId);
      const photos = await this.media.photos(unitId, tx);
      const photo = photos.find((p) => p.id === photoId);
      if (!photo) throw new NotFoundException('Photo not found.');
      await this.media.deletePhoto(tx, photoId);
      const rest = photos.filter((p) => p.id !== photoId);
      for (const [position, p] of rest.entries()) if (p.position !== position) await this.media.setPosition(tx, p.id, position);
      await this.audit.write(tx, {
        actorUserId: userId,
        subjectType: 'rental_unit',
        subjectId: unitId,
        eventType: 'rental_unit.photo_removed',
        diff: { photoId },
      });
      return photo;
    });
    await this.storage.remove([removed.storedObjectId]);
    return this.present(unitId);
  }

  /**
   * Set the unit's video tour from a staged upload (and its poster still), replacing the one it had.
   * The staged file is the caller's to discard.
   */
  async setVideo(
    ws: ScopedWorkspace,
    userId: string,
    unitId: string,
    input: { staged: StagedFile; filename: string; poster: UploadedPhoto | null; fields: UnitVideoFields },
  ): Promise<UnitVideoView> {
    const unit = await this.changeable(ws, unitId);
    const made: StoredMedia[] = [];
    try {
      const poster = input.poster
        ? await this.storage.putPhoto({
            body: input.poster.body,
            filename: input.poster.filename,
            maxBytes: UNIT_VIDEO_POSTER_MAX_BYTES,
            uploadedByUserId: userId,
            workspaceId: unit.workspaceId,
            what: 'The poster still',
          })
        : null;
      if (poster) made.push(poster);
      const video = await this.storage.putVideo({
        staged: input.staged,
        filename: input.filename,
        uploadedByUserId: userId,
        workspaceId: unit.workspaceId,
      });
      made.push(video);
      const before = await this.media.video(unitId);
      await this.db.transaction(async (tx) => {
        await this.media.upsertVideo(tx, {
          unitId,
          workspaceId: unit.workspaceId,
          storedObjectId: video.id,
          posterObjectId: poster?.id ?? null,
          durationS: input.fields.durationS,
          width: input.fields.width ?? null,
          height: input.fields.height ?? null,
          uploadedByUserId: userId,
        });
        await this.audit.write(tx, {
          actorUserId: userId,
          subjectType: 'rental_unit',
          subjectId: unitId,
          eventType: before ? 'rental_unit.video_replaced' : 'rental_unit.video_added',
          diff: { durationS: input.fields.durationS, sizeBytes: input.staged.sizeBytes },
        });
      });
      made.length = 0;
      if (before) await this.storage.remove([before.storedObjectId, before.posterObjectId].filter((id): id is string => id !== null));
    } catch (error) {
      await this.storage.remove(made.map((m) => m.id));
      throw error;
    }
    const saved = await this.media.video(unitId);
    if (!saved) throw new NotFoundException('Video not found.');
    return this.presentVideo(saved);
  }

  async removeVideo(ws: ScopedWorkspace, userId: string, unitId: string): Promise<UnitMediaView> {
    await this.changeable(ws, unitId);
    const before = await this.media.video(unitId);
    if (!before) return this.present(unitId);
    await this.db.transaction(async (tx) => {
      await this.media.deleteVideo(tx, unitId);
      await this.audit.write(tx, {
        actorUserId: userId,
        subjectType: 'rental_unit',
        subjectId: unitId,
        eventType: 'rental_unit.video_removed',
      });
    });
    await this.storage.remove([before.storedObjectId, before.posterObjectId].filter((id): id is string => id !== null));
    return this.present(unitId);
  }

  // --- Helpers ---------------------------------------------------------------------

  private async owned(ws: ScopedWorkspace, unitId: string): Promise<UnitListRow> {
    const r = assertResidence(ws);
    const row = await this.units.find(unitId);
    if (!row || row.workspaceId !== r.workspaceId) throw new NotFoundException('Unit not found.');
    assertBuildingInScope(ws, row.propertyId, 'Unit');
    return row;
  }

  private async changeable(ws: ScopedWorkspace, unitId: string): Promise<UnitListRow> {
    const row = await this.owned(ws, unitId);
    if (row.state === 'retired') {
      throw new ConflictException({ code: 'unit_retired', current: 'retired', message: `Unit ${row.label} is retired, so it can't change.` });
    }
    return row;
  }

  private async present(unitId: string): Promise<UnitMediaView> {
    const [photos, video] = await Promise.all([this.media.photos(unitId), this.media.video(unitId)]);
    return {
      unitId,
      photos: await Promise.all(photos.map((p) => this.presentPhoto(p))),
      video: video ? await this.presentVideo(video) : null,
    };
  }

  private async presentPhoto(p: UnitPhotoRow): Promise<UnitPhotoView> {
    return { id: p.id, url: await this.storage.signedUrl(p.objectKey), position: p.position, caption: p.caption };
  }

  private async presentVideo(v: UnitVideoRow): Promise<UnitVideoView> {
    return {
      id: v.id,
      url: await this.storage.signedUrl(v.objectKey),
      posterUrl: v.posterObjectKey ? await this.storage.signedUrl(v.posterObjectKey) : null,
      durationS: v.durationS,
      width: v.width,
      height: v.height,
      updatedAt: v.updatedAt.toISOString(),
    };
  }
}

function full(label: string): ConflictException {
  return new ConflictException({
    code: 'unit_photos_full',
    message: `Unit ${label} has ${UNIT_PHOTO_MAX} photos, the most it can hold. Remove one first.`,
  });
}
