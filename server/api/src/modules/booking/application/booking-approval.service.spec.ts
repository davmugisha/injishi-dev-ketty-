import { ConflictException, NotFoundException } from '@nestjs/common';

import {
  PaymentUnavailableError,
  type PaymentPort,
} from '../../payments/domain/payment-port';
import {
  type ApprovalOutcome,
  BookingRepository,
  type HeldEscrow,
  type ManageableBooking,
} from '../infrastructure/booking.repository';
import { BookingApprovalService } from './booking-approval.service';
import { BookingDecisionService } from './booking-decision.service';
import { BookingNotificationsService } from './booking-notifications.service';
import type { FolioService } from '../../operations/application/folio.service';
import type { EbmSaleTrigger } from '../../ebm/application/ebm-sale-trigger.service';

/**
 * Unit scope: authorization + state-guard mapping (404 / 409 / success) around
 * a mocked repository. The SQL authz join and the transactional refund are the
 * repository's job and need a DB-backed test (no test-DB harness yet).
 */
describe('BookingApprovalService', () => {
  const BOOKING_ID = '11111111-1111-1111-1111-111111111111';
  const USER_ID = '22222222-2222-2222-2222-222222222222';

  const WORKSPACE_ID = '55555555-5555-5555-5555-555555555555';

  /** The held escrow behind the pending request, as the repository reads it. */
  const heldEscrow: HeldEscrow = {
    bookingId: BOOKING_ID,
    reference: 'BK-PEND01',
    workspaceId: WORKSPACE_ID,
    escrowId: 'escrow-1',
    adapterRef: 'mock_escrow_capture_1',
    amountRwf: 94_500,
    idempotencyKey: `${WORKSPACE_ID}:booking-capture:token-1`,
  };

  interface Harness {
    repo: {
      findManageableBooking: jest.Mock;
      findHeldEscrow: jest.Mock;
      approve: jest.Mock;
      decline: jest.Mock;
    };
    payments: { mode: 'mock'; releaseEscrow: jest.Mock };
    ebm: { saleConfirmed: jest.Mock };
    service: BookingApprovalService;
  }

  function build(overrides: {
    manageable?: ManageableBooking | null;
    approveOutcome?: ApprovalOutcome | null;
    declineOutcome?: ApprovalOutcome | null;
    heldEscrow?: HeldEscrow | null;
    releaseRejects?: Error;
  }): Harness {
    const repo = {
      findManageableBooking: jest
        .fn()
        .mockResolvedValue(overrides.manageable ?? null),
      findHeldEscrow: jest
        .fn()
        .mockResolvedValue(
          overrides.heldEscrow === undefined
            ? heldEscrow
            : overrides.heldEscrow,
        ),
      approve: jest.fn().mockResolvedValue(overrides.approveOutcome ?? null),
      decline: jest.fn().mockResolvedValue(overrides.declineOutcome ?? null),
      // The shared decision service reads these on approve; a null property
      // means no folio to open, which keeps these cases about the transition.
      propertyForBooking: jest.fn().mockResolvedValue(null),
      findReservationOwner: jest.fn().mockResolvedValue(null),
    };
    const payments = {
      mode: 'mock' as const,
      releaseEscrow: overrides.releaseRejects
        ? jest.fn().mockRejectedValue(overrides.releaseRejects)
        : jest.fn().mockResolvedValue({ replayed: false }),
    };
    const ebm = { saleConfirmed: jest.fn().mockResolvedValue(undefined) };
    const decisions = new BookingDecisionService(
      repo as unknown as BookingRepository,
      payments as unknown as PaymentPort,
      { openForBooking: jest.fn() } as unknown as FolioService,
      ebm as unknown as EbmSaleTrigger,
      // ADR-047: the guest is told what happened. A recording double rather
      // than a no-op, so a test can assert WHICH event was raised.
      { notify: jest.fn().mockResolvedValue(undefined) } as unknown as BookingNotificationsService,
    );
    const service = new BookingApprovalService(
      repo as unknown as BookingRepository,
      decisions,
    );
    return { repo, payments, ebm, service };
  }

  const pending: ManageableBooking = {
    id: BOOKING_ID,
    reference: 'BK-PEND01',
    status: 'pending_approval',
  };

  const declined: ApprovalOutcome = {
    id: BOOKING_ID,
    reference: 'BK-PEND01',
    status: 'declined',
    declineReason: 'host_declined',
    paymentStatus: 'refunded_full',
    escrowStatus: 'refunded_full',
    confirmedAt: null,
  };

  const confirmed: ApprovalOutcome = {
    id: BOOKING_ID,
    reference: 'BK-PEND01',
    status: 'confirmed',
    declineReason: null,
    paymentStatus: 'captured',
    escrowStatus: 'held',
    confirmedAt: new Date('2026-07-15T09:00:00.000Z'),
  };

  /** F-B13 / ADR-041: approval is the moment a request becomes a sale. */
  it('records an approved request as a sale for RRA, and a declined one never', async () => {
    const approving = build({ manageable: pending, approveOutcome: confirmed });
    await approving.service.approve(BOOKING_ID, USER_ID);
    expect(approving.ebm.saleConfirmed).toHaveBeenCalledWith(BOOKING_ID);

    const declining = build({ manageable: pending, declineOutcome: declined });
    await declining.service.decline(BOOKING_ID, USER_ID);
    expect(declining.ebm.saleConfirmed).not.toHaveBeenCalled();
  });

  it('rejects a booking the host cannot manage with 404 (never reveals it)', async () => {
    const { repo, service } = build({ manageable: null });

    await expect(service.approve(BOOKING_ID, USER_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.approve).not.toHaveBeenCalled();
  });

  it('rejects an already-resolved request with 409 and does not transition', async () => {
    const { repo, service } = build({
      manageable: { ...pending, status: 'declined' },
    });

    await expect(service.approve(BOOKING_ID, USER_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repo.approve).not.toHaveBeenCalled();
  });

  it('approves a pending request → confirmed, escrow stays held', async () => {
    const confirmedAt = new Date('2026-07-15T09:00:00.000Z');
    const { service } = build({
      manageable: pending,
      approveOutcome: {
        id: BOOKING_ID,
        reference: 'BK-PEND01',
        status: 'confirmed',
        declineReason: null,
        paymentStatus: 'captured',
        escrowStatus: 'held',
        confirmedAt,
      },
    });

    const result = await service.approve(BOOKING_ID, USER_ID);

    expect(result.status).toBe('confirmed');
    expect(result.escrowStatus).toBe('held');
    expect(result.confirmedAt).toBe(confirmedAt.toISOString());
    expect(result.declineReason).toBeNull();
  });

  it('declines a pending request → declined + host_declined + 100% refund', async () => {
    const { service } = build({
      manageable: pending,
      declineOutcome: {
        id: BOOKING_ID,
        reference: 'BK-PEND01',
        status: 'declined',
        declineReason: 'host_declined',
        paymentStatus: 'refunded_full',
        escrowStatus: 'refunded_full',
        confirmedAt: null,
      },
    });

    const result = await service.decline(BOOKING_ID, USER_ID);

    expect(result.status).toBe('declined');
    expect(result.declineReason).toBe('host_declined');
    expect(result.paymentStatus).toBe('refunded_full');
    expect(result.escrowStatus).toBe('refunded_full');
    expect(result.confirmedAt).toBeNull();
  });

  it('maps a lost race (guard passed, transition returned null) to 409', async () => {
    // Authorized + looked pending, but the auto-decline job resolved it before
    // our write landed → repo.approve returns null.
    const { service } = build({ manageable: pending, approveOutcome: null });

    await expect(service.approve(BOOKING_ID, USER_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
  // --- Instruct the seam, then record (ADR-020 D-h, AC-25) -----------------

  /**
   * The rule this used to break. Decline wrote `refunded_full` on both rows
   * inside a transaction with no payment call at all, which is our mirror
   * declaring money returned that the provider was never told to return.
   */
  it('releases the hold to the guest before it records the decline', async () => {
    const { service, payments, repo } = build({
      manageable: pending,
      declineOutcome: declined,
    });

    await service.decline(BOOKING_ID, USER_ID);

    expect(payments.releaseEscrow).toHaveBeenCalledTimes(1);
    expect(payments.releaseEscrow.mock.calls[0][0]).toMatchObject({
      kind: 'escrow_release',
      beneficiary: 'guest',
      originalRef: 'mock_escrow_capture_1',
      idempotencyKey: `escrow-release:${WORKSPACE_ID}:booking-capture:token-1`,
    });
    expect(payments.releaseEscrow.mock.invocationCallOrder[0]).toBeLessThan(
      repo.decline.mock.invocationCallOrder[0],
    );
  });

  /**
   * A release the provider did not confirm changes nothing. The request stays
   * pending and its money stays held, which is true, and the host can decline
   * again on the same derived key without paying out twice.
   */
  it('records nothing when the release is not confirmed', async () => {
    const { service, repo } = build({
      manageable: pending,
      declineOutcome: declined,
      releaseRejects: new PaymentUnavailableError('gateway down', 'k'),
    });

    await expect(service.decline(BOOKING_ID, USER_ID)).rejects.toMatchObject({
      status: 503,
    });
    expect(repo.decline).not.toHaveBeenCalled();
  });

  /** Nothing held means it was resolved under us: a conflict, not a release. */
  it('instructs nothing when there is no held escrow left', async () => {
    const { service, payments, repo } = build({
      manageable: pending,
      heldEscrow: null,
    });

    await expect(service.decline(BOOKING_ID, USER_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(payments.releaseEscrow).not.toHaveBeenCalled();
    expect(repo.decline).not.toHaveBeenCalled();
  });

  /** Approve keeps the escrow held, so it instructs the seam for nothing. */
  it('does not touch the seam on approve', async () => {
    const { service, payments } = build({
      manageable: pending,
      approveOutcome: confirmed,
    });

    await service.approve(BOOKING_ID, USER_ID);

    expect(payments.releaseEscrow).not.toHaveBeenCalled();
  });
});
