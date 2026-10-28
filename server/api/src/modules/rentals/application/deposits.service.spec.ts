import { describe, expect, it, vi } from 'vitest';

import { BadRequestException, ConflictException } from '@nestjs/common';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { PaymentDeclinedError, type PaymentPort } from '../../payments/domain/payment-port';
import { MockPaymentAdapter } from '../../payments/infrastructure/mock-payment.adapter';
import type { LeaseRecord, LeasesRepository } from '../infrastructure/leases.repository';
import type { DepositRow, MoveOutsRepository, RefundPayoutRow } from '../infrastructure/move-outs.repository';
import type { RentalsContextRepository } from '../infrastructure/rentals-context.repository';
import type { RentalsMoneyQueue } from '../infrastructure/rentals-money.queue';
import type { LeaseEventsWriter, RentalsAuditWriter } from '../infrastructure/rentals-writers';
import type { RentalsMailer } from '../infrastructure/rentals.mailer';
import type { SigningRepository } from '../infrastructure/signing.repository';
import { DepositsService } from './deposits.service';
import type { TenancyRef } from './tenancies.service';

/**
 * Settling the deposit (WP 1.7), with every collaborator doubled.
 *
 * Pinned here: kept (the deductions) plus refunded must equal what was paid;
 * a refund needs a way back and "no refund" refunds nothing; a lease still
 * running is refused; a recorded refund settles at once and emails the
 * tenant the breakdown; a refund through Injishi waits on the landlord's
 * phone and settles when the gateway says so (then the breakdown goes out),
 * a tenant number ending 0000 is refused by the mock gateway and leaves the
 * deposit held for another try; the same key twice is one settlement; the
 * tenant disputes a settled deposit once.
 */
const WS = '11111111-1111-4111-8111-111111111111';
const ORG = '22222222-2222-4222-8222-222222222222';
const PROPERTY = '33333333-3333-4333-8333-333333333333';
const LEASE = '66666666-6666-4666-8666-666666666666';
const USER = '77777777-7777-4777-8777-777777777777';
const KEY = '99999999-9999-4999-8999-999999999999';

const ws = {
  workspaceId: WS,
  kind: 'business',
  orgId: ORG,
  domain: 'residence',
  orgRole: 'owner',
  permissions: ['deposit.return'],
  branchScope: { coverage: 'all', selectedPropertyId: null, propertyIds: [PROPERTY], includesUnbranched: true },
} as unknown as ScopedWorkspace;

const base = (): DepositRow =>
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
  }) as DepositRow;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function harness(opts: { leaseStatus?: string; port?: Partial<PaymentPort>; deposit?: Partial<DepositRow> } = {}) {
  const calls: Record<string, unknown[][]> = {};
  const record = (name: string) => (...args: unknown[]) => {
    (calls[name] ??= []).push(args);
  };
  let dep: DepositRow = { ...base(), ...opts.deposit };
  let payout: RefundPayoutRow | null = null;
  const leaseRecord = {
    lease: { id: LEASE, orgId: ORG, workspaceId: WS, propertyId: PROPERTY, reference: 'L-0004', status: opts.leaseStatus ?? 'ended', endedOn: '2026-10-20' },
    tenant: { id: 't', userId: 'tenant-user', fullName: 'Aimée Uwera', email: 'aimee@example.rw' },
    unitLabel: 'B-03',
    propertyName: 'Amani Residences',
  } as unknown as LeaseRecord;
  const db = {
    transaction: async <T>(cb: (t: unknown) => Promise<T>): Promise<T> => cb({ execute: async (q: unknown) => (record('sql')(q), { rows: [] }) }),
    execute: async () => ({ rows: [] }),
  };
  const leases = { find: vi.fn(async () => leaseRecord) };
  const moveOuts = {
    deposit: vi.fn(async () => dep),
    depositOfLease: vi.fn(async () => dep),
    updateDeposit: vi.fn(async (_tx: unknown, _id: string, v: Partial<DepositRow>) => {
      record('updateDeposit')(v);
      dep = { ...dep, ...v };
      if (payout && v.refundPayoutId === payout.payoutId) dep = { ...dep, payoutStatus: payout.status, payoutDestination: payout.destinationMasked };
    }),
    claimRefundPayout: vi.fn(async (_tx: unknown, v: { amountRwf: number; destinationMasked: string; idempotencyKey: string }) => {
      record('claim')(v);
      payout = {
        payoutId: 'payout-1',
        depositId: dep.id,
        leaseId: LEASE,
        workspaceId: WS,
        status: 'queued',
        amountRwf: v.amountRwf,
        adapterRef: null,
        destinationMasked: v.destinationMasked,
        createdByUserId: USER,
        createdAt: new Date(),
      };
      return 'payout-1';
    }),
    refundPayout: vi.fn(async () => payout),
    updatePayout: vi.fn(async (_db: unknown, _id: string, v: { status?: RefundPayoutRow['status']; adapterRef?: string; failureReason?: string | null }) => {
      record('updatePayout')(v);
      if (payout) {
        payout = { ...payout, ...(v.status ? { status: v.status } : {}), ...(v.adapterRef ? { adapterRef: v.adapterRef } : {}) };
        dep = { ...dep, payoutStatus: payout.status, payoutFailureReason: v.failureReason ?? dep.payoutFailureReason };
      }
    }),
    waitingRefunds: vi.fn(async () => (payout && payout.status === 'queued' ? [payout.payoutId] : [])),
  };
  const context = {
    org: vi.fn(async () => ({ legalName: 'Amani Residences' })),
    ensureProfile: vi.fn(async () => ({ contactEmail: 'amani@example.rw' })),
    ownerContact: vi.fn(async () => null),
  };
  const signing = { accountEmail: vi.fn(async () => 'aimee@example.rw') };
  const events = { write: vi.fn(async (_tx: unknown, e: { kind: string }) => record('event')(e)) };
  const audit = { write: vi.fn(async (_tx: unknown, e: { eventType: string }) => record('audit')(e)) };
  const mailer = {
    appUrl: 'http://localhost:3002',
    send: vi.fn(async (_ref: string, to: string, mail: { subject: string; lines: string[] }) => (record('mail')(to, mail), true)),
  };
  const queue = { settleVendorPayoutLater: vi.fn(async (id: string, ms: number) => (record('queue')(id, ms), true)) };
  const port = (opts.port ?? new MockPaymentAdapter()) as PaymentPort;
  const service = new DepositsService(
    db as never,
    leases as unknown as LeasesRepository,
    moveOuts as unknown as MoveOutsRepository,
    context as unknown as RentalsContextRepository,
    signing as unknown as SigningRepository,
    events as unknown as LeaseEventsWriter,
    audit as unknown as RentalsAuditWriter,
    mailer as unknown as RentalsMailer,
    queue as unknown as RentalsMoneyQueue,
    port,
  );
  const audits = (): string[] => (calls.audit ?? []).map((c) => (c[0] as { eventType: string }).eventType);
  return { service, calls, audits, deposit: () => dep, setPayout: (p: Partial<RefundPayoutRow>) => (payout = payout ? { ...payout, ...p } : payout) };
}

