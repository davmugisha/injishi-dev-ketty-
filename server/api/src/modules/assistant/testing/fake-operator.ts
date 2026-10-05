import type {
  OperatorPropertySummary,
  OperatorReservation,
  OperatorRoom,
  OperatorRoomAssignment,
  Permission,
  PublishBlocker,
} from '@injishi/contracts';
import { NotFoundException } from '@nestjs/common';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import type { OperatorReads } from '../application/operator-tools';

/**
 * One business with two branches (Musanze and Kigali), for tests only. The
 * reads filter by the branch scope they are handed, as the real services do,
 * so a test can prove the tools pass the caller's scope through.
 */
export const OPS_WORKSPACE = '90000000-0000-4000-8000-000000000001';
export const MUSANZE = '90000000-0000-4000-8000-00000000000a';
export const KIGALI = '90000000-0000-4000-8000-00000000000b';
const ROOM_204 = '90000000-0000-4000-8000-000000000204';
const ROOM_205 = '90000000-0000-4000-8000-000000000205';
const ROOM_K1 = '90000000-0000-4000-8000-0000000000c1';

const ROOM_PROPERTY: Record<string, string> = { [ROOM_204]: MUSANZE, [ROOM_205]: MUSANZE, [ROOM_K1]: KIGALI };

export function scoped(permissions: Permission[], branches: string[] | 'all' = 'all'): ScopedWorkspace {
  return {
    workspaceId: OPS_WORKSPACE,
    kind: 'business',
    orgId: '90000000-0000-4000-8000-0000000000ff',
    orgName: 'Volcano View Lodge Ltd',
    domain: 'hospitality',
    orgRole: 'receptionist',
    registrationStatus: 'active',
    permissions,
    branchScope: {
      coverage: branches === 'all' ? 'all' : 'limited',
      selectedPropertyId: null,
      propertyIds: branches === 'all' ? [MUSANZE, KIGALI] : branches,
      includesUnbranched: branches === 'all',
    },
  } as unknown as ScopedWorkspace;
}

const covers = (ws: ScopedWorkspace, propertyId: string): boolean => ws.branchScope.propertyIds.includes(propertyId);

function room(id: string, label: string): OperatorRoom {
  return {
    id,
    label,
    roomTypeId: '90000000-0000-4000-8000-0000000000aa',
    roomTypeName: 'Double room',
    status: 'available',
    housekeeping: 'clean',
    occupiedBy: id === ROOM_205 ? { stayId: '90000000-0000-4000-8000-0000000000dd', guestName: 'Aline Uwase' } : null,
  };
}

function reservation(reference: string, checkIn: string, checkOut: string, state: string, roomLabel: string): OperatorReservation {
  return {
    id: `90000000-0000-4000-8000-${reference.replace(/\D/g, '').padStart(12, '0')}`,
    reference,
    guestName: 'Jean Mugabo',
    checkIn,
    checkOut,
    nights: 2,
    guestCount: 2,
    state,
    bookingStatus: 'confirmed',
    room: roomLabel,
    roomTypeId: '90000000-0000-4000-8000-0000000000aa',
    totalRwf: 240000,
    approvalExpiresAt: null,
    confirmedAt: null,
  } as unknown as OperatorReservation;
}

const PROPERTIES: OperatorPropertySummary[] = [
  { id: MUSANZE, name: 'Volcano View Lodge', listingStatus: 'draft', archivedAt: null } as unknown as OperatorPropertySummary,
  { id: KIGALI, name: 'Volcano View Kigali', listingStatus: 'published', archivedAt: null } as unknown as OperatorPropertySummary,
];

const BLOCKERS: Record<string, PublishBlocker[]> = {
  [MUSANZE]: ['no_priced_room_type', 'no_photo'],
  [KIGALI]: [],
};

export const fakeOperatorReads: OperatorReads = {
  rooms: (ws) =>
    Promise.resolve(
      [room(ROOM_204, '204'), room(ROOM_205, '205'), room(ROOM_K1, 'K1')].filter((r) => covers(ws, ROOM_PROPERTY[r.id])),
    ),
  assignments: (ws, from, to) =>
    Promise.resolve(
      (
        [
          {
            id: '90000000-0000-4000-8000-0000000000e1',
            bookingId: '90000000-0000-4000-8000-0000000000b1',
            roomId: ROOM_204,
            roomLabel: '204',
            from: '2026-10-10',
            to: '2026-10-12',
            status: 'assigned',
            assignedByUserId: null,
            releasedAt: null,
          },
          {
            id: '90000000-0000-4000-8000-0000000000e2',
            bookingId: '90000000-0000-4000-8000-0000000000b2',
            roomId: ROOM_K1,
            roomLabel: 'K1',
            from: '2026-10-10',
            to: '2026-10-11',
            status: 'assigned',
            assignedByUserId: null,
            releasedAt: null,
          },
        ] as OperatorRoomAssignment[]
      ).filter((a) => a.from < to && a.to > from && covers(ws, ROOM_PROPERTY[a.roomId])),
    ),
  reservations: (ws) =>
    Promise.resolve(
      [
        reservation('BK-1001', '2026-10-10', '2026-10-12', 'arriving', '204'),
        reservation('BK-1002', '2026-10-15', '2026-10-17', 'pending_approval', '205'),
        reservation('BK-2001', '2026-10-10', '2026-10-11', 'arriving', 'K1'),
      ].filter((r) => (r.room === 'K1' ? covers(ws, KIGALI) : covers(ws, MUSANZE))),
    ),
  properties: (ws) => Promise.resolve(PROPERTIES.filter((p) => covers(ws, p.id))),
  publishBlockers: (ws, propertyId) =>
    Promise.resolve().then(() => {
      if (!covers(ws, propertyId)) throw new NotFoundException('Property not found.');
      return BLOCKERS[propertyId] ?? [];
    }),
};
