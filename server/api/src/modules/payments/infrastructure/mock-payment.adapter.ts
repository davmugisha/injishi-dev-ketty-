import { createHash } from 'node:crypto';

import { PAYMENT_PROMPT_TTL_SECONDS } from '@injishi/contracts';
import { Injectable, Logger } from '@nestjs/common';

import {
  type AdapterMode,
  type CallbackEvent,
  type CaptureEscrowCommand,
  type OneTimeFeeCommand,
  type PaymentCommand,
  type PaymentPort,
  type PaymentReceipt,
  type PayoutCommand,
  PaymentDeclinedError,
  type RecurringChargeCommand,
  type RefundCommand,
  type ReleaseEscrowCommand,
  type RentCollectCommand,
  type SubscriptionChargeCommand,
  type VendorPayoutCommand,
  type VoidPendingCommand,
  describeForLog,
} from '../domain/payment-port';

/**
 * The mock side of the payment seam (F-S08: "Mocked at MVP behind a stable
 * seam").
 *
 * It is deliberately NOT a stub that returns a constant. The whole value of
 * building the seam before the provider exists is that the business logic gets
 * exercised against something that behaves like a payment provider, so the
 * paths that only appear under a real one — a replayed idempotency key, a
 * decline, an amount that does not add up — are written and running now rather
 * than discovered on go-live day.
 *
 * So it enforces the things every real provider enforces:
 *
 * - **Idempotency, scoped per operation.** A repeated key on the SAME operation
 *   returns the ORIGINAL receipt with `replayed: true` and never does the work
 *   twice. The same key on a DIFFERENT operation is a different movement of
 *   money and is settled on its own. That scoping is load bearing: without it a
 *   refund keyed like its capture is answered with the capture.
 * - **Amount agreement.** The same key with a different amount is a decline,
 *   not a silent overwrite. A provider that let that through would be a way to
 *   rewrite a charge after the fact.
 * - **A refusal it can actually produce.** A non-positive amount is declined,
 *   because no provider accepts one and the caller needs that branch to exist.
 * - **A readable transaction record.** `fetchTransaction` answers out of the
 *   same memory the writes go into, workspace scoped, so reconciliation (F-A06)
 *   has something to compare the `escrows` mirror against (ADR-020 D-e).
 *
 * **It models the handset (ADR-047 D-j).** A mobile money capture comes back
 * `pending`, the way MTN and Airtel both answer one, and settles a few seconds
 * later as though somebody approved it on `*182#`. A card settles inside the
 * call, because a card rail does. Rent collected from a tenant (rentals
 * blueprint 2.7) and a landlord's phone paying a fixer go the same way.
 *
 * This used to always report `settled`, and the comment here said why: a mock
 * has no handset, and anything else "would refuse every booking in
 * development". That was true, and it was the problem — `BookingService`
 * refused an unsettled capture with a 402, so the async path every real payment
 * on this platform takes could not be reached end to end, and the first time
 * anyone would have run it was against a live provider on go-live day. The
 * booking path has somewhere to wait now, so the mock can tell the truth about
 * the rail.
 *
 * Two levers, both for walking the flow rather than for production:
 * `MOCK_MOMO_APPROVAL_MS` is how long the imaginary customer takes to approve
 * (default 6s; `0` settles instantly, which is what the tests want), and a
 * payer number ending `0000` is DECLINED, so the refusal path is walkable
 * without editing code.
 *
 * Its idempotency memory is per process and disappears on restart. That is
 * correct for a mock: durable money state belongs in the database, which is
 * where the `escrows` and `ledger_transactions` rows already are. This object
 * stands in for the PROVIDER's memory, not ours. The one fact every process
 * must agree on, whether a capture has settled, travels in its reference
 * instead (`encodeCaptureRef`).
 */
/**
 * How long the imaginary customer takes to approve the prompt.
 *
 * Six seconds by default: long enough that the waiting screen is real and gets
 * looked at, short enough that walking the flow is not a chore. `0` settles on
 * the first poll, which is what the tests set.
 */
