import {
  CreateBucketCommand,
  GetBucketEncryptionCommand,
  HeadBucketCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import { DRIZZLE } from '../../shared/database/database.module';
import { StorageService } from './application/storage.service';
import { STORAGE_BACKEND, type StorageBackend } from './domain/storage-backend';
import { STORAGE_PORT, type StoragePort } from './domain/storage-port';
import { LocalDiskStorageAdapter } from './infrastructure/local-disk-storage.adapter';
import { S3StorageAdapter } from './infrastructure/s3-storage.adapter';
import { StorageModule, resolveMode } from './storage.module';

/**
 * The seam's wiring, pinned: which store a unit of work gets and what refuses
 * to boot.
 *
 * One store per process (ADR-043). The demo stack has a MinIO and a bucket of
 * its own, so nothing here chooses a bucket by request host or by worker any
 * more; this spec used to pin exactly that choice.
 */

type Env = Record<string, string | undefined>;

const LIVE: Env = {
  STORAGE_ADAPTER_MODE: 'live',
  STORAGE_S3_ENDPOINT: 'http://injishi-minio:9000',
  STORAGE_S3_PUBLIC_ENDPOINT: 'https://storage.injishi.com',
  STORAGE_S3_ACCESS_KEY: 'injishi-api',
  STORAGE_S3_SECRET_KEY: 'module-spec-secret',
};

/** `ConfigService` answering from `env` alone, and the `DRIZZLE` StorageService injects. */
function infrastructure(env: Env): new () => unknown {
  @Global()
  @Module({
    providers: [
      { provide: ConfigService, useValue: { get: (key: string) => env[key] } },
      { provide: DRIZZLE, useValue: {} },
    ],
    exports: [ConfigService, DRIZZLE],
  })
  class FakeInfrastructureModule {}
  return FakeInfrastructureModule;
}

/** What MinIO answers, by bucket: present and encrypted unless listed otherwise. */
function fakeMinio(missing: string[] = [], unencrypted: string[] = []): jest.SpyInstance {
  const error = (name: string): S3ServiceException =>
    new S3ServiceException({ name, $fault: 'client', $metadata: { httpStatusCode: 404 }, message: name });
  return (jest.spyOn(S3Client.prototype, 'send') as unknown as jest.SpyInstance).mockImplementation(
    async (command: { input: { Bucket?: string } }) => {
      const bucket = command.input.Bucket ?? '';
      if (command instanceof HeadBucketCommand) {
        if (missing.includes(bucket)) throw error('NotFound');
        return {};
      }
      if (command instanceof GetBucketEncryptionCommand) {
        if (unencrypted.includes(bucket)) throw error('ServerSideEncryptionConfigurationNotFoundError');
        return {
          ServerSideEncryptionConfiguration: {
            Rules: [{ ApplyServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } }],
          },
        };
      }
      if (command instanceof CreateBucketCommand) return {};
      throw new Error(`unexpected ${command.constructor.name}`);
    },
  );
}

const compiled: TestingModule[] = [];

async function app(env: Env): Promise<TestingModule> {
  const moduleRef = await Test.createTestingModule({
    imports: [infrastructure(env), StorageModule],
  }).compile();
  compiled.push(moduleRef);
  return moduleRef;
}

const bucketOf = (port: StoragePort): string => (port as S3StorageAdapter).bucket;

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});

afterEach(async () => {
  jest.restoreAllMocks();
  while (compiled.length) await compiled.pop()?.close();
});

describe('StorageModule mode', () => {
  it('reads local unless told live, and refuses anything else', () => {
    expect(resolveMode(undefined)).toBe('local');
    expect(resolveMode(' Local ')).toBe('local');
    expect(resolveMode('LIVE')).toBe('live');
    expect(() => resolveMode('minio')).toThrow(/must be "local" or "live", got "minio"/);
  });

  it('keeps local mode on the local disk adapter', async () => {
    const moduleRef = await app({});
    expect(moduleRef.get(STORAGE_PORT)).toBeInstanceOf(LocalDiskStorageAdapter);
    expect(moduleRef.get<StorageBackend>(STORAGE_BACKEND).mode).toBe('local');
  });

  it('takes the mode from ConfigService, so a mode written in .env is the mode that runs', async () => {
    // ConfigModule loads .env after this module's file is imported; a mode read
    // from process.env at import time never saw it.
    const previous = process.env.STORAGE_ADAPTER_MODE;
    delete process.env.STORAGE_ADAPTER_MODE;
    try {
      fakeMinio();
      const moduleRef = await app(LIVE);
      expect(moduleRef.get<StorageBackend>(STORAGE_BACKEND).mode).toBe('live');
      expect(moduleRef.get(STORAGE_PORT)).toBeInstanceOf(S3StorageAdapter);
    } finally {
      if (previous !== undefined) process.env.STORAGE_ADAPTER_MODE = previous;
    }
  });
});

describe('StorageModule live', () => {
  it('stores in the one bucket the stack names, verified once at boot', async () => {
    const send = fakeMinio();
    const moduleRef = await app({ ...LIVE, STORAGE_BUCKET: 'injishi-files' });

    expect(bucketOf(moduleRef.get(STORAGE_PORT))).toBe('injishi-files');
    const verified = send.mock.calls.map(([command]) => (command as { input: { Bucket: string } }).input.Bucket);
    expect(new Set(verified)).toEqual(new Set(['injishi-files']));
  });

  it('hands StorageService the same port every other caller gets', async () => {
    fakeMinio();
    const moduleRef = await app(LIVE);
    expect(moduleRef.get(StorageService)['storage']).toBe(moduleRef.get(STORAGE_PORT));
  });
});

describe('StorageModule refuses to boot', () => {
  it('on a mode it cannot read', async () => {
    await expect(app({ STORAGE_ADAPTER_MODE: 'Live-ish' })).rejects.toThrow(
      /STORAGE_ADAPTER_MODE must be "local" or "live"/,
    );
  });

  it('in live mode without an endpoint or keys', async () => {
    const send = fakeMinio();
    await expect(
      app({ STORAGE_ADAPTER_MODE: 'live', STORAGE_S3_ACCESS_KEY: 'k' }),
    ).rejects.toThrow(/needs STORAGE_S3_ENDPOINT, STORAGE_S3_SECRET_KEY/);
    expect(send).not.toHaveBeenCalled();
  });

  it('on a missing bucket', async () => {
    fakeMinio(['injishi']);
    await expect(app(LIVE)).rejects.toThrow(/Bucket "injishi" does not exist/);
  });

  it('on an unencrypted bucket under production', async () => {
    fakeMinio([], ['injishi']);
    await expect(app({ ...LIVE, NODE_ENV: 'production' })).rejects.toThrow(
      /Bucket "injishi" .* has no default server-side encryption/,
    );
  });

  it('on STORAGE_CREATE_BUCKETS under production, before any call to S3', async () => {
    const send = fakeMinio(['injishi']);
    await expect(
      app({ ...LIVE, NODE_ENV: 'production', STORAGE_CREATE_BUCKETS: 'true' }),
    ).rejects.toThrow(/STORAGE_CREATE_BUCKETS=true is refused under NODE_ENV=production/);
    expect(send).not.toHaveBeenCalled();
  });

  it('but creates a missing bucket in development when asked to', async () => {
    const send = fakeMinio(['injishi']);
    await expect(app({ ...LIVE, STORAGE_CREATE_BUCKETS: 'true' })).resolves.toBeDefined();
    expect(send.mock.calls.some(([command]) => command instanceof CreateBucketCommand)).toBe(true);
  });
});
