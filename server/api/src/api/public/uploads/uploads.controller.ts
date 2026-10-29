import {
  BadRequestException,
  Controller,
  Delete,
  NotFoundException,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import type { UploadedPropertyPhoto } from '@injishi/contracts';

import {
  StorageService,
  type AttachmentView,
  type StoredObjectView,
} from '../../../modules/storage/application/storage.service';
import {
  ATTACHMENT_KINDS,
  MAX_ATTACHMENT_BYTES,
  MAX_CERTIFICATE_BYTES,
  isAttachmentKind,
} from '../../../modules/storage/domain/storage-port';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import { UploadThrottlerGuard } from './upload-throttler.guard';

/**
 * Uploads → /api/v1/uploads (F-S09, ADR-026).
 *
 * One narrow route, and narrow is the point: this accepts a REGISTRATION
 * CERTIFICATE and nothing else. A general "upload anything" endpoint reachable
 * with a session is a file host, and it is also the thing every later caller
 * would reuse instead of asking for its own bounded route.
 *
 * Guarded throughout. There is no anonymous upload path and there must never be
 * one: bytes with no uploader cannot be retained, held or deleted correctly.
 *
 * Every route that ACCEPTS bytes is also throttled per person, after the session
 * guard (`UploadThrottlerGuard`: 30 uploads in 10 minutes across the three,
 * and 10 certificates). A refusal is a 429 with a readable message and
 * `Retry-After`. Removing an upload is not throttled: it frees space.
 *
 * Multipart rather than base64 JSON. `@fastify/multipart` is already registered
 * in `app.module.ts`, and streaming past a byte ceiling is something the parser
 * does properly — a base64 body has to be fully received before it can be
 * measured, which turns the size limit into a suggestion.
 */

/** The slice of the Fastify request this route touches (see `auth-http.ts`). */
interface MultipartRequest {
  isMultipart?: () => boolean;
  file?: (options?: {
    limits?: { fileSize?: number };
  }) => Promise<MultipartFile | undefined>;
  parts?: (options?: {
    limits?: { fileSize?: number };
  }) => AsyncIterableIterator<MultipartPart>;
}

interface MultipartFile {
  filename?: string;
  mimetype?: string;
  file?: { truncated?: boolean };
  toBuffer: () => Promise<Buffer>;
}

/** One part of a multipart body: either a file or a plain text field. */
type MultipartPart =
  | ({ type: 'file'; fieldname: string } & MultipartFile)
  | { type: 'field'; fieldname: string; value: unknown };

@Controller({ path: 'uploads', version: '1' })
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  /**
   * Store one attachment from a phone and return the key to reference it by
   * (ADR-038 parent contract, Uploads; child 0 task 2b).
   *
   * Three children send files and none of them should build its own route: a
   * fault report's photographs, a repair ticket's photographs, and a self
   * check-in's document and portrait. The write that needs the file carries the
   * returned `objectKey` and never the bytes, which keeps a large upload out of
   * a transaction, makes a retry of the write free, and lets the offline queue
   * persist a file path instead of a payload.
   *
   * This does not reopen the narrowness the certificate route above argues for.
   * `kind` is checked against `ATTACHMENT_KINDS`, a fixed short list in the
   * domain file — not passed through to the database enum. A route that takes a
   * `kind` is only a file host if the kinds are open, and these are not.
   */
  @Post()
  @UseGuards(SessionGuard, UploadThrottlerGuard)
  @SkipThrottle({ 'uploads-certificate': true })
  async attachment(
    @Req() request: MultipartRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<AttachmentView> {
    if (typeof request.isMultipart !== 'function' || !request.isMultipart()) {
      throw new BadRequestException('Send the file as multipart/form-data.');
    }
    if (typeof request.file !== 'function') {
      throw new BadRequestException('Send the file as multipart/form-data.');
    }

    if (typeof request.parts !== 'function') {
      throw new BadRequestException('Send the file as multipart/form-data.');
    }

    // Every part is walked, rather than `request.file()` picking the first one.
    // `kind` and `attemptToken` ride beside the file so this is one request and
    // not a JSON call followed by an upload, and a client is free to send them
    // after it — which `request.file()` cannot survive. It stops at the file and
    // leaves the trailing fields in the socket, so the body never completes and
    // the request hangs until the client gives up. Draining every part also
    // means field order is the client's business and not a contract.
    //
    // The ceiling is enforced by the PARSER, before the bytes are buffered, for
    // the same reason the certificate route does it there.
    let body: Buffer | null = null;
    let mimetype: string | undefined;
    let filename: string | undefined;
    let truncated = false;
    const fields: Record<string, string> = {};

    for await (const part of request.parts({
      limits: { fileSize: MAX_ATTACHMENT_BYTES },
    })) {
      if (part.type === 'file') {
        // A second file is drained and dropped: this route stores one object
        // and returns one key, and silently keeping the last would make which
        // photograph got stored depend on part order.
        const bytes = await part.toBuffer();
        if (body === null) {
          body = bytes;
          mimetype = part.mimetype;
          filename = part.filename;
          truncated = part.file?.truncated ?? false;
        }
        continue;
      }
      if (typeof part.value === 'string') {
        fields[part.fieldname] = part.value.trim();
      }
    }

    if (body === null) throw new BadRequestException('No file was sent.');
    if (truncated) {
      throw new BadRequestException('An attachment must be 8 MB or smaller.');
    }

    const kind = fields.kind || null;
    const attemptToken = fields.attemptToken || null;

    if (!kind || !isAttachmentKind(kind)) {
      throw new BadRequestException(
        `\`kind\` must be one of: ${ATTACHMENT_KINDS.join(', ')}.`,
      );
    }
    // Without a token there is no replay safety, and the queue always has one.
    // Minting a fallback here would silently turn a retry into a duplicate.
    if (!attemptToken || attemptToken.length > 200) {
      throw new BadRequestException(
        'Send the `attemptToken` this upload was created with.',
      );
    }

    return this.storage.putAttachment({
      body,
      mime: mimetype ?? 'application/octet-stream',
      filename: filename ?? 'attachment',
      kind,
      attemptToken,
      uploadedByUserId: user.id,
      // The workspace is not read from `x-workspace-id` here. An attachment is
      // uploaded BEFORE the write that gives it a home, and the write is what
      // knows which workspace it belongs to. Claiming one now would be guessing.
      workspaceId: null,
    });
  }

  /**
   * Store one certificate and return the key to attach it by.
   *
   * The key is what `CertificateInput.objectKey` carries into
   * `POST /registrations`, so the two steps stay separate on purpose: a person
   * can attach a document, change their mind, and attach another before any
   * registration exists to hang it on.
   */
  @Post('certificate')
  @UseGuards(SessionGuard, UploadThrottlerGuard)
  async certificate(
    @Req() request: MultipartRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<StoredObjectView> {
    if (typeof request.isMultipart !== 'function' || !request.isMultipart()) {
      throw new BadRequestException('Send the file as multipart/form-data.');
    }
    if (typeof request.file !== 'function') {
      throw new BadRequestException('Send the file as multipart/form-data.');
    }

    // The ceiling is enforced by the PARSER, before the bytes are buffered.
    // Checking `toBuffer().byteLength` afterwards means a 2 GB upload is fully
    // received into memory and only then refused.
    const uploaded = await request.file({
      limits: { fileSize: MAX_CERTIFICATE_BYTES },
    });
    if (!uploaded) throw new BadRequestException('No file was sent.');

    const body = await uploaded.toBuffer();
    if (uploaded.file?.truncated) {
      throw new BadRequestException('A certificate must be 10 MB or smaller.');
    }

    return this.storage.putCertificate({
      body,
      mime: uploaded.mimetype ?? 'application/octet-stream',
      filename: uploaded.filename ?? 'certificate',
      uploadedByUserId: user.id,
    });
  }

  /**
   * Store one property photograph and return the key to attach it by
   * (ADR-053, AC-I3).
   *
   * Shaped like the certificate route above rather than the generic attachment
   * route, deliberately. The attachment route is built for a PHONE with an offline
   * queue, so it demands an `attemptToken` to make a replayed flush idempotent.
   * This comes from an operator pressing a button in a browser: no queue, no
   * replay, and making the browser invent a token would buy nothing.
   *
   * No workspace guard, like its neighbours, and for the same reason: the bytes go
   * up BEFORE the write that gives them a home, and it is the attach call — which
   * does run behind `WorkspaceGuard` and `listing.manage` — that knows which
   * property they belong to. The object is also checked to really be a property
   * photograph at attach time, so a stray key cannot be hung on a listing.
   */
  @Post('property-photo')
  @UseGuards(SessionGuard, UploadThrottlerGuard)
  @SkipThrottle({ 'uploads-certificate': true })
  async propertyPhoto(
    @Req() request: MultipartRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<UploadedPropertyPhoto> {
    if (typeof request.isMultipart !== 'function' || !request.isMultipart()) {
      throw new BadRequestException('Send the file as multipart/form-data.');
    }
    if (typeof request.file !== 'function') {
      throw new BadRequestException('Send the file as multipart/form-data.');
    }

    // The ceiling is enforced by the PARSER, before the bytes are buffered, for
    // the same reason the certificate route does it there.
    const uploaded = await request.file({
      limits: { fileSize: MAX_ATTACHMENT_BYTES },
    });
    if (!uploaded) throw new BadRequestException('No file was sent.');

    const body = await uploaded.toBuffer();
    if (uploaded.file?.truncated) {
      throw new BadRequestException('A photograph must be 8 MB or smaller.');
    }

    return this.storage.putPropertyPhoto({
      body,
      mime: uploaded.mimetype ?? 'application/octet-stream',
      filename: uploaded.filename ?? 'photo',
      uploadedByUserId: user.id,
      // Not claimed here. The attach call is what knows the property, and
      // therefore the workspace; guessing one now would be guessing.
      workspaceId: null,
    });
  }

  /**
   * Remove a certificate the caller uploaded and has not attached yet.
   *
   * A 404 rather than a 403 when the object belongs to someone else: the two
   * answers together tell a stranger which keys exist, and a key is the only
   * thing standing between them and the document.
   */
  @Delete('certificate')
  @UseGuards(SessionGuard)
  async removeCertificate(
    @Query('objectKey') objectKey: string,
    @CurrentUser() user: SessionUser,
  ): Promise<{ removed: true }> {
    if (!objectKey) throw new BadRequestException('Name the object to remove.');
    const removed = await this.storage.removeOwnUnattached(objectKey, user.id);
    if (!removed) throw new NotFoundException('No such upload.');
    return { removed: true };
  }
}
