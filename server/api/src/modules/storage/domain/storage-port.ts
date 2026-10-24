/**
 * The object storage seam (F-S09, ADR-026 assumption 1).
 *
 * Shaped after the payment seam (ADR-020) on purpose: one port, one module that
 * reads the mode, and a mock adapter that lets everything downstream be built
 * and driven before the real store exists. Nothing outside
 * `storage.module.ts` names an adapter.
 *
 * F-S09 fixes the real store: S3-compatible MinIO hosted in Rwanda, encrypted
 * at rest, read through short-TTL signed URLs. That decision is not reopened
 * here. `S3StorageAdapter` implements it (`STORAGE_ADAPTER_MODE=live`); the
 * local disk adapter remains for development, and both mint keys through
 * `object-key.ts` so a key never depends on which one wrote it.
 */

export const STORAGE_PORT = Symbol('STORAGE_PORT');

/** Which adapter is wired. Mirrors `AdapterMode` in the payment seam. */
export type AdapterMode = 'local' | 'live';

/** The object kinds `stored_objects.kind` accepts (schema `stored_object_kind`). */
export type StoredObjectKind =
  | 'id_photo'
  | 'contract'
  | 'message_attachment'
  | 'avatar'
  | 'property_photo'
  | 'filing_copy'
  | 'certificate'
  /**
   * A training certificate PDF the platform ISSUED (ADR-049).
   *
   * Separate from `certificate`, which is a document a business uploads about
   * itself. This one is never uploaded by anybody, is about a person rather
   * than an org, and is reachable only by its holder or by staff through a
   * signed url. One kind for both would put them under one access rule and one
   * retention rule, and they share neither.
   */
  | 'training_certificate'
  /** ADR-058: a staff file's photograph, a work field read by anyone who reads files. */
  | 'staff_photo'
  /** ADR-058: a document on a staff file (an ID copy, a permit); `people.manage` only. */
  | 'staff_document'
  /** ADR-058: a file hung on a note, a policy, an announcement or a disciplinary record. */
  | 'hr_attachment'
  /** 058-payroll: a bank or MoMo file, or a declaration; `payroll.run` only. */
  | 'hr_pay_file'
  /** 2026-10-23: a business's logo, for its PSF membership certificate. */
  | 'org_logo';

export interface PutObjectInput {
  /** The raw bytes. Callers must size-check BEFORE reading a stream to here. */
  readonly body: Buffer;
  /** As declared by the client, already checked against an allowlist. */
  readonly mime: string;
  /** The original file name, used only to derive an extension. */
  readonly filename: string;
  readonly kind: StoredObjectKind;
  /**
   * A caller-supplied stable name for this object, when the caller needs the
   * SAME bytes to land on the same key twice (ADR-038 child 0, AC-S16).
   *
   * The offline queue flushes an upload by replaying it, and a replay that
   * minted a fresh key every time would leave an orphan in the store for every
   * retry. A hint makes the retry converge instead: the same hint yields the
   * same key, and `stored_objects.object_key` being unique turns the second
   * write into a no-op rather than a duplicate.
   *
   * It must already be safe to put in a path — hex or url-safe base64, no
   * separators and no dots. The caller derives it, never the client, because a
   * client-chosen key is a client-chosen path.
   *
   * Adapters that ignore it stay correct; they simply lose the convergence.
   */
  readonly keyHint?: string;
}

export interface PutObjectResult {
  /**
   * The key the rest of the platform stores and refers to.
   *
   * Opaque by contract. `org_certificates.object_key` is a foreign key onto
   * `stored_objects.object_key`, so this string outlives whichever adapter
   * produced it and must never encode a local path a later adapter cannot
   * honour.
   */
  readonly objectKey: string;
  readonly sizeBytes: number;
}

