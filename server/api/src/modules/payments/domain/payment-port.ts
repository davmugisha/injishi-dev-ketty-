/**
 * The payment seam (F-S08, ADR-020).
 *
 * ONE interface for every money movement the platform makes. Business logic
 * calls this and nothing else; it never names a provider, never sees an HTTP
 * status, and never branches on `mock` versus `live`. Going live is registering
 * a different implementation in `payments.module.ts` — one line — and changing
 * nothing here or above.
 *
 * Four rules make that swap safe rather than merely possible.
 *
 * **Idempotency is not optional.** Every command carries `idempotencyKey` as a
 * required field, so a caller cannot forget one and a retry cannot double-charge.
 * That is the whole reason the commands are types rather than positional
 * arguments: the compiler asks the question the code review would have to.
 *
 * **Failure is a domain outcome, never a provider error.** An adapter turns
 * whatever its provider says into `PaymentDeclined` or `PaymentUnavailable`.
 * The caller distinguishes "they said no" from "we could not ask", because those
 * two need opposite handling and every provider spells them differently.
 *
 * **Settlement is not the same as success.** Every Rwandan mobile money rail
 * answers a capture by pushing a prompt to a handset and settling later, so a
 * receipt says whether the money has actually landed (ADR-020 D-b). A seam that
 * could only say "it worked" would have to change shape on the day a provider is
 * signed, which is the one thing it exists to prevent.
 *
 * **No transaction may be open across a call.** These are network calls. A
 * database transaction held open for a third-party round trip keeps a row lock
 * for the length of someone else's outage. ADR-020 D-a fixes the ordering the
 * booking path uses: pre-check, capture, commit, compensate.
 */

import type { MobileMoneyNetwork, PaymentInstrument } from '@injishi/contracts';

/** Which side of the seam is live. Mirrors the Postgres `adapter_mode` enum. */
export type AdapterMode = 'mock' | 'live';

/** Nest injection token. Everything depends on the interface, not a class. */
export const PAYMENT_PORT = 'PAYMENT_PORT';

/**
 * The guarded adapter beneath the bank record's writer, for the disbursement
 * dispatcher alone (073-gtbank-payments AC-9): it sends rows already written,
 * so going through `PAYMENT_PORT` would write them a second time.
 */
export const GUARDED_PAYMENT_PORT = 'GUARDED_PAYMENT_PORT';

/**
 * What every money operation needs, whichever operation it is.
 *
 * `currency` rides along even though v1 is RWF only, because a provider that
 * settles in two currencies must not force a signature change on five call
 * sites to say so.
 */
export interface MoneyCommand {
  /**
   * The key that makes a retry safe. Derived from the thing being paid for
   * (`booking-capture:<token>`, `payout:<id>`), never from a clock or a random
   * value — a fresh key on every attempt is the same as having none.
   *
   * Its form is `<workspaceId>:<operation>:<clientKey>` (ADR-020 AC-27), the
   * shape `operations.ts` already documents for `folio_charges`,
   * `housekeeping_tasks` and `service_orders`. The workspace prefix is load
   * bearing: a client key that is unique only to its sender would otherwise
   * collide across tenants on a shared provider account.
   */
  idempotencyKey: string;
  amountRwf: number;
  currency: 'RWF';
  /** Money is scoped per workspace (F-S08 §6). */
  workspaceId: string;
  /** Free text carried to the provider and into the ledger memo. */
  memo?: string;
}

/**
 * What a collection pays for (073-gtbank-payments AC-2). Every collection
 * names one, because live money goes live one purpose at a time
 * (`PAYMENT_LIVE_PURPOSES`): a purpose that is not listed is refused exactly as
 * the `off` seam refuses, before any provider call.
 */
export type PaymentPurpose =
  | 'booking'
  | 'service_order'
  | 'registration_fee'
  | 'rent'
  | 'subscription'
  /** A PSF membership fee (audric-main's PSF path), charged once and passed on to PSF. */
  | 'psf_membership';

export const PAYMENT_PURPOSES: readonly PaymentPurpose[] = [
  'booking',
  'service_order',
  'registration_fee',
  'rent',
  'subscription',
  'psf_membership',
];

