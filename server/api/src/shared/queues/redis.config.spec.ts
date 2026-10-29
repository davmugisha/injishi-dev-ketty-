import { describe, expect, it } from 'vitest';

import { resolveRedisConnection } from './redis.config';

describe('resolveRedisConnection', () => {
  it('falls back to the dev pair when no URL is set', () => {
    expect(resolveRedisConnection({})).toEqual({
      host: '127.0.0.1',
      port: 6379,
      family: 0,
      maxRetriesPerRequest: null,
    });
  });

  it('uses the discrete pair when it is the only thing set', () => {
    expect(
      resolveRedisConnection({ redisHost: 'redis', redisPort: '6380' }),
    ).toMatchObject({ host: 'redis', port: 6380 });
  });

  it('prefers REDIS_URL over the pair', () => {
    expect(
      resolveRedisConnection({
        redisUrl: 'redis://default:s3cret@redis.railway.internal:6379',
        redisHost: '127.0.0.1',
        redisPort: '6379',
      }),
    ).toEqual({
      host: 'redis.railway.internal',
      port: 6379,
      username: 'default',
      password: 's3cret',
      family: 0,
      maxRetriesPerRequest: null,
    });
  });

  it('percent-decodes credentials', () => {
    // Managed providers generate passwords containing URL-reserved bytes.
    expect(
      resolveRedisConnection({
        redisUrl: 'redis://default:p%40ss%2Fword@host:6379',
      }),
    ).toMatchObject({ password: 'p@ss/word' });
  });

  it('enables TLS for rediss://', () => {
    expect(
      resolveRedisConnection({ redisUrl: 'rediss://host:6379' }),
    ).toMatchObject({ tls: {} });
  });

  it('defaults the port when the URL omits it', () => {
    expect(
      resolveRedisConnection({ redisUrl: 'redis://host' }),
    ).toMatchObject({ port: 6379 });
  });

  it('always asks DNS for both address families', () => {
    // Railway's private network is IPv6-only; ioredis defaults to IPv4.
    expect(
      resolveRedisConnection({ redisUrl: 'redis://host:6379' }).family,
    ).toBe(0);
  });

  it('refuses a malformed URL rather than falling back to localhost', () => {
    expect(() => resolveRedisConnection({ redisUrl: 'not-a-url' })).toThrow(
      /not a valid URL/,
    );
  });

  it('refuses a non-redis scheme', () => {
    expect(() =>
      resolveRedisConnection({ redisUrl: 'http://host:6379' }),
    ).toThrow(/redis:\/\/ or rediss:\/\//);
  });
});
