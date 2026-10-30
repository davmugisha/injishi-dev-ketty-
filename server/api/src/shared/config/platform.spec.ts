import { describe, expect, it, vi } from 'vitest';

import {
  bootPlatform,
  expectedDatabaseKind,
  PlatformBootRefusal,
  processCommit,
  processEnvironment,
  readDatabaseKind,
  resolvePlatform,
  type Queryable,
} from './platform';

/**
 * The boot check (ADR-043 § The boot check, AC-5, AC-11, AC-13, AC-28).
 *
 * Every row of the table is pinned, because each wrong answer is silent at
 * runtime: a demo process on a real database would hand out a published code
 * over real accounts, and a production process on the wrong database would
 * simply serve it.
 */

const marker = (rows: Array<Record<string, unknown>>): Queryable => ({
  query: vi.fn().mockResolvedValue({ rows }),
});
const SAMPLE = marker([{ kind: 'sample' }]);
const REAL = marker([]);

describe('processEnvironment (AC-5)', () => {
  it('reads INJISHI_ENVIRONMENT, ignoring case and padding', () => {
    expect(processEnvironment({ INJISHI_ENVIRONMENT: 'production' })).toBe('production');
    expect(processEnvironment({ INJISHI_ENVIRONMENT: ' Demo ' })).toBe('demo');
  });

  it('defaults to production under NODE_ENV=production and to demo otherwise', () => {
    expect(processEnvironment({ NODE_ENV: 'production' })).toBe('production');
    expect(processEnvironment({ NODE_ENV: 'development' })).toBe('demo');
    expect(processEnvironment({})).toBe('demo');
    expect(processEnvironment({ INJISHI_ENVIRONMENT: '  ', NODE_ENV: 'production' })).toBe('production');
  });

  it('refuses a value it cannot read instead of defaulting', () => {
    expect(() => processEnvironment({ INJISHI_ENVIRONMENT: 'staging' })).toThrow(
      /INJISHI_ENVIRONMENT must be "production" or "demo", got "staging"/,
    );
  });
});

describe('expectedDatabaseKind', () => {
  it('is null when unset, and reads real or sample', () => {
    expect(expectedDatabaseKind({})).toBeNull();
    expect(expectedDatabaseKind({ INJISHI_DATABASE_KIND: ' Sample ' })).toBe('sample');
    expect(expectedDatabaseKind({ INJISHI_DATABASE_KIND: 'real' })).toBe('real');
  });

  it('refuses a value it cannot read', () => {
    expect(() => expectedDatabaseKind({ INJISHI_DATABASE_KIND: 'fake' })).toThrow(
      /INJISHI_DATABASE_KIND must be "real" or "sample"/,
    );
  });
});

