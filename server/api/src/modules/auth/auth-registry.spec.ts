// `@injishi/auth` is ESM and outside what ts-jest transforms, so `createAuth`
// is stood in for by a recorder: this spec checks what the registry ASKS for
// (secret, base URL, cookie prefix, database, demo code) per instance. The G2
// gate of the environments ledger compares the constants below with the
// package's real exports.
jest.mock('@injishi/auth', () => ({
  DEMO_OTP_CODE: '123456',
  DEMO_COOKIE_PREFIX: 'injishi-demo',
  createAuth: (config: unknown) => ({ config }),
}));

import type { AuthInstance, SendOtp } from '@injishi/auth';

import type { Platform } from '../../shared/config/platform';
import type { Database } from '../../shared/database/database.module';
import { createAuthRegistry, googleCredentials } from './auth.module';

/*
 * One environment per process (ADR-043). The registry used to hold a
 * production and a demo instance side by side and pick per request; now the
 * process IS one or the other, decided by `PLATFORM` at boot, and this spec
 * pins what each kind of process asks Better Auth for.
 */

const DEMO_COOKIE_PREFIX = 'injishi-demo';
const SECRET = 'p'.repeat(40);
const OVERSIGHT_SECRET = 'o'.repeat(40);

const db = { name: 'the one database' } as unknown as Database;
const mailer = { send: jest.fn() };

const PRODUCTION: Platform = { environment: 'production', sampleData: false, commit: null };
const STAGING: Platform = { environment: 'production', sampleData: true, commit: null };
const DEMO: Platform = { environment: 'demo', sampleData: true, commit: null };

type Requested = {
  db: Database;
  secret: string;
  baseURL: string;
  cookiePrefix?: string;
  cookieDomain?: string;
  demoOtpCode?: string;
  trustedOrigins: string[];
  google?: { clientId: string; clientSecret: string };
  sendOtp: SendOtp;
};

function requested(instance: AuthInstance): Requested {
  return (instance as unknown as { config: Requested }).config;
}

function configFrom(env: Record<string, string | undefined>): {
  get: <T>(key: string) => T | undefined;
  getOrThrow: <T>(key: string) => T;
} {
  return {
    get: <T>(key: string) => env[key] as T | undefined,
    getOrThrow: <T>(key: string) => {
      const value = env[key];
      if (value === undefined) throw new Error(`${key} missing`);
      return value as T;
    },
  };
}

const DEPLOYED = {
  NODE_ENV: 'production',
  BETTER_AUTH_SECRET: SECRET,
  BETTER_AUTH_URL: 'https://api.injishi.com',
  CORS_ORIGINS: 'https://www.injishi.com',
  AUTH_COOKIE_DOMAIN: '.injishi.com',
};

const WITH_CONSOLE = {
  ...DEPLOYED,
  OVERSIGHT_HOSTNAMES: 'oversight.injishi.com',
  OVERSIGHT_AUTH_SECRET: OVERSIGHT_SECRET,
};

describe('createAuthRegistry · a production process', () => {
  const registry = createAuthRegistry(PRODUCTION, db, configFrom(DEPLOYED), mailer);
  const marketplace = requested(registry.for('marketplace'));

  it('is never handed the fixed code', () => {
    expect(marketplace.demoOtpCode).toBeUndefined();
  });

  it('signs with BETTER_AUTH_SECRET on BETTER_AUTH_URL, under the default cookie name', () => {
    expect(marketplace.secret).toBe(SECRET);
    expect(marketplace.baseURL).toBe('https://api.injishi.com');
    expect(marketplace.cookiePrefix).toBeUndefined();
    expect(marketplace.cookieDomain).toBe('.injishi.com');
  });

  it('uses the one database and mails every code', () => {
    expect(marketplace.db).toBe(db);
    expect(marketplace.sendOtp).toBe(mailer.send);
  });

  it('holds one marketplace instance, whatever surface a host resolves to', () => {
    expect(registry.for('marketplace')).toBe(registry.for('marketplace'));
    // No console configured: an oversight lookup falls to the marketplace.
    expect(registry.for('oversight')).toBe(registry.for('marketplace'));
    expect(registry.oversightHosts).toEqual([]);
  });
});

describe('createAuthRegistry · staging (production process, sample database)', () => {
  it('is not the demo, so it issues random codes', () => {
    const registry = createAuthRegistry(STAGING, db, configFrom(DEPLOYED), mailer);
    expect(requested(registry.for('marketplace')).demoOtpCode).toBeUndefined();
  });
});

