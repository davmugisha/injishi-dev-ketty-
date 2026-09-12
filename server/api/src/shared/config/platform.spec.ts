import {
  bootPlatform,
  expectedDatabaseKind,
  PlatformBootRefusal,
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
  query: jest.fn().mockResolvedValue({ rows }),
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
    });
    expect(
      resolvePlatform({ environment: 'demo', expectedKind: 'sample', marker: 'sample' }),
    ).toEqual({ environment: 'demo', sampleData: true });
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
    });
    expect(resolvePlatform({ environment: 'production', expectedKind: null, marker: 'sample' })).toEqual({
      environment: 'production',
      sampleData: true,
    });
  });

  it('runs production on a real database and staging on a sample one', () => {
    expect(
      resolvePlatform({ environment: 'production', expectedKind: 'real', marker: 'real' }),
    ).toEqual({ environment: 'production', sampleData: false });
    expect(
      resolvePlatform({ environment: 'production', expectedKind: 'sample', marker: 'sample' }),
    ).toEqual({ environment: 'production', sampleData: true });
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

describe('readDatabaseKind', () => {
  it('reads no row as real and a sample row as sample', async () => {
    await expect(readDatabaseKind(REAL)).resolves.toBe('real');
    await expect(readDatabaseKind(SAMPLE)).resolves.toBe('sample');
  });

  it("fails with the database's own error rather than guessing a kind", async () => {
    const down = { query: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED')) };
    await expect(readDatabaseKind(down)).rejects.toThrow('connect ECONNREFUSED');
  });

  it('names the migration when the marker table does not exist yet', async () => {
    const old = {
      query: jest.fn().mockRejectedValue(
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
      }),
    ).resolves.toEqual({ environment: 'production', sampleData: false });
  });
});
