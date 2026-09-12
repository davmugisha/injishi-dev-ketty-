import {
  CreateBucketCommand,
  GetBucketEncryptionCommand,
  HeadBucketCommand,
  type BucketLocationConstraint,
  type S3Client,
} from '@aws-sdk/client-s3';

import { DEFAULT_REGION, type S3StorageConfig } from './s3-storage.config';
import {
  S3_TIMEOUTS,
  describeS3Error,
  isS3Timeout,
  s3StatusOf,
  withDeadline,
} from './s3-errors';

/** The slice of Nest's `Logger` boot verification speaks through. */
export interface VerificationLog {
  log(message: string): void;
  warn(message: string): void;
}

/**
 * Refuse to boot on a store that cannot keep what it is about to be given
 * (F-S09, storage contract C4).
 *
 * The bucket this process writes to must exist, and when encryption is
 * required it must carry default server-side encryption. Checked once, before
 * the process serves anything, because every one of these failures is
 * otherwise discovered at an upload: a missing bucket as a 500 on a guest's
 * check-in photograph, an unencrypted one never at all — the upload succeeds
 * and the national ID scan sits on disk in the clear.
 */
export async function verifyBuckets(
  client: S3Client,
  config: S3StorageConfig,
  log: VerificationLog,
  deadlineMs: number = S3_TIMEOUTS.operationMs,
): Promise<void> {
  await ensureBucket(client, config.bucket, config, log, deadlineMs);
  if (config.requireEncryption) {
    await assertEncrypted(client, config.bucket, config, deadlineMs);
  }
}

async function ensureBucket(
  client: S3Client,
  bucket: string,
  config: S3StorageConfig,
  log: VerificationLog,
  deadlineMs: number,
): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }), withDeadline(deadlineMs));
    return;
  } catch (error) {
    if (s3StatusOf(error) !== 404) throw cannot('reach', bucket, config, error);
  }

  if (!config.createBuckets) {
    throw new Error(
      `Bucket "${bucket}" does not exist at ${config.endpoint}. Provision it ` +
        '(minio-init runs infra/docker/minio/provision.sh), or, in development ' +
        'only, set STORAGE_CREATE_BUCKETS=true to let the API create it.',
    );
  }

  try {
    await client.send(
      new CreateBucketCommand({
        Bucket: bucket,
        // us-east-1 is the one region S3 refuses to be told about explicitly.
        ...(config.region === DEFAULT_REGION
          ? {}
          : {
              CreateBucketConfiguration: {
                LocationConstraint: config.region as BucketLocationConstraint,
              },
            }),
      }),
      withDeadline(deadlineMs),
    );
  } catch (error) {
    // Two processes booting together race to create it; the loser is fine.
    const name = (error as { name?: string } | null)?.name;
    if (name !== 'BucketAlreadyOwnedByYou') throw cannot('create', bucket, config, error);
  }
  // Loud on purpose. A bucket made here has none of what provisioning gives a
  // real one: no default encryption, no scoped credentials, no private policy
  // anybody wrote down. That is acceptable on a laptop and nowhere else, which
  // is why production refuses the flag outright.
  log.warn(
    `Created bucket "${bucket}" at ${config.endpoint} because STORAGE_CREATE_BUCKETS=true. ` +
      'Development only: it is not provisioned (no default encryption, no scoped credentials).',
  );
}

const ENCRYPTING_ALGORITHMS = new Set(['AES256', 'aws:kms', 'aws:kms:dsse']);

async function assertEncrypted(
  client: S3Client,
  bucket: string,
  config: S3StorageConfig,
  deadlineMs: number,
): Promise<void> {
  let algorithms: string[];
  try {
    const out = await client.send(
      new GetBucketEncryptionCommand({ Bucket: bucket }),
      withDeadline(deadlineMs),
    );
    algorithms = (out.ServerSideEncryptionConfiguration?.Rules ?? [])
      .map((rule) => rule.ApplyServerSideEncryptionByDefault?.SSEAlgorithm ?? '')
      .filter(Boolean);
  } catch (error) {
    // S3 and MinIO both answer an unencrypted bucket with this error rather
    // than an empty configuration.
    if ((error as { name?: string } | null)?.name !== 'ServerSideEncryptionConfigurationNotFoundError') {
      throw cannot('read the encryption of', bucket, config, error);
    }
    algorithms = [];
  }

  if (!algorithms.some((algorithm) => ENCRYPTING_ALGORITHMS.has(algorithm))) {
    throw new Error(
      `Bucket "${bucket}" at ${config.endpoint} has no default server-side ` +
        'encryption, and STORAGE_REQUIRE_ENCRYPTION is on' +
        (config.production ? ' (the production default)' : '') +
        '. Encrypt it with `mc encrypt set sse-s3 <alias>/' +
        bucket +
        '` (minio-init does this when it provisions; MinIO needs a KMS key ' +
        'for it), or set STORAGE_REQUIRE_ENCRYPTION=false outside production.',
    );
  }
}

/** A boot refusal for a bucket the API could not check, worded by cause. */
function cannot(
  action: string,
  bucket: string,
  config: S3StorageConfig,
  error: unknown,
): Error {
  const where = `bucket "${bucket}" at ${config.endpoint}`;
  if (isS3Timeout(error)) {
    return new Error(
      `Timed out trying to ${action} ${where}. Is STORAGE_S3_ENDPOINT reachable from this process?`,
      { cause: error },
    );
  }
  if (s3StatusOf(error) === 403) {
    return new Error(
      `STORAGE_S3_ACCESS_KEY may not ${action} ${where} (${describeS3Error(error)}). ` +
        'Check the access key and secret, and that its policy covers this bucket.',
      { cause: error },
    );
  }
  return new Error(
    `Could not ${action} ${where}: ${describeS3Error(error)}. ` +
      'Check STORAGE_S3_ENDPOINT and STORAGE_S3_REGION.',
    { cause: error },
  );
}
