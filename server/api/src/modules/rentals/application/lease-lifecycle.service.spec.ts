import { ConflictException } from '@nestjs/common';
import { addDays, type LeaseStatus } from '@injishi/contracts';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import type { LeaseChargesRepository } from '../infrastructure/lease-charges.repository';
import type { LeaseRecord, LeaseRow, LeasesRepository } from '../infrastructure/leases.repository';
import type { RentalsContextRepository } from '../infrastructure/rentals-context.repository';
import type { LeaseEventsWriter, RentalsAuditWriter } from '../infrastructure/rentals-writers';
import type { RentalsMailer } from '../infrastructure/rentals.mailer';
import type { SigningRepository } from '../infrastructure/signing.repository';
import { LeaseLifecycleService } from './lease-lifecycle.service';
import type { LeaseReadsService } from './lease-reads.service';

/**
 * Starting and cancelling a lease, with every collaborator doubled.
 *
 * Pinned here: Start takes a signed lease active on or after its start date,
 * raises the rent whose raise day has come (from the billing start, a month
 * caught up when billing began earlier) and nothing already raised, and a
 * second press changes nothing; the RentCycle hook starts only when the
 * landlord lets Injishi; cancelling voids the standing signatures, the
 * invitation, live codes and an unpaid deposit, tells a tenant who was sent
 * the lease, and a started tenancy is never cancelled.
 */
const WS = '11111111-1111-4111-8111-111111111111';
const ORG = '22222222-2222-4222-8222-222222222222';
const PROPERTY = '33333333-3333-4333-8333-333333333333';
const LEASE = '66666666-6666-4666-8666-666666666666';
const USER = '77777777-7777-4777-8777-777777777777';

const ws = {
  workspaceId: WS,
  kind: 'business',
  orgId: ORG,
  domain: 'residence',
  orgRole: 'owner',
  permissions: ['lease.manage'],
  branchScope: { coverage: 'all', selectedPropertyId: null, propertyIds: [PROPERTY], includesUnbranched: true },
} as unknown as ScopedWorkspace;

const TODAY = '2026-10-24';

const leaseRow = (over: Partial<LeaseRow> = {}): LeaseRow =>
  ({
    id: LEASE,
    orgId: ORG,
    workspaceId: WS,
    reference: 'L-0001',
    propertyId: PROPERTY,
    status: 'signed' as LeaseStatus,
    startDate: TODAY,
    endDate: '2027-10-23',
    billingStartsOn: TODAY,
    monthlyRentRwf: 310_000,
    depositRwf: 620_000,
    rentDueDay: 5,
    ...over,
  }) as LeaseRow;

