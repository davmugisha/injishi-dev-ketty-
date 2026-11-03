import { describe, expect, it, type Mock, vi } from 'vitest';

import { UnprocessableEntityException } from '@nestjs/common';

import type { RegistrationFees } from '../domain/registration-fees';
import { PaymentSeam, resolvePaymentSeam } from '../../pay/domain/payment-seam';
import type { PaymentAttemptService } from './payment-attempt.service';
import { RegistrationFeePaymentService } from './registration-fee-payment.service';

/**
 * Paying the registration fee (073-gtbank-payments AC-2, AC-16). Every check
 * runs before any prompt, and the free path is exactly the stand in it
 * replaced, so these pin both.
 */
describe('RegistrationFeePaymentService', () => {
  const ORG = 'org-1';
  const USER = 'user-1';
  const summary = { orgId: ORG, status: 'submitted' };
  const owed: {
    status: string;
    workspaceId: string;
    invoiceId: string;
    amountDueRwf: number;
    legalName: string;
  } = {
    status: 'pending_payment',
    workspaceId: 'ws-1',
    invoiceId: 'invoice-1',
    amountDueRwf: 250_000,
    legalName: 'Isangano Lodge',
  };
  const good = {
    attemptToken: '5b0e8f2a-8c6e-4b9e-9a1c-2f1f9d6f4a10',
    instrument: { kind: 'mobile_money' as const, network: 'mtn_momo' as const, msisdn: '788123456' },
  };

  function build(
    env: Record<string, string>,
    facts: Partial<typeof owed> | null = owed,
  ): {
    service: RegistrationFeePaymentService;
    registrations: Record<string, Mock>;
    attempts: { beginForRegistrationFee: Mock };
  } {
    const registrations = {
      assertOwns: vi.fn().mockResolvedValue(undefined),
      settleFeeAndVerify: vi.fn().mockResolvedValue(summary),
      feeFacts: vi.fn().mockResolvedValue(facts ? { ...owed, ...facts } : null),
      summary: vi.fn().mockResolvedValue(summary),
      orgOfRegistrationInvoice: vi.fn().mockResolvedValue(ORG),
    };
    const attempts = {
      beginForRegistrationFee: vi.fn().mockResolvedValue({ attemptToken: good.attemptToken, state: 'prompting' }),
    };
    const service = new RegistrationFeePaymentService(
      registrations as unknown as RegistrationFees,
      attempts as unknown as PaymentAttemptService,
      new PaymentSeam(resolvePaymentSeam(env)),
    );
    return { service, registrations, attempts };
  }

  it('settles free, as the registrant, while payments are off (call 9)', async () => {
    const { service, registrations, attempts } = build({ PAYMENT_ADAPTER_MODE: 'off' });

    const result = await service.pay(ORG, USER, {});

    expect(result).toEqual({ kind: 'settled', registration: summary });
    expect(registrations.settleFeeAndVerify).toHaveBeenCalledWith(ORG, { trigger: 'registrant', actorUserId: USER });
    expect(attempts.beginForRegistrationFee).not.toHaveBeenCalled();
  });

  it('settles free under live when the fee is not on the live list (AC-2)', async () => {
    const { service, attempts } = build({ PAYMENT_ADAPTER_MODE: 'live', PAYMENT_LIVE_PURPOSES: 'booking' });
    const result = await service.pay(ORG, USER, good);
    expect(result.kind).toBe('settled');
    expect(attempts.beginForRegistrationFee).not.toHaveBeenCalled();
  });

  it('charges nothing for a fee already paid', async () => {
    const { service, attempts } = build({}, { status: 'submitted' });
    const result = await service.pay(ORG, USER, good);
    expect(result).toEqual({ kind: 'settled', registration: summary });
    expect(attempts.beginForRegistrationFee).not.toHaveBeenCalled();
  });

  it('refuses a missing number, a card and a number on the wrong network with 422', async () => {
    const { service, attempts } = build({});
    await expect(service.pay(ORG, USER, {})).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(
      service.pay(ORG, USER, { attemptToken: good.attemptToken, instrument: { kind: 'card', token: 't' } }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(
      service.pay(ORG, USER, {
        attemptToken: good.attemptToken,
        instrument: { kind: 'mobile_money', network: 'airtel_money', msisdn: '788123456' },
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(attempts.beginForRegistrationFee).not.toHaveBeenCalled();
  });

  it('refuses a fee above the collection limit, or on a network not prompted, before any attempt (AC-23)', async () => {
    const limited = build({ GTBANK_MAX_COLLECTION_RWF: '1000' });
    await expect(limited.service.pay(ORG, USER, good)).rejects.toThrow(/at most RWF 1,000/);
    const mtnOnly = build({ GTBANK_RTP_NETWORKS: 'airtel_money' });
    await expect(mtnOnly.service.pay(ORG, USER, good)).rejects.toThrow('MTN MoMo payments are not taken yet. Pay with Airtel Money.');
    expect(limited.attempts.beginForRegistrationFee).not.toHaveBeenCalled();
    expect(mtnOnly.attempts.beginForRegistrationFee).not.toHaveBeenCalled();
  });

  it('starts a Request to Pay for the pending invoice, with the registration attached', async () => {
    const { service, attempts } = build({});

    const result = await service.pay(ORG, USER, good);

    expect(attempts.beginForRegistrationFee).toHaveBeenCalledWith({
      invoiceId: 'invoice-1',
      workspaceId: 'ws-1',
      registrantUserId: USER,
      amountRwf: 250_000,
      legalName: 'Isangano Lodge',
      instrument: good.instrument,
      attemptToken: good.attemptToken,
    });
    expect(result).toMatchObject({ kind: 'attempt', attempt: { state: 'prompting', registration: summary } });
  });
});