function approvalDelayMs(msisdn: string): number {
  // The slow approver: approves just AFTER the prompt window. It is what lets a
  // lapsed hold, and the guest who loses the room to it, be walked end to end.
  if (msisdn.endsWith(LATE_APPROVER_SUFFIX)) {
    const raw = Number(process.env.MOCK_MOMO_LATE_APPROVAL_MS ?? (PAYMENT_PROMPT_TTL_SECONDS + 20) * 1_000);
    return Number.isFinite(raw) && raw >= 0 ? raw : (PAYMENT_PROMPT_TTL_SECONDS + 20) * 1_000;
  }
  const raw = Number(process.env.MOCK_MOMO_APPROVAL_MS ?? 6_000);
  return Number.isFinite(raw) && raw >= 0 ? raw : 6_000;
}

/** A payer number ending in this approves after the prompt window has closed. */
export const LATE_APPROVER_SUFFIX = '9999';

/** A payer number ending in this declines the prompt. Real providers publish test numbers that work this way. */
export const DECLINING_SUFFIX = '0000';

/**
 * The collections that wait on a handset: a booking's escrow capture, a
 * tenant's rent, a landlord's phone paying a fixer, a broker's plan month by
 * mobile money, and the card checkout page a broker is sent to.
 */
export type HandsetKind = 'escrow_capture' | 'rent_collect' | 'vendor_payout' | 'subscription_charge' | 'subscription_checkout' | 'one_time_fee';

const CAPTURE_REF_PREFIX: Readonly<Record<HandsetKind, string>> = {
  escrow_capture: 'mock_escrow_capture_',
  rent_collect: 'mock_rent_collect_',
  vendor_payout: 'mock_vendor_payout_',
  subscription_charge: 'mock_subscription_charge_',
  subscription_checkout: 'mock_subscription_checkout_',
  one_time_fee: 'mock_one_time_fee_',
};

/** The port operation a handset kind's receipt is remembered under. */
function operationOf(kind: HandsetKind): PaymentCommand['kind'] {
  return kind === 'subscription_checkout' ? 'subscription_charge' : kind;
}

/** The card the mock gateway "saves" when its card page is paid: one per payment, never a number. */
export function mockCardToken(key: string): string {
  return `mock_card_tok_${key}`;
}

/** The provider name the mock answers callbacks for. */
export const MOCK_PROVIDER = 'mock';

/** The header the mock's callback is signed with: the SHA-256 of the raw body, standing in for a provider's HMAC. */
export const MOCK_SIGNATURE_HEADER = 'x-mock-signature';

/** The signature of a callback body, as the mock gateway would send it. */
export function mockCallbackSignature(rawBody: Buffer | string): string {
  return createHash('sha256').update(rawBody).digest('hex');
}

/**
 * What a capture reference carries, so any process can read it back.
 *
 * The API runs as two processes, HTTP and worker, and each holds its own
 * instance of this adapter. A capture made by the HTTP process used to be
 * unknown to the worker, so the worker's sweep read every guest's pending
 * payment as "no such transaction" (booking audit, 2026-09-13). A real
 * provider's record is shared by every caller; the mock gets the same property
 * by writing what it would have remembered INTO the reference it hands out:
 * the key, the workspace, when the imaginary customer approves, and the amount.
 * `~` appears in none of them.
 */
interface CaptureRef {
  /** Which collection it was; `escrow_capture` when left out (references minted before rentals). */
  kind?: HandsetKind;
  key: string;
  workspaceId: string;
  settlesAt: number;
  amountRwf: number;
}

export function encodeCaptureRef(ref: CaptureRef): string {
  const kind = ref.kind ?? 'escrow_capture';
  return `${CAPTURE_REF_PREFIX[kind]}${ref.key}~${ref.workspaceId}~${ref.settlesAt}~${ref.amountRwf}`;
}

export function decodeCaptureRef(adapterRef: string): (CaptureRef & { kind: HandsetKind }) | null {
  const kind = (Object.keys(CAPTURE_REF_PREFIX) as HandsetKind[]).find((k) => adapterRef.startsWith(CAPTURE_REF_PREFIX[k]));
  if (!kind) return null;
  const parts = adapterRef.slice(CAPTURE_REF_PREFIX[kind].length).split('~');
  if (parts.length !== 4) return null;
  const [key, workspaceId, settlesAt, amountRwf] = parts as [string, string, string, string];
  const at = Number(settlesAt);
  const amount = Number(amountRwf);
  if (!key || !workspaceId || !Number.isFinite(at) || !Number.isInteger(amount)) return null;
  return { kind, key, workspaceId, settlesAt: at, amountRwf: amount };
}

