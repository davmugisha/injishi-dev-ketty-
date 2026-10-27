import { createHash } from 'node:crypto';

import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { eq, like } from 'drizzle-orm';

import { orgCertificates, storedObjects } from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import {
  ATTACHMENT_MIME_TYPES,
  CERTIFICATE_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  MAX_CERTIFICATE_BYTES,
  STORAGE_PORT,
  type AttachmentKind,
  type StoragePort,
  type StoredObjectKind,
} from '../domain/storage-port';
import { sniffMime, type SniffedMime } from '../domain/sniff-mime';
import { normalisePhoto } from './photo-normaliser';

/** What an HR upload is for, and the stored kind, the formats and the ceiling of each. */
const HR_FILE_RULES = {
  photo: { kind: 'staff_photo', mimes: ['image/jpeg', 'image/png', 'image/heic', 'image/webp'], maxBytes: 5 * 1024 * 1024 },
  document: {
    kind: 'staff_document',
    mimes: ['application/pdf', 'image/jpeg', 'image/png', 'image/heic'],
    maxBytes: 10 * 1024 * 1024,
  },
  attachment: {
    kind: 'hr_attachment',
    mimes: ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp'],
    maxBytes: 10 * 1024 * 1024,
  },
} as const satisfies Record<string, { kind: StoredObjectKind; mimes: readonly SniffedMime[]; maxBytes: number }>;

export type HrFilePurpose = keyof typeof HR_FILE_RULES;

/** The largest HR upload of any purpose, for the multipart parser's ceiling. */
export const MAX_HR_FILE_BYTES = 10 * 1024 * 1024;

/** The stored kind an HR purpose is kept as. */
export function hrFileKind(purpose: HrFilePurpose): StoredObjectKind {
  return HR_FILE_RULES[purpose].kind;
}

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
 * The same shape with `kind` pinned to the literal (ADR-053).
 *
 * Narrow rather than wide on purpose: the uploads route declares
 * `UploadedPropertyPhoto` from `@injishi/contracts`, which pins `kind` to
 * `property_photo`, and the wide `AttachmentKind` would not satisfy it. The same
 * reasoning `StoredObjectView` already records for `certificate`.
 */
export interface PropertyPhotoUpload extends Omit<AttachmentView, 'kind'> {
  kind: 'property_photo';
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

  /**
   * Store one property photograph and record it (ADR-053, AC-I3).
   *
   * Shaped like `putCertificate` rather than `putAttachment`, deliberately. The
   * attachment route is built for a PHONE with an offline queue, so it demands an
   * `attemptToken` to make a replayed flush idempotent. This upload comes from an
   * operator pressing a button in a browser: there is no queue, no replay, and
   * demanding a token the browser would have to invent buys nothing.
   *
   * Images only, and the same narrow allowlist attachments use. A PDF here would
   * mean something other than the flow that is meant to be happening.
   */
  async putPropertyPhoto(input: {
    body: Buffer;
    mime: string;
    filename: string;
    uploadedByUserId: string;
    workspaceId: string | null;
  }): Promise<PropertyPhotoUpload> {
    const mime = input.mime.split(';')[0].trim().toLowerCase();
    if (!ATTACHMENT_MIME_TYPES.includes(mime)) {
      throw new BadRequestException(
        'A photograph must be a JPEG, PNG, WebP or HEIC image.',
      );
    }
    if (input.body.byteLength === 0) {
      throw new BadRequestException('That file is empty.');
    }
    if (input.body.byteLength > MAX_ATTACHMENT_BYTES) {
      throw new BadRequestException('A photograph must be 8 MB or smaller.');
    }

    // Upright, fitted to 2048 px, re-encoded as JPEG and stripped of every
    // metadata block (camera, time taken, GPS) before anything is stored:
    // `photo-normaliser.ts` says why. The original never reaches storage.
    const photo = await normalisePhoto(input.body, mime);
    const filename = `${input.filename.replace(/\.[^./\\]*$/, '') || 'photo'}.jpg`;

    const kind = 'property_photo' as const;
    const put = await this.storage.put({
      body: photo.body,
      mime: photo.mime,
      filename,
      kind,
    });

    await this.db.insert(storedObjects).values({
      objectKey: put.objectKey,
      kind,
      mime: photo.mime,
      sizeBytes: put.sizeBytes,
      uploadedByUserId: input.uploadedByUserId,
      workspaceId: input.workspaceId,
    });

    return {
      objectKey: put.objectKey,
      kind,
      mime: photo.mime,
      sizeBytes: put.sizeBytes,
      filename,
      // Returned straight away so the operator sees the picture they just sent,
      // without a second round trip to ask for it.
      url: await this.signedUrl(put.objectKey),
    };
  }

