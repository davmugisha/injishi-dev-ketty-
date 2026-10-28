import { cleanName, sniffMessageMime } from './message-files-storage';

const bytes = (...b: number[]): Buffer => Buffer.from([...b, ...new Array(16).fill(0x20)]);

describe('message files are typed from their bytes', () => {
  it('knows the photos and PDFs whatever they claim', () => {
    expect(sniffMessageMime(bytes(0xff, 0xd8, 0xff), 'application/octet-stream')).toBe('image/jpeg');
    expect(sniffMessageMime(Buffer.from('%PDF-1.7 ...'), 'image/png')).toBe('application/pdf');
  });

  it('takes a WebM as a voice note only when sent as audio', () => {
    const webm = bytes(0x1a, 0x45, 0xdf, 0xa3);
    expect(sniffMessageMime(webm, 'audio/webm;codecs=opus')).toBe('audio/webm');
    expect(sniffMessageMime(webm, 'application/pdf')).toBeNull();
    expect(sniffMessageMime(Buffer.from('OggS\0\0\0\0'), 'audio/ogg')).toBe('audio/ogg');
    const m4a = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypM4A '), Buffer.alloc(8)]);
    expect(sniffMessageMime(m4a, 'audio/mp4')).toBe('audio/mp4');
    expect(sniffMessageMime(m4a, 'video/mp4')).toBeNull();
  });

  it('lets an Office file be what it says only when its bytes are a zip or OLE box', () => {
    const zip = bytes(0x50, 0x4b, 0x03, 0x04);
    const docx = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    expect(sniffMessageMime(zip, docx)).toBe(docx);
    expect(sniffMessageMime(zip, 'application/zip')).toBeNull();
    expect(sniffMessageMime(Buffer.from('a,b\n1,2\n'), 'text/csv')).toBe('text/csv');
    expect(sniffMessageMime(Buffer.from([0x41, 0x00, 0x42]), 'text/plain')).toBeNull();
    expect(sniffMessageMime(Buffer.from('<svg/>'), 'image/svg+xml')).toBeNull();
  });

  it('cleans a file name of paths and quotes', () => {
    expect(cleanName('C:\\Users\\me\\"receipt".pdf')).toBe('receipt.pdf');
    expect(cleanName('../../etc/passwd')).toBe('passwd');
    expect(cleanName('')).toBe('file');
  });
});
