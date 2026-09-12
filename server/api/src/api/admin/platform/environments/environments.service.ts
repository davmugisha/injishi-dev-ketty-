import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminEnvironments, type AdapterMode } from '@injishi/contracts';

import { PLATFORM, type Platform } from '../../../../shared/config/platform';
import { PlatformHealthSnapshotService } from '../health-snapshots.service';

/**
 * The environment variable each seam's module reads, named once.
 *
 * These are the SAME keys the owning modules read — `payments.module.ts`,
 * `storage.module.ts`, `sms.module.ts`, `ebm.module.ts` — and that is the whole
 * design of this screen. A console reporting "payments: live" while the payment
 * module holds a mock client is worse than a console that says nothing, because
 * somebody will believe it and take real money. So this reads the switch, never
 * a table, and never a second copy of the answer.
 */
const MODE_KEYS = {
  payments: 'PAYMENT_ADAPTER_MODE',
  storage: 'STORAGE_ADAPTER_MODE',
  sms: 'SMS_MODE',
  ebm: 'VSDC_ADAPTER_MODE',
} as const;

/**
 * `GET /api/v1/admin/environments` (INTERFACE.md §10).
 *
 * `current.name` is the process's own environment, from `PLATFORM` (ADR-043
 * AC-25). A process serves exactly one environment now, so the environment the
 * process was started with IS the one the caller is looking at.
 *
 * **Two of the four adapter modes have no health row and never will.**
 * `storage` and `sms` are not values of the `adapter_name` pgEnum, which lists
 * `payment | ebm_vsdc | rra_tin | filing | mailer | maps`. So `adapterModes`
 * and `adapters` below are NOT a parallel record and must never be joined or
 * rendered as one: the first is what the deployment is configured to do, the
 * second is what has been observed. Wiring `storage` to an adapter health row
 * would require inventing an enum value, which would make this console the
 * source of truth for which adapter is live. It must not become that.
 */
@Injectable()
export class AdminEnvironmentsService {
  constructor(
    @Inject(PLATFORM) private readonly platform: Platform,
    private readonly config: ConfigService,
    private readonly snapshots: PlatformHealthSnapshotService,
  ) {}

  async read(): Promise<AdminEnvironments> {
    const adapters = await this.snapshots.adapters();

    return AdminEnvironments.parse({
      current: {
        name: this.platform.environment,
        nodeEnv: this.config.get<string>('NODE_ENV') ?? 'development',
        adapterModes: {
          payments: this.mode(MODE_KEYS.payments),
          storage: this.mode(MODE_KEYS.storage),
          sms: this.mode(MODE_KEYS.sms),
          ebm: this.mode(MODE_KEYS.ebm),
        },
      },
      adapters,
    });
  }

  /**
   * One environment variable, read as an `AdapterMode`.
   *
   * `AdapterMode` is `mock | live`, and three of the four keys spell it that
   * way. `STORAGE_ADAPTER_MODE` does not: `storage.module.ts` reads
   * `local | live`, because "local disk" is the honest name for what it does
   * when it is not talking to object storage. `local` maps to `mock` here so
   * the four modes are comparable on one row — the contract has one vocabulary
   * and this is where the translation happens, rather than in a browser that
   * would have to know which of the four is spelled differently.
   *
   * Anything unrecognised reports `mock`. In a running process this branch is
   * unreachable: each owning module REFUSES TO BOOT on a value it cannot read,
   * deliberately, so a live deployment cannot hold a garbage mode. If that ever
   * stops being true, erring toward `mock` is the safe direction — this screen
   * must never claim an adapter is live on the strength of a value nobody
   * understood.
   */
  private mode(key: string): AdapterMode {
    const raw = (this.config.get<string>(key) ?? '').trim().toLowerCase();
    return raw === 'live' ? 'live' : 'mock';
  }
}
