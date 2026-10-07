import type { Queue } from 'bullmq';

jest.mock('@sentry/node', () => {
  const scope = {
    setLevel: jest.fn(),
    setTag: jest.fn(),
    setContext: jest.fn(),
    setFingerprint: jest.fn(),
    setExtra: jest.fn(),
  };
  return {
    init: jest.fn(),
    captureMessage: jest.fn(),
    captureException: jest.fn(),
    withScope: jest.fn((fn: (s: typeof scope) => void) => fn(scope)),
    __scope: scope,
  };
});

import * as Sentry from '@sentry/node';

import type { EbmSaleTrigger } from '../../modules/ebm/application/ebm-sale-trigger.service';
import type { BookingNotificationsService } from '../../modules/booking/application/booking-notifications.service';
import type { PaymentAttemptService } from '../../modules/booking/application/payment-attempt.service';
import { BookingService } from '../../modules/booking/application/booking.service';
import {
  NoAvailabilityError,
  type BookingRepository,
} from '../../modules/booking/infrastructure/booking.repository';
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

const sentry = Sentry as unknown as {
  init: jest.Mock;
  captureMessage: jest.Mock;
  captureException: jest.Mock;
  __scope: { setTag: jest.Mock; setLevel: jest.Mock };
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
  beforeEach(() => jest.clearAllMocks());

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
      add: opts.queueRejects ? jest.fn().mockRejectedValue(new Error('Custom Id cannot contain :')) : jest.fn(),
    };
    const db = {
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          onConflictDoNothing: opts.insertRejects
            ? jest.fn().mockRejectedValue(new Error('connection terminated'))
            : jest.fn().mockResolvedValue(undefined),
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
        findByAttemptKey: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockRejectedValue(new NoAvailabilityError()),
      } as unknown as BookingRepository,
      {
        findBookableRoomType: jest.fn().mockResolvedValue({
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
        captureEscrow: jest.fn().mockResolvedValue(receipt),
        refund: jest.fn().mockRejectedValue(new Error('refund endpoint down')),
      } as unknown as PaymentPort,
      { enqueue: jest.fn().mockResolvedValue(undefined), cancel: jest.fn() } as unknown as PaymentCompensationService,
      { saleConfirmed: jest.fn() } as unknown as EbmSaleTrigger,
      { notify: jest.fn() } as unknown as BookingNotificationsService,
      {
        claimHold: jest.fn().mockResolvedValue({ kind: 'held', row: hold }),
        attachCapture: jest.fn(async (row: object) => ({ ...row, adapterRef: receipt.adapterRef })),
        releaseHold: jest.fn(),
        markRefunded: jest.fn(),
        markBooked: jest.fn(),
      } as unknown as PaymentAttemptService,
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
