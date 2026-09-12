import type { AdapterMode, StoragePort } from './storage-port';

/**
 * The store this process opened at boot: the S3 client and its boot
 * verification, or the local disk.
 *
 * One store per process, because a process has one environment (ADR-043): the
 * demo stack has a MinIO and a bucket of its own, so nothing here chooses a
 * bucket per unit of work any more. `STORAGE_PORT`, what every caller injects,
 * is this backend's `port`.
 */
export const STORAGE_BACKEND = Symbol('STORAGE_BACKEND');

export interface StorageBackend {
  readonly mode: AdapterMode;
  /** The port every unit of work in this process stores through. */
  readonly port: StoragePort;
}
