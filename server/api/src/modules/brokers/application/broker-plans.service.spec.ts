import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { BrokerPlanCheckoutRequest, type BrokerPlanCode, type BrokerPlanStatus, type WorkspaceAccess } from '@injishi/contracts';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { MockPaymentAdapter } from '../../pay/infrastructure/mock-payment.adapter';
import type { PaymentPort } from '../../pay/domain/payment-port';
import type { RentalsMailer } from '../../rentals/infrastructure/rentals.mailer';
import type { BrokersRepository } from '../infrastructure/brokers.repository';
import type {
  BrokerPlansRepository,
  PaymentRow,
  PlanRow,
  RenewalRow,
  SubscriptionRow,
} from '../infrastructure/broker-plans.repository';
import { BrokerPlansService } from './broker-plans.service';

/**
 * Unit scope (ported from feat/rentals, 2026-10-25): broker plans against an in-memory store that keeps the same
 * rules the SQL keeps (one plan in force, one upgrade waiting, a payment
 * applied once), and the real mock gateway.
 */
const WS = '11111111-1111-1111-1111-111111111111';
const BROKER = '22222222-2222-2222-2222-222222222222';
const OTHER = '33333333-3333-3333-3333-333333333333';
const ws: WorkspaceAccess = { workspaceId: WS, kind: 'broker' } as unknown as WorkspaceAccess;

const PROVINCES = [
  { id: 1, name: 'KIGALI' },
  { id: 4, name: 'NORTH' },
];
const DISTRICTS = [
  { id: 102, name: 'Gasabo', provinceId: 1 },
  { id: 103, name: 'Kicukiro', provinceId: 1 },
  { id: 403, name: 'Musanze', provinceId: 4 },
];

class Store {
  plans: PlanRow[] = [
    { id: 'plan-d', code: 'district', name: 'District', priceRwf: 0, active: true, sort: 1 },
    { id: 'plan-p', code: 'province', name: 'Province', priceRwf: 10_000, active: true, sort: 2 },
    { id: 'plan-c', code: 'country', name: 'Country', priceRwf: 25_000, active: true, sort: 3 },
  ];
  home = { districtId: 102 as number | null, changedAt: null as Date | null };
  subs: (Omit<SubscriptionRow, 'planCode' | 'planPriceRwf' | 'provinceName' | 'nextPlanCode'> & { nextPlanId: string | null })[] = [];
  pays: (Omit<PaymentRow, 'planCode' | 'workspaceId'> & { planId: string; receiptSent: boolean })[] = [];
  mails: string[] = [];
  seq = 0;

  private plan(id: string): PlanRow {
    return this.plans.find((p) => p.id === id) as PlanRow;
  }

  sub(row: Store['subs'][number]): SubscriptionRow {
    const plan = this.plan(row.planId);
    const { nextPlanId, ...rest } = row;
    return {
      ...rest,
      planCode: plan.code as SubscriptionRow['planCode'],
      planPriceRwf: plan.priceRwf,
      provinceName: PROVINCES.find((p) => p.id === row.provinceId)?.name ?? null,
      nextPlanCode: nextPlanId ? this.plan(nextPlanId).code : null,
    };
  }

  pay(row: Store['pays'][number]): PaymentRow {
    const { planId, ...rest } = row;
    delete (rest as { receiptSent?: boolean }).receiptSent;
    return { ...rest, planCode: this.plan(planId).code as PaymentRow['planCode'], workspaceId: WS };
  }