  /**
   * What kind of object is this key? (ADR-053)
   *
   * An attach call carries a key the caller chose, so the thing it points at has
   * to be checked before it is hung on a property. Without this, a property could
   * be pointed at a certificate's key and then published, which would publish a
   * scan of somebody's tax clearance as a photograph of a hotel.
   */
  async describe(objectKey: string): Promise<{
    id: string;
    objectKey: string;
    kind: string;
    mime: string | null;
    sizeBytes: number | null;
    uploadedByUserId: string | null;
    workspaceId: string | null;
    legalHold: boolean;
  } | null> {
    const [row] = await this.db
      .select({
        id: storedObjects.id,
        objectKey: storedObjects.objectKey,
        kind: storedObjects.kind,
        mime: storedObjects.mime,
        sizeBytes: storedObjects.sizeBytes,
        uploadedByUserId: storedObjects.uploadedByUserId,
        workspaceId: storedObjects.workspaceId,
        legalHold: storedObjects.legalHold,
      })
      .from(storedObjects)
      .where(eq(storedObjects.objectKey, objectKey))
      .limit(1);
    return row ?? null;
  }

  /**
   * Put an object under legal hold and give it a home: it has become evidence
   * (a drawn signature on a lease the moment the signature stands). Held, it
   * can no longer be removed by its uploader (`removeOwnUnattached`) or any
   * retention sweep. Never lifted here: a hold is released by a person, on
   * the record, or not at all.
   */
  async holdObject(id: string, workspaceId: string | null): Promise<void> {
    await this.db
      .update(storedObjects)
      .set({ legalHold: true, ...(workspaceId ? { workspaceId } : {}) })
      .where(eq(storedObjects.id, id));
  }

  /**
   * Store a training certificate PDF the PLATFORM generated (ADR-049, AC-13).
   *
   * It lives here rather than in the training module because this service owns
   * the invariant in the class header: bytes and their `stored_objects` row are
   * written as one act. A second writer of that table is how an object without
   * a row eventually exists, and an object without a row is outside retention
   * and outside legal hold.
   *
   * WHY IT IS NOT `putCertificate`. That method takes an UPLOAD: a scan or a
   * photograph a person chose, so it checks a mime allowlist and a size
   * ceiling, and neither check means anything here. These bytes were produced
   * by `PdfCertificateRenderer` moments ago and are a PDF by construction. A
   * mime allowlist exists to distrust a client, and there is no client.
   *
   * `keyHint` is the SERIAL, so re-rendering a certificate converges on the
   * same key instead of orphaning the previous file in the store. A serial is
   * unique and never reissued, which is exactly the property a stable key
   * needs, and `stored_objects.object_key` being unique turns the second write
   * into a no-op rather than a duplicate row.
   */
  async putTrainingCertificate(input: {
    body: Buffer;
    serial: string;
    issuedByUserId: string;
  }): Promise<string> {
    const kind = 'training_certificate' as const;
    const mime = 'application/pdf';

    const put = await this.storage.put({
      body: input.body,
      mime,
      filename: `${input.serial}.pdf`,
      kind,
      keyHint: input.serial.replace(/[^A-Za-z0-9]/g, ''),
    });

    await this.db
      .insert(storedObjects)
      .values({
        objectKey: put.objectKey,
        kind,
        mime,
        sizeBytes: put.sizeBytes,
        // The trainer who ticked the roster. There is no uploader, and
        // recording who caused the file to exist is the useful answer.
        uploadedByUserId: input.issuedByUserId,
        // No workspace. A certificate belongs to a PERSON, not to a business,
        // which is also why the holder's business name is recorded on the
        // certificate row and never printed.
        workspaceId: null,
      })
      .onConflictDoNothing({ target: storedObjects.objectKey });

    return put.objectKey;
  }

