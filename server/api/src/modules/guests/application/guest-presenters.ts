import {
  type GuestOrigin,
  type GuestRouteState,
  type HostGuest,
  LEADER_ROLE_LABEL,
  type LeaderGuest,
  type LeaderRole,
  RWANDA_CODE,
  guestNights,
  guestPlaceKindLabel,
  guestPlaceTypeOf,
  guestStayOn,
} from '@injishi/contracts';

import { addressWords } from '../domain/guest-words';
import type { RegistrationRow, RouteRow } from '../infrastructure/guest-registry.repository';

/** Where one step stands. */
export function routeState(r: Pick<RouteRow, 'assignmentId' | 'seenAt'>): GuestRouteState {
  if (r.seenAt) return 'seen';
  return r.assignmentId ? 'delivered' : 'waiting';
}

function chainOrder(a: RouteRow, b: RouteRow): number {
  return a.step - b.step || a.role.localeCompare(b.role);
}

export function originOf(row: RegistrationRow): GuestOrigin {
  return row.originCountry === RWANDA_CODE && row.originVillageId
    ? { kind: 'village', villageId: row.originVillageId }
    : { kind: 'country', countryCode: row.originCountry };
}

/** Where a guest comes from in words: the village up to the district, or the country. */
export function originWords(row: RegistrationRow): string {
  if (row.originCountry === RWANDA_CODE) {
    const parts = [row.originVillageName, row.originCellName, row.originSectorName, row.originDistrictName].filter(Boolean);
    return parts.length ? parts.join(', ') : 'Rwanda';
  }
  return row.originCountryName;
}

/** A guest as their host reads it. Flags are the leaders' own and never shown here. */
export function presentHostGuest(row: RegistrationRow, routes: readonly RouteRow[], today: string): HostGuest {
  const mine = routes.filter((r) => r.registrationId === row.id).sort(chainOrder);
  const cancelled = row.status === 'cancelled';
  return {
    id: row.id,
    hostKind: row.hostKind,
    fullName: row.fullName,
    phone: row.phone ?? '',
    nationality: row.nationality,
    nationalityName: row.nationalityName,
    fromAbroad: row.nationality !== RWANDA_CODE,
    idKind: row.idKind,
    idNumber: row.idNumber,
    relationship: row.relationship,
    relationshipLabel: row.relationshipOther ?? row.relationshipLabel,
    relationshipOther: row.relationshipOther,
    origin: originOf(row),
    originWords: originWords(row),
    arrivalOn: row.arrivalOn,
    departureOn: row.departureOn,
    nights: guestNights(row.arrivalOn, row.departureOn),
    status: row.status,
    stay: cancelled ? null : guestStayOn(today, row.arrivalOn, row.departureOn),
    canChange: !cancelled && row.arrivalOn >= today,
    propertyId: row.propertyId,
    propertyName: row.propertyName,
    unitId: row.unitId,
    unitLabel: row.unitLabel,
    chain: mine.map((r) => ({ role: r.role, roleLabel: LEADER_ROLE_LABEL[r.role], step: r.step, state: routeState(r) })),
    createdAt: row.createdAt.toISOString(),
  };
}

/** A guest as a leader reads it: the host, the home down to the village, the chain with who opened and flagged it. */
export function presentLeaderGuest(
  row: RegistrationRow,
  routes: readonly RouteRow[],
  myRoles: readonly LeaderRole[],
  today: string,
): LeaderGuest {
  const mine = routes.filter((r) => r.registrationId === row.id).sort(chainOrder);
  return {
    id: row.id,
    fullName: row.fullName,
    nationality: row.nationality,
    nationalityName: row.nationalityName,
    fromAbroad: row.nationality !== RWANDA_CODE,
    idKind: row.idKind,
    idNumber: row.idNumber,
    phone: row.phone ?? '',
    relationshipLabel: row.relationshipOther ?? row.relationshipLabel,
    originWords: originWords(row),
    arrivalOn: row.arrivalOn,
    departureOn: row.departureOn,
    nights: guestNights(row.arrivalOn, row.departureOn),
    stay: guestStayOn(today, row.arrivalOn, row.departureOn),
    host: {
      kind: row.hostKind,
      name: row.hostName || (row.hostKind === 'tenant' ? 'The tenant' : row.hostKind === 'hotel' ? 'The property' : 'The landlord'),
      phone: row.hostPhone,
    },
    place: {
      type: guestPlaceTypeOf(row.hostKind, row.businessKind),
      kindLabel: guestPlaceKindLabel(row.hostKind, row.businessKind),
      name: row.propertyName,
      room: row.hostKind === 'hotel' ? (row.roomLabel ?? null) : row.unitLabel,
    },
    checkedInAt: row.checkedInAt?.toISOString() ?? null,
    home: {
      propertyName: row.propertyName,
      unitLabel: row.unitLabel,
      address: addressWords(row.addressText, row),
      villageName: row.villageName,
      cellName: row.cellName,
      villageId: row.villageId,
      cellId: row.cellId,
      sectorId: row.sectorId,
      districtId: row.districtId,
    },
    chain: mine.map((r) => ({
      role: r.role,
      roleLabel: LEADER_ROLE_LABEL[r.role],
      step: r.step,
      state: routeState(r),
      deliveredAt: r.deliveredAt?.toISOString() ?? null,
      seenAt: r.seenAt?.toISOString() ?? null,
      seenBy: r.seenAt ? (r.seenByName ?? 'A leader') : null,
      flag: r.flaggedAt && r.flagNote ? { note: r.flagNote, at: r.flaggedAt.toISOString(), by: r.flaggedByName } : null,
    })),
    seenByMe: mine.some((r) => myRoles.includes(r.role) && r.seenAt !== null),
    flagged: mine.some((r) => r.flaggedAt !== null),
    changedAt: row.changedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
