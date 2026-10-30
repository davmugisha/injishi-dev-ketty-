import {
  breakdownAsCharged,
  type AdapterMode,
  type BookingStatus,
  type EbmSeller,
  type PaymentStatus,
} from '@injishi/contracts';

import { nightsBetween } from '../../pms/domain/pricing';
import type { StayForReceipt } from './receipt-builder';

/** Payment states in which the money stayed with the seller — a sale happened. */
export const SETTLED: readonly PaymentStatus[] = ['captured', 'forfeited', 'paid_out'];

/**
 * Payment states in which money went back, or is owed back and on its way
 * (073-gtbank-payments AC-13). Clause 14 territory, not 13.
 */
const REFUNDED: readonly PaymentStatus[] = ['refunded_full', 'refunded_partial', 'refund_pending'];

/**
 * Why a booking cannot be invoiced as a sale. Carries the wording a person is
 * shown; the HTTP layer and the emission worker each decide what it means for
 * them (a 409 to a guest, a held sale for the worker).
 */
export class SaleNotInvoiceable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaleNotInvoiceable';
  }
}

/** The columns this decision reads. `BookingForReceipt` satisfies it. */
export interface SaleFacts {
  reference: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus | null;
  checkIn: string;
  checkOut: string;
  lockedNightlyRateRwf: number | null;
  nonRefundable: boolean;
  grossRwf: number | null;
  roomTypeName: string;
  propertyName: string;
  addressText: string | null;
  districtName: string | null;
  sellerLegalName: string | null;
  sellerTin: string | null;
  paymentAdapterMode: AdapterMode | null;
}

/**
 * The booking row as the receipt needs it, refusing anything it cannot state
 * truthfully.
 *
 * Every refusal below is a case where SOMETHING could be printed and the
 * something would be a lie: a total that is not what was charged, a TIN that
 * belongs to nobody, a sale that was refunded. A fiscal document with a
 * plausible wrong field on it is worse than no document.
 *
 * One function for both readers — the guest's receipt and the emission worker —
 * because a sale the worker certified and the receipt then refused to print (or
 * the reverse) would be two definitions of "a sale" disagreeing about money.
 */
export function stayForReceipt(booking: SaleFacts): StayForReceipt {
  const paid = booking.paymentStatus;
  if (!paid || !SETTLED.includes(paid)) {
    throw new SaleNotInvoiceable(
      paid && REFUNDED.includes(paid)
        ? // Clause 14: money that came back is declared on a NORMAL REFUND
          // (NR) receipt, which carries negative amounts and a reference to
          // the sale it reverses. This build does not issue one, and issuing
          // the SALE receipt instead would declare a sale that was undone.
          'This booking was refunded. A refund receipt (RRA type NR) is not issued yet.'
        : 'No payment has been captured for this booking, so there is nothing to invoice.',
    );
  }

  if (booking.status === 'declined' || booking.status === 'cancelled') {
    throw new SaleNotInvoiceable(
      `This booking was ${booking.status}. No sale receipt is issued for it.`,
    );
  }

  /**
   * The taxpayer. A receipt names the person who owes the tax, so a workspace
   * with no org behind it, or an org with no TIN, has nothing to name.
   *
   * The TIN is NOT defaulted. The specification's samples print
   * `TIN: 000000000` because they are samples; printing it on a live receipt
   * would attribute a real sale to a taxpayer number that identifies nobody.
   * A residence-domain org legitimately holds a UPI and no TIN (see the
   * `orgs_identifier_shape` check), and the honest answer for one of those is
   * that it cannot issue a VAT receipt, not that it can issue a blank one.
   */
  if (!booking.sellerLegalName || !booking.sellerTin) {
    throw new SaleNotInvoiceable(
      'This property has no registered taxpayer with a TIN, so no EBM receipt can be issued for it.',
    );
  }

  const nights = nightsBetween(booking.checkIn, booking.checkOut);
  if (
    nights <= 0 ||
    booking.lockedNightlyRateRwf === null ||
    booking.grossRwf === null
  ) {
    // Without the locked rate there is no way to split the charge into a room
    // rate, a discount and a fee, and clause 7.16 forbids registering an
    // amount without identifying the service it paid for.
    throw new SaleNotInvoiceable(
      'This booking does not carry the locked rate a receipt is itemised from.',
    );
  }

  const seller: EbmSeller = {
    tradeName: booking.sellerLegalName,
    // "Address, City" (13.1). Whichever halves exist; an empty header line is
    // a gap in the property record, not a reason to refuse the receipt.
    address: [booking.addressText, booking.districtName]
      .filter((part): part is string => Boolean(part))
      .join(', '),
    tin: booking.sellerTin,
  };

  return {
    bookingReference: booking.reference,
    seller,
    propertyName: booking.propertyName,
    roomTypeName: booking.roomTypeName,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    /**
     * Re-derived from the LOCKED rate with the same function the charge used
     * (`computeBreakdown`, owned by `@injishi/contracts`). Not recomputed
     * from today's price list — that would re-price a sold stay — and not
     * stored, because the booking row keeps the total and the rate rather
     * than the split. The builder then refuses if the split does not add back
     * up to `chargedRwf`.
     */
    // As charged: a booking paid under the old 5% guest service fee keeps its fee line (2026-10-29).
    breakdown: breakdownAsCharged(
      {
        nightlyRateRwf: booking.lockedNightlyRateRwf,
        nights,
        nonRefundable: booking.nonRefundable,
      },
      booking.grossRwf,
    ),
    chargedRwf: booking.grossRwf,
    /**
     * 7.13 wants the actual means of payment, and nothing records one:
     * `escrows` stores which side of the payment seam took the money, not
     * whether the guest paid by MTN MoMo, Airtel Money or card. So the line
     * says what is true — money arrived through the online payment seam — and
     * says when that seam was a mock, rather than printing a network name
     * this platform never observed. (The certified invoice sends RRA's
     * `07 OTHER` for the same reason; see `ebm-emission.service.ts`.)
     */
    paymentLabel:
      booking.paymentAdapterMode === 'live'
        ? 'ONLINE PAYMENT'
        : 'ONLINE PAYMENT (MOCK)',
    /**
     * 13.1 marks the client's identification optional, and it means a TIN or
     * a national id — a customer's own tax identity, which we never collect
     * for a stay. The guest's user id is not that and printing it would put a
     * meaningless number where an auditor expects a real one.
     */
    clientId: null,
  };
}
