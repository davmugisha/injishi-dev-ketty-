import { describe, expect, it, type Mock, vi } from 'vitest';

import type { PayerNumberPurgeRepository } from './payer-number-purge.repository';
import type { PaymentSeam } from '../../payments/domain/payment-seam';
import type { Job, Queue } from 'bullmq';

import type { PaymentCompensationService } from '../../payments/application/payment-compensation.service';
import {
  PaymentUnavailableError,
  type PaymentPort,
} from '../../payments/domain/payment-port';
import type { BookingRepository } from './booking.repository';
import { PaymentCompensationProcessor } from './payment-compensation.processor';
import type { BookingRefunds } from '../application/booking-refunds';
import type { DisbursementDispatcher } from '../../payments/application/disbursement-dispatcher.service';

/**
 * The referee between a late-settling capture and the retry the guest was
 * told to make (review 3.2). Once an escrow row stands on the capture key, the
 * void job must not refund the money a booking is backed by.
 */
describe('PaymentCompensationProcessor · void-pending', () => {
  const voidJob = {
    kind: 'void-pending' as const,
    idempotencyKey: 'void:ws-1:booking-capture:tok',
    workspaceId: 'ws-1',
    originalRef: 'mock_escrow_capture_ws-1:booking-capture:tok',
    amountRwf: 246_000,
    memo: 'Refused: payment had not settled',
  };

  function build(opts: { claimed: boolean; settledNow?: boolean }): {
    payments: Record<string, Mock | string>;
    bookings: Record<string, Mock>;
    compensations: Record<string, Mock>;
    processor: PaymentCompensationProcessor;
    job: Job;
  } {
    const payments = {
      mode: 'mock' as const,
      voidPending: vi
        .fn()
        .mockRejectedValue(new PaymentUnavailableError('cannot void', voidJob.idempotencyKey)),
      fetchTransaction: vi.fn().mockResolvedValue({
        adapterRef: voidJob.originalRef,
        mode: 'mock',
        replayed: false,
        amountRwf: 246_000,
        currency: 'RWF',
        occurredAt: new Date(),
        settlement: opts.settledNow === false ? 'pending' : 'settled',
      }),
      refund: vi.fn().mockResolvedValue({ replayed: false }),
    };
    const bookings = {
      escrowExistsForCaptureKey: vi.fn().mockResolvedValue(opts.claimed),
      recordExpiredDeclines: vi.fn(),
    };
    const compensations = {
      markDone: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
      drain: vi.fn().mockResolvedValue(0),
    };
    const queue = { upsertJobScheduler: vi.fn() };
    const payerNumbers = { run: vi.fn().mockResolvedValue({ stamped: 0, purged: 0 }) };
    const seam = { settings: { refundWindowDays: 30 } };
    const processor = new PaymentCompensationProcessor(
      queue as unknown as Queue,
      payments as unknown as PaymentPort,
      bookings as unknown as BookingRepository,
      compensations as unknown as PaymentCompensationService,
      payerNumbers as unknown as PayerNumberPurgeRepository,
      seam as unknown as PaymentSeam,
      { tick: vi.fn() } as unknown as DisbursementDispatcher,
      // 073 AC-13: no bank record behind these payments, so the provider path runs.
      { plan: vi.fn().mockResolvedValue(null) } as unknown as BookingRefunds,
    );
    const job = { name: 'void-pending', data: voidJob } as unknown as Job;
    return { payments, bookings, compensations, processor, job };
  }

  it('does not void or refund a capture that a booking has claimed', async () => {
    const { payments, bookings, compensations, processor, job } = build({ claimed: true });

    await processor.process(job);

    expect(bookings.escrowExistsForCaptureKey).toHaveBeenCalledWith(
      'ws-1:booking-capture:tok',
    );
    expect(payments.voidPending).not.toHaveBeenCalled();
    expect(payments.refund).not.toHaveBeenCalled();
    expect(compensations.markDone).toHaveBeenCalledWith(voidJob.idempotencyKey);
  });

  it('refunds a late settlement nobody claimed, on the refund-derived key', async () => {
    const { payments, compensations, processor, job } = build({ claimed: false });

    await processor.process(job);

    expect(payments.refund).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'refund',
        idempotencyKey: 'refund:void:ws-1:booking-capture:tok',
        originalRef: voidJob.originalRef,
        amountRwf: 246_000,
      }),
    );
    expect(compensations.markDone).toHaveBeenCalledWith(voidJob.idempotencyKey);
  });

  it('keeps the job on backoff while the capture is still pending, and records the failure', async () => {
    const { payments, compensations, processor, job } = build({
      claimed: false,
      settledNow: false,
    });

    await expect(processor.process(job)).rejects.toBeInstanceOf(PaymentUnavailableError);
    expect(payments.refund).not.toHaveBeenCalled();
    expect(compensations.markFailed).toHaveBeenCalled();
    expect(compensations.markDone).not.toHaveBeenCalled();
  });
});
