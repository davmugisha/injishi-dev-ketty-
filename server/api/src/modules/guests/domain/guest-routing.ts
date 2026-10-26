import {
  LEADER_ROLE_SCOPE,
  LEADER_ROLE_STEP,
  type LeaderLevel,
  type LeaderRole,
  type OversightGrant,
  RWANDA_CODE,
  guestChainFor,
  isFromAbroad,
  isLeaderRole,
} from '@injishi/contracts';

/**
 * Where a guest goes (P5): the chain, the area each step names, and which
 * leader posts cover a registration. Pure: the repository reads and writes,
 * these decide.
 */

/** A place down to the village; a null level is not known (yet). */
export interface Area {
  villageId: number | null;
  cellId: number | null;
  sectorId: number | null;
  districtId: number | null;
  /** The district's province: DGIE's province post is keyed on it. */
  provinceId?: number | null;
}

/** One step of a registration's chain, before a holder is looked up. */
export interface PlannedRoute {
  role: LeaderRole;
  step: number;
  area: Area;
}

/** A leader's post as the guest rules read it. */
export type LeaderGrant = Pick<
  OversightGrant,
  'assignmentId' | 'oversightRole' | 'districtId' | 'sectorId' | 'cellId' | 'villageId'
> & { oversightRole: LeaderRole; provinceId?: number | null };

/** What a scope decision needs to know about a registration. */
export interface GuestPlace extends Area {
  nationality: string;
}

/**
 * The area a step names: the role's own level and every level above it. The
 * village step of a home with no village on record keeps the sector and
 * district it does know, so admin can say where the guest is waiting.
 */
export function routeArea(role: LeaderRole, home: Area): Area {
  const provinceId = home.provinceId ?? null;
  switch (LEADER_ROLE_SCOPE[role]) {
    case 'village':
      return { villageId: home.villageId, cellId: home.cellId, sectorId: home.sectorId, districtId: home.districtId, provinceId };
    case 'cell':
      return { villageId: null, cellId: home.cellId, sectorId: home.sectorId, districtId: home.districtId, provinceId };
    case 'sector':
      return { villageId: null, cellId: null, sectorId: home.sectorId, districtId: home.districtId, provinceId };
    case 'district':
      return { villageId: null, cellId: null, sectorId: null, districtId: home.districtId, provinceId };
    // DGIE's province and headquarters posts keep the district too, so admin can say where a guest waits.
    case 'province':
    case 'country':
      return { villageId: null, cellId: null, sectorId: null, districtId: home.districtId, provinceId };
  }
}

/** The key that stands for the whole country: DGIE headquarters holds one post for every guest. */
export const COUNTRY_POST_KEY = 0;

/** The id a role's post is keyed on in an area, or null when the area is not known at that level. */
export function postKey(role: LeaderRole, area: Area): number | null {
  switch (LEADER_ROLE_SCOPE[role]) {
    case 'village':
      return area.villageId;
    case 'cell':
      return area.cellId;
    case 'sector':
      return area.sectorId;
    case 'district':
      return area.districtId;
    case 'province':
      return area.provinceId ?? null;
    case 'country':
      return COUNTRY_POST_KEY;
  }
}

/**
 * Every step a guest of this nationality goes to from this home, in order: the local government chain
 * for every guest, then DGIE's for a guest from abroad (`guestChainFor`).
 */
export function planRoutes(home: Area, nationality: string): PlannedRoute[] {
  return guestChainFor(isFromAbroad(nationality)).map((role) => ({
    role,
    step: LEADER_ROLE_STEP[role],
    area: routeArea(role, home),
  }));
}

/** The grants that are local leader posts. */
export function leaderGrants(grants: readonly OversightGrant[]): LeaderGrant[] {
  return grants.filter((g): g is OversightGrant & { oversightRole: LeaderRole } => isLeaderRole(g.oversightRole));
}

/**
 * Does one post cover a registration? Area first, then nationality: local government posts read every
 * guest in their area; DGIE's posts only guests from abroad.
 */
export function grantCovers(grant: LeaderGrant, guest: GuestPlace): boolean {
  const abroad = (guest.nationality ?? RWANDA_CODE) !== RWANDA_CODE;
  switch (grant.oversightRole) {
    case 'village_leader':
      return grant.villageId !== null && grant.villageId === guest.villageId;
    case 'dgie_village':
      return abroad && grant.villageId !== null && grant.villageId === guest.villageId;
    case 'dgie_cell':
      return abroad && grant.cellId !== null && grant.cellId === guest.cellId;
    case 'dasso':
    case 'sector_executive':
      return grant.sectorId !== null && grant.sectorId === guest.sectorId;
    case 'cell_executive':
      return grant.cellId !== null && grant.cellId === guest.cellId;
    case 'district_officer':
      return grant.districtId !== null && grant.districtId === guest.districtId;
    case 'district_immigration':
      return abroad && grant.districtId !== null && grant.districtId === guest.districtId;
    case 'dgie_province':
      return abroad && grant.provinceId !== null && grant.provinceId === (guest.provinceId ?? null);
    case 'dgie_national':
      return abroad;
  }
}

/** The posts of this leader that cover a registration. Empty means outside: a 404. */
export function grantsCovering(grants: readonly LeaderGrant[], guest: GuestPlace): LeaderGrant[] {
  return grants.filter((g) => grantCovers(g, guest));
}

/** The level a post covers, in the words a scope line uses. */
export function grantLevel(grant: LeaderGrant): LeaderLevel {
  return LEADER_ROLE_SCOPE[grant.oversightRole];
}

/**
 * The level a report breaks its area table down by: one below the widest post
 * the leader holds (a district by sector, a sector by cell, a cell by village);
 * a village leader's table is their village.
 */
export function reportAreaLevel(grants: readonly LeaderGrant[]): 'sector' | 'cell' | 'village' {
  const levels = grants.map(grantLevel);
  if (levels.includes('country') || levels.includes('province') || levels.includes('district')) return 'sector';
  if (levels.includes('sector')) return 'cell';
  return 'village';
}
