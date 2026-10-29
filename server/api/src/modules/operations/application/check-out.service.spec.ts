import type { GuestRegistryService } from '../../guests/application/guest-registry.service';
import { describe, expect, it, type Mock, vi } from 'vitest';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import type { FolioRepository } from '../infrastructure/folio.repository';
import type { StayRow } from '../infrastructure/front-desk.repository';
import { FrontDeskRepository } from '../infrastructure/front-desk.repository';
import { FolioService } from './folio.service';
import { FrontDeskService } from './front-desk.service';
import type { RoomAssignmentService } from './room-assignment.service';
import type { StayClaimService } from './stay-claim.service';
import type { SelfCheckInService } from './self-check-in.service';

/**
 * WHAT CHECK OUT DOES WITH THE BODY IT NOW TAKES.
 *
 * `CheckOutRequest` was a declared contract with no handler behind it: the
 * route took no `@Body`, `guest_stays` had no column, and a `note` sent by any
 * client was accepted by the type system and dropped by the code. These tests
 * exist because "the field is declared" is exactly the evidence that made that
 * look finished, and a declaration is not a behaviour.
 *
 * Three things are pinned here, and each one is a way the note could be wrong
 * in a manner nothing else would notice:
 *
 *   1. it reaches the repository on the SAME call that closes the stay,
 *   2. a second press neither reopens the stay nor overwrites what the first
 *      press recorded,
 *   3. a balance still owing does not block the departure and does not sign the
 *      bill — the rule `settleOnDeparture` already had, which the new flow must
 *      not quietly change while it is adding a warning to the screen.
 *
 * The repository is a double rather than a database: what is under test is the
 * service's decision, and a real Postgres would prove the column exists while
 * proving nothing about which arguments the service passes. The column itself
 * is covered by migration `0050_stay_departure_note` and by the live run
 * recorded against gate G13.
 */
