import { BadRequestException, ConflictException } from '@nestjs/common';
import { addDays, type LeaseStatus } from '@injishi/contracts';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import type { LeaseChargesRepository } from '../infrastructure/lease-charges.repository';
import type { LeaseRecord, LeaseRow, LeasesRepository } from '../infrastructure/leases.repository';
import type { DepositRow, MoveOutLeaseRow, MoveOutsRepository, NoticeRow } from '../infrastructure/move-outs.repository';
import type { RentalsContextRepository } from '../infrastructure/rentals-context.repository';
import type { LeaseEventsWriter, RentalsAuditWriter } from '../infrastructure/rentals-writers';
import type { RentalsMailer } from '../infrastructure/rentals.mailer';
import type { SigningRepository } from '../infrastructure/signing.repository';
import type { LeaseReadsService } from './lease-reads.service';
import { MoveOutsService } from './move-outs.service';
import type { TenancyRef } from './tenancies.service';

/**
 * Moving out (WP 1.7), with every collaborator doubled.
 *
 * Pinned here: a tenant's notice names a day at least the lease's notice days
 * from today in Kigali (14 days is refused, 15 is taken) and no later than the
 * lease's last day; a lease ending inside its notice period needs none; a
 * second notice is refused; the tenant withdraws until the landlord
 * acknowledges and not after; acknowledging moves an active lease to ending
 * and emails the tenant; the moved-out day is today or earlier and not before
 * the start; moving out ends the lease, waives rent for later periods, lets an
 * unpaid deposit go, and owes the district word within 30 days; the list puts
 * each lease under its tab with counts; the 3-day nudge goes once.
 */
const WS = '11111111-1111-4111-8111-111111111111';
const ORG = '22222222-2222-4222-8222-222222222222';
const PROPERTY = '33333333-3333-4333-8333-333333333333';
const LEASE = '66666666-6666-4666-8666-666666666666';
const USER = '77777777-7777-4777-8777-777777777777';
const TENANT_USER = '88888888-8888-4888-8888-888888888888';

const TODAY = '2026-10-26';

const ws = {
  workspaceId: WS,
  kind: 'business',
  orgId: ORG,
  domain: 'residence',
  orgRole: 'owner',
  permissions: ['lease.manage', 'deposit.return'],
  branchScope: { coverage: 'all', selectedPropertyId: null, propertyIds: [PROPERTY], includesUnbranched: true },
} as unknown as ScopedWorkspace;

const tenancy: TenancyRef = { leaseId: LEASE, tenantId: 'tenant', userId: TENANT_USER, workspaceId: WS };

const leaseRow = (over: Partial<LeaseRow> = {}): LeaseRow =>
  ({
    id: LEASE,
    orgId: ORG,
    workspaceId: WS,
    reference: 'L-0004',
    propertyId: PROPERTY,
    status: 'active' as LeaseStatus,
    startDate: '2026-06-01',
    endDate: '2027-05-31',
    noticeDays: 15,
    endedOn: null,
    ...over,
  }) as LeaseRow;

const notice = (over: Partial<NoticeRow> = {}): NoticeRow =>
  ({
    id: 'notice-1',
    leaseId: LEASE,
    filedByRole: 'tenant',
    filedByUserId: TENANT_USER,
    channel: 'app',
    filedOn: TODAY,
    moveOutOn: addDays(TODAY, 20),
    reasonCode: 'leaving_kigali',
    message: null,
    noticeDays: 20,
    isShortNotice: false,
    status: 'submitted',
    acknowledgedAt: null,
    acknowledgedByUserId: null,
    withdrawnAt: null,
    filedAt: new Date('2026-10-26T08:00:00Z'),
    nudgedAt: null,
    ...over,
  }) as NoticeRow;

