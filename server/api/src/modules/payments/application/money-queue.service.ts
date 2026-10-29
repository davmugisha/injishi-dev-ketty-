import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  MoneyBalance,
  MoneyOverrideList,
  MoneyOverrideRequest,
  MoneyOverrideView,
  MoneyPullResult,
  MoneyQueue,
  MoneyQueueBucket,
  MoneyResolveRequest,
  StaffAccess,
  TreasuryAdjustmentRequest,
} from '@injishi/contracts';

import { maskDestination, PAYMENT_PORT, type PaymentPort } from '../domain/payment-port';
import { PaymentSeam } from '../domain/payment-seam';
import { referenceFor } from '../domain/reference';
import { MoneyQueueRepository, type OverrideRecord } from '../infrastructure/money-queue.repository';
import { PayeeIdentityRepository } from '../infrastructure/payee-identity.repository';
import {
  PaymentTransactionsRepository,
  type TransactionRow,
} from '../infrastructure/payment-transactions.repository';
import { DisbursementDispatcher } from './disbursement-dispatcher.service';
import { PaymentOutcomes } from './payment-outcomes';

const BUCKETS: MoneyQueueBucket[] = ['parked', 'reversals', 'owed', 'short', 'over_limit', 'waiting_on_payer'];
const FINAL: ReadonlySet<string> = new Set(['failed', 'rejected', 'reversed', 'refunded', 'not_sent']);
const OWED: ReadonlySet<string> = new Set(['failed', 'rejected', 'reversed']);

type ApprovalEffect =
  | { kind: 'resend'; transactionId: string; askPayer: boolean }
  | { kind: 'confirmed'; transactionId: string }
  | { kind: 'cancel_service'; transactionId: string }
  | { kind: 'written_off'; transactionId: string }
  | { kind: 'adjustment'; transactionId: string };

/**
 * The money queue (073-gtbank-payments AC-15, AC-18 to AC-21).
 *
 * One person may LOOK (the list, the balance, a pull) and may close what
 * moves no money (a parked row resolved as failed, a reversal that stands).
 * Anything that moves money, or marks money received, is an override: one
 * holder of `admin.payout.release` requests it, and a DIFFERENT super admin
 * approves it. The approval does its work in the same transaction as the
 * state change and the audit row; its consequences for a booking or a
 * registration are announced after commit through `PaymentOutcomes`.
 */
@Injectable()
export class MoneyQueueService {
  private readonly log = new Logger(MoneyQueueService.name);

  constructor(
    private readonly queue: MoneyQueueRepository,
    private readonly record: PaymentTransactionsRepository,
    private readonly seam: PaymentSeam,
    @Inject(PAYMENT_PORT) private readonly port: PaymentPort,
    private readonly dispatcher: DisbursementDispatcher,
    private readonly outcomes: PaymentOutcomes,
    private readonly payees: PayeeIdentityRepository,
  ) {}

  async list(now: Date = new Date()): Promise<MoneyQueue> {
    const rows = await this.queue.queue(now);
    const counts = Object.fromEntries(BUCKETS.map((b) => [b, 0])) as Record<MoneyQueueBucket, number>;
    for (const row of rows) counts[row.bucket] += 1;
    return {
      counts,
      rows: rows.map((r) => ({
        id: r.id,
        bucket: r.bucket,
        reference: r.reference,
        providerReference: r.providerReference,
        provider: r.provider,
        mode: r.adapterMode,
        direction: r.direction,
        operation: r.operation,
        amountRwf: r.amountRwf,
        status: r.status,
        reason: r.reason,
        party: r.party ? maskDestination(r.party.length === 9 ? `0${r.party}` : r.party) : null,
        bookingReference: r.bookingReference,
        createdAt: r.createdAt.toISOString(),
        ageSeconds: Math.max(0, Math.floor((now.getTime() - r.createdAt.getTime()) / 1000)),
        pendingOverride: r.pendingOverrideId ? { id: r.pendingOverrideId, action: r.pendingOverrideAction ?? '' } : null,
      })),
    };
  }