@Injectable()
export class MockPaymentAdapter implements PaymentPort {
  readonly mode: AdapterMode = 'mock';

  private readonly log = new Logger(MockPaymentAdapter.name);

  /**
   * The provider's own idempotency memory, keyed `<operation>:<key>`. Per
   * process, on purpose.
   */
  private readonly seen = new Map<string, PaymentReceipt>();

  /**
   * The same receipts, addressed the way a provider addresses them: by its own
   * reference. `fetchTransaction` reads this one.
   *
   * The workspace is stored beside the receipt rather than parsed back out of
   * the key, because the receipt itself does not carry one and a lookup that
   * ignored it would let one tenant read another's transaction.
   */
  private readonly byRef = new Map<
    string,
    { receipt: PaymentReceipt; workspaceId: string }
  >();

  /**
   * A mobile money capture waits on a handset; everything else settles now.
   *
   * The decline hook is the payer's own number: one ending `0000` is refused,
   * so the "your payment was declined" path can be walked from the checkout
   * without touching code or config. Real providers publish test numbers that
   * work exactly this way. One ending `9999` approves only after the prompt
   * window, which is the other path worth walking.
   *
   * The moment the imaginary customer approves is written into the reference
   * (see `encodeCaptureRef`), so `fetchTransaction` compares it against the
   * clock: no timer to leak, identical under a test that fakes time, and the
   * same answer from every process. A replay returns the original receipt and
   * so never restarts the customer's clock.
   */
  captureEscrow(command: CaptureEscrowCommand): Promise<PaymentReceipt> {
    return this.fromHandset(command);
  }

  /** Rent is collected from the tenant's handset exactly as a booking is (rentals blueprint 2.7). */
  collectRent(command: RentCollectCommand): Promise<PaymentReceipt> {
    return this.fromHandset(command);
  }

  /**
   * The landlord approves on their own phone, then the fixer is paid. A
   * fixer's number or account ending `0000` refuses the transfer, the way a
   * payout destination does, so the failed payment can be walked too.
   */
  async payVendor(command: VendorPayoutCommand): Promise<PaymentReceipt> {
    if (command.destinationRef.replace(/\D/g, '').endsWith(DECLINING_SUFFIX)) {
      throw new PaymentDeclinedError('the receiving account refused the transfer', command.idempotencyKey);
    }
    return this.fromHandset(command);
  }

  /**
   * A broker plan month. On a handset it waits and declines a number ending
   * `0000`, as rent does. A saved card settles inside the call, and one whose
   * token ends `0000` is declined, so a failed card renewal can be walked. The
   * card page answers `pending` with the page to send the payer to; the mock's
   * page is the return address itself, and the payment reads settled from the
   * moment they come back, with a saved card for next month.
   */
  async chargeSubscription(command: SubscriptionChargeCommand): Promise<PaymentReceipt> {
    const { instrument } = command;
    if (instrument.kind === 'mobile_money') {
      if (instrument.msisdn.endsWith(DECLINING_SUFFIX)) {
        throw new PaymentDeclinedError('the customer declined the request on their handset', command.idempotencyKey);
      }
      return this.settle(command, 'pending', Date.now() + approvalDelayMs(instrument.msisdn), 'subscription_charge');
    }
    if (instrument.kind === 'card' || instrument.kind === 'saved_card') {
      if (instrument.token.endsWith(DECLINING_SUFFIX)) {
        throw new PaymentDeclinedError('the card was declined', command.idempotencyKey);
      }
      return this.settle(command);
    }
    const receipt = await this.settle(command, 'pending', Date.now(), 'subscription_checkout');
    const url = new URL(instrument.returnUrl);
    url.searchParams.set('gateway', MOCK_PROVIDER);
    return { ...receipt, checkoutUrl: url.toString() };
  }

  /**
   * A payout refused by its destination: a number or account ending `0000`,
   * so a failed payout and its retry can be walked (rentals WP 1.6b).
   */
  async payout(command: PayoutCommand): Promise<PaymentReceipt> {
    if (command.destinationRef.replace(/\D/g, '').endsWith(DECLINING_SUFFIX)) {
      throw new PaymentDeclinedError('the receiving account refused the transfer', command.idempotencyKey);
    }
    return this.settle(command);
  }

