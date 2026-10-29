import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { PayoutList, PayoutView, PayoutsQuery } from '@injishi/contracts';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { PAYMENT_PORT, PaymentDeclinedError, PaymentUnavailableError, type PaymentPort } from '../../payments/domain/payment-port';
import { buildingIdsOf } from '../domain/attention';
import { destinationOf } from '../domain/payout-accounts';
import { assertResidence } from '../domain/residence';
import type { PaymentRow } from '../infrastructure/lease-payments.repository';
import type { PayoutAccountRow } from '../infrastructure/payout-accounts.repository';
import { PayoutsRepository, type PayoutRow } from '../infrastructure/payouts.repository';
import { RentalsContextRepository } from '../infrastructure/rentals-context.repository';
import { RentalsMoneyQueue } from '../infrastructure/rentals-money.queue';
import { RentalsAuditWriter, type Tx } from '../infrastructure/rentals-writers';
import { PayoutAccountsService } from './payout-accounts.service';
import { presentPayout } from './rent-presenters';

/** Why a payout waits with nowhere to go. */
export const NO_ACCOUNT_REASON = 'No payout account is set up. Add one under Getting paid.';

/** A queued payout nobody touched for this long is sent again by the hourly pass. */
const LOST_AFTER_MS = 10 * 60_000;

/** What the gateway is told about where an account is, unmasked. Never logged. */
function targetOf(account: PayoutAccountRow, accountNumber: string | null): { destination: 'momo' | 'bank' | 'momo_pay'; destinationRef: string } {
  if (account.kind === 'bank') return { destination: 'bank', destinationRef: accountNumber ?? '' };
  if (account.kind === 'momo') return { destination: 'momo', destinationRef: account.momoPhone ?? '' };
  return { destination: 'momo_pay', destinationRef: account.merchantCode ?? '' };
}

/**
 * Payouts of rent to the landlord (blueprint 1.4, 2.6; WP 1.6b). Every
 * gateway payment that succeeds makes one payout to the business's primary
 * payout account, keyed `<workspace>:payout:<payment>`: `queued` and sent by
 * the Payouts job, or `held` with the reason when no account exists, and
 * released by the hourly pass once one is added. The rail refusing the
 * transfer leaves it `failed` with the reason for the landlord to retry; the
 * rail not answering leaves it queued and the job tries again on the same key.
 */
@Injectable()
export class PayoutsService {
  private readonly log = new Logger(PayoutsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly payouts: PayoutsRepository,
    private readonly accounts: PayoutAccountsService,
    private readonly context: RentalsContextRepository,
    private readonly queue: RentalsMoneyQueue,
    private readonly audit: RentalsAuditWriter,
    @Inject(PAYMENT_PORT) private readonly payments: PaymentPort,
  ) {}

  /**
   * One payout for a settled gateway payment, in the settlement's transaction.
   * Queued to the primary account, held without one. Safe to repeat: the key
   * finds the row already made.
   */
  async createForPayment(tx: Tx, payment: PaymentRow, orgId: string): Promise<PayoutRow> {
    const account = await this.payouts.primaryAccount(orgId, tx);
    const org = await this.context.org(orgId);
    const now = new Date();
    return this.payouts.insert(tx, {
      workspaceId: payment.workspaceId,
      payeeType: 'landlord',
      source: 'rent',
      status: account ? 'queued' : 'held',
      amountRwf: payment.amountRwf,
      idempotencyKey: `${payment.workspaceId}:payout:${payment.id}`,
      payoutAccountId: account?.id ?? null,
      destination: account ? targetOf(account, null).destination : null,
      destinationMasked: account ? destinationOf(account) : null,
      payeeName: org.legalName,
      failureReason: account ? null : NO_ACCOUNT_REASON,
      scheduledReleaseAt: now,
      note: `Rent payment ${payment.id}`,
    });
  }

  /** Where a new payout stands, in a line for the landlord's email. */
  payoutWords(payout: PayoutRow): string {
    if (payout.status === 'held') return 'The money is held until you add a payout account under Getting paid.';
    if (payout.status === 'paid') return `It was paid out to ${payout.destinationMasked ?? 'your account'}.`;
    return `It is on its way to ${payout.destinationMasked ?? 'your account'}.`;
  }

