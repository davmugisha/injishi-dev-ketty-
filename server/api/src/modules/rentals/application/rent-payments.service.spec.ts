import { describe, expect, it, vi } from 'vitest';

import { NotFoundException } from '@nestjs/common';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import type { ChargeRow } from '../infrastructure/lease-charges.repository';
import type { AllocationOutcome, LeasePaymentsRepository, PaymentRecord, PaymentRow } from '../infrastructure/lease-payments.repository';
import type { LeaseRecord, LeasesRepository } from '../infrastructure/leases.repository';
import type { LeaseEventsWriter, RentalsAuditWriter } from '../infrastructure/rentals-writers';
import { RentPaymentsService } from './rent-payments.service';

/**
 * Waiving a charge with every collaborator doubled (WP 1.6a): a waiver
 * forgives an open charge and nothing else. Recording rent paid outside
 * Injishi went with the decision that rent is paid on the gateway only.
 */
const WS = '11111111-1111-4111-8111-111111111111';
const PROPERTY = '33333333-3333-4333-8333-333333333333';
const LEASE = '66666666-6666-4666-8666-666666666666';
const USER = '77777777-7777-4777-8777-777777777777';
const PAYMENT = '99999999-9999-4999-8999-999999999999';
const CHARGE = '88888888-8888-4888-8888-888888888888';
const TODAY = '2026-10-25';

const ws = {
  workspaceId: WS,
  kind: 'business',
  orgId: '22222222-2222-4222-8222-222222222222',
  domain: 'residence',
  orgRole: 'owner',
  permissions: ['rent.record'],
  branchScope: { coverage: 'all', selectedPropertyId: null, propertyIds: [PROPERTY], includesUnbranched: true },
} as unknown as ScopedWorkspace;

const paymentRow = (over: Partial<PaymentRow> = {}): PaymentRow =>
  ({
    id: PAYMENT,
    workspaceId: WS,
    propertyId: PROPERTY,
    leaseId: LEASE,
    tenantId: 'tenant',
    channel: 'recorded',
    method: 'cash',
    amountRwf: 50_000,
    status: 'succeeded',
    receivedOn: TODAY,
    succeededAt: new Date(),
    receiptNumber: 'R-2026-0001',
    receiptObjectId: null,
    payoutId: null,
    createdAt: new Date(),
    ...over,
  }) as PaymentRow;

interface Opts {
  leaseStatus?: string;
  replay?: PaymentRow | null;
  existing?: PaymentRow | null;
  charge?: Partial<ChargeRow> | null;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function harness(opts: Opts = {}) {
  const calls: Record<string, unknown[][]> = {};
  const record = (name: string) => (...args: unknown[]) => {
    (calls[name] ??= []).push(args);
  };
  const db = { transaction: async <T>(cb: (t: unknown) => Promise<T>): Promise<T> => cb({}) };
  const leaseRecord = {
    lease: { id: LEASE, workspaceId: WS, orgId: ws.orgId, propertyId: PROPERTY, tenantId: 'tenant', status: opts.leaseStatus ?? 'active', startDate: '2026-10-24', graceDays: 5, reference: 'L-0001', unitId: 'unit' },
    tenant: { id: 'tenant', userId: null, fullName: 'Aline Uwera', email: 'aline@example.rw' },
    unitLabel: 'A-01',
    propertyName: 'Amani Residences',
  } as unknown as LeaseRecord;
  const leases = { find: vi.fn(async () => leaseRecord), lock: vi.fn(async () => leaseRecord.lease) };
  let stored: PaymentRow | null = opts.existing ?? null;
  const asRecord = (p: PaymentRow): PaymentRecord => ({ payment: p, allocations: [], payout: null, recordedByName: 'Emmanuel' });
  const chargeRow = opts.charge === null ? null : ({ id: CHARGE, leaseId: LEASE, kind: 'rent', periodStart: '2026-10-24', dueOn: '2026-10-24', amountRwf: 90_323, paidRwf: 0, status: 'open', createdAt: new Date(), ...opts.charge } as ChargeRow);
  const payments = {
    findByKey: vi.fn(async () => opts.replay ?? null),
    find: vi.fn(async () => stored),
    lock: vi.fn(async () => stored),
    record: vi.fn(async () => (stored ? asRecord(stored) : null)),
    nextReceiptNumber: vi.fn(async () => 'R-2026-0007'),
    insert: vi.fn(async (_tx: unknown, values: Partial<PaymentRow>) => {
      record('insert')(values);
      stored = paymentRow(values);
      return stored;
    }),
    allocate: vi.fn(async (_tx: unknown, input: unknown): Promise<AllocationOutcome> => {
      record('allocate')(input);
      return { allocations: [{ chargeId: CHARGE, amountRwf: 50_000 }], allocatedRwf: 50_000, creditRwf: 0, paidChargeIds: [], depositPaid: false };
    }),
    update: vi.fn(async (_tx: unknown, id: string, values: Partial<PaymentRow>) => {
      record('update')(id, values);
      if (stored) stored = { ...stored, ...values };
    }),
    release: vi.fn(async () => (record('release')(), { releasedRwf: 50_000, chargeIds: [CHARGE] })),
    charge: vi.fn(async () => chargeRow),
    waive: vi.fn(async (_tx: unknown, _id: string, reason: string) => (record('waive')(reason), chargeRow)),
  };
  const events = { write: vi.fn(async (_tx: unknown, e: unknown) => record('event')(e)) };
  const audit = { write: vi.fn(async (_tx: unknown, e: unknown) => record('audit')(e)) };
  class Pinned extends RentPaymentsService {
    protected override today(): string {
      return TODAY;
    }
  }
  const service = new Pinned(
    db as never,
    payments as unknown as LeasePaymentsRepository,
    leases as unknown as LeasesRepository,
    events as unknown as LeaseEventsWriter,
    audit as unknown as RentalsAuditWriter,
  );
  const kinds = (): string[] => (calls.event ?? []).map((c) => (c[0] as { kind: string }).kind);
  return { service, calls, kinds, payments };
}

describe('RentPaymentsService', () => {
  describe('waiving', () => {
    it('forgives an open charge with the reason, on the timeline and in the audit', async () => {
      const h = harness();
      const out = await h.service.waive(ws, USER, CHARGE, { reason: 'Roof repairs' });
      expect(h.calls.waive?.[0]?.[0]).toBe('Roof repairs');
      expect(h.kinds()).toEqual(['charge_waived']);
      expect(h.calls.audit?.[0]?.[0]).toMatchObject({ eventType: 'charge.waived', reason: 'Roof repairs' });
      expect(out.id).toBe(CHARGE);
    });

    it('refuses a paid charge', async () => {
      const h = harness({ charge: { status: 'paid', paidRwf: 90_323 } });
      await expect(h.service.waive(ws, USER, CHARGE, { reason: 'x' })).rejects.toMatchObject({ response: { code: 'charge_not_open' } });
    });

    it('answers 404 for a charge that does not exist', async () => {
      const h = harness({ charge: null });
      await expect(h.service.waive(ws, USER, CHARGE, { reason: 'x' })).rejects.toThrow(NotFoundException);
    });
  });
});
