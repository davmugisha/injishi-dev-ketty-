import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createReadStream } from 'node:fs';

import { Logger, type OnApplicationShutdown } from '@nestjs/common';

import { isObjectKey, mintObjectKey } from '../domain/object-key';
import type { StorageBackend } from '../domain/storage-backend';
import type {
  PutFileInput,
  PutObjectInput,
  PutObjectResult,
  StoragePort,
} from '../domain/storage-port';
import { verifyBuckets, type VerificationLog } from './s3-bucket-verification';
import type { S3StorageConfig } from './s3-storage.config';
import {
  S3_MAX_ATTEMPTS,
  S3_TIMEOUTS,
  describeS3Error,
  s3StatusOf,
  withDeadline,
  type S3Timeouts,
} from './s3-errors';

/**
 * The longest a signed read may live, whatever the caller asks for.
 *
 * F-S09 §10 makes the short TTL a security property: a signed URL is a bearer
 * credential for one person's document, and it leaks through browser history,
 * referrers and screenshots of a support chat. Fifteen minutes covers showing a
 * picture back and opening a certificate; anything longer should be a new URL.
 */
export const MAX_SIGNED_URL_TTL_SECONDS = 900;

/** How long one streamed file (a unit's video tour) may take to reach the store. */
const PUT_FILE_DEADLINE_MS = 10 * 60 * 1000;

/**
 * The two clients one process holds, whichever environments it serves.
 *
 * `client` is the only one that touches the network, against
 * `STORAGE_S3_ENDPOINT`. `signer` exists because a presigned URL embeds the
 * host it was signed for, and the host a browser can reach is not the one the
 * API reaches MinIO on. It is given a request handler that refuses to send, so
 * "used for signing only" is a property of the object rather than a habit of
 * its callers.
 */
export interface S3Clients {
  readonly client: S3Client;
  readonly signer: S3Client;
  /** The bounds `client` was built with; `operationMs` is applied per call. */
  readonly timeouts: S3Timeouts;
}

const REFUSES_TO_SEND = {
  handle: (): Promise<never> =>
    Promise.reject(
      new Error('The storage signing client signs URLs and never sends a request.'),
    ),
  updateHttpClientConfig: (): void => undefined,
  httpHandlerConfigs: (): Record<string, never> => ({}),
};

/**
 * The process's clients. `timeouts` is overridable for the specs that prove the
 * bounds against a server that stalls; production passes nothing.
 */
export function createS3Clients(
  config: S3StorageConfig,
  timeouts: S3Timeouts = S3_TIMEOUTS,
): S3Clients {
  const shared = {
    region: config.region,
    credentials: config.credentials,
    // MinIO serves buckets as a path, not a subdomain: `<endpoint>/injishi/…`.
    // Virtual-host addressing would ask DNS for `injishi.<endpoint host>`.
    forcePathStyle: true,
  };
  return {
    timeouts,
    client: new S3Client({
      ...shared,
      endpoint: config.endpoint,
      maxAttempts: S3_MAX_ATTEMPTS,
      requestHandler: {
        connectionTimeout: timeouts.connectMs,
        requestTimeout: timeouts.requestMs,
        // Without this a breached request timeout is only a logged warning.
        throwOnRequestTimeout: true,
      },
    }),
    signer: new S3Client({
      ...shared,
      endpoint: config.publicEndpoint,
      requestHandler: REFUSES_TO_SEND,
      // A presigned GET is a plain link. Checksum negotiation would add a
      // checksum-mode parameter a browser has no use for.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    }),
  };
}

/**
 * A `StoragePort` over one S3 bucket (F-S09): MinIO in production, reached
 * through the S3 API.
 *
 * One instance per process, over the stack's one bucket, owned by `S3Storage`.
 */
export class S3StorageAdapter implements StoragePort {
  constructor(
    private readonly clients: S3Clients,
    readonly bucket: string,
  ) {}

  async put(input: PutObjectInput): Promise<PutObjectResult> {
    // The same function the local adapter mints with, so a key means the same
    // object whichever store wrote it.
    const objectKey = mintObjectKey(input);
    try {
      await this.clients.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
          Body: input.body,
          ContentLength: input.body.byteLength,
          // Served back on the signed read, so a browser renders the picture
          // instead of downloading an octet stream.
          ContentType: input.mime,
        }),
        withDeadline(this.clients.timeouts.operationMs),
      );
    } catch (error) {
      throw new Error(
        `Storing ${objectKey} in bucket "${this.bucket}" failed: ${describeS3Error(error)}`,
        { cause: error },
      );
    }
    return { objectKey, sizeBytes: input.body.byteLength };
  }

  /**
   * A large file streamed from disk (a unit's video tour): one PUT with a
   * known length, so neither this process nor the SDK holds the whole file.
   * The deadline is longer than an ordinary put's: 100 MB over a slow link to
   * the store takes minutes, not seconds.
   */
  async putFile(input: PutFileInput): Promise<PutObjectResult> {
    const objectKey = mintObjectKey(input);
    try {
      await this.clients.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
          Body: createReadStream(input.path),
          ContentLength: input.sizeBytes,
          ContentType: input.mime,
        }),
        withDeadline(Math.max(this.clients.timeouts.operationMs, PUT_FILE_DEADLINE_MS)),
      );
    } catch (error) {
      throw new Error(
        `Storing ${objectKey} in bucket "${this.bucket}" failed: ${describeS3Error(error)}`,
        { cause: error },
      );
    }
    return { objectKey, sizeBytes: input.sizeBytes };
  }

  /**
   * A presigned GET against the public endpoint.
   *
   * Signing is local arithmetic over the key and the credentials; nothing is
   * sent, and the object's existence is not checked. A caller holding a key
   * from `stored_objects` has already been through that row.
   */
  async signedUrl(objectKey: string, ttlSeconds: number): Promise<string> {
    assertObjectKey(objectKey);
    if (!Number.isFinite(ttlSeconds) || ttlSeconds < 1) {
      // Lowering a TTL is this adapter's right; inventing one for a caller that
      // passed nonsense is not.
      throw new Error(`A signed URL needs a TTL of at least one second, got ${ttlSeconds}.`);
    }
    return getSignedUrl(
      this.clients.signer,
      new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      { expiresIn: Math.min(Math.floor(ttlSeconds), MAX_SIGNED_URL_TTL_SECONDS) },
    );
  }

  /**
   * Read the bytes back, for a server-side sender (ADR-049 AC-20).
   *
   * NOT the way to hand a file to a browser — `signedUrl` is, and this exists
   * beside it rather than instead of it. The body is collected into one buffer
   * because the one caller attaches it to an email, which needs the whole file
   * anyway; anything large enough for that to matter does not belong in a mail.
   */
  async get(objectKey: string): Promise<Buffer> {
    assertObjectKey(objectKey);
    try {
      const result = await this.clients.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }),
        withDeadline(this.clients.timeouts.operationMs),
      );
      if (!result.Body) {
        throw new Error('the store returned no body');
      }
      // The SDK's own collector, so the stream is drained the way this runtime
      // expects rather than by a hand-rolled chunk loop.
      return Buffer.from(await result.Body.transformToByteArray());
    } catch (error) {
      throw new Error(
        `Reading ${objectKey} from bucket "${this.bucket}" failed: ${describeS3Error(error)}`,
        { cause: error },
      );
    }
  }

  /** Idempotent: removing what is already gone is success, as S3 itself says. */
  async remove(objectKey: string): Promise<void> {
    assertObjectKey(objectKey);
    try {
      await this.clients.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }),
        withDeadline(this.clients.timeouts.operationMs),
      );
    } catch (error) {
      if (s3StatusOf(error) === 404 && (error as { name?: string }).name === 'NoSuchKey') return;
      throw new Error(
        `Removing ${objectKey} from bucket "${this.bucket}" failed: ${describeS3Error(error)}`,
        { cause: error },
      );
    }
  }
}