  /**
   * Store one HR file and record it (ADR-058, 058-people-file): a staff
   * photograph, a document on a file, or an attachment on a note, a policy, an
   * announcement or a disciplinary record.
   *
   * The type is read from the bytes (`sniffMime`), never from the file name or
   * the declared type, and checked against the purpose's own list: a photo is an
   * image, a document or an attachment may also be a PDF. The workspace is
   * recorded at once, unlike a phone attachment's, because the upload already
   * runs behind `WorkspaceGuard`; the attach call checks the object is this
   * workspace's and of the purpose's kind before hanging it on anything.
   */
  async putHrFile(input: {
    body: Buffer;
    filename: string;
    purpose: HrFilePurpose;
    uploadedByUserId: string;
    workspaceId: string;
  }): Promise<{ objectKey: string; purpose: HrFilePurpose; mime: string; sizeBytes: number }> {
    const rule = HR_FILE_RULES[input.purpose];
    if (input.body.byteLength === 0) throw new BadRequestException('That file is empty.');
    if (input.body.byteLength > rule.maxBytes) {
      throw new BadRequestException(`That file is larger than ${rule.maxBytes / (1024 * 1024)} MB.`);
    }
    const mime = sniffMime(input.body);
    if (!mime || !(rule.mimes as readonly string[]).includes(mime)) {
      throw new BadRequestException(
        input.purpose === 'photo'
          ? 'A photo must be a JPEG, PNG, HEIC or WebP image.'
          : 'A file must be a PDF, or a JPEG, PNG or HEIC image.',
      );
    }
    const put = await this.storage.put({
      body: input.body,
      mime,
      filename: input.filename,
      kind: rule.kind,
    });
    await this.db.insert(storedObjects).values({
      objectKey: put.objectKey,
      kind: rule.kind,
      mime,
      sizeBytes: put.sizeBytes,
      uploadedByUserId: input.uploadedByUserId,
      workspaceId: input.workspaceId,
    });
    return { objectKey: put.objectKey, purpose: input.purpose, mime, sizeBytes: put.sizeBytes };
  }

  /**
   * Store a file payroll built: a bank or MoMo file, or a declaration
   * (058-payroll AC-PY10, AC-PY12). Like a training certificate, these bytes
   * were made here a moment ago, so there is no client to distrust and no
   * mime to sniff. They carry wages and account numbers: kept private, against
   * the workspace, read only through a five minute link.
   */
  async putHrPayFile(input: { body: Buffer; filename: string; workspaceId: string; createdByUserId: string }): Promise<string> {
    const kind = 'hr_pay_file' as const;
    const mime = 'text/csv';
    const put = await this.storage.put({ body: input.body, mime, filename: input.filename, kind });
    await this.db.insert(storedObjects).values({
      objectKey: put.objectKey,
      kind,
      mime,
      sizeBytes: put.sizeBytes,
      uploadedByUserId: input.createdByUserId,
      workspaceId: input.workspaceId,
    });
    return put.objectKey;
  }

  /**
   * Store a lease contract PDF the rentals module rendered (blueprint 1.2): a
   * version before signatures, or its signed copy with the audit trail page.
   * Like a training certificate, the bytes were made here a moment ago, so
   * there is no client to distrust. `keyHint` is derived from the version, so
   * rendering the same copy twice converges on one object. A signed copy is
   * put under legal hold: it is the evidence of an agreement.
   */
  async putLeaseContract(input: {
    body: Buffer;
    filename: string;
    keyHint: string;
    workspaceId: string;
    createdByUserId: string | null;
    legalHold: boolean;
  }): Promise<{ objectKey: string; id: string }> {
    const kind = 'lease_contract' as const;
    const mime = 'application/pdf';
    const put = await this.storage.put({
      body: input.body,
      mime,
      filename: input.filename,
      kind,
      keyHint: input.keyHint,
    });
    await this.db
      .insert(storedObjects)
      .values({
        objectKey: put.objectKey,
        kind,
        mime,
        sizeBytes: put.sizeBytes,
        uploadedByUserId: input.createdByUserId,
        workspaceId: input.workspaceId,
        legalHold: input.legalHold,
      })
      .onConflictDoNothing({ target: storedObjects.objectKey });
    const [row] = await this.db
      .select({ id: storedObjects.id })
      .from(storedObjects)
      .where(eq(storedObjects.objectKey, put.objectKey))
      .limit(1);
    if (!row) throw new Error(`stored object ${put.objectKey} vanished`);
    return { objectKey: put.objectKey, id: row.id };
  }

