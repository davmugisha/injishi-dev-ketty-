import { describe, expect, it } from 'vitest';

import {
  LEASE_MESSAGE_FILES_MAX,
  MESSAGE_DIGEST_COOLDOWN_MIN,
  MESSAGE_DIGEST_DELAY_MIN,
  VOICE_NOTE_MAX_S,
  messageFileKind,
  messageFilesProblem,
  messagePreview,
} from '@injishi/contracts';

import {
  bodyTypeFor,
  decodeMessageCursor,
  digestDue,
  encodeMessageCursor,
  leaseThreadWritable,
  messageDigestMail,
  otherSideRead,
  receiptFor,
  senderSide,
} from './lease-messages';

const TENANT = '11111111-1111-4111-8111-111111111111';
const OWNER = '22222222-2222-4222-8222-222222222222';
const TEAM = '33333333-3333-4333-8333-333333333333';
const MB = 1024 * 1024;

describe('lease conversations: who wrote, who read', () => {
  it('sides a line from the tenant account, the platform, or the landlord side (owner or team)', () => {
    expect(senderSide(TENANT, 'text', TENANT)).toBe('tenant');
    expect(senderSide(OWNER, 'text', TENANT)).toBe('landlord');
    expect(senderSide(TEAM, 'image', TENANT)).toBe('landlord');
    expect(senderSide(null, 'system', TENANT)).toBe('system');
    // A tenant with no account yet: nobody in the thread can be them.
    expect(senderSide(OWNER, 'text', null)).toBe('landlord');
  });

  it("reads the other side's last read: the tenant's for a landlord, the newest of the team's for the tenant", () => {
    const reads = [
      { userId: TENANT, lastReadAt: new Date('2026-10-25T10:00:00Z') },
      { userId: OWNER, lastReadAt: new Date('2026-10-25T09:00:00Z') },
      { userId: TEAM, lastReadAt: new Date('2026-10-25T11:00:00Z') },
    ];
    expect(otherSideRead(reads, 'landlord', TENANT)?.toISOString()).toBe('2026-10-25T10:00:00.000Z');
    expect(otherSideRead(reads, 'tenant', TENANT)?.toISOString()).toBe('2026-10-25T11:00:00.000Z');
    expect(otherSideRead([], 'tenant', TENANT)).toBeNull();
  });

  it('marks our line read once the other side opened the conversation at or after it', () => {
    const at = new Date('2026-10-25T10:00:00Z');
    expect(receiptFor(at, null)).toBe('delivered');
    expect(receiptFor(at, new Date('2026-10-25T09:59:59Z'))).toBe('delivered');
    expect(receiptFor(at, new Date('2026-10-25T10:00:00Z'))).toBe('read');
  });

  it('takes messages while the lease is being signed or runs, and is read only after', () => {
    expect(['pending_signature', 'signed', 'active', 'ending'].every((s) => leaseThreadWritable(s as never))).toBe(true);
    expect(['draft', 'ended', 'cancelled'].some((s) => leaseThreadWritable(s as never))).toBe(false);
  });

  it('names the kind of line from its files', () => {
    expect(bodyTypeFor([])).toBe('text');
    expect(bodyTypeFor(['image', 'image'])).toBe('image');
    expect(bodyTypeFor(['image', 'file'])).toBe('file');
    expect(bodyTypeFor(['audio'])).toBe('voice');
  });

  it('round-trips the page cursor and ignores a forged one', () => {
    const at = new Date('2026-10-25T10:00:00.123Z');
    const id = '44444444-4444-4444-8444-444444444444';
    expect(decodeMessageCursor(encodeMessageCursor(at, id))).toEqual({ createdAt: at, id });
    expect(decodeMessageCursor('not-a-cursor')).toBeUndefined();
    expect(decodeMessageCursor(Buffer.from('2026-10-25T10:00:00Z|1 or 1=1').toString('base64url'))).toBeUndefined();
  });
});

