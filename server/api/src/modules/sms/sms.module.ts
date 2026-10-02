import { Logger, Module } from '@nestjs/common';

import { PLATFORM, type Platform } from '../../shared/config/platform';
import { SMS_PORT, type SmsMode, type SmsPort } from './domain/sms-port';
import { MockSmsAdapter } from './infrastructure/mock-sms.adapter';
import { OffSmsAdapter } from './infrastructure/off-sms.adapter';

/**
 * The SMS seam (ADR-039), mirroring `payments.module.ts` deliberately.
 *
 * Two refusals happen at BOOT rather than at the first sign in, because a
 * service that starts, serves, and only reveals at the sign-in box that it
 * cannot send a code has already locked people out of their accounts while
 * reporting itself healthy.
 *
 * At boot, and never when this file is LOADED. The adapter used to be chosen
 * inside the `@Module` decorator, so merely importing this file ran the
 * refusals, before the platform was known. Nothing imported it until
 * `UserModule` did for the National ID code (ADR-060), and on 2026-10-01 that
 * import kept the demo API from booting at all: the demo runs
 * `NODE_ENV=production`, which the old rule refused the mock under. The mode
 * is now decided in the provider's factory, from the platform, as the identity
 * seams decide theirs.
 */

/** The live adapter, once a provider is chosen. Null until then, and boot refuses. */
const LIVE_ADAPTER: (new () => SmsPort) | null = null;

/**
 * The mode this process runs the seam in, from `SMS_MODE` and from what the
 * database is (ADR-043's sample marker), the rule `resolveIdentityMode` uses:
 *
 * - Unset: `mock` over a sample database, `off` over a real one. So every
 *   laptop and the demo send through the mock, and production, which has no
 *   provider yet, boots with SMS off rather than refusing to boot.
 * - `mock` over a REAL database is refused (AC-13). `MockSmsAdapter` prints
 *   every code into the log, and over real data those are real people's codes.
 *   This is what makes "the mock never runs on real data" a fact about the
 *   program rather than a promise about the deployment. `NODE_ENV` is not
 *   asked: the demo runs `NODE_ENV=production` over sample data, and the
 *   marker, not `NODE_ENV`, is what says which data is real.
 * - Anything unreadable is refused rather than defaulted. `SMS_MODE=Live `
 *   quietly becoming something else is a deployment believing it sends.
 */
export function resolveSmsMode(raw: string | undefined, sampleData: boolean): SmsMode {
  const mode = (raw ?? '').trim().toLowerCase();
  if (mode === '') return sampleData ? 'mock' : 'off';
  if (mode !== 'mock' && mode !== 'live' && mode !== 'off') {
    throw new Error(`SMS_MODE must be "mock", "live" or "off", got "${mode}".`);
  }
  if (mode === 'mock' && !sampleData) {
    throw new Error(
      'SMS_MODE=mock is refused over a database without the sample marker: ' +
        'MockSmsAdapter prints every code it sends to the log. Run "off" until a ' +
        'live adapter is registered in sms.module.ts, or run over a sample database.',
    );
  }
  return mode;
}

/** Build this process's adapter. Exported for the spec, which checks every branch. */
export function buildSmsAdapter(
  env: NodeJS.ProcessEnv,
  platform: Pick<Platform, 'sampleData'>,
): SmsPort {
  const log = new Logger('SmsModule');
  const mode = resolveSmsMode(env.SMS_MODE, platform.sampleData);
  if (mode === 'live') {
    if (!LIVE_ADAPTER) {
      throw new Error(
        'SMS_MODE=live but no live SMS adapter is registered. Register one in ' +
          'sms.module.ts, or run with "off".',
      );
    }
    log.log('SMS adapter: live');
    return new LIVE_ADAPTER();
  }
  if (mode === 'mock') {
    log.warn(
      'SMS adapter: mock. Codes are PRINTED to this log and no message is sent ' +
        '(ADR-039 AC-13; sample database only).',
    );
    return new MockSmsAdapter();
  }
  log.log('SMS adapter: off. No provider is registered, so every send is refused as unavailable.');
  return new OffSmsAdapter();
}

@Module({
  providers: [
    {
      provide: SMS_PORT,
      inject: [PLATFORM],
      useFactory: (platform: Platform) => buildSmsAdapter(process.env, platform),
    },
  ],
  exports: [SMS_PORT],
})
export class SmsModule {}
