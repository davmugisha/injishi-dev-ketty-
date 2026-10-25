import { Inject, Injectable, Logger } from '@nestjs/common';
import { kigaliDateOf } from '@injishi/contracts';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { PAYMENT_PORT, type CallbackEvent, type PaymentPort } from '../../payments/domain/payment-port';
import { LeasePaymentsRepository, type PaymentRow } from '../infrastructure/lease-payments.repository';
import { LeasesRepository } from '../infrastructure/leases.repository';
import { RentalsMoneyQueue } from '../infrastructure/rentals-money.queue';
import { LeaseEventsWriter, RentalsAuditWriter } from '../infrastructure/rentals-writers';
import { PaymentReceiptsService } from './payment-receipts.service';
import { PayoutsService } from './payouts.service';

/** Why a prompt nobody answered stops being waited for. */
export const EXPIRED_REASON = 'The prompt on your phone expired before it was approved. Nothing was taken.';

/** How many pending payments the sweep asks the provider about at once. */
const SWEEP_CONCURRENCY = 5;

/**
 * Settling gateway payments (blueprint 2.6, PaymentSettlement; WP 1.6b).
 *
 * A pending payment is settled when the provider says the money landed: the
 * charges are paid in ONE transaction with the lease and its charges locked
 * (oldest due first, or the charges the tenant picked; the rest is credit),
 * the receipt number is minted, the payout to the landlord is made, and the
 * timeline and audit are written. Then, outside the transaction, the payout
 * job is queued and the tenant and the landlord are emailed. Settling is
 * guarded on the payment still being pending, so the tenant's poll, the
 * minute sweep, a delayed job and a provider callback that all see the same
 * settle write it once.
 */
@Injectable()
export class PaymentSettlementService {
  private readonly log = new Logger(PaymentSettlementService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly payments: LeasePaymentsRepository,
    private readonly leases: LeasesRepository,
    private readonly payouts: PayoutsService,
    private readonly receipts: PaymentReceiptsService,
    private readonly queue: RentalsMoneyQueue,
    private readonly events: LeaseEventsWriter,
    private readonly audit: RentalsAuditWriter,
    @Inject(PAYMENT_PORT) private readonly port: PaymentPort,
  ) {}

  /** A provider's callback as the port reads it from the signed raw body, or null (the webhook route's check). */
  parseCallback(provider: string, headers: Record<string, string | string[] | undefined>, rawBody: Buffer): CallbackEvent | null {
    return this.port.parseCallback(provider, headers, rawBody);
  }

  /**
   * Where a pending payment stands now: ask the provider, settle if it
   * landed, expire a prompt left too long. Answers the row as it is after.
   */
  async resolve(row: PaymentRow, now: Date = new Date()): Promise<PaymentRow> {
    if (row.status !== 'pending') return row;
    if (row.adapterRef) {
      const receipt = await this.port.fetchTransaction(row.workspaceId, row.adapterRef).catch((cause: unknown) => {
        this.log.warn(`payment ${row.id}: the provider did not answer: ${String(cause)}`);
        return null;
      });
      if (receipt?.settlement === 'settled') {
        await this.settle(row.id, now);
        return (await this.payments.find(row.id)) ?? row;
      }
    }
    if (row.expiresAt && row.expiresAt.getTime() <= now.getTime()) {
      await this.expire(row.id, now);
      return (await this.payments.find(row.id)) ?? row;
    }
    return row;
  }

  /** The delayed look at one payment queued when its prompt went out. */
  async sweepOne(paymentId: string, now: Date = new Date()): Promise<PaymentRow['status'] | null> {
    const row = await this.payments.find(paymentId);
    if (!row) return null;
    return (await this.resolve(row, now)).status;
  }

  /** The minute sweep: every pending payment, a few at a time. */
  async sweep(now: Date = new Date()): Promise<{ settled: number; expired: number; stillPending: number }> {
    const rows = await this.payments.pending();
    let settled = 0;
    let expired = 0;
    let stillPending = 0;
    for (let i = 0; i < rows.length; i += SWEEP_CONCURRENCY) {
      const batch = await Promise.all(rows.slice(i, i + SWEEP_CONCURRENCY).map((row) => this.resolve(row, now).catch((cause: unknown) => (this.log.error(`payment ${row.id}: ${String(cause)}`), row))));
      for (const next of batch) {
        if (next.status === 'succeeded') settled += 1;
        else if (next.status === 'expired') expired += 1;
        else if (next.status === 'pending') stillPending += 1;
      }
    }
    if (settled || expired) this.log.log(`Settlement sweep: settled ${settled}, expired ${expired}, pending ${stillPending}.`);
    return { settled, expired, stillPending };
  }

