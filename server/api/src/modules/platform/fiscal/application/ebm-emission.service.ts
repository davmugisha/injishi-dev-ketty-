import { Inject, Injectable, Logger } from '@nestjs/common';

import { EBM_LIVE, type EbmLive } from '../domain/ebm-live';
import {
  ReceiptArithmeticError,
  priceStay,
  type PricedStay,
  type StayForReceipt,
} from '../domain/receipt-builder';
import { SaleNotInvoiceable, stayForReceipt } from '../domain/stay-for-receipt';
import { VsdcResponseError, readVsdcSale } from '../domain/vsdc-response';
import {
  EbmApiError,
  type EbmCertifiedInvoice,
  type EbmInvoiceRequest,
} from '../infrastructure/ebm-api.client';
import { EbmBookingRepository } from '../infrastructure/ebm-booking.repository';
import {
  EbmEmissionRepository,
  type EbmEmissionRow,
  type EmissionPayload,
} from '../infrastructure/ebm-emission.repository';
import { EbmConnectionService, type Credentials } from './ebm-connection.service';

/**
 * RRA payment type for a booking paid online (VSDC spec §4.10: `07` OTHER).
 *
 * Nothing records whether the guest paid by MTN MoMo, Airtel Money or card —
 * `escrows` knows which side of the payment seam took the money and not the
 * instrument (see `stay-for-receipt.ts`, the same fact for the printed line).
 * `06` MOBILE MONEY or `05` CARD would each be a guess, and a guess declared to
 * the tax authority is a false declaration some of the time. `07` is true every
 * time.
 *
 * The provider's own docs label codes differently (04 "Mobile Money", 06 "Bank
 * Transfer") from RRA's table. `07` does not appear in their list at all, so if
 * the provider rejects it, that surfaces as a `rejected` sale with the
 * provider's words, not as a silently wrong code. ADR-041 records both tables.
 */
export const ONLINE_PAYMENT_CODE = '07';

/** First retry after an outage, doubling to the cap. Never gives up (F-B13). */
const RETRY_BASE_MS = 60_000;
const RETRY_CAP_MS = 60 * 60_000;

export function retryDelayMs(attempts: number): number {
  const exponent = Math.max(0, Math.min(attempts - 1, 16));
  return Math.min(RETRY_BASE_MS * 2 ** exponent, RETRY_CAP_MS);
}

/**
 * A certified tax of 28831.36 against our 28831 is the provider rounding to
 * cents where this platform rounds to francs; a franc or more is a different
 * sale. The total is compared to the cent — it is the money that moved.
 */
const TAX_TOLERANCE_RWF = 1;
const TOTAL_TOLERANCE_RWF = 0.005;

/** What `prepare` hands the send step. */
interface Prepared {
  request: EbmInvoiceRequest;
  payload: EmissionPayload;
  accessToken: string;
  reference: string;
}

export type EmissionOutcome =
  | 'emitted'
  | 'emitted_with_problem'
  | 'held'
  | 'retry'
  | 'parked'
  | 'not_due';

/**
 * Certifies one sale with RRA through the taxpayer's own EBM account, once
 * (F-B13, ADR-041).
 *
 * The order is the specification's and is not rearrangeable: claim the row,
 * price the stay from the locked rate, check the business can invoice, send,
 * then record exactly what came back. Every exit writes the row, so the table
 * never disagrees with what happened for longer than one call.
 *
 * WHAT IS NEVER DONE HERE: sending a sale a second time when nobody knows
 * whether the first send certified. The provider's invoice POST has no
 * idempotency key, so the only protection against declaring a stay twice is
 * this service refusing to guess. `EbmApiClient` classifies the failure;
 * `unknown_outcome` parks the row for a person, with the reason on it.
 */
@Injectable()
export class EbmEmissionService {
  private readonly log = new Logger(EbmEmissionService.name);

  constructor(
    private readonly emissions: EbmEmissionRepository,
    private readonly bookings: EbmBookingRepository,
    private readonly connections: EbmConnectionService,
    @Inject(EBM_LIVE) private readonly live: EbmLive | null,
  ) {}

  protected now(): Date {
    return new Date();
  }

