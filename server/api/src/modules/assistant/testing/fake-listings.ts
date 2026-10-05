import type { GuestTrip, PropertyCard, PropertyDetail, RoomAvailability, WorkspaceAccess } from '@injishi/contracts';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import type { AssistantReads } from '../application/assistant-tools';
import type { ListingReads } from '../application/listing-tools';
import { defaultProposals, defaultRoomTypes, fakeActionReads } from './fake-actions';
import { fakeOperatorReads } from './fake-operator';

/**
 * A small published catalogue with the services' contract, for tests only:
 * two properties in Musanze and one in Kigali, one room type each, and a
 * sold out night on 2026-10-11 at the lodge.
 */
export const LODGE_ID = '11111111-1111-4111-8111-111111111111';
export const GUESTHOUSE_ID = '22222222-2222-4222-8222-222222222222';
export const KIGALI_ID = '33333333-3333-4333-8333-333333333333';
export const LODGE_ROOM = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function card(id: string, slug: string, name: string, district: string, rate: number, guests: number): PropertyCard {
  return {
    id,
    slug,
    name,
    description: `${name}, a place to stay in ${district}. Call 0788123456.`,
    districtName: district,
    photos: [],
    fromNightlyRateRwf: rate,
    maxGuests: guests,
    roomTypeCount: 1,
  };
}

export const CATALOGUE: PropertyCard[] = [
  card(LODGE_ID, 'volcano-view-lodge', 'Volcano View Lodge', 'Musanze', 120000, 4),
  card(GUESTHOUSE_ID, 'twin-lakes-guesthouse', 'Twin Lakes Guesthouse', 'Musanze', 45000, 2),
  card(KIGALI_ID, 'city-hill-hotel', 'City Hill Hotel', 'Gasabo', 80000, 3),
];

export function detailOf(id: string): PropertyDetail {
  const c = CATALOGUE.find((p) => p.id === id);
  if (!c) throw new NotFoundException('That property is not published.');
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    districtName: c.districtName,
    latitude: -1.5,
    longitude: 29.6,
    locationPrivacy: true,
    checkInTime: '14:00',
    checkOutTime: '11:00',
    houseRules: 'No smoking indoors.',
    photos: [],
    roomTypes: [
      {
        id: id === LODGE_ID ? LODGE_ROOM : `${id.slice(0, 35)}9`,
        name: 'Double room',
        domain: 'hospitality',
        capacity: 2,
        roomCount: 3,
        nightlyRateRwf: c.fromNightlyRateRwf,
        bookingMode: 'instant_book',
        approvalPolicy: null,
        cancellationTier: 'flexible',
        nonrefundableEligible: false,
        minStay: 1,
      },
    ],
    facilities: [
      { key: 'wifi', amenity: { code: 'wifi', label: 'Wi-Fi', category: null }, outlet: null },
    ],
  };
}

export const fakeListingReads: ListingReads = {
  listPublished: () => Promise.resolve(structuredClone(CATALOGUE)),
  getById: (id) => Promise.resolve().then(() => detailOf(id)),
  getBySlug: (slug) =>
    Promise.resolve().then(() => {
      const c = CATALOGUE.find((p) => p.slug === slug);
      if (!c) throw new NotFoundException('That property is not published.');
      return detailOf(c.id);
    }),
  availability: (roomTypeId, from, to): Promise<RoomAvailability> =>
    Promise.resolve().then(() => {
      if (roomTypeId !== LODGE_ROOM) throw new NotFoundException('That room is no longer offered.');
      if (to <= from) throw new BadRequestException('to must be after from.');
      const nights: RoomAvailability['nights'] = [];
      for (let d = new Date(`${from}T00:00:00Z`); d.toISOString().slice(0, 10) < to; d.setUTCDate(d.getUTCDate() + 1)) {
        const night = d.toISOString().slice(0, 10);
        nights.push({ night, freeUnits: night === '2026-10-11' ? 0 : 2 });
      }
      return { roomTypeId, roomCount: 3, minStay: 1, nights };
    }),
};

// Two guests with their own trips, and one business membership, so tests can
// prove a caller only ever reaches their own records.
export const GUEST_A = 'a0000000-0000-4000-8000-00000000000a';
export const GUEST_B = 'b0000000-0000-4000-8000-00000000000b';
export const BUSINESS_WORKSPACE = 'c0000000-0000-4000-8000-00000000000c';

function trip(id: string, reference: string, stage: GuestTrip['stage'], checkIn: string, propertyName: string): GuestTrip {
  return {
    id,
    reference,
    status: 'confirmed',
    paymentStatus: 'captured',
    stage,
    checkIn,
    checkOut: `${checkIn.slice(0, 8)}${String(Number(checkIn.slice(8)) + 2).padStart(2, '0')}`,
    nights: 2,
    guests: 2,
    propertyName,
    propertySlug: null,
    districtName: 'Musanze',
    roomTypeName: 'Double room',
    timezone: 'Africa/Kigali',
    grossRwf: 240000,
    nonRefundable: false,
    cancellationTier: 'flexible',
    bookedAt: '2026-09-01T08:00:00+02:00',
  } as GuestTrip;
}

export const TRIPS: Record<string, GuestTrip[]> = {
  [GUEST_A]: [
    trip('d0000000-0000-4000-8000-000000000001', 'BK-PAST01', 'past', '2026-08-10', 'Twin Lakes Guesthouse'),
    trip('d0000000-0000-4000-8000-000000000002', 'BK-NEXT02', 'upcoming', '2026-10-10', 'Volcano View Lodge'),
  ],
  [GUEST_B]: [trip('d0000000-0000-4000-8000-000000000003', 'BK-OTHER3', 'upcoming', '2026-10-20', 'City Hill Hotel')],
};

export const ACCESS: Record<string, WorkspaceAccess[]> = {
  [GUEST_A]: [
    { workspaceId: 'e0000000-0000-4000-8000-00000000000e', kind: 'personal', orgId: null, orgName: null, domain: null, orgRole: null, registrationStatus: null, permissions: [] } as unknown as WorkspaceAccess,
    {
      workspaceId: BUSINESS_WORKSPACE,
      kind: 'business',
      orgId: 'f0000000-0000-4000-8000-00000000000f',
      orgName: 'Volcano View Lodge Ltd',
      domain: 'hospitality',
      orgRole: 'receptionist',
      registrationStatus: 'active',
      permissions: ['stay.checkin', 'reservation.assign'],
    } as unknown as WorkspaceAccess,
  ],
};

export const fakeReads: AssistantReads = {
  ...fakeListingReads,
  ...fakeOperatorReads,
  ...fakeActionReads(defaultProposals, defaultRoomTypes),
  trips: (userId) => Promise.resolve({ trips: structuredClone(TRIPS[userId] ?? []) }),
  access: (userId) => Promise.resolve(structuredClone(ACCESS[userId] ?? [])),
};