const flush = (): Promise<void> => new Promise((r) => setImmediate(r));

async function problemOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof BadRequestException || e instanceof ConflictException) return String((e.getResponse() as { message?: string }).message);
    throw e;
  }
  return 'no error';
}

const oneDeduction = [{ label: 'Broken window', amountRwf: 40_000 }];

describe('DepositsService.settle: the balance rule', () => {
  it('refuses kept plus refunded that is not what was paid', async () => {
    const h = harness();
    expect(
      await problemOf(h.service.settle(ws, USER, 'deposit-1', { deductions: oneDeduction, refundedRwf: 150_000, refund: { method: 'recorded', paidOn: '2026-10-21' } }, KEY)),
    ).toBe('What you keep and what you refund must add up to RWF 200,000.');
    expect(await problemOf(h.service.settle(ws, USER, 'deposit-1', { deductions: [], refundedRwf: 200_000, refund: { method: 'none' } }, KEY))).toBe(
      'Pick how the refund goes back.',
    );
    expect(
      await problemOf(h.service.settle(ws, USER, 'deposit-1', { deductions: [{ label: 'Paint', amountRwf: 250_000 }], refundedRwf: 0, refund: { method: 'none' } }, KEY)),
    ).toBe('You can keep at most the RWF 200,000 paid.');
    expect(h.calls.updateDeposit).toBeUndefined();
  });

  it('refuses a lease that has not ended', async () => {
    const h = harness({ leaseStatus: 'ending' });
    expect(await problemOf(h.service.settle(ws, USER, 'deposit-1', { deductions: [], refundedRwf: 0, refund: { method: 'none' } }, KEY))).toBe(
      'Record the move out before you settle the deposit.',
    );
  });
});

describe('DepositsService.settle: recorded and none', () => {
  it('settles a recorded refund at once and emails the breakdown', async () => {
    const h = harness();
    const view = await h.service.settle(
      ws,
      USER,
      'deposit-1',
      { deductions: oneDeduction, refundedRwf: 160_000, refund: { method: 'recorded', paidOn: '2026-10-21', reference: 'MP123' } },
      KEY,
    );
    expect(view).toMatchObject({ status: 'settled', keptRwf: 40_000, refundedRwf: 160_000, refundMethod: 'recorded', refundReference: 'MP123' });
    expect(h.audits()).toEqual(['deposit.settled']);
    await flush();
    const mail = h.calls.mail![0]![1] as { subject: string; lines: string[] };
    expect(mail.subject).toBe('Your deposit was settled');
    expect(mail.lines).toEqual(
      expect.arrayContaining(['Kept: RWF 40,000.', 'Broken window: RWF 40,000', 'Refunded: RWF 160,000, paid to you outside Injishi (reference MP123).']),
    );
  });

  it('the same key twice is one settlement', async () => {
    const h = harness();
    const body = { deductions: [], refundedRwf: 0, refund: { method: 'none' as const } };
    await h.service.settle(ws, USER, 'deposit-1', { ...body, deductions: [{ label: 'Paint', amountRwf: 200_000 }] }, KEY);
    await h.service.settle(ws, USER, 'deposit-1', body, KEY);
    expect(h.calls.updateDeposit).toHaveLength(1);
    expect(await problemOf(h.service.settle(ws, USER, 'deposit-1', body, '00000000-0000-4000-8000-000000000001'))).toBe('This deposit is already settled.');
  });
});

