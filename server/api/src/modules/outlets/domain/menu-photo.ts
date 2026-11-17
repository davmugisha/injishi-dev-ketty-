import { createHash } from 'node:crypto';

/**
 * THE PHOTO A MENU ITEM SHOWS, kept in the item's `photo_object_keys` column as a one-element array:
 *
 * - a photo from the library the app ships (`/public/menu`), named by its file: `["library:beer"]`;
 * - a photo the owner uploaded: the object storage key it was stored under, `["property_photo/2026/11/<uuid>.jpg"]`.
 *   The `library:` scheme can never be a storage key, so the two cannot be mistaken for each other.
 *
 * On the wire the item's `photo` is the library name (`beer`), or for an upload `upload:<itemId>.<version>`: the app
 * builds the photo's address from it, and the version (from the key) changes whenever the photo is replaced, so a
 * browser never shows a stale copy. A write names a NEW upload by the stored object it was saved as,
 * `upload:<storedObjectId>`; the service checks that object belongs to the workspace before keeping its key.
 * Pure, so the read and the write can never disagree.
 */

const SCHEME = 'library:';
/** A library photo's name: what the app's file is called, without `.jpg`. */
export const LIBRARY_PHOTO = /^[a-z0-9_]{1,40}$/;
/** A new upload, as a write names it: `upload:<storedObjectId>`. */
export const NEW_UPLOAD = /^upload:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
/** What a write may send: a library name, a new upload, or (unchanged) the item's current upload. */
export const PHOTO_INPUT = /^(?:[a-z0-9_]{1,40}|upload:[0-9a-f-]{36}(?:\.[0-9a-f]{1,16})?)$/;
/** A storage key as `mintObjectKey` writes them: `kind/yyyy/mm/name.ext`, nothing that climbs out of the root. */
const OBJECT_KEY = /^[a-z_]+\/\d{4}\/\d{2}\/[A-Za-z0-9_-]+\.[a-z0-9]{2,5}$/;

/** The column value for a library choice; null clears the column, so the app suggests a photo from the name again. */
export function photoColumn(photo: string | null): string[] | null {
  return photo && LIBRARY_PHOTO.test(photo) ? [`${SCHEME}${photo}`] : null;
}

/** The column value for an uploaded photo, by the key it was stored under. */
export function uploadColumn(objectKey: string): string[] | null {
  return OBJECT_KEY.test(objectKey) ? [objectKey] : null;
}

/** The storage key of the photo uploaded for an item, or null when its photo is not an upload. */
export function uploadedKey(column: unknown): string | null {
  if (!Array.isArray(column)) return null;
  const key = column.find((k): k is string => typeof k === 'string' && OBJECT_KEY.test(k));
  return key ?? null;
}

/** The library photo kept for an item, or null when none was chosen (or the column holds anything else). */
export function libraryPhoto(column: unknown): string | null {
  if (!Array.isArray(column)) return null;
  for (const key of column) {
    if (typeof key !== 'string' || !key.startsWith(SCHEME)) continue;
    const name = key.slice(SCHEME.length);
    if (LIBRARY_PHOTO.test(name)) return name;
  }
  return null;
}

/** The short version of an uploaded photo: changes with its key, so a replaced photo gets a new address. */
export function uploadVersion(objectKey: string): string {
  return createHash('sha1').update(objectKey).digest('hex').slice(0, 12);
}

/** The item's `photo` as every read sends it: an upload, else a library name, else null. */
export function itemPhoto(itemId: string, column: unknown): string | null {
  const key = uploadedKey(column);
  if (key) return `upload:${itemId}.${uploadVersion(key)}`;
  return libraryPhoto(column);
}
