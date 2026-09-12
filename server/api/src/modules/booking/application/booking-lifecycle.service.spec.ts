import { PaymentCompensationService } from '../../payments/application/payment-compensation.service';
import {
  PaymentUnavailableError,
  type PaymentPort,
} from '../../payments/domain/payment-port';
import type {
  BookingRepository,
  HeldEscrow,
} from '../infrastructure/booking.repository';
import { BookingLifecycleService } from './booking-lifecycle.service';
import { BookingNotificationsService } from './booking-notifications.service';

/**
 * Unit scope: the ORDER the sweep does things in (ADR-020 D-h) around a mocked
 * repository and a mocked seam. The SQL predicate and the transactional write
 * belong to a DB-backed integration test; no test-DB harness exists in the repo
 * yet, so that is a follow-up.
 *
 * The thing being pinned here is the rule the old shape broke: nothing is
 * recorded as refunded until the provider confirmed the release. Our mirror
 * claiming money came back that nobody returned is the exact divergence F-A06
 * exists to detect, and the platform used to manufacture it on every sweep.
 */
describe('BookingLifecycleService', () => {
  const WORKSPACE_ID = '55555555-5555-5555-5555-555555555555';

  function held(id: string, overrides: Partial<HeldEscrow> = {}): HeldEscrow {
    return {
      bookingId: id,
      reference: `BK-${id.toUpperCase()}`,
      workspaceId: WORKSPACE_ID,
      escrowId: `escrow-${id}`,
      adapterRef: `mock_escrow_capture_${id}`,
      amountRwf: 94_500,
      idempotencyKey: `${WORKSPACE_ID}:booking-capture:${id}`,
      ...overrides,
    };
  }

  interface Harness {
    repo: {
      findExpiredRequests: jest.Mock;
      recordExpiredDeclines: jest.Mock;
    };
    payments: { mode: 'mock'; releaseEscrow: jest.Mock };
    compensations: { enqueue: jest.Mock };
    service: BookingLifecycleService;
  }

  function build(
    candidates: HeldEscrow[],
    opts: { releaseRejects?: Error } = {},
  ): Harness {
    const repo = {
      findExpiredRequests: jest.fn().mockResolvedValue(candidates),
      recordExpiredDeclines: jest
        .fn()
        .mockImplementation((ids: string[]) =>
          Promise.resolve(
            ids.map((id) => ({ id, reference: `BK-${id.toUpperCase()}` })),
          ),
        ),
    };
    const payments = {
      mode: 'mock' as const,
      releaseEscrow: opts.releaseRejects
        ? jest.fn().mockRejectedValue(opts.releaseRejects)
        : jest.fn().mockResolvedValue({ replayed: false }),
    };
    const compensations = { enqueue: jest.fn().mockResolvedValue(undefined) };

    const service = new BookingLifecycleService(
      repo as unknown as BookingRepository,
      payments as unknown as PaymentPort,
      compensations as unknown as PaymentCompensationService,
      // ADR-047: the guest is told what happened. A recording double rather
      // than a no-op, so a test can assert WHICH event was raised.
      { notify: jest.fn().mockResolvedValue(undefined) } as unknown as BookingNotificationsService,
    );
    return { repo, payments, compensations, service };
  }

  it('passes the sweep instant through to the repository unchanged', async () => {
    const { repo, service } = build([]);
    const now = new Date('2026-07-15T10:00:00.000Z');

    await service.expireStaleRequests(now);

    expect(repo.findExpiredRequests).toHaveBeenCalledTimes(1);
    expect(repo.findExpiredRequests).toHaveBeenCalledWith(now);
  });

  it('defaults the instant to now when the caller omits it', async () => {
    const { repo, service } = build([]);

    await service.expireStaleRequests();

    const [passed] = repo.findExpiredRequests.mock.calls[0];
    expect(passed).toBeInstanceOf(Date);
  });

  it('reports zero on a quiet sweep and instructs nothing', async () => {
    const { service, payments } = build([]);

    await expect(service.expireStaleRequests(new Date())).resolves.toBe(0);
    expect(payments.releaseEscrow).not.toHaveBeenCalled();
  });

  /**
   * The ordering rule, stated as an assertion: the seam is instructed BEFORE
   * anything is written, and the release names the guest as the beneficiary,
   * because ending a hold for the guest and ending it for the host are the same
   * instruction with opposite outcomes.
   */
  it('releases to the guest first, then records what the provider confirmed', async () => {
    const { service, payments, repo } = build([held('a'), held('b')]);

    await expect(service.expireStaleRequests(new Date())).resolves.toBe(2);

    expect(payments.releaseEscrow).toHaveBeenCalledTimes(2);
    expect(payments.releaseEscrow.mock.calls[0][0]).toMatchObject({
      kind: 'escrow_release',
      beneficiary: 'guest',
      originalRef: 'mock_escrow_capture_a',
    });
    expect(repo.recordExpiredDeclines).toHaveBeenCalledWith(['a', 'b']);
    expect(
      payments.releaseEscrow.mock.invocationCallOrder[0],
    ).toBeLessThan(repo.recordExpiredDeclines.mock.invocationCallOrder[0]);
  });

  /** Derived from the capture's key, never equal to it, never fresh. */
  it('runs the release on a key derived from the capture key', async () => {
    const { service, payments } = build([held('a')]);

    await service.expireStaleRequests(new Date());

    expect(payments.releaseEscrow.mock.calls[0][0].idempotencyKey).toBe(
      `escrow-release:${WORKSPACE_ID}:booking-capture:a`,
    );
  });

  /**
   * The rule D-h exists for. A release the provider did not confirm leaves the
   * booking pending and its money held — which is true — and goes on the queue.
   * Marking it refunded on optimism is what this must never do.
   */
  it('records nothing and queues instead when the release is not confirmed', async () => {
    const { service, repo, compensations } = build([held('a')], {
      releaseRejects: new PaymentUnavailableError('gateway down', 'k'),
    });

    await expect(service.expireStaleRequests(new Date())).resolves.toBe(0);

    expect(repo.recordExpiredDeclines).toHaveBeenCalledWith([]);
    const [job] = compensations.enqueue.mock.calls[0];
    expect(job).toMatchObject({
      kind: 'release-escrow',
      bookingId: 'a',
      idempotencyKey: `escrow-release:${WORKSPACE_ID}:booking-capture:a`,
    });
  });

  /** One provider failure must not stop the rest of the batch resolving. */
  it('keeps sweeping the batch after one release fails', async () => {
    const { service, payments, repo } = build([held('a'), held('b')]);
    payments.releaseEscrow
      .mockRejectedValueOnce(new PaymentUnavailableError('down', 'k'))
      .mockResolvedValueOnce({ replayed: false });

    await expect(service.expireStaleRequests(new Date())).resolves.toBe(1);
    expect(repo.recordExpiredDeclines).toHaveBeenCalledWith(['b']);
  });

  /**
   * A row written before the seam existed carries no provider reference. There
   * is nothing to instruct, so there is nothing that may be recorded: it keeps
   * its hold and is reported loudly rather than quietly marked refunded.
   */
  it('leaves a row with no adapter reference held, and records nothing for it', async () => {
    const { service, payments, repo } = build([
      held('a', { adapterRef: null }),
    ]);

    await expect(service.expireStaleRequests(new Date())).resolves.toBe(0);
    expect(payments.releaseEscrow).not.toHaveBeenCalled();
    expect(repo.recordExpiredDeclines).toHaveBeenCalledWith([]);
  });
});
