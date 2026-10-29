import { describe, expect, it } from 'vitest';

import { DEV_WEB_URL, resolveWebUrl } from './web-url';

describe('resolveWebUrl', () => {
  it('refuses to boot production without WEB_URL, naming the variable', () => {
    expect(() => resolveWebUrl({ nodeEnv: 'production' })).toThrow(
      /WEB_URL is required when NODE_ENV=production/,
    );
    expect(() => resolveWebUrl({ nodeEnv: 'production', webUrl: '  ' })).toThrow(
      /WEB_URL is required/,
    );
  });

  it('defaults to local web outside production', () => {
    expect(resolveWebUrl({ nodeEnv: 'development' })).toBe(DEV_WEB_URL);
    expect(resolveWebUrl({})).toBe(DEV_WEB_URL);
  });

  it('returns the origin with no trailing slash', () => {
    expect(
      resolveWebUrl({ nodeEnv: 'production', webUrl: 'https://www.injishi.com/' }),
    ).toBe('https://www.injishi.com');
    expect(resolveWebUrl({ webUrl: 'http://localhost:3000' })).toBe(
      'http://localhost:3000',
    );
  });

  it('refuses a path, a query, a non http scheme and junk', () => {
    expect(() => resolveWebUrl({ webUrl: 'https://www.injishi.com/app' })).toThrow(
      /no path/,
    );
    expect(() => resolveWebUrl({ webUrl: 'https://www.injishi.com?x=1' })).toThrow(
      /no path/,
    );
    expect(() => resolveWebUrl({ webUrl: 'ftp://www.injishi.com' })).toThrow(
      /http:\/\/ or https:\/\//,
    );
    expect(() => resolveWebUrl({ webUrl: 'www.injishi.com' })).toThrow(
      /not a valid URL/,
    );
  });
});