describe('DepositsService.settle: a refund through Injishi', () => {
  it('waits on the landlord phone, then settles when the gateway says so', async () => {
    const pending = {
      payVendor: vi.fn(async () => ({ adapterRef: 'ref-1', settlement: 'pending' })),
      fetchTransaction: vi.fn(async () => ({ adapterRef: 'ref-1', settlement: 'settled' })),
    } as unknown as PaymentPort;
    const h = harness({ port: pending });
    const view = await h.service.settle(
      ws,
      USER,
      'deposit-1',
      { deductions: oneDeduction, refundedRwf: 160_000, refund: { method: 'gateway', tenantPhone: '+250788111222', payerPhone: '+250788333444' } },
      KEY,
    );
    expect(view).toMatchObject({ status: 'held', refundMethod: 'gateway', refundStatus: 'waiting', keptRwf: 40_000, refundedRwf: 160_000 });
    expect(h.calls.claim![0]![0]).toMatchObject({ amountRwf: 160_000, destinationMasked: expect.stringMatching(/^MTN MoMo .*222$/), idempotencyKey: `${WS}:deposit-refund:${KEY}` });
    expect(h.calls.queue).toHaveLength(2);
    expect(h.audits()).toEqual(['deposit.refund_sent']);
    expect(h.calls.mail).toBeUndefined();

    expect(await h.service.sweep()).toEqual({ paid: 1, failed: 0, waiting: 0 });
    expect(h.deposit()).toMatchObject({ status: 'settled', payoutStatus: 'paid' });
    expect(h.audits()).toEqual(['deposit.refund_sent', 'deposit.settled']);
    await flush();
    const mail = h.calls.mail![0]![1] as { lines: string[] };
    expect(mail.lines.join(' ')).toContain('Refunded: RWF 160,000 to MTN MoMo');
  });

  it('a tenant number ending 0000 is refused by the gateway: nothing moves and it can be settled again', async () => {
    const h = harness();
    const view = await h.service.settle(
      ws,
      USER,
      'deposit-1',
      { deductions: oneDeduction, refundedRwf: 160_000, refund: { method: 'gateway', tenantPhone: '+250788110000', payerPhone: '+250788333444' } },
      KEY,
    );
    expect(view).toMatchObject({ status: 'held', refundStatus: 'failed' });
    expect(view.refundFailureReason).toMatch(/^The refund was declined: the receiving account refused the transfer\. Nothing was taken\.$/);
    expect(h.audits()).toEqual(['deposit.refund_sent', 'deposit.refund_failed']);
    await flush();
    expect((h.calls.mail![0]![1] as { subject: string }).subject).toBe('The deposit refund to Aimée Uwera did not go through');
    expect(h.calls.mail![0]![0]).toBe('aimee@example.rw');
  });

  it('a declined prompt fails the refund', async () => {
    const declining = {
      payVendor: vi.fn(async () => {
        throw new PaymentDeclinedError('the customer declined the request on their handset', 'k');
      }),
    } as unknown as PaymentPort;
    const h = harness({ port: declining });
    const view = await h.service.settle(
      ws,
      USER,
      'deposit-1',
      { deductions: [], refundedRwf: 200_000, refund: { method: 'gateway', tenantPhone: '+250788111222', payerPhone: '+250788330000' } },
      KEY,
    );
    expect(view.refundStatus).toBe('failed');
  });
});

describe('DepositsService.dispute', () => {
  const tenancy: TenancyRef = { leaseId: LEASE, tenantId: 't', userId: 'tenant-user', workspaceId: WS };

  it('a settled deposit can be disputed once, and the landlord hears', async () => {
    const h = harness({ deposit: { status: 'settled', settledAt: new Date(), keptRwf: 40_000, refundedRwf: 160_000, refundMethod: 'recorded' } });
    await h.service.dispute(tenancy, { note: 'The window was already broken when I moved in.' });
    expect(h.deposit()).toMatchObject({ tenantDisputedAt: expect.any(Date), disputeNote: 'The window was already broken when I moved in.' });
    expect(h.audits()).toEqual(['deposit.disputed']);
    expect((h.calls.mail![0]![1] as { subject: string }).subject).toBe('Aimée Uwera disputes the deposit settlement');
    expect(await problemOf(h.service.dispute(tenancy, { note: 'Again please' }))).toMatch(/already said/);
  });

  it('refuses a deposit not settled yet', async () => {
    const h = harness();
    expect(await problemOf(h.service.dispute(tenancy, { note: 'Not fair at all' }))).toBe('Your deposit is not settled yet.');
  });
});
