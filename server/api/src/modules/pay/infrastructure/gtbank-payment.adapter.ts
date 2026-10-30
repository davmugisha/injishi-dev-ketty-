import { createHmac, timingSafeEqual } from 'node:crypto';

import type { PaymentInstrument } from '@injishi/contracts';
import { Logger } from '@nestjs/common';
import { z } from 'zod';

import { GtbankTokenSource } from '../../../shared/http/gtbank-oauth';
import { ProviderHttpError, providerFetch } from '../../../shared/http/provider-http';
import {
  type AdapterMode,
  type Beneficiary,
  type CallbackEvent,
  type CaptureEscrowCommand,
  describeForLog,
  type LandlordPayoutCommand,
  type OneTimeFeeCommand,
  type PaymentCommand,
  PaymentDeclinedError,
  type PaymentPort,
  type PaymentReceipt,
  PaymentUnavailableError,
  type PayoutCommand,
  type RecurringChargeCommand,
  type RefundCommand,
  type ReleaseEscrowCommand,
  type RentCollectCommand,
  type SubscriptionChargeCommand,
  type VendorPayoutCommand,
  type VoidPendingCommand,
} from '../domain/payment-port';

/**
 * GTBank's Payment Hub (073-gtbank-payments): mobile money Request to Pay
 * collections and disbursements to wallets and bank accounts, in RWF, behind
 * GTBank's bearer token.
 *
 * Bound under `PAYMENT_ADAPTER_MODE=sandbox` against Injishi Mock APIs. It is
 * the adapter `live` will register, with GTBank's base URL and credentials,
 * once the Integration Specifications arrive and its mapping is corrected to
 * them (ADR-073 D-h: a conformance run against the fake provider server, which
 * Injishi Mock APIs is, plus one recorded sandbox round trip). Until then the
 * wire is Injishi's model (`server/mock-apis/src/providers/gtbank.ts`).
 *
 * What it maps, and how:
 * - A collection (a booking's capture, a pay now order, the registration fee,
 *   rent, a recurring charge) is a Request to Pay, keyed by OUR idempotency
 *   key as GTBank's client reference, so a retry reads back the transaction
 *   rather than prompting twice. `pending` comes back `pending` (ADR-020 D-b).
 * - A disbursement (a payout, a refund, an escrow release) names its payee as
 *   GTBank requires: full name, ID, wallet or account, phone. A name the wallet
 *   does not carry, or a short account, is a decline with its code (AC-5, AC-21).
 * - `fetchTransaction` reads the transaction by GTBank's reference. A prompt
 *   the payer declined, or that failed, comes back with `failure` set, so the
 *   attempt ends at once instead of waiting out its window.
 * - What GTBank does not offer here is refused before any request, honestly,
 *   as `PaymentUnavailableError` with nothing delivered: cards (no card
 *   provider is signed, AC-24), a landlord or vendor payout (GTBank needs a
 *   named, identified payee these commands do not carry), and a saved card.
 *
 * Under `sandbox` every receipt says `mock`: the money is invented, whatever
 * wire carried it.
 */

const Network = { mtn_momo: 'MTN', airtel_money: 'AIRTEL' } as const;

const HubTransaction = z.object({
  transactionReference: z.string().min(1),
  clientReference: z.string(),
  type: z.enum(['collection', 'disbursement']),
  amount: z.number(),
  currency: z.string(),
  status: z.enum(['pending', 'successful', 'failed', 'rejected', 'reversed', 'refunded', 'cancelled']),
  statusReason: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});
type HubTransaction = z.infer<typeof HubTransaction>;

/** What a payer is told when GTBank ends a prompt unpaid, by GTBank's reason code. */
const FAILURE_WORDS: Record<string, string> = {
  PAYER_DECLINED: 'the payer declined the request on their phone',
  INSUFFICIENT_FUNDS: 'the wallet did not have enough money',
  CANCELLED_BY_MERCHANT: 'the request was cancelled',
  DESTINATION_REFUSED: 'the receiving wallet refused the payment',
  NAME_MISMATCH: 'the name given does not match the receiving wallet',
};