const deposit = (over: Partial<DepositRow> = {}): DepositRow =>
  ({
    id: 'deposit-1',
    leaseId: LEASE,
    workspaceId: WS,
    agreedRwf: 200_000,
    chargeId: 'charge-d',
    status: 'held',
    keptRwf: null,
    refundedRwf: null,
    deductions: [],
    refundMethod: null,
    refundPayoutId: null,
    refundReference: null,
    settledAt: null,
    settledByUserId: null,
    tenantDisputedAt: null,
    disputeNote: null,
    idempotencyKey: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    paidRwf: 200_000,
    chargeStatus: 'paid',
    payoutStatus: null,
    payoutDestination: null,
    payoutFailureReason: null,
    payoutAdapterRef: null,
    payoutCreatedAt: null,
    ...over,
  }) as DepositRow;

interface Opts {
  lease?: LeaseRow;
  notice?: NoticeRow | null;
  deposit?: DepositRow | null;
  waived?: { id: string; periodStart: string; amountRwf: number }[];
  list?: MoveOutLeaseRow[];
  notices?: Map<string, NoticeRow>;
  deposits?: Map<string, DepositRow>;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function harness(opts: Opts = {}) {
  const calls: Record<string, unknown[][]> = {};
  const record = (name: string) => (...args: unknown[]) => {
    (calls[name] ??= []).push(args);
  };
  let lease = opts.lease ?? leaseRow();
  let live: NoticeRow | null = opts.notice === undefined ? null : opts.notice;
  const leaseRecord = (): LeaseRecord =>
    ({
      lease,
      tenant: { id: 'tenant', userId: TENANT_USER, fullName: 'Aimée Uwera', email: 'aimee@example.rw' },
      unitLabel: 'B-03',
      propertyName: 'Amani Residences',
    }) as unknown as LeaseRecord;
  const db = { transaction: async <T>(cb: (t: unknown) => Promise<T>): Promise<T> => cb({}) };
  const leases = {
    find: jest.fn(async () => leaseRecord()),
    lock: jest.fn(async () => lease),
    update: jest.fn(async (_tx: unknown, id: string, values: Partial<LeaseRow>) => {
      record('updateLease')(id, values);
      lease = { ...lease, ...values };
    }),
  };
  const moveOuts = {
    liveNotice: jest.fn(async () => live),
    insertNotice: jest.fn(async (_tx: unknown, v: Partial<NoticeRow>) => {
      record('insertNotice')(v);
      live = notice({ ...v, id: 'notice-new', status: 'submitted' });
      return live;
    }),
    acknowledge: jest.fn(async (_tx: unknown, id: string) => {
      record('acknowledge')(id);
      if (live) live = { ...live, status: 'acknowledged', acknowledgedAt: new Date() };
    }),
    withdraw: jest.fn(async (_tx: unknown, id: string) => {
      record('withdraw')(id);
      live = null;
    }),
    depositOfLease: jest.fn(async () => (opts.deposit === undefined ? deposit() : opts.deposit)),
    waiveRentAfter: jest.fn(async (_tx: unknown, id: string, day: string, reason: string) => {
      record('waive')(id, day, reason);
      return opts.waived ?? [];
    }),
    openTerminationFiling: jest.fn(async (_tx: unknown, id: string, dueOn: string) => (record('filing')(id, dueOn), 'filing-1')),
    moveOutLeases: jest.fn(async () => opts.list ?? []),
    liveNotices: jest.fn(async () => opts.notices ?? new Map()),
    depositsOfLeases: jest.fn(async () => opts.deposits ?? new Map()),
    staleNotices: jest.fn(async (filedBy: string) => (record('stale')(filedBy), [
      { noticeId: 'n1', leaseId: LEASE, workspaceId: WS, orgId: ORG, reference: 'L-0004', tenantName: 'Aimée', unitLabel: 'B-03', propertyName: 'Amani', filedOn: '2026-10-20', moveOutOn: '2026-11-20' },
    ])),
    claimNudge: jest.fn(async () => true),
  };
  const charges = { voidUnpaidDeposit: jest.fn(async () => 'none' as const) };
  const context = {
    org: jest.fn(async () => ({ legalName: 'Amani Residences' })),
    ensureProfile: jest.fn(async () => ({ contactEmail: 'amani@example.rw' })),
    ownerContact: jest.fn(async () => null),
  };
  const signing = { accountEmail: jest.fn(async () => 'aimee@example.rw') };
  const events = { write: jest.fn(async (_tx: unknown, e: { kind: string }) => record('event')(e)) };
  const audit = { write: jest.fn(async (_tx: unknown, e: { eventType: string }) => record('audit')(e)) };
  const reads = { detail: jest.fn(async () => ({ id: LEASE, status: lease.status }) as never) };
  const mailer = {
    appUrl: 'http://localhost:3002',
    send: jest.fn(async (_ref: string, to: string, mail: { subject: string; lines: string[] }) => (record('mail')(to, mail), true)),
  };
  class Pinned extends MoveOutsService {
    protected override today(): string {
      return TODAY;
    }
  }
  const service = new Pinned(
    db as never,
    leases as unknown as LeasesRepository,
    moveOuts as unknown as MoveOutsRepository,
    charges as unknown as LeaseChargesRepository,
    context as unknown as RentalsContextRepository,
    signing as unknown as SigningRepository,
    events as unknown as LeaseEventsWriter,
    audit as unknown as RentalsAuditWriter,
    reads as unknown as LeaseReadsService,
    mailer as unknown as RentalsMailer,
  );
  const kinds = (): string[] => (calls.event ?? []).map((c) => (c[0] as { kind: string }).kind);
  return { service, calls, kinds, moveOuts, charges, lease: () => lease };
}

const flush = (): Promise<void> => new Promise((r) => setImmediate(r));

async function problemOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof BadRequestException || e instanceof ConflictException) {
      const body = e.getResponse() as { message?: string };
      return String(body.message);
    }
    throw e;
  }
  return 'no error';
}

