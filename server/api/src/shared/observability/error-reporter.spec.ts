import { afterAll, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { Queue } from 'bullmq';

vi.mock('@sentry/node', () => {
  const scope = {
    setLevel: vi.fn(),
    setTag: vi.fn(),
    setContext: vi.fn(),
    setFingerprint: vi.fn(),
    setExtra: vi.fn(),
  };
  return {
    init: vi.fn(),
    captureMessage: vi.fn(),
    captureException: vi.fn(),
    withScope: vi.fn((fn: (s: typeof scope) => void) => fn(scope)),
    __scope: scope,
  };
});

import * as Sentry from '@sentry/node';

import type { EbmSaleTrigger } from '../../modules/ebm/application/ebm-sale-trigger.service';
import type { BookingNotificationsService } from '../../modules/pms/application/booking-notifications.service';
import type { PaymentAttemptService } from '../../modules/pms/application/payment-attempt.service';
import { BookingService } from '../../modules/pms/application/booking.service';
import {
  NoAvailabilityError,
  type BookingRepository,
} from '../../modules/pms/infrastructure/booking.repository';
import type { ListingService } from '../../modules/listing/application/listing.service';
import { PaymentCompensationService } from '../../modules/payments/application/payment-compensation.service';
import type { PaymentPort } from '../../modules/payments/domain/payment-port';
import type { Database } from '../database/database.module';
import {
  INERT_REPORTER,
  createErrorReporter,
  setErrorReporter,
  type Alarm,
  type ErrorReporter,
} from './error-reporter';
import type { PaymentSeam } from '../../modules/payments/domain/payment-seam';

const sentry = Sentry as unknown as {
  init: Mock;
  captureMessage: Mock;
  captureException: Mock;
  __scope: { setTag: Mock; setLevel: Mock };
};

/**
 * Money failures raise an alarm (booking audit, 2026-09-13). The reporter is
 * inert without a DSN, reports through Sentry with one, and the three money
 * alarms are raised from the code paths that used to only log them.
 */
/** The production stack: its DSN, over its real database (ADR-063). */
const PRODUCTION = {
  SENTRY_DSN: 'https://k@o0.ingest.sentry.io/1',
  INJISHI_ENVIRONMENT: 'production',
  INJISHI_DATABASE_KIND: 'real',
};

describe('createErrorReporter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('is inert without a DSN: nothing is initialised and nothing is sent', () => {
    const reporter = createErrorReporter({ SENTRY_DSN: '  ' });

    reporter.alarm('STUCK_MONEY', 'test');

    expect(reporter.enabled).toBe(false);
    expect(sentry.init).not.toHaveBeenCalled();
    expect(sentry.captureMessage).not.toHaveBeenCalled();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('initialises Sentry with a DSN and reports an alarm, tagged and fatal', () => {
    const reporter = createErrorReporter(PRODUCTION);

    reporter.alarm('UNRECORDED_COMPENSATION', 'row refused', { idempotencyKey: 'k' });

    expect(sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: 'https://k@o0.ingest.sentry.io/1', environment: 'production', sendDefaultPii: false }),
    );
    expect(sentry.__scope.setTag).toHaveBeenCalledWith('alarm', 'UNRECORDED_COMPENSATION');
    expect(sentry.__scope.setLevel).toHaveBeenCalledWith('fatal');
    expect(sentry.captureMessage).toHaveBeenCalledWith('UNRECORDED_COMPENSATION: row refused');
  });

  it('reports the underlying error when there is one', () => {
    const reporter = createErrorReporter(PRODUCTION);
    const boom = new Error('refund endpoint down');

    reporter.alarm('STUCK_MONEY', 'refund failed', {}, boom);

    expect(sentry.captureException).toHaveBeenCalledWith(boom);
  });
});

