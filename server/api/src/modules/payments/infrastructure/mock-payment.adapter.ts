import { PAYMENT_PROMPT_TTL_SECONDS } from '@injishi/contracts';
import { Injectable, Logger } from '@nestjs/common';

import {
  type AdapterMode,
  type CaptureEscrowCommand,
  type OneTimeFeeCommand,
  type PaymentCommand,
  type PaymentPort,
  type PaymentReceipt,
  type PayoutCommand,
  PaymentDeclinedError,
  PaymentUnavailableError,
  type RecurringChargeCommand,
  type RefundCommand,
  type ReleaseEscrowCommand,
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
 * call, because a card rail does.
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

/**
 * The collections that wait on a handset, and the prefix each one's reference
 * carries. A registration fee and a rent instalment are a Request to Pay
 * exactly as a capture is (073-gtbank-payments), so they share its behaviour.
 */
const COLLECTION_REF_PREFIXES = {
  escrow_capture: 'mock_escrow_capture_',
  one_time_fee: 'mock_one_time_fee_',
  recurring_charge: 'mock_recurring_charge_',
} as const;

/**
 * The disbursements, which carry the same kind of reference so a pending one
 * (`1111`) and a reversed one (`7777`) read the same from every process
 * (073-gtbank-payments, the mock's script).
 */
const DISBURSEMENT_REF_PREFIXES = {
  refund: 'mock_refund_',
  escrow_release: 'mock_escrow_release_',
  payout: 'mock_payout_',
} as const;

const REF_PREFIXES = { ...COLLECTION_REF_PREFIXES, ...DISBURSEMENT_REF_PREFIXES } as const;

export type MockCollectionKind = keyof typeof COLLECTION_REF_PREFIXES;
export type MockRefKind = keyof typeof REF_PREFIXES;

function isRefKind(kind: string): kind is MockRefKind {
  return kind in REF_PREFIXES;
}

/** How long after it succeeds a `7777` transaction is reversed by the mock bank. */
const REVERSAL_AFTER_MS = 120_000;
/** How long a `1111` disbursement stays pending. */
const SLOW_DISBURSEMENT_MS = 60_000;

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
  /** Which transaction: a collection, or a disbursement. */
  kind?: MockRefKind;
  key: string;
  workspaceId: string;
  settlesAt: number;
  amountRwf: number;
  /** When the mock bank reverses it after success, or absent (073 AC-18). */
  reversesAt?: number;
}

export function encodeCaptureRef(ref: CaptureRef): string {
  const prefix = REF_PREFIXES[ref.kind ?? 'escrow_capture'];
  const base = `${prefix}${ref.key}~${ref.workspaceId}~${ref.settlesAt}~${ref.amountRwf}`;
  return ref.reversesAt ? `${base}~${ref.reversesAt}` : base;
}

