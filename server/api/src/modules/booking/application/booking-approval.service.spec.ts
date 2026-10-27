import { everyBranch } from '../../../shared/auth/branch-scope.fixture';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { ConflictException, NotFoundException } from '@nestjs/common';

import {
  PaymentUnavailableError,
  type PaymentPort,
} from '../../payments/domain/payment-port';
import {
  type ApprovalOutcome,
  BookingRepository,
  type HeldEscrow,
  type ReservationOwner,
} from '../infrastructure/booking.repository';
import { BookingApprovalService } from './booking-approval.service';
import { BookingDecisionService } from './booking-decision.service';
import { BookingNotificationsService } from './booking-notifications.service';
import type { FolioService } from '../../operations/application/folio.service';
import type { EbmSaleTrigger } from '../../ebm/application/ebm-sale-trigger.service';
import type { BookingRefunds } from './booking-refunds';

/**
 * Unit scope: containment + state-guard mapping (404 / 409 / success) around a
 * mocked repository. WHO may decide is `WorkspaceGuard` and
 * `reservation.approve` on the route since ADR-053 (AC-A5); this service is
 * handed the workspace the guard resolved and proves the booking sits in it.
 * The transactional refund is the repository's job and needs a DB-backed test.
 */
describe('BookingApprovalService', () => {
  const BOOKING_ID = '11111111-1111-1111-1111-111111111111';

  const WORKSPACE_ID = '55555555-5555-5555-5555-555555555555';
  /** The workspace `WorkspaceGuard` resolved; only its id is read here. */
  const PROPERTY_ID = '77777777-7777-4777-8777-777777777777';
  const WS = {
    workspaceId: WORKSPACE_ID,
    branchScope: everyBranch(PROPERTY_ID),
  } as unknown as ScopedWorkspace;

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
      findReservationOwner: jest.Mock;
      findHeldEscrow: jest.Mock;
      approve: jest.Mock;
      decline: jest.Mock;
    };
    payments: { mode: 'mock'; releaseEscrow: jest.Mock };
    ebm: { saleConfirmed: jest.Mock };
    service: BookingApprovalService;
  }

  function build(overrides: {
    owner?: ReservationOwner | null;
    approveOutcome?: ApprovalOutcome | null;
    declineOutcome?: ApprovalOutcome | null;
    heldEscrow?: HeldEscrow | null;
    releaseRejects?: Error;
  }): Harness {
    const repo = {
      findReservationOwner: jest
        .fn()
        .mockResolvedValue(overrides.owner ?? null),
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
      // 073 AC-13: no bank record behind these payments, so the provider path runs.
      { plan: jest.fn().mockResolvedValue(null) } as unknown as BookingRefunds,
    );
    const service = new BookingApprovalService(
      repo as unknown as BookingRepository,
      decisions,
    );
    return { repo, payments, ebm, service };
  }

  const pending: ReservationOwner = {
    id: BOOKING_ID,
    workspaceId: WORKSPACE_ID,
    propertyId: PROPERTY_ID,
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
    const approving = build({ owner: pending, approveOutcome: confirmed });
    await approving.service.approve(BOOKING_ID, WS);
    expect(approving.ebm.saleConfirmed).toHaveBeenCalledWith(BOOKING_ID);

    const declining = build({ owner: pending, declineOutcome: declined });
    await declining.service.decline(BOOKING_ID, WS);
    expect(declining.ebm.saleConfirmed).not.toHaveBeenCalled();
  });

  it('rejects a booking that does not exist with 404', async () => {
    const { repo, service } = build({ owner: null });

    await expect(service.approve(BOOKING_ID, WS)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.approve).not.toHaveBeenCalled();
  });

  it('rejects a booking in ANOTHER workspace with the same 404, never 403', async () => {
    const { repo, service } = build({
      owner: { ...pending, workspaceId: '99999999-9999-9999-9999-999999999999' },
    });

    await expect(service.decline(BOOKING_ID, WS)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.decline).not.toHaveBeenCalled();
  });

  it('rejects a booking on a branch outside the scope with the same 404 (ADR-054 AC-T2)', async () => {
    const { repo, service } = build({
      owner: { ...pending, propertyId: '88888888-8888-4888-8888-888888888888' },
    });

    await expect(service.approve(BOOKING_ID, WS)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.approve).not.toHaveBeenCalled();
  });

  it('rejects an already-resolved request with 409 and does not transition', async () => {
    const { repo, service } = build({
      owner: { ...pending, status: 'declined' },
    });

    await expect(service.approve(BOOKING_ID, WS)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repo.approve).not.toHaveBeenCalled();
  });

  it('approves a pending request → confirmed, escrow stays held', async () => {
    const confirmedAt = new Date('2026-07-15T09:00:00.000Z');
    const { service } = build({
      owner: pending,
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

    const result = await service.approve(BOOKING_ID, WS);

    expect(result.status).toBe('confirmed');
    expect(result.escrowStatus).toBe('held');
    expect(result.confirmedAt).toBe(confirmedAt.toISOString());
    expect(result.declineReason).toBeNull();
  });

  it('declines a pending request → declined + host_declined + 100% refund', async () => {
    const { service } = build({
      owner: pending,
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

    const result = await service.decline(BOOKING_ID, WS);

    expect(result.status).toBe('declined');
    expect(result.declineReason).toBe('host_declined');
    expect(result.paymentStatus).toBe('refunded_full');
    expect(result.escrowStatus).toBe('refunded_full');
    expect(result.confirmedAt).toBeNull();
  });

  it('maps a lost race (guard passed, transition returned null) to 409', async () => {
    // Authorized + looked pending, but the auto-decline job resolved it before
    // our write landed → repo.approve returns null.
    const { service } = build({ owner: pending, approveOutcome: null });

    await expect(service.approve(BOOKING_ID, WS)).rejects.toBeInstanceOf(
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
      owner: pending,
      declineOutcome: declined,
    });

    await service.decline(BOOKING_ID, WS);

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
      owner: pending,
      declineOutcome: declined,
      releaseRejects: new PaymentUnavailableError('gateway down', 'k'),
    });

    await expect(service.decline(BOOKING_ID, WS)).rejects.toMatchObject({
      status: 503,
    });
    expect(repo.decline).not.toHaveBeenCalled();
  });

  /** Nothing held means it was resolved under us: a conflict, not a release. */
  it('instructs nothing when there is no held escrow left', async () => {
    const { service, payments, repo } = build({
      owner: pending,
      heldEscrow: null,
    });

    await expect(service.decline(BOOKING_ID, WS)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(payments.releaseEscrow).not.toHaveBeenCalled();
    expect(repo.decline).not.toHaveBeenCalled();
  });

  /** Approve keeps the escrow held, so it instructs the seam for nothing. */
  it('does not touch the seam on approve', async () => {
    const { service, payments } = build({
      owner: pending,
      approveOutcome: confirmed,
    });

    await service.approve(BOOKING_ID, WS);

    expect(payments.releaseEscrow).not.toHaveBeenCalled();
  });
});
