import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import type { StorageService } from '../../storage/application/storage.service';
import type { ChargeRow } from '../infrastructure/lease-charges.repository';
import type { AllocationOutcome, LeasePaymentsRepository, PaymentRecord, PaymentRow } from '../infrastructure/lease-payments.repository';
import type { LeaseRecord, LeasesRepository } from '../infrastructure/leases.repository';
import type { LeaseEventsWriter, RentalsAuditWriter } from '../infrastructure/rentals-writers';
import type { PaymentReceiptsService } from './payment-receipts.service';
import { RentPaymentsService } from './rent-payments.service';

/**
 * Recording, reversing and waiving with every collaborator doubled (WP 1.6a).
 * Pinned here: the day received is a Kigali day that has happened, on or
 * after the lease started; a lease that never started takes no money; the
 * same key answers the same payment; what is written (the row, the allocation
 * with the charges chosen, the receipt number, the timeline, the audit, the
 * receipt email); a reversal releases and is refused for a gateway payment
 * or twice; a waiver forgives an open charge and nothing else.
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
  const leases = { find: jest.fn(async () => leaseRecord), lock: jest.fn(async () => leaseRecord.lease) };
  let stored: PaymentRow | null = opts.existing ?? null;
  const asRecord = (p: PaymentRow): PaymentRecord => ({ payment: p, allocations: [], payout: null, recordedByName: 'Emmanuel' });
  const chargeRow = opts.charge === null ? null : ({ id: CHARGE, leaseId: LEASE, kind: 'rent', periodStart: '2026-10-24', dueOn: '2026-10-24', amountRwf: 90_323, paidRwf: 0, status: 'open', createdAt: new Date(), ...opts.charge } as ChargeRow);
  const payments = {
    findByKey: jest.fn(async () => opts.replay ?? null),
    find: jest.fn(async () => stored),
    lock: jest.fn(async () => stored),
    record: jest.fn(async () => (stored ? asRecord(stored) : null)),
    nextReceiptNumber: jest.fn(async () => 'R-2026-0007'),
    insert: jest.fn(async (_tx: unknown, values: Partial<PaymentRow>) => {
      record('insert')(values);
      stored = paymentRow(values);
      return stored;
    }),
    allocate: jest.fn(async (_tx: unknown, input: unknown): Promise<AllocationOutcome> => {
      record('allocate')(input);
      return { allocations: [{ chargeId: CHARGE, amountRwf: 50_000 }], allocatedRwf: 50_000, creditRwf: 0, paidChargeIds: [], depositPaid: false };
    }),
    update: jest.fn(async (_tx: unknown, id: string, values: Partial<PaymentRow>) => {
      record('update')(id, values);
      if (stored) stored = { ...stored, ...values };
    }),
    release: jest.fn(async () => (record('release')(), { releasedRwf: 50_000, chargeIds: [CHARGE] })),
    charge: jest.fn(async () => chargeRow),
    waive: jest.fn(async (_tx: unknown, _id: string, reason: string) => (record('waive')(reason), chargeRow)),
  };
  const storage = { putPaymentSlip: jest.fn(async () => ({ id: 'obj-1', objectKey: 'payment_receipt/slip.png' })) };
  const receipts = {
    mailTenantReceipt: jest.fn(async (id: string) => (record('receiptMail')(id), true)),
    mailTenantReversed: jest.fn(async (id: string, reason: string) => (record('reversedMail')(id, reason), true)),
  };
  const events = { write: jest.fn(async (_tx: unknown, e: unknown) => record('event')(e)) };
  const audit = { write: jest.fn(async (_tx: unknown, e: unknown) => record('audit')(e)) };
  class Pinned extends RentPaymentsService {
    protected override today(): string {
      return TODAY;
    }
  }
  const service = new Pinned(
    db as never,
    payments as unknown as LeasePaymentsRepository,
    leases as unknown as LeasesRepository,
    storage as unknown as StorageService,
    receipts as unknown as PaymentReceiptsService,
    events as unknown as LeaseEventsWriter,
    audit as unknown as RentalsAuditWriter,
  );
  const kinds = (): string[] => (calls.event ?? []).map((c) => (c[0] as { kind: string }).kind);
  return { service, calls, kinds, payments, receipts };
}

const body = { leaseId: LEASE, method: 'cash' as const, amountRwf: 50_000, receivedOn: TODAY };

describe('RentPaymentsService', () => {
  describe('recording', () => {
    it('refuses a day still to come', async () => {
      const h = harness();
      await expect(h.service.record(ws, USER, 'k1', { ...body, receivedOn: '2026-10-26' })).rejects.toThrow(BadRequestException);
      expect(h.payments.insert).not.toHaveBeenCalled();
    });

    it('refuses a day before the lease started', async () => {
      const h = harness();
      await expect(h.service.record(ws, USER, 'k1', { ...body, receivedOn: '2026-10-23' })).rejects.toMatchObject({ response: { path: ['receivedOn'] } });
    });

    it('refuses a lease out for signature and a cancelled one', async () => {
      await expect(harness({ leaseStatus: 'pending_signature' }).service.record(ws, USER, 'k1', body)).rejects.toThrow(ConflictException);
      await expect(harness({ leaseStatus: 'cancelled' }).service.record(ws, USER, 'k1', body)).rejects.toThrow(ConflictException);
    });

    it('writes the payment, allocates the charges chosen, numbers the receipt, and tells the timeline, the audit and the tenant', async () => {
      const h = harness();
      const out = await h.service.record(ws, USER, 'k1', { ...body, method: 'bank_transfer', reference: 'BK 1234', chargeIds: [CHARGE] });
      expect(h.calls.insert?.[0]?.[0]).toMatchObject({
        channel: 'recorded',
        method: 'bank_transfer',
        amountRwf: 50_000,
        status: 'succeeded',
        receivedOn: TODAY,
        reference: 'BK 1234',
        recordedByUserId: USER,
        receiptNumber: 'R-2026-0007',
        idempotencyKey: `${WS}:rent-record:k1`,
      });
      expect(h.calls.allocate?.[0]?.[0]).toMatchObject({ leaseId: LEASE, amountRwf: 50_000, chargeIds: [CHARGE] });
      expect(h.kinds()).toEqual(['payment_recorded']);
      expect(h.calls.audit?.[0]?.[0]).toMatchObject({ subjectType: 'payment', eventType: 'payment.recorded', actorUserId: USER });
      expect(h.calls.receiptMail?.[0]?.[0]).toBe(PAYMENT);
      expect(out).toMatchObject({ channel: 'recorded', status: 'succeeded', receiptNumber: 'R-2026-0007', recordedBy: 'Emmanuel', leaseReference: 'L-0001' });
    });

    it('marks the deposit received when its charge is paid in full', async () => {
      const h = harness();
      h.payments.allocate.mockResolvedValueOnce({ allocations: [{ chargeId: CHARGE, amountRwf: 50_000 }], allocatedRwf: 50_000, creditRwf: 0, paidChargeIds: [CHARGE], depositPaid: true });
      await h.service.record(ws, USER, 'k1', body);
      expect(h.kinds()).toEqual(['payment_recorded', 'deposit_received']);
    });

    it('answers the same payment for the same key and records nothing twice', async () => {
      const h = harness({ replay: paymentRow(), existing: paymentRow() });
      const out = await h.service.record(ws, USER, 'k1', body);
      expect(out.id).toBe(PAYMENT);
      expect(h.payments.insert).not.toHaveBeenCalled();
    });

    it('refuses a key used for another lease', async () => {
      const h = harness({ replay: paymentRow({ leaseId: 'other' }) });
      await expect(h.service.record(ws, USER, 'k1', body)).rejects.toThrow(ConflictException);
    });
  });

  describe('reversing', () => {
    it('releases the allocations, marks the row reversed with the reason, and tells the tenant', async () => {
      const h = harness({ existing: paymentRow() });
      const out = await h.service.reverse(ws, USER, PAYMENT, { reason: 'Typed twice' });
      expect(h.calls.release).toHaveLength(1);
      expect(h.calls.update?.[0]?.[1]).toMatchObject({ status: 'reversed', reversedByUserId: USER, reverseReason: 'Typed twice' });
      expect(h.kinds()).toEqual(['payment_reversed']);
      expect(h.calls.reversedMail?.[0]).toEqual([PAYMENT, 'Typed twice']);
      expect(out.status).toBe('reversed');
    });

    it('refuses a payment made on Injishi', async () => {
      const h = harness({ existing: paymentRow({ channel: 'gateway', method: 'mtn_momo' }) });
      await expect(h.service.reverse(ws, USER, PAYMENT, { reason: 'x' })).rejects.toMatchObject({ response: { code: 'payment_not_recorded' } });
    });

    it('refuses a second reversal', async () => {
      const h = harness({ existing: paymentRow({ status: 'reversed' }) });
      await expect(h.service.reverse(ws, USER, PAYMENT, { reason: 'x' })).rejects.toMatchObject({ response: { code: 'payment_reversed' } });
    });

    it('answers 404 for another business', async () => {
      const h = harness({ existing: paymentRow({ workspaceId: 'other' }) });
      await expect(h.service.reverse(ws, USER, PAYMENT, { reason: 'x' })).rejects.toThrow(NotFoundException);
    });
  });

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
