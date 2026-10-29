import { describe, expect, it, type Mock, type MockInstance, vi } from 'vitest';

import {
  CreateBucketCommand,
  GetBucketEncryptionCommand,
  HeadBucketCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';

import { verifyBuckets } from './s3-bucket-verification';
import { resolveS3StorageConfig, type StorageEnv } from './s3-storage.config';

const SECRET = 'do-not-print-this-secret-0123456789';

const BASE: StorageEnv = {
  STORAGE_S3_ENDPOINT: 'http://injishi-minio:9000',
  STORAGE_S3_ACCESS_KEY: 'injishi-api',
  STORAGE_S3_SECRET_KEY: SECRET,
};

interface BucketState {
  exists: boolean;
  /** The default SSE algorithm, or null for none. */
  sse?: string | null;
}

interface Sent {
  command: string;
  bucket: string;
  input: Record<string, unknown>;
  signal?: AbortSignal;
}

const s3Error = (name: string, status: number): S3ServiceException =>
  new S3ServiceException({
    name,
    $fault: 'client',
    $metadata: { httpStatusCode: status },
    message: name,
  });

/**
 * A real `S3Client` whose `send` answers from a table of buckets, the way MinIO
 * answers: 404 `NotFound` for a missing bucket's HEAD, 404
 * `ServerSideEncryptionConfigurationNotFoundError` for an unencrypted one.
 */
function fakeS3(
  buckets: Record<string, BucketState>,
  override?: (sent: Sent) => unknown,
): { client: S3Client; sent: Sent[] } {
  const client = new S3Client({ region: 'us-east-1', endpoint: 'http://127.0.0.1:9', forcePathStyle: true });
  const sent: Sent[] = [];
  (vi.spyOn(client, 'send') as unknown as MockInstance).mockImplementation(
    async (command: { input: Record<string, unknown> }, options?: { abortSignal?: AbortSignal }) => {
      const bucket = String(command.input.Bucket);
      const record: Sent = {
        command: command.constructor.name,
        bucket,
        input: command.input,
        signal: options?.abortSignal,
      };
      sent.push(record);
      if (override) {
        const answer = override(record);
        if (answer !== undefined) {
          if (answer instanceof Error) throw answer;
          return answer;
        }
      }
      const state = buckets[bucket];
      if (command instanceof HeadBucketCommand) {
        if (!state?.exists) throw s3Error('NotFound', 404);
        return {};
      }
      if (command instanceof CreateBucketCommand) {
        buckets[bucket] = { exists: true, sse: null };
        return {};
      }
      if (command instanceof GetBucketEncryptionCommand) {
        if (!state?.exists) throw s3Error('NoSuchBucket', 404);
        if (!state.sse) throw s3Error('ServerSideEncryptionConfigurationNotFoundError', 404);
        return {
          ServerSideEncryptionConfiguration: {
            Rules: [{ ApplyServerSideEncryptionByDefault: { SSEAlgorithm: state.sse } }],
          },
        };
      }
      throw new Error(`unexpected command ${command.constructor.name}`);
    },
  );
  return { client, sent };
}

const quietLog = (): { log: Mock; warn: Mock } => ({ log: vi.fn(), warn: vi.fn() });

async function refusal(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    const message = (error as Error).message;
    expect(message).not.toContain(SECRET);
    return message;
  }
  throw new Error('expected boot to be refused');
}

