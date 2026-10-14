/**
 * The SMS seam (ADR-039).
 *
 * ONE interface for every text message the platform sends: a code, today the
 * National ID identity code (ADR-060). Business logic calls this and nothing else;
 * it never names a provider, never sees an HTTP status, and never branches on
 * `mock` versus `live`. Choosing a provider is registering a different
 * implementation in `sms.module.ts` and changing nothing here or above.
 *
 * It is deliberately the same shape as the payment seam beside it, for the same
 * reason: the provider choice is a commercial decision that has not been taken,
 * and the whole feature has to be buildable and testable before it is.
 *
 * Two rules make the swap safe rather than merely possible.
 *
 * **Failure is a domain outcome, never a provider error.** An adapter turns
 * whatever its provider says into `SmsUnavailableError`. The caller then tells
 * the person the code could not be sent and offers them their email address
 * instead (AC-14), which it could not do if it were handed a raw socket error.
 *
 * **A code never reaches a log.** Not on the happy path, not on a failure path,
 * and neither does a full phone number. There is ONE written exception, in
 * `MockSmsAdapter`, and it is made structurally unreachable over a real
 * database rather than switched off by configuration (`resolveSmsMode`).
 */

/** Which side of the seam is live. Mirrors the Postgres `adapter_mode` enum. */
export type SmsAdapterMode = 'mock' | 'live';

/**
 * How this process runs the seam: one of the two adapters, or `off`, which is
 * no provider and no mock (a real database before a provider is registered).
 * Never stored, which is why `off` is not an `adapter_mode` value.
 */
export type SmsMode = SmsAdapterMode | 'off';

/** Nest injection token. Everything depends on the interface, not a class. */
export const SMS_PORT = 'SMS_PORT';

/**
 * The provider could not be asked, or would not say yes.
 *
 * There is no `SmsDeclinedError` twin of the payment seam's `PaymentDeclined`.
 * An SMS gateway accepting a message is not the same as a handset receiving
 * one, and no provider tells you the difference synchronously, so "declined"
 * would be a distinction this seam cannot honestly make. Delivery receipts are
 * the follow-up that would change that, once a live provider exists.
 */
export class SmsUnavailableError extends Error {
  constructor(message = 'The SMS provider could not be reached.') {
    super(message);
    this.name = 'SmsUnavailableError';
  }
}

/** One text message to send. */
export interface SmsMessage {
  /** The destination, in E.164. Never logged in full. */
  toE164: string;
  /** The message body. Carries the code, so it is never logged either. */
  body: string;
}

export interface SmsPort {
  /** Which side of the seam this instance is. Surfaced for boot logging only. */
  readonly mode: SmsMode;
  /**
   * Send one message, or throw `SmsUnavailableError`.
   *
   * Resolving means the provider ACCEPTED the message, never that a handset
   * received it. Callers must not treat a resolved promise as delivery.
   */
  send(message: SmsMessage): Promise<void>;
}

/**
 * A phone number reduced to something safe to write down.
 *
 * `+250788123456` becomes `+250·····456`: enough to recognise a number you
 * already know while reading a log, never enough to learn one you do not. A
 * phone number is personal data under Law 058/2021, and so is the fact that a
 * given number asked for a code, so this is the only form any log line gets.
 */
export function maskE164(phone: string): string {
  if (phone.length <= 7) return '·'.repeat(phone.length);
  return `${phone.slice(0, 4)}${'·'.repeat(phone.length - 7)}${phone.slice(-3)}`;
}
