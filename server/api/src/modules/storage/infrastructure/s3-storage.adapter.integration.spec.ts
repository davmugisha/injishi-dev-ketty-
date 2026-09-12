import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

import {
  HeadBucketCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import { DRIZZLE } from '../../../shared/database/database.module';
import { STORAGE_PORT, type StoragePort } from '../domain/storage-port';
import { StorageModule } from '../storage.module';
import { MAX_SIGNED_URL_TTL_SECONDS, type S3StorageAdapter } from './s3-storage.adapter';

/**
 * The live adapter against a real S3 server (F-S09, storage contract C1 to C6).
 *
 * Runs only when pointed at one:
 *
 *   STORAGE_IT_ENDPOINT, STORAGE_IT_ACCESS_KEY, STORAGE_IT_SECRET_KEY  required together
 *   STORAGE_IT_PUBLIC_ENDPOINT  a second origin reaching the same server (default: the endpoint)
 *   STORAGE_IT_BUCKET, STORAGE_IT_OTHER_BUCKET  existing buckets WITH default encryption;
 *     the second is only ever the negative control's wrong bucket
 *   STORAGE_IT_PLAIN_BUCKET  an existing bucket WITHOUT default encryption
 *   STORAGE_IT_CREATE_BUCKET  a bucket name that does not exist yet (default: random)
 *   STORAGE_IT_REPORT  a file to write the keys and buckets it used to, for an outside check
 *
 * `.unlazy/storage-mail/checks/leaf-1.1.1/check-live-adapter.mjs` starts a real
 * MinIO, provisions those buckets and runs this file.
 *
 * Every boot here goes through the real `StorageModule`, so what is proved is
 * the wiring a deployment runs rather than the adapter in isolation. One store
 * per process (ADR-043): the demo stack has a MinIO of its own, so there is no
 * per request bucket left to route.
 *
 * Without the variables this file registers one test and no skipped ones: a
 * skipped test would read as coverage in the suite summary, and a half-set
 * configuration must fail rather than quietly skip.
 */

const REQUIRED = ['STORAGE_IT_ENDPOINT', 'STORAGE_IT_ACCESS_KEY', 'STORAGE_IT_SECRET_KEY'] as const;
const present = REQUIRED.filter((name) => (process.env[name] ?? '').trim() !== '');

if (present.length === 0) {
  describe('S3 storage against a real server', () => {
    it('runs only when STORAGE_IT_ENDPOINT, STORAGE_IT_ACCESS_KEY and STORAGE_IT_SECRET_KEY are set', () => {
      expect(present).toEqual([]);
    });
  });
} else {
  describe('S3 storage against a real server', () => {
    it('has every required STORAGE_IT_ variable', () => {
      expect(REQUIRED.filter((name) => !present.includes(name))).toEqual([]);
    });
  });
  if (present.length === REQUIRED.length) liveSuite();
}

function liveSuite(): void {
  jest.setTimeout(60_000);

  const it_ = {
    endpoint: process.env.STORAGE_IT_ENDPOINT as string,
    publicEndpoint: process.env.STORAGE_IT_PUBLIC_ENDPOINT || (process.env.STORAGE_IT_ENDPOINT as string),
    accessKey: process.env.STORAGE_IT_ACCESS_KEY as string,
    secretKey: process.env.STORAGE_IT_SECRET_KEY as string,
    bucket: process.env.STORAGE_IT_BUCKET || 'injishi-it',
    otherBucket: process.env.STORAGE_IT_OTHER_BUCKET || 'injishi-it-other',
    plainBucket: process.env.STORAGE_IT_PLAIN_BUCKET || 'injishi-it-plain',
    createBucket: process.env.STORAGE_IT_CREATE_BUCKET || `injishi-it-new-${randomBytes(4).toString('hex')}`,
    missingBucket: `injishi-it-missing-${randomBytes(4).toString('hex')}`,
    refusedBucket: `injishi-it-refused-${randomBytes(4).toString('hex')}`,
  };

  /**
   * The negative control's lever, and only that. `swap-buckets` hands the app
   * the other bucket under the real one's name while every assertion still
   * expects the real one, so the placement test MUST fail.
   */
  const sabotage = process.env.STORAGE_IT_SABOTAGE ?? '';
  const configuredBucket = sabotage === 'swap-buckets' ? it_.otherBucket : it_.bucket;

  const liveEnv = (overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> => ({
    STORAGE_ADAPTER_MODE: 'live',
    STORAGE_S3_ENDPOINT: it_.endpoint,
    STORAGE_S3_PUBLIC_ENDPOINT: it_.publicEndpoint,
    STORAGE_S3_ACCESS_KEY: it_.accessKey,
    STORAGE_S3_SECRET_KEY: it_.secretKey,
    STORAGE_BUCKET: configuredBucket,
    NODE_ENV: 'production',
    ...overrides,
  });

  /** An independent client, so what the adapter claims is checked from outside it. */
  const admin = new S3Client({
    endpoint: it_.endpoint,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId: it_.accessKey, secretAccessKey: it_.secretKey },
  });

  const report: Record<string, string> = {
    bucket: it_.bucket,
    otherBucket: it_.otherBucket,
    createBucket: it_.createBucket,
    missingBucket: it_.missingBucket,
    refusedBucket: it_.refusedBucket,
  };
  const apps: TestingModule[] = [];

  /** `ConfigService` from `env`, and the `DRIZZLE` StorageService injects (never queried here). */
  function infrastructure(env: Record<string, string | undefined>): new () => unknown {
    @Global()
    @Module({
      providers: [
        { provide: ConfigService, useValue: { get: (key: string) => env[key] } },
        { provide: DRIZZLE, useValue: {} },
      ],
      exports: [ConfigService, DRIZZLE],
    })
    class ItInfrastructureModule {}
    return ItInfrastructureModule;
  }

  async function boot(env: Record<string, string | undefined>): Promise<TestingModule> {
    const app = await Test.createTestingModule({
      imports: [infrastructure(env), StorageModule],
    }).compile();
    apps.push(app);
    return app;
  }

  const portOf = (app: TestingModule): S3StorageAdapter => app.get<S3StorageAdapter>(STORAGE_PORT);

  async function holds(bucket: string, key: string): Promise<boolean> {
    try {
      await admin.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return true;
    } catch (error) {
      if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return false;
      throw error;
    }
  }

  async function bucketExists(bucket: string): Promise<boolean> {
    try {
      await admin.send(new HeadBucketCommand({ Bucket: bucket }));
      return true;
    } catch (error) {
      if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return false;
      throw error;
    }
  }

  const png = (): Buffer => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), randomBytes(2048)]);
  const put = (port: StoragePort, body: Buffer): ReturnType<StoragePort['put']> =>
    port.put({ body, mime: 'image/png', filename: 'photo.png', kind: 'property_photo' });

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    while (apps.length) await apps.pop()?.close();
    admin.destroy();
    if (process.env.STORAGE_IT_REPORT) {
      writeFileSync(process.env.STORAGE_IT_REPORT, JSON.stringify(report, null, 2));
    }
  });

  describe('live storage on a real S3 server', () => {
    it('boots in live mode under production with its encrypted bucket verified', async () => {
      const app = await boot(liveEnv());
      expect(portOf(app)).toHaveProperty('bucket', configuredBucket);
    });

    it('puts an object and reads the exact bytes back through a signed URL on the public endpoint', async () => {
      const app = await boot(liveEnv());
      const port = portOf(app);
      const body = png();
      const { objectKey, sizeBytes } = await put(port, body);
      expect(sizeBytes).toBe(body.byteLength);

      const url = new URL(await port.signedUrl(objectKey, 3600));
      expect(url.origin).toBe(new URL(it_.publicEndpoint).origin);
      const expires = Number(url.searchParams.get('X-Amz-Expires'));
      expect(expires).toBeGreaterThan(0);
      expect(expires).toBeLessThanOrEqual(MAX_SIGNED_URL_TTL_SECONDS);

      const response = await fetch(url);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('image/png');
      expect(Buffer.from(await response.arrayBuffer()).equals(body)).toBe(true);

      // Stored where the production port says, and encrypted at rest there.
      const head = await admin.send(new HeadObjectCommand({ Bucket: it_.bucket, Key: objectKey }));
      expect(head.ServerSideEncryption).toBe('AES256');
      report.readBackKey = objectKey;
    });

    it('refuses a signed URL whose signature was tampered with, and one that has expired', async () => {
      const app = await boot(liveEnv());
      const port = portOf(app);
      const { objectKey } = await put(port, png());

      const tampered = new URL(await port.signedUrl(objectKey, 60));
      const signature = tampered.searchParams.get('X-Amz-Signature') ?? '';
      tampered.searchParams.set('X-Amz-Signature', signature.replace(/^./, (c) => (c === '0' ? '1' : '0')));
      expect((await fetch(tampered)).status).toBe(403);

      const shortLived = await port.signedUrl(objectKey, 1);
      await new Promise((resolve) => setTimeout(resolve, 2_500));
      expect((await fetch(shortLived)).status).toBe(403);
    });

    it('removes an object so that it is gone, and removing it again succeeds', async () => {
      const app = await boot(liveEnv());
      const port = portOf(app);
      const { objectKey } = await put(port, png());
      const url = await port.signedUrl(objectKey, 300);
      expect((await fetch(url)).status).toBe(200);

      await port.remove(objectKey);

      expect(await holds(it_.bucket, objectKey)).toBe(false);
      expect((await fetch(url)).status).toBe(404);
      await expect(port.remove(objectKey)).resolves.toBeUndefined();
      report.removedKey = objectKey;
    });

    it('stores in the bucket the stack names and in no other', async () => {
      const app = await boot(liveEnv());
      const { objectKey } = await put(portOf(app), png());
      report.productionKey = objectKey;

      expect({ inBucket: await holds(it_.bucket, objectKey), inOther: await holds(it_.otherBucket, objectKey) })
        .toEqual({ inBucket: true, inOther: false });
    });

    it('refuses to boot on a missing bucket, and does not create it', async () => {
      await expect(boot(liveEnv({ STORAGE_BUCKET: it_.missingBucket }))).rejects.toThrow(
        new RegExp(`Bucket "${it_.missingBucket}" does not exist`),
      );
      expect(await bucketExists(it_.missingBucket)).toBe(false);
    });

    it('refuses to boot on an unencrypted bucket when encryption is required', async () => {
      await expect(bucketExists(it_.plainBucket)).resolves.toBe(true);
      await expect(boot(liveEnv({ STORAGE_BUCKET: it_.plainBucket }))).rejects.toThrow(
        new RegExp(`Bucket "${it_.plainBucket}" .* has no default server-side encryption`),
      );
      // The refusal is the encryption rule and nothing else: not required, it boots.
      await expect(
        boot(liveEnv({ STORAGE_BUCKET: it_.plainBucket, NODE_ENV: 'development', STORAGE_REQUIRE_ENCRYPTION: 'false' })),
      ).resolves.toBeDefined();
    });

    it('creates a missing bucket at boot in development when STORAGE_CREATE_BUCKETS=true', async () => {
      expect(await bucketExists(it_.createBucket)).toBe(false);
      const app = await boot(
        liveEnv({
          NODE_ENV: 'development',
          STORAGE_BUCKET: it_.createBucket,
          STORAGE_CREATE_BUCKETS: 'true',
        }),
      );
      expect(await bucketExists(it_.createBucket)).toBe(true);
      const { objectKey } = await put(portOf(app), png());
      expect(await holds(it_.createBucket, objectKey)).toBe(true);
    });

    it('refuses STORAGE_CREATE_BUCKETS under production and creates nothing', async () => {
      await expect(
        boot(liveEnv({ STORAGE_BUCKET: it_.refusedBucket, STORAGE_CREATE_BUCKETS: 'true' })),
      ).rejects.toThrow(/STORAGE_CREATE_BUCKETS=true is refused under NODE_ENV=production/);
      expect(await bucketExists(it_.refusedBucket)).toBe(false);
    });
  });
}
