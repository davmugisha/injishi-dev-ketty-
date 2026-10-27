import { Logger } from '@nestjs/common';

import { reportAlarm } from '../../../shared/observability/error-reporter';
import type { PaymentSeam } from '../domain/payment-seam';
import {
  type AdapterMode,
  type CaptureEscrowCommand,
  type OneTimeFeeCommand,
  type PaymentPort,
  type PaymentReceipt,
  type PayoutCommand,
  PaymentDeclinedError,
  PaymentUnavailableError,
  type RecurringChargeCommand,
  type RefundCommand,
  type ReleaseEscrowCommand,
  type VoidPendingCommand,
} from '../domain/payment-port';
import { referenceFor } from '../domain/reference';
import type { RefundsOwedService } from '../application/refunds-owed.service';
import {
  type PaymentTransactionsRepository,
  RefundExceedsCollectionError,
  type TransactionRow,
} from './payment-transactions.repository';

/**
 * The bank record's writer (073-gtbank-payments AC-2, AC-6, AC-6a, AC-9).
 *
 * Sits between every caller and `GuardedPaymentPort`, so whichever adapter is
 * bound (mock or live) writes the same rows, and a mock run exercises exactly
 * the record, balance and queue a live one does. When ADR-073's runtime lands,
 * it wraps this from outside; nothing here moves.
 *
 * A collection is written `sending` BEFORE its call, so a process that dies
 * between the call and the answer leaves a row to pull rather than a charge
 * with no record. A row that may already have reached the provider (`sending`
 * or `unknown`) is never sent again by a machine: the same press arriving
 * again is told the outcome is being confirmed. A row the provider already
 * answered replays that answer without asking again.
 *
 * A refund or a guest release is a REFUND OWED (AC-11 to AC-13): it is written
 * `queued` back to the collection it names, with that collection's wallet and
 * the payer's verified identity, and answered `pending` at once. The
 * disbursement dispatcher sends it when the account can cover it, and the
 * outcome reaches the booking through `PaymentOutcomes`. A collection made
 * before the bank record existed has no row to pay back to, so its refund goes
 * straight to the provider, as every refund did before.
 *
 * Host releases and payouts pass through until F-B12 gives them a payee store.
 */
export class RecordedPaymentPort implements PaymentPort {
  private readonly log = new Logger(RecordedPaymentPort.name);

  constructor(
    private readonly inner: PaymentPort,
    private readonly record: PaymentTransactionsRepository,
    private readonly seam: PaymentSeam,
    private readonly refunds: RefundsOwedService,
  ) {}

  get mode(): AdapterMode {
    return this.inner.mode;
  }

  captureEscrow(command: CaptureEscrowCommand): Promise<PaymentReceipt> {
    return this.collect(command, () => this.inner.captureEscrow(command));
  }

  chargeOneTimeFee(command: OneTimeFeeCommand): Promise<PaymentReceipt> {
    return this.collect(command, () => this.inner.chargeOneTimeFee(command));
  }

  chargeRecurring(command: RecurringChargeCommand): Promise<PaymentReceipt> {
    return this.collect(command, () => this.inner.chargeRecurring(command));
  }

  releaseEscrow(command: ReleaseEscrowCommand): Promise<PaymentReceipt> {
    if (command.beneficiary === 'host') return this.inner.releaseEscrow(command);
    return this.owe(command, 'escrow_release_guest', () => this.inner.releaseEscrow(command));
  }

  refund(command: RefundCommand): Promise<PaymentReceipt> {
    return this.owe(command, 'refund', () => this.inner.refund(command));
  }

