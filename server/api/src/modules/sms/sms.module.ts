import { Logger, Module, type Provider } from '@nestjs/common';

import { isProduction } from '../../shared/config/security.config';
import { SMS_PORT, type SmsAdapterMode, type SmsPort } from './domain/sms-port';
import { MockSmsAdapter } from './infrastructure/mock-sms.adapter';

/**
 * The SMS seam (ADR-039), mirroring `payments.module.ts` deliberately.
 *
 * Two refusals happen at BOOT rather than at the first sign in, because a
 * service that starts, serves, and only reveals at the sign-in box that it
 * cannot send a code has already locked people out of their accounts while
 * reporting itself healthy.
 */

/** The live adapter, once a provider is chosen. Null until then, and boot refuses. */
const LIVE_ADAPTER: (new () => SmsPort) | null = null;

export function resolveSmsMode(
  raw: string | undefined,
  nodeEnv: string | undefined,
): SmsAdapterMode {
  const mode = (raw ?? 'mock').trim().toLowerCase();
  if (mode !== 'mock' && mode !== 'live') {
    // An unreadable mode is not defaulted quietly. `SMS_MODE=Live ` silently
    // falling back to mock is a production deployment printing sign-in codes
    // into its log while every screen says the message was sent.
    throw new Error(`SMS_MODE must be "mock" or "live", got "${mode}".`);
  }
  if (mode === 'mock' && isProduction(nodeEnv)) {
    // AC-13. This is what makes "the mock cannot run in production" a fact
    // about the program rather than a promise about the deployment.
    throw new Error(
      'SMS_MODE=mock is refused when NODE_ENV=production: MockSmsAdapter ' +
        'prints sign-in codes to the log. Set SMS_MODE=live and register a ' +
        'live adapter in sms.module.ts.',
    );
  }
  return mode;
}

function adapterClass(): new () => SmsPort {
  const mode = resolveSmsMode(process.env.SMS_MODE, process.env.NODE_ENV);
  if (mode === 'live') {
    if (!LIVE_ADAPTER) {
      throw new Error(
        'SMS_MODE=live but no live SMS adapter is registered. Register one in ' +
          'sms.module.ts, or run with mode "mock" outside production.',
      );
    }
    new Logger('SmsModule').log('SMS adapter: live');
    return LIVE_ADAPTER;
  }
  new Logger('SmsModule').warn(
    'SMS adapter: mock. Sign-in codes are PRINTED to this log and no message ' +
      'is sent (ADR-039 AC-13).',
  );
  return MockSmsAdapter;
}

function smsProviders(): Provider[] {
  return [{ provide: SMS_PORT, useClass: adapterClass() }];
}

@Module({
  providers: smsProviders(),
  exports: [SMS_PORT],
})
export class SmsModule {}