  async emit(emissionId: string): Promise<EmissionOutcome> {
    const row = await this.emissions.claim(emissionId, this.now());
    if (!row) return 'not_due';

    // Everything up to the send. Anything that THROWS here — a database read,
    // a token that will not decrypt — happened before a byte left this
    // process, so the honest answer is "try again later", not "ask a person".
    let prepared: Prepared | EmissionOutcome;
    try {
      prepared = await this.prepare(row);
    } catch (error) {
      return this.retry(row.id, row.attempts, `could not prepare the sale: ${describe(error)}`);
    }
    if (typeof prepared === 'string') return prepared;
    const { request, payload, accessToken, reference } = prepared;

    let invoice: EbmCertifiedInvoice;
    try {
      invoice = await this.send(row.orgId!, accessToken, request);
    } catch (error) {
      return this.failed(row.id, row.attempts, row.orgId!, error, payload);
    }

    // A 200 that says the VSDC did not certify. The provider now holds an
    // uncertified invoice; whether it will retry that one itself is not
    // documented, so sending a second could end with two certified. A person
    // decides, with the provider's invoice id in front of them.
    if (invoice.status !== 'Certified') {
      return this.park(
        row.id,
        `the provider recorded invoice ${invoice.id} as "${invoice.status ?? 'no status'}", not Certified; check it at the provider before sending again`,
        { ...payload, response: invoice.raw },
      );
    }

    try {
      return await this.recordCertified(row.id, invoice, payload, accessToken, reference);
    } catch (error) {
      // CERTIFIED and not recorded. The row stays where `claim` left it —
      // failed, no next attempt, "in progress" — which is the right state: it
      // will not be re-sent. This line is the only place the Authority's
      // answer survives, so it carries all of it.
      this.log.error(
        `EBM sale ${reference} WAS CERTIFIED as provider invoice ${invoice.id} but could not be recorded ` +
          `(${describe(error)}). Record it by hand from this answer: ${JSON.stringify(invoice.raw)}`,
      );
      throw error;
    }
  }

  /** Parks a claimed row for a person. `payload` keeps whatever was built. */
  private async park(id: string, reason: string, payload?: EmissionPayload): Promise<'parked'> {
    await this.emissions.markFailed(id, { reason, retryAt: null, payload });
    this.log.error(`EBM sale ${id} parked for a person: ${reason}`);
    return 'parked';
  }

  /**
   * Everything that must be true before a sale may be sent, in order: the
   * booking still exists and is a sale, it prices to what was charged, the
   * business can invoice, and its account is still its own TIN. Returns what
   * to send, or the outcome that stopped it.
   */
  private async prepare(row: EbmEmissionRow): Promise<Prepared | EmissionOutcome> {
    if (!this.live) {
      // The worker never claims in mock mode (nothing writes rows then), so
      // reaching here is a deployment that switched mode with sales queued.
      return this.park(row.id, 'RRA invoicing was switched to mock mode with this sale still queued');
    }
    /**
     * ONLY A BOOKING'S NORMAL SALE CAN BE SENT (ADR-050, slice 1).
     *
     * The provider's `createInvoice` takes a customer, a means of payment and
     * catalog item ids, and nothing else: it has no receipt type, no RRA item
     * codes and no `refId`. So a proforma sent through it would be certified AS
     * A SALE, declaring the room weeks early under a label that says it is not
     * one, and a folio's lines have no provider item to name. Both are parked,
     * visibly, until ADR-050 settles whether Injishi is the certified system
     * (and so talks to the VSDC itself) or a client of this provider.
     */
    if (row.receiptType !== 'normal' || row.transactionType !== 'sale') {
      return this.park(
        row.id,
        `a ${row.receiptLabel} cannot be sent: the EBM provider API can only certify a normal sale (ADR-050 follow up)`,
      );
    }
    if (row.source !== 'booking') {
      return this.park(
        row.id,
        `a ${row.source} sale cannot be sent yet: the EBM provider API has no item for its lines (ADR-050 follow up)`,
      );
    }
    if (!row.bookingId || !row.orgId) {
      return this.park(row.id, 'this emission row names no booking or no org');
    }

    const booking = await this.bookings.findForEmission(row.bookingId);
    if (!booking) return this.park(row.id, `booking ${row.bookingId} no longer exists`);

    let stay: StayForReceipt;
    let priced: PricedStay;
    try {
      stay = stayForReceipt(booking);
      priced = priceStay(stay);
    } catch (error) {
      if (error instanceof SaleNotInvoiceable || error instanceof ReceiptArithmeticError) {
        return this.park(row.id, error.message);
      }
      throw error;
    }

    let creds: Credentials;
    try {
      creds = await this.connections.credentialsFor(row.orgId);
    } catch (error) {
      // The provider could not be reached to renew the token. Nothing was sent.
      return this.retry(row.id, row.attempts, `could not renew the EBM token: ${describe(error)}`);
    }
    if (!creds.ready) {
      await this.emissions.releaseToHeld(row.id, creds.reason);
      this.log.warn(`EBM sale ${booking.reference} held: ${creds.reason}`);
      return 'held';
    }
    if (booking.sellerTin && !sameDigits(creds.tin, booking.sellerTin)) {
      // The org's TIN changed after it connected. Certifying under the old
      // account would declare this sale for somebody else.
      await this.emissions.releaseToHeld(
        row.id,
        `the connected EBM account (TIN ${creds.tin}) is not this business's TIN (${booking.sellerTin}); reconnect`,
      );
      return 'held';
    }

    const request = this.requestFor(stay, creds.mapping);
    return {
      request,
      accessToken: creds.accessToken,
      reference: booking.reference,
      payload: {
        request,
        totals: {
          totalRwf: priced.totalRwf,
          totalTaxRwf: priced.totalTaxRwf,
          itemsNumber: priced.items.length,
        },
      },
    };
  }

