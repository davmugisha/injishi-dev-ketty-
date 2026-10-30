import { describe, expect, it } from 'vitest';

import { FastifyAdapter } from '@nestjs/platform-fastify';

import { MAX_TRUSTED_HOPS, resolveTrustProxy } from './trust-proxy';

/**
 * `TRUST_PROXY`, parsed and then proved on a real Fastify instance.
 *
 * The parse is half of it. The other half is what `request.ip` actually says
 * once the adapter is built the way `AppModule.main` builds it, because that is
 * the value every address keyed throttler reads.
 */

describe('resolveTrustProxy', () => {
  it.each([undefined, '', '  ', 'false', 'OFF', '0', 'no'])(
    'trusts nothing for %p, which is what the API did before the setting',
    (raw) => {
      expect(resolveTrustProxy(raw)).toBe(false);
    },
  );

  it('reads a hop count', () => {
    expect(resolveTrustProxy('1')).toBe(1);
    expect(resolveTrustProxy(` ${MAX_TRUSTED_HOPS} `)).toBe(MAX_TRUSTED_HOPS);
  });

  it('reads a list of addresses and CIDRs', () => {
    expect(resolveTrustProxy('10.0.0.0/8, 172.16.0.0/12,::1, fd00::/8')).toEqual([
      '10.0.0.0/8',
      '172.16.0.0/12',
      '::1',
      'fd00::/8',
    ]);
  });

  it.each(['true', 'TRUE', 'on', 'yes'])(
    'refuses %p, which would let a caller choose its own address',
    (raw) => {
      expect(() => resolveTrustProxy(raw)).toThrow(/every hop/);
    },
  );

  it.each([String(MAX_TRUSTED_HOPS + 1), '99'])('refuses a hop count of %p', (raw) => {
    expect(() => resolveTrustProxy(raw)).toThrow(/between 1 and/);
  });

  it.each(['traefik', '10.0.0.0/33', '::1/129', '10.0.0/8', '1.2.3.4/x', '-1'])(
    'refuses %p rather than falling back to off',
    (raw) => {
      expect(() => resolveTrustProxy(raw)).toThrow(/TRUST_PROXY/);
    },
  );
});

describe('request.ip under TRUST_PROXY', () => {
  const PROXY = '10.0.1.5';
  const CLIENT = '203.0.113.7';
  const FORGED = '198.51.100.66';

  async function ipSeen(
    trustProxy: string | undefined,
    request: { remoteAddress: string; forwardedFor?: string },
  ): Promise<string> {
    const adapter = new FastifyAdapter({ trustProxy: resolveTrustProxy(trustProxy) });
    const fastify = adapter.getInstance();
    fastify.get('/ip', async (req) => ({ ip: req.ip }));
    await fastify.ready();
    try {
      const response = await fastify.inject({
        method: 'GET',
        url: '/ip',
        remoteAddress: request.remoteAddress,
        headers: request.forwardedFor ? { 'x-forwarded-for': request.forwardedFor } : {},
      });
      return (response.json() as { ip: string }).ip;
    } finally {
      await fastify.close();
    }
  }

  it('resolves to the forwarded client when the proxy hop is trusted', async () => {
    await expect(ipSeen('1', { remoteAddress: PROXY, forwardedFor: CLIENT })).resolves.toBe(
      CLIENT,
    );
  });

  it('believes only the entry the trusted proxy appended, never one the caller wrote before it', async () => {
    await expect(
      ipSeen('1', { remoteAddress: PROXY, forwardedFor: `${FORGED}, ${CLIENT}` }),
    ).resolves.toBe(CLIENT);
  });

  it('ignores a forged X-Forwarded-For when nothing is trusted', async () => {
    await expect(
      ipSeen(undefined, { remoteAddress: CLIENT, forwardedFor: FORGED }),
    ).resolves.toBe(CLIENT);
  });

  it('resolves to the client when the socket is inside a trusted CIDR', async () => {
    await expect(
      ipSeen('10.0.0.0/8', { remoteAddress: PROXY, forwardedFor: `${FORGED}, ${CLIENT}` }),
    ).resolves.toBe(CLIENT);
  });

  it('ignores X-Forwarded-For from a socket outside the trusted CIDRs', async () => {
    await expect(
      ipSeen('10.0.0.0/8', { remoteAddress: CLIENT, forwardedFor: FORGED }),
    ).resolves.toBe(CLIENT);
  });
});
