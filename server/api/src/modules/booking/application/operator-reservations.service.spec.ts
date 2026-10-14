import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import type { FolioService } from '../../operations/application/folio.service';
import type { PaymentPort } from '../../payments/domain/payment-port';
import type { BookingRepository } from '../infrastructure/booking.repository';
import { BookingDecisionService } from './booking-decision.service';
import { BookingNotificationsService } from './booking-notifications.service';
import { OperatorReservationsService } from './operator-reservations.service';
import { everyBranch } from '../../../shared/auth/branch-scope.fixture';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import type { EbmSaleTrigger } from '../../ebm/application/ebm-sale-trigger.service';

/**
 * The operator desk's approve/decline (review 3.1).
 *
 * The bug these pin: the desk's Decline used to call the repository directly
 * and mark the escrow refunded without instructing the provider. The desk now
 * shares `BookingDecisionService` with the guest-facing path, and these cases
 * assert the money order that path has always had.
 */
describe('OperatorReservationsService', () => {
  const ws = {
    workspaceId: 'ws-1',
    kind: 'business',
    orgId: 'org-1',
    permissions: ['reservation.approve'],
    branchScope: everyBranch('prop-1'),
  } as unknown as ScopedWorkspace;

  const heldEscrow = {
    bookingId: 'bk-1',
    reference: 'BK-TEST-0001',
    workspaceId: 'ws-1',
    escrowId: 'esc-1',
    adapterRef: 'mock_escrow_capture_ws-1:booking-capture:tok',
    amountRwf: 246_000,
    idempotencyKey: 'ws-1:booking-capture:tok',
  };

  const deskRow = {
    id: 'bk-1',
    reference: 'BK-TEST-0001',
    guestName: 'Grace Kwizera',
    checkIn: '2026-09-12',
    checkOut: '2026-09-14',
    guestCount: 2,
    status: 'declined' as const,
    grossRwf: 246_000,
    approvalExpiresAt: null,
    confirmedAt: null,
    stayLifecycle: null,
    roomLabel: null,
    roomTypeId: '00000000-0000-4000-8000-0000000000a1',
  };

  function build(overrides: { releaseRejects?: Error; heldEscrow?: null } = {}): {
    repo: Record<string, jest.Mock>;
    payments: { mode: 'mock'; releaseEscrow: jest.Mock };
    folios: { openForBooking: jest.Mock };
    service: OperatorReservationsService;
    calls: string[];
  } {
    const calls: string[] = [];
    const repo = {
      findReservationOwner: jest
        .fn()
        .mockResolvedValue({ id: 'bk-1', workspaceId: 'ws-1', propertyId: 'prop-1', status: 'pending_approval' }),
      findHeldEscrow: jest
        .fn()
        .mockResolvedValue(overrides.heldEscrow === null ? null : heldEscrow),
      decline: jest.fn().mockImplementation(async () => {
        calls.push('decline');
        return {
          id: 'bk-1',
          reference: 'BK-TEST-0001',
          status: 'declined',
          declineReason: 'host_declined',
          paymentStatus: 'refunded_full',
          escrowStatus: 'refunded_full',
          confirmedAt: null,
        };
      }),
      approve: jest.fn().mockResolvedValue({
        id: 'bk-1',
        reference: 'BK-TEST-0001',
        status: 'confirmed',
        declineReason: null,
        paymentStatus: 'captured',
        escrowStatus: 'held',
        confirmedAt: new Date('2026-09-05T10:00:00Z'),
      }),
      propertyForBooking: jest
        .fn()
        .mockResolvedValue({ propertyId: 'prop-1', guestUserId: 'user-1' }),
      findOperatorReservation: jest.fn().mockResolvedValue(deskRow),
      // Present so a record read that wrongly went through the desk list shows
      // up as a call rather than as an undefined crash.
      listOperatorReservations: jest.fn().mockResolvedValue([deskRow]),
    };
    const payments = {
      mode: 'mock' as const,
      releaseEscrow: jest.fn().mockImplementation(async () => {
        calls.push('release');
        if (overrides.releaseRejects) throw overrides.releaseRejects;
        return { replayed: false };
      }),
    };
    const folios = { openForBooking: jest.fn().mockResolvedValue('folio-1') };
    const decisions = new BookingDecisionService(
      repo as unknown as BookingRepository,
      payments as unknown as PaymentPort,
      folios as unknown as FolioService,
      { saleConfirmed: jest.fn() } as unknown as EbmSaleTrigger,
      // ADR-047: the guest is told what happened. A recording double rather
      // than a no-op, so a test can assert WHICH event was raised.
      { notify: jest.fn().mockResolvedValue(undefined) } as unknown as BookingNotificationsService,
    );
    const service = new OperatorReservationsService(
      repo as unknown as BookingRepository,
      decisions,
    );
    return { repo, payments, folios, service, calls };
  }

  it('operator decline instructs a release to the guest before it records the decline', async () => {
    const { repo, payments, service, calls } = build();

    await service.decline(ws, 'bk-1');

    expect(payments.releaseEscrow).toHaveBeenCalledTimes(1);
    expect(payments.releaseEscrow).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'escrow_release',
        beneficiary: 'guest',
        originalRef: heldEscrow.adapterRef,
        amountRwf: 246_000,
        idempotencyKey: 'escrow-release:ws-1:booking-capture:tok',
      }),
    );
    expect(repo.decline).toHaveBeenCalledWith('bk-1');
    expect(calls).toEqual(['release', 'decline']);
  });

  it('records nothing when the provider does not confirm the release', async () => {
    const { repo, service } = build({ releaseRejects: new Error('provider down') });

    await expect(service.decline(ws, 'bk-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(repo.decline).not.toHaveBeenCalled();
  });

  it('answers 409 when nothing is held any more', async () => {
    const { repo, service } = build({ heldEscrow: null });

    await expect(service.decline(ws, 'bk-1')).rejects.toBeInstanceOf(ConflictException);
    expect(repo.decline).not.toHaveBeenCalled();
  });

  it('operator approve opens the folio for the workspace, and never touches the seam', async () => {
    const { payments, folios, service } = build();

    await service.approve(ws, 'bk-1');

    expect(folios.openForBooking).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'bk-1', workspaceId: 'ws-1', propertyId: 'prop-1' }),
    );
    expect(payments.releaseEscrow).not.toHaveBeenCalled();
  });

  /**
   * The record read, and the defect it removes.
   *
   * The record screen used to resolve its booking out of `list()`, which is
   * windowed to `DESK_WINDOW_DAYS` and capped at `DESK_LIMIT`. A booking older
   * than the window existed, belonged to the workspace, and still rendered the
   * app's "that page isn't here". These cases pin the three properties that
   * make the new read correct: it does NOT go through the desk filter, and it
   * refuses another workspace's id and another branch's id with a 404 rather
   * than a 403.
   */
  describe('get', () => {
    it('reads the booking directly, never through the windowed desk list', async () => {
      const { repo, service } = build();

      const reservation = await service.get(ws, 'bk-1');

      expect(repo.findOperatorReservation).toHaveBeenCalledWith('bk-1');
      // The desk read is what carries the 90-day window and the row cap, so a
      // record read that touched it would inherit both.
      expect(repo.listOperatorReservations).not.toHaveBeenCalled();
      expect(reservation.id).toBe('bk-1');
      expect(reservation.reference).toBe('BK-TEST-0001');
    });

    it('answers 404 for a booking on another workspace, and does not read it', async () => {
      const { repo, service } = build();
      repo.findReservationOwner.mockResolvedValue({
        id: 'bk-1',
        workspaceId: 'ws-2',
        propertyId: 'prop-1',
        status: 'confirmed',
      });

      await expect(service.get(ws, 'bk-1')).rejects.toBeInstanceOf(NotFoundException);
      // 404 BEFORE the row is read: a refusal that still fetched the record
      // would be one careless log line away from leaking it.
      expect(repo.findOperatorReservation).not.toHaveBeenCalled();
    });

    it('answers 404 for a booking on a branch outside the scope (ADR-054, AC-T2)', async () => {
      const { repo, service } = build();
      repo.findReservationOwner.mockResolvedValue({
        id: 'bk-1',
        workspaceId: 'ws-1',
        propertyId: 'prop-9',
        status: 'confirmed',
      });

      await expect(service.get(ws, 'bk-1')).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.findOperatorReservation).not.toHaveBeenCalled();
    });

    it('answers 404 for an id that does not exist at all', async () => {
      const { repo, service } = build();
      repo.findReservationOwner.mockResolvedValue(null);

      await expect(service.get(ws, 'bk-missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
