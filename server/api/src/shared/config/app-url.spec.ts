import { DEV_APP_URL, resolveAppUrl } from './app-url';

describe('resolveAppUrl', () => {
  it('refuses to boot production without APP_URL, naming the variable', () => {
    expect(() => resolveAppUrl({ nodeEnv: 'production' })).toThrow(/APP_URL is required when NODE_ENV=production/);
    expect(() => resolveAppUrl({ nodeEnv: 'production', appUrl: '  ' })).toThrow(/APP_URL is required/);
  });

  it('defaults to the local app outside production', () => {
    expect(resolveAppUrl({ nodeEnv: 'development' })).toBe(DEV_APP_URL);
    expect(resolveAppUrl({})).toBe('http://localhost:3002');
  });

  it('returns the origin with no trailing slash', () => {
    expect(resolveAppUrl({ nodeEnv: 'production', appUrl: 'https://app.injishi.com/' })).toBe('https://app.injishi.com');
  });

  it('refuses a path, a non http scheme, credentials and junk, naming APP_URL', () => {
    expect(() => resolveAppUrl({ appUrl: 'https://app.injishi.com/w' })).toThrow(/APP_URL must be an origin/);
    expect(() => resolveAppUrl({ appUrl: 'ftp://app.injishi.com' })).toThrow(/APP_URL must use http/);
    expect(() => resolveAppUrl({ appUrl: 'https://u:p@app.injishi.com' })).toThrow(/APP_URL may not carry credentials/);
    expect(() => resolveAppUrl({ appUrl: 'app.injishi.com' })).toThrow(/APP_URL is not a valid URL/);
  });
});
