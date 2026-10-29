import { BadRequestException, Inject, Injectable } from '@nestjs/common';

import { storedObjects } from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { sniffMime, type SniffedMime } from '../domain/sniff-mime';
import { STORAGE_PORT, type StoragePort } from '../domain/storage-port';
import { normalisePhoto } from './photo-normaliser';

/** A stored object as a rentals row points at it. */
export interface StoredFile {
  id: string;
  objectKey: string;
}

/** What a receipt, a filing proof or a tax receipt may be. */
const DOCUMENT_MIMES: readonly SniffedMime[] = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const PHOTO_MIMES: readonly SniffedMime[] = ['image/jpeg', 'image/png', 'image/webp'];

/** The papers a landlord keeps: an expense's receipt, the proof a lease was filed, RRA's tax receipt. */
export type RentalsDocumentKind = 'expense_receipt' | 'filing_proof' | 'tax_receipt';

const WHAT: Readonly<Record<RentalsDocumentKind, string>> = {
  expense_receipt: 'A receipt',
  filing_proof: 'The proof',
  tax_receipt: 'The receipt',
};

/**
 * The rentals module's own files (WP 4.1 to 4.4): a fault's photos, and the
 * papers behind an expense, a lease filing and a tax payment. Kept in the
 * storage module for the reason `StorageService` gives: bytes and their
 * `stored_objects` row are written as one act, by the module that owns both.
 *
 *   photos     the type is read from the bytes (JPEG, PNG or WebP), then the
 *              picture is turned upright, fitted to 2048 px, re-encoded as
 *              JPEG and stripped of every metadata block (GPS included).
 *   documents  a PDF or a photo, the type read from the bytes and matched to
 *              what the upload said it was, stored as sent.
 */
@Injectable()
export class RentalsFilesStorage {
  constructor(
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    @Inject(DRIZZLE) private readonly db: Database,
  ) {}

  /** One photo of a fault, normalised and stored against the workspace. */
  async putFaultPhoto(input: {
    body: Buffer;
    filename: string;
    maxBytes: number;
    uploadedByUserId: string;
    workspaceId: string;
  }): Promise<StoredFile> {
    if (input.body.byteLength === 0) throw new BadRequestException('That file is empty.');
    if (input.body.byteLength > input.maxBytes) {
      throw new BadRequestException(`A photo must be ${Math.round(input.maxBytes / (1024 * 1024))} MB or smaller.`);
    }
    const sniffed = sniffMime(input.body);
    if (!sniffed || !PHOTO_MIMES.includes(sniffed)) throw new BadRequestException('A photo must be a JPEG, PNG or WebP image.');
    const photo = await normalisePhoto(input.body, sniffed);
    const filename = `${input.filename.replace(/\.[^./\\]*$/, '') || 'photo'}.jpg`;
    const put = await this.storage.put({ body: photo.body, mime: photo.mime, filename, kind: 'fault_photo' });
    return this.record(put.objectKey, 'fault_photo', photo.mime, put.sizeBytes, input.uploadedByUserId, input.workspaceId);
  }

  /** A receipt or a proof: a PDF or a photo, at most `maxBytes`. */
  async putDocument(input: {
    kind: RentalsDocumentKind;
    body: Buffer;
    mime: string;
    filename: string;
    maxBytes: number;
    uploadedByUserId: string;
    workspaceId: string;
  }): Promise<StoredFile> {
    const what = WHAT[input.kind];
    const mime = input.mime.split(';')[0]?.trim().toLowerCase() ?? '';
    if (input.body.byteLength === 0) throw new BadRequestException('That file is empty.');
    if (input.body.byteLength > input.maxBytes) {
      throw new BadRequestException(`${what} must be ${Math.round(input.maxBytes / (1024 * 1024))} MB or smaller.`);
    }
    const sniffed = sniffMime(input.body);
    if (!sniffed || !DOCUMENT_MIMES.includes(sniffed)) throw new BadRequestException(`${what} must be a PDF, JPEG, PNG or WebP.`);
    if (mime && mime !== 'application/octet-stream' && mime !== sniffed) {
      throw new BadRequestException('That file is not what its type says it is.');
    }
    const put = await this.storage.put({ body: input.body, mime: sniffed, filename: input.filename || 'document', kind: input.kind });
    return this.record(put.objectKey, input.kind, sniffed, put.sizeBytes, input.uploadedByUserId, input.workspaceId);
  }

  /** A short-lived read of a stored object. */
  signedUrl(objectKey: string, ttlSeconds = 900): Promise<string> {
    return this.storage.signedUrl(objectKey, ttlSeconds);
  }

  private async record(
    objectKey: string,
    kind: 'fault_photo' | RentalsDocumentKind,
    mime: string,
    sizeBytes: number,
    uploadedByUserId: string,
    workspaceId: string,
  ): Promise<StoredFile> {
    const [row] = await this.db
      .insert(storedObjects)
      .values({ objectKey, kind, mime, sizeBytes, uploadedByUserId, workspaceId })
      .returning({ id: storedObjects.id, objectKey: storedObjects.objectKey });
    if (!row) throw new Error(`stored object ${objectKey} was not recorded`);
    return row;
  }
}