describe('resolvePlatform · the boot table (AC-11)', () => {
  it('refuses a demo process on a database with no marker, naming the rebuild (AC-28)', () => {
    for (const expectedKind of [null, 'sample', 'real'] as const) {
      expect(() =>
        resolvePlatform({ environment: 'demo', expectedKind, marker: 'real' }),
      ).toThrow(PlatformBootRefusal);
    }
    expect(() => resolvePlatform({ environment: 'demo', expectedKind: null, marker: 'real' })).toThrow(
      /pnpm dev:stack:reset/,
    );
  });

  it('runs a demo process on a sample database', () => {
    expect(resolvePlatform({ environment: 'demo', expectedKind: null, marker: 'sample' })).toEqual({
      environment: 'demo',
      sampleData: true,
      commit: null,
    });
    expect(
      resolvePlatform({ environment: 'demo', expectedKind: 'sample', marker: 'sample' }),
    ).toEqual({ environment: 'demo', sampleData: true, commit: null });
  });

  it('refuses any process whose INJISHI_DATABASE_KIND disagrees with the marker, naming both', () => {
    expect(() =>
      resolvePlatform({ environment: 'production', expectedKind: 'real', marker: 'sample' }),
    ).toThrow(/INJISHI_DATABASE_KIND is "real" but the database is "sample"/);
    expect(() =>
      resolvePlatform({ environment: 'production', expectedKind: 'sample', marker: 'real' }),
    ).toThrow(/INJISHI_DATABASE_KIND is "sample" but the database is "real"/);
    expect(() =>
      resolvePlatform({ environment: 'demo', expectedKind: 'real', marker: 'sample' }),
    ).toThrow(/INJISHI_DATABASE_KIND is "real"/);
  });

  it('runs a production process on either kind when INJISHI_DATABASE_KIND is unset (local)', () => {
    expect(resolvePlatform({ environment: 'production', expectedKind: null, marker: 'real' })).toEqual({
      environment: 'production',
      sampleData: false,
      commit: null,
    });
    expect(resolvePlatform({ environment: 'production', expectedKind: null, marker: 'sample' })).toEqual({
      environment: 'production',
      sampleData: true,
      commit: null,
    });
  });

  it('runs production on a real database and staging on a sample one', () => {
    expect(
      resolvePlatform({ environment: 'production', expectedKind: 'real', marker: 'real', paymentAdapterMode: 'off' }),
    ).toEqual({ environment: 'production', sampleData: false, commit: null });
    expect(
      resolvePlatform({ environment: 'production', expectedKind: 'sample', marker: 'sample' }),
    ).toEqual({ environment: 'production', sampleData: true, commit: null });
  });
});

describe('resolvePlatform · live adapters on the demo (AC-13)', () => {
  const demo = { environment: 'demo', expectedKind: null, marker: 'sample' } as const;

  it('refuses live payments or live EBM in a demo process', () => {
    expect(() => resolvePlatform({ ...demo, paymentAdapterMode: 'live' })).toThrow(
      /cannot run PAYMENT_ADAPTER_MODE=live/,
    );
    expect(() => resolvePlatform({ ...demo, vsdcAdapterMode: ' LIVE ' })).toThrow(
      /cannot run VSDC_ADAPTER_MODE=live/,
    );
    expect(() =>
      resolvePlatform({ ...demo, paymentAdapterMode: 'live', vsdcAdapterMode: 'live' }),
    ).toThrow(/PAYMENT_ADAPTER_MODE=live or VSDC_ADAPTER_MODE=live/);
  });

  it('allows mock or unset adapters on the demo, and live ones in production', () => {
    expect(() => resolvePlatform({ ...demo, paymentAdapterMode: 'mock' })).not.toThrow();
    expect(() => resolvePlatform(demo)).not.toThrow();
    expect(() =>
      resolvePlatform({
        environment: 'production',
        expectedKind: 'real',
        marker: 'real',
        paymentAdapterMode: 'live',
        vsdcAdapterMode: 'live',
      }),
    ).not.toThrow();
  });
});

describe('resolvePlatform · no mock money on a real database (booking audit, 2026-09-13)', () => {
  const production = { environment: 'production', expectedKind: 'real', marker: 'real' } as const;

  it('refuses a real database with the payment mode unset, because unset means mock', () => {
    expect(() => resolvePlatform(production)).toThrow(
      /INJISHI_DATABASE_KIND is "real" but PAYMENT_ADAPTER_MODE is unset \(which means mock\)/,
    );
  });

  it('refuses a real database with mock payments, naming the fix', () => {
    expect(() => resolvePlatform({ ...production, paymentAdapterMode: ' Mock ' })).toThrow(
      /PAYMENT_ADAPTER_MODE is "mock".*PAYMENT_ADAPTER_MODE=off/s,
    );
  });

  it('runs a real database with payments off or live', () => {
    expect(() => resolvePlatform({ ...production, paymentAdapterMode: 'off' })).not.toThrow();
    expect(() => resolvePlatform({ ...production, paymentAdapterMode: 'live' })).not.toThrow();
  });

  it('leaves staging, the demo and a laptop on mock', () => {
    expect(() =>
      resolvePlatform({ environment: 'production', expectedKind: 'sample', marker: 'sample', paymentAdapterMode: 'mock' }),
    ).not.toThrow();
    expect(() => resolvePlatform({ environment: 'demo', expectedKind: 'sample', marker: 'sample' })).not.toThrow();
    expect(() => resolvePlatform({ environment: 'production', expectedKind: null, marker: 'real' })).not.toThrow();
  });
});