  /**
   * Send, recovering once from a refused token. A 401 means the provider did
   * not process the request, so the second send cannot double a sale.
   */
  private async send(
    orgId: string,
    accessToken: string,
    request: EbmInvoiceRequest,
  ): Promise<EbmCertifiedInvoice> {
    const client = this.live!.client;
    try {
      return await client.createInvoice(accessToken, request);
    } catch (error) {
      if (!(error instanceof EbmApiError) || error.kind !== 'unauthorized') throw error;
      const renewed = await this.connections.credentialsFor(orgId, { forceRefresh: true });
      if (!renewed.ready) throw error;
      return client.createInvoice(renewed.accessToken, request);
    }
  }

  private async recordCertified(
    id: string,
    invoice: EbmCertifiedInvoice,
    payload: EmissionPayload,
    accessToken: string,
    reference: string,
  ): Promise<EmissionOutcome> {
    const emittedAt = this.now();
    let response = invoice.raw;
    let problem: string | null = null;

    // The documented answer omits two device fields RRA's own response carries.
    // If the POST's answer lacks them, ask for the invoice once more before
    // declaring the receipt unprintable. Whatever happens, the row is EMITTED:
    // the sale is certified, and treating it as unsent would invite a resend.
    let fields;
    try {
      fields = readVsdcSale(response);
    } catch (first) {
      if (!(first instanceof VsdcResponseError)) throw first;
      try {
        const fetched = await this.live!.client.invoice(accessToken, invoice.id);
        response = { ...invoice.raw, ...fetched.raw };
        fields = readVsdcSale(response);
      } catch (second) {
        problem = `certified as provider invoice ${invoice.id}, but ${
          second instanceof VsdcResponseError ? second.message : first.message
        }; the receipt cannot print until it is read`;
      }
    }

    if (fields && !problem) {
      if (fields.totAmt !== null && Math.abs(fields.totAmt - payload.totals.totalRwf) > TOTAL_TOLERANCE_RWF) {
        problem = `RRA certified a total of ${fields.totAmt} RWF but the guest was charged ${payload.totals.totalRwf} RWF`;
      } else if (
        fields.taxAmtB !== null &&
        Math.abs(fields.taxAmtB - payload.totals.totalTaxRwf) >= TAX_TOLERANCE_RWF
      ) {
        problem = `RRA certified VAT of ${fields.taxAmtB} RWF but the receipt computes ${payload.totals.totalTaxRwf} RWF`;
      }
    }

    await this.emissions.markEmitted(id, {
      externalInvoiceId: invoice.id,
      payload: { ...payload, response, ...(problem ? { readError: problem } : {}) },
      emittedAt,
      problem,
    });

    if (problem) {
      this.log.error(`EBM sale ${reference} certified with a problem: ${problem}`);
      return 'emitted_with_problem';
    }
    this.log.log(`EBM sale ${reference} certified as provider invoice ${invoice.id}`);
    return 'emitted';
  }

