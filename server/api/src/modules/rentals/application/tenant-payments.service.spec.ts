import { describe, expect, it, vi } from 'vitest';

import { kigaliToday } from '@injishi/contracts';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { MockPaymentAdapter, mockCallbackSignature } from '../../payments/infrastructure/mock-payment.adapter';
import type { ChargeRow } from '../infrastructure/lease-charges.repository';
import type { LeasePaymentsRepository, PaymentRecord, PaymentRow } from '../infrastructure/lease-payments.repository';
import type { LeaseRecord, LeasesRepository } from '../infrastructure/leases.repository';
import type { RentalsMoneyQueue } from '../infrastructure/rentals-money.queue';
import type { LeaseEventsWriter, RentalsAuditWriter } from '../infrastructure/rentals-writers';
import type { PaymentReceiptsService } from './payment-receipts.service';
import { PaymentSettlementService } from './payment-settlement.service';
import type { PayoutsService } from './payouts.service';
import type { TenanciesService, TenancyRef } from './tenancies.service';
import { TenantPaymentsService } from './tenant-payments.service';

/**
 * The tenant paying through the mock gateway, with the repositories doubled
 * and the real adapter (WP 1.6b). Pinned here: the prompt is recorded before
 * the rail is asked and settles through the settlement service once the
 * imaginary customer approves (allocation, receipt number, payout queued,
 * emails); a number ending 0000 is declined and closes the payment with the
 * reason; the same key answers the same payment; one prompt at a time; the
 * amount is at most what is owed plus a month; a prompt left past its window
 * expires; a provider callback settles or fails once and a replay is ignored.
 */
const WS = '11111111-1111-4111-8111-111111111111';
const LEASE = '66666666-6666-4666-8666-666666666666';
const TENANT_USER = '77777777-7777-4777-8777-777777777777';
const CHARGE = '88888888-8888-4888-8888-888888888888';

const ref: TenancyRef = { leaseId: LEASE, tenantId: 'tenant', userId: TENANT_USER, workspaceId: WS };

// Due today in Kigali, so it is inside the lease's grace period whatever day the suite runs. It was a fixed
// 2026-10-24, which read as overdue from 2026-10-30, once the five grace days had passed.
const TODAY = kigaliToday(new Date());

const charge = (over: Partial<ChargeRow> = {}): ChargeRow =>
  ({ id: CHARGE, leaseId: LEASE, kind: 'rent', periodStart: TODAY, dueOn: TODAY, amountRwf: 90_323, paidRwf: 0, status: 'open', createdAt: new Date(), ...over }) as ChargeRow;

