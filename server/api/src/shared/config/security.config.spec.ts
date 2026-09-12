import {
  isProduction,
  requireStrongSecret,
  resolveAllowedOrigins,
  resolveCookieSecret,
} from './security.config';

describe('resolveAllowedOrigins', () => {
  it('parses and trims the configured allowlist', () => {
    expect(
      resolveAllowedOrigins({
        nodeEnv: 'production',
        corsOrigins: 'https://injishi.rw, https://admin.injishi.rw',
      }),
    ).toEqual(['https://injishi.rw', 'https://admin.injishi.rw']);
  });

  it('falls back to the local dev origins outside production', () => {
    expect(resolveAllowedOrigins({ nodeEnv: 'development' })).toEqual([
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
    ]);
  });

  it('refuses to boot production without an allowlist', () => {
    // The old fallback was `origin: true`, which reflects the caller's Origin
    // while credentials are enabled - any site could then call us as the user.
    expect(() => resolveAllowedOrigins({ nodeEnv: 'production' })).toThrow(
      /CORS_ORIGINS is required in production/,
    );
  });

  it('treats an empty or comma-only allowlist as unset', () => {
    expect(() =>
      resolveAllowedOrigins({ nodeEnv: 'production', corsOrigins: ' , ,' }),
    ).toThrow(/CORS_ORIGINS is required in production/);
  });
});

describe('resolveCookieSecret', () => {
  it('uses the configured secret', () => {
    const secret = 'x'.repeat(32);
    expect(
      resolveCookieSecret({ nodeEnv: 'production', cookieSecret: secret }),
    ).toBe(secret);
  });

  it('falls back to a dev secret outside production', () => {
    expect(resolveCookieSecret({ nodeEnv: 'development' })).toMatch(/dev-only/);
  });

  it('refuses to boot production without a cookie secret', () => {
    expect(() => resolveCookieSecret({ nodeEnv: 'production' })).toThrow(
      /COOKIE_SECRET is required in production/,
    );
  });

  it('rejects the .env.example placeholder in production', () => {
    expect(() =>
      resolveCookieSecret({
        nodeEnv: 'production',
        cookieSecret: 'dev-only-secret',
      }),
    ).toThrow(/at least 32 characters/);
  });
});

describe('requireStrongSecret', () => {
  it('accepts an `openssl rand -base64 32` shaped secret', () => {
    const secret = 'K7dQ2mXbT9vZ1sR4pL8nJ0hC5gY6wA3eB2uF7iO9kM=';
    expect(requireStrongSecret('BETTER_AUTH_SECRET', secret)).toBe(secret);
  });

  it('rejects a short secret', () => {
    expect(() => requireStrongSecret('BETTER_AUTH_SECRET', 'replace-me')).toThrow(
      /at least 32 characters/,
    );
  });

  it('rejects a missing or whitespace-only secret', () => {
    expect(() => requireStrongSecret('BETTER_AUTH_SECRET', '   ')).toThrow(
      /is required in production/,
    );
  });
});

describe('isProduction', () => {
  it('is true only for NODE_ENV=production', () => {
    expect(isProduction('production')).toBe(true);
    // Staging is NOT production-by-accident, but it must never get dev defaults
    // silently either - callers gate secrets on `isProduction` and the *absence*
    // of a value, so a staging box with real secrets configured still boots.
    expect(isProduction('staging')).toBe(false);
    expect(isProduction(undefined)).toBe(false);
  });
});
