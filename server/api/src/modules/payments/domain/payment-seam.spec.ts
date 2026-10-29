import { describe, expect, it } from 'vitest';

import { PaymentSeam, resolvePaymentSeam } from './payment-seam';
import { referenceFor } from './reference';

/**
 * The payment settings, read once at boot (073-gtbank-payments, interim
 * record). Every unreadable value must stop the process, because a typo in a
 * money setting quietly defaulting is a production incident.
 */
describe('resolvePaymentSeam', () => {
  it('defaults to mock with every purpose walkable and no limits', () => {
    const s = resolvePaymentSeam({});
    expect(s.mode).toBe('mock');
    expect(s.provider).toBe('mock');
    expect(s.livePurposes.size).toBe(0);
    expect(s.networks).toEqual(['mtn_momo', 'airtel_money']);
    expect(s.maxCollectionRwf).toBeNull();
    expect(s.settlementLagMinutes).toBe(0);
    expect(s.refundWindowDays).toBe(30);
  });

  it('refuses an unknown purpose, network, mode or number rather than defaulting', () => {
    expect(() => resolvePaymentSeam({ PAYMENT_LIVE_PURPOSES: 'registration_fee,bookings' })).toThrow(
      /PAYMENT_LIVE_PURPOSES names "bookings"/,
    );
    expect(() => resolvePaymentSeam({ GTBANK_RTP_NETWORKS: 'mtn_momo,tigo' })).toThrow(/tigo/);
    expect(() => resolvePaymentSeam({ PAYMENT_ADAPTER_MODE: 'disabled' })).toThrow(/"mock", "live" or "off"/);
    expect(() => resolvePaymentSeam({ GTBANK_MAX_COLLECTION_RWF: '12.5' })).toThrow(/positive whole number/);
    expect(() => resolvePaymentSeam({ GTBANK_COLLECTION_FEE_BPS: '-1' })).toThrow(/non negative/);
    expect(() => resolvePaymentSeam({ PAYMENT_REFUND_WINDOW_DAYS: '0' })).toThrow(/positive whole number/);
  });

  it('keeps GTBank settlement lag only under live; the mock settles at once', () => {
    expect(resolvePaymentSeam({ PAYMENT_ADAPTER_MODE: 'live' }).settlementLagMinutes).toBe(1440);
    expect(
      resolvePaymentSeam({ PAYMENT_ADAPTER_MODE: 'mock', GTBANK_SETTLEMENT_LAG_MINUTES: '60' }).settlementLagMinutes,
    ).toBe(0);
  });
});

describe('PaymentSeam', () => {
  const seam = (env: Record<string, string>): PaymentSeam => new PaymentSeam(resolvePaymentSeam(env));

  it('switches a purpose off under live unless it is on the allowlist (AC-2)', () => {
    const live = seam({ PAYMENT_ADAPTER_MODE: 'live', PAYMENT_LIVE_PURPOSES: 'registration_fee' });
    expect(live.isOffFor('registration_fee')).toBe(false);
    expect(live.isOffFor('booking')).toBe(true);
    expect(live.isOffFor('service_order')).toBe(true);
    expect(live.rules().livePurposes).toEqual(['registration_fee']);
  });

  it('runs every purpose under mock and none under off', () => {
    expect(seam({}).isOffFor('booking')).toBe(false);
    expect(seam({}).rules().livePurposes).toContain('service_order');
    const off = seam({ PAYMENT_ADAPTER_MODE: 'off' });
    expect(off.isOffFor('registration_fee')).toBe(true);
    expect(off.rules().livePurposes).toEqual([]);
  });

  it('refuses a card, an unprompted network and an amount over the limit, naming each (AC-23, AC-24)', () => {
    const mtn = { kind: 'mobile_money', network: 'mtn_momo', msisdn: '788123456' } as const;
    const airtel = { kind: 'mobile_money', network: 'airtel_money', msisdn: '738123456' } as const;
    const limited = seam({ GTBANK_RTP_NETWORKS: 'mtn_momo', GTBANK_MAX_COLLECTION_RWF: '500000' });

    expect(seam({}).ruleProblem(100, { kind: 'card', token: 't' })).toMatch(/Card payments are not taken yet/);
    expect(limited.ruleProblem(100, airtel)).toBe('Airtel Money payments are not taken yet. Pay with MTN MoMo.');
    expect(limited.ruleProblem(500_001, mtn)).toMatch(/at most RWF 500,000/);
    expect(limited.ruleProblem(500_000, mtn)).toBeNull();
    expect(seam({}).ruleProblem(10_000_000, airtel)).toBeNull();
  });

  it('estimates the collection fee in basis points, rounded down', () => {
    expect(seam({ GTBANK_COLLECTION_FEE_BPS: '250' }).collectionFeeFor(10_001)).toBe(250);
    expect(seam({}).collectionFeeFor(10_000)).toBe(0);
  });
});

describe('referenceFor', () => {
  it('derives the same 23 character reference from the same key, always (AC-6)', () => {
    const key = 'ws-1:registration-fee:tok-1';
    expect(referenceFor(key)).toBe(referenceFor(key));
    expect(referenceFor(key)).toMatch(/^INJ[A-Z2-7]{20}$/);
    expect(referenceFor(key)).not.toBe(referenceFor('ws-1:registration-fee:tok-2'));
  });
});
