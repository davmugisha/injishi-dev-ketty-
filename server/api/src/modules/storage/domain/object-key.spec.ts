import { afterAll, beforeAll, describe, expect, it, type MockInstance, vi } from 'vitest';

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LocalDiskStorageAdapter } from '../infrastructure/local-disk-storage.adapter';
import { createS3Clients, S3StorageAdapter } from '../infrastructure/s3-storage.adapter';
import { resolveS3StorageConfig } from '../infrastructure/s3-storage.config';
import { isObjectKey, mintObjectKey, type ObjectKeyInput } from './object-key';
import { MIME_EXTENSION, type PutObjectInput } from './storage-port';

const FIXED_UUID = '0b7d2a3c-1111-4222-8333-944455556666';

// Both adapters mint through `mintObjectKey`, which reaches `randomUUID` from
// here. Pinning it is what lets two adapters' keys be compared byte for byte.
vi.mock('node:crypto', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:crypto')>()),
  randomUUID: vi.fn(() => FIXED_UUID),
}));

/**
 * The local adapter's key rule exactly as it stood before `mintObjectKey`
 * existed, copied verbatim. Every key already in `stored_objects` was minted by
 * this; the shared function must agree with it on every input or those rows
 * stop meaning what they meant.
 */
function legacyLocalKey(input: ObjectKeyInput, now: Date, uuid: string): string {
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const extension = MIME_EXTENSION[input.mime] ?? 'bin';
  return input.keyHint && /^[A-Za-z0-9_-]{1,64}$/.test(input.keyHint)
    ? `${input.kind}/${input.keyHint}.${extension}`
    : `${input.kind}/${yyyy}/${mm}/${uuid}.${extension}`;
}

const KINDS = ['certificate', 'id_photo', 'message_attachment', 'avatar'] as const;
const MIMES = [...Object.keys(MIME_EXTENSION), 'text/html', ''];
const HINTS = [
  undefined,
  '',
  'Zk3_-abc',
  'a'.repeat(64),
  'a'.repeat(65),
  'has.dot',
  'has/slash',
  '../escape',
  'space here',
];
const MOMENTS = [
  new Date('2026-08-31T23:59:59.999Z'),
  new Date('2026-09-01T00:00:00.000Z'),
  new Date('2027-01-05T12:00:00.000Z'),
];

describe('mintObjectKey', () => {
  it('agrees with the pre-existing local key rule on every input', () => {
    let compared = 0;
    for (const kind of KINDS)
      for (const mime of MIMES)
        for (const keyHint of HINTS)
          for (const now of MOMENTS) {
            const input = { kind, mime, keyHint };
            expect(mintObjectKey(input, now, () => FIXED_UUID)).toBe(
              legacyLocalKey(input, now, FIXED_UUID),
            );
            compared += 1;
          }
    expect(compared).toBe(KINDS.length * MIMES.length * HINTS.length * MOMENTS.length);
  });

  it('partitions an ordinary upload by UTC month', () => {
    expect(
      mintObjectKey(
        { kind: 'certificate', mime: 'application/pdf' },
        new Date('2026-08-31T23:30:00-02:00'),
        () => FIXED_UUID,
      ),
    ).toBe(`certificate/2026/09/${FIXED_UUID}.pdf`);
  });

  it('makes a hinted key a pure function of the hint, with no date', () => {
    const input = { kind: 'id_photo' as const, mime: 'image/jpeg', keyHint: 'Zk3_-abc' };
    expect(mintObjectKey(input, MOMENTS[0])).toBe('id_photo/Zk3_-abc.jpg');
    expect(mintObjectKey(input, MOMENTS[2])).toBe('id_photo/Zk3_-abc.jpg');
  });

  it('ignores a hint that is not safe to put in a path', () => {
    for (const keyHint of ['has.dot', 'has/slash', '../escape', 'a'.repeat(65)]) {
      expect(
        mintObjectKey({ kind: 'avatar', mime: 'image/png', keyHint }, MOMENTS[1], () => FIXED_UUID),
      ).toBe(`avatar/2026/09/${FIXED_UUID}.png`);
    }
  });

  it('takes the extension from the mime, never the file name', () => {
    expect(mintObjectKey({ kind: 'certificate', mime: 'text/html' }, MOMENTS[1], () => FIXED_UUID)).toBe(
      `certificate/2026/09/${FIXED_UUID}.bin`,
    );
  });

  it('only ever mints keys that isObjectKey accepts', () => {
    for (const kind of KINDS)
      for (const mime of MIMES)
        for (const keyHint of HINTS) {
          expect(isObjectKey(mintObjectKey({ kind, mime, keyHint }))).toBe(true);
        }
  });
});