  async balance(now: Date = new Date()): Promise<MoneyBalance> {
    const { provider, adapterMode } = this.seam;
    const [availableRwf, facts] = await Promise.all([
      this.record.availableBalance(provider, adapterMode, this.seam.settings.settlementLagMinutes, now),
      this.queue.balanceFacts(provider, adapterMode, now),
    ]);
    return {
      provider,
      mode: adapterMode,
      availableRwf,
      inFlightRwf: facts.inFlightRwf,
      queuedRwf: facts.queuedRwf,
      parkedCount: facts.parkedCount,
      lastReconciliation: facts.lastRun
        ? { status: facts.lastRun.status, ranAt: facts.lastRun.ranAt.toISOString() }
        : null,
    };
  }

  /**
   * Ask the bank about one row and apply what it says, once (AC-20). Allowed
   * on any row that is not final, and on a successful one, which is how a
   * reversal is found (AC-18). Moves no money.
   */
  async pull(id: string): Promise<MoneyPullResult> {
    const row = await this.mustFind(id);
    if (row.direction === 'adjustment') throw new ConflictException('An adjustment is not a payment the bank can be asked about.');
    if (FINAL.has(row.status)) throw new ConflictException(`This payment is ${row.status}; there is nothing left to ask the bank.`);

    if (row.direction === 'collection') {
      if (!row.workspaceId) throw new ConflictException('This payment names no workspace.');
      await this.port.fetchTransaction(row.workspaceId, row.providerReference ?? row.reference);
    } else {
      await this.dispatcher.pullOne(row.id);
    }
    const after = await this.mustFind(id);
    return {
      id,
      before: row.status,
      after: after.status,
      changed: after.status !== row.status,
      reversalFlagged: after.status === 'reversed' || after.status === 'refunded',
    };
  }

  /**
   * One person closes what moves no money (AC-20): an `unknown` row as
   * failed, or a reversal that stands. `successful` and `cancel_service` are
   * two person acts and are refused here.
   */
  async resolve(id: string, body: MoneyResolveRequest, actorUserId: string): Promise<{ id: string; outcome: string }> {
    const row = await this.mustFind(id);
    const done = await this.queue.resolve({ id, outcome: body.outcome, note: body.note, actorUserId });
    if (!done) {
      throw new ConflictException(
        body.outcome === 'failed'
          ? 'Only a payment whose outcome is unknown can be resolved as failed, and only once.'
          : 'Only an open reversal flag can be resolved as standing.',
      );
    }
    if (body.outcome === 'failed' && row.direction === 'disbursement') {
      // It stays owed and is not sent again by this; the payer hears it is delayed.
      await this.announce(row, 'failed', 'resolved as failed by a person');
    }
    this.log.log(`Payment ${row.reference} resolved ${body.outcome} by a person.`);
    return { id, outcome: body.outcome };
  }

  /** The first signature on a two person act (AC-21). */
  async requestOverride(id: string, body: MoneyOverrideRequest, actorUserId: string): Promise<MoneyOverrideView> {
    const row = await this.mustFind(id);
    const refusal = refusalFor(body.action, row, await this.record.hasLiveResend(row.idempotencyKey));
    if (refusal) throw new ConflictException(refusal);
    const { id: overrideId } = await this.queue.requestOverride({
      subjectId: row.id,
      action: body.action,
      reason: body.reason,
      initiatedByUserId: actorUserId,
      idempotencyKey: null,
      details: null,
    });
    return this.view(overrideId, null);
  }

  /** A treasury adjustment, waiting on its second signer (AC-15). */
  async requestTreasuryAdjustment(
    body: TreasuryAdjustmentRequest,
    idempotencyKey: string,
    actorUserId: string,
  ): Promise<MoneyOverrideView> {
    const { id } = await this.queue.requestOverride({
      subjectId: null,
      action: 'treasury_adjustment',
      reason: body.reason,
      initiatedByUserId: actorUserId,
      idempotencyKey: `treasury:${idempotencyKey}`,
      details: {
        amountRwf: body.amountRwf,
        bankReference: body.bankReference,
        provider: this.seam.provider,
        adapterMode: this.seam.adapterMode,
      },
    });
    return this.view(id, null);
  }

