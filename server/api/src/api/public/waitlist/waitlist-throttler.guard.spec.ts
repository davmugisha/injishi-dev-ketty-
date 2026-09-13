import { WAITLIST_THROTTLERS } from './waitlist-throttler.guard';

/**
 * The waitlist's two rate limit buckets (ADR-048 AC-13).
 *
 * These run the real trackers the guard registers. The numbers matter less than
 * the KEYS: a client bucket keyed on the proxy's address caps the whole launch
 * page at five signups an hour for everybody, and a mailbox bucket that treats
 * `a+1@x.rw` and `a+2@x.rw` as different people can be walked around by anyone
 * who knows about plus addressing.
 */

type Tracker = (req: Record<string, unknown>) => string;

function bucket(name: string): { limit: number; ttl: number; track: Tracker } {
  const throttler = WAITLIST_THROTTLERS.find((t) => t.name === name);
  if (!throttler) throw new Error(`no throttler named ${name}`);
  return {
    limit: Number(throttler.limit),
    ttl: Number(throttler.ttl),
    track: throttler.getTracker as unknown as Tracker,
  };
}

const HOUR_MS = 60 * 60_000;

describe('waitlist throttler limits', () => {
  it('allows 5 signups per client per hour (covers: AC-13)', () => {
    const client = bucket('waitlist-client');
    expect(client.limit).toBe(5);
    expect(client.ttl).toBe(HOUR_MS);
  });

  it('allows 2 signups per mailbox per hour (covers: AC-13)', () => {
    const mailbox = bucket('waitlist-email');
    expect(mailbox.limit).toBe(2);
    expect(mailbox.ttl).toBe(HOUR_MS);
  });

  it('registers exactly the two buckets and nothing else', () => {
    expect(WAITLIST_THROTTLERS.map((t) => t.name).sort()).toEqual([
      'waitlist-client',
      'waitlist-email',
    ]);
  });
});

describe('waitlist client tracker', () => {
  const { track } = bucket('waitlist-client');

  it('keys on the leftmost X-Forwarded-For entry, the original client (covers: AC-13)', () => {
    const key = track({
      ip: '10.0.0.2',
      headers: { 'x-forwarded-for': '203.0.113.7, 172.18.0.5, 10.0.0.2' },
    });

    expect(key).toBe('203.0.113.7');
  });

  it('gives two visitors behind the same proxy two different buckets (covers: AC-13)', () => {
    const proxy = '172.18.0.5';

    const first = track({ ip: proxy, headers: { 'x-forwarded-for': '198.51.100.1' } });
    const second = track({ ip: proxy, headers: { 'x-forwarded-for': '198.51.100.2' } });

    expect(first).not.toBe(second);
  });

  it('trims spaces around the forwarded address', () => {
    expect(track({ headers: { 'x-forwarded-for': '   198.51.100.9  ,10.0.0.1' } })).toBe(
      '198.51.100.9',
    );
  });

  it('reads the first value when the header arrives as an array', () => {
    const key = track({
      ip: '10.0.0.2',
      headers: { 'x-forwarded-for': ['198.51.100.3, 10.0.0.1', '192.0.2.1'] },
    });

    expect(key).toBe('198.51.100.3');
  });

  it('falls back to the socket address when there is no forwarded header', () => {
    expect(track({ ip: '192.0.2.44', headers: {} })).toBe('192.0.2.44');
  });

  it('falls back to the socket address when the forwarded header is empty', () => {
    expect(track({ ip: '192.0.2.45', headers: { 'x-forwarded-for': '' } })).toBe('192.0.2.45');
  });

  it('answers a stable key rather than throwing when nothing identifies the client', () => {
    expect(track({})).toBe('unknown');
  });
});

describe('waitlist mailbox tracker', () => {
  const { track } = bucket('waitlist-email');
  const withEmail = (email: unknown, ip = '192.0.2.1'): string => track({ ip, headers: {}, body: { email } });

  it('counts plus tagged addresses against one mailbox (covers: AC-13)', () => {
    const keys = ['a+1@x.rw', 'a+2@x.rw', 'a+3@x.rw', 'a@x.rw'].map((e) => withEmail(e));

    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBe('email:a@x.rw');
  });

  it('ignores case and surrounding space, as the stored address does (covers: AC-10, AC-13)', () => {
    expect(withEmail('  Someone@Example.COM ')).toBe(withEmail('someone@example.com'));
  });

  it('keeps different mailboxes in different buckets', () => {
    expect(withEmail('amani@x.rw')).not.toBe(withEmail('grace@x.rw'));
  });

  it('keeps the same local part at two domains apart', () => {
    expect(withEmail('amani@x.rw')).not.toBe(withEmail('amani@y.rw'));
  });

  it('is not fooled by a plus sign in the domain part', () => {
    expect(withEmail('a@x+1.rw')).toBe('email:a@x+1.rw');
  });

  it.each([
    ['a missing body', { ip: '192.0.2.9', headers: {} }],
    ['a body with no email', { ip: '192.0.2.9', headers: {}, body: { fullName: 'x' } }],
    ['a non string email', { ip: '192.0.2.9', headers: {}, body: { email: 42 } }],
    ['an address with no local part', { ip: '192.0.2.9', headers: {}, body: { email: '@x.rw' } }],
    ['an address with no at sign', { ip: '192.0.2.9', headers: {}, body: { email: 'not-an-address' } }],
  ])('counts %s against the client instead of a mailbox', (_label, req) => {
    expect(track(req)).toBe('no-email:192.0.2.9');
  });

  it('counts a garbage body against the forwarded client, not the proxy', () => {
    const key = track({ ip: '172.18.0.5', headers: { 'x-forwarded-for': '198.51.100.20' }, body: 'junk' });

    expect(key).toBe('no-email:198.51.100.20');
  });

  it('caps a very long address so one request cannot mint an unbounded key', () => {
    const long = `${'a'.repeat(400)}@x.rw`;

    expect(withEmail(long).length).toBeLessThanOrEqual('email:'.length + 254);
  });
});