  repo(): BrokerPlansRepository {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- the fake's methods close over the store
    const s = this;
    const renewal = (r: Store['subs'][number]): RenewalRow => ({ ...s.sub(r), workspaceId: WS, email: 'broker@example.com', brokerName: 'Sam' });
    return {
      plans: async () => s.plans.map((p) => ({ ...p })),
      plan: async (code: BrokerPlanCode) => s.plans.find((p) => p.code === code) ?? null,
      provinces: async () => PROVINCES,
      province: async (id: number) => PROVINCES.find((p) => p.id === id) ?? null,
      district: async (id: number) => DISTRICTS.find((d) => d.id === id) ?? null,
      home: async () => {
        const d = DISTRICTS.find((x) => x.id === s.home.districtId);
        const pr = PROVINCES.find((p) => p.id === d?.provinceId);
        return { districtId: d?.id ?? null, districtName: d?.name ?? null, provinceId: pr?.id ?? null, provinceName: pr?.name ?? null, changedAt: s.home.changedAt };
      },
      setHomeDistrict: async (_b: string, id: number, hadOne: boolean) => {
        s.home = { districtId: id, changedAt: hadOne ? new Date(NOW.getTime()) : s.home.changedAt };
      },
      live: async (brokerId: string) => {
        const r = s.subs.find((x) => x.brokerId === brokerId && (x.status === 'active' || x.status === 'past_due'));
        return r ? s.sub(r) : null;
      },
      pendingStart: async (brokerId: string) => {
        const r = s.subs.find((x) => x.brokerId === brokerId && x.status === 'pending_payment');
        return r ? s.sub(r) : null;
      },
      subscription: async (id: string) => {
        const r = s.subs.find((x) => x.id === id);
        return r ? s.sub(r) : null;
      },
      insertPendingStart: async (input: { brokerId: string; planId: string; provinceId: number | null; periodStart: string; periodEnd: string; method: 'mtn_momo'; msisdn: string | null }) => {
        if (s.subs.some((x) => x.brokerId === input.brokerId && x.status === 'pending_payment')) return null;
        const id = `sub-${++s.seq}`;
        s.subs.push({
          id,
          brokerId: input.brokerId,
          planId: input.planId,
          provinceId: input.provinceId,
          scopeChangedAt: null,
          status: 'pending_payment',
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          cancelAtPeriodEnd: false,
          nextPlanId: null,
          nextProvinceId: null,
          payMethod: input.method,
          payMsisdn: input.msisdn,
          cardToken: null,
          createdAt: NOW,
        });
        return id;
      },
      dropPendingStart: async (id: string) => {
        const r = s.subs.find((x) => x.id === id && x.status === 'pending_payment');
        if (r) r.status = 'cancelled';
      },
      setPayMethod: async (id: string, method: 'mtn_momo', msisdn: string | null) => {
        const r = s.subs.find((x) => x.id === id);
        if (r) Object.assign(r, { payMethod: method, payMsisdn: msisdn ?? r.payMsisdn });
      },
      insertPayment: async (input: Record<string, unknown>) => {
        if (s.pays.some((p) => p.idempotencyKey === input.idempotencyKey)) return null;
        const id = `pay-${++s.seq}`;
        s.pays.push({
          id,
          subscriptionId: input.subscriptionId as string,
          brokerId: input.brokerId as string,
          planId: input.planId as string,
          kind: input.kind as 'start',
          periodStart: input.periodStart as string,
          periodEnd: input.periodEnd as string,
          amountRwf: input.amountRwf as number,
          method: input.method as 'mtn_momo',
          msisdnMasked: input.msisdnMasked as string | null,
          gatewayRef: null,
          checkoutUrl: null,
          status: 'pending',
          failureReason: null,
          idempotencyKey: input.idempotencyKey as string,
          paidAt: null,
          createdAt: new Date(NOW.getTime()),
          receiptSent: false,
        });
        return id;
      },
      payment: async (id: string) => {
        const r = s.pays.find((p) => p.id === id);
        return r ? s.pay(r) : null;
      },
      paymentByKey: async (key: string) => {
        const r = s.pays.find((p) => p.idempotencyKey === key);
        return r ? s.pay(r) : null;
      },
      payments: async (brokerId: string) => s.pays.filter((p) => p.brokerId === brokerId).map((p) => s.pay(p)).reverse(),
      latestPayment: async (subId: string) => {
        const r = [...s.pays].reverse().find((p) => p.subscriptionId === subId);
        return r ? s.pay(r) : null;
      },
      pendingPayments: async () => s.pays.filter((p) => p.status === 'pending').map((p) => s.pay(p)),
      attachRef: async (id: string, ref: string, url: string | null) => {
        const r = s.pays.find((p) => p.id === id);
        if (r) Object.assign(r, { gatewayRef: ref, checkoutUrl: url });
      },
      failPayment: async (id: string, reason: string) => {
        const r = s.pays.find((p) => p.id === id && p.status === 'pending');
        if (!r) return false;
        Object.assign(r, { status: 'failed', failureReason: reason, checkoutUrl: null });
        return true;
      },
      applyPaid: async (payment: PaymentRow, cardToken: string | null) => {
        const r = s.pays.find((p) => p.id === payment.id && p.status === 'pending');
        if (!r) return false;
        Object.assign(r, { status: 'paid', paidAt: new Date(NOW.getTime()), checkoutUrl: null });
        if (payment.kind === 'start') {
          for (const x of s.subs) {
            if (x.brokerId === payment.brokerId && (x.status === 'active' || x.status === 'past_due') && x.id !== payment.subscriptionId) x.status = 'cancelled';
          }
        }
        const sub = s.subs.find((x) => x.id === payment.subscriptionId && ['pending_payment', 'active', 'past_due'].includes(x.status));
        if (sub) Object.assign(sub, { status: 'active', periodStart: payment.periodStart, periodEnd: payment.periodEnd, cardToken: cardToken ?? sub.cardToken });
        return true;
      },
      claimReceipt: async (id: string) => {
        const r = s.pays.find((p) => p.id === id && !p.receiptSent);
        if (!r) return false;
        r.receiptSent = true;
        return true;
      },
      schedule: async (id: string, change: { cancel: boolean; nextPlanId: string | null; nextProvinceId: number | null }) => {
        const r = s.subs.find((x) => x.id === id);
        if (r) Object.assign(r, { cancelAtPeriodEnd: change.cancel, nextPlanId: change.nextPlanId, nextProvinceId: change.nextProvinceId });
      },
      setProvince: async (id: string, provinceId: number) => {
        const r = s.subs.find((x) => x.id === id);
        if (r) Object.assign(r, { provinceId, scopeChangedAt: new Date(NOW.getTime()) });
      },
      due: async (today: string) => s.subs.filter((x) => x.status === 'active' && x.periodEnd <= today).map(renewal),
      lapsed: async (last: string) => s.subs.filter((x) => x.status === 'past_due' && x.periodEnd <= last).map(renewal),
      setStatus: async (id: string, from: BrokerPlanStatus[], to: BrokerPlanStatus) => {
        const r = s.subs.find((x) => x.id === id && from.includes(x.status));
        if (!r) return false;
        r.status = to;
        return true;
      },
      applyNext: async (id: string) => {
        const r = s.subs.find((x) => x.id === id && x.nextPlanId);
        if (r) Object.assign(r, { planId: r.nextPlanId, provinceId: r.nextProvinceId, nextPlanId: null, nextProvinceId: null });
      },
      contactFor: async () => ({ email: 'broker@example.com', name: 'Sam', workspaceId: WS }),
    } as unknown as BrokerPlansRepository;
  }
}