describe('FrontDeskService.checkOut: the departure note and the balance', () => {
  const WORKSPACE = '0f9a1b00-0000-4000-8000-000000000001';
  const PROPERTY = '0f9a1b00-0000-4000-8000-0000000000aa';
  const STAY = '0f9a1b00-0000-4000-8000-0000000000bb';

  const ws = {
    workspaceId: WORKSPACE,
    kind: 'business',
    orgId: '0f9a1b00-0000-4000-8000-0000000000cc',
    orgName: 'Umurage Guesthouse',
    domain: 'hospitality',
    orgRole: 'owner',
    registrationStatus: 'active',
    permissions: ['stay.checkout', 'folio.close'],
    branchScope: {
      coverage: 'all',
      selectedPropertyId: null,
      propertyIds: [PROPERTY],
      includesUnbranched: true,
    },
  } as unknown as ScopedWorkspace;

  const openStay = (over: Partial<StayRow> = {}): StayRow => ({
    id: STAY,
    workspaceId: WORKSPACE,
    bookingId: null,
    guestUserId: null,
    roomId: '0f9a1b00-0000-4000-8000-0000000000dd',
    propertyId: PROPERTY,
    roomLabel: '204',
    guestName: 'Jean Uwase',
    lifecycle: 'open',
    entryAt: new Date('2026-09-14T14:00:00Z'),
    plannedExitAt: new Date('2026-09-17T11:00:00Z'),
    actualExitAt: null,
    ...over,
  });

  /**
   * The service with every collaborator doubled.
   *
   * `findStay` is a queue rather than a fixed value because `checkOut` reads
   * the stay twice on the happy path — once to guard, once to report where it
   * landed — and a double that returns the OPEN row both times would let a
   * service that never closed anything pass.
   */
  function build(options: {
    stays: StayRow[];
    closed: boolean;
    balanceRwf?: number | null;
  }): {
    service: FrontDeskService;
    closeStay: Mock;
    findFolioForStay: Mock;
    close: Mock;
    releaseForBooking: Mock;
  } {
    const reads = [...options.stays];
    const closeStay = vi.fn().mockResolvedValue(options.closed);
    const findFolioForStay = vi.fn().mockResolvedValue(
      options.balanceRwf === null || options.balanceRwf === undefined
        ? null
        : { id: 'folio-1', status: 'open', balanceRwf: options.balanceRwf },
    );
    const close = vi.fn().mockResolvedValue(undefined);
    const releaseForBooking = vi.fn().mockResolvedValue(undefined);

    const rooms = {
      findStay: vi.fn(() => Promise.resolve(reads.shift() ?? null)),
      closeStay,
    } as unknown as FrontDeskRepository;

    const service = new FrontDeskService(
      rooms,
      { releaseForBooking } as unknown as RoomAssignmentService,
      { findFolioForStay } as unknown as FolioRepository,
      { close } as unknown as FolioService,
      {} as unknown as StayClaimService,
      {} as unknown as SelfCheckInService,
      { fileStayGuest: vi.fn().mockResolvedValue(null) } as unknown as GuestRegistryService,
    );

    return { service, closeStay, findFolioForStay, close, releaseForBooking };
  }

  it('hands the note to the same call that closes the stay', async () => {
    const closedRow = openStay({
      lifecycle: 'closed',
      actualExitAt: new Date('2026-09-17T09:30:00Z'),
    });
    const { service, closeStay } = build({
      stays: [openStay(), closedRow],
      closed: true,
      balanceRwf: 0,
    });

    await service.checkOut(ws, STAY, { note: 'left early, keys at desk' });

    expect(closeStay).toHaveBeenCalledTimes(1);
    expect(closeStay).toHaveBeenCalledWith(
      expect.objectContaining({
        stayId: STAY,
        departureNote: 'left early, keys at desk',
      }),
    );
  });

  it('sends no note at all when the desk typed none, rather than an empty one', async () => {
    // `undefined` and `''` are different writes: the repository skips the
    // column for one and blanks it for the other. A bodyless check out must be
    // the first, or every fast-path departure erases whatever was there.
    const { service, closeStay } = build({
      stays: [openStay(), openStay({ lifecycle: 'closed' })],
      closed: true,
      balanceRwf: 0,
    });

    await service.checkOut(ws, STAY);

    expect(closeStay).toHaveBeenCalledWith(
      expect.objectContaining({ departureNote: undefined }),
    );
  });

  it('does not touch an already closed stay, so a second press writes nothing', async () => {
    const { service, closeStay } = build({
      stays: [openStay({ lifecycle: 'closed', actualExitAt: new Date('2026-09-17T09:30:00Z') })],
      closed: false,
    });

    const answer = await service.checkOut(ws, STAY, { note: 'second thoughts' });

    // The guard is what protects the recorded exit time AND the first note.
    expect(closeStay).not.toHaveBeenCalled();
    expect(answer.lifecycle).toBe('closed');
    expect(answer.actualExitAt).toBe('2026-09-17T09:30:00.000Z');
  });

  it('checks a guest out who still owes money, and leaves the bill open', async () => {
    // This is the rule the drawer now WARNS about and must not change: nothing
    // fiscal is allowed to be what un-checks-out a guest (ADR-050). The screen
    // asks the operator to acknowledge the balance; the server still departs.
    const { service, close } = build({
      stays: [openStay(), openStay({ lifecycle: 'closed' })],
      closed: true,
      balanceRwf: 66_000,
    });

    const answer = await service.checkOut(ws, STAY, { note: 'to be invoiced' });

    expect(answer.lifecycle).toBe('closed');
    expect(close).not.toHaveBeenCalled();
  });

  it('signs the bill when the balance reached zero', async () => {
    const { service, close } = build({
      stays: [openStay(), openStay({ lifecycle: 'closed' })],
      closed: true,
      balanceRwf: 0,
    });

    await service.checkOut(ws, STAY);

    expect(close).toHaveBeenCalledTimes(1);
  });
});