describe('MoveOutsService: the tenant gives notice', () => {
  it('refuses a day 14 days away and takes one 15 days away', async () => {
    const h = harness();
    expect(await problemOf(h.service.giveNotice(tenancy, { moveOutOn: addDays(TODAY, 14), reasonCode: 'leaving_kigali' }))).toBe(
      'Pick a date at least 15 days away.',
    );
    const view = await h.service.giveNotice(tenancy, { moveOutOn: addDays(TODAY, 15), reasonCode: 'leaving_kigali', message: 'New job in Musanze' });
    expect(h.calls.insertNotice![0]![0]).toMatchObject({
      filedByRole: 'tenant',
      channel: 'app',
      filedOn: TODAY,
      moveOutOn: addDays(TODAY, 15),
      noticeDays: 15,
      isShortNotice: false,
      message: 'New job in Musanze',
    });
    expect(h.kinds()).toEqual(['notice_filed']);
    expect(view.stage).toBe('submitted');
    expect(view.canWithdraw).toBe(true);
    await flush();
    const mail = h.calls.mail![0]![1] as { subject: string; lines: string[] };
    expect(h.calls.mail![0]![0]).toBe('amani@example.rw');
    expect(mail.subject).toBe('Aimée Uwera gave notice to move out');
    expect(mail.lines.join(' ')).not.toMatch(/—/);
  });

  it('honours a lease that asks for more notice than 15 days', async () => {
    const h = harness({ lease: leaseRow({ noticeDays: 30 }) });
    expect(await problemOf(h.service.giveNotice(tenancy, { moveOutOn: addDays(TODAY, 29), reasonCode: 'cost' }))).toBe('Pick a date at least 30 days away.');
  });

  it("takes the lease's last day and refuses the day after", async () => {
    const h = harness();
    expect(await problemOf(h.service.giveNotice(tenancy, { moveOutOn: '2027-06-01', reasonCode: 'cost' }))).toBe("Pick the lease's last day or earlier.");
    await h.service.giveNotice(tenancy, { moveOutOn: '2027-05-31', reasonCode: 'cost' });
    expect(h.calls.insertNotice).toHaveLength(1);
  });

  it('needs no notice when the lease ends inside its notice period', async () => {
    const h = harness({ lease: leaseRow({ status: 'ending', endDate: addDays(TODAY, 10) }) });
    const view = await h.service.tenantView(tenancy);
    expect(view).toMatchObject({ noticeNotNeeded: true, canGiveNotice: false, window: null });
    expect(await problemOf(h.service.giveNotice(tenancy, { moveOutOn: addDays(TODAY, 10), reasonCode: 'cost' }))).toMatch(/No notice is needed/);
  });

  it('offers the window from the notice days to the last day', async () => {
    const h = harness();
    const view = await h.service.tenantView(tenancy);
    expect(view.window).toEqual({ min: addDays(TODAY, 15), max: '2027-05-31' });
  });

  it('refuses a second notice and a lease that is not running', async () => {
    expect(await problemOf(harness({ notice: notice() }).service.giveNotice(tenancy, { moveOutOn: addDays(TODAY, 20), reasonCode: 'cost' }))).toBe(
      'There is already a notice on this lease.',
    );
    expect(
      await problemOf(harness({ lease: leaseRow({ status: 'signed' }) }).service.giveNotice(tenancy, { moveOutOn: addDays(TODAY, 20), reasonCode: 'cost' })),
    ).toMatch(/Notice can only be given while the tenancy is running/);
  });
});