describe('createAuthRegistry · a demo process', () => {
  const registry = createAuthRegistry(DEMO, db, configFrom(DEPLOYED), mailer);
  const marketplace = requested(registry.for('marketplace'));

  it('is handed the fixed code (AC-12)', () => {
    expect(marketplace.demoOtpCode).toBe('123456');
  });

  it('names its cookie with the demo prefix, because it shares the parent domain (AC-8)', () => {
    expect(marketplace.cookiePrefix).toBe(DEMO_COOKIE_PREFIX);
    expect(marketplace.cookieDomain).toBe('.injishi.com');
  });

  it("signs with its own stack's BETTER_AUTH_SECRET; there is no DEMO_AUTH_SECRET", () => {
    expect(marketplace.secret).toBe(SECRET);
  });

  it("mails its codes, which land in the demo stack's own Mailpit (AC-4)", () => {
    expect(marketplace.sendOtp).toBe(mailer.send);
  });
});

describe('createAuthRegistry · the oversight surface', () => {
  it('names the console cookie apart from the marketplace, in production', () => {
    const registry = createAuthRegistry(PRODUCTION, db, configFrom(WITH_CONSOLE), mailer);
    const oversight = requested(registry.for('oversight'));
    expect(registry.oversightHosts).toEqual(['oversight.injishi.com']);
    expect(oversight.cookiePrefix).toBe('injishi-oversight');
    expect(oversight.secret).toBe(OVERSIGHT_SECRET);
    expect(oversight.demoOtpCode).toBeUndefined();
    expect(registry.for('oversight')).not.toBe(registry.for('marketplace'));
  });

  it('gives the demo console its own cookie name and the fixed code too (AC-8, AC-12)', () => {
    const registry = createAuthRegistry(DEMO, db, configFrom(WITH_CONSOLE), mailer);
    const oversight = requested(registry.for('oversight'));
    expect(oversight.cookiePrefix).toBe('injishi-oversight-demo');
    expect(oversight.demoOtpCode).toBe('123456');
  });

  it("refuses to boot when the console's secret is the marketplace's", () => {
    expect(() =>
      createAuthRegistry(
        PRODUCTION,
        db,
        configFrom({ ...WITH_CONSOLE, OVERSIGHT_AUTH_SECRET: SECRET }),
        mailer,
      ),
    ).toThrow(/OVERSIGHT_AUTH_SECRET must differ from BETTER_AUTH_SECRET/);
  });
});

describe('createAuthRegistry · local development', () => {
  it('runs as the demo on a laptop with one weak secret', () => {
    const registry = createAuthRegistry(
      DEMO,
      db,
      configFrom({
        NODE_ENV: 'development',
        BETTER_AUTH_SECRET: 'dev-secret',
        BETTER_AUTH_URL: 'http://localhost:8000',
      }),
      mailer,
    );
    const marketplace = requested(registry.for('marketplace'));
    expect(marketplace.secret).toBe('dev-secret');
    expect(marketplace.baseURL).toBe('http://localhost:8000');
    expect(marketplace.demoOtpCode).toBe('123456');
    expect(marketplace.cookiePrefix).toBe(DEMO_COOKIE_PREFIX);
  });
});

describe('createAuthRegistry · the phone app and Google', () => {
  it('trusts the browser apps and the phone app scheme, and never Expo Go in production', () => {
    const registry = createAuthRegistry(PRODUCTION, db, configFrom(DEPLOYED), mailer);
    const origins = requested(registry.for('marketplace')).trustedOrigins;
    expect(origins).toEqual(expect.arrayContaining(['https://www.injishi.com', 'injishi://']));
    expect(origins.some((o) => o.startsWith('exp://'))).toBe(false);
  });

  it('trusts Expo Go on a laptop, where the phone app runs in it', () => {
    const local = { BETTER_AUTH_SECRET: 'dev-secret', CORS_ORIGINS: 'http://localhost:3002' };
    const registry = createAuthRegistry(DEMO, db, configFrom(local), mailer);
    expect(requested(registry.for('marketplace')).trustedOrigins).toEqual(
      expect.arrayContaining(['http://localhost:3002', 'injishi://', 'exp://']),
    );
  });

  it('mounts Google only when both halves of the credential are set', () => {
    const withGoogle = { ...DEPLOYED, GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' };
    const registry = createAuthRegistry(PRODUCTION, db, configFrom(withGoogle), mailer);
    expect(requested(registry.for('marketplace')).google).toEqual({ clientId: 'id', clientSecret: 'secret' });

    const halfSet = { ...DEPLOYED, GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: '  ' };
    const without = createAuthRegistry(PRODUCTION, db, configFrom(halfSet), mailer);
    expect(requested(without.for('marketplace')).google).toBeUndefined();
  });

  it('answers the platform endpoint from the same rule', () => {
    expect(googleCredentials(configFrom({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 's' }))).toBeDefined();
    expect(googleCredentials(configFrom({ GOOGLE_CLIENT_ID: 'id' }))).toBeUndefined();
    expect(googleCredentials(configFrom({}))).toBeUndefined();
  });
});
