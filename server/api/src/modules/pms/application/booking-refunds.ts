import { Injectable } from '@nestjs/common';

import { RefundsOwedService } from '../../pay/application/refunds-owed.service';
import type { RefundOwedWrite } from '../../pay/infrastructure/payment-transactions.repository';
import type { OweTx } from '../infrastructure/booking.repository';

export interface OwedRefundPlan {
  oweTx: OweTx;
  /** After commit: ask the payer for their details when the refund waits on them. */
  announce(): Promise<void>;
}

/**
 * CANCEL NOW, REFUND OWED (073-gtbank-payments AC-13).
 *
 * A cancellation, a decline, the auto decline sweep and a no-show write their
 * booking change at once and create the refund owed in the SAME transaction;
 * the disbursement dispatcher sends it when the account can cover it, and the
 * booking reads refunded only when the bank says so (`RefundOutcomesHandler`).
 *
 * `plan` returns null when the payment predates the bank record: that booking
 * is refunded the old way, straight through the provider and recorded after
 * (ADR-020 D-h), so nothing captured before this change is stranded.
 */
@Injectable()
export class BookingRefunds {
  constructor(private readonly refunds: RefundsOwedService) {}

  async plan(input: {
    reference: string;
    bookingId: string;
    workspaceId: string;
    adapterRef: string | null;
    idempotencyKey: string;
    operation: 'refund' | 'escrow_release_guest';
  }): Promise<OwedRefundPlan | null> {
    if (!input.adapterRef) return null;
    const prepared = await this.refunds.prepare(input.adapterRef, `payments: payee details for refund of ${input.reference}`);
    if (!prepared) return null;

    let written: RefundOwedWrite | null = null;
    return {
      oweTx: async (tx, amountRwf) => {
        written = await this.refunds.writeTx(tx, prepared, {
          idempotencyKey: input.idempotencyKey,
          workspaceId: input.workspaceId,
          operation: input.operation,
          amountRwf,
          fit: 'cap',
          bookingId: input.bookingId,
        });
        return written;
      },
      announce: async () => {
        if (written) await this.refunds.announce(prepared, written);
      },
    };
  }
}
