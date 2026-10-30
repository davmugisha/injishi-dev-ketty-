import { Logger, type Provider } from '@nestjs/common';

import { PLATFORM, type Platform } from '../../../shared/config/platform';
import { resolveMockApis, sandboxRefusedOverRealData } from '../../../shared/config/mock-apis';
import { RraTinAdapter } from './rra-tin.adapter';
import { RraTinHttpAdapter } from './rra-tin-http.adapter';

/**
 * The live RRA TIN adapter, once RRA grants API access. Null until then, and
 * `live` refuses to boot (ADR-053, AC-R4).
 *
 * When access comes, `live` binds `RraTinHttpAdapter` with RRA's base URL and
 * key: the class `sandbox` already runs against Injishi Mock APIs, with its
 * record mapping corrected to RRA's document. Typed to the mock's shape so a
 * live adapter drops in with no caller changing: `RegistrationService` injects
 * `RraTinAdapter` and never asks which one it got.
 */
const LIVE_TIN_ADAPTER: (() => RraTinAdapter) | null = null;

export type TinAdapterMode = 'mock' | 'sandbox' | 'live';

/**
 * The TIN adapter mode, read in this ONE place, at boot.
 *
 * A copy of `payments.module.ts` by design (ADR-020), because the failure it
 * prevents is the same shape: a mode that is quietly defaulted or quietly ignored
 * lets a deployment believe it is doing something it is not.
 * `RRA_TIN_ADAPTER_MODE=Live ` falling back to mock would put businesses through
 * a check that was never RRA's while the deployment says it is.
 *
 * - `mock` (unset): the in-process mock, `rra-tin.adapter.ts`.
 * - `sandbox`: the HTTP adapter against Injishi Mock APIs (`MOCK_APIS_URL`).
 *   Sample databases only.
 * - `live`: RRA itself, once an adapter is registered above.
 */
export function resolveTinMode(env: NodeJS.ProcessEnv = process.env): TinAdapterMode {
  const raw = (env.RRA_TIN_ADAPTER_MODE ?? 'mock').trim().toLowerCase();
  if (raw === 'live' || raw === 'mock' || raw === 'sandbox') return raw;
  throw new Error(`RRA_TIN_ADAPTER_MODE must be "mock", "sandbox" or "live", got "${raw}".`);
}

/**
 * The provider `OrganizationModule` registers, chosen once.
 *
 * Throws while the module's provider list is being built, which is at boot, not
 * at the first registration. The alternative is a service that starts, takes a
 * registration fee, and then holds that business at `submitted` forever because
 * the check it is waiting on cannot run.
 */
export function tinAdapterProvider(env: NodeJS.ProcessEnv = process.env): Provider {
  const mode = resolveTinMode(env);
  const log = new Logger('OrganizationModule');
  if (mode === 'live') {
    if (!LIVE_TIN_ADAPTER) {
      throw new Error(
        'RRA_TIN_ADAPTER_MODE=live but no live RRA TIN adapter is registered. ' +
          'Register one in tin-adapter.provider.ts, or run with mode "mock".',
      );
    }
    log.log('RRA TIN adapter: live');
    return { provide: RraTinAdapter, useFactory: LIVE_TIN_ADAPTER };
  }
  if (mode === 'sandbox') {
    // Read now, so a bad URL stops the boot rather than the first check.
    const endpoint = resolveMockApis(env);
    return {
      provide: RraTinAdapter,
      inject: [PLATFORM],
      useFactory: (platform: Platform): RraTinAdapter => {
        if (!platform.sampleData) throw sandboxRefusedOverRealData('RRA_TIN_ADAPTER_MODE');
        log.warn(`RRA TIN adapter: sandbox, Injishi Mock APIs at ${endpoint.url}/rra (sample database only)`);
        return new RraTinHttpAdapter({
          mode: 'sandbox',
          baseUrl: `${endpoint.url}/rra`,
          apiKey: endpoint.credentials.rra.apiKey,
          timeoutMs: 8_000,
        });
      },
    };
  }
  log.log('RRA TIN adapter: mock (RRA API access not yet granted)');
  return { provide: RraTinAdapter, useClass: RraTinAdapter };
}
