import { createHash } from 'node:crypto';

import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { eq, like } from 'drizzle-orm';

import { storedObjects } from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import {
  ATTACHMENT_MIME_TYPES,
  CERTIFICATE_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  MAX_CERTIFICATE_BYTES,
  STORAGE_PORT,
  type AttachmentKind,
  type StoragePort,
} from '../domain/storage-port';

/**
 * A stored file, as the uploads route reports it back.
 *
 * `kind` is the LITERAL `certificate` rather than the wide `StoredObjectKind`,
 * because this is the return of one narrow method that stores one kind. The
 * wide type here would let the controller's declared return drift from
 * `UploadedObject` in `@injishi/contracts`, which is the shape the browser
 * parses against.
 */
export interface StoredObjectView {
  objectKey: string;
  kind: 'certificate';
  mime: string;
  sizeBytes: number;
  filename: string;
}

/**
 * A stored attachment, as the shared upload route reports it back.
 *
 * `url` is what makes this different from `StoredObjectView`: the parent's
 * upload contract is `{ objectKey, url }`, because the phone shows the picture
 * back immediately after sending it and would otherwise need a second round
 * trip to do so. It is a short-lived read, not a permanent address.
 */
export interface AttachmentView {
  objectKey: string;
  kind: AttachmentKind;
  mime: string;
  sizeBytes: number;
  filename: string;
  url: string;
}

/**
 * Writing bytes and recording that they exist, as one act (F-S09, ADR-026).
 *
 * The two halves are inseparable and that is why they live behind one method:
 * bytes in the store with no `stored_objects` row are unreachable and
 * unretained, and a row with no bytes is a foreign key that resolves to
 * nothing. `org_certificates.object_key` references `stored_objects.object_key`,
 * so the row is what makes a certificate attachable at all.
 *
 * The ceilings live in the domain file rather than here so the controller, this
 * service and any later adapter all read the same numbers.
 */
@Injectable()
export class StorageService {
  constructor(
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    @Inject(DRIZZLE) private readonly db: Database,
  ) {}

  /**
   * Store an uploaded certificate and record it.
   *
   * The mime is checked against an allowlist rather than a blocklist: this
   * endpoint is reachable by anyone with a session, and a blocklist on an
   * upload path is a list of the attacks somebody already thought of.
   */
  async putCertificate(input: {
    body: Buffer;
    mime: string;
    filename: string;
    uploadedByUserId: string;
  }): Promise<StoredObjectView> {
    const mime = input.mime.split(';')[0].trim().toLowerCase();
    if (!CERTIFICATE_MIME_TYPES.includes(mime)) {
      throw new BadRequestException(
        'A certificate must be a PDF, JPEG, PNG or WebP.',
      );
    }
    if (input.body.byteLength === 0) {
      throw new BadRequestException('That file is empty.');
    }
    if (input.body.byteLength > MAX_CERTIFICATE_BYTES) {
      throw new BadRequestException('A certificate must be 10 MB or smaller.');
    }

    const kind = 'certificate' as const;
    const put = await this.storage.put({
      body: input.body,
      mime,
      filename: input.filename,
      kind,
    });

    await this.db.insert(storedObjects).values({
      objectKey: put.objectKey,
      kind,
      mime,
      sizeBytes: put.sizeBytes,
      uploadedByUserId: input.uploadedByUserId,
      // No workspace yet: a certificate is uploaded during registration, before
      // the org and therefore before the workspace exists. The link that makes
      // it findable is `org_certificates.object_key`, written when the
      // registration is created.
      workspaceId: null,
    });

    return {
      objectKey: put.objectKey,
      kind,
      mime,
      sizeBytes: put.sizeBytes,
      filename: input.filename,
    };
  }

