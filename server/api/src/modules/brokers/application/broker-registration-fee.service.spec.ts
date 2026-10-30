import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BrokerFeeCheckoutRequest } from '@injishi/contracts';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import { MockPaymentAdapter } from '../../pay/infrastructure/mock-payment.adapter';
import { BrokerRegistrationFeeService } from './broker-registration-fee.service';

/**
 * The broker registration fee (2026-10-25): 5,000 RWF from `registration_fees`,
 * asked on the payer's phone through the gateway (the mock here), polled until
 * approved. A number ending 0000 declines; the same key is the same payment;
 * a paid fee is not charged twice; another person's payment is not found.
 */
const USER = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';
const dialect = new PgDialect();

interface Row {
  id: string;
  user_id: string;
  broker_id: string | null;
  amount_rwf: number;
  method: string;
  msisdn_masked: string | null;
  gateway_ref: string | null;
  status: 'pending' | 'paid' | 'failed';
  failure_reason: string | null;
  idempotency_key: string;
  paid_at: Date | null;
  created_at: Date;
}

/** A database double that answers the handful of statements the service sends, by their shape. */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- a fixture's shape is what it builds
function fakeDb(state: { rows: Row[]; fee: number; brokers: string[] }) {
  let seq = 0;
  return {
    execute: async (query: SQL) => {
      const { sql: text, params } = dialect.sqlToQuery(query);
      if (text.includes('from registration_fees')) return { rows: [{ amount: String(state.fee) }] };
      if (text.includes('from brokers')) return { rows: state.brokers.includes(params[0] as string) ? [{ '?column?': 1 }] : [] };
      if (text.startsWith('\n      insert into broker_registration_payments') || text.includes('insert into broker_registration_payments')) {
        const [userId, amount, method, masked, , key] = params as [string, number, string, string, string, string];
        if (state.rows.some((r) => r.idempotency_key === key)) return { rows: [] };
        const id = `00000000-0000-0000-0000-00000000000${++seq}`;
        state.rows.push({ id, user_id: userId, broker_id: null, amount_rwf: amount, method, msisdn_masked: masked, gateway_ref: null, status: 'pending', failure_reason: null, idempotency_key: key, paid_at: null, created_at: new Date() });
        return { rows: [{ id }] };
      }
      if (text.includes('set gateway_ref')) {
        const [ref, id] = params as [string, string];
        const r = state.rows.find((x) => x.id === id);
        if (r) r.gateway_ref = ref;
        return { rows: [] };
      }
      if (text.includes("set status = 'paid'")) {
        const r = state.rows.find((x) => x.id === params[0] && x.status === 'pending');
        if (r) Object.assign(r, { status: 'paid', paid_at: new Date() });
        return { rows: [] };
      }
      if (text.includes("set status = 'failed'")) {
        const [reason, id] = params as [string, string];
        const r = state.rows.find((x) => x.id === id && x.status === 'pending');
        if (r) Object.assign(r, { status: 'failed', failure_reason: reason });
        return { rows: [] };
      }
      if (text.includes('from broker_registration_payments')) {
        let found: Row[] = [];
        if (text.includes('where user_id =')) found = state.rows.filter((r) => r.user_id === params[0] && r.status === 'paid');
        else if (text.includes('where id =')) found = state.rows.filter((r) => r.id === params[0]);
        else if (text.includes('where idempotency_key =')) found = state.rows.filter((r) => r.idempotency_key === params[0]);
        return { rows: found.slice(0, 1) };
      }
      throw new Error(`unexpected SQL: ${text}`);
    },
  };
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- a fixture's shape is what it builds
function build() {
  const state = { rows: [] as Row[], fee: 5_000, brokers: [] as string[] };
  const service = new BrokerRegistrationFeeService(fakeDb(state) as never, new MockPaymentAdapter());
  return { state, service };
}

const momo = (phone = '0788123456'): BrokerFeeCheckoutRequest => BrokerFeeCheckoutRequest.parse({ method: 'mtn_momo', phone });

beforeAll(() => {
  process.env.MOCK_MOMO_APPROVAL_MS = '0';
});
afterAll(() => {
  delete process.env.MOCK_MOMO_APPROVAL_MS;
});

describe('BrokerRegistrationFeeService', () => {
  it('quotes the fee from the registration fee table', async () => {
    const { state, service } = build();
    expect(await service.quote(USER)).toEqual({ amountRwf: 5_000, paid: null });
    state.fee = 6_000;
    expect((await service.quote(USER)).amountRwf).toBe(6_000);
  });

  it('asks on the phone and reads paid once the prompt is approved', async () => {
    const { service } = build();
    const asked = await service.checkout(USER, momo(), 'k1');
    expect(asked.amountRwf).toBe(5_000);
    const polled = await service.payment(USER, asked.id);
    expect(polled.status).toBe('paid');
    expect(polled.methodWords).toMatch(/^MTN MoMo 078/);
    expect((await service.quote(USER)).paid?.id).toBe(asked.id);
  });

  it('a number ending 0000 declines, and nothing is taken', async () => {
    const { service } = build();
    const failed = await service.checkout(USER, momo('0788120000'), 'k1');
    expect(failed.status).toBe('failed');
    expect(failed.failureReason).toMatch(/declined/);
    expect((await service.quote(USER)).paid).toBeNull();
  });

  it('the same key is the same payment; a paid fee is not charged again', async () => {
    const { state, service } = build();
    const first = await service.checkout(USER, momo(), 'k1');
    const again = await service.checkout(USER, momo(), 'k1');
    expect(again.id).toBe(first.id);
    await service.payment(USER, first.id);
    const third = await service.checkout(USER, momo(), 'k2');
    expect(third.id).toBe(first.id);
    expect(state.rows).toHaveLength(1);
  });

  it('another person cannot read the payment, and a broker cannot pay again', async () => {
    const { state, service } = build();
    const asked = await service.checkout(USER, momo(), 'k1');
    await expect(service.payment(OTHER, asked.id)).rejects.toBeInstanceOf(NotFoundException);
    state.brokers.push(USER);
    await expect(service.checkout(USER, momo(), 'k3')).rejects.toBeInstanceOf(ConflictException);
  });

  it('checks the phone against the network', () => {
    expect(BrokerFeeCheckoutRequest.safeParse({ method: 'airtel_money', phone: '0788123456' }).success).toBe(false);
    expect(BrokerFeeCheckoutRequest.safeParse({ method: 'airtel_money', phone: '0732123456' }).success).toBe(true);
  });
});
