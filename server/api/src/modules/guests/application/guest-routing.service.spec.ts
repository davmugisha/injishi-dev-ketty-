import type { LeaderRole } from '@injishi/contracts';

import type { GuestMail } from '../domain/guest-mail';
import type { GuestNotifier } from '../infrastructure/guest-notifier';
import type { GuestRegistryRepository, Holder, RegistrationRow, RouteRow, WaitingRouteRow } from '../infrastructure/guest-registry.repository';
import { GuestRoutingService } from './guest-routing.service';

const NOW = new Date('2026-10-24T08:00:00Z');
const REG = '11111111-1111-4111-8111-111111111111';

class PinnedRouting extends GuestRoutingService {
  protected override now(): Date {
    return NOW;
  }
}

function holder(role: LeaderRole, email: string): Holder {
  return { assignmentId: `as-${role}-${email}`, userId: `u-${email}`, email, name: email.split('@')[0] ?? null };
}

function route(role: LeaderRole, over: Partial<RouteRow> = {}): RouteRow {
  return {
    id: `r-${role}`,
    registrationId: REG,
    role,
    step: 1,
    villageId: 1101,
    cellId: 110,
    sectorId: 11,
    districtId: 1,
    assignmentId: `as-${role}`,
    deliveredAt: NOW,
    notifiedAt: null,
    seenAt: null,
    seenByName: null,
    flaggedAt: null,
    flagNote: null,
    flaggedByName: null,
    ...over,
  };
}

type RepoMocks = Record<
  | 'holders' | 'find' | 'routesFor' | 'markNotified' | 'waitingRoutes' | 'currentWithRoles' | 'transaction' | 'relocate' | 'deliverWaiting'
  | 'handOverWaiting' | 'areaNames' | 'releaseEnded',
  jest.Mock
>;

function setup(posts: Partial<Record<LeaderRole, Holder[]>>): {
  repo: RepoMocks;
  notifier: { appUrl: string; send: jest.Mock };
  service: GuestRoutingService;
  sent: { to: string; mail: GuestMail; what: string }[];
} {
  const sent: { to: string; mail: GuestMail; what: string }[] = [];
  const repo: RepoMocks = {
    holders: jest.fn(async (role: LeaderRole, key: number | null) => (key === null ? [] : (posts[role] ?? []))),
    find: jest.fn(async () => ({
      id: REG,
      status: 'submitted',
      fullName: 'Grace Mutoni',
      nationality: 'KE',
      nationalityName: 'Kenya',
      arrivalOn: '2026-10-25',
      departureOn: '2026-10-30',
      hostKind: 'tenant',
      villageName: 'Urugwiro',
      cellName: 'Kamatamu',
      sectorName: 'Kacyiru',
      districtName: 'Gasabo',
    }) as unknown as RegistrationRow),
    routesFor: jest.fn(async () => [] as RouteRow[]),
    markNotified: jest.fn(async () => undefined),
    waitingRoutes: jest.fn(async () => [] as WaitingRouteRow[]),
    currentWithRoles: jest.fn(async () => []),
    transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn({})),
    relocate: jest.fn(async () => undefined),
    deliverWaiting: jest.fn(async (_tx: unknown, _id: string, _area: unknown, assignmentId: string | null) => assignmentId !== null),
    handOverWaiting: jest.fn(async () => [REG]),
    areaNames: jest.fn(async () => ({ villageName: 'Urugwiro', cellName: 'Kamatamu', sectorName: 'Kacyiru', districtName: 'Gasabo' })),
    releaseEnded: jest.fn(async () => 2),
  };
  const notifier = {
    appUrl: 'http://localhost:3002',
    send: jest.fn(async (to: string, mail: GuestMail, what: string) => {
      sent.push({ to, mail, what });
      return true;
    }),
  };
  const service = new PinnedRouting(repo as unknown as GuestRegistryRepository, notifier as unknown as GuestNotifier);
  return { repo, notifier, service, sent };
}