describe('isObjectKey', () => {
  it.each([
    '../etc/passwd',
    'certificate/../avatar/x.png',
    'certificate/2026/09/../../x.pdf',
    'certificate/./x.pdf',
    '/certificate/x.pdf',
    'certificate//x.pdf',
    'certificate/x',
    'certificate/x.pdf?versionId=1',
    'certificate/x%2F..pdf',
    'Certificate/x.pdf',
    '',
  ])('refuses %j', (key) => {
    expect(isObjectKey(key)).toBe(false);
  });
});

describe('both adapters mint the same key for the same upload', () => {
  const root = mkdtempSync(join(tmpdir(), 'storage-key-parity-'));
  const previousRoot = process.env.STORAGE_LOCAL_ROOT;

  beforeAll(() => {
    process.env.STORAGE_LOCAL_ROOT = root;
    // Only the clock is faked; the local adapter's disk I/O keeps real timers.
    vi.useFakeTimers({
      now: new Date('2026-09-30T23:59:00Z'),
      toNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask'],
    });
  });

  afterAll(() => {
    vi.useRealTimers();
    if (previousRoot === undefined) delete process.env.STORAGE_LOCAL_ROOT;
    else process.env.STORAGE_LOCAL_ROOT = previousRoot;
    rmSync(root, { recursive: true, force: true });
  });

  const clients = createS3Clients(
    resolveS3StorageConfig({
      STORAGE_S3_ENDPOINT: 'http://127.0.0.1:9',
      STORAGE_S3_ACCESS_KEY: 'parity',
      STORAGE_S3_SECRET_KEY: 'parity-secret',
    }),
  );
  afterAll(() => {
    clients.client.destroy();
    clients.signer.destroy();
  });

  const uploads: PutObjectInput[] = [
    { body: Buffer.from('%PDF'), mime: 'application/pdf', filename: '../../evil.exe', kind: 'certificate' },
    { body: Buffer.from('jpg'), mime: 'image/jpeg', filename: 'me.jpg', kind: 'id_photo', keyHint: 'Zk3_-abc' },
    { body: Buffer.from('png'), mime: 'image/png', filename: 'x.png', kind: 'avatar', keyHint: 'bad.hint' },
    { body: Buffer.from('?'), mime: 'application/x-unknown', filename: 'x', kind: 'contract' },
  ];

  it.each(uploads)('$kind $mime hint=$keyHint', async (upload) => {
    const sent: Array<{ Key?: string }> = [];
    (vi.spyOn(clients.client, 'send') as unknown as MockInstance).mockImplementation(
      (command: { input: { Key?: string } }) => {
        sent.push(command.input);
        return Promise.resolve({});
      },
    );

    const local = await new LocalDiskStorageAdapter().put(upload);
    const live = await new S3StorageAdapter(clients, 'injishi').put(upload);

    expect(live.objectKey).toBe(local.objectKey);
    expect(sent.map((input) => input.Key)).toEqual([local.objectKey]);
    expect(local.objectKey).toBe(legacyLocalKey(upload, new Date(), FIXED_UUID));
  });
});
