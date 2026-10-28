import { describe, expect, it, type Mock, vi } from 'vitest';

import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { StaffAccess } from '@injishi/contracts';

import { PaymentSeam, resolvePaymentSeam } from '../domain/payment-seam';
import type { PaymentPort } from '../domain/payment-port';
import type { MoneyQueueRepository } from '../infrastructure/money-queue.repository';
import type { PayeeIdentityRepository } from '../infrastructure/payee-identity.repository';
import type { PaymentTransactionsRepository, TransactionRow } from '../infrastructure/payment-transactions.repository';
import type { DisbursementDispatcher } from './disbursement-dispatcher.service';
import { MoneyQueueService, refusalFor } from './money-queue.service';
import type { PaymentOutcomes } from './payment-outcomes';

/**
 * The money queue's rules (073-gtbank-payments AC-20, AC-21): what a person may
 * close alone, what needs a second signer, and that nobody signs twice.
 */
describe('refusalFor (AC-21)', () => {
  it('sends again or writes off only a disbursement that failed or came back, once', () => {
    expect(refusalFor('resend_disbursement', { direction: 'disbursement', status: 'failed' }, false)).toBeNull();
    expect(refusalFor('write_off', { direction: 'disbursement', status: 'reversed' }, false)).toBeNull();
    expect(refusalFor('resend_disbursement', { direction: 'disbursement', status: 'pending' }, false)).toMatch(/failed or came back/);
    expect(refusalFor('resend_disbursement', { direction: 'collection', status: 'failed' }, false)).toMatch(/failed or came back/);
    expect(refusalFor('resend_disbursement', { direction: 'disbursement', status: 'failed' }, true)).toMatch(/already been sent again/);
  });

  it('confirms received only an unknown collection, and cancels the service only on a reversal', () => {
    expect(refusalFor('confirm_received', { direction: 'collection', status: 'unknown' }, false)).toBeNull();
    expect(refusalFor('confirm_received', { direction: 'collection', status: 'failed' }, false)).not.toBeNull();
    expect(refusalFor('cancel_service', { direction: 'collection', status: 'reversed' }, false)).toBeNull();
    expect(refusalFor('cancel_service', { direction: 'collection', status: 'successful' }, false)).not.toBeNull();
  });
});

describe('MoneyQueueService', () => {
  const superAdmin: StaffAccess = { isStaff: true, roles: ['super_admin'], permissions: ['admin.money.override'] } as StaffAccess;

  function row(over: Partial<TransactionRow>): TransactionRow {
    return {
      id: 't-1',
      idempotencyKey: 'k',
      reference: 'INJREF',
      providerReference: 'p-1',
      provider: 'mock',
      adapterMode: 'mock',
      direction: 'collection',
      operation: 'escrow_capture',
      workspaceId: 'ws-1',
      amountRwf: 100_000,
      feeRwf: 0,
      status: 'successful',
      failureReason: null,
      queueReason: null,
      providerStatus: null,
      payerMsisdn: '788123456',
      payerNetwork: 'mtn_momo',
      bookingId: 'b-1',
      originalTransactionId: null,
      moneyOverrideId: null,
      attempts: 1,
      sentAt: null,
      nextAttemptAt: null,
      createdAt: new Date(),
      finalAt: null,
      ...over,
    };
  }

  function build(found: TransactionRow | null, initiatedBy = 'u-finance'): {
    service: MoneyQueueService;
    queue: Record<string, Mock>;
    port: Record<string, Mock>;
    dispatcher: Record<string, Mock>;
  } {
    const queue = {
      findOverride: vi.fn().mockResolvedValue({ id: 'o-1', initiatedByUserId: initiatedBy, state: 'initiated', action: 'write_off', reason: 'r', subjectId: 't-1', subjectReference: null, details: null, initiatedBy: 'F', approvedByUserId: null, decidedBy: null, createdAt: new Date() }),
      decide: vi.fn().mockResolvedValue(null),
      resolve: vi.fn().mockResolvedValue(true),
    };
    const record = { findById: vi.fn().mockResolvedValue(found), hasLiveResend: vi.fn().mockResolvedValue(false) };
    const port = { fetchTransaction: vi.fn().mockResolvedValue(null) };
    const dispatcher = { pullOne: vi.fn().mockResolvedValue(undefined) };
    const service = new MoneyQueueService(
      queue as unknown as MoneyQueueRepository,
      record as unknown as PaymentTransactionsRepository,
      new PaymentSeam(resolvePaymentSeam({})),
      port as unknown as PaymentPort,
      dispatcher as unknown as DisbursementDispatcher,
      { disbursement: vi.fn(), collection: vi.fn() } as unknown as PaymentOutcomes,
      { payerOf: vi.fn().mockResolvedValue({ userId: null, bookingId: null }) } as unknown as PayeeIdentityRepository,
    );
    return { service, queue, port, dispatcher };
  }

  it('never lets the person who asked approve or reject their own request', async () => {
    const { service, queue } = build(null, 'u-super');
    await expect(service.approve('o-1', superAdmin, 'u-super')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.reject('o-1', superAdmin, 'u-super')).rejects.toBeInstanceOf(ForbiddenException);
    expect(queue.decide).not.toHaveBeenCalled();
  });

  it('answers 409 for a request someone already decided', async () => {
    const { service } = build(null);
    await expect(service.approve('o-1', superAdmin, 'u-super')).rejects.toBeInstanceOf(ConflictException);
  });

  it('pulls a collection through the recording port and a disbursement through the dispatcher', async () => {
    const collection = build(row({ status: 'unknown', providerReference: null }));
    await collection.service.pull('t-1');
    expect(collection.port.fetchTransaction).toHaveBeenCalledWith('ws-1', 'INJREF');

    const disbursement = build(row({ direction: 'disbursement', operation: 'refund', status: 'pending' }));
    await disbursement.service.pull('t-1');
    expect(disbursement.dispatcher.pullOne).toHaveBeenCalledWith('t-1');
  });

  it('refuses to pull a final payment (AC-20)', async () => {
    const { service, port } = build(row({ status: 'reversed' }));
    await expect(service.pull('t-1')).rejects.toBeInstanceOf(ConflictException);
    expect(port.fetchTransaction).not.toHaveBeenCalled();
  });

  it('refuses a resolve the repository could not apply, in words', async () => {
    const { service, queue } = build(row({ status: 'successful' }));
    queue.resolve.mockResolvedValue(false);
    await expect(service.resolve('t-1', { outcome: 'failed', note: 'checked it' }, 'u-finance')).rejects.toThrow(
      /unknown can be resolved as failed/,
    );
  });
});