describe('MoveOutsService: withdrawing a notice', () => {
  it('withdraws a notice that is not acknowledged yet and tells the landlord', async () => {
    const h = harness({ notice: notice() });
    const view = await h.service.withdrawNotice(tenancy);
    expect(h.calls.withdraw![0]).toEqual(['notice-1']);
    expect(h.kinds()).toEqual(['notice_withdrawn']);
    expect(view.notice).toBeNull();
    expect(view.canGiveNotice).toBe(true);
    await flush();
    expect((h.calls.mail![0]![1] as { subject: string }).subject).toBe('Aimée Uwera withdrew their notice');
  });

  it('refuses once the landlord acknowledged it', async () => {
    const h = harness({ notice: notice({ status: 'acknowledged', acknowledgedAt: new Date() }) });
    expect(await problemOf(h.service.withdrawNotice(tenancy))).toMatch(/already acknowledged/);
    expect(h.calls.withdraw).toBeUndefined();
  });
});

describe('MoveOutsService: the landlord acknowledges and records the move out', () => {
  it('acknowledging moves an active lease to ending and emails the tenant', async () => {
    const h = harness({ notice: notice() });
    await h.service.acknowledge(ws, USER, LEASE);
    expect(h.calls.acknowledge![0]).toEqual(['notice-1']);
    expect(h.calls.updateLease![0]).toEqual([LEASE, { status: 'ending', endingSince: expect.any(Date) }]);
    expect(h.kinds()).toEqual(['notice_acknowledged', 'ending']);
    await flush();
    const mail = h.calls.mail![0]![1] as { subject: string; lines: string[] };
    expect(h.calls.mail![0]![0]).toBe('aimee@example.rw');
    expect(mail.subject).toBe('Your notice was acknowledged');
    expect(mail.lines.join(' ')).toContain('RWF 200,000');
  });

  it('a second acknowledgement changes nothing', async () => {
    const h = harness({ notice: notice({ status: 'acknowledged', acknowledgedAt: new Date() }), lease: leaseRow({ status: 'ending' }) });
    await h.service.acknowledge(ws, USER, LEASE);
    expect(h.calls.acknowledge).toBeUndefined();
    expect(h.calls.event).toBeUndefined();
  });

  it('records a letter notice, marking it short when it gives less than the lease asks', async () => {
    const h = harness();
    await h.service.recordNotice(ws, USER, LEASE, {
      channel: 'letter',
      filedOn: addDays(TODAY, -2),
      moveOutOn: addDays(TODAY, 8),
      reasonCode: 'own_home',
    });
    expect(h.calls.insertNotice![0]![0]).toMatchObject({ filedByRole: 'tenant', channel: 'letter', noticeDays: 10, isShortNotice: true });
    expect(await problemOf(harness().service.recordNotice(ws, USER, LEASE, { channel: 'letter', filedOn: addDays(TODAY, 1), moveOutOn: addDays(TODAY, 20), reasonCode: 'cost' }))).toBe(
      'Pick today or an earlier day.',
    );
  });

  it('the moved-out day is today or earlier and never before the start', async () => {
    const ending = (): ReturnType<typeof harness> => harness({ lease: leaseRow({ status: 'ending' }), notice: notice({ status: 'acknowledged' }) });
    expect(await problemOf(ending().service.recordMoveOut(ws, USER, LEASE, { movedOutOn: addDays(TODAY, 1) }))).toBe('Pick today or an earlier day.');
    expect(await problemOf(ending().service.recordMoveOut(ws, USER, LEASE, { movedOutOn: '2026-05-31' }))).toBe('Pick a day on or after the lease started.');
    expect(await problemOf(harness().service.recordMoveOut(ws, USER, LEASE, { movedOutOn: TODAY }))).toMatch(/Acknowledge the notice first/);
  });

  it('moving out ends the lease, waives later rent, and owes the district word in 30 days', async () => {
    const h = harness({
      lease: leaseRow({ status: 'ending' }),
      notice: notice({ status: 'acknowledged' }),
      waived: [{ id: 'charge-dec', periodStart: '2026-12-01', amountRwf: 150_000 }],
    });
    await h.service.recordMoveOut(ws, USER, LEASE, { movedOutOn: TODAY });
    expect(h.calls.updateLease![0]).toEqual([LEASE, { status: 'ended', endedOn: TODAY, endReason: 'Notice: Leaving Kigali.' }]);
    expect(h.calls.waive![0]).toEqual([LEASE, TODAY, 'The tenant moved out on 26 October 2026.']);
    expect(h.calls.filing![0]).toEqual([LEASE, addDays(TODAY, 30)]);
    expect(h.charges.voidUnpaidDeposit).toHaveBeenCalled();
    expect(h.kinds()).toEqual(['charge_waived', 'moved_out', 'filing_due']);
    const audit = (h.calls.audit ?? []).map((c) => (c[0] as { eventType: string }).eventType);
    expect(audit).toEqual(['lease.ended']);
    await flush();
    const mail = h.calls.mail![0]![1] as { lines: string[] };
    expect(mail.lines.join(' ')).toContain('Rent of RWF 150,000 for after that day was cancelled.');
  });
});