/**
 * Capture a guest payment into escrow at booking time (F-B05 / FL07 §4.5).
 *
 * `instrument` is REQUIRED, and adding it is what made a live adapter writable
 * at all (ADR-047). This command used to carry an amount, a currency, a
 * workspace and a key — everything except who is paying and on which rail. The
 * three-step paywall collected exactly that, validated it, and dropped it,
 * because there was no field on the wire and no field here to put it in. An
 * adapter cannot push an MTN prompt at nobody.
 *
 * It is on the CAPTURE alone rather than on `MoneyCommand`. A refund, a void
 * and an escrow release all name an `originalRef` instead: they act on a
 * transaction that already knows its payer, and asking them to restate the
 * instrument would invite a reversal aimed at a different account from the one
 * that was charged.
 */
export interface CaptureEscrowCommand extends MoneyCommand {
  kind: 'escrow_capture';
  /** A booking's escrow, or a pay now order's capture. */
  purpose: 'booking' | 'service_order';
  /** Whom to charge and how. Never a card number — see `PaymentInstrument`. */
  instrument: PaymentInstrument;
}

/**
 * End a hold, in someone's favour (ADR-020 D-e).
 *
 * Separate from `refund` and from `payout` because the provider holds the funds
 * and ending a hold is its own instruction at every provider that offers one.
 * `beneficiary` is required and is the whole meaning of the call: ending a hold
 * for the guest and ending it for the host are the same instruction with
 * opposite outcomes, which `escrow_status` already distinguishes as
 * `refunded_full` and `forfeited`.
 *
 * A union rather than an optional field, so the compiler enforces what prose
 * cannot: a release to the host cannot be written without naming where the money
 * goes. A release never computes a destination of its own — it is read the same
 * way `PayoutCommand.destinationRef` reads it.
 */
export type ReleaseEscrowCommand = MoneyCommand & {
  kind: 'escrow_release';
  /** The capture being released, so a provider can match its own record. */
  originalRef: string;
} & (
    | {
        beneficiary: 'guest';
        /**
         * Filled in by the payments module's dispatcher, never by a caller: the
         * wallet is copied from the collection that paid (073-gtbank-payments
         * AC-11), and the name and ID from the payer's verified identity.
         */
        payee?: Beneficiary;
      }
    | {
        beneficiary: 'host';
        /** Where the host is paid. Where F-B12 stores it is F-B12's. */
        payee: Beneficiary;
      }
  );

/**
 * Return money already captured.
 *
 * `amountRwf` is what to return, which is why a partial refund needs no separate
 * operation: the cancellation tier decides the number (F-B11), not this seam.
 */
export interface RefundCommand extends MoneyCommand {
  kind: 'refund';
  /** The capture being reversed, so a provider can match it to its own record. */
  originalRef: string;
  /**
   * Filled in by the payments module's dispatcher, never by a caller
   * (073-gtbank-payments AC-11, AC-12): a refund only ever goes back to the
   * wallet that paid.
   */
  payee?: Beneficiary;
}

/**
 * Who a disbursement pays, as GTBank requires it for every one
 * (073-gtbank-payments): full name, ID or passport number, the wallet or
 * account, and a phone. Never logged; see `describeForLog`.
 */
export interface Beneficiary {
  fullName: string;
  idType: 'national_id' | 'passport';
  idNumber: string;
  destination:
    | { kind: 'mobile_money'; network: MobileMoneyNetwork; msisdn: string }
    | { kind: 'bank'; bankCode: string; accountNumber: string };
  phone: string;
}

/**
 * Cancel a capture that was accepted but has not settled (ADR-020 D-b).
 *
 * A pending capture is not a charge yet, so there is nothing to refund; there is
 * a request sitting on someone's handset that must not be left to settle into
 * money nobody has a booking for. A provider that cannot cancel an unsettled
 * request throws `PaymentUnavailableError`, which is honest, and the
 * compensation queue refunds it once it settles instead.
 */
export interface VoidPendingCommand extends MoneyCommand {
  kind: 'void_pending';
  /** The pending capture to cancel. */
  originalRef: string;
}

/** Pay a host, landlord or broker out of released escrow (F-B12 / FL10). */
export interface PayoutCommand extends MoneyCommand {
  kind: 'payout';
  /**
   * Who is paid, with what GTBank needs for every disbursement
   * (073-gtbank-payments). MoMo numbers are deliberately NOT tokenized
   * (F-S08 §6): each payout is a fresh push.
   */
  payee: Beneficiary;
}