  /**
   * Write a refund owed back to its collection, and answer it pending.
   *
   * - The wallet is the collection's own paying number, never an input (AC-11).
   * - The name and ID come from the payer's verified identity; without one the
   *   refund waits for them (`payee_details_missing`), and the payer is told
   *   through `PaymentOutcomes` (AC-12).
   * - A collection taken by a different provider or mode from the one bound now
   *   is parked for a person, never sent (AC-11).
   * - A refund larger than what remains of its collection is declined.
   */
  /**
   * Write a refund owed back to its collection, and answer it pending. The
   * whole rule is `RefundsOwedService`'s; a refund through the port is held to
   * the exact amount asked (AC-11), because no booking change beside it can
   * shrink to fit.
   */
  private async owe(
    command: RefundCommand | ReleaseEscrowCommand,
    operation: 'refund' | 'escrow_release_guest',
    legacy: () => Promise<PaymentReceipt>,
  ): Promise<PaymentReceipt> {
    const key = command.idempotencyKey;
    const prepared = await this.refunds.prepare(command.originalRef, `payments: payee details for refund ${referenceFor(key)}`);
    if (!prepared) return legacy();

    let written;
    try {
      written = await this.refunds.owe(prepared, {
        idempotencyKey: key,
        workspaceId: command.workspaceId,
        operation,
        amountRwf: command.amountRwf,
        fit: 'exact',
      });
    } catch (error) {
      if (error instanceof RefundExceedsCollectionError) {
        throw new PaymentDeclinedError('this refund exceeds what remains of the payment', key);
      }
      throw error;
    }
    const row = written.row;
    if (!row) throw new PaymentDeclinedError('nothing remains of this payment to refund', key);
    if (!written.created && row.amountRwf !== command.amountRwf) {
      throw new PaymentDeclinedError('this refund was already owed for a different amount', key);
    }
    return {
      adapterRef: row.providerReference ?? row.reference,
      mode: row.adapterMode,
      replayed: !written.created,
      amountRwf: row.amountRwf,
      currency: 'RWF',
      occurredAt: row.createdAt,
      settlement: row.status === 'successful' ? 'settled' : 'pending',
    };
  }

  voidPending(command: VoidPendingCommand): Promise<PaymentReceipt> {
    return this.inner.voidPending(command);
  }

  payout(command: PayoutCommand): Promise<PaymentReceipt> {
    return this.inner.payout(command);
  }

  /**
   * The provider's view, applied to the bank record once (AC-6a).
   *
   * A settled answer moves an open collection to `successful`, including one the
   * sweep had already marked `expired` (a late approval, AC-9a). "No such
   * transaction" for a reference the provider gave us is a dead end: `failed`.
   * An outage changes nothing and is rethrown, because "could not ask" is never
   * an answer.
   */
  async fetchTransaction(workspaceId: string, adapterRef: string): Promise<PaymentReceipt | null> {
    const receipt = await this.inner.fetchTransaction(workspaceId, adapterRef);
    const row =
      (await this.record.findByProviderReference(this.seam.provider, adapterRef)) ??
      (await this.record.findByReference(adapterRef));
    if (!row || row.direction !== 'collection') return receipt;

    if (row.status === 'successful') {
      // A reversal is found by a pull and applied only by one (AC-18).
      if (receipt?.providerStatus && (await this.record.flagCollectionReversal(row.id, receipt.providerStatus))) {
        this.log.warn(`Payment ${row.reference} was ${receipt.providerStatus} by the bank after it succeeded.`);
        reportAlarm('PAYMENT_REVERSED', 'The bank reversed a payment it had reported successful.', {
          transactionId: row.id,
        });
      }
      return receipt;
    }

    if (!receipt) {
      if (row.providerReference) {
        await this.record.applyPulled(row.id, 'failed', 'the provider has no record of this transaction');
      }
      // Asked by our own reference and not found: an answer about a request
      // that may never have arrived, never proof it failed. It stays for a
      // person (AC-7).
      return receipt;
    }
    await this.record.applyPulled(row.id, receipt.settlement === 'settled' ? 'successful' : 'pending');
    return receipt;
  }