  releaseEscrow(command: ReleaseEscrowCommand): Promise<PaymentReceipt> {
    return this.settle(command);
  }

  refund(command: RefundCommand): Promise<PaymentReceipt> {
    return this.settle(command);
  }

  voidPending(command: VoidPendingCommand): Promise<PaymentReceipt> {
    return this.settle(command);
  }

  chargeRecurring(command: RecurringChargeCommand): Promise<PaymentReceipt> {
    return this.settle(command);
  }

  /** A fee asked on a handset waits and declines a number ending `0000`, as rent does; one without a payer is recorded. */
  chargeOneTimeFee(command: OneTimeFeeCommand): Promise<PaymentReceipt> {
    const { instrument } = command;
    if (instrument) return this.fromHandset({ ...command, instrument });
    return this.settle(command);
  }

  /**
   * The mock gateway's callback: a JSON body `{ eventId, adapterRef, outcome,
   * amountRwf?, reason? }` signed in `x-mock-signature` with the SHA-256 of
   * the raw body (`mockCallbackSignature`). Anything else is null, and so is
   * a body for another provider: a stranger posting to the route changes
   * nothing, because the settlement job still reads the transaction back.
   */
  parseCallback(provider: string, headers: Record<string, string | string[] | undefined>, rawBody: Buffer): CallbackEvent | null {
    if (provider !== MOCK_PROVIDER) return null;
    const header = headers[MOCK_SIGNATURE_HEADER];
    const signature = Array.isArray(header) ? header[0] : header;
    if (!signature || signature !== mockCallbackSignature(rawBody)) return null;
    let body: unknown;
    try {
      body = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return null;
    }
    if (!body || typeof body !== 'object') return null;
    const b = body as Record<string, unknown>;
    if (typeof b.eventId !== 'string' || typeof b.adapterRef !== 'string') return null;
    if (b.outcome !== 'settled' && b.outcome !== 'failed') return null;
    const event: CallbackEvent = { provider: MOCK_PROVIDER, eventId: b.eventId, adapterRef: b.adapterRef, outcome: b.outcome };
    if (typeof b.amountRwf === 'number' && Number.isInteger(b.amountRwf)) event.amountRwf = b.amountRwf;
    if (typeof b.reason === 'string' && b.reason.trim()) event.reason = b.reason.trim().slice(0, 300);
    return event;
  }

  /**
   * What this adapter thinks happened, by its own reference (ADR-020 AC-6).
   *
   * `null` means "no such transaction here", and only that. A real adapter that
   * cannot reach its provider throws `PaymentUnavailableError` instead, because
   * "we have no record" and "we could not ask" must never collapse into one
   * answer — reconciliation would read an outage as a missing charge.
   *
   * The workspace must match. A reference is guessable enough that an unscoped
   * lookup would be a cross-tenant read.
   */
  async fetchTransaction(
    workspaceId: string,
    adapterRef: string,
  ): Promise<PaymentReceipt | null> {
    const decoded = decodeCaptureRef(adapterRef);
    const entry = this.byRef.get(adapterRef);

    if (!entry) {
      // Not made by THIS process. A capture reference carries what the
      // provider would have remembered, so it is read from the reference, still
      // workspace scoped. Anything else this process never issued is unknown.
      if (!decoded || decoded.workspaceId !== workspaceId) return null;
      const settled = Date.now() >= decoded.settlesAt;
      return {
        adapterRef,
        mode: this.mode,
        replayed: false,
        amountRwf: decoded.amountRwf,
        currency: 'RWF',
        occurredAt: new Date(decoded.settlesAt),
        settlement: settled ? 'settled' : 'pending',
        ...(settled && decoded.kind === 'subscription_checkout' ? { savedCardToken: mockCardToken(decoded.key) } : {}),
      };
    }
    if (entry.workspaceId !== workspaceId) return null;

    /*
     * The imaginary customer approving on their handset.
     *
     * The settled receipt REPLACES the pending one in both maps, so a later
     * replay of the capture also reads settled — which is what a real provider
     * does, and what stops the booking path seeing a payment flip back to
     * pending after it has completed.
     */
    if (entry.receipt.settlement === 'pending' && decoded && Date.now() >= decoded.settlesAt) {
      const settled: PaymentReceipt = {
        ...entry.receipt,
        settlement: 'settled',
        ...(decoded.kind === 'subscription_checkout' ? { savedCardToken: mockCardToken(decoded.key) } : {}),
      };
      this.byRef.set(adapterRef, { ...entry, receipt: settled });
      this.seen.set(`${operationOf(decoded.kind)}:${decoded.key}`, settled);
      this.log.debug(`mock handset approved ${adapterRef}`);
      return settled;
    }

    return entry.receipt;
  }