  async listOverrides(staff: StaffAccess, userId: string, state: 'initiated' | 'all'): Promise<MoneyOverrideList> {
    const rows = await this.queue.listOverrides(state);
    return { overrides: rows.map((r) => present(r, staff, userId)) };
  }

  /** The second signature: a different super admin approves, and the act is done (AC-15, AC-21). */
  async approve(id: string, staff: StaffAccess, approverUserId: string): Promise<MoneyOverrideView> {
    await this.assertSecondSigner(id, approverUserId);
    const decided = await this.queue.decide<ApprovalEffect>({
      id,
      approverUserId,
      verdict: 'applied',
      apply: (tx, override) => this.applyTx(tx, override, approverUserId),
    });
    if (!decided) throw new ConflictException('This request was already decided.');
    if (decided.result) await this.afterApproval(decided.result);
    this.log.log(`Override ${id} (${decided.override.action}) approved and applied.`);
    return this.view(id, staff, approverUserId);
  }

  async reject(id: string, staff: StaffAccess, approverUserId: string): Promise<MoneyOverrideView> {
    await this.assertSecondSigner(id, approverUserId);
    const decided = await this.queue.decide({ id, approverUserId, verdict: 'rejected', apply: async () => null });
    if (!decided) throw new ConflictException('This request was already decided.');
    return this.view(id, staff, approverUserId);
  }

  private async assertSecondSigner(id: string, approverUserId: string): Promise<void> {
    const override = await this.queue.findOverride(id);
    if (!override) throw new NotFoundException('No such request.');
    if (override.initiatedByUserId === approverUserId) {
      throw new ForbiddenException('A different person must decide a request you made.');
    }
  }

  /** The money work of an approval, inside the decision's transaction. */
  private async applyTx(
    tx: Parameters<Parameters<MoneyQueueRepository['decide']>[0]['apply']>[0],
    override: OverrideRecord,
    approverUserId: string,
  ): Promise<ApprovalEffect> {
    if (override.action === 'treasury_adjustment') {
      const d = override.details ?? {};
      if (typeof d.amountRwf !== 'number' || !d.bankReference || !d.provider) {
        throw new ConflictException('This adjustment request is missing its amount or bank reference.');
      }
      const key = `treasury:${override.id}`;
      const written = await this.queue.insertAdjustmentTx(tx, {
        provider: d.provider,
        adapterMode: (d as { adapterMode?: 'mock' | 'live' }).adapterMode ?? this.seam.adapterMode,
        amountRwf: d.amountRwf,
        bankReference: d.bankReference,
        idempotencyKey: key,
        reference: referenceFor(key),
        overrideId: override.id,
      });
      // One deposit counts once: the bank reference is unique per provider.
      if (!written) throw new ConflictException('An adjustment with that bank reference is already recorded.');
      return { kind: 'adjustment', transactionId: written };
    }

    if (!override.subjectId) throw new ConflictException('This request names no payment.');
    const subject = await this.queue.subjectTx(tx, override.subjectId);
    if (!subject) throw new ConflictException('The payment this request names is gone.');

    switch (override.action) {
      case 'resend_disbursement': {
        if (subject.direction !== 'disbursement' || !OWED.has(subject.status) || subject.writtenOffAt) {
          throw new ConflictException('This payment is no longer owed, so there is nothing to send again.');
        }
        const n = (await this.queue.resendCountTx(tx, subject.idempotencyKey)) + 1;
        const key = `resend:${n}:${subject.idempotencyKey}`;
        const askPayer = subject.providerStatus === 'name_mismatch';
        const transactionId = await this.queue.insertResendTx(tx, {
          original: subject,
          idempotencyKey: key,
          reference: referenceFor(key),
          overrideId: override.id,
          askPayer,
          feeRwf: this.seam.settings.disbursementFeeRwf,
        });
        return { kind: 'resend', transactionId, askPayer };
      }
      case 'confirm_received':
        if (!(await this.queue.confirmReceivedTx(tx, subject.id, approverUserId, override.reason))) {
          throw new ConflictException('Only a payment whose outcome is unknown can be confirmed as received.');
        }
        return { kind: 'confirmed', transactionId: subject.id };
      case 'cancel_service':
        if (!(await this.queue.cancelServiceTx(tx, subject.id, approverUserId, override.reason))) {
          throw new ConflictException('Only an open reversal flag can cancel what it paid for.');
        }
        return { kind: 'cancel_service', transactionId: subject.id };
      case 'write_off':
        if (!(await this.queue.writeOffTx(tx, subject.id))) {
          throw new ConflictException('Only a refund that is owed and failed can be written off.');
        }
        return { kind: 'written_off', transactionId: subject.id };
      default:
        throw new ConflictException(`Unknown request ${override.action}.`);
    }
  }