  /**
   * Store a payment receipt PDF the rentals module rendered (WP 1.6): made
   * here a moment ago, keyed by the payment so a second render converges on
   * one object. Not under legal hold: it can be rendered again from the rows.
   */
  async putPaymentReceipt(input: {
    body: Buffer;
    filename: string;
    keyHint: string;
    workspaceId: string;
  }): Promise<{ objectKey: string; id: string }> {
    return this.putRendered('payment_receipt', 'application/pdf', input);
  }

  /** A file this process rendered: stored under a stable key and recorded once. */
  private async putRendered(
    kind: 'payment_receipt',
    mime: string,
    input: { body: Buffer; filename: string; keyHint: string; workspaceId: string },
  ): Promise<{ objectKey: string; id: string }> {
    const put = await this.storage.put({ body: input.body, mime, filename: input.filename, kind, keyHint: input.keyHint });
    await this.db
      .insert(storedObjects)
      .values({ objectKey: put.objectKey, kind, mime, sizeBytes: put.sizeBytes, uploadedByUserId: null, workspaceId: input.workspaceId })
      .onConflictDoNothing({ target: storedObjects.objectKey });
    const [row] = await this.db.select({ id: storedObjects.id }).from(storedObjects).where(eq(storedObjects.objectKey, put.objectKey)).limit(1);
    if (!row) throw new Error(`stored object ${put.objectKey} vanished`);
    return { objectKey: put.objectKey, id: row.id };
  }

  /** A short-lived read, for showing back what was attached. */
  signedUrl(objectKey: string, ttlSeconds = 300): Promise<string> {
    return this.storage.signedUrl(objectKey, ttlSeconds);
  }

  /**
   * The bytes themselves, for a sender inside this process (ADR-049 AC-20).
   *
   * The one caller attaches an issued certificate to the mail announcing it.
   * It reads the stored file rather than re-rendering, so the PDF in somebody's
   * inbox is byte for byte the PDF a verifier can be shown.
   *
   * Never for a browser: that is `signedUrl`, and the short TTL on it is a
   * security property rather than a convenience.
   */
  readBytes(objectKey: string): Promise<Buffer> {
    return this.storage.get(objectKey);
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

    /*
     * ATTACHED means submitted, and submitted means evidence.
     *
     * This used to check the uploader and the legal hold flag and nothing else,
     * so the registrant could delete a certificate that a field verifier was on
     * their way to read. It was worse than it looks: the bytes went FIRST, and
     * the row delete then hit `org_certificates.object_key`'s foreign key and
     * failed, which left a certificate row pointing at bytes that no longer
     * existed and answered the caller with a 500. Nothing sets `legal_hold`
     * today, so it stopped nobody.
     */
    const [attached] = await this.db
      .select({ id: orgCertificates.id })
      .from(orgCertificates)
      .where(eq(orgCertificates.objectKey, objectKey))
      .limit(1);
    if (attached) return false;

    /*
     * The row goes first, and the bytes after.
     *
     * The other order loses the file whenever the delete is refused, and a
     * missing object with a row still pointing at it is unrecoverable. This
     * order can leave bytes with no row — orphaned storage, sweepable, and not
     * a document anybody was relying on.
     */
    await this.db
      .delete(storedObjects)
      .where(eq(storedObjects.objectKey, objectKey));
    await this.storage.remove(objectKey);
    return true;
  }
}
