import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

/**
 * What every property photograph is turned into before it is stored.
 *
 * WHY. Photos were stored exactly as uploaded. A phone original is 4032 × 3024
 * and 1.5–5 MB, which every guest then downloaded on mobile data for one image
 * in a gallery; and it still carried its EXIF block — the phone model, when it
 * was taken and, whenever location services were on, WHERE. A listing photo is
 * public, so that was a host's home address published with their picture.
 *
 * WHAT. Turned upright first (from the EXIF orientation, which is about to be
 * thrown away and would otherwise leave a portrait photo lying on its side),
 * fitted inside 2048 px on its longest side (never enlarged), and re-encoded as
 * a progressive JPEG at quality 82. sharp writes NO metadata unless asked to,
 * so EXIF, GPS, XMP and IPTC are all dropped; only the colour profile is kept,
 * converted to sRGB, so colours do not shift.
 *
 * 2048 px covers the widest place a photo is shown (a full-width gallery on a
 * large screen) at ordinary density; JPEG because every browser renders it,
 * which a stored HEIC or a 16-bit PNG would not.
 */
export const PHOTO_MAX_EDGE_PX = 2048;
export const PHOTO_JPEG_QUALITY = 82;

export interface NormalisedPhoto {
  body: Buffer;
  mime: 'image/jpeg';
  width: number;
  height: number;
}

export async function normalisePhoto(input: Buffer, mime: string): Promise<NormalisedPhoto> {
  try {
    const { data, info } = await sharp(input, { failOn: 'error' })
      // Apply the EXIF orientation to the pixels before the EXIF goes.
      .rotate()
      .resize({
        width: PHOTO_MAX_EDGE_PX,
        height: PHOTO_MAX_EDGE_PX,
        fit: 'inside',
        withoutEnlargement: true,
      })
      // A transparent PNG becomes JPEG on white, not on black.
      .flatten({ background: '#ffffff' })
      .toColourspace('srgb')
      .jpeg({ quality: PHOTO_JPEG_QUALITY, progressive: true, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    return { body: data, mime: 'image/jpeg', width: info.width, height: info.height };
  } catch {
    // Most often an iPhone's HEIC original: this build cannot decode HEVC, and
    // no guest's browser could show a stored HEIC either. Say what to do.
    if (mime === 'image/heic' || mime === 'image/heif') {
      throw new BadRequestException(
        "We couldn't convert this HEIC photo. Upload it as a JPEG instead (on an iPhone: Settings → Camera → Formats → Most Compatible).",
      );
    }
    throw new BadRequestException(
      "We couldn't read that image. Try another photo, saved as a JPEG or PNG.",
    );
  }
}
