import { type OversightGrant } from '@injishi/contracts';

import { type LeaderGrant, grantCovers, grantsCovering, leaderGrants, planRoutes, postKey, reportAreaLevel, routeArea } from './guest-routing';

const HOME = { villageId: 1101, cellId: 110, sectorId: 11, districtId: 1 };

function post(role: LeaderGrant['oversightRole'], area: Partial<LeaderGrant> = {}): LeaderGrant {
  return {
    assignmentId: `a-${role}`,
    oversightRole: role,
    districtId: 1,
    sectorId: null,
    cellId: null,
    villageId: null,
    ...area,
  };
}

describe('guest routing: the chain', () => {
  it('sends a Rwandan guest to the village leader, DASSO, cell executive and the district officer', () => {
    const routes = planRoutes(HOME, 'RW');
    expect(routes.map((r) => [r.role, r.step])).toEqual([
      ['village_leader', 1],
      ['dasso', 2],
      ['cell_executive', 3],
      ['district_officer', 4],
    ]);
  });

  it('sends a guest from abroad to the district immigration officer instead of the district officer', () => {
    const routes = planRoutes(HOME, 'KE');
    expect(routes.map((r) => r.role)).toEqual(['village_leader', 'dasso', 'cell_executive', 'district_immigration']);
    expect(routes.find((r) => r.role === 'district_immigration')?.step).toBe(4);
  });

  it('names each step at its own level, with the levels above it', () => {
    expect(routeArea('village_leader', HOME)).toEqual(HOME);
    expect(routeArea('cell_executive', HOME)).toEqual({ villageId: null, cellId: 110, sectorId: 11, districtId: 1 });
    expect(routeArea('dasso', HOME)).toEqual({ villageId: null, cellId: null, sectorId: 11, districtId: 1 });
    expect(routeArea('district_officer', HOME)).toEqual({ villageId: null, cellId: null, sectorId: null, districtId: 1 });
  });

  it('a home with no village on record: the village and cell steps have no post to go to (they wait)', () => {
    const noVillage = { villageId: null, cellId: null, sectorId: 11, districtId: 1 };
    const [village, dasso, cell, district] = planRoutes(noVillage, 'RW');
    expect(postKey(village!.role, village!.area)).toBeNull();
    expect(postKey(cell!.role, cell!.area)).toBeNull();
    expect(postKey(dasso!.role, dasso!.area)).toBe(11);
    expect(postKey(district!.role, district!.area)).toBe(1);
    // The village step keeps what is known, so admin can say where it waits.
    expect(village!.area).toEqual({ villageId: null, cellId: null, sectorId: 11, districtId: 1 });
  });
});

describe('guest routing: who covers a guest', () => {
  const rwandan = { ...HOME, nationality: 'RW' };
  const kenyan = { ...HOME, nationality: 'KE' };

  it('a village leader covers their village only', () => {
    expect(grantCovers(post('village_leader', { villageId: 1101, cellId: 110, sectorId: 11 }), rwandan)).toBe(true);
    expect(grantCovers(post('village_leader', { villageId: 1102, cellId: 110, sectorId: 11 }), rwandan)).toBe(false);
  });

  it('a DASSO covers the sector and a cell executive the cell', () => {
    expect(grantCovers(post('dasso', { sectorId: 11 }), kenyan)).toBe(true);
    expect(grantCovers(post('dasso', { sectorId: 12 }), kenyan)).toBe(false);
    expect(grantCovers(post('cell_executive', { sectorId: 11, cellId: 110 }), rwandan)).toBe(true);
    expect(grantCovers(post('cell_executive', { sectorId: 11, cellId: 111 }), rwandan)).toBe(false);
  });

  it('the district officer reads Rwandan guests, immigration only guests from abroad', () => {
    expect(grantCovers(post('district_officer'), rwandan)).toBe(true);
    expect(grantCovers(post('district_officer'), kenyan)).toBe(false);
    expect(grantCovers(post('district_immigration'), kenyan)).toBe(true);
    expect(grantCovers(post('district_immigration'), rwandan)).toBe(false);
    expect(grantCovers(post('district_immigration', { districtId: 2 }), kenyan)).toBe(false);
  });

  it('a guest with no village on record is outside every village leader', () => {
    const unplaced = { villageId: null, cellId: null, sectorId: 11, districtId: 1, nationality: 'RW' };
    expect(grantCovers(post('village_leader', { villageId: 1101 }), unplaced)).toBe(false);
    expect(grantCovers(post('dasso', { sectorId: 11 }), unplaced)).toBe(true);
  });

  it('keeps only the leader posts of a person who also reviews businesses', () => {
    const grants = [
      { assignmentId: 'r', oversightRole: 'business_approver', governmentBodyCode: 'MINALOC', governmentTitle: null, scopeLevel: 'district', provinceId: 1, districtId: 1, sectorId: null, cellId: null, villageId: null },
      { assignmentId: 'v', oversightRole: 'village_leader', governmentBodyCode: 'MINALOC', governmentTitle: null, scopeLevel: 'village', provinceId: null, districtId: 1, sectorId: 11, cellId: 110, villageId: 1101 },
    ] as OversightGrant[];
    const posts = leaderGrants(grants);
    expect(posts.map((p) => p.oversightRole)).toEqual(['village_leader']);
    expect(grantsCovering(posts, rwandan)).toHaveLength(1);
  });

  it('breaks a report down one level below the widest post', () => {
    expect(reportAreaLevel([post('district_officer')])).toBe('sector');
    expect(reportAreaLevel([post('dasso', { sectorId: 11 })])).toBe('cell');
    expect(reportAreaLevel([post('cell_executive', { cellId: 110 })])).toBe('village');
    expect(reportAreaLevel([post('village_leader', { villageId: 1101 }), post('dasso', { sectorId: 11 })])).toBe('cell');
  });
});