export interface GtbankPaymentConfig {
  mode: 'sandbox' | 'live';
  /** The bank's base, e.g. `http://localhost:8100/gtbank`. */
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  timeoutMs: number;
}

export class GtbankPaymentAdapter implements PaymentPort {
  readonly mode: AdapterMode;
  private readonly log = new Logger(GtbankPaymentAdapter.name);
  private readonly tokens: GtbankTokenSource;

  constructor(private readonly config: GtbankPaymentConfig) {
    this.mode = config.mode === 'live' ? 'live' : 'mock';
    this.tokens = new GtbankTokenSource(config);
  }

  // --- Collections --------------------------------------------------------

  captureEscrow(command: CaptureEscrowCommand): Promise<PaymentReceipt> {
    return this.collect(command, command.instrument);
  }

  chargeOneTimeFee(command: OneTimeFeeCommand): Promise<PaymentReceipt> {
    return this.collect(command, command.instrument);
  }

  chargeRecurring(command: RecurringChargeCommand): Promise<PaymentReceipt> {
    return this.collect(command, command.instrument);
  }

  collectRent(command: RentCollectCommand): Promise<PaymentReceipt> {
    return this.collect(command, command.instrument);
  }

  chargeSubscription(command: SubscriptionChargeCommand): Promise<PaymentReceipt> {
    const instrument = command.instrument;
    if (instrument.kind !== 'mobile_money') {
      throw new PaymentUnavailableError('GTBank collects by mobile money only; no card provider is signed', command.idempotencyKey, 'no');
    }
    return this.collect(command, instrument);
  }

  private async collect(command: PaymentCommand, instrument: PaymentInstrument): Promise<PaymentReceipt> {
    if (instrument.kind !== 'mobile_money') {
      throw new PaymentUnavailableError('GTBank collects by mobile money only; no card provider is signed', command.idempotencyKey, 'no');
    }
    const tx = await this.send(command, '/payment-hub/v1/collections', {
      clientReference: command.idempotencyKey,
      amount: command.amountRwf,
      currency: command.currency,
      payer: { msisdn: `+250${instrument.msisdn}`, network: Network[instrument.network] },
      narration: (command.memo ?? '').slice(0, 140) || undefined,
    });
    return this.answer(command, tx);
  }

  // --- Disbursements ------------------------------------------------------

  payout(command: PayoutCommand): Promise<PaymentReceipt> {
    return this.disburse(command, command.payee);
  }

  refund(command: RefundCommand): Promise<PaymentReceipt> {
    return this.disburse(command, command.payee);
  }

  releaseEscrow(command: ReleaseEscrowCommand): Promise<PaymentReceipt> {
    return this.disburse(command, command.payee);
  }

  async payLandlord(command: LandlordPayoutCommand): Promise<PaymentReceipt> {
    throw new PaymentUnavailableError(
      'a landlord payout carries no named, identified payee, which GTBank requires for every disbursement',
      command.idempotencyKey,
      'no',
    );
  }

  async payVendor(command: VendorPayoutCommand): Promise<PaymentReceipt> {
    throw new PaymentUnavailableError(
      'a landlord paying a vendor is two legs GTBank has not specified yet',
      command.idempotencyKey,
      'no',
    );
  }

  private async disburse(command: PaymentCommand, payee: Beneficiary | undefined): Promise<PaymentReceipt> {
    if (!payee) {
      throw new PaymentUnavailableError('a disbursement needs its payee, which the dispatcher fills in', command.idempotencyKey, 'no');
    }
    const destination =
      payee.destination.kind === 'mobile_money'
        ? {
            type: 'WALLET',
            msisdn: payee.destination.msisdn.startsWith('+') ? payee.destination.msisdn : `+250${payee.destination.msisdn.replace(/^0/, '')}`,
            network: Network[payee.destination.network],
          }
        : { type: 'BANK', bankCode: payee.destination.bankCode, accountNumber: payee.destination.accountNumber };
    const tx = await this.send(command, '/payment-hub/v1/disbursements', {
      clientReference: command.idempotencyKey,
      amount: command.amountRwf,
      currency: command.currency,
      beneficiary: {
        fullName: payee.fullName,
        idType: payee.idType === 'passport' ? 'PASSPORT' : 'NATIONAL_ID',
        idNumber: payee.idNumber,
        phone: payee.phone,
        destination,
      },
      narration: (command.memo ?? '').slice(0, 140) || undefined,
    });
    return this.answer(command, tx);
  }