describe('the money alarms, from their call sites', () => {
  const raised: Array<{ alarm: Alarm; context?: Record<string, unknown> }> = [];
  const recording: ErrorReporter = {
    enabled: true,
    alarm: (alarm, _message, context) => void raised.push({ alarm, context }),
    exception: () => undefined,
  };

  beforeEach(() => {
    raised.length = 0;
    setErrorReporter(recording);
  });
  afterAll(() => setErrorReporter(INERT_REPORTER));

  function compensationService(opts: { insertRejects?: boolean; queueRejects?: boolean }): PaymentCompensationService {
    const queue = {
      add: opts.queueRejects ? vi.fn().mockRejectedValue(new Error('Custom Id cannot contain :')) : vi.fn(),
      // The drain asks for a spent job under the same id first (073 AC-25); none here.
      getJob: vi.fn().mockResolvedValue(undefined),
    };
    const db = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: opts.insertRejects
            ? vi.fn().mockRejectedValue(new Error('connection terminated'))
            : vi.fn().mockResolvedValue(undefined),
        })),
      })),
    };
    return new PaymentCompensationService(queue as unknown as Queue, db as unknown as Database);
  }
  const job = {
    kind: 'refund' as const,
    idempotencyKey: 'refund:ws:booking-capture:tok',
    workspaceId: 'ws',
    originalRef: 'ref',
    amountRwf: 94_500,
    memo: 'm',
  };

  it('UNRECORDED COMPENSATION: the table refused the row', async () => {
    await compensationService({ insertRejects: true }).enqueue(job);
    expect(raised.map((r) => r.alarm)).toContain('UNRECORDED_COMPENSATION');
  });

  it('a refused queue wake', async () => {
    await compensationService({ queueRejects: true }).enqueue(job);
    expect(raised).toEqual([expect.objectContaining({ alarm: 'QUEUE_WAKE_REFUSED' })]);
  });

  it('nothing when the row is written and the worker woken', async () => {
    await compensationService({}).enqueue(job);
    expect(raised).toEqual([]);
  });

  it('STUCK MONEY: the booking failed after capture and the refund failed too', async () => {
    const receipt = {
      adapterRef: 'mock_escrow_capture_k',
      mode: 'mock' as const,
      replayed: false,
      amountRwf: 94_500,
      currency: 'RWF' as const,
      occurredAt: new Date(),
      settlement: 'settled' as const,
    };
    const hold = { id: 'hold-1', adapterRef: null };
    const service = new BookingService(
      {
        findByAttemptKey: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValue(new NoAvailabilityError()),
      } as unknown as BookingRepository,
      {
        findBookableRoomType: vi.fn().mockResolvedValue({
          id: '44444444-4444-4444-4444-444444444444',
          workspaceId: 'ws',
          domain: 'hospitality',
          capacity: 2,
          roomCount: 1,
          nightlyRateRwf: 45_000,
          bookingMode: 'instant_book',
          cancellationTier: 'flexible',
          nonrefundableEligible: false,
        }),
      } as unknown as ListingService,
      {
        captureEscrow: vi.fn().mockResolvedValue(receipt),
        refund: vi.fn().mockRejectedValue(new Error('refund endpoint down')),
      } as unknown as PaymentPort,
      { enqueue: vi.fn().mockResolvedValue(undefined), cancel: vi.fn() } as unknown as PaymentCompensationService,
      { saleConfirmed: vi.fn() } as unknown as EbmSaleTrigger,
      { notify: vi.fn() } as unknown as BookingNotificationsService,
      {
        claimHold: vi.fn().mockResolvedValue({ kind: 'held', row: hold }),
        attachCapture: vi.fn(async (row: object) => ({ ...row, adapterRef: receipt.adapterRef })),
        releaseHold: vi.fn(),
        markRefunded: vi.fn(),
        markBooked: vi.fn(),
      } as unknown as PaymentAttemptService,
      // A seam that admits the card this test settles with: it is about the
      // alarm after a failed refund, not the rules (073-gtbank-payments AC-24).
      { ruleProblem: () => null } as unknown as PaymentSeam,
    );

    const checkIn = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10);
    const checkOut = new Date(Date.now() + 42 * 86_400_000).toISOString().slice(0, 10);
    await expect(
      service.create(
        {
          roomTypeId: '44444444-4444-4444-4444-444444444444',
          checkIn,
          checkOut,
          guests: 2,
          nonRefundable: false,
          attemptToken: '7a2d3c4b-5e6f-4a1b-9c8d-0e1f2a3b4c5d',
          instrument: { kind: 'card', token: 'tok_test' },
        },
        '66666666-6666-6666-6666-666666666666',
      ),
    ).rejects.toThrow();

    expect(raised).toEqual([
      expect.objectContaining({
        alarm: 'STUCK_MONEY',
        context: expect.objectContaining({ adapterRef: 'mock_escrow_capture_k', amountRwf: 94_500 }),
      }),
    ]);
  });
});