describe('GuestRoutingService', () => {
  it('delivers each step to the longest serving holder, and leaves a step with nobody waiting', async () => {
    const { service } = setup({
      village_leader: [holder('village_leader', 'mudugudu@x.rw'), holder('village_leader', 'second@x.rw')],
      cell_executive: [holder('cell_executive', 'cell@x.rw')],
    });
    const steps = await service.plan({ villageId: 1101, cellId: 110, sectorId: 11, districtId: 1 }, 'RW');
    expect(steps.map((s) => [s.role, s.assignmentId])).toEqual([
      ['village_leader', 'as-village_leader-mudugudu@x.rw'],
      ['cell_executive', 'as-cell_executive-cell@x.rw'],
      ['district_officer', null],
    ]);
  });

  it('routes a guest from abroad to the district officer and up DGIE', async () => {
    const { service } = setup({ district_officer: [holder('district_officer', 'do@x.rw')], district_immigration: [holder('district_immigration', 'dgie@x.rw')] });
    const steps = await service.plan({ villageId: 1101, cellId: 110, sectorId: 11, districtId: 1 }, 'UG');
    // Local government reads every guest; DGIE's chain follows for a guest from abroad.
    expect(steps.find((s) => s.role === 'district_immigration')).toMatchObject({ assignmentId: 'as-district_immigration-dgie@x.rw' });
    expect(steps.find((s) => s.role === 'district_officer')).toMatchObject({ assignmentId: 'as-district_officer-do@x.rw' });
    expect(steps.map((s) => s.role).slice(-3)).toEqual(['dgie_village', 'dgie_cell', 'district_immigration']);
  });

  it('emails each leader of a delivered step once per registration, never for a waiting step', async () => {
    const { service, repo, sent } = setup({
      village_leader: [holder('village_leader', 'same@x.rw')],
      dasso: [holder('dasso', 'same@x.rw'), holder('dasso', 'dasso@x.rw')],
    });
    repo.routesFor.mockResolvedValue([route('village_leader'), route('dasso', { step: 2 }), route('cell_executive', { assignmentId: null, deliveredAt: null })]);
    const told = await service.notify(REG, false);
    expect(told).toBe(2);
    expect(sent.map((s) => s.to)).toEqual(['same@x.rw', 'dasso@x.rw']);
    expect(sent[0]?.mail.subject).toBe('New guest in your area: Grace Mutoni');
    // No ID number and no phone in a mail.
    expect(sent[0]?.mail.text).not.toMatch(/\+250|passport|\d{16}/i);
    expect(sent[0]?.mail.text).toContain('from Kenya');
    expect(repo.markNotified).toHaveBeenCalledWith(['r-village_leader', 'r-dasso'], NOW);
  });

  it('hands waiting guests to a newly appointed post and sends the leader one summary', async () => {
    const { service, repo, sent } = setup({});
    const ids = await service.handOverOnAppointment({} as never, { assignmentId: 'new', role: 'cell_executive', area: { villageId: null, cellId: 110, sectorId: 11, districtId: 1 } });
    expect(repo.handOverWaiting).toHaveBeenCalledWith({}, 'cell_executive', 110, 'new', '2026-10-24', NOW);
    await service.tellHandOver({ email: 'cell@x.rw', role: 'cell_executive', area: { villageId: null, cellId: 110, sectorId: 11, districtId: 1 } }, ids);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.mail.subject).toBe('One guest waiting for you in Urugwiro village, Kamatamu cell, Kacyiru sector, Gasabo');
  });

  it('does not hand over a post whose own place is not known', async () => {
    const { service, repo } = setup({});
    expect(await service.handOverOnAppointment({} as never, { assignmentId: 'x', role: 'village_leader', area: { villageId: null, cellId: null, sectorId: 11, districtId: 1 } })).toEqual([]);
    expect(repo.handOverWaiting).not.toHaveBeenCalled();
  });

  it('when a building gets its village, moves current guests there and delivers the waiting steps', async () => {
    const { service, repo, sent } = setup({ village_leader: [holder('village_leader', 'mudugudu@x.rw')] });
    const unplaced = { villageId: null, cellId: null, sectorId: 11, districtId: 1 };
    const placed = { villageId: 1101, cellId: 110, sectorId: 11, districtId: 1 };
    repo.waitingRoutes.mockResolvedValue([
      { routeId: 'rv', registrationId: REG, role: 'village_leader', propertyId: 'p1', current: placed, stored: unplaced },
      { routeId: 'rc', registrationId: REG, role: 'cell_executive', propertyId: 'p1', current: placed, stored: unplaced },
    ]);
    repo.routesFor.mockResolvedValue([route('village_leader', { id: 'rv' })]);
    const outcome = await service.sweep('p1');
    expect(outcome).toEqual({ relocated: 1, delivered: 1 });
    expect(repo.relocate).toHaveBeenCalledTimes(1);
    expect(repo.relocate).toHaveBeenCalledWith({}, REG, placed, NOW);
    expect(repo.deliverWaiting).toHaveBeenCalledWith({}, 'rv', { ...placed, provinceId: null }, 'as-village_leader-mudugudu@x.rw', NOW);
    // The cell step gets its area and still waits: nobody holds that post.
    expect(repo.deliverWaiting).toHaveBeenCalledWith({}, 'rc', { villageId: null, cellId: 110, sectorId: 11, districtId: 1, provinceId: null }, null, NOW);
    expect(sent.map((s) => s.to)).toEqual(['mudugudu@x.rw']);
  });

  it('leaves a waiting step alone when nothing changed and nobody holds the post', async () => {
    const { service, repo } = setup({});
    const area = { villageId: 1101, cellId: 110, sectorId: 11, districtId: 1 };
    repo.waitingRoutes.mockResolvedValue([{ routeId: 'rv', registrationId: REG, role: 'village_leader', propertyId: 'p1', current: area, stored: area }]);
    expect(await service.sweep()).toEqual({ relocated: 0, delivered: 0 });
    expect(repo.transaction).not.toHaveBeenCalled();
  });

  it('never throws when the mail fails', async () => {
    const { service, repo } = setup({});
    repo.find.mockRejectedValue(new Error('db down'));
    await expect(service.notify(REG, true)).resolves.toBe(0);
  });
});