  async voidPending(command: VoidPendingCommand): Promise<PaymentReceipt> {
    let tx: HubTransaction;
    try {
      tx = this.parse(
        await this.request('POST', `/payment-hub/v1/collections/${encodeURIComponent(command.originalRef)}/cancel`, {}),
        command.idempotencyKey,
      );
    } catch (error) {
      if (error instanceof ProviderHttpError && error.kind === 'refused') {
        throw new PaymentDeclinedError(
          error.status === 409 ? 'the collection is no longer pending' : 'GTBank has no such collection',
          command.idempotencyKey,
        );
      }
      throw this.unavailable(error, command.idempotencyKey);
    }
    return this.receipt(tx, false, 'settled');
  }

  // --- Reads --------------------------------------------------------------

  async fetchTransaction(workspaceId: string, adapterRef: string): Promise<PaymentReceipt | null> {
    let tx: HubTransaction;
    try {
      tx = this.parse(await this.request('GET', `/payment-hub/v1/transactions/${encodeURIComponent(adapterRef)}`), adapterRef);
    } catch (error) {
      if (error instanceof ProviderHttpError && error.kind === 'refused' && error.status === 404) return null;
      throw this.unavailable(error, adapterRef);
    }
    // Every key we send starts with its workspace (ADR-020 AC-27): a reference
    // from another workspace is, to this one, no transaction at all.
    if (!tx.clientReference.startsWith(`${workspaceId}:`)) return null;
    return this.receiptFor(tx);
  }

  /**
   * GTBank's callback: `x-gtbank-signature: sha256=<hex>`, an HMAC of the raw
   * body under the webhook secret. Only ever a nudge to pull (ADR-073 D-g).
   */
  parseCallback(
    provider: string,
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ): CallbackEvent | null {
    if (provider !== 'gtbank') return null;
    const header = headers['x-gtbank-signature'];
    const given = Array.isArray(header) ? header[0] : header;
    const expected = `sha256=${createHmac('sha256', this.config.webhookSecret).update(rawBody).digest('hex')}`;
    if (!given || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
      return null;
    }
    try {
      const body = JSON.parse(rawBody.toString('utf8')) as { eventId?: unknown; transaction?: unknown };
      const tx = HubTransaction.parse(body.transaction);
      if (typeof body.eventId !== 'string') return null;
      if (tx.status === 'pending') return null;
      return {
        provider: 'gtbank',
        eventId: body.eventId,
        adapterRef: tx.transactionReference,
        outcome: tx.status === 'successful' ? 'settled' : 'failed',
        amountRwf: tx.amount,
        reason: tx.statusReason ?? undefined,
      };
    } catch {
      return null;
    }
  }

  // --- The wire -----------------------------------------------------------

  /** Send a money instruction and read the transaction back, mapping every failure to the seam's two. */
  private async send(command: PaymentCommand, path: string, body: unknown): Promise<HubTransaction> {
    this.log.debug(`${describeForLog(command)} -> GTBank ${path}`);
    try {
      return this.parse(await this.request('POST', path, body), command.idempotencyKey);
    } catch (error) {
      if (error instanceof ProviderHttpError && error.kind === 'refused') {
        // The bank read the instruction and said no: a wrong network, an
        // amount it will not take, or our key reused for another amount.
        const reason =
          error.providerCode === 'DUPLICATE_REFERENCE'
            ? 'idempotency key already used for a different amount'
            : ((error.body as { message?: string } | null)?.message ?? 'GTBank refused the instruction');
        throw new PaymentDeclinedError(reason, command.idempotencyKey);
      }
      throw this.unavailable(error, command.idempotencyKey);
    }
  }

