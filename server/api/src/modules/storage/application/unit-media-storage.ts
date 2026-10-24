import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, open, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';

import { storedObjects } from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { sniffMime } from '../domain/sniff-mime';
import { VIDEO_SNIFF_BYTES, sniffVideoMime, type SniffedVideoMime } from '../domain/sniff-video';
import { STORAGE_PORT, type StoragePort } from '../domain/storage-port';
import { normalisePhoto } from './photo-normaliser';

/** A stored object as the rentals unit tables point at it. */
export interface StoredMedia {
  id: string;
  objectKey: string;
}

/** An upload received to a temporary file, not stored yet. */
export interface StagedFile {
  path: string;
  sizeBytes: number;
  mime: SniffedVideoMime;
}

const PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * A unit's photos and video tour, written and removed (rentals, WP 2.3).
 *
 * Kept in the storage module for the reason `StorageService` gives: bytes and
 * their `stored_objects` row are written as one act, by the module that owns
 * both. The rentals module checks the unit is the caller's and keeps the
 * `unit_photos` / `unit_videos` rows; this keeps the objects.
 *
 *   photos   the type is read from the bytes (JPEG, PNG or WebP), then the
 *            picture is turned upright, fitted to 2048 px, re-encoded as JPEG
 *            and stripped of every metadata block (GPS included) before it is
 *            stored, as a property photo is.
 *   videos   streamed to a temporary file under the route's ceiling, never
 *            buffered whole; the first bytes say MP4, MOV or WebM; the store
 *            gets the file streamed. Nothing is transcoded. The poster still
 *            is a photo, normalised the same way.
 */
@Injectable()
export class UnitMediaStorage {
  constructor(
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    @Inject(DRIZZLE) private readonly db: Database,
  ) {}

  /** One photo of a unit, normalised and stored against the workspace. */
  async putPhoto(input: {
    body: Buffer;
    filename: string;
    maxBytes: number;
    uploadedByUserId: string;
    workspaceId: string;
    what?: string;
  }): Promise<StoredMedia> {
    const what = input.what ?? 'A photo';
    if (input.body.byteLength === 0) throw new BadRequestException('That file is empty.');
    if (input.body.byteLength > input.maxBytes) {
      throw new BadRequestException(`${what} must be ${Math.round(input.maxBytes / (1024 * 1024))} MB or smaller.`);
    }
    const sniffed = sniffMime(input.body);
    if (!sniffed || !(PHOTO_MIMES as readonly string[]).includes(sniffed)) {
      throw new BadRequestException(`${what} must be a JPEG, PNG or WebP image.`);
    }
    const photo = await normalisePhoto(input.body, sniffed);
    const filename = `${input.filename.replace(/\.[^./\\]*$/, '') || 'photo'}.jpg`;
    const put = await this.storage.put({ body: photo.body, mime: photo.mime, filename, kind: 'unit_photo' });
    return this.record(put.objectKey, 'unit_photo', photo.mime, put.sizeBytes, input.uploadedByUserId, input.workspaceId);
  }

  /**
   * Receive a video upload to a temporary file, under `maxBytes`, and say what it is. Nothing is stored
   * yet: the caller checks the rest of the request first, then `putVideo`, and `discard`s the file
   * whatever happens.
   */
  async stageVideo(input: { stream: Readable; truncated: () => boolean; maxBytes: number }): Promise<StagedFile> {
    const dir = join(tmpdir(), 'injishi-uploads');
    await mkdir(dir, { recursive: true });
    const path = join(dir, `${randomUUID()}.part`);
    try {
      try {
        await pipeline(input.stream, createWriteStream(path));
      } catch {
        // The browser gave up or the connection dropped part way.
        throw new BadRequestException('The video stopped uploading. Try again.');
      }
      if (input.truncated()) {
        throw new BadRequestException(`A video must be ${Math.round(input.maxBytes / (1024 * 1024))} MB or smaller.`);
      }
      const { size } = await stat(path);
      if (size === 0) throw new BadRequestException('That file is empty.');
      const head = Buffer.alloc(VIDEO_SNIFF_BYTES);
      const handle = await open(path, 'r');
      try {
        await handle.read(head, 0, head.length, 0);
      } finally {
        await handle.close();
      }
      const mime = sniffVideoMime(head);
      if (!mime) throw new BadRequestException('A video must be an MP4, MOV or WebM file.');
      return { path, sizeBytes: size, mime };
    } catch (error) {
      await rm(path, { force: true });
      throw error;
    }
  }

  /** Store a staged video against the workspace. */
  async putVideo(input: {
    staged: StagedFile;
    filename: string;
    uploadedByUserId: string;
    workspaceId: string;
  }): Promise<StoredMedia> {
    const put = await this.storage.putFile({
      path: input.staged.path,
      sizeBytes: input.staged.sizeBytes,
      mime: input.staged.mime,
      filename: input.filename,
      kind: 'unit_video',
    });
    return this.record(put.objectKey, 'unit_video', input.staged.mime, put.sizeBytes, input.uploadedByUserId, input.workspaceId);
  }

  /** Drop a staged file. Safe to call twice. */
  async discard(staged: Pick<StagedFile, 'path'> | null): Promise<void> {
    if (staged) await rm(staged.path, { force: true });
  }

  /** A short-lived read of a stored object. */
  signedUrl(objectKey: string, ttlSeconds = 900): Promise<string> {
    return this.storage.signedUrl(objectKey, ttlSeconds);
  }

  /**
   * Remove objects nothing points at any more (a removed photo, a replaced video). The rows go first and
   * the bytes after, as `removeOwnUnattached` explains; an object under legal hold is left alone.
   */
  async remove(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    const rows = await this.db
      .select({ id: storedObjects.id, objectKey: storedObjects.objectKey, legalHold: storedObjects.legalHold })
      .from(storedObjects)
      .where(inArray(storedObjects.id, [...ids]));
    for (const row of rows) {
      if (row.legalHold) continue;
      await this.db.delete(storedObjects).where(eq(storedObjects.id, row.id));
      await this.storage.remove(row.objectKey).catch(() => undefined);
    }
  }

  private async record(
    objectKey: string,
    kind: 'unit_photo' | 'unit_video',
    mime: string,
    sizeBytes: number,
    uploadedByUserId: string,
    workspaceId: string,
  ): Promise<StoredMedia> {
    const [row] = await this.db
      .insert(storedObjects)
      .values({ objectKey, kind, mime, sizeBytes, uploadedByUserId, workspaceId })
      .returning({ id: storedObjects.id, objectKey: storedObjects.objectKey });
    if (!row) throw new Error(`stored object ${objectKey} was not recorded`);
    return row;
  }
}
