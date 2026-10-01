import { EbmReceipt } from '@injishi/contracts';
import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import {
  ReceiptArithmeticError,
  buildStayReceipt,
  priceStay,
  type PricedStay,
  type StayForReceipt,
} from '../domain/receipt-builder';
import {
  SaleNotInvoiceable,
  stayForReceipt,
} from '../domain/stay-for-receipt';
import {
  EBM_SIGN_POINT,
  receiptSignPoint,
  type SignPoint,
} from '../domain/sign-point';
import { VSDC_PORT, type VsdcPort } from '../domain/vsdc-port';
import { EbmBookingRepository } from '../infrastructure/ebm-booking.repository';

/**
 * The one refusal for "there is no such receipt for you".
 *
 * A booking that does not exist and a booking belonging to somebody else get
 * the SAME answer, worded the same way. A reference is eight characters from a
 * 31-letter alphabet and is printed on confirmations; a 403 that distinguished
 * the two would turn it into an oracle for enumerating other people's stays,
 * and the receipt carries a guest's dates and a business's TIN.
 */
const NO_RECEIPT = 'No receipt for that booking reference.';

/** References look like `BK-7Q2M-4XKD`. Anything else is not one. */
const REFERENCE_SHAPE = /^[A-Z0-9-]{1,32}$/;

/**
 * Issues the RRA EBM receipt for a stay: a NORMAL SALE (`NS`, clause 13), or,
 * for a booking confirmed under ADR-050's `checkout` rule, the PROFORMA (`PS`,
 * clause 17) that stands for its prepayment until the bill is closed.
 *
 * The order of operations is the order the specification implies and is not
 * rearrangeable: find the sale, refuse if there is no sale to invoice, price it
 * from the locked rate, ask the VSDC to sign it (7.19, 7.20, clause 10), print
 * what came back. The signing step is what makes a receipt a receipt, so it
 * happens before anything is returned and never after.
 *
 * TODAY THAT SIGNING STEP IS A DECLARED MOCK. See
 * `infrastructure/mock-vsdc.signer.ts`, which states in full what it fabricates
 * and what must change before any of this is fiscal.
 */
@Injectable()
export class EbmReceiptService {
  private readonly log = new Logger(EbmReceiptService.name);

  constructor(
    private readonly bookings: EbmBookingRepository,
    @Inject(VSDC_PORT) private readonly vsdc: VsdcPort,
    @Inject(EBM_SIGN_POINT) private readonly signPoint: SignPoint,
  ) {}

  /**
   * The receipt for a booking the caller made, or `NotFoundException`.
   *
   * The reference is upper-cased before the lookup, so a link a guest retyped
   * in lower case still resolves — references are minted from an upper-case
   * alphabet, so this widens what is accepted without widening what matches.
   */
  async receiptForGuest(
    reference: string,
    guestUserId: string,
  ): Promise<EbmReceipt> {
    const normalized = reference.trim().toUpperCase();
    if (!REFERENCE_SHAPE.test(normalized)) {
      // Not "bad request": a caller probing the route learns nothing from a
      // 404 it would not also get for a well-formed reference it does not hold.
      throw new NotFoundException(NO_RECEIPT);
    }

    const booking = await this.bookings.findGuestBooking(
      normalized,
      guestUserId,
    );
    if (!booking) throw new NotFoundException(NO_RECEIPT);

    let stay: StayForReceipt;
    try {
      stay = stayForReceipt(booking);
    } catch (error) {
      if (error instanceof SaleNotInvoiceable) {
        throw new ConflictException(error.message);
      }
      throw error;
    }

    // Priced first, signed second (7.19: the CIS sends the receipt DATA to the
    // VSDC). A device signs a sale; asking it before the totals exist would be
    // asking it to sign nothing in particular.
    let priced: PricedStay;
    try {
      priced = priceStay(stay);
    } catch (error) {
      if (!(error instanceof ReceiptArithmeticError)) throw error;
      // Loud, named, and with the reference in it: this means the booking row
      // and the rate it locked disagree, which is a data defect somebody has to
      // look at. The caller gets no arithmetic detail — it is not their fault
      // and not their business.
      this.log.error(
        `Refusing to issue a receipt for ${stay.bookingReference}: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'This booking could not be invoiced. Nothing was issued.',
      );
    }

    /**
     * WHICH DOCUMENT THE GUEST HOLDS (ADR-050 D-a, AC-1).
     *
     * Under `checkout` the booking's document is the PROFORMA: the same priced
     * stay, but no receipt signature, no QR and no payment line (clause 17),
     * and `THIS IS NOT AN OFFICIAL RECEIPT` on the paper (clause 11). The sale
     * itself is signed once, when the bill is closed at check out. Read from the
     * booking's stamp, as the emission trigger reads it, so the guest and the
     * pipeline never disagree about which document this booking raised.
     */
    const receiptType =
      receiptSignPoint(booking.ebmSignAt, booking.status, this.signPoint) === 'checkout'
        ? 'PS'
        : 'NS';

    /**
     * Not wrapped. Clause 10 makes a failed VSDC call fatal to the receipt —
     * "it shall be impossible to issue receipt if the CIS did not receive any
     * response" — so whatever a live adapter throws (a timeout, a 503, a
     * refusal) must reach the caller as itself. Swallowing it into a generic
     * 500 would hide the one condition the specification cares most about, and
     * fabricating a signature to fill the gap is exactly what the mock signer's
     * own comment forbids.
     */
    const signature = await this.vsdc.sign({
      bookingReference: stay.bookingReference,
      // The taxpayer's device. One business, one workspace, one VSDC.
      sellerKey: booking.workspaceId,
      receiptType,
      transaction: 'SALE',
      /**
       * The instant the sale concluded, not the instant the guest opened the
       * page. `confirmedAt` when the booking was confirmed, `createdAt` when it
       * is still awaiting a host — either way it is the moment the money was
       * captured, which is the event being declared. It is also what makes the
       * receipt reproducible: a clock read at render time would restamp the
       * document on every reload.
       */
      occurredAt: booking.confirmedAt ?? booking.createdAt,
      totalRwf: priced.totalRwf,
      totalTaxRwf: priced.totalTaxRwf,
      itemsNumber: priced.items.length,
    });

    const receipt = buildStayReceipt(stay, priced, signature, receiptType);

    // Validated against the contract before it leaves. The schema is what the
    // receipt screen trusts, so a receipt that fails it is a defect here and
    // must surface here — in a log with a stack — rather than as a blank screen
    // in a browser nobody is watching.
    const checked = EbmReceipt.safeParse(receipt);
    if (!checked.success) {
      this.log.error(
        `Built an invalid EBM receipt for ${stay.bookingReference}: ${JSON.stringify(checked.error.issues)}`,
      );
      throw new InternalServerErrorException(
        'This booking could not be invoiced. Nothing was issued.',
      );
    }
    return checked.data;
  }
}