  /**
   * Store one attachment from a phone and record it (ADR-038 child 0, AC-S16).
   *
   * The offline queue persists a local file URI alongside a queued write and
   * uploads it at flush time, BEFORE sending the write that references the
   * returned key. So this method has to be safe to call twice with the same
   * intent: a flush that half-succeeded and was retried must not leave two
   * copies of a fault report's photograph in the store, each with a row nobody
   * will ever reference.
   *
   * Idempotency comes from the key rather than from a new column, because
   * ADR-038 permits exactly one migration and it is spent on the credits
   * ledger. The attempt token is hashed with the uploader's id into a stable
   * stem, the adapter turns that into a stable key, and `object_key` is unique,
   * so a replay finds the row it wrote last time and returns it unchanged.
   *
   * Hashed rather than used raw: the token is minted by the client, and a raw
   * client string in a path is a path the client chose. Salting it with the
   * user id also stops one caller from guessing another's key.
   */
  async putAttachment(input: {
    body: Buffer;
    mime: string;
    filename: string;
    kind: AttachmentKind;
    attemptToken: string;
    uploadedByUserId: string;
    workspaceId: string | null;
  }): Promise<AttachmentView> {
    const mime = input.mime.split(';')[0].trim().toLowerCase();
    if (!ATTACHMENT_MIME_TYPES.includes(mime)) {
      throw new BadRequestException(
        'An attachment must be a JPEG, PNG, WebP or HEIC image.',
      );
    }
    if (input.body.byteLength === 0) {
      throw new BadRequestException('That file is empty.');
    }
    if (input.body.byteLength > MAX_ATTACHMENT_BYTES) {
      throw new BadRequestException('An attachment must be 8 MB or smaller.');
    }

    const stem = createHash('sha256')
      .update(`${input.uploadedByUserId}:${input.attemptToken}`)
      .digest('base64url')
      .slice(0, 43);

    // The replay check. A prefix match rather than an equality one because the
    // extension follows the mime, and only the stem is derived from the token.
    const [existing] = await this.db
      .select({
        objectKey: storedObjects.objectKey,
        kind: storedObjects.kind,
        mime: storedObjects.mime,
        sizeBytes: storedObjects.sizeBytes,
      })
      .from(storedObjects)
      .where(like(storedObjects.objectKey, `${input.kind}/${stem}.%`))
      .limit(1);

    if (existing) {
      return {
        objectKey: existing.objectKey,
        kind: input.kind,
        mime: existing.mime ?? mime,
        sizeBytes: existing.sizeBytes ?? input.body.byteLength,
        filename: input.filename,
        url: await this.signedUrl(existing.objectKey),
      };
    }

    const put = await this.storage.put({
      body: input.body,
      mime,
      filename: input.filename,
      kind: input.kind,
      keyHint: stem,
    });

    // Two flushes racing land here together. The unique on `object_key` is what
    // decides between them, and the loser wants the winner's row, not an error:
    // both replays are the same intent and both callers are owed the same key.
    await this.db
      .insert(storedObjects)
      .values({
        objectKey: put.objectKey,
        kind: input.kind,
        mime,
        sizeBytes: put.sizeBytes,
        uploadedByUserId: input.uploadedByUserId,
        workspaceId: input.workspaceId,
      })
      .onConflictDoNothing({ target: storedObjects.objectKey });

    return {
      objectKey: put.objectKey,
      kind: input.kind,
      mime,
      sizeBytes: put.sizeBytes,
      filename: input.filename,
      url: await this.signedUrl(put.objectKey),
    };
  }

  /** A short-lived read, for showing back what was attached. */
  signedUrl(objectKey: string, ttlSeconds = 300): Promise<string> {
    return this.storage.signedUrl(objectKey, ttlSeconds);
  }

  /**
   * Drop an object the uploader has not attached to anything yet.
   *
   * Scoped to the uploader on purpose: before a registration is created there
   * is no org to authorize against, so the only true owner of a loose object is
   * the account that put it there. An object already under a legal hold is
   * refused, because that hold outranks the person who uploaded it.
   */
  async removeOwnUnattached(
    objectKey: string,
    userId: string,
  ): Promise<boolean> {
    const [row] = await this.db
      .select({
        objectKey: storedObjects.objectKey,
        uploadedByUserId: storedObjects.uploadedByUserId,
        legalHold: storedObjects.legalHold,
      })
      .from(storedObjects)
      .where(eq(storedObjects.objectKey, objectKey))
      .limit(1);

    if (!row || row.uploadedByUserId !== userId || row.legalHold) return false;

    await this.storage.remove(objectKey);
    await this.db
      .delete(storedObjects)
      .where(eq(storedObjects.objectKey, objectKey));
    return true;
  }
}