/**
 * Pay a landlord their collected rent (rentals blueprint 2.7, WP 1.6b), to the
 * payout account they chose: a MoMo number, a MoMo Pay merchant code or a bank
 * account. Apart from `payout` because a landlord's account is the business's
 * own, kept by rentals, not a verified person's wallet (073-gtbank-payments).
 */
export interface LandlordPayoutCommand extends MoneyCommand {
  kind: 'landlord_payout';
  destination: 'momo' | 'bank' | 'momo_pay';
  /** The MoMo number (E.164), merchant code or bank account number. */
  destinationRef: string;
}

/**
 * Collect a tenant's rent (rentals blueprint 2.7, WP 1.6b). Collected for the
 * landlord and paid on to them once it settles; nothing is held in escrow.
 * Like a capture, it names who pays and on which rail, and a mobile money
 * collection comes back `pending` until the tenant approves the prompt.
 */
export interface RentCollectCommand extends MoneyCommand {
  kind: 'rent_collect';
  instrument: PaymentInstrument;
  /** The lease this rent belongs to. */
  leaseRef: string;
  /** Our own payment record, so a callback can name it. */
  paymentRef: string;
}

/**
 * The landlord's own phone pays a fixer, or refunds a deposit to the tenant
 * (rentals blueprint 2.7). Two legs at the provider: the landlord approves on
 * their handset, then the money goes to the destination.
 */
export interface VendorPayoutCommand extends MoneyCommand {
  kind: 'vendor_payout';
  /** Who funds it: the landlord's handset. */
  instrument: PaymentInstrument;
  destination: 'momo' | 'bank';
  /** The fixer's or tenant's MoMo number (E.164) or bank account number. */
  destinationRef: string;
  /** The fault or deposit this pays for. */
  subjectRef: string;
}

/**
 * A broker plan month (rentals blueprint 2.7): on a handset, with a card the
 * provider saved from a past checkout, or on the provider's card page, which
 * answers `pending` with `checkoutUrl` and, once paid, a `savedCardToken`.
 */
export interface SubscriptionChargeCommand extends MoneyCommand {
  kind: 'subscription_charge';
  instrument: PaymentInstrument | { kind: 'saved_card'; token: string } | { kind: 'card_checkout'; returnUrl: string };
  /** The broker subscription this month belongs to. */
  subscriptionRef: string;
}

/**
 * A recurring charge: subscription billing (F-S14) or rent collection (F-R05).
 *
 * Carries its payer, as a capture does (073-gtbank-payments): every instalment
 * is a fresh Request to Pay a person approves, because mobile money numbers are
 * never stored as an instrument to charge again (F-S08 §6).
 */
export interface RecurringChargeCommand extends MoneyCommand {
  kind: 'recurring_charge';
  purpose: 'rent' | 'subscription';
  /** The subscription or lease this instalment belongs to. */
  scheduleRef: string;
  instrument: PaymentInstrument;
}

/**
 * A one-time fee: registration (F-S03 / D23), placement, or a folio settle.
 *
 * Carries its payer (073-gtbank-payments AC-16): the registration fee is a
 * Request to Pay to the registrant's phone, which a provider cannot send to
 * nobody.
 */
export interface OneTimeFeeCommand extends MoneyCommand {
  kind: 'one_time_fee';
  purpose: 'registration_fee' | 'psf_membership';
  feeCode: string;
  instrument: PaymentInstrument;
}

export type PaymentCommand =
  | CaptureEscrowCommand
  | ReleaseEscrowCommand
  | RefundCommand
  | VoidPendingCommand
  | PayoutCommand
  | LandlordPayoutCommand
  | RentCollectCommand
  | VendorPayoutCommand
  | SubscriptionChargeCommand
  | RecurringChargeCommand
  | OneTimeFeeCommand;

/**
 * Whether the money has actually moved (ADR-020 D-b).
 *
 * `settled` is done. `pending` means the provider accepted the instruction and
 * the outcome is still out there — a handset prompt awaiting a person, which is
 * what MTN Mobile Money and Airtel Money both are. A caller that treats
 * `pending` as success has told a guest their reservation is real on the
 * strength of a prompt nobody has answered.
 */
