import { Logger } from '@nestjs/common';

import {
  PaymentRateLimitedError,
  PaymentUnavailableError,
  type AdapterMode,
  type CallbackEvent,
  type CaptureEscrowCommand,
  type OneTimeFeeCommand,
  type PaymentPort,
  type PaymentReceipt,
  type PayoutCommand,
  type RecurringChargeCommand,
  type RefundCommand,
  type ReleaseEscrowCommand,
  type RentCollectCommand,
  type SubscriptionChargeCommand,
  type VendorPayoutCommand,
  type VoidPendingCommand,
} from '../domain/payment-port';

/**
 * The one place every payment call gets a ceiling and a breaker (review 2.1).
 *
 * WHY HERE. A live provider that stalls would otherwise hold the Fastify
 * request, the pool connection under it, and the guest's spinner until the load
 * balancer gave up — and five such requests would take the whole API down with
 * the payment seam, not only bookings. Wrapping the port once means every
 * adapter, mock or live, inherits the same limit and the same failure
 * vocabulary, and no call site has to remember to add one.
 *
 * WHAT A TIMEOUT MEANS. Nothing certain. The provider may have settled the
 * capture after we stopped listening. That is why a timeout surfaces as
 * `PaymentUnavailableError` rather than a decline: the caller already treats
 * "unavailable" as "possibly happened" and routes it through the pending-void
 * path, which reads the transaction back before deciding.
 *
 * THE BREAKER is deliberately simple: after `breakAfter` consecutive
 * unavailable answers the port refuses for `coolOffMs` without calling out, so
 * a provider incident costs a fast 503 rather than a slow one, and the provider
 * is not hammered while it recovers. A single success closes it.
 */
export interface GuardOptions {
  timeoutMs: number;
  breakAfter: number;
  coolOffMs: number;
}

export const DEFAULT_GUARD: GuardOptions = {
  timeoutMs: 8_000,
  breakAfter: 5,
  coolOffMs: 30_000,
};

export class GuardedPaymentPort implements PaymentPort {
  private readonly log = new Logger(GuardedPaymentPort.name);
  private consecutiveFailures = 0;
  private openedAt = 0;

  constructor(
    private readonly inner: PaymentPort,
    private readonly options: GuardOptions = DEFAULT_GUARD,
  ) {}

  get mode(): AdapterMode {
    return this.inner.mode;
  }

  /** Visible for tests and for a health endpoint. */
  get circuitOpen(): boolean {
    return (
      this.consecutiveFailures >= this.options.breakAfter &&
      Date.now() - this.openedAt < this.options.coolOffMs
    );
  }

  private async guard<T>(key: string, work: () => Promise<T>): Promise<T> {
    if (this.circuitOpen) {
      throw new PaymentUnavailableError(
        'payment circuit is open after repeated failures',
        key,
      );
    }

    let timer: NodeJS.Timeout | undefined;
    const ceiling = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new PaymentUnavailableError(
              `no answer from the payment provider within ${this.options.timeoutMs}ms`,
              key,
            ),
          ),
        this.options.timeoutMs,
      );
    });

    try {
      const result = await Promise.race([work(), ceiling]);
      this.consecutiveFailures = 0;
      return result;
    } catch (err) {
      // Only "we could not get an answer" moves the breaker. A decline or a
      // rate limit is the provider answering, and answering is not failing.
      if (
        err instanceof PaymentUnavailableError &&
        !(err instanceof PaymentRateLimitedError)
      ) {
        this.consecutiveFailures += 1;
        if (this.consecutiveFailures === this.options.breakAfter) {
          this.openedAt = Date.now();
          this.log.error(
            `Payment circuit opened after ${this.consecutiveFailures} consecutive failures; ` +
              `refusing for ${this.options.coolOffMs}ms`,
          );
        }
      }
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  captureEscrow(c: CaptureEscrowCommand): Promise<PaymentReceipt> {
    return this.guard(c.idempotencyKey, () => this.inner.captureEscrow(c));
  }
  releaseEscrow(c: ReleaseEscrowCommand): Promise<PaymentReceipt> {
    return this.guard(c.idempotencyKey, () => this.inner.releaseEscrow(c));
  }
  refund(c: RefundCommand): Promise<PaymentReceipt> {
    return this.guard(c.idempotencyKey, () => this.inner.refund(c));
  }
  voidPending(c: VoidPendingCommand): Promise<PaymentReceipt> {
    return this.guard(c.idempotencyKey, () => this.inner.voidPending(c));
  }
  payout(c: PayoutCommand): Promise<PaymentReceipt> {
    return this.guard(c.idempotencyKey, () => this.inner.payout(c));
  }
  chargeRecurring(c: RecurringChargeCommand): Promise<PaymentReceipt> {
    return this.guard(c.idempotencyKey, () => this.inner.chargeRecurring(c));
  }
  chargeOneTimeFee(c: OneTimeFeeCommand): Promise<PaymentReceipt> {
    return this.guard(c.idempotencyKey, () => this.inner.chargeOneTimeFee(c));
  }
  collectRent(c: RentCollectCommand): Promise<PaymentReceipt> {
    return this.guard(c.idempotencyKey, () => this.inner.collectRent(c));
  }
  payVendor(c: VendorPayoutCommand): Promise<PaymentReceipt> {
    return this.guard(c.idempotencyKey, () => this.inner.payVendor(c));
  }
  chargeSubscription(c: SubscriptionChargeCommand): Promise<PaymentReceipt> {
    return this.guard(c.idempotencyKey, () => this.inner.chargeSubscription(c));
  }
  /** Reading a callback is local work: no provider is called, so nothing to guard. */
  parseCallback(provider: string, headers: Record<string, string | string[] | undefined>, rawBody: Buffer): CallbackEvent | null {
    return this.inner.parseCallback(provider, headers, rawBody);
  }
  fetchTransaction(
    workspaceId: string,
    adapterRef: string,
  ): Promise<PaymentReceipt | null> {
    return this.guard(adapterRef, () =>
      this.inner.fetchTransaction(workspaceId, adapterRef),
    );
  }
}
