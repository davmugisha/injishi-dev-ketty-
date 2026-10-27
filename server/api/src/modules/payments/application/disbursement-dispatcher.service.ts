import { Inject, Injectable, Logger } from '@nestjs/common';
import type { MobileMoneyNetwork } from '@injishi/contracts';

import { reportAlarm } from '../../../shared/observability/error-reporter';
import {
  type Beneficiary,
  GUARDED_PAYMENT_PORT,
  PaymentDeclinedError,
  type PaymentPort,
  type PaymentReceipt,
  PaymentUnavailableError,
} from '../domain/payment-port';
import { PaymentSeam } from '../domain/payment-seam';
import { MoneyQueueRepository } from '../infrastructure/money-queue.repository';
import { PayeeIdentityRepository } from '../infrastructure/payee-identity.repository';
import {
  type DispatchRow,
  PaymentTransactionsRepository,
  type TransactionRow,
} from '../infrastructure/payment-transactions.repository';
import { type DisbursementOutcome, PaymentOutcomes } from './payment-outcomes';

const MINUTE = 60_000;
/** A pending disbursement is pulled every minute for this long after it was sent, then every 15 (AC-9a). */
const PENDING_FAST_FOR_MS = 10 * MINUTE;
/** An unknown one is pulled every 15 minutes for a day, then left to the money queue (AC-9a). */
const UNKNOWN_PULLED_FOR_MS = 24 * 60 * MINUTE;
const SLOW_PULL_MS = 15 * MINUTE;
/** `TREASURY_SHORT` at most once an hour (AC-14a). */
const SHORT_ALARM_EVERY_MS = 60 * MINUTE;
/** `PAYMENT_PARKED` at most once an hour (AC-27). */
const PARKED_ALARM_EVERY_MS = 60 * MINUTE;

export interface DispatchTick {
  pulled: number;
  sent: number;
  short: boolean;
  overLimit: number;
}

/**
 * Sends every disbursement, and is the only thing that does
 * (073-gtbank-payments AC-9, AC-9a, AC-14, AC-14a).
 *
 * Runs every minute on the `PaymentCompensation` queue, in the worker only.
 * Each tick first asks the provider about rows already out (a `sending` row a
 * crash left behind, a `pending` or `unknown` one whose pull is due), so a
 * verdict that frees balance is counted before anything new is chosen; then
 * claims what the balance covers, in the fixed order, under the funding lock;
 * then sends each claimed row outside that lock.
 *
 * Every verdict is applied by a conditional update, and the booking module
 * hears of it through `PaymentOutcomes` only when the update changed a row.
 */
@Injectable()
export class DisbursementDispatcher {
  private readonly log = new Logger(DisbursementDispatcher.name);
  private lastShortAlarmAt = 0;
  private lastParkedAlarmAt = 0;

  constructor(
    @Inject(GUARDED_PAYMENT_PORT) private readonly port: PaymentPort,
    private readonly record: PaymentTransactionsRepository,
    private readonly seam: PaymentSeam,
    private readonly outcomes: PaymentOutcomes,
    private readonly payees: PayeeIdentityRepository,
    private readonly queue: MoneyQueueRepository,
  ) {}