interface Opts {
  lease?: LeaseRow;
  raised?: string[];
  autoStart?: boolean;
  deposit?: 'voided' | 'paid_kept' | 'none';
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function harness(opts: Opts = {}) {
  const calls: Record<string, unknown[][]> = {};
  const record = (name: string) => (...args: unknown[]) => {
    (calls[name] ??= []).push(args);
  };
  const lease = opts.lease ?? leaseRow();
  const leaseRecord = {
    lease,
    tenant: { id: 'tenant', userId: 'tenant-user', fullName: 'Aimée Uwera', email: 'aimee@example.rw' },
    unitLabel: 'A-01',
    propertyName: 'Amani Residences',
  } as unknown as LeaseRecord;
  const db = { transaction: async <T>(cb: (t: unknown) => Promise<T>): Promise<T> => cb({}) };
  const leases = {
    find: jest.fn(async () => leaseRecord),
    lock: jest.fn(async () => lease),
    update: jest.fn(async (_tx: unknown, id: string, values: unknown) => record('updateLease')(id, values)),
    revokeLiveInvitation: jest.fn(async () => 'inv-1'),
  };
  const signing = {
    voidLiveSignatures: jest.fn(async (_tx: unknown, id: string, note: string) => (record('void')(id, note), ['sig-1', 'sig-2'])),
    consumeLiveCodes: jest.fn(async () => 1),
    accountEmail: jest.fn(async () => 'aimee@example.rw'),
  };
  const charges = {
    rentPeriodsRaised: jest.fn(async () => opts.raised ?? []),
    raiseRent: jest.fn(async (_tx: unknown, input: { periodStart: string; dueOn: string; amountRwf: number }) => {
      record('rent')(input);
      return { id: `charge-${input.periodStart}`, kind: 'rent', periodEnd: null, ...input };
    }),
    openCharges: jest.fn(async () => [
      { kind: 'deposit', periodStart: null, dueOn: TODAY, amountRwf: 620_000, paidRwf: 0 },
      { kind: 'rent', periodStart: TODAY, dueOn: TODAY, amountRwf: 80_000, paidRwf: 0 },
    ]),
    voidUnpaidDeposit: jest.fn(async () => opts.deposit ?? 'voided'),
  };
  const context = {
    ensureProfile: jest.fn(async () => ({ autoStartLeases: opts.autoStart ?? true })),
    org: jest.fn(async () => ({ legalName: 'Amani Residences' })),
  };
  const events = { write: jest.fn(async (_tx: unknown, e: unknown) => record('event')(e)) };
  const audit = { write: jest.fn(async (_tx: unknown, e: unknown) => record('audit')(e)) };
  const reads = { detail: jest.fn(async () => ({ id: LEASE }) as never) };
  const mailer = {
    appUrl: 'http://localhost:3002',
    send: jest.fn(async (_ref: string, to: string, mail: { subject: string; lines: string[] }) => (record('mail')(to, mail), true)),
  };
  class Pinned extends LeaseLifecycleService {
    protected override today(): string {
      return TODAY;
    }
  }
  const service = new Pinned(
    db as never,
    leases as unknown as LeasesRepository,
    signing as unknown as SigningRepository,
    charges as unknown as LeaseChargesRepository,
    context as unknown as RentalsContextRepository,
    events as unknown as LeaseEventsWriter,
    audit as unknown as RentalsAuditWriter,
    reads as unknown as LeaseReadsService,
    mailer as unknown as RentalsMailer,
  );
  return { service, calls, charges };
}

const flush = (): Promise<void> => new Promise((r) => setImmediate(r));

describe('LeaseLifecycleService.start', () => {
  it('starts a signed lease on its start date, raising the first month prorated and nothing ahead of its raise day', async () => {
    const h = harness();
    await h.service.start(ws, USER, LEASE);
    expect(h.calls.updateLease![0]).toEqual([LEASE, { status: 'active', activatedAt: expect.any(Date) }]);
    // 24 to 31 October: 8 of 31 days of 310,000. November's rent is raised on 29 October, not yet.
    expect(h.calls.rent).toEqual([[{ leaseId: LEASE, periodStart: '2026-10-24', periodEnd: '2026-10-31', dueOn: '2026-10-24', amountRwf: 80_000 }]]);
    const kinds = h.calls.event!.map((e) => (e[0] as { kind: string }).kind);
    expect(kinds).toEqual(['charge_raised', 'started']);
    expect(h.calls.event![1]![0]).toMatchObject({ kind: 'started', actorRole: 'landlord', actorUserId: USER, visibleToTenant: true });
    expect(h.calls.audit![0]![0]).toMatchObject({ eventType: 'lease.started', diff: { from: 'signed', to: 'active', by: 'landlord' } });
    await flush();
    const [to, mail] = h.calls.mail![0] as [string, { subject: string; lines: string[] }];
    expect(to).toBe('aimee@example.rw');
    expect(mail.subject).toBe('Your tenancy has started');
    expect(mail.lines).toEqual(expect.arrayContaining(['Deposit: RWF 620,000, due on 24 October 2026.', 'Rent for October 2026: RWF 80,000, due on 24 October 2026.']));
  });

  it('a tenancy brought in mid way catches up the months billing covers, skipping those already raised', async () => {
    const h = harness({ lease: leaseRow({ startDate: '2026-09-01', billingStartsOn: '2026-09-01', endDate: '2027-08-31' }), raised: ['2026-09-01'] });
    await h.service.start(ws, USER, LEASE);
    expect((h.calls.rent ?? []).map((c) => (c[0] as { periodStart: string }).periodStart)).toEqual(['2026-10-01']);
  });

  it('refuses before the start date, saying when', async () => {
    const h = harness({ lease: leaseRow({ startDate: addDays(TODAY, 3) }) });
    const err = await h.service.start(ws, USER, LEASE).catch((e: unknown) => e);
    expect((err as ConflictException).getResponse()).toMatchObject({
      code: 'lease_not_started_yet',
      message: 'This tenancy starts on 27 October 2026. Start it on that day or after.',
    });
    expect(h.calls.updateLease).toBeUndefined();
  });

  it('a second press changes nothing; a lease not signed by both cannot start', async () => {
    const again = harness({ lease: leaseRow({ status: 'active' }) });
    await again.service.start(ws, USER, LEASE);
    expect(again.calls.updateLease).toBeUndefined();
    expect(again.calls.mail).toBeUndefined();
    await expect(harness({ lease: leaseRow({ status: 'pending_signature' }) }).service.start(ws, USER, LEASE)).rejects.toThrow(
      "This lease is out for the tenant's signature. Both sides sign before the tenancy can start.",
    );
  });

  it('the RentCycle hook starts a signed lease on its start date only when the landlord lets Injishi', async () => {
    const on = harness();
    expect(await on.service.startOnSchedule(LEASE, TODAY)).toBe(true);
    expect(on.calls.event!.at(-1)![0]).toMatchObject({ kind: 'started', actorRole: 'system', actorUserId: null });
    expect(on.calls.audit![0]![0]).toMatchObject({ actorUserId: null, diff: { by: 'system' } });
    const off = harness({ autoStart: false });
    expect(await off.service.startOnSchedule(LEASE, TODAY)).toBe(false);
    expect(off.calls.updateLease).toBeUndefined();
    const early = harness({ lease: leaseRow({ startDate: addDays(TODAY, 1) }) });
    expect(await early.service.startOnSchedule(LEASE, TODAY)).toBe(false);
  });
});

describe('LeaseLifecycleService.cancel', () => {
  it('cancels a lease out for signing: signatures, invitation, codes and the unpaid deposit voided, the tenant told', async () => {
    const h = harness({ lease: leaseRow({ status: 'pending_signature' }) });
    await h.service.cancel(ws, USER, LEASE, { reason: 'The tenant changed their mind' });
    expect(h.calls.updateLease![0]![1]).toMatchObject({ status: 'cancelled', cancelReason: 'The tenant changed their mind' });
    expect(h.calls.void).toEqual([[LEASE, 'Voided: the lease was cancelled.']]);
    expect(h.calls.event![0]![0]).toMatchObject({ kind: 'cancelled', visibleToTenant: true, payload: { signaturesVoided: 2, invitationRevoked: true, depositVoided: true } });
    expect(h.calls.event![1]![0]).toMatchObject({ kind: 'charge_waived', payload: { kind: 'deposit' } });
    expect(h.calls.audit![0]![0]).toMatchObject({ eventType: 'lease.cancelled', reason: 'The tenant changed their mind', diff: { deposit: 'voided', codesWithdrawn: 1 } });
    await flush();
    const [, mail] = h.calls.mail![0] as [string, { subject: string; lines: string[] }];
    expect(mail.subject).toBe('Amani Residences cancelled the lease for unit A-01 at Amani Residences');
    expect(mail.lines).toContain('The reason they gave: The tenant changed their mind');
  });

  it('a signed lease with a deposit already paid keeps it for the settlement', async () => {
    const h = harness({ deposit: 'paid_kept' });
    await h.service.cancel(ws, USER, LEASE, { reason: 'The unit flooded' });
    expect(h.calls.event!.map((e) => (e[0] as { kind: string }).kind)).toEqual(['cancelled']);
  });

  it('a draft is cancelled without the tenant seeing or hearing of it', async () => {
    const h = harness({ lease: leaseRow({ status: 'draft' }), deposit: 'none' });
    await h.service.cancel(ws, USER, LEASE, { reason: 'Drafted by mistake' });
    expect(h.calls.event![0]![0]).toMatchObject({ kind: 'cancelled', visibleToTenant: false });
    await flush();
    expect(h.calls.mail).toBeUndefined();
  });

  it('a started tenancy ends with a move out, not a cancellation', async () => {
    const h = harness({ lease: leaseRow({ status: 'active' }) });
    await expect(h.service.cancel(ws, USER, LEASE, { reason: 'Changed my mind' })).rejects.toThrow(
      'This lease is active. A tenancy that has started ends with a move out, not a cancellation.',
    );
  });
});
