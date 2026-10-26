import { Injectable } from '@nestjs/common';

import {
  PaymentUnavailableError,
  type AdapterMode,
  type PaymentCommand,
  type PaymentPort,
  type PaymentReceipt,
} from '../domain/payment-port';

/**
 * Payments switched OFF (`PAYMENT_ADAPTER_MODE=off`, booking audit 2026-09-13).
 *
 * The production stack runs on a real database and has no payment provider
 * yet: none is chosen and there are no credentials. Its compose file used to
 * leave the mode unset, which resolved to `mock`, so a real guest could "pay",
 * get a confirmed booking with an escrow row reading `captured`, and no money
 * would exist anywhere. This adapter is what that stack runs instead.
 *
 * Every operation refuses with `PaymentUnavailableError`, which every caller
 * already reads as "we could not ask the provider, nothing was charged": the
 * checkout answers 503 with that sentence and writes no booking, and a queued
 * compensation keeps retrying rather than recording money that never moved.
 *
 * `mode` reads `live` because this is not a mock. The badge that shows a
 * mocked seam must not show on a stack that takes no imaginary money either.
 */
@Injectable()
export class OffPaymentAdapter implements PaymentPort {
  readonly mode: AdapterMode = 'live';

  captureEscrow = refuse;
  releaseEscrow = refuse;
  refund = refuse;
  voidPending = refuse;
  payout = refuse;
  chargeRecurring = refuse;
  chargeOneTimeFee = refuse;

  fetchTransaction(workspaceId: string, adapterRef: string): Promise<PaymentReceipt | null> {
    return Promise.reject(
      new PaymentUnavailableError(
        `payments are switched off on this stack; cannot read ${adapterRef} for ${workspaceId}`,
        'none',
        'no',
      ),
    );
  }
}

function refuse(command: PaymentCommand): Promise<PaymentReceipt> {
  return Promise.reject(
    new PaymentUnavailableError(
      'payments are switched off on this stack (PAYMENT_ADAPTER_MODE=off)',
      command.idempotencyKey,
      // Nothing was sent anywhere (073 AC-7).
      'no',
    ),
  );
}
