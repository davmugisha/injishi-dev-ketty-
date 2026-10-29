import { describe, expect, it } from 'vitest';

import { sniffVideoMime } from './sniff-video';

const ftyp = (brand: string): Buffer =>
  Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftyp', 'latin1'), Buffer.from(brand, 'latin1'), Buffer.alloc(16)]);

describe('sniffVideoMime', () => {
  it.each([
    ['isom', 'video/mp4'],
    ['mp42', 'video/mp4'],
    ['M4V ', 'video/mp4'],
    ['qt  ', 'video/quicktime'],
  ])('an ISO media file of brand %j is %s', (brand, mime) => {
    expect(sniffVideoMime(ftyp(brand))).toBe(mime);
  });

  it('a HEIC picture or an m4a is not a video', () => {
    expect(sniffVideoMime(ftyp('heic'))).toBeNull();
    expect(sniffVideoMime(ftyp('M4A '))).toBeNull();
  });

  it('a WebM file is a video; another Matroska file is not', () => {
    const ebml = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0x82, 0x84]);
    expect(sniffVideoMime(Buffer.concat([ebml, Buffer.from('webm', 'latin1')]))).toBe('video/webm');
    expect(sniffVideoMime(Buffer.concat([ebml, Buffer.from('matroska', 'latin1')]))).toBeNull();
  });

  it('a JPEG renamed .mp4 is refused', () => {
    expect(sniffVideoMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
  });
});
