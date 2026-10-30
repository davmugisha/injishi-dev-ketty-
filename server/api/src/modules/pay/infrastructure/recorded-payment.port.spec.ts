import { describe, expect, it, type Mock, vi } from 'vitest';

import { PaymentSeam, resolvePaymentSeam } from '../domain/payment-seam';
import {
  PaymentDeclinedError,
  PaymentUnavailableError,
  type OneTimeFeeCommand,
  type PaymentPort,
  type PaymentReceipt,
} from '../domain/payment-port';
import { referenceFor } from '../domain/reference';
import {
  type PaymentTransactionsRepository,
  RefundExceedsCollectionError,
  type TransactionRow,
} from './payment-transactions.repository';
import type { RefundsOwedService } from '../application/refunds-owed.service';
import { RecordedPaymentPort } from './recorded-payment.port';

/**
 * The bank record's writer (073-gtbank-payments AC-2, AC-6, AC-7, AC-9). These
 * pin the order (row before call), the three outcomes of a failed call, and the
 * one rule that keeps a retry from charging twice: a row that may already have
 * reached the provider is never sent again.
 */
describe('RecordedPaymentPort', () => {
  const fee: OneTimeFeeCommand = {
    kind: 'one_time_fee',
    purpose: 'registration_fee',
    feeCode: 'registration_fee',
    idempotencyKey: 'ws-1:registration-fee:tok-1',
    amountRwf: 250_000,
    currency: 'RWF',
    workspaceId: 'ws-1',
    instrument: { kind: 'mobile_money', network: 'mtn_momo', msisdn: '788123456' },
  };
  const receipt: PaymentReceipt = {
    adapterRef: 'ref-1',
    mode: 'mock',
    replayed: false,
    amountRwf: 250_000,
    currency: 'RWF',
    occurredAt: new Date(),
    settlement: 'pending',
  };

  function existing(over: Partial<TransactionRow>): TransactionRow {
    return {
      id: 'tx-1',
      idempotencyKey: fee.idempotencyKey,
      reference: referenceFor(fee.idempotencyKey),
      providerReference: null,
      provider: 'mock',
      adapterMode: 'mock',
      direction: 'collection',
      operation: 'one_time_fee',
      workspaceId: 'ws-1',
      amountRwf: 250_000,
      feeRwf: 0,
      status: 'sending',
      failureReason: null,
      queueReason: null,
      providerStatus: null,
      payerMsisdn: '788123456',
      payerNetwork: 'mtn_momo',
      bookingId: null,
      originalTransactionId: null,
      moneyOverrideId: null,
      attempts: 0,
      sentAt: null,
      nextAttemptAt: null,
      createdAt: new Date(),
      finalAt: null,
      ...over,
    };
  }

  function build(opts: {
    env?: Record<string, string>;
    existingRow?: TransactionRow;
    callRejects?: Error;
    resendWins?: boolean;
    prepared?: unknown;
    oweRejects?: Error;
  } = {}): {
    port: RecordedPaymentPort;
    record: Record<string, Mock>;
    refunds: Record<string, Mock>;
    inner: { mode: string; chargeOneTimeFee: Mock; fetchTransaction: Mock; refund: Mock };
    calls: string[];
  } {
    const calls: string[] = [];
    const record = {
      recordCollection: vi.fn(async () => {
        calls.push('record');
        return opts.existingRow
          ? { row: opts.existingRow, created: false }
          : { row: existing({}), created: true };
      }),
      markAnswered: vi.fn().mockResolvedValue(undefined),
      markUnanswered: vi.fn().mockResolvedValue(undefined),
      resend: vi.fn().mockResolvedValue(opts.resendWins ?? true),
      findByProviderReference: vi.fn().mockResolvedValue(null),
      findByReference: vi.fn().mockResolvedValue(null),
      applyPulled: vi.fn().mockResolvedValue(true),
      flagCollectionReversal: vi.fn().mockResolvedValue(true),
    };
    const inner = {
      mode: 'mock',
      chargeOneTimeFee: vi.fn(async () => {
        calls.push('call');
        if (opts.callRejects) throw opts.callRejects;
        return receipt;
      }),
      fetchTransaction: vi.fn().mockResolvedValue({ ...receipt, settlement: 'settled' }),
      refund: vi.fn().mockResolvedValue({ ...receipt, adapterRef: 'legacy-refund', settlement: 'settled' }),
    };
    const refunds = {
      prepare: vi.fn().mockResolvedValue(opts.prepared ?? null),
      owe: vi.fn(async (_prepared: unknown, request: { idempotencyKey: string; amountRwf: number }) => {
        if (opts.oweRejects) throw opts.oweRejects;
        return {
          row: existing({
            id: 'tx-2',
            direction: 'disbursement',
            operation: 'refund',
            idempotencyKey: request.idempotencyKey,
            reference: referenceFor(request.idempotencyKey),
            amountRwf: request.amountRwf,
            status: 'queued',
            queueReason: 'awaiting_dispatch',
          }),
          created: true,
          amountRwf: request.amountRwf,
          openSiblings: false,
        };
      }),
    };
    const port = new RecordedPaymentPort(
      inner as unknown as PaymentPort,
      record as unknown as PaymentTransactionsRepository,
      new PaymentSeam(resolvePaymentSeam(opts.env ?? {})),
      refunds as unknown as RefundsOwedService,
    );
    return { port, record, refunds, inner, calls };
  }

  it('writes the row BEFORE the call, with the derived reference and the whole payer number', async () => {
    const { port, record, calls } = build();

    await port.chargeOneTimeFee(fee);

    expect(calls).toEqual(['record', 'call']);
    expect(record.recordCollection).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: fee.idempotencyKey,
        reference: referenceFor(fee.idempotencyKey),
        operation: 'one_time_fee',
        payerMsisdn: '788123456',
        payerNetwork: 'mtn_momo',
        provider: 'mock',
      }),
    );
    expect(record.markAnswered).toHaveBeenCalledWith(fee.idempotencyKey, {
      settled: false,
      providerReference: 'ref-1',
      adapterMode: 'mock',
    });
  });

  it('refuses a purpose that is not live, writing and sending nothing (AC-2)', async () => {
    const { port, record, inner } = build({
      env: { PAYMENT_ADAPTER_MODE: 'live', PAYMENT_LIVE_PURPOSES: 'booking' },
    });

    const error = await port.chargeOneTimeFee(fee).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PaymentUnavailableError);
    expect((error as PaymentUnavailableError).delivered).toBe('no');
    expect(record.recordCollection).not.toHaveBeenCalled();
    expect(inner.chargeOneTimeFee).not.toHaveBeenCalled();
  });

  it('records a decline as failed, a refusal before delivery as not_sent, and a timeout as unknown (AC-7)', async () => {
    const declined = build({ callRejects: new PaymentDeclinedError('customer said no', fee.idempotencyKey) });
    await expect(declined.port.chargeOneTimeFee(fee)).rejects.toBeInstanceOf(PaymentDeclinedError);
    expect(declined.record.markUnanswered).toHaveBeenCalledWith(fee.idempotencyKey, 'failed', 'customer said no');

    const refused = build({ callRejects: new PaymentUnavailableError('circuit open', fee.idempotencyKey, 'no') });
    await expect(refused.port.chargeOneTimeFee(fee)).rejects.toBeInstanceOf(PaymentUnavailableError);
    expect(refused.record.markUnanswered).toHaveBeenCalledWith(fee.idempotencyKey, 'not_sent', 'circuit open');

    const timedOut = build({ callRejects: new PaymentUnavailableError('no answer within 8000ms', fee.idempotencyKey) });
    await expect(timedOut.port.chargeOneTimeFee(fee)).rejects.toBeInstanceOf(PaymentUnavailableError);
    expect(timedOut.record.markUnanswered).toHaveBeenCalledWith(
      fee.idempotencyKey,
      'unknown',
      expect.stringContaining('no answer'),
    );
  });

  it('never sends again a press that may already have reached the provider', async () => {
    for (const status of ['sending', 'unknown'] as const) {
      const { port, inner } = build({ existingRow: existing({ status }) });
      const error = await port.chargeOneTimeFee(fee).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(PaymentUnavailableError);
      expect((error as PaymentUnavailableError).delivered).toBe('maybe');
      expect(inner.chargeOneTimeFee).not.toHaveBeenCalled();
    }
  });

  it('replays an answered press from its row, without asking the provider again', async () => {
    const { port, inner } = build({
      existingRow: existing({ status: 'pending', providerReference: 'ref-1' }),
    });

    const replay = await port.chargeOneTimeFee(fee);

    expect(replay).toMatchObject({ adapterRef: 'ref-1', replayed: true, settlement: 'pending' });
    expect(inner.chargeOneTimeFee).not.toHaveBeenCalled();
  });

  it('sends again a press that never reached the provider, and refuses a changed amount', async () => {
    const resent = build({ existingRow: existing({ status: 'not_sent' }) });
    await resent.port.chargeOneTimeFee(fee);
    expect(resent.record.resend).toHaveBeenCalledWith(fee.idempotencyKey);
    expect(resent.inner.chargeOneTimeFee).toHaveBeenCalledTimes(1);

    const changed = build({ existingRow: existing({ amountRwf: 1 }) });
    await expect(changed.port.chargeOneTimeFee(fee)).rejects.toBeInstanceOf(PaymentDeclinedError);
    expect(changed.inner.chargeOneTimeFee).not.toHaveBeenCalled();
  });

  it('applies a pulled settlement to the collection it names (AC-6a)', async () => {
    const { port, record } = build();
    record.findByProviderReference.mockResolvedValue(existing({ status: 'pending', providerReference: 'ref-1' }));

    await port.fetchTransaction('ws-1', 'ref-1');

    expect(record.findByProviderReference).toHaveBeenCalledWith('mock', 'ref-1');
    expect(record.applyPulled).toHaveBeenCalledWith('tx-1', 'successful');
  });

  it('flags a reversal on a successful collection, and only a pull applies it (AC-18)', async () => {
    const { port, record, inner } = build();
    record.findByProviderReference.mockResolvedValue(existing({ status: 'successful', providerReference: 'ref-1' }));
    inner.fetchTransaction.mockResolvedValue({ ...receipt, settlement: 'settled', providerStatus: 'reversed' });

    await port.fetchTransaction('ws-1', 'ref-1');

    expect(record.flagCollectionReversal).toHaveBeenCalledWith('tx-1', 'reversed');
    expect(record.applyPulled).not.toHaveBeenCalled();
  });

  it('finds a row by our own reference, and never fails it because the bank has nothing under that name (AC-7)', async () => {
    const { port, record, inner } = build();
    record.findByReference.mockResolvedValue(existing({ status: 'unknown', providerReference: null }));
    inner.fetchTransaction.mockResolvedValue(null);

    await port.fetchTransaction('ws-1', referenceFor(fee.idempotencyKey));

    expect(record.findByReference).toHaveBeenCalledWith(referenceFor(fee.idempotencyKey));
    expect(record.applyPulled).not.toHaveBeenCalled();
  });

  describe('a refund (AC-11)', () => {
    const refund = {
      kind: 'refund' as const,
      idempotencyKey: 'refund:ws-1:booking:b-1',
      originalRef: 'ref-1',
      amountRwf: 100_000,
      currency: 'RWF' as const,
      workspaceId: 'ws-1',
    };

    it('is written owed, for exactly the amount asked, and answered pending without calling the provider', async () => {
      const { port, refunds, inner } = build({ prepared: { collection: existing({}) } });

      const answer = await port.refund(refund);

      expect(refunds.owe).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ idempotencyKey: refund.idempotencyKey, amountRwf: 100_000, fit: 'exact', operation: 'refund' }),
      );
      expect(inner.refund).not.toHaveBeenCalled();
      expect(answer).toMatchObject({ settlement: 'pending', replayed: false, adapterRef: referenceFor(refund.idempotencyKey) });
    });

    it('goes straight to the provider when its collection predates the bank record', async () => {
      const { port, refunds, inner } = build({ prepared: null });

      const answer = await port.refund(refund);

      expect(refunds.owe).not.toHaveBeenCalled();
      expect(inner.refund).toHaveBeenCalledTimes(1);
      expect(answer.adapterRef).toBe('legacy-refund');
    });

    it('is declined when it exceeds what remains of the payment', async () => {
      const { port } = build({
        prepared: { collection: existing({}) },
        oweRejects: new RefundExceedsCollectionError(5_000, refund.idempotencyKey),
      });

      await expect(port.refund(refund)).rejects.toBeInstanceOf(PaymentDeclinedError);
    });
  });
});