/**
 * Refuse a key this platform could not have minted.
 *
 * `signedUrl` and `remove` take keys from a column, and a column is only as
 * clean as every writer that ever touched it. S3 itself would store `a/../b`
 * as a literal key, but the URL for it passes through proxies that normalise
 * paths, so the key is checked here rather than trusted there.
 */
function assertObjectKey(objectKey: string): void {
  if (!isObjectKey(objectKey)) {
    throw new Error('Invalid object key.');
  }
}

/**
 * The live store for one process: its clients, the bucket they were verified
 * against, and the port over it.
 *
 * Opened once at boot by `storage.module.ts`. `open` refuses to return until
 * the bucket has passed `verifyBuckets`, so a process holding one of these has
 * a store that exists and, where required, is encrypted.
 */
export class S3Storage implements StorageBackend, OnApplicationShutdown {
  readonly mode = 'live' as const;
  readonly port: S3StorageAdapter;

  private constructor(
    readonly config: S3StorageConfig,
    private readonly clients: S3Clients,
  ) {
    this.port = new S3StorageAdapter(clients, config.bucket);
  }

  static async open(
    config: S3StorageConfig,
    clients: S3Clients = createS3Clients(config),
    log: VerificationLog = new Logger('S3Storage'),
  ): Promise<S3Storage> {
    try {
      await verifyBuckets(clients.client, config, log, clients.timeouts.operationMs);
    } catch (error) {
      // A refused boot must not leave keep-alive sockets holding the process up.
      clients.client.destroy();
      clients.signer.destroy();
      throw error;
    }
    if (config.production && !config.requireEncryption) {
      log.warn(
        'STORAGE_REQUIRE_ENCRYPTION=false under NODE_ENV=production: buckets are not ' +
          'checked for encryption at rest, which Law 058/2021 requires of personal data.',
      );
    }
    if (config.production && config.publicEndpoint.startsWith('http:')) {
      log.warn(
        `STORAGE_S3_PUBLIC_ENDPOINT is ${config.publicEndpoint}: signed URLs for ` +
          'personal documents will travel over plain http.',
      );
    }
    log.log(
      `S3 storage at ${config.endpoint}, bucket "${config.bucket}"` +
        `; signed URLs on ${config.publicEndpoint}, at most ${MAX_SIGNED_URL_TTL_SECONDS}s.`,
    );
    return new S3Storage(config, clients);
  }

  onApplicationShutdown(): void {
    this.clients.client.destroy();
    this.clients.signer.destroy();
  }
}
