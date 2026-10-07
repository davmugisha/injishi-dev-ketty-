import { sniffMime } from './sniff-mime';

/**
 * The HR upload's type check reads bytes, not names (058-people-file security
 * model). Each case is the real signature of the format.
 */
describe('sniffMime', () => {
  it('knows a PDF, a JPEG, a PNG, a WebP and a HEIC by their first bytes', () => {
    expect(sniffMime(Buffer.from('%PDF-1.7\n'))).toBe('application/pdf');
    expect(sniffMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]))).toBe('image/jpeg');
    expect(sniffMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('image/png');
    expect(sniffMime(Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 ')]))).toBe(
      'image/webp',
    );
    expect(sniffMime(Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypheic'), Buffer.alloc(8)]))).toBe(
      'image/heic',
    );
  });

  it('refuses anything else, whatever it is called', () => {
    expect(sniffMime(Buffer.from('<html><script>alert(1)</script>'))).toBeNull();
    expect(sniffMime(Buffer.from('MZ\x90\x00'))).toBeNull();
    // An MP4 is an ftyp box too, with a video brand.
    expect(sniffMime(Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(8)]))).toBeNull();
    expect(sniffMime(Buffer.alloc(0))).toBeNull();
  });
});