interface Opts {
  charges?: ChargeRow[];
  leaseStatus?: string;
  pending?: PaymentRow | null;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function harness(opts: Opts = {}) {
  process.env.MOCK_MOMO_APPROVAL_MS = '0';
  const adapter = new MockPaymentAdapter();
  const calls: Record<string, unknown[][]> = {};
  const record = (name: string) => (...args: unknown[]) => {
    (calls[name] ??= []).push(args);
  };
  const rows = new Map<string, PaymentRow>();
  if (opts.pending) rows.set(opts.pending.id, opts.pending);
  let charges = opts.charges ?? [charge()];
  const db = { transaction: async <T>(cb: (t: unknown) => Promise<T>): Promise<T> => cb({}) };
  const leaseRecord = {
    lease: { id: LEASE, workspaceId: WS, orgId: 'org', propertyId: 'property', tenantId: 'tenant', status: opts.leaseStatus ?? 'active', monthlyRentRwf: 350_000, graceDays: 5, reference: 'L-0001', unitId: 'unit' },
    tenant: { id: 'tenant', userId: TENANT_USER, fullName: 'Aline Uwera', email: 'aline@example.rw' },
    unitLabel: 'A-01',
    propertyName: 'Amani Residences',
  } as unknown as LeaseRecord;
  const tenancies = { record: vi.fn(async () => leaseRecord) };
  const leases = { lock: vi.fn(async () => leaseRecord.lease), find: vi.fn(async () => leaseRecord) };
  const asRecord = (p: PaymentRow): PaymentRecord => ({
    payment: p,
    allocations: ((calls.allocate ?? []) as unknown[][]).filter((c) => (c[0] as { paymentId: string }).paymentId === p.id).map(() => ({ amountRwf: Math.min(p.amountRwf, 90_323), charge: charges[0]! }) as never),
    payout: null,
    recordedByName: null,
  });
  const payments = {
    findByKey: vi.fn(async (key: string) => [...rows.values()].find((r) => r.idempotencyKey === key) ?? null),
    find: vi.fn(async (id: string) => rows.get(id) ?? null),
    findByAdapterRef: vi.fn(async (adapterRef: string) => [...rows.values()].find((r) => r.adapterRef === adapterRef) ?? null),
    lock: vi.fn(async (_tx: unknown, id: string) => rows.get(id) ?? null),
    record: vi.fn(async (id: string) => (rows.has(id) ? asRecord(rows.get(id)!) : null)),
    records: vi.fn(async (list: PaymentRow[]) => list.map(asRecord)),
    forLease: vi.fn(async () => [...rows.values()]),
    pendingForLease: vi.fn(async () => [...rows.values()].find((r) => r.status === 'pending') ?? null),
    pending: vi.fn(async () => [...rows.values()].filter((r) => r.status === 'pending')),
    chargesOf: vi.fn(async () => charges),
    credits: vi.fn(async () => []),
    insert: vi.fn(async (_tx: unknown, values: Partial<PaymentRow>) => {
      const row = { id: `p-${rows.size + 1}`, createdAt: new Date(), ...values } as PaymentRow;
      rows.set(row.id, row);
      record('insert')(values);
      return row;
    }),
    update: vi.fn(async (_tx: unknown, id: string, values: Partial<PaymentRow>) => {
      record('update')(id, values);
      rows.set(id, { ...rows.get(id)!, ...values });
    }),
    allocate: vi.fn(async (_tx: unknown, input: { paymentId: string; amountRwf: number }) => {
      record('allocate')(input);
      const take = Math.min(input.amountRwf, 90_323);
      charges = charges.map((c) => (c.id === CHARGE ? { ...c, paidRwf: take, status: take === c.amountRwf ? 'paid' : 'open' } : c));
      return { allocations: [{ chargeId: CHARGE, amountRwf: take }], allocatedRwf: take, creditRwf: input.amountRwf - take, paidChargeIds: take === 90_323 ? [CHARGE] : [], depositPaid: false };
    }),
    nextReceiptNumber: vi.fn(async () => 'R-2026-0003'),
  };
  const payouts = {
    createForPayment: vi.fn(async (_tx: unknown, p: PaymentRow) => (record('payout')(p.id), { id: 'payout-1', status: 'queued', destinationMasked: 'MTN MoMo 078•••••111' })),
    payoutWords: vi.fn(() => 'It is on its way to MTN MoMo 078•••••111.'),
  };
  const receipts = {
    mailTenantReceipt: vi.fn(async (id: string) => (record('tenantMail')(id), true)),
    mailLandlordReceived: vi.fn(async (id: string, words: string) => (record('landlordMail')(id, words), true)),
    pdf: vi.fn(async () => ({ body: Buffer.from('%PDF-1.4'), filename: 'receipt.pdf', objectId: 'obj' })),
  };
  const queue = {
    settleLater: vi.fn(async (id: string, delay: number) => (record('settleLater')(id, delay), true)),
    sendPayout: vi.fn(async (id: string) => (record('sendPayout')(id), true)),
    webhook: vi.fn(async () => true),
  };
  const events = { write: vi.fn(async (_tx: unknown, e: unknown) => record('event')(e)) };
  const audit = { write: vi.fn(async (_tx: unknown, e: unknown) => record('audit')(e)) };
  const settlement = new PaymentSettlementService(
    db as never,
    payments as unknown as LeasePaymentsRepository,
    leases as unknown as LeasesRepository,
    payouts as unknown as PayoutsService,
    receipts as unknown as PaymentReceiptsService,
    queue as unknown as RentalsMoneyQueue,
    events as unknown as LeaseEventsWriter,
    audit as unknown as RentalsAuditWriter,
    adapter,
  );
  const service = new TenantPaymentsService(
    db as never,
    tenancies as unknown as TenanciesService,
    payments as unknown as LeasePaymentsRepository,
    settlement,
    receipts as unknown as PaymentReceiptsService,
    queue as unknown as RentalsMoneyQueue,
    adapter,
  );
  const kinds = (): string[] => (calls.event ?? []).map((c) => (c[0] as { kind: string }).kind);
  return { service, settlement, adapter, calls, kinds, rows, payments };
}

const body = { method: 'mtn_momo' as const, msisdn: '+250788123456' };

describe('TenantPaymentsService', () => {
  it('shows what is owed, and the most that may be paid', async () => {
    const h = harness();
    expect(await h.service.charges(ref)).toMatchObject({ outstandingRwf: 90_323, overdueRwf: 0, creditRwf: 0, pendingPaymentId: null, maxPaymentRwf: 440_323 });
  });

  it('records the prompt before asking the rail, then settles it: allocated, numbered, paid out, both sides emailed', async () => {
    const h = harness();
    const pending = await h.service.pay(ref, { id: TENANT_USER }, 'k1', body);
    expect(pending).toMatchObject({ status: 'pending', amountRwf: 90_323, payerMasked: '788•••456', statusWords: expect.stringContaining('approve') });
    expect(h.calls.insert?.[0]?.[0]).toMatchObject({ channel: 'gateway', method: 'mtn_momo', status: 'pending', payerUserId: TENANT_USER, adapterMode: 'mock', idempotencyKey: `${WS}:rent-collect:k1` });
    expect(h.calls.settleLater?.map((c) => c[1])).toEqual([8_000, 602_000]);
    expect(h.rows.get(pending.id)?.adapterRef).toContain('mock_rent_collect_');

    const done = await h.service.poll(ref, pending.id);
    expect(done).toMatchObject({ status: 'succeeded', receiptNumber: 'R-2026-0003', receiptReady: true });
    expect(h.calls.allocate?.[0]?.[0]).toMatchObject({ paymentId: pending.id, amountRwf: 90_323 });
    expect(h.calls.payout?.[0]?.[0]).toBe(pending.id);
    expect(h.calls.sendPayout).toEqual([['payout-1']]);
    expect(h.kinds()).toEqual(['payment_received']);
    expect(h.calls.audit?.[0]?.[0]).toMatchObject({ subjectType: 'payment', eventType: 'payment.received' });
    await new Promise((r) => setTimeout(r, 0));
    expect(h.calls.tenantMail).toEqual([[pending.id]]);
    expect(h.calls.landlordMail).toEqual([[pending.id, 'It is on its way to MTN MoMo 078•••••111.']]);
    // Settled once.
    expect(await h.settlement.settle(pending.id)).toBe(false);
  });

  it('declines a number ending 0000 and closes the payment with the reason', async () => {
    const h = harness();
    const out = await h.service.pay(ref, { id: TENANT_USER }, 'k1', { ...body, msisdn: '+250788120000' });
    expect(out).toMatchObject({ status: 'failed', failureReason: expect.stringContaining('declined') });
    expect(h.kinds()).toEqual(['payment_failed']);
  });

  it('answers the same payment for the same key', async () => {
    const h = harness();
    const first = await h.service.pay(ref, { id: TENANT_USER }, 'k1', body);
    const again = await h.service.pay(ref, { id: TENANT_USER }, 'k1', body);
    expect(again.id).toBe(first.id);
    expect(h.payments.insert).toHaveBeenCalledTimes(1);
  });

  it('refuses a second prompt while one waits, and names it', async () => {
    const h = harness();
    process.env.MOCK_MOMO_APPROVAL_MS = '60000';
    try {
      const first = await h.service.pay(ref, { id: TENANT_USER }, 'k1', body);
      await expect(h.service.pay(ref, { id: TENANT_USER }, 'k2', body)).rejects.toMatchObject({ response: { code: 'payment_pending', paymentId: first.id } });
    } finally {
      process.env.MOCK_MOMO_APPROVAL_MS = '0';
    }
  });

  it('refuses the wrong network, more than a month over, and a lease that has not started', async () => {
    const h = harness();
    await expect(h.service.pay(ref, { id: TENANT_USER }, 'k1', { method: 'mtn_momo', msisdn: '+250722123456' })).rejects.toThrow(BadRequestException);
    await expect(h.service.pay(ref, { id: TENANT_USER }, 'k2', { ...body, amountRwf: 440_324 })).rejects.toThrow(BadRequestException);
    await expect(harness({ leaseStatus: 'pending_signature' }).service.pay(ref, { id: TENANT_USER }, 'k3', body)).rejects.toThrow(ConflictException);
    expect(h.payments.insert).not.toHaveBeenCalled();
  });

  it('refuses when nothing is owed', async () => {
    const h = harness({ charges: [charge({ status: 'paid', paidRwf: 90_323 })] });
    await expect(h.service.pay(ref, { id: TENANT_USER }, 'k1', body)).rejects.toMatchObject({ response: { code: 'nothing_owed' } });
  });

  it('expires a prompt left past its window', async () => {
    const h = harness();
    const pending = await h.service.pay(ref, { id: TENANT_USER }, 'k1', body);
    h.rows.set(pending.id, { ...h.rows.get(pending.id)!, adapterRef: null, expiresAt: new Date(Date.now() - 1000) });
    const out = await h.service.poll(ref, pending.id);
    expect(out).toMatchObject({ status: 'expired', statusWords: expect.stringContaining('expired') });
    expect(h.kinds()).toEqual(['payment_failed']);
  });

  it('answers 404 for a payment on another lease', async () => {
    const h = harness();
    const pending = await h.service.pay(ref, { id: TENANT_USER }, 'k1', body);
    h.rows.set(pending.id, { ...h.rows.get(pending.id)!, leaseId: 'other' });
    await expect(h.service.poll(ref, pending.id)).rejects.toThrow(NotFoundException);
  });

  it('settles on a signed callback once and ignores the replay and a bad signature', async () => {
    const h = harness();
    process.env.MOCK_MOMO_APPROVAL_MS = '60000';
    try {
      const pending = await h.service.pay(ref, { id: TENANT_USER }, 'k1', body);
      const adapterRef = h.rows.get(pending.id)!.adapterRef!;
      const raw = Buffer.from(JSON.stringify({ eventId: 'evt-1', adapterRef, outcome: 'settled' }));
      expect(h.adapter.parseCallback('mock', { 'x-mock-signature': 'wrong' }, raw)).toBeNull();
      const event = h.adapter.parseCallback('mock', { 'x-mock-signature': mockCallbackSignature(raw) }, raw)!;
      expect(await h.settlement.handleCallback(event)).toBe('settled');
      expect(await h.settlement.handleCallback(event)).toBe('ignored');
      expect(h.rows.get(pending.id)?.status).toBe('succeeded');
    } finally {
      process.env.MOCK_MOMO_APPROVAL_MS = '0';
    }
  });

  it('fails a payment on a failed callback, with the provider reason', async () => {
    const h = harness();
    process.env.MOCK_MOMO_APPROVAL_MS = '60000';
    try {
      const pending = await h.service.pay(ref, { id: TENANT_USER }, 'k1', body);
      const adapterRef = h.rows.get(pending.id)!.adapterRef!;
      const raw = Buffer.from(JSON.stringify({ eventId: 'evt-2', adapterRef, outcome: 'failed', reason: 'insufficient funds' }));
      const event = h.adapter.parseCallback('mock', { 'x-mock-signature': mockCallbackSignature(raw) }, raw)!;
      expect(await h.settlement.handleCallback(event)).toBe('failed');
      expect(h.rows.get(pending.id)?.failureReason).toContain('insufficient funds');
    } finally {
      process.env.MOCK_MOMO_APPROVAL_MS = '0';
    }
  });
});
