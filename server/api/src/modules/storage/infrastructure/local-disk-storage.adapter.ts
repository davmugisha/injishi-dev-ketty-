import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import { mintObjectKey } from '../domain/object-key';
import {
  MIME_EXTENSION,
  type PutObjectInput,
  type PutObjectResult,
  type StoragePort,
} from '../domain/storage-port';

/**
 * A development store that writes to disk (ADR-026 assumption 1).
 *
 * The counterpart of `MockPaymentAdapter`: it exists so the whole certificate
 * path can be built and driven without an object store, and it is DEVELOPMENT
 * ONLY. It is not in-country storage, it is not encrypted at rest, and it does
 * not satisfy Law 058/2021. A deployment stores on MinIO through
 * `S3StorageAdapter` (`STORAGE_ADAPTER_MODE=live`), which refuses to boot
 * unless every bucket it will write to exists and, in production, is encrypted.
 *
 * The key it returns is opaque and adapter-neutral —
 * `certificate/2026/08/<uuid>.pdf` — and is minted by `mintObjectKey`, the same
 * function the S3 adapter uses, so the same upload gets the same key whichever
 * store holds the bytes. It deliberately does NOT encode the local root.
 */
@Injectable()
export class LocalDiskStorageAdapter implements StoragePort {
  private readonly log = new Logger(LocalDiskStorageAdapter.name);
  private readonly root: string;

  constructor() {
    this.root = resolve(
      process.env.STORAGE_LOCAL_ROOT ?? join(process.cwd(), '.storage'),
    );
  }

  async put(input: PutObjectInput): Promise<PutObjectResult> {
    // Never the client's file name, and a hint only when it is safe to put in a
    // path: `mintObjectKey` owns both rules for every adapter.
    const objectKey = mintObjectKey(input);

    const target = this.pathFor(objectKey);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, input.body);

    return { objectKey, sizeBytes: input.body.byteLength };
  }

  /**
   * A data URL rather than a link.
   *
   * There is no signing key and no expiring host to hand out locally, and
   * inventing a `/storage/<key>` route would be an unauthenticated read path
   * that the real adapter never needs. Inlining the bytes keeps the local mode
   * honest about being a stand-in: it works for a preview, and it obviously
   * does not scale, which is the correct pressure.
   */
  async signedUrl(objectKey: string, ttlSeconds: number): Promise<string> {
    // The TTL is real in the port and unenforceable here: a data URL cannot
    // expire. Logged rather than silently dropped, so a `live` run that somehow
    // reached this adapter leaves a trace of the guarantee it did not keep.
    this.log.debug(
      `Local storage cannot expire a URL; ${ttlSeconds}s TTL not applied to ${objectKey}.`,
    );
    const bytes = await readFile(this.pathFor(objectKey));
    const extension = objectKey.split('.').pop() ?? 'bin';
    const mime =
      Object.entries(MIME_EXTENSION).find(([, e]) => e === extension)?.[0] ??
      'application/octet-stream';
    return `data:${mime};base64,${bytes.toString('base64')}`;
  }

  /** Straight off the disk. `pathFor` refuses a key that escapes the root. */
  async get(objectKey: string): Promise<Buffer> {
    return readFile(this.pathFor(objectKey));
  }

  async remove(objectKey: string): Promise<void> {
    await rm(this.pathFor(objectKey), { force: true });
  }

  /**
   * Resolve a key under the root, and refuse anything that escapes it.
   *
   * Every key this adapter serves it also minted, so `../` should be
   * impossible — but `signedUrl` and `remove` take a key from a column, and a
   * column is only as clean as every writer that ever touched it. The check is
   * one line and the failure it prevents is reading any file on the host.
   */
  private pathFor(objectKey: string): string {
    const target = resolve(this.root, objectKey);
    if (target !== this.root && !target.startsWith(this.root + sep)) {
      this.log.error(`Refused an object key that escapes the root: ${objectKey}`);
      throw new Error('Invalid object key.');
    }
    return target;
  }
}
