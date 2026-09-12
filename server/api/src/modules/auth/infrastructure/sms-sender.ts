import type { SendSms } from '@injishi/auth';
import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  maskE164,
  SMS_PORT,
  SmsUnavailableError,
  type SmsPort,
} from '../../sms/domain/sms-port';

/**
 * Delivers phone sign-in codes over the SMS seam (ADR-039), the twin of
 * `OtpMailer` on the email side.
 *
 * It exists so `@injishi/auth` never learns what a provider is. That package
 * knows a code must reach a handset and nothing about how; this class knows how
 * and nothing about why. `createAuth({ sendSms })` is the one join between them,
 * exactly as `sendOtp` already is for email.
 *
 * IT ALSO OWNS THE WORDS. The message body is copy, and copy belongs beside the
 * other copy this service sends, not inside a shared auth package that every
 * client also imports.
 */
@Injectable()
export class SmsSender {
  /**
   * Longest we will wait for the provider before treating the send as failed.
   *
   * Sign-in is a foreground request. A gateway that is unreachable — no egress,
   * a DNS blackhole, a provider having a bad morning — must not hold the sign-in
   * box open, because a spinner with no end is worse than a refusal that offers
   * the email route (AC-14).
   */
  private static readonly SEND_TIMEOUT_MS = 8_000;

  private readonly logger = new Logger(SmsSender.name);

  constructor(@Inject(SMS_PORT) private readonly sms: SmsPort) {}

  /** Bound so it can be handed to `createAuth({ sendSms })` as a value. */
  readonly send: SendSms = async ({ phone, code }) => {
    const body = `Your Injishi sign-in code is ${code}. It expires in 10 minutes. Injishi will never ask you for this code.`;

    try {
      await this.withTimeout(this.sms.send({ toE164: phone, body }));
    } catch (error) {
      /*
       * The number is masked and the body is dropped entirely, because the body
       * carries the code (AC-13). A provider's own error text has been seen to
       * quote the message it could not send, so the caught error is described
       * rather than printed.
       */
      this.logger.error(
        `SMS send failed for ${maskE164(phone)}: ${
          error instanceof Error ? error.name : 'unknown error'
        }`,
      );
      // One domain outcome whatever went wrong, so the caller can offer the
      // email route instead of leaking a transport failure to a sign-in screen.
      throw new SmsUnavailableError();
    }
  };

  private async withTimeout<T>(work: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        work,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new SmsUnavailableError('The SMS provider timed out.')),
            SmsSender.SEND_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
