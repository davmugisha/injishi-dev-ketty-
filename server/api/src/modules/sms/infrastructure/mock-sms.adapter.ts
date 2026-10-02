import { Injectable, Logger } from '@nestjs/common';

import {
  maskE164,
  type SmsAdapterMode,
  type SmsMessage,
  type SmsPort,
} from '../domain/sms-port';

/**
 * The only SMS adapter that exists (ADR-039). It sends nothing and prints the
 * message to the server log.
 *
 * THIS IS THE ONE WRITTEN EXCEPTION to "a code never reaches a log" (AC-13),
 * and it is worth stating plainly why it is allowed. With no provider under
 * contract, printing the code is the only way a developer can complete a phone
 * sign in at all, and a feature nobody can run end to end is a feature nobody
 * can verify.
 *
 * The exception is STRUCTURAL, not a setting. This class is only reached over
 * a sample database (ADR-043's marker): `resolveSmsMode` runs it there when
 * `SMS_MODE` is unset or `mock`, runs `off` over a real database, and refuses
 * to boot on `SMS_MODE=mock` over a real one. So there is no environment
 * variable, feature flag or mistake that prints a code over real data: reaching
 * it would take a code change, and that code change is what a review would
 * catch. It used to be keyed on `NODE_ENV=production`, which the demo also
 * runs, so the demo could not boot once anything imported this seam.
 *
 * The destination is still masked, because the exception covers the code and
 * nothing else. A log line that carried both would be a full sign-in credential
 * sitting in log storage.
 */
@Injectable()
export class MockSmsAdapter implements SmsPort {
  readonly mode: SmsAdapterMode = 'mock';

  private readonly logger = new Logger(MockSmsAdapter.name);

  send(message: SmsMessage): Promise<void> {
    this.logger.log(
      `[MOCK SMS] to ${maskE164(message.toE164)}: ${message.body}`,
    );
    return Promise.resolve();
  }
}