export type SettlementStatus = 'settled' | 'pending';

/**
 * What the provider gave back.
 *
 * `adapterRef` is the provider's own identifier and is what reconciliation
 * (F-A06) matches our ledger against, so it is stored on the row the money
 * belongs to rather than logged and forgotten.
 */
export interface PaymentReceipt {
  adapterRef: string;
  mode: AdapterMode;
  /**
   * True when the provider recognised the idempotency key and returned the
   * original result rather than doing the work twice. Callers do not usually
   * care; reconciliation does.
   */
  replayed: boolean;
  amountRwf: number;
  currency: 'RWF';
  occurredAt: Date;
  /** Whether the money has landed, or is still out on a handset (D-b). */
  settlement: SettlementStatus;
  /**
   * Set when the provider later reversed or refunded a transaction it had
   * reported successful (073-gtbank-payments AC-18). Absent otherwise.
   */
  providerStatus?: 'reversed' | 'refunded';
  /** A card checkout: the provider's page to send the payer to (rentals blueprint 2.7). */
  checkoutUrl?: string;
  /** A card the provider saved at checkout, for the next charge. A token, never a number. */
  savedCardToken?: string;
}

/**
 * What a provider's callback said about one transaction (rentals blueprint
 * 2.5, 2.7), as `parseCallback` reads it from the signed raw body. `eventId`
 * is the provider's own id for the notification, so a replay is one event.
 */
export interface CallbackEvent {
  provider: string;
  eventId: string;
  adapterRef: string;
  outcome: 'settled' | 'failed';
  amountRwf?: number;
  reason?: string;
}

/** The provider was reached and said no. Retrying the same command will not help. */
export class PaymentDeclinedError extends Error {
  constructor(
    readonly reason: string,
    readonly idempotencyKey: string,
    /**
     * Two refusals the bank record treats differently from a plain decline
     * (073-gtbank-payments AC-5, AC-21): Hangaa's account was short, so the
     * disbursement waits for funds instead of failing; or the payee's name did
     * not match the wallet, so it waits for corrected details.
     */
    readonly code?: 'insufficient_funds' | 'name_mismatch',
  ) {
    super(`Payment declined: ${reason}`);
    this.name = 'PaymentDeclinedError';
  }
}

/**
 * The provider could not be reached, or answered in a way we cannot read.
 *
 * Distinct from a decline because the outcome is UNKNOWN: the money may or may
 * not have moved. Retrying on the same idempotency key is the correct response,
 * and is safe precisely because the key is required.
 *
 * `delivered` says how unknown (073-gtbank-payments AC-7, ADR-073 D-f): `no`
 * when nothing reached the provider (the seam is off, the breaker is open, the
 * connection was refused), so the instruction never happened and may be sent
 * again; `maybe` when a request may have arrived (a timeout after sending), so
 * the bank record parks it and nothing resends it blindly. Unsure is `maybe`.
 */
export class PaymentUnavailableError extends Error {
  constructor(
    readonly detail: string,
    readonly idempotencyKey: string,
    readonly delivered: 'no' | 'maybe' = 'maybe',
  ) {
    super(`Payment provider unavailable: ${detail}`);
    this.name = 'PaymentUnavailableError';
  }
}

/**
 * The seam.
 *
 * Seven write operations and one read. A provider that cannot do one of them
 * implements it by throwing `PaymentUnavailableError`, which is honest, rather
 * than silently succeeding, which is not.
 */
export interface PaymentPort {
  /** Which side of the seam this implementation is. Read for the F-A09 badge. */
  readonly mode: AdapterMode;

  captureEscrow(command: CaptureEscrowCommand): Promise<PaymentReceipt>;
  releaseEscrow(command: ReleaseEscrowCommand): Promise<PaymentReceipt>;
  refund(command: RefundCommand): Promise<PaymentReceipt>;
  voidPending(command: VoidPendingCommand): Promise<PaymentReceipt>;
  payout(command: PayoutCommand): Promise<PaymentReceipt>;
  chargeRecurring(command: RecurringChargeCommand): Promise<PaymentReceipt>;
  chargeOneTimeFee(command: OneTimeFeeCommand): Promise<PaymentReceipt>;
  /** Rentals (blueprint 2.7): a tenant's rent, a landlord paid, a landlord paying a fixer, a broker's plan. */
  collectRent(command: RentCollectCommand): Promise<PaymentReceipt>;
  payLandlord(command: LandlordPayoutCommand): Promise<PaymentReceipt>;
  payVendor(command: VendorPayoutCommand): Promise<PaymentReceipt>;
  chargeSubscription(command: SubscriptionChargeCommand): Promise<PaymentReceipt>;