  /** A transaction GTBank answered for a command, as the command's receipt or its decline. */
  private answer(command: PaymentCommand, tx: HubTransaction): PaymentReceipt {
    if (tx.status === 'rejected' || tx.status === 'failed' || tx.status === 'cancelled') {
      const code = tx.statusReason ?? '';
      throw new PaymentDeclinedError(
        FAILURE_WORDS[code] ?? `GTBank ended the transaction ${tx.status}`,
        command.idempotencyKey,
        code === 'INSUFFICIENT_FUNDS' && tx.type === 'disbursement'
          ? 'insufficient_funds'
          : code === 'NAME_MISMATCH'
            ? 'name_mismatch'
            : undefined,
      );
    }
    if (tx.amount !== command.amountRwf) {
      // GTBank answered for our key with another amount: that is not this command.
      throw new PaymentDeclinedError('idempotency key already used for a different amount', command.idempotencyKey);
    }
    const replayed = Date.parse(tx.createdAt) < Date.now() - 2_000;
    return this.receipt(tx, replayed);
  }

  private receiptFor(tx: HubTransaction): PaymentReceipt {
    return this.receipt(tx, false);
  }

  private receipt(tx: HubTransaction, replayed: boolean, force?: 'settled'): PaymentReceipt {
    const base: PaymentReceipt = {
      adapterRef: tx.transactionReference,
      mode: this.mode,
      replayed,
      amountRwf: tx.amount,
      currency: 'RWF',
      occurredAt: new Date(tx.updatedAt ?? tx.createdAt),
      settlement: force ?? (tx.status === 'pending' ? 'pending' : 'settled'),
    };
    switch (tx.status) {
      case 'reversed':
      case 'refunded':
        return { ...base, settlement: 'settled', providerStatus: tx.status };
      case 'rejected':
      case 'failed':
      case 'cancelled':
        // Not settled, and never going to be: the attempt ends now.
        return {
          ...base,
          settlement: force ?? 'pending',
          failure: { status: tx.status, reason: FAILURE_WORDS[tx.statusReason ?? ''] ?? `GTBank ended it ${tx.status}` },
        };
      default:
        return base;
    }
  }

  private parse(body: unknown, key: string): HubTransaction {
    const parsed = HubTransaction.safeParse(body);
    if (!parsed.success) {
      throw new PaymentUnavailableError('GTBank answered a transaction that does not read', key, 'maybe');
    }
    return parsed.data;
  }

  private async request(method: 'GET' | 'POST', path: string, json?: unknown, retry = true): Promise<unknown> {
    let token: string;
    try {
      token = await this.tokens.bearer();
    } catch (error) {
      // No token, no instruction: whatever the token request did, the money
      // request was never sent.
      throw new ProviderHttpError({
        provider: 'gtbank',
        kind: error instanceof ProviderHttpError && error.kind === 'unauthorised' ? 'unauthorised' : 'unavailable',
        status: error instanceof ProviderHttpError ? error.status : null,
        body: null,
        delivered: 'no',
        detail: `no token: ${(error as Error).message}`,
      });
    }
    try {
      const { body } = await providerFetch({
        provider: 'gtbank',
        method,
        url: `${this.config.baseUrl}${path}`,
        headers: { authorization: `Bearer ${token}` },
        json,
        timeoutMs: this.config.timeoutMs,
      });
      return body;
    } catch (error) {
      if (retry && error instanceof ProviderHttpError && error.kind === 'unauthorised') {
        this.tokens.invalidate();
        return this.request(method, path, json, false);
      }
      throw error;
    }
  }

  private unavailable(error: unknown, key: string): Error {
    if (error instanceof PaymentUnavailableError || error instanceof PaymentDeclinedError) return error;
    if (error instanceof ProviderHttpError) {
      if (error.kind === 'unauthorised') this.log.error('GTBank refused our credentials. Every payment is unavailable until it is fixed.');
      return new PaymentUnavailableError(error.message, key, error.delivered);
    }
    // The token request itself, or anything else unexpected: nothing was sent.
    return new PaymentUnavailableError((error as Error).message, key, 'no');
  }
}