export function decodeCaptureRef(adapterRef: string): (CaptureRef & { kind: MockRefKind }) | null {
  // The longest prefix first: `mock_escrow_release_` must not read as a capture.
  const kind = (Object.keys(REF_PREFIXES) as MockRefKind[])
    .sort((a, b) => REF_PREFIXES[b].length - REF_PREFIXES[a].length)
    .find((k) => adapterRef.startsWith(REF_PREFIXES[k]));
  if (!kind) return null;
  const parts = adapterRef.slice(REF_PREFIXES[kind].length).split('~');
  if (parts.length !== 4 && parts.length !== 5) return null;
  const [key, workspaceId, settlesAt, amountRwf, reversesAt] = parts as [string, string, string, string, string?];
  const at = Number(settlesAt);
  const amount = Number(amountRwf);
  const reverses = reversesAt === undefined ? undefined : Number(reversesAt);
  if (!key || !workspaceId || !Number.isFinite(at) || !Number.isInteger(amount)) return null;
  if (reverses !== undefined && !Number.isFinite(reverses)) return null;
  return { kind, key, workspaceId, settlesAt: at, amountRwf: amount, ...(reverses ? { reversesAt: reverses } : {}) };
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

  /** `2222` disbursements already refused once for funds; the next send pays. */
  private readonly shortOnce = new Set<string>();

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
    return this.collect(command);
  }

  private async collect(
    command: CaptureEscrowCommand | OneTimeFeeCommand | RecurringChargeCommand,
  ): Promise<PaymentReceipt> {
    const { instrument } = command;

    if (instrument.kind === 'mobile_money') {
      if (instrument.msisdn.endsWith('0000')) {
        throw new PaymentDeclinedError(
          'the customer declined the request on their handset',
          command.idempotencyKey,
        );
      }
      // A payer ending `8888` gets no answer: the request may have arrived,
      // so the bank record parks it for a pull or a person (073 AC-7).
      if (instrument.msisdn.endsWith('8888')) {
        throw new PaymentUnavailableError('no answer from the bank for this payment', command.idempotencyKey, 'maybe');
      }
      const settlesAt = Date.now() + approvalDelayMs(instrument.msisdn);
      // A payer ending `7777` pays, then the bank reverses it (073 AC-18).
      const reversesAt = instrument.msisdn.endsWith('7777') ? settlesAt + REVERSAL_AFTER_MS : undefined;
      return this.settle(command, 'pending', settlesAt, reversesAt);
    }

    return this.settle(command);
  }

  releaseEscrow(command: ReleaseEscrowCommand): Promise<PaymentReceipt> {
    return this.disburse(command);
  }

  refund(command: RefundCommand): Promise<PaymentReceipt> {
    return this.disburse(command);
  }

  /**
   * A disbursement, scripted by the payee account's last four digits so every
   * path the bank record handles is walkable on a sample database
   * (073-gtbank-payments, the mock): `0000` is refused, `3333` is refused
   * because the name does not match the wallet, `1111` stays pending for a
   * minute, `2222` is refused for insufficient funds the FIRST time it is sent
   * and paid the next (as though the account were topped up in between),
   * `8888` gets no answer (it may have arrived), `7777` succeeds and is
   * reversed two minutes later, and anything else succeeds at once. `0000`
   * also declines a collection, so a refund can never reach it through a
   * booking; `3333` is the refusal a booking's refund can reach. A
   * disbursement with no payee (a refund of a collection made before the bank
   * record existed) succeeds, as it always did.
   */
  private async disburse(command: RefundCommand | ReleaseEscrowCommand | PayoutCommand): Promise<PaymentReceipt> {
    const key = command.idempotencyKey;
    const destination = command.payee?.destination;
    const account = destination ? (destination.kind === 'mobile_money' ? destination.msisdn : destination.accountNumber) : '';
    if (account.endsWith('0000')) {
      throw new PaymentDeclinedError('the receiving wallet refused the payment', key);
    }
    if (account.endsWith('3333')) {
      throw new PaymentDeclinedError('the name given does not match the receiving wallet', key, 'name_mismatch');
    }
    if (account.endsWith('2222') && !this.shortOnce.has(key)) {
      this.shortOnce.add(key);
      throw new PaymentDeclinedError("Hangaa's account cannot cover this payment yet", key, 'insufficient_funds');
    }
    if (account.endsWith('8888')) {
      throw new PaymentUnavailableError('no answer from the bank for this payment', key, 'maybe');
    }
    const now = Date.now();
    if (account.endsWith('1111')) return this.settle(command, 'pending', now + SLOW_DISBURSEMENT_MS);
    return this.settle(command, 'settled', now, account.endsWith('7777') ? now + REVERSAL_AFTER_MS : undefined);
  }

  voidPending(command: VoidPendingCommand): Promise<PaymentReceipt> {
    return this.settle(command);
  }

  payout(command: PayoutCommand): Promise<PaymentReceipt> {
    return this.disburse(command);
  }

  chargeRecurring(command: RecurringChargeCommand): Promise<PaymentReceipt> {
    return this.collect(command);
  }

  chargeOneTimeFee(command: OneTimeFeeCommand): Promise<PaymentReceipt> {
    return this.collect(command);
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
      return withReversal(
        {
          adapterRef,
          mode: this.mode,
          replayed: false,
          amountRwf: decoded.amountRwf,
          currency: 'RWF',
          occurredAt: new Date(decoded.settlesAt),
          settlement: Date.now() >= decoded.settlesAt ? 'settled' : 'pending',
        },
        decoded.reversesAt,
      );
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
      const settled: PaymentReceipt = { ...entry.receipt, settlement: 'settled' };
      this.byRef.set(adapterRef, { ...entry, receipt: settled });
      this.seen.set(`${decoded.kind}:${decoded.key}`, settled);
      this.log.debug(`mock handset approved ${adapterRef}`);
      return withReversal(settled, decoded.reversesAt);
    }

    return withReversal(entry.receipt, decoded?.reversesAt);
  }

  /**
   * One body for all seven writes, because a mock provider's job is identical
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
    reversesAt?: number,
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
      adapterRef: isRefKind(command.kind)
        ? encodeCaptureRef({ kind: command.kind, key: idempotencyKey, workspaceId: command.workspaceId, settlesAt, amountRwf, reversesAt })
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

/**
 * A settled transaction the mock bank has since reversed reads as reversed
 * (073-gtbank-payments AC-18): `7777` payers and payees, two minutes after.
 */
function withReversal(receipt: PaymentReceipt, reversesAt: number | undefined): PaymentReceipt {
  if (!reversesAt || receipt.settlement !== 'settled' || Date.now() < reversesAt) return receipt;
  return { ...receipt, providerStatus: 'reversed' };
}