  /** A collection that waits on a handset: pending until the imaginary customer approves, declined on the test number. */
  private async fromHandset(
    command: CaptureEscrowCommand | RentCollectCommand | VendorPayoutCommand | (OneTimeFeeCommand & { instrument: NonNullable<OneTimeFeeCommand['instrument']> }),
  ): Promise<PaymentReceipt> {
    const { instrument } = command;

    if (instrument.kind === 'mobile_money') {
      if (instrument.msisdn.endsWith(DECLINING_SUFFIX)) {
        throw new PaymentDeclinedError(
          'the customer declined the request on their handset',
          command.idempotencyKey,
        );
      }
      return this.settle(command, 'pending', Date.now() + approvalDelayMs(instrument.msisdn), command.kind);
    }

    return this.settle(command);
  }

  /**
   * One body for every write, because a mock provider's job is identical
   * across them: check the key, check the amount, answer. The methods stay
   * separate on the interface anyway — that is what lets a real adapter give
   * each one a different endpoint without the seam changing shape.
   *
   * `async` so a refusal REJECTS rather than throwing synchronously. A caller
   * writes `await port.captureEscrow(...)` inside a `try`; a synchronous throw
   * from something that returns a promise escapes a `.catch()` and lands
   * somewhere nobody is looking. Every real adapter will be genuinely async, so
   * this is the shape the seam must have.
   */
  private async settle(
    command: PaymentCommand,
    settlement: PaymentReceipt['settlement'] = 'settled',
    settlesAt: number = Date.now(),
    handset: HandsetKind | null = null,
  ): Promise<PaymentReceipt> {
    const { idempotencyKey, amountRwf } = command;

    /**
     * The memory is keyed on the operation AND the key, never the key alone.
     *
     * This is not defensive tidiness, it is the bug that shipped. `compensate()`
     * used to hand `refund` the capture's own key, and a memory keyed on the key
     * alone found the capture, saw a matching amount, and returned it as a
     * replay. The refund never happened, the caller was told it had, and the
     * `STUCK MONEY` line that exists to catch exactly that never printed.
     *
     * Real providers scope a key per operation for the same reason. A capture
     * and the refund that reverses it are two movements of money and must never
     * collapse into one record.
     */
    const seenKey = `${command.kind}:${idempotencyKey}`;

    const previous = this.seen.get(seenKey);
    if (previous) {
      if (previous.amountRwf !== amountRwf) {
        // Two different amounts on one key. A real provider refuses this, and
        // it matters: accepting it would be a way to rewrite a settled charge.
        throw new PaymentDeclinedError(
          'idempotency key already settled for a different amount',
          idempotencyKey,
        );
      }
      return { ...previous, replayed: true };
    }

    if (!Number.isInteger(amountRwf) || amountRwf <= 0) {
      throw new PaymentDeclinedError(
        'amount must be a positive whole number of francs',
        idempotencyKey,
      );
    }

    const receipt: PaymentReceipt = {
      adapterRef: handset
        ? encodeCaptureRef({ kind: handset, key: idempotencyKey, workspaceId: command.workspaceId, settlesAt, amountRwf })
        : `mock_${command.kind}_${idempotencyKey}`,
      mode: this.mode,
      replayed: false,
      amountRwf,
      currency: command.currency,
      occurredAt: new Date(),
      // `pending` for a mobile money capture, which is what both Rwandan rails
      // actually answer; `settled` for everything else. See the class comment.
      settlement,
    };

    this.seen.set(seenKey, receipt);
    this.byRef.set(receipt.adapterRef, {
      receipt,
      workspaceId: command.workspaceId,
    });

    // Logged at debug rather than dropped: while the seam is mocked this line
    // is the only trace that a money operation ran at all.
    this.log.debug(`${describeForLog(command)} -> ${receipt.adapterRef}`);

    return receipt;
  }
}
