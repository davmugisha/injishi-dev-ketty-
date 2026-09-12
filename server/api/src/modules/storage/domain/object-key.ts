import { randomUUID } from 'node:crypto';

import { MIME_EXTENSION, type PutObjectInput } from './storage-port';

/**
 * The one place an object key is minted (F-S09).
 *
 * `stored_objects.object_key` outlives whichever adapter wrote the bytes, and
 * `org_certificates.object_key` is a foreign key onto it. So the key has to be
 * a function of the upload and never of the adapter: a key the local adapter
 * wrote in development and a key MinIO wrote in production must be the same
 * string for the same input, or a replayed upload converges on one key in one
 * mode and forks in the other. Both adapters call this and neither spells a key
 * of its own.
 */

/**
 * What a `keyHint` may be: url-safe base64 or hex, no separators, no dots.
 *
 * The service derives the hint and the port documents the rule, and it is
 * re-checked here anyway. A key is a path, and trusting one caller not to put a
 * separator in it is how the next caller does.
 */
export const KEY_HINT_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * The shape of every key `mintObjectKey` can return: a kind, optional date
 * partitions, one stem, one extension.
 *
 * Dots appear exactly once, before the extension, so no segment can be `.` or
 * `..`. That matters for the reads and deletes, which take a key from a column
 * rather than from this function: a key that walks out of its prefix is refused
 * before it reaches a store, instead of relying on every proxy between here and
 * the bucket to leave `..` alone.
 */
const OBJECT_KEY_PATTERN = /^[a-z_]+\/(?:[0-9]{4}\/[0-9]{2}\/)?[A-Za-z0-9_-]{1,64}\.[a-z0-9]{1,8}$/;

export type ObjectKeyInput = Pick<PutObjectInput, 'kind' | 'mime' | 'keyHint'>;

/**
 * The key an upload is stored under.
 *
 * - `kind/yyyy/mm/<uuid>.<ext>` for an ordinary upload, partitioned by the UTC
 *   month so a retention sweep can walk a prefix rather than the whole store.
 * - `kind/<hint>.<ext>` when the caller supplies a valid `keyHint`, so a
 *   replayed upload lands on the key it wrote last time (ADR-038 child 0,
 *   AC-S16). The date partition is dropped on purpose: a write queued in a
 *   corridor may not flush until the following month, and a key that moved with
 *   the calendar would stop converging exactly when it was needed most. A hint
 *   that fails `KEY_HINT_PATTERN` is ignored, not trusted, and the upload gets
 *   an ordinary key.
 *
 * The client's file name is never part of the key. It is attacker-supplied and
 * would carry its own separators, dots and encoding into a path, so the
 * extension comes from the mime, which the caller already checked against an
 * allowlist.
 *
 * `now` and `newId` exist for tests; production calls pass neither.
 */
export function mintObjectKey(
  input: ObjectKeyInput,
  now: Date = new Date(),
  newId: () => string = randomUUID,
): string {
  const extension = MIME_EXTENSION[input.mime] ?? 'bin';
  if (input.keyHint && KEY_HINT_PATTERN.test(input.keyHint)) {
    return `${input.kind}/${input.keyHint}.${extension}`;
  }
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${input.kind}/${yyyy}/${mm}/${newId()}.${extension}`;
}

/** Whether a string has the shape of a key `mintObjectKey` could have minted. */
export function isObjectKey(key: string): boolean {
  return OBJECT_KEY_PATTERN.test(key);
}