  async tick(now: Date = new Date()): Promise<DispatchTick> {
    // Off refuses every call; a row waits, untouched, until money is switched on.
    if (this.seam.mode === 'off') return { pulled: 0, sent: 0, short: false, overLimit: 0 };

    const pulls = await this.record.dueDisbursementPulls(this.seam.provider, this.seam.adapterMode, now);
    for (const due of pulls) await this.pull(due, now);

    const claim = await this.record.claimForDispatch({
      provider: this.seam.provider,
      adapterMode: this.seam.adapterMode,
      lagMinutes: this.seam.settings.settlementLagMinutes,
      maxDisbursementRwf: this.seam.settings.maxDisbursementRwf,
      now,
    });
    if (claim.short) this.alarmShort(claim.short, now);
    for (const row of claim.overLimit) {
      this.log.warn(`Disbursement ${row.reference} is above the disbursement limit; left for a person.`);
      await this.tell(row, 'over_limit', 'above the disbursement limit');
    }
    let short = claim.short !== null;
    let sent = 0;
    for (const due of claim.sending) {
      if (short) {
        // The bank said the account is short for an older row: everything
        // claimed after it goes back unsent, so nothing younger overtakes it.
        await this.record.applyDisbursementVerdict(due.row.id, {
          kind: 'requeue',
          queueReason: 'insufficient_funds',
          nextAttemptAt: null,
          reason: 'waiting behind an older payment the account cannot cover yet',
        });
        continue;
      }
      sent += 1;
      if ((await this.send(due)) === 'short') short = true;
    }

    await this.countParked(now);
    return { pulled: pulls.length, sent, short, overLimit: claim.overLimit.length };
  }

  /** Send one claimed row, and apply what the provider answered. */
  private async send(due: DispatchRow): Promise<'short' | void> {
    const { row } = due;
    let receipt: PaymentReceipt;
    try {
      receipt = await this.instruct(due);
    } catch (error) {
      return this.refused(row, error);
    }
    if (receipt.settlement === 'settled') {
      if (await this.record.applyDisbursementVerdict(row.id, { kind: 'successful', providerReference: receipt.adapterRef })) {
        await this.tell(row, 'successful', null);
      }
      return;
    }
    await this.record.applyDisbursementVerdict(row.id, {
      kind: 'pending',
      providerReference: receipt.adapterRef,
      nextAttemptAt: new Date(Date.now() + MINUTE),
    });
  }

  private instruct(due: DispatchRow): Promise<PaymentReceipt> {
    const { row } = due;
    if (!row.workspaceId) throw new Error(`Disbursement ${row.reference} has no workspace.`);
    const base = {
      idempotencyKey: row.idempotencyKey,
      amountRwf: row.amountRwf,
      currency: 'RWF' as const,
      workspaceId: row.workspaceId,
      memo: `Disbursement ${row.reference}`,
    };
    const payee = beneficiaryOf(due);
    switch (row.operation) {
      case 'refund':
        return this.port.refund({ ...base, kind: 'refund', originalRef: due.originalRef ?? row.reference, payee });
      case 'escrow_release_guest':
        return this.port.releaseEscrow({
          ...base,
          kind: 'escrow_release',
          beneficiary: 'guest',
          originalRef: due.originalRef ?? row.reference,
          payee,
        });
      case 'escrow_release_host':
        return this.port.releaseEscrow({
          ...base,
          kind: 'escrow_release',
          beneficiary: 'host',
          originalRef: due.originalRef ?? row.reference,
          payee,
        });
      case 'payout':
        return this.port.payout({ ...base, kind: 'payout', payee });
      default:
        throw new Error(`Disbursement ${row.reference} has an operation the dispatcher cannot send.`);
    }
  }

  /**
   * The send threw. A refusal is final (AC-5), except a short account, which
   * waits for funds, and a name mismatch, which is final but remembered so a
   * resend asks the payer again (AC-21). Nothing reached the provider: try
   * again next minute. It may have arrived: parked, pulled, never resent (AC-7).
   */
  private async refused(row: TransactionRow, error: unknown): Promise<'short' | void> {
    if (error instanceof PaymentDeclinedError) {
      if (error.code === 'insufficient_funds') {
        await this.record.applyDisbursementVerdict(row.id, {
          kind: 'requeue',
          queueReason: 'insufficient_funds',
          nextAttemptAt: null,
          reason: error.reason,
        });
        this.alarmShort(row, new Date());
        return 'short';
      }
      if (
        await this.record.applyDisbursementVerdict(row.id, {
          kind: 'failed',
          reason: error.reason,
          providerStatus: error.code,
        })
      ) {
        this.log.warn(`Disbursement ${row.reference} was refused by the provider.`);
        await this.tell(row, 'failed', error.reason);
      }
      return;
    }
    if (error instanceof PaymentUnavailableError && error.delivered === 'no') {
      await this.record.applyDisbursementVerdict(row.id, {
        kind: 'requeue',
        queueReason: 'provider_unavailable',
        nextAttemptAt: new Date(Date.now() + MINUTE),
        reason: error.detail,
      });
      return;
    }
    const detail = error instanceof Error ? error.message : String(error);
    await this.record.applyDisbursementVerdict(row.id, {
      kind: 'unknown',
      reason: detail,
      nextAttemptAt: new Date(Date.now() + SLOW_PULL_MS),
    });
    // Parked. The parked counter raises the alarm if it is still here in 30
    // minutes (AC-27); a single row is not yet an incident.
    this.log.warn(`Disbursement ${row.reference} may have reached the provider; parked as unknown.`);
  }

