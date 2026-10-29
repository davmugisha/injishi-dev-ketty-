import { describe, expect, it } from 'vitest';

import { PaymentUnavailableError } from '../domain/payment-port';
import { resolveMode } from '../payments.module';
import { OffPaymentAdapter } from './off-payment.adapter';

/**
 * Payments switched off: what production runs until a provider is signed
 * (booking audit, 2026-09-13). It must refuse every movement of money in the
 * one way every caller already reads as "nothing was charged".
 */
describe('OffPaymentAdapter', () => {
  const adapter = new OffPaymentAdapter();

  it('refuses a capture as unavailable, never as a decline or a success', async () => {
    await expect(
      adapter.captureEscrow({
        kind: 'escrow_capture',
      purpose: 'booking',
        idempotencyKey: 'ws:booking-capture:tok',
        amountRwf: 94_500,
        currency: 'RWF',
        workspaceId: 'ws',
        instrument: { kind: 'mobile_money', network: 'mtn_momo', msisdn: '788123456' },
      }),
    ).rejects.toBeInstanceOf(PaymentUnavailableError);
  });

  it('refuses a refund and a read the same way', async () => {
    await expect(
      adapter.refund({
        kind: 'refund',
        idempotencyKey: 'refund:k',
        originalRef: 'ref',
        amountRwf: 1,
        currency: 'RWF',
        workspaceId: 'ws',
      }),
    ).rejects.toBeInstanceOf(PaymentUnavailableError);
    await expect(adapter.fetchTransaction('ws', 'ref')).rejects.toBeInstanceOf(PaymentUnavailableError);
  });

  it('is not reported as a mock', () => {
    expect(adapter.mode).not.toBe('mock');
  });
});

describe('PAYMENT_ADAPTER_MODE', () => {
  it('reads off, mock and live, and defaults to mock only when unset', () => {
    expect(resolveMode(' OFF ')).toBe('off');
    expect(resolveMode('live')).toBe('live');
    expect(resolveMode(undefined)).toBe('mock');
  });

  it('refuses a value it cannot read', () => {
    expect(() => resolveMode('disabled')).toThrow(/"mock", "live" or "off"/);
  });
});
