import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import sharp from 'sharp';

import { storedObjects } from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { sniffMime } from '../domain/sniff-mime';
import { STORAGE_PORT, type StoragePort } from '../domain/storage-port';

/** What a menu photo upload may be: a picture from a phone or a computer, nothing else. */
export const MENU_PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** 8 MB: a phone photograph at full size clears it; the stored copy is far smaller. */
export const MENU_PHOTO_MAX_BYTES = 8 * 1024 * 1024;
/** The longest edge a menu photo is kept at: sharp on a large till card, light on a phone. */
export const MENU_PHOTO_MAX_EDGE_PX = 1200;

/**
 * A menu item's own photograph (Create recipe → Upload your own).
 *
 * Checked by its bytes (never the browser's word), turned upright from its EXIF, fitted inside 1200 px, re-encoded
 * as a progressive JPEG and stripped of every tag (camera, date, GPS), like a property photo (photo-normaliser.ts).
 * It is stored through the storage seam as a `property_photo`, the kind of a business's guest-facing picture (no
 * schema change), and recorded in `stored_objects` against the workspace and the person who uploaded it, so the
 * catalogue can check a photo belongs to the workspace before an item keeps its key. In local mode the bytes sit on
 * the API's disk (`.storage`), so they survive a restart; in live mode, on the object store.
 */
@Injectable()
export class MenuPhotoStorage {
  constructor(
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    @Inject(DRIZZLE) private readonly db: Database,
  ) {}

  async putPhoto(input: {
    body: Buffer;
    filename: string;
    uploadedByUserId: string;
    workspaceId: string;
  }): Promise<{ id: string; objectKey: string }> {
    if (input.body.byteLength === 0) throw new BadRequestException('That file is empty.');
    if (input.body.byteLength > MENU_PHOTO_MAX_BYTES) {
      throw new BadRequestException('A photo must be 8 MB or smaller.');
    }
    const sniffed = sniffMime(input.body);
    if (!sniffed || !(MENU_PHOTO_MIMES as readonly string[]).includes(sniffed)) {
      throw new BadRequestException('A photo must be a JPEG, PNG or WebP image.');
    }
    let body: Buffer;
    try {
      body = await sharp(input.body, { failOn: 'error' })
        .rotate()
        .resize({ width: MENU_PHOTO_MAX_EDGE_PX, height: MENU_PHOTO_MAX_EDGE_PX, fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#ffffff' })
        .toColourspace('srgb')
        .jpeg({ quality: 82, progressive: true, mozjpeg: true })
        .toBuffer();
    } catch {
      throw new BadRequestException("We couldn't read that image. Try another photo, saved as a JPEG or PNG.");
    }
    const filename = `${input.filename.replace(/\.[^./\\]*$/, '') || 'photo'}.jpg`;
    const put = await this.storage.put({ body, mime: 'image/jpeg', filename, kind: 'property_photo' });
    const [row] = await this.db
      .insert(storedObjects)
      .values({
        objectKey: put.objectKey,
        kind: 'property_photo',
        mime: 'image/jpeg',
        sizeBytes: put.sizeBytes,
        uploadedByUserId: input.uploadedByUserId,
        workspaceId: input.workspaceId,
      })
      .returning({ id: storedObjects.id, objectKey: storedObjects.objectKey });
    if (!row) throw new Error(`stored object ${put.objectKey} was not recorded`);
    return row;
  }

  /** A stored photo's bytes, for the API to hand to the app (never a local path, never a data URL per item). */
  read(objectKey: string): Promise<Buffer> {
    return this.storage.get(objectKey);
  }
}