describe('readDatabaseKind', () => {
  it('reads no row as real and a sample row as sample', async () => {
    await expect(readDatabaseKind(REAL)).resolves.toBe('real');
    await expect(readDatabaseKind(SAMPLE)).resolves.toBe('sample');
  });

  it("fails with the database's own error rather than guessing a kind", async () => {
    const down = { query: vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')) };
    await expect(readDatabaseKind(down)).rejects.toThrow('connect ECONNREFUSED');
  });

  it('names the migration when the marker table does not exist yet', async () => {
    const old = {
      query: vi.fn().mockRejectedValue(
        Object.assign(new Error('relation "database_identity" does not exist'), { code: '42P01' }),
      ),
    };
    await expect(readDatabaseKind(old)).rejects.toThrow(
      /relation "database_identity" does not exist\. .*db:migrate/,
    );
  });
});

describe('bootPlatform', () => {
  it('puts the three together: a laptop with no settings is the demo on its sample database', async () => {
    await expect(bootPlatform(SAMPLE, { NODE_ENV: 'development' })).resolves.toEqual({
      environment: 'demo',
      sampleData: true,
      commit: null,
    });
  });

  it('refuses a laptop whose database predates the marker (AC-28)', async () => {
    await expect(bootPlatform(REAL, { NODE_ENV: 'development' })).rejects.toThrow(
      /pnpm dev:stack:reset/,
    );
  });

  it('runs production, pinned the way its compose file pins it', async () => {
    await expect(
      bootPlatform(REAL, {
        NODE_ENV: 'production',
        INJISHI_ENVIRONMENT: 'production',
        INJISHI_DATABASE_KIND: 'real',
        PAYMENT_ADAPTER_MODE: 'off',
      }),
    ).resolves.toEqual({ environment: 'production', sampleData: false, commit: null });
  });

  it('carries the commit the image was stamped with', async () => {
    await expect(
      bootPlatform(SAMPLE, { NODE_ENV: 'development', INJISHI_COMMIT: 'EDF31AE' }),
    ).resolves.toEqual({ environment: 'demo', sampleData: true, commit: 'edf31ae' });
  });
});

/**
 * The one fact on this payload that is about the DEPLOY rather than the
 * platform. It decides nothing, which is exactly why it must never refuse a
 * boot: an API that dies over a label it only reports is a worse outcome than
 * one that cannot name itself.
 */
describe('processCommit', () => {
  it('reads a stamped sha, normalised', () => {
    expect(processCommit({ INJISHI_COMMIT: '  EDF31AE ' })).toBe('edf31ae');
    expect(processCommit({ INJISHI_COMMIT: 'a'.repeat(40) })).toBe('a'.repeat(40));
  });

  it('is null when nothing said, which is an ordinary working tree', () => {
    expect(processCommit({})).toBeNull();
    expect(processCommit({ INJISHI_COMMIT: '' })).toBeNull();
    expect(processCommit({ INJISHI_COMMIT: '   ' })).toBeNull();
  });

  it('drops anything that is not a git sha rather than echoing it', () => {
    // A field a client may render must not carry whatever a stray variable
    // happened to hold — a branch name, a tag, or an injected string.
    for (const raw of ['main', 'v1.2.3', 'abc', '<script>', 'a'.repeat(41)]) {
      expect(processCommit({ INJISHI_COMMIT: raw })).toBeNull();
    }
  });
});