let NOW = new Date('2026-10-23T08:00:00Z');

class TestService extends BrokerPlansService {
  protected override now(): Date {
    return NOW;
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- a fixture's shape is what it builds
function build(opts: { status?: 'active' | 'suspended'; port?: PaymentPort } = {}) {
  const store = new Store();
  const brokers = {
    brokerForWorkspace: async (id: string) => (id === WS ? { id: BROKER, userId: 'u', name: 'Sam', status: opts.status ?? 'active' } : null),
  } as unknown as BrokersRepository;
  const mailer = {
    appUrl: 'https://app.injishi.test',
    send: async (_ref: string, _to: string, mail: { subject: string }) => {
      store.mails.push(mail.subject);
      return true;
    },
  } as unknown as RentalsMailer;
  const service = new TestService(store.repo(), brokers, opts.port ?? new MockPaymentAdapter(), mailer);
  return { store, service };
}

const momo = (phone = '0788123456', plan: 'province' | 'country' = 'province', provinceId?: number): BrokerPlanCheckoutRequest =>
  BrokerPlanCheckoutRequest.parse({ plan, method: 'mtn_momo', phone, ...(provinceId ? { provinceId } : {}) });

beforeAll(() => {
  process.env.MOCK_MOMO_APPROVAL_MS = '0';
});
afterAll(() => {
  delete process.env.MOCK_MOMO_APPROVAL_MS;
});
beforeEach(() => {
  NOW = new Date('2026-10-23T08:00:00Z');
});

describe('BrokerPlansService', () => {
  it('reads prices from the plans table, not from code', async () => {
    const { store, service } = build();
    (store.plans[1] as PlanRow).priceRwf = 12_500;
    const overview = await service.overview(ws);
    expect(overview.plans.map((p) => [p.code, p.priceRwf])).toEqual([
      ['district', 0],
      ['province', 12_500],
      ['country', 25_000],
    ]);
    const paid = await service.checkout(ws, momo(), 'k1');
    expect(paid.amountRwf).toBe(12_500);
  });

  it('starts on District, showing the home district', async () => {
    const { service } = build();
    const overview = await service.overview(ws);
    expect(overview.current).toMatchObject({ plan: 'district', area: 'Gasabo', nextPaymentOn: null });
    expect(await service.scopeFor(BROKER)).toEqual({ plan: 'district', districtId: 102 });
    const scope = await service.describeScope(BROKER);
    expect(scope.upgrade).toEqual({ plan: 'province', area: 'All of Kigali City', priceRwf: 10_000 });
  });

  it('upgrades to Province by MoMo once the prompt is approved, and mails a receipt', async () => {
    const { store, service } = build();
    const payment = await service.checkout(ws, momo(), 'k1');
    // The mock approves at once in tests; a poll settles it.
    const settled = await service.payment(ws, payment.id);
    expect(settled.status).toBe('paid');
    expect(settled.methodWords).toMatch(/^MTN MoMo 078/);
    expect(await service.scopeFor(BROKER)).toEqual({ plan: 'province', provinceId: 1 });
    const overview = await service.overview(ws);
    expect(overview.current).toMatchObject({ plan: 'province', area: 'All of Kigali City', periodStart: '2026-10-23', periodEnd: '2026-11-23', nextPaymentOn: '2026-11-23', nextAmountRwf: 10_000 });
    expect(store.mails).toEqual(['Receipt: RWF 10,000 for your Province plan']);
  });

  it('keeps the plan the broker had when the payment is declined', async () => {
    const { store, service } = build();
    const failed = await service.checkout(ws, momo('0788120000'), 'k1');
    expect(failed.status).toBe('failed');
    expect(failed.failureReason).toMatch(/declined/);
    expect(await service.scopeFor(BROKER)).toEqual({ plan: 'district', districtId: 102 });
    expect(store.subs[0]?.status).toBe('cancelled');
    // And a new attempt may start straight away.
    const again = await service.checkout(ws, momo(), 'k2');
    expect(again.status).not.toBe('failed');
  });

  it('a declined upgrade from Province leaves Province in force', async () => {
    const { service } = build();
    await service.payment(ws, (await service.checkout(ws, momo(), 'k1')).id);
    const failed = await service.checkout(ws, momo('0788120000', 'country'), 'k2');
    expect(failed.status).toBe('failed');
    expect(await service.scopeFor(BROKER)).toEqual({ plan: 'province', provinceId: 1 });
  });

  it('upgrades to Country by card through the gateway page, crediting the unused Province days', async () => {
    const { store, service } = build();
    await service.payment(ws, (await service.checkout(ws, momo(), 'k1')).id);
    NOW = new Date('2026-11-02T08:00:00Z');
    // The panel shows what it will charge before the broker pays.
    expect((await service.overview(ws)).quotes).toEqual([
      { plan: 'province', amountRwf: 10_000 - 6_774 },
      { plan: 'country', amountRwf: 25_000 - 6_774 },
    ]);
    const card = await service.checkout(ws, BrokerPlanCheckoutRequest.parse({ plan: 'country', method: 'card' }), 'k2');
    expect(card.status).toBe('pending');
    expect(card.checkoutUrl).toContain(`/broker/plan?payment=${card.id}`);
    // 31 days, 21 left: 10,000 × 21 / 31 = 6,774 credit.
    expect(card.amountRwf).toBe(25_000 - 6_774);
    // Back from the card page: the poll finds it paid.
    const back = await service.payment(ws, card.id);
    expect(back.status).toBe('paid');
    expect(await service.scopeFor(BROKER)).toEqual({ plan: 'country' });
    const live = store.subs.find((s) => s.status === 'active');
    expect(live?.cardToken).toMatch(/^mock_card_tok_/);
    expect(store.subs.filter((s) => s.status === 'cancelled')).toHaveLength(1);
  });

  it('is idempotent: the same key is the same payment, charged once', async () => {
    const { store, service } = build();
    const first = await service.checkout(ws, momo(), 'k1');
    const again = await service.checkout(ws, momo(), 'k1');
    expect(again.id).toBe(first.id);
    expect(store.pays).toHaveLength(1);
    await expect(service.checkout(ws, momo(undefined, 'country'), 'k1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses a second upgrade while one waits on a phone', async () => {
    process.env.MOCK_MOMO_APPROVAL_MS = '600000';
    try {
      const { service } = build();
      const waiting = await service.checkout(ws, momo(), 'k1');
      expect(waiting.status).toBe('pending');
      await expect(service.checkout(ws, momo(undefined, 'country'), 'k2')).rejects.toBeInstanceOf(ConflictException);
    } finally {
      process.env.MOCK_MOMO_APPROVAL_MS = '0';
    }
  });

  it('refuses paying again for the plan already in force', async () => {
    const { service } = build();
    await service.payment(ws, (await service.checkout(ws, momo(), 'k1')).id);
    await expect(service.checkout(ws, momo(), 'k2')).rejects.toThrow('already on this plan');
  });

  it('renews by the same number at the month end, from the price in the table', async () => {
    const { store, service } = build();
    await service.payment(ws, (await service.checkout(ws, momo(), 'k1')).id);
    (store.plans[1] as PlanRow).priceRwf = 11_000;
    NOW = new Date('2026-11-23T08:00:00Z');
    const run = await service.sweep(NOW);
    expect(run.renewed).toBe(1);
    await service.sweep(NOW);
    const live = store.subs.find((s) => s.status === 'active');
    expect(live).toMatchObject({ periodStart: '2026-11-23', periodEnd: '2026-12-23' });
    const renewal = store.pays.find((p) => p.kind === 'renewal');
    expect(renewal).toMatchObject({ amountRwf: 11_000, status: 'paid' });
    // A second sweep that day charges nothing more.
    await service.sweep(NOW);
    expect(store.pays.filter((p) => p.kind === 'renewal')).toHaveLength(1);
  });

  it('a failed renewal is past due for three days, then drops to District with nothing deleted', async () => {
    const { store, service } = build();
    await service.payment(ws, (await service.checkout(ws, momo('0788123456'), 'k1')).id);
    // The number that paid now declines.
    (store.subs[0] as { payMsisdn: string }).payMsisdn = '788120000';
    NOW = new Date('2026-11-23T08:00:00Z');
    await service.sweep(NOW);
    expect(store.subs[0]?.status).toBe('past_due');
    expect(store.mails.some((m) => m.startsWith('Pay now'))).toBe(true);
    expect(await service.scopeFor(BROKER)).toEqual({ plan: 'province', provinceId: 1 });
    const overview = await service.overview(ws);
    expect(overview.current.graceUntil).toBe('2026-11-25');

    NOW = new Date('2026-11-26T08:00:00Z');
    const run = await service.sweep(NOW);
    expect(run.lapsed).toBe(1);
    expect(store.subs[0]?.status).toBe('expired');
    expect(await service.scopeFor(BROKER)).toEqual({ plan: 'district', districtId: 102 });
    expect(store.pays).toHaveLength(2);
  });

  it('Pay now on a past-due plan pays the month from where it ended', async () => {
    const { store, service } = build();
    await service.payment(ws, (await service.checkout(ws, momo(), 'k1')).id);
    (store.subs[0] as { payMsisdn: string }).payMsisdn = '788120000';
    NOW = new Date('2026-11-24T08:00:00Z');
    await service.sweep(NOW);
    const paid = await service.payment(ws, (await service.checkout(ws, momo(), 'k3')).id);
    expect(paid).toMatchObject({ status: 'paid', periodStart: '2026-11-23', periodEnd: '2026-12-23', amountRwf: 10_000 });
    expect(store.subs[0]?.status).toBe('active');
  });

  it('a renewal by card with no saved card asks the broker to pay now', async () => {
    const { store, service } = build();
    await service.payment(ws, (await service.checkout(ws, momo(), 'k1')).id);
    Object.assign(store.subs[0] as object, { payMethod: 'card', cardToken: null });
    NOW = new Date('2026-11-23T08:00:00Z');
    await service.sweep(NOW);
    expect(store.subs[0]?.status).toBe('past_due');
    expect(store.pays.filter((p) => p.kind === 'renewal')).toHaveLength(0);
    expect(store.mails.some((m) => m.startsWith('Pay now'))).toBe(true);
  });

  it('a downgrade waits for the month end; cancelling ends on District', async () => {
    const { store, service } = build();
    await service.payment(ws, (await service.checkout(ws, momo(undefined, 'country'), 'k1')).id);
    let overview = await service.change(ws, { plan: 'province', provinceId: 4 });
    expect(overview.current).toMatchObject({ plan: 'country', endsInto: 'province' });
    expect(await service.scopeFor(BROKER)).toEqual({ plan: 'country' });
    NOW = new Date('2026-11-23T08:00:00Z');
    await service.sweep(NOW);
    expect(await service.scopeFor(BROKER)).toEqual({ plan: 'province', provinceId: 4 });
    expect(store.pays.find((p) => p.kind === 'renewal')?.amountRwf).toBe(10_000);

    overview = await service.change(ws, { plan: 'district' });
    expect(overview.current).toMatchObject({ endsInto: 'district', nextPaymentOn: null });
    NOW = new Date('2026-12-23T08:00:00Z');
    const run = await service.sweep(NOW);
    expect(run.ended).toBe(1);
    expect(await service.scopeFor(BROKER)).toEqual({ plan: 'district', districtId: 102 });
  });

  it('refuses moving up without paying, and refuses a cheaper plan at checkout', async () => {
    const { service } = build();
    await service.payment(ws, (await service.checkout(ws, momo(), 'k1')).id);
    await expect(service.change(ws, { plan: 'country' })).rejects.toThrow('Pay for this plan');
    await service.payment(ws, (await service.checkout(ws, momo(undefined, 'country'), 'k2')).id);
    await expect(service.checkout(ws, momo(), 'k3')).rejects.toThrow('cheaper plan');
  });

  it('switches the Province plan province at once, once a month', async () => {
    const { service } = build();
    await service.payment(ws, (await service.checkout(ws, momo(), 'k1')).id);
    await service.change(ws, { plan: 'province', provinceId: 4 });
    expect(await service.scopeFor(BROKER)).toEqual({ plan: 'province', provinceId: 4 });
    await expect(service.change(ws, { plan: 'province', provinceId: 1 })).rejects.toThrow('change the province again');
  });

  it('lets a free broker move district once per 30 days', async () => {
    const { service } = build();
    await service.setHomeDistrict(ws, { districtId: 103 });
    expect(await service.scopeFor(BROKER)).toEqual({ plan: 'district', districtId: 103 });
    await expect(service.setHomeDistrict(ws, { districtId: 403 })).rejects.toThrow('once a month');
    NOW = new Date('2026-11-22T08:00:00Z');
    await service.setHomeDistrict(ws, { districtId: 403 });
    expect(await service.scopeFor(BROKER)).toEqual({ plan: 'district', districtId: 403 });
  });

  it('a paid broker may move district freely, and a first choice is not counted', async () => {
    const { store, service } = build();
    store.home.districtId = null;
    await service.setHomeDistrict(ws, { districtId: 102 });
    await service.setHomeDistrict(ws, { districtId: 103 });
    await service.payment(ws, (await service.checkout(ws, momo(), 'k1')).id);
    await service.setHomeDistrict(ws, { districtId: 403 });
    expect(store.home.districtId).toBe(403);
  });

  it('only the broker of the workspace reaches a plan or its payments', async () => {
    const { service } = build();
    const pay = await service.checkout(ws, momo(), 'k1');
    const landlord = { workspaceId: WS, kind: 'business' } as unknown as WorkspaceAccess;
    await expect(service.overview(landlord)).rejects.toBeInstanceOf(ForbiddenException);
    const stranger = { workspaceId: OTHER, kind: 'broker' } as unknown as WorkspaceAccess;
    await expect(service.payment(stranger, pay.id)).rejects.toBeInstanceOf(NotFoundException);
    const suspended = build({ status: 'suspended' });
    await expect(suspended.service.checkout(ws, momo(), 'k9')).rejects.toThrow('suspended');
  });

  it('checks the phone against the method', () => {
    expect(BrokerPlanCheckoutRequest.safeParse({ plan: 'province', method: 'airtel_money', phone: '0788123456' }).success).toBe(false);
    expect(BrokerPlanCheckoutRequest.safeParse({ plan: 'province', method: 'airtel_money', phone: '0732123456' }).success).toBe(true);
    expect(BrokerPlanCheckoutRequest.safeParse({ plan: 'province', method: 'mtn_momo' }).success).toBe(false);
    expect(BrokerPlanCheckoutRequest.safeParse({ plan: 'province', method: 'card' }).success).toBe(true);
  });
});