describe('attachment limits (shared by the composer and the API)', () => {
  it('knows the kinds by type, never by name', () => {
    expect(messageFileKind('image/jpeg')).toBe('image');
    expect(messageFileKind('application/pdf')).toBe('file');
    expect(messageFileKind('audio/webm;codecs=opus')).toBe('audio');
    expect(messageFileKind('audio/ogg')).toBe('audio');
    expect(messageFileKind('audio/mp4')).toBe('audio');
    expect(messageFileKind('application/zip')).toBeNull();
    expect(messageFileKind('image/svg+xml')).toBeNull();
  });

  it('holds each kind to its size, the count to ten, and a voice note to one, alone, up to two minutes', () => {
    expect(messageFilesProblem([{ mime: 'image/png', sizeBytes: 2 * MB }])).toBeNull();
    expect(messageFilesProblem([{ mime: 'image/png', sizeBytes: 11 * MB, name: 'big.png' }])).toBe('"big.png" is too large. The limit is 10 MB.');
    expect(messageFilesProblem([{ mime: 'application/pdf', sizeBytes: 15 * MB }])).toBeNull();
    expect(messageFilesProblem([{ mime: 'application/pdf', sizeBytes: 17 * MB }])).toMatch(/limit is 16 MB/);
    expect(messageFilesProblem([{ mime: 'application/zip', sizeBytes: 10, name: 'a.zip' }])).toMatch(/can't be sent/);
    expect(messageFilesProblem([{ mime: 'image/png', sizeBytes: 0 }])).toBe('That file is empty.');
    const many = Array.from({ length: LEASE_MESSAGE_FILES_MAX + 1 }, () => ({ mime: 'image/jpeg', sizeBytes: 10 }));
    expect(messageFilesProblem(many)).toBe('Send up to 10 files at once.');
    expect(messageFilesProblem([{ mime: 'audio/webm', sizeBytes: 50_000 }], 12)).toBeNull();
    expect(messageFilesProblem([{ mime: 'audio/webm', sizeBytes: 50_000 }])).toMatch(/length is missing/);
    expect(messageFilesProblem([{ mime: 'audio/webm', sizeBytes: 50_000 }], VOICE_NOTE_MAX_S + 1)).toBe('A voice note can be up to 2 minutes.');
    expect(messageFilesProblem([{ mime: 'audio/webm', sizeBytes: 6 * MB }], 30)).toBe('A voice note must be 5 MB or smaller.');
    expect(messageFilesProblem([{ mime: 'audio/webm', sizeBytes: 10 }, { mime: 'image/png', sizeBytes: 10 }], 3)).toBe('Send a voice note on its own.');
    expect(messageFilesProblem([{ mime: 'audio/webm', sizeBytes: 10 }, { mime: 'audio/ogg', sizeBytes: 10 }], 3)).toBe('Send one voice note at a time.');
  });

  it('previews a line in a few words', () => {
    expect(messagePreview({ body: '  Hello\nthere ', bodyType: 'text', attachments: [] })).toBe('Hello there');
    expect(messagePreview({ body: null, bodyType: 'voice', attachments: [{ kind: 'audio' }] })).toBe('Voice note');
    expect(messagePreview({ body: null, bodyType: 'image', attachments: [{ kind: 'image' }, { kind: 'image' }] })).toBe('2 photos');
    expect(messagePreview({ body: null, bodyType: 'file', attachments: [{ kind: 'file' }] })).toBe('Document');
  });
});

describe('the unread-message email: timing and one per reader', () => {
  const now = new Date('2026-10-25T12:00:00Z');
  const ago = (min: number): Date => new Date(now.getTime() - min * 60_000);
  const base = { now, delayMin: MESSAGE_DIGEST_DELAY_MIN, cooldownMin: MESSAGE_DIGEST_COOLDOWN_MIN };

  it('waits five minutes after the oldest unread line, then sends', () => {
    expect(MESSAGE_DIGEST_DELAY_MIN).toBe(5);
    expect(digestDue({ ...base, oldestUnreadAt: null, lastSentAt: null })).toBe(false);
    expect(digestDue({ ...base, oldestUnreadAt: ago(4), lastSentAt: null })).toBe(false);
    expect(digestDue({ ...base, oldestUnreadAt: ago(5), lastSentAt: null })).toBe(true);
  });

  it('never sends twice to the same side of a conversation within the cooldown', () => {
    expect(digestDue({ ...base, oldestUnreadAt: ago(10), lastSentAt: ago(10) })).toBe(false);
    expect(digestDue({ ...base, oldestUnreadAt: ago(40), lastSentAt: ago(MESSAGE_DIGEST_COOLDOWN_MIN) })).toBe(true);
  });

  it('puts every waiting conversation of one reader in one email with one link', () => {
    const one = messageDigestMail({
      appUrl: 'http://localhost:3002',
      side: 'tenant',
      greetName: 'Grace Mukamana',
      items: [{ leaseId: 'L1', unitLabel: 'A-02', propertyName: 'Amani Residences', from: 'Amani Residences', unread: 3, newestBody: 'The plumber comes at 10', newestBodyType: 'text', newestVoiceS: null }],
    });
    expect(one.subject).toBe('Amani Residences sent 3 new messages');
    expect(one.heading).toBe('Hello Grace');
    expect(one.lines).toEqual(['Amani Residences sent 3 new messages about unit A-02 at Amani Residences: "The plumber comes at 10"']);
    expect(one.action.url).toBe('http://localhost:3002/home/L1/messages');

    const two = messageDigestMail({
      appUrl: 'http://localhost:3002',
      side: 'landlord',
      greetName: null,
      items: [
        { leaseId: 'L1', unitLabel: 'A-01', propertyName: 'Amani', from: 'Aline', unread: 1, newestBody: null, newestBodyType: 'voice', newestVoiceS: 12 },
        { leaseId: 'L2', unitLabel: 'A-02', propertyName: 'Amani', from: 'Grace', unread: 2, newestBody: null, newestBodyType: 'image', newestVoiceS: null },
      ],
    });
    expect(two.subject).toBe('3 new messages in 2 conversations');
    expect(two.lines).toHaveLength(2);
    expect(two.lines[0]).toContain('"Voice note"');
    expect(two.action.url).toBe('http://localhost:3002/messages');
    expect(JSON.stringify(two)).not.toMatch(/\u2014/);
  });
});
