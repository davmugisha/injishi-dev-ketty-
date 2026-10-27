import { Injectable, Logger } from '@nestjs/common';

import { PaymentSeam } from '../domain/payment-seam';
import { referenceFor } from '../domain/reference';
import { PayeeIdentityRepository } from '../infrastructure/payee-identity.repository';
import {
  PaymentTransactionsRepository,
  type RefundOwedInput,
  type RefundOwedWrite,
  type TransactionRow,
  type Tx,
} from '../infrastructure/payment-transactions.repository';
import { PaymentOutcomes } from './payment-outcomes';

/**
 * Everything a refund owed needs that can be read before the transaction that
 * writes it: the collection it pays back, and who paid it.
 */
export interface PreparedRefund {
  collection: TransactionRow;
  payerUserId: string | null;
  bookingId: string | null;
  identity: { fullName: string; idType: 'national_id' | 'passport'; idNumber: string; phone: string | null } | null;
  /** The collection was taken by another provider or mode than the one bound now (AC-11). */
  mismatch: boolean;
}

export interface OweRequest {
  idempotencyKey: string;
  workspaceId: string;
  operation: 'refund' | 'escrow_release_guest';
  amountRwf: number;
  /** `exact` refuses more than remains (AC-11); `cap` shrinks to it (AC-13). */
  fit: 'exact' | 'cap';
  /** The booking it refunds, when the caller knows better than the attempt does. */
  bookingId?: string | null;
}

/**
 * A refund OWED (073-gtbank-payments AC-11 to AC-13): written `queued` back to
 * the collection it names and sent later by the disbursement dispatcher, the
 * one path that checks the account can cover it.
 *
 * Three steps, so a booking change and the refund it owes can commit in ONE
 * transaction (AC-13) while the reads that are not part of it stay outside:
 *
 * 1. `prepare` finds the collection by the provider reference the caller holds
 *    and reads the payer's verified identity (which logs the ID read). Null
 *    means the collection predates the bank record, and the caller refunds it
 *    the old way, straight through the provider.
 * 2. `writeTx` locks the collection, checks the room, and writes the row in the
 *    caller's transaction.
 * 3. `announce`, after commit, tells the payer when their name and ID are
 *    needed (AC-12).
 *
 * The wallet is always the collection's own paying number, never an input.
 */
@Injectable()
export class RefundsOwedService {
  private readonly log = new Logger(RefundsOwedService.name);

  constructor(
    private readonly record: PaymentTransactionsRepository,
    private readonly payees: PayeeIdentityRepository,
    private readonly seam: PaymentSeam,
    private readonly outcomes: PaymentOutcomes,
  ) {}

  async prepare(originalRef: string, purposeOfRead: string): Promise<PreparedRefund | null> {
    const collection =
      (await this.record.findCollection(this.seam.provider, originalRef)) ??
      (await this.record.findCollectionAnywhere(originalRef));
    return collection ? this.prepareFor(collection, purposeOfRead) : null;
  }

  /**
   * The same, for a collection known by its row: one confirmed received by two
   * people may never have been given a provider reference at all (AC-21).
   */
  async prepareCollection(transactionId: string, purposeOfRead: string): Promise<PreparedRefund | null> {
    const collection = await this.record.findById(transactionId);
    return collection && collection.direction === 'collection' ? this.prepareFor(collection, purposeOfRead) : null;
  }

  private async prepareFor(collection: TransactionRow, purposeOfRead: string): Promise<PreparedRefund> {
    if (!collection.payerMsisdn) {
      // A number is blanked only once no refund can need it (AC-10). Loud
      // rather than invented: a refund to a guessed wallet is worse than one a
      // person has to pay.
      throw new Error(
        `A refund names collection ${collection.reference}, whose paying number is no longer held; a person must refund it.`,
      );
    }
    const mismatch =
      collection.provider !== this.seam.provider || collection.adapterMode !== this.seam.adapterMode;
    const { userId, bookingId } = await this.payees.payerOf(collection);
    const identity = !mismatch && userId ? await this.payees.verifiedPayee(userId, purposeOfRead) : null;
    return { collection, payerUserId: userId, bookingId, identity, mismatch };
  }

  writeTx(tx: Tx, prepared: PreparedRefund, request: OweRequest): Promise<RefundOwedWrite> {
    return this.record.insertRefundOwedTx(tx, this.inputFor(prepared, request));
  }

  /** After commit: ask the payer for their name and ID when the refund waits on them. */
  async announce(prepared: PreparedRefund, written: RefundOwedWrite): Promise<void> {
    const row = written.row;
    if (!row || !written.created) return;
    if (prepared.mismatch) {
      this.log.warn(`Refund ${row.reference} names a payment from another provider or mode; left for a person.`);
      return;
    }
    if (row.status === 'queued' && !prepared.identity) {
      await this.outcomes.disbursement({
        transactionId: row.id,
        idempotencyKey: row.idempotencyKey,
        reference: row.reference,
        operation: row.operation,
        status: 'needs_details',
        workspaceId: row.workspaceId,
        bookingId: row.bookingId,
        originalTransactionId: prepared.collection.id,
        amountRwf: row.amountRwf,
        failureReason: null,
        payerUserId: prepared.payerUserId,
      });
    }
  }

  /** All three steps in a transaction of their own, for a refund with no booking change beside it. */
  async owe(prepared: PreparedRefund, request: OweRequest): Promise<RefundOwedWrite> {
    const written = await this.record.recordRefundOwed(this.inputFor(prepared, request));
    await this.announce(prepared, written);
    return written;
  }

  private inputFor(prepared: PreparedRefund, request: OweRequest): RefundOwedInput {
    const { collection, identity, mismatch } = prepared;
    return {
      collectionId: collection.id,
      idempotencyKey: request.idempotencyKey,
      reference: referenceFor(request.idempotencyKey),
      workspaceId: request.workspaceId,
      provider: this.seam.provider,
      adapterMode: this.seam.adapterMode,
      operation: request.operation,
      amountRwf: request.amountRwf,
      fit: request.fit,
      feeRwf: this.seam.settings.disbursementFeeRwf,
      bookingId: request.bookingId ?? prepared.bookingId,
      // Refused before it is ever sent, and left for a person (AC-11).
      status: mismatch ? 'failed' : 'queued',
      queueReason: mismatch ? null : identity ? 'awaiting_dispatch' : 'payee_details_missing',
      failureReason: mismatch
        ? 'the payment was taken by another provider or mode; a person must settle this refund'
        : null,
      payee: {
        payeeFullName: identity?.fullName ?? null,
        payeeIdType: identity?.idType ?? null,
        payeeIdNumber: identity?.idNumber ?? null,
        payeeDestination: 'momo',
        payeeNetworkOrBank: collection.payerNetwork,
        payeeAccount: collection.payerMsisdn ?? '',
        payeePhone: identity?.phone ?? `+250${collection.payerMsisdn}`,
      },
    };
  }
}