  private async collect(
    command: CaptureEscrowCommand | OneTimeFeeCommand | RecurringChargeCommand,
    call: () => Promise<PaymentReceipt>,
  ): Promise<PaymentReceipt> {
    const key = command.idempotencyKey;

    // A purpose that is not live is refused before anything is written or sent,
    // exactly as the off seam refuses (AC-2).
    if (this.seam.isOffFor(command.purpose)) {
      throw new PaymentUnavailableError(
        this.seam.mode === 'off'
          ? 'payments are switched off on this stack (PAYMENT_ADAPTER_MODE=off)'
          : `payments are not live for ${command.purpose} (PAYMENT_LIVE_PURPOSES)`,
        key,
        'no',
      );
    }

    const instrument = command.instrument;
    const { row, created } = await this.record.recordCollection({
      idempotencyKey: key,
      reference: referenceFor(key),
      workspaceId: command.workspaceId,
      provider: this.seam.provider,
      adapterMode: this.inner.mode,
      operation: command.kind,
      amountRwf: command.amountRwf,
      feeRwf: this.seam.collectionFeeFor(command.amountRwf),
      payerMsisdn: instrument.kind === 'mobile_money' ? instrument.msisdn : null,
      payerNetwork: instrument.kind === 'mobile_money' ? instrument.network : null,
    });

    if (!created) {
      const replay = await this.replay(row, command);
      if (replay) return replay;
    }

    let receipt: PaymentReceipt;
    try {
      receipt = await call();
    } catch (error) {
      if (error instanceof PaymentDeclinedError) {
        await this.record.markUnanswered(key, 'failed', error.reason);
      } else if (error instanceof PaymentUnavailableError && error.delivered === 'no') {
        await this.record.markUnanswered(key, 'not_sent', error.detail);
      } else {
        // It may have arrived. Parked: a pull or a person settles it, and no
        // machine sends it again (AC-7).
        const detail = error instanceof Error ? error.message : String(error);
        await this.record.markUnanswered(key, 'unknown', detail);
        this.log.warn(`Payment ${row.reference} may have reached the provider; parked as unknown.`);
      }
      throw error;
    }

    await this.record.markAnswered(key, {
      settled: receipt.settlement === 'settled',
      providerReference: receipt.adapterRef,
      adapterMode: receipt.mode,
    });
    return receipt;
  }

  /**
   * The same press, arriving again. Answered from the row where it can be;
   * refused where sending again could charge twice; sent again only when
   * nothing reached the provider the first time. Returns null to send.
   */
  private async replay(
    row: TransactionRow,
    command: CaptureEscrowCommand | OneTimeFeeCommand | RecurringChargeCommand,
  ): Promise<PaymentReceipt | null> {
    if (row.amountRwf !== command.amountRwf) {
      throw new PaymentDeclinedError(
        'this payment was already requested for a different amount',
        command.idempotencyKey,
      );
    }
    switch (row.status) {
      case 'pending':
      case 'successful':
        if (!row.providerReference) break;
        return {
          adapterRef: row.providerReference,
          mode: row.adapterMode,
          replayed: true,
          amountRwf: row.amountRwf,
          currency: 'RWF',
          occurredAt: row.createdAt,
          settlement: row.status === 'successful' ? 'settled' : 'pending',
        };
      case 'not_sent':
        if (await this.record.resend(command.idempotencyKey)) return null;
        break;
      case 'failed':
      case 'rejected':
        throw new PaymentDeclinedError(
          row.failureReason ?? 'the provider refused this payment',
          command.idempotencyKey,
        );
      default:
        break;
    }
    // `sending`, `unknown`, `expired`, or a race on `not_sent`: an earlier
    // request may still be out, so this one is not sent (AC-7).
    throw new PaymentUnavailableError(
      'an earlier request for this payment may have reached the provider; its outcome is being confirmed',
      command.idempotencyKey,
      'maybe',
    );
  }
}