describe('MoveOutsService: the list and the nudge', () => {
  const row = (id: string, status: LeaseStatus, over: Partial<MoveOutLeaseRow> = {}): MoveOutLeaseRow => ({
    leaseId: id,
    reference: `L-${id}`,
    status,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    noticeDays: 15,
    endedOn: status === 'ended' ? '2026-10-20' : null,
    propertyId: PROPERTY,
    tenantName: 'T',
    unitLabel: 'U',
    propertyName: 'P',
    ...over,
  });

  it('puts each lease under its tab with counts and days left', async () => {
    const h = harness({
      list: [row('a', 'active'), row('b', 'ending'), row('c', 'ended'), row('d', 'ended')],
      notices: new Map([['a', notice({ leaseId: 'a', moveOutOn: addDays(TODAY, 18) })]]),
      deposits: new Map([
        ['c', deposit({ leaseId: 'c' })],
        ['d', deposit({ leaseId: 'd', status: 'settled' })],
      ]),
    });
    const list = await h.service.list(ws, { tab: 'to_acknowledge' });
    expect(list.counts).toEqual({ to_acknowledge: 1, moving_soon: 1, moved_out: 1, settled: 1 });
    expect(list.items.map((i) => [i.leaseId, i.daysLeft])).toEqual([['a', 18]]);
    const moving = await h.service.list(ws, { tab: 'moving_soon' });
    expect(moving.items[0]).toMatchObject({ leaseId: 'b', movingOutOn: '2026-12-31', daysLeft: 66 });
  });

  it('nudges about a notice waiting 3 days, once', async () => {
    const h = harness();
    expect(await h.service.nudgeStaleNotices(TODAY, 3)).toBe(1);
    expect(h.calls.stale![0]).toEqual(['2026-10-23']);
    expect((h.calls.mail![0]![1] as { subject: string }).subject).toBe("Acknowledge Aimée's notice");
    h.moveOuts.claimNudge.mockResolvedValueOnce(false);
    expect(await h.service.nudgeStaleNotices(TODAY, 3)).toBe(0);
  });
});
