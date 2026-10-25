import { Logger, Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { StorageService } from './application/storage.service';
import { RentalsFilesStorage } from './application/rentals-files-storage';
import { UnitMediaStorage } from './application/unit-media-storage';
import { STORAGE_BACKEND, type StorageBackend } from './domain/storage-backend';
import { type AdapterMode, STORAGE_PORT, type StoragePort } from './domain/storage-port';
import { LocalDiskStorageAdapter } from './infrastructure/local-disk-storage.adapter';
import { S3Storage } from './infrastructure/s3-storage.adapter';
import {
  STORAGE_SETTING_NAMES,
  resolveS3StorageConfig,
  type StorageEnv,
} from './infrastructure/s3-storage.config';

/**
 * The storage seam's one wiring point (F-S09, ADR-026 assumption 1).
 *
 * **This file is the whole swap**, exactly as `payments.module.ts` is for the
 * payment seam. `local` writes to disk through `LocalDiskStorageAdapter`;
 * `live` stores on MinIO through `S3StorageAdapter`, named in `LIVE_ADAPTER`
 * below. `StorageService`, the uploads controller and the registration path all
 * depend on `STORAGE_PORT` and none of them knows which one they have.
 *
 * The mode is read from `STORAGE_ADAPTER_MODE` HERE and nowhere else, and every
 * setting of the live store is named in `s3-storage.config.ts`.
 *
 * Read through `ConfigService` inside a factory, not from `process.env` while
 * this file is imported. The provider list is built before `ConfigModule` has
 * loaded `.env`, so a mode written there used to be invisible here while the
 * admin environments screen, which reads it through `ConfigService`, reported
 * it: "storage: live" on the console, a laptop disk underneath. The factory
 * still runs at boot, before anything listens, so the refusals below are still
 * boot-time refusals.
 *
 * `STORAGE_BACKEND` is opened once per process and owns the clients;
 * `STORAGE_PORT` is its one port. One bucket per process, because a process has
 * one environment and the demo stack has a MinIO of its own (ADR-043).
 */

/**
 * The live adapter: MinIO over the S3 API.
 *
 * Refuses to boot on missing settings (`resolveS3StorageConfig`) and on a
 * bucket that is missing, or unencrypted where encryption is required
 * (`S3Storage.open`), rather than failing at the first upload. A service that
 * starts and only reveals at the upload step that it cannot store anything has
 * already taken a person's national ID scan.
 */
const LIVE_ADAPTER = (env: StorageEnv): Promise<StorageBackend> =>
  S3Storage.open(resolveS3StorageConfig(env));

export function resolveMode(value: string | undefined): AdapterMode {
  const raw = (value ?? 'local').trim().toLowerCase();
  if (raw === 'live') return 'live';
  if (raw === 'local') return 'local';
  // Not defaulted quietly, for the same reason the payment seam refuses:
  // "STORAGE_ADAPTER_MODE=Live " falling back to local is personal data
  // written to a container's disk while every screen says it was stored.
  throw new Error(
    `STORAGE_ADAPTER_MODE must be "local" or "live", got "${raw}".`,
  );
}

/** Open the store named by the environment. Exported for the module's spec. */
export async function openStorageBackend(env: StorageEnv): Promise<StorageBackend> {
  const log = new Logger('StorageModule');

  if (resolveMode(env.STORAGE_ADAPTER_MODE) === 'live') {
    const backend = await LIVE_ADAPTER(env);
    log.log('Storage adapter: live (S3)');
    return backend;
  }

  log.log('Storage adapter: local disk (development only; not encrypted, not in-country)');
  return { mode: 'local', port: new LocalDiskStorageAdapter() };
}

function readStorageEnv(config: ConfigService): StorageEnv {
  return Object.fromEntries(
    STORAGE_SETTING_NAMES.map((name) => [name, config.get<string>(name)]),
  );
}

/** The seam's providers. Exported so the spec can build them without the module. */
export function buildStorageProviders(): Provider[] {
  return [
    {
      provide: STORAGE_BACKEND,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Promise<StorageBackend> =>
        openStorageBackend(readStorageEnv(config)),
    },
    {
      provide: STORAGE_PORT,
      inject: [STORAGE_BACKEND],
      useFactory: (backend: StorageBackend): StoragePort => backend.port,
    },
  ];
}

@Module({
  providers: [...buildStorageProviders(), StorageService, UnitMediaStorage, RentalsFilesStorage],
  exports: [STORAGE_PORT, StorageService, UnitMediaStorage, RentalsFilesStorage],
})
export class StorageModule {}
