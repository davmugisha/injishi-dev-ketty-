import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PAYMENT_PROMPT_TTL_SECONDS } from '@injishi/contracts';

import { PaymentDeclinedError, type CaptureEscrowCommand } from '../domain/payment-port';
import { MockPaymentAdapter, decodeCaptureRef } from './mock-payment.adapter';

/**
 * The mock behaving like a handset rail (ADR-047 D-j).
 *
 * This adapter used to report every capture `settled`, and its own comment
 * explained why: `BookingService` refused an unsettled one with a 402, so a
 * truthful mock "would refuse every booking in development". The async path —
 * the one almost every real payment on this platform will take — had therefore
 * never been run, and the first execution of it would have been against a live
 * provider on go-live day.
 *
 * These tests pin the behaviour that replaced it, so the demo stays honest
 * about the rail rather than drifting back to something convenient.
 */
describe('MockPaymentAdapter — the mobile money rail', () => {
  const WORKSPACE = '33333333-3333-3333-3333-333333333333';

  function capture(
    overrides: Partial<CaptureEscrowCommand> = {},
  ): CaptureEscrowCommand {
    return {
      kind: 'escrow_capture',
      purpose: 'booking',
      idempotencyKey: `booking-capture:${Math.random().toString(16).slice(2)}`,
      amountRwf: 94_500,
      currency: 'RWF',
      workspaceId: WORKSPACE,
      instrument: { kind: 'mobile_money', network: 'mtn_momo', msisdn: '788123456' },
      ...overrides,
    };
  }

  beforeEach(() => {
    // Settle on the first poll, so these tests do not wait on a clock.
    process.env.MOCK_MOMO_APPROVAL_MS = '0';
  });

  afterEach(() => {
    delete process.env.MOCK_MOMO_APPROVAL_MS;
  });

  it('answers a mobile money capture PENDING, the way both rails do', async () => {
    const adapter = new MockPaymentAdapter();
    const receipt = await adapter.captureEscrow(capture());

    // Not settled. The customer has not touched their phone yet, and a seam
    // that claimed otherwise is what made the async path untestable.
    expect(receipt.settlement).toBe('pending');
    expect(receipt.adapterRef).toContain('escrow_capture');
  });

  it('settles a card inside the call, because a card rail does', async () => {
    const adapter = new MockPaymentAdapter();
    const receipt = await adapter.captureEscrow(
      capture({ instrument: { kind: 'card', token: 'tok_test' } }),
    );
    expect(receipt.settlement).toBe('settled');
  });

  it('settles the prompt once the imaginary customer has approved it', async () => {
    const adapter = new MockPaymentAdapter();
    const pending = await adapter.captureEscrow(capture());
    expect(pending.settlement).toBe('pending');

    const settled = await adapter.fetchTransaction(WORKSPACE, pending.adapterRef);
    expect(settled?.settlement).toBe('settled');
  });

  it('does not settle before the customer has had time to approve', async () => {
    process.env.MOCK_MOMO_APPROVAL_MS = '60000';
    const adapter = new MockPaymentAdapter();
    const pending = await adapter.captureEscrow(capture());

    const still = await adapter.fetchTransaction(WORKSPACE, pending.adapterRef);
    expect(still?.settlement).toBe('pending');
  });

  it('stays settled once it has settled, so a booking cannot see it flip back', async () => {
    const adapter = new MockPaymentAdapter();
    const pending = await adapter.captureEscrow(capture());

    await adapter.fetchTransaction(WORKSPACE, pending.adapterRef);
    const again = await adapter.fetchTransaction(WORKSPACE, pending.adapterRef);
    expect(again?.settlement).toBe('settled');
  });

  it('replays a settled capture as settled, not as a fresh prompt', async () => {
    const adapter = new MockPaymentAdapter();
    const command = capture();

    const first = await adapter.captureEscrow(command);
    await adapter.fetchTransaction(WORKSPACE, first.adapterRef);

    // The guest's browser retried after the prompt was approved. A replay that
    // came back `pending` would send them round the waiting screen again for a
    // payment that has already landed.
    const replay = await adapter.captureEscrow(command);
    expect(replay.replayed).toBe(true);
    expect(replay.settlement).toBe('settled');
  });

  it('does not restart the clock when a client polls the capture in a loop', async () => {
    process.env.MOCK_MOMO_APPROVAL_MS = '50';
    const adapter = new MockPaymentAdapter();
    const command = capture();

    await adapter.captureEscrow(command);
    // A client that re-POSTs while waiting must not push the approval further
    // away, or a prompt could stay pending for ever.
    await adapter.captureEscrow(command);
    await new Promise((r) => setTimeout(r, 80));

    const ref = (await adapter.captureEscrow(command)).adapterRef;
    const now = await adapter.fetchTransaction(WORKSPACE, ref);
    expect(now?.settlement).toBe('settled');
  });

  it('declines the reserved test number, so the refusal path is walkable', async () => {
    const adapter = new MockPaymentAdapter();
    await expect(
      adapter.captureEscrow(
        capture({
          instrument: { kind: 'mobile_money', network: 'mtn_momo', msisdn: '788120000' },
        }),
      ),
    ).rejects.toBeInstanceOf(PaymentDeclinedError);
  });

  /*
   * The API is two processes with an adapter each. The worker's sweep asks
   * about captures the HTTP process made, and used to be told they did not
   * exist (booking audit, 2026-09-13).
   */
  it('lets another process read a capture it never made, settled on the same clock', async () => {
    // A second, not 40 ms: the first read must land inside the window to see
    // `pending`, and on a busy machine (the full suite, CI) 40 ms was
    // sometimes gone before it did, failing a correct adapter.
    process.env.MOCK_MOMO_APPROVAL_MS = '1000';
    const http = new MockPaymentAdapter();
    const worker = new MockPaymentAdapter();
    const pending = await http.captureEscrow(capture());

    expect((await worker.fetchTransaction(WORKSPACE, pending.adapterRef))?.settlement).toBe('pending');
    await new Promise((r) => setTimeout(r, 1200));
    expect(await worker.fetchTransaction(WORKSPACE, pending.adapterRef)).toMatchObject({
      settlement: 'settled',
      amountRwf: 94_500,
      adapterRef: pending.adapterRef,
    });
  });

  it('keeps that cross process read scoped to the workspace in the reference', async () => {
    const pending = await new MockPaymentAdapter().captureEscrow(capture());
    expect(
      await new MockPaymentAdapter().fetchTransaction('99999999-9999-9999-9999-999999999999', pending.adapterRef),
    ).toBeNull();
  });

  it('has a slow approver who answers only after the prompt window', async () => {
    delete process.env.MOCK_MOMO_APPROVAL_MS;
    const adapter = new MockPaymentAdapter();
    const pending = await adapter.captureEscrow(
      capture({ instrument: { kind: 'mobile_money', network: 'mtn_momo', msisdn: '788129999' } }),
    );
    const settlesAt = decodeCaptureRef(pending.adapterRef)!.settlesAt;
    expect(settlesAt - Date.now()).toBeGreaterThan(PAYMENT_PROMPT_TTL_SECONDS * 1_000);
  });

  it('keeps a pending capture scoped to its workspace', async () => {
    const adapter = new MockPaymentAdapter();
    const pending = await adapter.captureEscrow(capture());

    // A reference is guessable enough that an unscoped read would be a
    // cross-tenant one.
    expect(
      await adapter.fetchTransaction('99999999-9999-9999-9999-999999999999', pending.adapterRef),
    ).toBeNull();
  });
  /*
   * A registration fee is a Request to Pay exactly as a capture is
   * (073-gtbank-payments AC-16), so the mock treats it the same way: pending,
   * readable from any process by its reference, and declinable by test number.
   */
  it('prompts for a registration fee and settles it on the same clock as a capture', async () => {
    const adapter = new MockPaymentAdapter();
    process.env.MOCK_MOMO_APPROVAL_MS = '60000';
    const fee = await adapter.chargeOneTimeFee({
      kind: 'one_time_fee',
      purpose: 'registration_fee',
      feeCode: 'registration_fee',
      idempotencyKey: 'ws:registration-fee:tok',
      amountRwf: 250_000,
      currency: 'RWF',
      workspaceId: WORKSPACE,
      instrument: { kind: 'mobile_money', network: 'mtn_momo', msisdn: '788123456' },
    });
    expect(fee.settlement).toBe('pending');
    expect(decodeCaptureRef(fee.adapterRef)?.kind).toBe('one_time_fee');
    // Another process reads it from the reference alone, still pending.
    const elsewhere = await new MockPaymentAdapter().fetchTransaction(WORKSPACE, fee.adapterRef);
    expect(elsewhere?.settlement).toBe('pending');
    expect(await new MockPaymentAdapter().fetchTransaction('another-workspace', fee.adapterRef)).toBeNull();
  });

  it('declines a registration fee from the reserved test number', async () => {
    await expect(
      new MockPaymentAdapter().chargeOneTimeFee({
        kind: 'one_time_fee',
        purpose: 'registration_fee',
        feeCode: 'registration_fee',
        idempotencyKey: 'ws:registration-fee:declined',
        amountRwf: 250_000,
        currency: 'RWF',
        workspaceId: WORKSPACE,
        instrument: { kind: 'mobile_money', network: 'mtn_momo', msisdn: '788120000' },
      }),
    ).rejects.toBeInstanceOf(PaymentDeclinedError);
  });
});