  /**
   * Send one queued payout (the Payouts job). Reads first, calls the rail with
   * no transaction open, then writes what it answered. A declined transfer is
   * `failed`; a rail that did not answer throws, so the job tries again.
   */
  async send(payoutId: string): Promise<PayoutRow['status']> {
    const row = await this.payouts.find(payoutId);
    if (!row || row.status !== 'queued') return row?.status ?? 'failed';
    const orgId = await this.payouts.orgOf(payoutId);
    let account = row.payoutAccountId ? await this.payouts.account(row.payoutAccountId) : null;
    if ((!account || account.status === 'retired') && orgId) {
      // Retired while the payout waited: it goes where rent goes now.
      account = await this.payouts.primaryAccount(orgId);
      if (account) {
        await this.payouts.update(this.db, payoutId, {
          payoutAccountId: account.id,
          destination: targetOf(account, null).destination,
          destinationMasked: destinationOf(account),
        });
      }
    }
    if (!account) {
      await this.payouts.update(this.db, payoutId, { status: 'held', failureReason: NO_ACCOUNT_REASON });
      return 'held';
    }
    const target = targetOf(account, account.kind === 'bank' ? this.accounts.openAccountNumber(account) : null);
    try {
      const receipt = await this.payments.payLandlord({
        kind: 'landlord_payout',
        idempotencyKey: row.idempotencyKey ?? `${row.workspaceId}:payout:${payoutId}`,
        amountRwf: row.amountRwf ?? 0,
        currency: 'RWF',
        workspaceId: row.workspaceId,
        memo: row.note ?? 'Rent',
        destination: target.destination,
        destinationRef: target.destinationRef,
      });
      if (receipt.settlement === 'settled') {
        const now = new Date();
        await this.payouts.update(this.db, payoutId, { status: 'paid', settledAt: now, adapterRef: receipt.adapterRef, failureReason: null });
        await this.auditPayout(row, 'payout.paid', { destination: destinationOf(account), adapterRef: receipt.adapterRef });
        return 'paid';
      }
      await this.payouts.update(this.db, payoutId, { adapterRef: receipt.adapterRef });
      return 'queued';
    } catch (cause) {
      if (cause instanceof PaymentDeclinedError) {
        const reason = `The transfer to ${destinationOf(account)} was refused: ${cause.reason}.`;
        await this.payouts.update(this.db, payoutId, { status: 'failed', failureReason: reason });
        await this.auditPayout(row, 'payout.failed', { destination: destinationOf(account), reason });
        return 'failed';
      }
      if (cause instanceof PaymentUnavailableError) {
        this.log.warn(`payout ${payoutId}: the provider did not answer; it stays queued`);
      }
      throw cause;
    }
  }

  /** Held payouts whose business now has an account go out; queued ones whose job was lost are queued again. */
  async sweep(now: Date = new Date()): Promise<{ released: number; requeued: number }> {
    let released = 0;
    for (const row of await this.payouts.held()) {
      const account = await this.payouts.primaryAccount(row.orgId);
      if (!account) continue;
      await this.payouts.update(this.db, row.id, {
        status: 'queued',
        payoutAccountId: account.id,
        destination: targetOf(account, null).destination,
        destinationMasked: destinationOf(account),
        failureReason: null,
      });
      await this.queue.sendPayout(row.id);
      released += 1;
    }
    let requeued = 0;
    for (const row of await this.payouts.queuedBefore(new Date(now.getTime() - LOST_AFTER_MS))) {
      await this.payouts.update(this.db, row.id, {});
      await this.queue.sendPayout(row.id);
      requeued += 1;
    }
    if (released || requeued) this.log.log(`Payouts pass: released ${released} held, requeued ${requeued}.`);
    return { released, requeued };
  }

  // --- The landlord's routes ---------------------------------------------------------------

  async list(ws: ScopedWorkspace, query: PayoutsQuery): Promise<PayoutList> {
    const r = assertResidence(ws);
    const rows = await this.payouts.list({
      workspaceId: r.workspaceId,
      month: query.month ?? null,
      status: query.status ?? null,
      propertyIds: buildingIdsOf(ws.branchScope),
    });
    const totals = { queuedRwf: 0, heldRwf: 0, paidRwf: 0, failedRwf: 0 };
    for (const { payout } of rows) {
      const amount = payout.amountRwf ?? 0;
      if (payout.status === 'queued' || payout.status === 'scheduled') totals.queuedRwf += amount;
      else if (payout.status === 'held') totals.heldRwf += amount;
      else if (payout.status === 'paid') totals.paidRwf += amount;
      else if (payout.status === 'failed') totals.failedRwf += amount;
    }
    return { payouts: rows.map(presentPayout), totals };
  }

  /** Send a failed or held payout again, to the primary account as it stands now. */
  async retry(ws: ScopedWorkspace, userId: string, payoutId: string): Promise<PayoutView> {
    const r = assertResidence(ws);
    const row = await this.payouts.find(payoutId);
    if (!row || row.workspaceId !== r.workspaceId || row.source !== 'rent') throw new NotFoundException('Payout not found.');
    if (row.status === 'paid') throw new ConflictException({ code: 'payout_paid', message: 'This payout was already paid.' });
    if (row.status === 'queued') throw new ConflictException({ code: 'payout_queued', message: 'This payout is already on its way.' });
    const account = await this.payouts.primaryAccount(r.orgId);
    if (!account) throw new ConflictException({ code: 'no_payout_account', message: NO_ACCOUNT_REASON });
    await this.payouts.update(this.db, payoutId, {
      status: 'queued',
      payoutAccountId: account.id,
      destination: targetOf(account, null).destination,
      destinationMasked: destinationOf(account),
      failureReason: null,
    });
    await this.auditPayout(row, 'payout.retried', { by: userId, destination: destinationOf(account) });
    await this.queue.sendPayout(payoutId);
    const listed = await this.payouts.listRow(payoutId);
    if (!listed) throw new NotFoundException('Payout not found.');
    return presentPayout(listed);
  }

  private async auditPayout(row: PayoutRow, eventType: string, diff: Record<string, unknown>): Promise<void> {
    const paymentId = row.note?.startsWith('Rent payment ') ? row.note.slice('Rent payment '.length) : null;
    await this.audit.write(this.db, {
      actorUserId: null,
      subjectType: 'payment',
      subjectId: paymentId ?? row.id,
      eventType,
      diff: { payoutId: row.id, amountRwf: row.amountRwf, ...diff },
    });
  }
}