  /**
   * One row, on a person's request (AC-20): an open disbursement is pulled as
   * the tick would pull it; a successful one is asked whether the money came
   * back (AC-18), which only a pull may apply.
   */
  async pullOne(id: string, now: Date = new Date()): Promise<void> {
    const due = await this.record.dispatchRowById(id);
    if (!due) return;
    if (due.row.status !== 'successful') {
      await this.pull(due, now);
      return;
    }
    if (!due.row.workspaceId) return;
    const receipt = await this.port.fetchTransaction(due.row.workspaceId, due.row.providerReference ?? due.row.reference);
    if (receipt?.providerStatus && (await this.record.applyDisbursementVerdict(due.row.id, { kind: 'reversed', providerStatus: receipt.providerStatus }))) {
      this.log.warn(`Disbursement ${due.row.reference} came back from the bank after it was paid.`);
      reportAlarm('PAYMENT_REVERSED', 'A disbursement the bank had paid came back.', { transactionId: due.row.id });
      await this.tell(due.row, 'reversed', `the bank reported it ${receipt.providerStatus}`);
    }
  }

  /**
   * The parked counter (AC-27): rows a machine is stuck on, `unknown` or
   * unreachable for over 30 minutes, raise `PAYMENT_PARKED` at most hourly. A
   * payer who has not typed their ID is not stuck, and a short account has its
   * own alarm.
   */
  private async countParked(now: Date): Promise<void> {
    const { parkedCount } = await this.queue.balanceFacts(this.seam.provider, this.seam.adapterMode, now);
    if (parkedCount === 0 || now.getTime() - this.lastParkedAlarmAt < PARKED_ALARM_EVERY_MS) return;
    this.lastParkedAlarmAt = now.getTime();
    this.log.warn(`${parkedCount} payment(s) parked for more than 30 minutes; the money queue lists them.`);
    reportAlarm('PAYMENT_PARKED', 'Payments a machine cannot settle have waited over 30 minutes.', { parkedCount });
  }

  /** Ask the provider about one row already out, and apply the answer once. */
  private async pull(due: DispatchRow, now: Date): Promise<void> {
    const { row } = due;
    if (!row.workspaceId) return;
    let receipt: PaymentReceipt | null;
    try {
      receipt = await this.port.fetchTransaction(row.workspaceId, row.providerReference ?? row.reference);
    } catch (error) {
      if (!(error instanceof PaymentUnavailableError)) throw error;
      // Could not ask. Never an answer; ask again later.
      await this.reschedule(row, now);
      return;
    }

    if (!receipt) {
      if (row.status === 'sending') {
        // The request never arrived (AC-5): sent again, under the same key.
        await this.record.applyDisbursementVerdict(row.id, {
          kind: 'requeue',
          queueReason: 'provider_unavailable',
          nextAttemptAt: null,
          reason: 'the provider has no record of this payment; it never arrived',
          pulled: true,
        });
      } else if (row.providerReference) {
        if (
          await this.record.applyDisbursementVerdict(row.id, {
            kind: 'failed',
            reason: 'the provider has no record of this payment',
            pulled: true,
          })
        ) {
          await this.tell(row, 'failed', 'the provider has no record of this payment');
        }
      } else {
        await this.reschedule(row, now);
      }
      return;
    }

    if (receipt.settlement === 'settled') {
      if (
        await this.record.applyDisbursementVerdict(row.id, {
          kind: 'successful',
          providerReference: receipt.adapterRef,
          pulled: true,
        })
      ) {
        await this.tell(row, 'successful', null);
      }
      return;
    }
    if (row.status === 'pending') {
      await this.reschedule(row, now);
      return;
    }
    await this.record.applyDisbursementVerdict(row.id, {
      kind: 'pending',
      providerReference: receipt.adapterRef,
      nextAttemptAt: new Date(now.getTime() + MINUTE),
      pulled: true,
    });
  }

