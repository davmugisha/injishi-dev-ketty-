import { Injectable } from '@nestjs/common';

import { SmsUnavailableError, type SmsMode, type SmsPort } from '../domain/sms-port';

/**
 * SMS switched off: no provider is registered, and the mock is refused because
 * the database is real (`resolveSmsMode`). Every send fails exactly as an
 * unreachable provider does, so a caller tells the person the code could not be
 * sent, as it would during a provider outage.
 *
 * Production runs this until a provider is registered, and nothing there sends
 * today: the only sender is the National ID code (ADR-060), and its register is
 * `off` over a real database as well.
 */
@Injectable()
export class OffSmsAdapter implements SmsPort {
  readonly mode: SmsMode = 'off';

  send(): Promise<void> {
    return Promise.reject(
      new SmsUnavailableError('SMS is off here: no SMS provider is registered.'),
    );
  }
}
