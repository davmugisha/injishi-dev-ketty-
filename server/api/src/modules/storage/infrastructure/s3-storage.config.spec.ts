import { inspect } from 'node:util';

import { resolveS3StorageConfig, type StorageEnv } from './s3-storage.config';

const SECRET = 'do-not-print-this-secret-0123456789';

const LIVE: StorageEnv = {
  STORAGE_S3_ENDPOINT: 'http://injishi-minio:9000',
  STORAGE_S3_ACCESS_KEY: 'injishi-api',
  STORAGE_S3_SECRET_KEY: SECRET,
};

/** Asserts `fn` throws, and that the message never carries the secret. */
function refusal(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    const message = (error as Error).message;
    expect(message).not.toContain(SECRET);
    return message;
  }
  throw new Error('expected a refusal');
}

describe('resolveS3StorageConfig', () => {
  it('applies the contract defaults', () => {
    const config = resolveS3StorageConfig(LIVE);
    expect(config).toMatchObject({
      endpoint: 'http://injishi-minio:9000',
      publicEndpoint: 'http://injishi-minio:9000',
      region: 'us-east-1',
      bucket: 'injishi',
      requireEncryption: false,
      createBuckets: false,
      production: false,
    });
    expect(config.credentials).toMatchObject({
      accessKeyId: 'injishi-api',
      secretAccessKey: SECRET,
    });
  });

  it('requires encryption by default under production, and allows turning it off', () => {
    expect(resolveS3StorageConfig({ ...LIVE, NODE_ENV: 'production' }).requireEncryption).toBe(true);
    expect(
      resolveS3StorageConfig({ ...LIVE, NODE_ENV: 'production', STORAGE_REQUIRE_ENCRYPTION: 'false' })
        .requireEncryption,
    ).toBe(false);
    expect(resolveS3StorageConfig({ ...LIVE, STORAGE_REQUIRE_ENCRYPTION: 'TRUE' }).requireEncryption).toBe(true);
    expect(resolveS3StorageConfig({ ...LIVE, STORAGE_REQUIRE_ENCRYPTION: '1' }).requireEncryption).toBe(true);
  });

  it('reads every named setting', () => {
    const config = resolveS3StorageConfig({
      ...LIVE,
      STORAGE_S3_ENDPOINT: ' http://injishi-minio:9000/ ',
      STORAGE_S3_PUBLIC_ENDPOINT: 'https://storage.injishi.com/',
      STORAGE_S3_REGION: 'af-south-1',
      STORAGE_BUCKET: 'prod-files',
      STORAGE_CREATE_BUCKETS: 'true',
    });
    expect(config).toMatchObject({
      endpoint: 'http://injishi-minio:9000',
      publicEndpoint: 'https://storage.injishi.com',
      region: 'af-south-1',
      bucket: 'prod-files',
      createBuckets: true,
    });
  });

  it('treats an empty or blank STORAGE_BUCKET as unset, never as a bucket named nothing', () => {
    for (const blank of ['', '   ']) {
      expect(resolveS3StorageConfig({ ...LIVE, STORAGE_BUCKET: blank }).bucket).toBe('injishi');
    }
  });

  it('refuses to boot without an endpoint or keys, naming every one missing', () => {
    expect(refusal(() => resolveS3StorageConfig({}))).toMatch(
      /STORAGE_ADAPTER_MODE=live needs STORAGE_S3_ENDPOINT, STORAGE_S3_ACCESS_KEY, STORAGE_S3_SECRET_KEY/,
    );
    expect(refusal(() => resolveS3StorageConfig({ ...LIVE, STORAGE_S3_ACCESS_KEY: '  ' }))).toMatch(
      /needs STORAGE_S3_ACCESS_KEY\. Set it/,
    );
    expect(refusal(() => resolveS3StorageConfig({ ...LIVE, STORAGE_S3_SECRET_KEY: undefined }))).toMatch(
      /needs STORAGE_S3_SECRET_KEY/,
    );
  });

  it('refuses STORAGE_CREATE_BUCKETS under production, and only there', () => {
    expect(
      refusal(() =>
        resolveS3StorageConfig({ ...LIVE, NODE_ENV: 'production', STORAGE_CREATE_BUCKETS: 'true' }),
      ),
    ).toMatch(/STORAGE_CREATE_BUCKETS=true is refused under NODE_ENV=production/);
    expect(
      resolveS3StorageConfig({ ...LIVE, NODE_ENV: 'production', STORAGE_CREATE_BUCKETS: 'false' }).createBuckets,
    ).toBe(false);
    expect(
      resolveS3StorageConfig({ ...LIVE, NODE_ENV: 'development', STORAGE_CREATE_BUCKETS: 'true' }).createBuckets,
    ).toBe(true);
  });

  it('refuses a flag it cannot read rather than defaulting it', () => {
    expect(refusal(() => resolveS3StorageConfig({ ...LIVE, STORAGE_REQUIRE_ENCRYPTION: 'ture' }))).toMatch(
      /STORAGE_REQUIRE_ENCRYPTION must be "true" or "false", got "ture"/,
    );
    expect(refusal(() => resolveS3StorageConfig({ ...LIVE, STORAGE_CREATE_BUCKETS: 'yes please' }))).toMatch(
      /STORAGE_CREATE_BUCKETS must be/,
    );
  });

  it('refuses an endpoint that carries credentials, without echoing them', () => {
    const message = refusal(() =>
      resolveS3StorageConfig({ ...LIVE, STORAGE_S3_ENDPOINT: `http://root:${SECRET}@injishi-minio:9000` }),
    );
    expect(message).toMatch(/STORAGE_S3_ENDPOINT must not carry credentials/);
    expect(message).not.toContain('root:');
  });

  it.each([
    ['injishi-minio:9000', /must be an http or https URL|must be a URL/],
    ['ftp://injishi-minio:9000', /must be an http or https URL/],
    ['not a url', /must be a URL/],
    ['http://injishi-minio:9000/injishi', /must be an origin/],
    ['http://injishi-minio:9000/?x=1', /must be an origin/],
  ])('refuses the endpoint %j', (endpoint, pattern) => {
    const internal = refusal(() => resolveS3StorageConfig({ ...LIVE, STORAGE_S3_ENDPOINT: endpoint }));
    expect(internal).toMatch(/^STORAGE_S3_ENDPOINT /);
    expect(internal).toMatch(pattern);
    const published = refusal(() =>
      resolveS3StorageConfig({ ...LIVE, STORAGE_S3_PUBLIC_ENDPOINT: endpoint }),
    );
    expect(published).toMatch(/^STORAGE_S3_PUBLIC_ENDPOINT /);
    expect(published).toMatch(pattern);
  });

  it.each(['ab', 'Injishi', 'has_underscore', '-leading', 'trailing-', 'two..dots', '192.168.1.1', 'a'.repeat(64)])(
    'refuses the bucket name %j at boot',
    (name) => {
      expect(refusal(() => resolveS3StorageConfig({ ...LIVE, STORAGE_BUCKET: name }))).toMatch(
        /STORAGE_BUCKET ".*" is not a valid bucket name/,
      );
    },
  );

  it('prints its credentials as redacted', () => {
    const config = resolveS3StorageConfig(LIVE);
    expect(inspect(config, { depth: 5 })).not.toContain(SECRET);
    expect(JSON.stringify(config)).not.toContain(SECRET);
    expect(`${inspect(config.credentials)}`).toBe('[redacted credentials]');
  });
});