describe('verifyBuckets', () => {
  it('passes a present, encrypted bucket and bounds every call with a deadline', async () => {
    const { client, sent } = fakeS3({ injishi: { exists: true, sse: 'AES256' } });
    const config = resolveS3StorageConfig({ ...BASE, NODE_ENV: 'production' });

    await expect(verifyBuckets(client, config, quietLog())).resolves.toBeUndefined();

    expect(sent.map((s) => `${s.command} ${s.bucket}`)).toEqual([
      'HeadBucketCommand injishi',
      'GetBucketEncryptionCommand injishi',
    ]);
    for (const call of sent) expect(call.signal).toBeInstanceOf(AbortSignal);
  });

  it('refuses to boot on a missing bucket, and says how to fix it', async () => {
    const { client, sent } = fakeS3({});
    const message = await refusal(
      verifyBuckets(client, resolveS3StorageConfig(BASE), quietLog()),
    );
    expect(message).toMatch(/Bucket "injishi" does not exist at http:\/\/injishi-minio:9000/);
    expect(message).toMatch(/provision\.sh/);
    expect(message).toMatch(/STORAGE_CREATE_BUCKETS=true/);
    expect(sent.some((s) => s.command === 'CreateBucketCommand')).toBe(false);
  });

  it('refuses an unencrypted bucket when encryption is required', async () => {
    const { client } = fakeS3({ injishi: { exists: true, sse: null } });
    const message = await refusal(
      verifyBuckets(client, resolveS3StorageConfig({ ...BASE, NODE_ENV: 'production' }), quietLog()),
    );
    expect(message).toMatch(/Bucket "injishi" .* has no default server-side encryption/);
    expect(message).toMatch(/\(the production default\)/);
    expect(message).toMatch(/mc encrypt set sse-s3 <alias>\/injishi/);
  });

  it('refuses a bucket whose rules name no encrypting algorithm', async () => {
    const { client } = fakeS3({ injishi: { exists: true, sse: 'NONE' } });
    await expect(
      verifyBuckets(client, resolveS3StorageConfig({ ...BASE, STORAGE_REQUIRE_ENCRYPTION: 'true' }), quietLog()),
    ).rejects.toThrow(/no default server-side encryption, and STORAGE_REQUIRE_ENCRYPTION is on\./);
  });

  it('accepts KMS encryption as well as SSE-S3', async () => {
    const { client } = fakeS3({ injishi: { exists: true, sse: 'aws:kms' } });
    await expect(
      verifyBuckets(client, resolveS3StorageConfig({ ...BASE, STORAGE_REQUIRE_ENCRYPTION: 'true' }), quietLog()),
    ).resolves.toBeUndefined();
  });

  it('does not ask about encryption when it is not required', async () => {
    const { client, sent } = fakeS3({ injishi: { exists: true, sse: null } });
    await verifyBuckets(client, resolveS3StorageConfig(BASE), quietLog());
    expect(sent.map((s) => s.command)).toEqual(['HeadBucketCommand']);
  });

  it('touches only the one bucket the stack names', async () => {
    const { client, sent } = fakeS3({ injishi: { exists: true, sse: 'AES256' } });
    const config = resolveS3StorageConfig({ ...BASE, NODE_ENV: 'production' });
    await expect(verifyBuckets(client, config, quietLog())).resolves.toBeUndefined();
    expect(new Set(sent.map((s) => s.bucket))).toEqual(new Set(['injishi']));
  });

  it('creates a missing bucket in development when STORAGE_CREATE_BUCKETS=true, loudly', async () => {
    const buckets: Record<string, BucketState> = {};
    const { client, sent } = fakeS3(buckets);
    const log = quietLog();
    await verifyBuckets(
      client,
      resolveS3StorageConfig({ ...BASE, STORAGE_CREATE_BUCKETS: 'true' }),
      log,
    );
    const created = sent.filter((s) => s.command === 'CreateBucketCommand');
    expect(created.map((s) => s.bucket)).toEqual(['injishi']);
    // us-east-1 is never named explicitly; S3 rejects it as a location.
    expect(created[0].input.CreateBucketConfiguration).toBeUndefined();
    expect(buckets.injishi.exists).toBe(true);
    expect(log.warn).toHaveBeenCalledWith(expect.stringMatching(/Created bucket "injishi".*Development only/));
  });

  it('names the region when creating outside us-east-1', async () => {
    const { client, sent } = fakeS3({});
    await verifyBuckets(
      client,
      resolveS3StorageConfig({ ...BASE, STORAGE_CREATE_BUCKETS: 'true', STORAGE_S3_REGION: 'af-south-1' }),
      quietLog(),
    );
    const created = sent.find((s) => s.command === 'CreateBucketCommand');
    expect(created?.input.CreateBucketConfiguration).toEqual({ LocationConstraint: 'af-south-1' });
  });

  it('still refuses a bucket it created when encryption is required', async () => {
    const { client } = fakeS3({});
    await expect(
      verifyBuckets(
        client,
        resolveS3StorageConfig({ ...BASE, STORAGE_CREATE_BUCKETS: 'true', STORAGE_REQUIRE_ENCRYPTION: 'true' }),
        quietLog(),
      ),
    ).rejects.toThrow(/Bucket "injishi" .* has no default server-side encryption/);
  });

  it('treats losing a creation race as success', async () => {
    const { client } = fakeS3({}, (sent) =>
      sent.command === 'CreateBucketCommand' ? s3Error('BucketAlreadyOwnedByYou', 409) : undefined,
    );
    await expect(
      verifyBuckets(client, resolveS3StorageConfig({ ...BASE, STORAGE_CREATE_BUCKETS: 'true' }), quietLog()),
    ).resolves.toBeUndefined();
  });

  it('refuses with the credential named when the key may not see the bucket', async () => {
    const { client } = fakeS3({}, () => s3Error('Forbidden', 403));
    const message = await refusal(verifyBuckets(client, resolveS3StorageConfig(BASE), quietLog()));
    expect(message).toMatch(/STORAGE_S3_ACCESS_KEY may not reach bucket "injishi"/);
    expect(message).toMatch(/HTTP 403/);
  });

  it('refuses when it cannot read the encryption configuration', async () => {
    const { client } = fakeS3({ injishi: { exists: true, sse: 'AES256' } }, (sent) =>
      sent.command === 'GetBucketEncryptionCommand' ? s3Error('AccessDenied', 403) : undefined,
    );
    await expect(
      verifyBuckets(client, resolveS3StorageConfig({ ...BASE, NODE_ENV: 'production' }), quietLog()),
    ).rejects.toThrow(/may not read the encryption of bucket "injishi"/);
  });

  it('refuses with the endpoint named when S3 is unreachable or times out', async () => {
    const refused = Object.assign(new Error('connect ECONNREFUSED 10.0.0.9:9000'), { code: 'ECONNREFUSED' });
    const { client: down } = fakeS3({}, () => refused);
    await expect(verifyBuckets(down, resolveS3StorageConfig(BASE), quietLog())).rejects.toThrow(
      /Could not reach bucket "injishi" at http:\/\/injishi-minio:9000: Error, ECONNREFUSED: connect ECONNREFUSED.*Check STORAGE_S3_ENDPOINT/,
    );

    const timeout = Object.assign(new Error('Request aborted'), { name: 'AbortError' });
    const { client: slow } = fakeS3({}, () => timeout);
    await expect(verifyBuckets(slow, resolveS3StorageConfig(BASE), quietLog())).rejects.toThrow(
      /Timed out trying to reach bucket "injishi"/,
    );
  });
});