  /** When to ask again (AC-9a). An unknown row a day old is left to a person. */
  private async reschedule(row: TransactionRow, now: Date): Promise<void> {
    const sentAt = (row.sentAt ?? row.createdAt).getTime();
    const age = now.getTime() - sentAt;
    if (row.status === 'pending') {
      await this.record.applyDisbursementVerdict(row.id, {
        kind: 'pending',
        nextAttemptAt: new Date(now.getTime() + (age < PENDING_FAST_FOR_MS ? MINUTE : SLOW_PULL_MS)),
        pulled: true,
      });
      return;
    }
    if (row.status === 'unknown') {
      await this.record.applyDisbursementVerdict(row.id, {
        kind: 'unknown',
        reason: row.failureReason,
        nextAttemptAt: age < UNKNOWN_PULLED_FOR_MS ? new Date(now.getTime() + SLOW_PULL_MS) : null,
        from: ['unknown'],
        pulled: true,
      });
    }
  }

  private async tell(row: TransactionRow, status: DisbursementOutcome['status'], failureReason: string | null): Promise<void> {
    let payerUserId: string | null = null;
    if (row.originalTransactionId) {
      const collection = await this.record.findById(row.originalTransactionId);
      if (collection) payerUserId = (await this.payees.payerOf(collection)).userId;
    }
    await this.outcomes.disbursement({
      transactionId: row.id,
      idempotencyKey: row.idempotencyKey,
      reference: row.reference,
      operation: row.operation,
      status,
      workspaceId: row.workspaceId,
      bookingId: row.bookingId,
      originalTransactionId: row.originalTransactionId,
      amountRwf: row.amountRwf,
      failureReason,
      payerUserId,
    });
  }

  private alarmShort(row: TransactionRow, now: Date): void {
    if (now.getTime() - this.lastShortAlarmAt < SHORT_ALARM_EVERY_MS) return;
    this.lastShortAlarmAt = now.getTime();
    this.log.warn(`Disbursement ${row.reference} waits: the account cannot cover it yet.`);
    reportAlarm('TREASURY_SHORT', 'A disbursement waits because the account cannot cover it.', {
      transactionId: row.id,
    });
  }
}

/** The payee as the port carries it, from the columns the row was written with. */
function beneficiaryOf(due: DispatchRow): Beneficiary {
  const { payee, row } = due;
  if (!payee.payeeFullName || !payee.payeeIdType || !payee.payeeIdNumber || !payee.payeePhone) {
    // The claim never selects a row waiting on its payee; a row here without
    // one is a broken invariant, and sending it would be refused by the bank.
    throw new Error(`Disbursement ${row.reference} was claimed without its payee's details.`);
  }
  return {
    fullName: payee.payeeFullName,
    idType: payee.payeeIdType,
    idNumber: payee.payeeIdNumber,
    phone: payee.payeePhone,
    destination:
      payee.payeeDestination === 'bank'
        ? { kind: 'bank', bankCode: payee.payeeNetworkOrBank ?? '', accountNumber: payee.payeeAccount }
        : { kind: 'mobile_money', network: payee.payeeNetworkOrBank as MobileMoneyNetwork, msisdn: payee.payeeAccount },
  };
}
