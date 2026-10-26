import { PaymentSeam, resolvePaymentSeam } from '../domain/payment-seam';
import {
  PaymentDeclinedError,
  type PaymentPort,
  type PaymentReceipt,
  PaymentUnavailableError,
} from '../domain/payment-port';
import type { MoneyQueueRepository } from '../infrastructure/money-queue.repository';
import type { PayeeIdentityRepository } from '../infrastructure/payee-identity.repository';
import type {
  DispatchRow,
  PaymentTransactionsRepository,
  TransactionRow,
} from '../infrastructure/payment-transactions.repository';
import { DisbursementDispatcher } from './disbursement-dispatcher.service';
import type { PaymentOutcomes } from './payment-outcomes';

/**
 * The dispatcher (073-gtbank-payments AC-5, AC-7, AC-9a, AC-14a). The order and
 * the funding check live in SQL under the advisory lock and are proven against
 * a database by `verify-refunds-owed.mjs`; these pin what each answer from the
 * provider does to the row, and that the booking hears only of a changed row.
 */
describe('DisbursementDispatcher', () => {
  function row(over: Partial<TransactionRow> = {}): TransactionRow {
    return {
      id: 'd-1',
      idempotencyKey: 'cancel-refund:ws-1:booking:b-1',
      reference: 'INJREFUND',
      providerReference: null,
      provider: 'mock',
      adapterMode: 'mock',
      direction: 'disbursement',
      operation: 'refund',
      workspaceId: 'ws-1',
      amountRwf: 50_000,
      feeRwf: 0,
      status: 'sending',
      failureReason: null,
      queueReason: null,
      providerStatus: null,
      payerMsisdn: null,
      payerNetwork: null,
      bookingId: 'b-1',
      originalTransactionId: 'c-1',
      moneyOverrideId: null,
      attempts: 1,
      sentAt: new Date(),
      nextAttemptAt: null,
      createdAt: new Date(),
      finalAt: null,
      ...over,
    };
  }
  const due = (over: Partial<TransactionRow> = {}): DispatchRow => ({
    row: row(over),
    originalRef: 'mock_escrow_capture_ref',
    payee: {
      payeeFullName: 'Aline Uwase',
      payeeIdType: 'national_id',
      payeeIdNumber: '1199880012345678',
      payeeDestination: 'momo',
      payeeNetworkOrBank: 'mtn_momo',
      payeeAccount: '788123456',
      payeePhone: '+250788123456',
    },
  });
  const settled: PaymentReceipt = {
    adapterRef: 'mock_refund_x',
    mode: 'mock',
    replayed: false,
    amountRwf: 50_000,
    currency: 'RWF',
    occurredAt: new Date(),
    settlement: 'settled',
  };

  function build(opts: { sending?: DispatchRow[]; pulls?: DispatchRow[]; refund?: () => Promise<PaymentReceipt>; fetch?: () => Promise<PaymentReceipt | null>; env?: Record<string, string>; parked?: number; one?: DispatchRow } = {}): {
    dispatcher: DisbursementDispatcher;
    record: Record<string, jest.Mock>;
    outcomes: { disbursement: jest.Mock };
    port: Record<string, jest.Mock>;
  } {
    const record = {
      dueDisbursementPulls: jest.fn().mockResolvedValue(opts.pulls ?? []),
      claimForDispatch: jest.fn().mockResolvedValue({ sending: opts.sending ?? [], short: null, overLimit: [], balanceRwf: 0 }),
      applyDisbursementVerdict: jest.fn().mockResolvedValue(true),
      findById: jest.fn().mockResolvedValue({ id: 'c-1', idempotencyKey: 'ws-1:booking-capture:tok' }),
      dispatchRowById: jest.fn().mockResolvedValue(opts.one ?? null),
    };
    const queue = { balanceFacts: jest.fn().mockResolvedValue({ parkedCount: opts.parked ?? 0 }) };
    const port = {
      refund: jest.fn(opts.refund ?? (() => Promise.resolve(settled))),
      releaseEscrow: jest.fn(() => Promise.resolve(settled)),
      payout: jest.fn(() => Promise.resolve(settled)),
      fetchTransaction: jest.fn(opts.fetch ?? (() => Promise.resolve(settled))),
    };
    const outcomes = { disbursement: jest.fn().mockResolvedValue(undefined) };
    const payees = { payerOf: jest.fn().mockResolvedValue({ userId: 'u-1', bookingId: 'b-1' }) };
    const dispatcher = new DisbursementDispatcher(
      port as unknown as PaymentPort,
      record as unknown as PaymentTransactionsRepository,
      new PaymentSeam(resolvePaymentSeam(opts.env ?? {})),
      outcomes as unknown as PaymentOutcomes,
      payees as unknown as PayeeIdentityRepository,
      queue as unknown as MoneyQueueRepository,
    );
    return { dispatcher, record, outcomes, port };
  }

  it('sends a claimed refund back to the paying wallet with the payee, and tells the booking it was paid', async () => {
    const { dispatcher, record, outcomes, port } = build({ sending: [due()] });

    await dispatcher.tick();

    expect(port.refund).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'cancel-refund:ws-1:booking:b-1',
        originalRef: 'mock_escrow_capture_ref',
        payee: expect.objectContaining({
          fullName: 'Aline Uwase',
          destination: { kind: 'mobile_money', network: 'mtn_momo', msisdn: '788123456' },
        }),
      }),
    );
    expect(record.applyDisbursementVerdict).toHaveBeenCalledWith('d-1', expect.objectContaining({ kind: 'successful' }));
    expect(outcomes.disbursement).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'successful', bookingId: 'b-1', payerUserId: 'u-1' }),
    );
  });

  it('puts a short account back in the queue rather than failing it (AC-5, AC-14a)', async () => {
    const { dispatcher, record, outcomes } = build({
      sending: [due()],
      refund: () => Promise.reject(new PaymentDeclinedError('short', 'k', 'insufficient_funds')),
    });

    await dispatcher.tick();

    expect(record.applyDisbursementVerdict).toHaveBeenCalledWith(
      'd-1',
      expect.objectContaining({ kind: 'requeue', queueReason: 'insufficient_funds', nextAttemptAt: null }),
    );
    expect(outcomes.disbursement).not.toHaveBeenCalled();
  });

  it('sends nothing younger once the bank says the account is short for an older row (AC-14a)', async () => {
    const { dispatcher, record, port } = build({
      sending: [due(), due({ id: 'd-2', idempotencyKey: 'cancel-refund:ws-1:booking:b-2' })],
      refund: () => Promise.reject(new PaymentDeclinedError('short', 'k', 'insufficient_funds')),
    });

    const tick = await dispatcher.tick();

    expect(port.refund).toHaveBeenCalledTimes(1);
    expect(record.applyDisbursementVerdict).toHaveBeenCalledWith(
      'd-2',
      expect.objectContaining({ kind: 'requeue', queueReason: 'insufficient_funds' }),
    );
    expect(tick).toMatchObject({ sent: 1, short: true });
  });

  it('fails a refusal, remembers a name mismatch, and tells the payer it is delayed', async () => {
    const { dispatcher, record, outcomes } = build({
      sending: [due()],
      refund: () => Promise.reject(new PaymentDeclinedError('name does not match', 'k', 'name_mismatch')),
    });

    await dispatcher.tick();

    expect(record.applyDisbursementVerdict).toHaveBeenCalledWith(
      'd-1',
      expect.objectContaining({ kind: 'failed', providerStatus: 'name_mismatch' }),
    );
    expect(outcomes.disbursement).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  it('tries again next minute when nothing reached the provider, and parks one that may have (AC-7)', async () => {
    const notSent = build({
      sending: [due()],
      refund: () => Promise.reject(new PaymentUnavailableError('breaker open', 'k', 'no')),
    });
    await notSent.dispatcher.tick();
    expect(notSent.record.applyDisbursementVerdict).toHaveBeenCalledWith(
      'd-1',
      expect.objectContaining({ kind: 'requeue', queueReason: 'provider_unavailable' }),
    );

    const maybe = build({
      sending: [due()],
      refund: () => Promise.reject(new PaymentUnavailableError('timed out', 'k', 'maybe')),
    });
    await maybe.dispatcher.tick();
    expect(maybe.record.applyDisbursementVerdict).toHaveBeenCalledWith('d-1', expect.objectContaining({ kind: 'unknown' }));
    expect(maybe.outcomes.disbursement).not.toHaveBeenCalled();
  });

  it('never tells the booking twice: a verdict another caller applied first changes nothing (AC-6a)', async () => {
    const { dispatcher, record, outcomes } = build({ sending: [due()] });
    record.applyDisbursementVerdict.mockResolvedValue(false);

    await dispatcher.tick();

    expect(outcomes.disbursement).not.toHaveBeenCalled();
  });

  it('sends again a row the provider never received, and fails one it has no record of (AC-5)', async () => {
    const lost = build({ pulls: [due({ status: 'sending' })], fetch: () => Promise.resolve(null) });
    await lost.dispatcher.tick();
    expect(lost.record.applyDisbursementVerdict).toHaveBeenCalledWith(
      'd-1',
      expect.objectContaining({ kind: 'requeue', queueReason: 'provider_unavailable' }),
    );

    const gone = build({
      pulls: [due({ status: 'pending', providerReference: 'mock_refund_x' })],
      fetch: () => Promise.resolve(null),
    });
    await gone.dispatcher.tick();
    expect(gone.record.applyDisbursementVerdict).toHaveBeenCalledWith('d-1', expect.objectContaining({ kind: 'failed' }));
  });

  it('does nothing while payments are off', async () => {
    const { dispatcher, record } = build({ sending: [due()], env: { PAYMENT_ADAPTER_MODE: 'off' } });

    expect(await dispatcher.tick()).toEqual({ pulled: 0, sent: 0, short: false, overLimit: 0 });
    expect(record.claimForDispatch).not.toHaveBeenCalled();
  });

  it('finds a paid refund came back only when a person pulls it, and owes it again (AC-18, AC-20)', async () => {
    const { dispatcher, record, outcomes } = build({
      one: due({ status: 'successful', providerReference: 'mock_refund_x' }),
      fetch: () => Promise.resolve({ ...settled, providerStatus: 'reversed' }),
    });

    await dispatcher.pullOne('d-1');

    expect(record.applyDisbursementVerdict).toHaveBeenCalledWith('d-1', { kind: 'reversed', providerStatus: 'reversed' });
    expect(outcomes.disbursement).toHaveBeenCalledWith(expect.objectContaining({ status: 'reversed', bookingId: 'b-1' }));
  });

  it('leaves a paid refund alone when the bank still says it is paid', async () => {
    const { dispatcher, record } = build({ one: due({ status: 'successful', providerReference: 'mock_refund_x' }) });

    await dispatcher.pullOne('d-1');

    expect(record.applyDisbursementVerdict).not.toHaveBeenCalled();
  });

  it('counts what a machine is stuck on every tick, and alarms at most hourly (AC-27)', async () => {
    const { dispatcher } = build({ parked: 2 });
    const errorReporter = await import('../../../shared/observability/error-reporter');
    const alarm = jest.spyOn(errorReporter, 'reportAlarm').mockImplementation(() => undefined);

    await dispatcher.tick(new Date('2026-10-26T10:00:00Z'));
    await dispatcher.tick(new Date('2026-10-26T10:30:00Z'));
    await dispatcher.tick(new Date('2026-10-26T11:01:00Z'));

    expect(alarm.mock.calls.filter(([name]) => name === 'PAYMENT_PARKED')).toHaveLength(2);
    alarm.mockRestore();
  });
});
