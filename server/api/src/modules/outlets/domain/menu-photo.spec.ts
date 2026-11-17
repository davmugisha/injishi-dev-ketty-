import { describe, expect, it } from 'vitest';

import {
  itemPhoto,
  libraryPhoto,
  NEW_UPLOAD,
  PHOTO_INPUT,
  photoColumn,
  uploadColumn,
  uploadedKey,
  uploadVersion,
} from './menu-photo';

const ITEM = '742fd289-acaf-4b2f-84f8-5216b552714a';
const KEY = 'property_photo/2026/11/0b5a2f8e-1c2d-4e5f-8a9b-0c1d2e3f4a5b.jpg';

describe('menu photo', () => {
  it('keeps a library choice as one library key, and reads it back', () => {
    expect(photoColumn('grilled_chicken')).toEqual(['library:grilled_chicken']);
    expect(libraryPhoto(photoColumn('grilled_chicken'))).toBe('grilled_chicken');
    expect(itemPhoto(ITEM, photoColumn('beer'))).toBe('beer');
  });

  it('clears on null, and refuses a name that is no library file', () => {
    expect(photoColumn(null)).toBeNull();
    expect(photoColumn('../etc/passwd')).toBeNull();
    expect(photoColumn('Beer')).toBeNull();
  });

  it('keeps an upload by its storage key, and reads it back as an address with a version', () => {
    expect(uploadColumn(KEY)).toEqual([KEY]);
    expect(uploadedKey([KEY])).toBe(KEY);
    expect(itemPhoto(ITEM, [KEY])).toBe(`upload:${ITEM}.${uploadVersion(KEY)}`);
    expect(uploadVersion(KEY)).toMatch(/^[0-9a-f]{12}$/);
    expect(uploadVersion(KEY)).not.toBe(uploadVersion(KEY.replace('0b5a', '1b5a')));
  });

  it('never keeps a key that could climb out of the storage root', () => {
    expect(uploadColumn('../../secrets/x.jpg')).toBeNull();
    expect(uploadColumn('/etc/passwd')).toBeNull();
    expect(uploadedKey(['property_photo/2026/11/../x.jpg'])).toBeNull();
  });

  it('reads nothing from a column that holds no choice', () => {
    expect(itemPhoto(ITEM, null)).toBeNull();
    expect(itemPhoto(ITEM, undefined)).toBeNull();
    expect(itemPhoto(ITEM, { library: 'beer' })).toBeNull();
    expect(libraryPhoto(['library:Bad Name'])).toBeNull();
  });

  it('accepts on the wire a library name, a new upload, or the current upload', () => {
    const id = '0b5a2f8e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
    expect(PHOTO_INPUT.test('beer')).toBe(true);
    expect(PHOTO_INPUT.test(`upload:${id}`)).toBe(true);
    expect(NEW_UPLOAD.exec(`upload:${id}`)?.[1]).toBe(id);
    expect(PHOTO_INPUT.test(itemPhoto(ITEM, [KEY]) as string)).toBe(true);
    expect(NEW_UPLOAD.test(itemPhoto(ITEM, [KEY]) as string)).toBe(false);
    expect(PHOTO_INPUT.test('upload:../x')).toBe(false);
    expect(PHOTO_INPUT.test('https://evil.example/x.jpg')).toBe(false);
  });
});
