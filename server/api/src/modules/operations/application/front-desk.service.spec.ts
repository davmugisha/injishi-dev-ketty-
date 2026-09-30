import type { WalkInRequest } from '@injishi/contracts';
import { BadRequestException, ConflictException } from '@nestjs/common';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import type { FolioRepository } from '../infrastructure/folio.repository';
import type {
  FrontDeskRepository,
  RoomRow,
  StayRow,
} from '../infrastructure/front-desk.repository';
import type { FolioService } from './folio.service';
import { FrontDeskService } from './front-desk.service';
import type { RoomAssignmentService } from './room-assignment.service';
import type { StayClaimService } from './stay-claim.service';
import type { SelfCheckInService } from './self-check-in.service';

const ws = {
  workspaceId: 'ws-1',
  branchScope: {
    coverage: 'all',
    selectedPropertyId: null,
    propertyIds: ['prop-1'],
    includesUnbranched: true,
  },
} as unknown as ScopedWorkspace;

const ROOM_ID = '00000000-0000-4000-8000-000000000101';

const room: RoomRow = {
  id: ROOM_ID,
  workspaceId: 'ws-1',
  propertyId: 'prop-1',
  label: '101',
  roomTypeId: 'type-1',
  roomTypeName: 'Standard Double',
  status: 'available',
  housekeeping: 'clean',
};

type OpenStayInput = Parameters<FrontDeskRepository['openStay']>[0];

/**
 * The walk in's rules, against stand ins for the database.
 *
 * What these prove is the service's DECISIONS: which rate lands on the stay,
 * when a room is refused, and that the registration card the desk filled in
 * reaches onboarding. The night audit's read is SQL and is proven against
 * Postgres by `scripts/verify-walk-in.mjs`, not here.
 */
function build(opts: {
  defaultRate?: number | null;
  hold?: { from: string } | null;
}): {
  service: FrontDeskService;
  opened: OpenStayInput[];
  holdQueries: { from: string; to: string }[];
  folios: unknown[];
  cards: unknown[];
} {
  const opened: OpenStayInput[] = [];
  const holdQueries: { from: string; to: string }[] = [];
  const folios: unknown[] = [];
  const cards: unknown[] = [];

  const repo = {
    findRoom: async () => room,
    defaultNightlyRate: async () => opts.defaultRate ?? null,
    openStay: async (input: OpenStayInput) => {
      opened.push(input);
      return 'stay-1';
    },
    findStay: async (): Promise<StayRow> => {
      const input = opened[opened.length - 1];
      return {
        id: 'stay-1',
        workspaceId: 'ws-1',
        bookingId: null,
        guestUserId: null,
        roomId: ROOM_ID,
        propertyId: 'prop-1',
        roomLabel: '101',
        guestName: input.guestName,
        lifecycle: 'open',
        entryAt: new Date(),
        plannedExitAt: input.plannedExitAt,
        actualExitAt: null,
      };
    },
  } as unknown as FrontDeskRepository;

  const assignments = {
    firstHoldOnRoom: async (_roomId: string, from: string, to: string) => {
      holdQueries.push({ from, to });
      return opts.hold ?? null;
    },
  } as unknown as RoomAssignmentService;

  const folioRepo = {
    openForStay: async (input: unknown) => {
      folios.push(input);
      return 'folio-1';
    },
  } as unknown as FolioRepository;

  const onboarding = {
    registerAndInvite: async (_stayId: string, card: unknown) => {
      cards.push(card);
      return null;
    },
  } as unknown as StayClaimService;

  const service = new FrontDeskService(
    repo,
    assignments,
    folioRepo,
    {} as FolioService,
    onboarding,
    // A walk-in has no booking, so nothing pre-arrival is carried onto the stay.
    { carryToStay: async () => undefined } as unknown as SelfCheckInService,
  );
  return { service, opened, holdQueries, folios, cards };
}

const walkIn = (over: Partial<WalkInRequest> = {}): WalkInRequest => ({
  roomId: ROOM_ID,
  guestName: '  Aline Uwase ',
  ...over,
});

describe('FrontDeskService.walkIn', () => {
  it('bills the rate agreed at the counter, opens a bill, and registers the guest', async () => {
    const { service, opened, folios, cards } = build({ defaultRate: 40_000 });
    const card = {
      documentType: 'national_id' as const,
      idNumber: '1199780012345678',
      phone: '+250 788 123 456',
      email: 'aline@example.com',
    };

    await service.walkIn(ws, walkIn({ nightlyRateRwf: 35_000, guest: card }));

    expect(opened[0]).toMatchObject({
      bookingId: null,
      guestName: 'Aline Uwase',
      priceRwf: 35_000,
    });
    expect(folios).toHaveLength(1);
    expect(cards).toEqual([card]);
  });

  it("falls back to the room type's default rate when none was typed", async () => {
    const { service, opened } = build({ defaultRate: 40_000 });

    await service.walkIn(ws, walkIn());

    expect(opened[0].priceRwf).toBe(40_000);
  });

  it('refuses a walk in with no rate at all, because nothing would ever bill the room', async () => {
    const { service, opened } = build({ defaultRate: null });

    await expect(service.walkIn(ws, walkIn())).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(opened).toHaveLength(0);
  });

  it('refuses a room held for a reservation arriving during the stay', async () => {
    const { service, opened } = build({
      defaultRate: 40_000,
      hold: { from: '2026-09-16' },
    });

    const attempt = service.walkIn(ws, walkIn());
    await expect(attempt).rejects.toBeInstanceOf(ConflictException);
    await expect(attempt).rejects.toThrow(
      'Room 101 is held for a reservation arriving 2026-09-16. Choose another room, or move that reservation first.',
    );
    expect(opened).toHaveLength(0);
  });

  it('asks about every night of a planned stay, and about tonight for an open ended one', async () => {
    const { service, holdQueries } = build({ defaultRate: 40_000 });
    const inThreeDays = new Date(Date.now() + 3 * 86_400_000);
    inThreeDays.setUTCHours(11, 0, 0, 0);

    await service.walkIn(ws, walkIn({ plannedExitAt: inThreeDays.toISOString() }));
    await service.walkIn(ws, walkIn());

    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(`${today}T00:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    expect(holdQueries[0]).toEqual({
      from: today,
      to: inThreeDays.toISOString().slice(0, 10),
    });
    expect(holdQueries[1]).toEqual({
      from: today,
      to: tomorrow.toISOString().slice(0, 10),
    });
  });

  it('refuses a departure that is already in the past', async () => {
    const { service, opened } = build({ defaultRate: 40_000 });

    await expect(
      service.walkIn(ws, walkIn({ plannedExitAt: '2020-01-01T11:00:00Z' })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(opened).toHaveLength(0);
  });
});
