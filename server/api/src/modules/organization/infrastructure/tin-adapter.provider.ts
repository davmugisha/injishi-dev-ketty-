import { Logger, type Provider } from '@nestjs/common';

import { RraTinAdapter } from './rra-tin.adapter';

/**
 * The live RRA TIN adapter, once RRA grants API access. Null until then, and
 * `live` refuses to boot (ADR-049, AC-R4).
 *
 * Typed to the mock's shape so a live adapter drops in with no caller changing:
 * `RegistrationService` injects `RraTinAdapter` and never asks which one it got.
 */
const LIVE_TIN_ADAPTER: (new () => RraTinAdapter) | null = null;

/**
 * The TIN adapter mode, read in this ONE place, at boot.
 *
 * A copy of `payments.module.ts` by design (ADR-020), because the failure it
 * prevents is the same shape: a mode that is quietly defaulted or quietly ignored
 * lets a deployment believe it is doing something it is not.
 * `RRA_TIN_ADAPTER_MODE=Live ` falling back to mock would put businesses through
 * a check that was never RRA's while the deployment says it is.
 */
export function resolveTinMode(
  env: NodeJS.ProcessEnv = process.env,
): 'mock' | 'live' {
  const raw = (env.RRA_TIN_ADAPTER_MODE ?? 'mock').trim().toLowerCase();
  if (raw === 'live') return 'live';
  if (raw === 'mock') return 'mock';
  throw new Error(
    `RRA_TIN_ADAPTER_MODE must be "mock" or "live", got "${raw}".`,
  );
}

/**
 * The provider `OrganizationModule` registers, chosen once.
 *
 * Throws while the module's provider list is being built, which is at boot, not
 * at the first registration. The alternative is a service that starts, takes a
 * registration fee, and then holds that business at `submitted` forever because
 * the check it is waiting on cannot run.
 */
export function tinAdapterProvider(
  env: NodeJS.ProcessEnv = process.env,
): Provider {
  if (resolveTinMode(env) === 'live') {
    if (!LIVE_TIN_ADAPTER) {
      throw new Error(
        'RRA_TIN_ADAPTER_MODE=live but no live RRA TIN adapter is registered. ' +
          'Register one in tin-adapter.provider.ts, or run with mode "mock".',
      );
    }
    new Logger('OrganizationModule').log('RRA TIN adapter: live');
    return { provide: RraTinAdapter, useClass: LIVE_TIN_ADAPTER };
  }
  new Logger('OrganizationModule').log(
    'RRA TIN adapter: mock (RRA API access not yet granted)',
  );
  return { provide: RraTinAdapter, useClass: RraTinAdapter };
}
