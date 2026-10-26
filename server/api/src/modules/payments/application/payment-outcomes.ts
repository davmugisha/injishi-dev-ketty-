import { Injectable, Logger } from '@nestjs/common';

/**
 * What became of a disbursement (073-gtbank-payments AC-12, AC-13, AC-18).
 *
 * `needs_details`: written, waiting for the payer's name and ID. `over_limit`:
 * set aside above the disbursement limit for a person. The rest are the bank's
 * verdicts, applied once by the bank record.
 */
export interface DisbursementOutcome {
  transactionId: string;
  idempotencyKey: string;
  reference: string;
  operation: string;
  status: 'needs_details' | 'over_limit' | 'successful' | 'failed' | 'reversed' | 'written_off';
  workspaceId: string | null;
  bookingId: string | null;
  /** The collection it pays back, for a refund or a guest release. */
  originalTransactionId: string | null;
  amountRwf: number;
  failureReason: string | null;
  /** Who paid the collection, so a registrant with no booking can be told too. */
  payerUserId: string | null;
}

/**
 * What two people decided about a collection (073-gtbank-payments AC-20,
 * AC-21): it was received after all, or what it paid for is cancelled because
 * the bank reversed it.
 */
export interface CollectionOutcome {
  transactionId: string;
  idempotencyKey: string;
  reference: string;
  operation: string;
  status: 'confirmed_received' | 'cancel_service';
  workspaceId: string | null;
  amountRwf: number;
}

type Handler = (outcome: DisbursementOutcome) => Promise<void>;
type CollectionHandler = (outcome: CollectionOutcome) => Promise<void>;

/**
 * Where the payments module tells the rest of the system what happened to a
 * disbursement, without importing any of it (the shape of ADR-073's
 * `CallbackFamilyHandler`). The booking module subscribes on start, in both
 * processes, so whichever process applied a verdict also applies its
 * consequences: the booking reads refunded, the guest is mailed.
 *
 * A handler that throws is logged and never undoes the verdict: the bank
 * record is the truth, and its consequences can be read back from it.
 */
@Injectable()
export class PaymentOutcomes {
  private readonly log = new Logger(PaymentOutcomes.name);
  private readonly handlers: Handler[] = [];
  private readonly collectionHandlers: CollectionHandler[] = [];

  onDisbursement(handler: Handler): void {
    this.handlers.push(handler);
  }

  onCollection(handler: CollectionHandler): void {
    this.collectionHandlers.push(handler);
  }

  async collection(outcome: CollectionOutcome): Promise<void> {
    for (const handler of this.collectionHandlers) {
      try {
        await handler(outcome);
      } catch (error) {
        this.log.error(
          `A collection outcome handler failed for ${outcome.reference} (${outcome.status}).`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  async disbursement(outcome: DisbursementOutcome): Promise<void> {
    for (const handler of this.handlers) {
      try {
        await handler(outcome);
      } catch (error) {
        this.log.error(
          `A disbursement outcome handler failed for ${outcome.reference} (${outcome.status}).`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }
}