  /** After commit: tell the booking or the registration what the approval changed. */
  private async afterApproval(effect: ApprovalEffect): Promise<void> {
    const row = await this.record.findById(effect.transactionId);
    if (!row) return;
    switch (effect.kind) {
      case 'resend':
        if (effect.askPayer) await this.announce(row, 'needs_details', null);
        return;
      case 'written_off':
        await this.announce(row, 'written_off', null);
        return;
      case 'confirmed':
      case 'cancel_service':
        await this.outcomes.collection({
          transactionId: row.id,
          idempotencyKey: row.idempotencyKey,
          reference: row.reference,
          operation: row.operation,
          status: effect.kind === 'confirmed' ? 'confirmed_received' : 'cancel_service',
          workspaceId: row.workspaceId,
          amountRwf: row.amountRwf,
        });
        return;
      case 'adjustment':
        return;
    }
  }

  private async announce(
    row: TransactionRow,
    status: 'failed' | 'needs_details' | 'written_off',
    failureReason: string | null,
  ): Promise<void> {
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

  private async view(id: string, staff: StaffAccess | null, userId?: string): Promise<MoneyOverrideView> {
    const override = await this.queue.findOverride(id);
    if (!override) throw new NotFoundException('No such request.');
    return present(override, staff, userId ?? override.initiatedByUserId);
  }

  private async mustFind(id: string): Promise<TransactionRow> {
    const row = await this.record.findById(id);
    if (!row) throw new NotFoundException('No such payment.');
    return row;
  }
}

/** Why an override cannot be requested on this row, or null when it can (AC-21). */
export function refusalFor(
  action: MoneyOverrideRequest['action'],
  row: Pick<TransactionRow, 'direction' | 'status'> & { writtenOff?: boolean; reversalOpen?: boolean },
  hasLiveResend: boolean,
): string | null {
  switch (action) {
    case 'resend_disbursement':
    case 'write_off':
      if (row.direction !== 'disbursement' || !OWED.has(row.status)) {
        return 'Only a disbursement that failed or came back can be sent again or written off.';
      }
      if (hasLiveResend) return 'This payment has already been sent again.';
      return null;
    case 'confirm_received':
      return row.direction === 'collection' && row.status === 'unknown'
        ? null
        : 'Only a collection whose outcome is unknown can be confirmed as received.';
    case 'cancel_service':
      return row.direction === 'collection' && (row.status === 'reversed' || row.status === 'refunded')
        ? null
        : 'Only a reversed collection can cancel what it paid for.';
    default:
      return 'Unknown request.';
  }
}

function present(r: OverrideRecord, staff: StaffAccess | null, userId: string): MoneyOverrideView {
  return {
    id: r.id,
    action: r.action as MoneyOverrideView['action'],
    state: r.state as MoneyOverrideView['state'],
    reason: r.reason,
    subjectId: r.subjectId,
    subjectReference: r.subjectReference,
    amountRwf: typeof r.details?.amountRwf === 'number' ? r.details.amountRwf : null,
    initiatedBy: r.initiatedBy,
    decidedBy: r.decidedBy,
    createdAt: r.createdAt.toISOString(),
    canDecide:
      r.state === 'initiated' &&
      !!staff?.permissions.includes('admin.money.override') &&
      r.initiatedByUserId !== userId,
  };
}
