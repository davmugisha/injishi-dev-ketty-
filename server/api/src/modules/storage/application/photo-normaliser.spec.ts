import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

import { normalisePhoto, PHOTO_MAX_EDGE_PX } from './photo-normaliser';

/**
 * Property photos are resized and stripped before storage (2026-10-08).
 *
 * The originals were stored as uploaded: a 1.6 MB, 4032 × 3024 iPhone JPEG
 * still carrying its EXIF block, which on a phone with location services on
 * includes where the photo was taken. These build a photo like that and prove
 * what comes out is small, upright and says nothing about the camera.
 */
describe('normalisePhoto', () => {
  /** A phone-sized photo, sideways in pixels with EXIF orientation 6, plus a GPS block. */
  async function phoneOriginal(): Promise<Buffer> {
    return sharp({
      create: { width: 4032, height: 3024, channels: 3, background: { r: 120, g: 160, b: 90 } },
    })
      .jpeg({ quality: 95 })
      .withMetadata({
        orientation: 6,
        exif: {
          IFD0: { Make: 'Apple', Model: 'iPhone 8 Plus' },
          IFD3: {
            GPSLatitudeRef: 'S',
            GPSLatitude: '1/1 56/1 0/1',
            GPSLongitudeRef: 'E',
            GPSLongitude: '30/1 3/1 0/1',
          },
        },
      })
      .toBuffer();
  }

  it('fits the photo inside the size limit', async () => {
    const out = await normalisePhoto(await phoneOriginal(), 'image/jpeg');
    expect(Math.max(out.width, out.height)).toBe(PHOTO_MAX_EDGE_PX);
    expect(out.mime).toBe('image/jpeg');
  });

  it('turns it upright before dropping the orientation tag', async () => {
    const out = await normalisePhoto(await phoneOriginal(), 'image/jpeg');
    // Orientation 6 is a 90° turn: the stored landscape pixels are a portrait photo.
    expect(out.height).toBeGreaterThan(out.width);
    const meta = await sharp(out.body).metadata();
    expect(meta.orientation ?? 1).toBe(1);
  });

  it('keeps no EXIF, GPS, XMP or IPTC', async () => {
    const original = await phoneOriginal();
    expect((await sharp(original).metadata()).exif).toBeDefined();

    const out = await normalisePhoto(original, 'image/jpeg');
    const meta = await sharp(out.body).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
    expect(meta.iptc).toBeUndefined();
    expect(out.body.includes(Buffer.from('iPhone'))).toBe(false);
  });

  it('is much smaller than the original', async () => {
    const original = await phoneOriginal();
    const out = await normalisePhoto(original, 'image/jpeg');
    expect(out.body.byteLength).toBeLessThan(original.byteLength / 2);
  });

  it('never enlarges a small photo', async () => {
    const small = await sharp({
      create: { width: 640, height: 480, channels: 3, background: { r: 10, g: 10, b: 10 } },
    })
      .png()
      .toBuffer();
    const out = await normalisePhoto(small, 'image/png');
    expect([out.width, out.height]).toEqual([640, 480]);
    expect(out.mime).toBe('image/jpeg');
  });

  it('refuses bytes that are not an image, in words', async () => {
    await expect(normalisePhoto(Buffer.from('not a picture'), 'image/jpeg')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('tells an iPhone user how to send a JPEG when a HEIC cannot be read', async () => {
    await expect(normalisePhoto(Buffer.from('not really heic'), 'image/heic')).rejects.toThrow(
      'Most Compatible',
    );
  });
});