/**
 * What every store must do.
 *
 * Deliberately four operations and not a filesystem: `put` writes bytes and
 * names them, `signedUrl` hands out a short-lived read, `get` reads bytes back
 * into this process, and `remove` deletes. A caller that wants anything else is
 * reaching past the seam.
 *
 * IT WAS THREE, and `get` is the one addition, so the reason is worth keeping.
 * ADR-049 attaches an issued certificate to the mail that announces it, and its
 * Value sourcing table names this seam as where those bytes come from, "so a
 * resend always matches what was issued". Re-rendering the PDF in the mailer
 * instead would have been a second renderer of the same document: it would
 * agree today and diverge the first time the layout changed, and the file a
 * person was emailed would stop being the file a verifier can be shown.
 *
 * `get` is for a SERVER-side reader with bytes to do something with — a mail
 * attachment, today. It is never the way to hand a file to a browser:
 * `signedUrl` is, and it stays that way because a short-lived signed read is a
 * security property (F-S09 §10), not a convenience.
 */
export interface StoragePort {
  put(input: PutObjectInput): Promise<PutObjectResult>;
  /**
   * A read URL that expires. `ttlSeconds` is a ceiling the adapter may lower,
   * never raise: F-S09 §10 makes the short TTL a security property.
   */
  signedUrl(objectKey: string, ttlSeconds: number): Promise<string>;
  /**
   * The object's bytes, in this process.
   *
   * Throws when the key names nothing. A missing object is not an empty one,
   * and returning an empty buffer would let a caller attach a zero-byte PDF to
   * a mail and call it sent.
   */
  get(objectKey: string): Promise<Buffer>;
  remove(objectKey: string): Promise<void>;
}

/**
 * What a certificate upload may be.
 *
 * A scan or a photograph of a paper document, nothing else. The list is short
 * because it is a security control and not a convenience: an upload path that
 * accepts arbitrary content types is a file host, and this one is reachable by
 * anyone with a session.
 */
export const CERTIFICATE_MIME_TYPES: ReadonlyArray<string> = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

/**
 * 10 MB.
 *
 * A phone photograph of an A4 certificate is comfortably under this, and F-S09
 * §9 asks the path to survive a poor 4G link — a larger ceiling mostly buys
 * longer failed uploads.
 */
export const MAX_CERTIFICATE_BYTES = 10 * 1024 * 1024;

/**
 * A business's logo (2026-10-23): a picture, never a document, and small. It
 * is uploaded from the public PSF form under a verified ID check rather than
 * a session, so the allowlist and the limit are kept narrow on purpose.
 */
export const LOGO_MIME_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/**
 * The object kinds the shared mobile upload route accepts (ADR-038 parent
 * contract, Uploads).
 *
 * A deliberate subset of `StoredObjectKind`, and the subset IS the control. The
 * existing certificate route's comment is right that a general "upload
 * anything" endpoint reachable with a session is a file host; a route that
 * takes a `kind` only avoids becoming one if the kinds are enumerated here
 * rather than passed through. Three children send files — a fault report's
 * photographs, a repair ticket's photographs, and a self check-in's document
 * and portrait — and these four kinds are what those need.
 *
 * `certificate`, `contract` and `filing_copy` are absent on purpose: each has
 * its own bounded path, and none of them is uploaded from a phone.
 */
export const ATTACHMENT_KINDS = [
  'id_photo',
  'property_photo',
  'message_attachment',
  'avatar',
] as const satisfies ReadonlyArray<StoredObjectKind>;

export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export function isAttachmentKind(value: string): value is AttachmentKind {
  return (ATTACHMENT_KINDS as ReadonlyArray<string>).includes(value);
}

/**
 * What an attachment may be. Images only.
 *
 * Narrower than the certificate list, which also takes PDFs: every one of these
 * comes from `expo-image-picker` or a phone camera, so a PDF here would mean
 * something other than the flow that is meant to be happening.
 */
export const ATTACHMENT_MIME_TYPES: ReadonlyArray<string> = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
];

/**
 * 8 MB.
 *
 * A phone photograph at full resolution clears this; the clients downscale
 * before sending. The ceiling is enforced by the multipart parser, before the
 * bytes are buffered, for the same reason the certificate route does it there.
 */
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

/** The extension to store a given mime under, so a signed URL serves sensibly. */
export const MIME_EXTENSION: Readonly<Record<string, string>> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  // 058-payroll: the bank and MoMo files and the declarations Injishi builds.
  'text/csv': 'csv',
};