  /**
   * Read a provider's callback (`POST /api/v1/payments/webhooks/:provider`),
   * checking its signature against the RAW body. Null when the body is not
   * this provider's, or the signature does not hold: the route then answers
   * nothing was taken and the settlement sweep stays the source of truth.
   */
  parseCallback(provider: string, headers: Record<string, string | string[] | undefined>, rawBody: Buffer): CallbackEvent | null;

  /**
   * The provider's own view of one transaction (ADR-020 D-e, AC-6).
   *
   * Reconciliation (F-A06) compares our `escrows` mirror against this. A mirror
   * that cannot be compared against the thing it mirrors is not a mirror.
   *
   * Workspace scoped, so a multi-tenant provider can scope the lookup and one
   * workspace cannot read another's transaction.
   *
   * Returns `null` ONLY for "this provider has no such transaction". A provider
   * it could not reach throws `PaymentUnavailableError` like every other
   * operation, because "not found" and "could not ask" must never collapse: one
   * means the money was never taken, the other means nobody knows.
   */
  fetchTransaction(
    workspaceId: string,
    adapterRef: string,
  ): Promise<PaymentReceipt | null>;
}

/**
 * The provider answered "not now" (review 3.8).
 *
 * A 429 is not an outage. It is a subclass of `PaymentUnavailableError` so
 * every caller that already treats unavailable as "possibly happened, read it
 * back" keeps doing so, and carries `retryAfterMs` so the compensation queue
 * waits exactly as long as it was told rather than on a generic backoff that
 * amplifies the limit it hit.
 */
export class PaymentRateLimitedError extends PaymentUnavailableError {
  constructor(
    readonly retryAfterMs: number,
    idempotencyKey: string,
  ) {
    // The provider answered and took nothing: not delivered (073 AC-7).
    super(`rate limited, retry after ${retryAfterMs}ms`, idempotencyKey, 'no');
    this.name = 'PaymentRateLimitedError';
  }
}

/** `0788123456` → `078••••456`. Enough to reconcile, never enough to pay. */
export function maskDestination(ref: string): string {
  if (ref.length <= 6) return '•'.repeat(ref.length);
  return `${ref.slice(0, 3)}${'•'.repeat(ref.length - 6)}${ref.slice(-3)}`;
}

/**
 * The one line a payment command may write to a log (review 4.5).
 *
 * Today the mock logs kind, amount and reference, which is fine. A payout's
 * `destinationRef` is a mobile-money number or a bank account, and the first
 * live adapter written in the mock's style would log it. The rule lives here
 * so an adapter has to go out of its way to break it.
 */
export function describeForLog(c: PaymentCommand): string {
  const base = `${c.kind} ${c.amountRwf} ${c.currency} key=${c.idempotencyKey} ws=${c.workspaceId}`;
  // A payee is a person: only the masked account is ever printed, never the
  // name or the ID (073-gtbank-payments, key invariants).
  if ('payee' in c && c.payee) {
    const d = c.payee.destination;
    return `${base} payee=${maskDestination(d.kind === 'mobile_money' ? d.msisdn : d.accountNumber)}`;
  }
  // An instrument is a payer. The rail is safe to log and identifies nobody;
  // the handset is masked by the same rule a payout destination is, and a card
  // token is never printed at all — it is a bearer credential for that charge.
  if ('destinationRef' in c && !('instrument' in c)) {
    return `${base} to=${c.destination} ${maskDestination(c.destinationRef)}`;
  }
  if ('instrument' in c) {
    const i = c.instrument;
    return i.kind === 'mobile_money'
      ? `${base} via=${i.network} payer=${maskDestination(i.msisdn)}`
      : `${base} via=card`;
  }
  return base;
}