  /** A provider's callback: the payment it names, settled or failed as it says. Unknown references are ignored. */
  async handleCallback(event: CallbackEvent, now: Date = new Date()): Promise<'settled' | 'failed' | 'ignored'> {
    const row = await this.payments.findByAdapterRef(event.adapterRef);
    if (!row || row.status !== 'pending') return 'ignored';
    if (event.amountRwf !== undefined && event.amountRwf !== row.amountRwf) {
      this.log.error(`callback ${event.provider}/${event.eventId} names ${event.amountRwf} RWF for payment ${row.id} of ${row.amountRwf} RWF; ignored`);
      return 'ignored';
    }
    if (event.outcome === 'settled') {
      await this.settle(row.id, now);
      return 'settled';
    }
    await this.fail(row.id, event.reason ? `The payment did not go through: ${event.reason}. Nothing was taken.` : 'The payment did not go through. Nothing was taken.', now);
    return 'failed';
  }

  /**
   * The money landed. Everything in one transaction; answers whether this
   * call did the settling (false when it was already done).
   */
  async settle(paymentId: string, now: Date = new Date()): Promise<boolean> {
    const settled = await this.db.transaction(async (tx) => {
      const payment = await this.payments.lock(tx, paymentId);
      if (!payment || payment.status !== 'pending') return null;
      const lease = await this.leases.lock(tx, payment.leaseId);
      if (!lease) throw new Error(`lease ${payment.leaseId} vanished`);
      const outcome = await this.payments.allocate(tx, {
        paymentId: payment.id,
        leaseId: payment.leaseId,
        amountRwf: payment.amountRwf,
        chargeIds: payment.requestedChargeIds,
        paidAt: now,
      });
      const receiptNumber = await this.payments.nextReceiptNumber(tx, payment.workspaceId, Number(kigaliDateOf(now).slice(0, 4)));
      await this.payments.update(tx, payment.id, { status: 'succeeded', succeededAt: now, receiptNumber, failureReason: null });
      const payout = await this.payouts.createForPayment(tx, { ...payment, status: 'succeeded', succeededAt: now, receiptNumber }, lease.orgId);
      await this.payments.update(tx, payment.id, { payoutId: payout.id });
      await this.events.write(tx, {
        leaseId: payment.leaseId,
        workspaceId: payment.workspaceId,
        kind: 'payment_received',
        actorUserId: payment.payerUserId,
        actorRole: 'tenant',
        visibleToTenant: true,
        payload: {
          paymentId: payment.id,
          channel: 'gateway',
          method: payment.method,
          amountRwf: payment.amountRwf,
          receiptNumber,
          allocations: outcome.allocations,
          creditRwf: outcome.creditRwf,
          paidChargeIds: outcome.paidChargeIds,
          payoutId: payout.id,
          payoutStatus: payout.status,
        },
      });
      if (outcome.depositPaid) {
        await this.events.write(tx, {
          leaseId: payment.leaseId,
          workspaceId: payment.workspaceId,
          kind: 'deposit_received',
          actorUserId: null,
          actorRole: 'system',
          visibleToTenant: true,
          payload: { paymentId: payment.id },
        });
      }
      await this.audit.write(tx, {
        actorUserId: payment.payerUserId,
        subjectType: 'payment',
        subjectId: payment.id,
        eventType: 'payment.received',
        diff: { leaseId: payment.leaseId, amountRwf: payment.amountRwf, method: payment.method, receiptNumber, allocations: outcome.allocations, creditRwf: outcome.creditRwf, payoutId: payout.id, payoutStatus: payout.status },
      });
      return payout;
    });
    if (!settled) return false;
    if (settled.status === 'queued') await this.queue.sendPayout(settled.id);
    void this.receipts.mailTenantReceipt(paymentId);
    void this.receipts.mailLandlordReceived(paymentId, this.payouts.payoutWords(settled));
    return true;
  }

  /** The provider said no, or the prompt expired: the payment is closed with the reason. */
  async fail(paymentId: string, reason: string, now: Date = new Date()): Promise<boolean> {
    return this.close(paymentId, 'failed', reason, now);
  }

  async expire(paymentId: string, now: Date = new Date()): Promise<boolean> {
    return this.close(paymentId, 'expired', EXPIRED_REASON, now);
  }

  private async close(paymentId: string, status: 'failed' | 'expired', reason: string, now: Date): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const payment = await this.payments.lock(tx, paymentId);
      if (!payment || payment.status !== 'pending') return false;
      await this.payments.update(tx, paymentId, { status, failureReason: reason });
      await this.events.write(tx, {
        leaseId: payment.leaseId,
        workspaceId: payment.workspaceId,
        kind: 'payment_failed',
        actorUserId: null,
        actorRole: 'system',
        visibleToTenant: true,
        payload: { paymentId, status, method: payment.method, amountRwf: payment.amountRwf, reason, at: now.toISOString() },
      });
      return true;
    });
  }
}