  private async failed(
    id: string,
    attempts: number,
    orgId: string,
    error: unknown,
    payload: EmissionPayload,
  ): Promise<EmissionOutcome> {
    if (!(error instanceof EbmApiError)) {
      // Something threw that the client did not classify. The request may have
      // left, so it is treated as the dangerous case.
      await this.emissions.markFailed(id, {
        reason: `outcome unknown after an unexpected error: ${describe(error)}; check the provider before sending again`,
        retryAt: null,
        payload,
      });
      this.log.error(`EBM sale ${id}: unexpected error while sending: ${describe(error)}`);
      return 'parked';
    }

    switch (error.kind) {
      case 'unavailable':
        return this.retry(id, attempts, error.message, payload);
      case 'unauthorized':
        // Still refused after a forced refresh: the authorisation is gone.
        await this.connections.markRevoked(orgId, error.message);
        await this.emissions.releaseToHeld(id, 'The RRA EBM authorisation was withdrawn. Reconnect the account.');
        return 'held';
      case 'rejected':
        await this.emissions.markFailed(id, { reason: error.message, retryAt: null, payload });
        this.log.error(`EBM sale ${id} rejected by the provider: ${error.message}`);
        return 'parked';
      case 'unknown_outcome':
        await this.emissions.markFailed(id, {
          reason: `${error.message}. Check the provider for this sale before sending it again — a second send may declare it twice.`,
          retryAt: null,
          payload,
        });
        this.log.error(`EBM sale ${id}: OUTCOME UNKNOWN — ${error.message}`);
        return 'parked';
    }
  }

  private async retry(
    id: string,
    attempts: number,
    reason: string,
    payload?: EmissionPayload,
  ): Promise<EmissionOutcome> {
    const retryAt = new Date(this.now().getTime() + retryDelayMs(attempts));
    await this.emissions.markFailed(id, {
      reason: `${reason} (retrying at ${retryAt.toISOString()})`,
      retryAt,
      payload,
    });
    this.log.warn(`EBM sale ${id} will retry at ${retryAt.toISOString()}: ${reason}`);
    return 'retry';
  }

  /**
   * The invoice request for a stay: the lines the receipt prints, sold as the
   * catalog items the business mapped.
   *
   * Room nights go at the locked nightly rate with the non-refundable reduction
   * as the invoice's discount, and the service fee as its own line — the same
   * split `receipt-builder.ts` prints, so the certified total and the printed
   * total are one number. The provider spreads `discount` across the lines in
   * proportion; both are taxed at B, so the tax it certifies is the tax the
   * receipt shows.
   */
  private requestFor(
    stay: StayForReceipt,
    mapping: Extract<Credentials, { ready: true }>['mapping'],
  ): EbmInvoiceRequest {
    const { breakdown } = stay;
    const items: EbmInvoiceRequest['items'] = [
      {
        id: mapping.accommodationItemId!,
        quantity: breakdown.nights,
        unitPrice: breakdown.nightlyRateRwf,
      },
    ];
    if (breakdown.serviceFeeRwf > 0) {
      items.push({ id: mapping.serviceFeeItemId!, quantity: 1, unitPrice: breakdown.serviceFeeRwf });
    }
    return {
      customerId: mapping.walkInCustomerId!,
      paymentMethod: ONLINE_PAYMENT_CODE,
      ...(breakdown.nonRefundableDiscountRwf > 0
        ? { discount: breakdown.nonRefundableDiscountRwf }
        : {}),
      items,
    };
  }
}

function sameDigits(a: string, b: string): boolean {
  return a.replace(/\D/g, '') === b.replace(/\D/g, '');
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
