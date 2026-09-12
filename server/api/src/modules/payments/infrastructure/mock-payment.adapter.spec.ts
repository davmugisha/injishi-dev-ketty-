import {
  type CaptureEscrowCommand,
  PaymentDeclinedError,
} from '../domain/payment-port';
import { MockPaymentAdapter } from './mock-payment.adapter';

/**
 * The mock adapter is not test scaffolding, it is the MVP's payment provider
 * (F-S08: "Mocked at MVP behind a stable seam"). Every money movement the
 * platform makes goes through it until a gateway exists, so the guarantees it
 * makes are the guarantees the platform has, and they are pinned here.
 */
describe('MockPaymentAdapter', () => {
  const WORKSPACE = '33333333-3333-3333-3333-333333333333';

  function capture(
    overrides: Partial<CaptureEscrowCommand> = {},
  ): CaptureEscrowCommand {
    return {
      kind: 'escrow_capture',
      idempotencyKey: 'booking-capture:abc',
      amountRwf: 50_000,
      currency: 'RWF',
      workspaceId: WORKSPACE,
      // Required since ADR-047: a capture names WHO is paying and on which
      // rail. The mock ignores it, and that is the point of pinning it here —
      // the first live adapter reads this field, so the seam has to carry it
      // whether or not today's implementation looks at it.
      instrument: {
        kind: 'mobile_money',
        network: 'mtn_momo',
        msisdn: '788123456',
      },
      ...overrides,
    };
  }

  it('reports its own mode, which is what the F-A09 badge reads', () => {
    expect(new MockPaymentAdapter().mode).toBe('mock');
  });

  it('returns a provider reference reconciliation can match on', async () => {
    const receipt = await new MockPaymentAdapter().captureEscrow(capture());

    expect(receipt.adapterRef).toContain('booking-capture:abc');
    expect(receipt.mode).toBe('mock');
    expect(receipt.replayed).toBe(false);
    expect(receipt.amountRwf).toBe(50_000);
  });

  /**
   * The guarantee the compensating refund in BookingService depends on. Without
   * it, a retried refund pays out twice.
   */
  it('replays a repeated key instead of doing the work twice', async () => {
    const adapter = new MockPaymentAdapter();

    const first = await adapter.captureEscrow(capture());
    const second = await adapter.captureEscrow(capture());

    expect(second.replayed).toBe(true);
    expect(second.adapterRef).toBe(first.adapterRef);
    expect(second.occurredAt).toEqual(first.occurredAt);
  });

  /**
   * A settled key that accepts a different amount is a way to rewrite a charge
   * after the fact. Real providers refuse it; so does this.
   */
  it('refuses a settled key presented with a different amount', async () => {
    const adapter = new MockPaymentAdapter();
    await adapter.captureEscrow(capture({ amountRwf: 50_000 }));

    await expect(
      adapter.captureEscrow(capture({ amountRwf: 90_000 })),
    ).rejects.toBeInstanceOf(PaymentDeclinedError);
  });

  it.each([0, -1, 1.5])('declines an amount of %p', async (amountRwf) => {
    await expect(
      new MockPaymentAdapter().captureEscrow(capture({ amountRwf })),
    ).rejects.toBeInstanceOf(PaymentDeclinedError);
  });

  /**
   * The exact shape of the bug that shipped.
   *
   * `compensate()` handed `refund` the capture's own key. A memory scoped by key
   * alone found the capture, saw the same amount, and returned it as a replay,
   * so no money came back and the caller was told it had. The service no longer
   * reuses the key, and the adapter no longer could be fooled if it did.
   */
  it('does NOT answer a refund with the capture that shares its key', async () => {
    const adapter = new MockPaymentAdapter();
    const captured = await adapter.captureEscrow(capture());

    const refunded = await adapter.refund({
      kind: 'refund',
      idempotencyKey: capture().idempotencyKey, // deliberately the SAME key
      originalRef: captured.adapterRef,
      amountRwf: captured.amountRwf, // and deliberately the SAME amount
      currency: 'RWF',
      workspaceId: WORKSPACE,
    });

    expect(refunded.replayed).toBe(false);
    expect(refunded.adapterRef).not.toBe(captured.adapterRef);
  });

  it('keeps each operation on its own key, so a refund is not a replayed capture', async () => {
    const adapter = new MockPaymentAdapter();
    const captured = await adapter.captureEscrow(capture());

    const refunded = await adapter.refund({
      kind: 'refund',
      idempotencyKey: 'refund:abc',
      originalRef: captured.adapterRef,
      amountRwf: 50_000,
      currency: 'RWF',
      workspaceId: WORKSPACE,
    });

    expect(refunded.replayed).toBe(false);
    expect(refunded.adapterRef).not.toBe(captured.adapterRef);
  });
  // --- What the seam gained on ratification (ADR-020 D-b, D-e) -------------

  /**
   * A MOBILE MONEY capture waits on a handset and comes back `pending`; a card
   * settles inside the call (ADR-047 D-j). This test used to assert the
   * opposite — "always settles, because there is no handset to wait for" —
   * which was true of the mock and false of every rail it stood in for, and
   * it is why the async path had never once been run.
   *
   * `mock-momo-rail.spec.ts` covers the prompt, the approval and the decline.
   */
  it('settles a card inside the call', async () => {
    const adapter = new MockPaymentAdapter();

    const captured = await adapter.captureEscrow(
      capture({ instrument: { kind: 'card', token: 'tok_test' } }),
    );

    expect(captured.settlement).toBe('settled');
  });

  /**
   * Ending a hold is its own instruction, not a refund by another name. The
   * beneficiary is the whole meaning of the call, and the two outcomes it picks
   * between are `refunded_full` and `forfeited`.
   */
  it('records a release like any other movement of money', async () => {
    const adapter = new MockPaymentAdapter();
    const captured = await adapter.captureEscrow(capture());

    const released = await adapter.releaseEscrow({
      kind: 'escrow_release',
      beneficiary: 'guest',
      idempotencyKey: `escrow-release:${capture().idempotencyKey}`,
      originalRef: captured.adapterRef,
      amountRwf: captured.amountRwf,
      currency: 'RWF',
      workspaceId: WORKSPACE,
    });

    expect(released.replayed).toBe(false);
    expect(released.adapterRef).not.toBe(captured.adapterRef);
  });

  it('replays a repeated release rather than ending the hold twice', async () => {
    const adapter = new MockPaymentAdapter();
    const captured = await adapter.captureEscrow(capture());
    const command = {
      kind: 'escrow_release' as const,
      beneficiary: 'guest' as const,
      idempotencyKey: 'escrow-release:abc',
      originalRef: captured.adapterRef,
      amountRwf: captured.amountRwf,
      currency: 'RWF' as const,
      workspaceId: WORKSPACE,
    };

    await adapter.releaseEscrow(command);
    const again = await adapter.releaseEscrow(command);

    expect(again.replayed).toBe(true);
  });

  it('cancels an unsettled capture on its own key', async () => {
    const adapter = new MockPaymentAdapter();
    const captured = await adapter.captureEscrow(capture());

    const voided = await adapter.voidPending({
      kind: 'void_pending',
      idempotencyKey: `void:${capture().idempotencyKey}`,
      originalRef: captured.adapterRef,
      amountRwf: captured.amountRwf,
      currency: 'RWF',
      workspaceId: WORKSPACE,
    });

    expect(voided.replayed).toBe(false);
    expect(voided.adapterRef).not.toBe(captured.adapterRef);
  });

  /**
   * Reconciliation (F-A06) compares the `escrows` mirror against this. A mirror
   * that cannot be compared against the thing it mirrors is not a mirror.
   */
  it('reads a transaction back by the provider reference it issued', async () => {
    const adapter = new MockPaymentAdapter();
    const captured = await adapter.captureEscrow(capture());

    const found = await adapter.fetchTransaction(
      WORKSPACE,
      captured.adapterRef,
    );

    // Pending, because the default instrument is a mobile money one and the
    // customer has not approved it yet. Reconciliation must be able to read a
    // capture that is still in flight, not only a finished one.
    expect(found).toMatchObject({
      adapterRef: captured.adapterRef,
      amountRwf: captured.amountRwf,
      settlement: 'pending',
    });
  });

  it('answers null for a reference it never issued', async () => {
    const adapter = new MockPaymentAdapter();

    await expect(
      adapter.fetchTransaction(WORKSPACE, 'mock_escrow_capture_nobody'),
    ).resolves.toBeNull();
  });

  /**
   * A reference is guessable enough that an unscoped lookup would be a
   * cross-tenant read. Money is scoped per workspace, and so is reading it.
   */
  it('refuses to read one workspace transaction from another', async () => {
    const adapter = new MockPaymentAdapter();
    const captured = await adapter.captureEscrow(capture());

    await expect(
      adapter.fetchTransaction(
        '44444444-4444-4444-4444-444444444444',
        captured.adapterRef,
      ),
    ).resolves.toBeNull();
  });
});
