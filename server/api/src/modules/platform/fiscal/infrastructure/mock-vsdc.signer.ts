import {
  ebmGroupInFours,
  ebmQrPayload,
  type AdapterMode,
} from '@injishi/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';

import { ebmClockFor } from '../domain/receipt-time';
import type {
  VsdcPort,
  VsdcSignRequest,
  VsdcSignature,
} from '../domain/vsdc-port';

/**
 * A MOCK Virtual Sales Data Controller. It signs nothing.
 *
 * READ THIS BEFORE USING ANYTHING IT PRODUCES.
 *
 * - **The SDC id, the internal data, the receipt signature, the counters and
 *   the Machine Registration Code are FABRICATED.** They are SHA-256 digests —
 *   of the booking reference, or of the seller's workspace id for the two
 *   device-identity fields — rendered into the alphabet the RRA sample receipts
 *   use so that they look like the real thing. They carry NO
 *   cryptographic meaning whatsoever: nothing is signed, no key exists, no
 *   authority issued them, and no verifier can check them. They are decoration
 *   with the shape of evidence.
 * - **What this produces is NOT a fiscal document, and must never be handed to
 *   a taxpayer, a guest or a tax officer as one.** It does not discharge any
 *   obligation under the Rwandan EBM regime. Presenting it as a tax invoice
 *   would misrepresent an unregistered document as one issued by a certified
 *   device — which is the harm this comment exists to prevent, and the reason
 *   the receipt screen must keep saying so where a reader can see it.
 * - **Clause 10 is not satisfied and cannot be.** "It shall be impossible to
 *   issue receipt if the CIS did not receive any response from the VSDC." This
 *   class IS the response. There is no device on the other side of it.
 * - **Clause 7.3 is not satisfied either.** A real receipt counter is
 *   consecutive and ascending across the life of the machine, which is what
 *   makes the journal complete and unalterable. These counters are a hash: they
 *   are stable per booking, which is what a reproducible demo needs, and they
 *   are neither consecutive nor ascending, which is what an audit needs.
 *
 * **What has to change before any of this becomes real.** The RRA's own
 * integration document — `VSDC SPECIFICATION DOCUMENT v1.0.5___2023-05-16_.pdf`,
 * which sits beside the CIS specification in
 * `injishi.context/doc/rraebm.skill/` — defines the calls a certified system
 * makes. All of them are missing here:
 *
 *   1. Initialise the device and obtain its credentials, so an SDC id names a
 *      device the Authority issued rather than a hash of a workspace id.
 *   2. Register the taxpayer, their branch, their items and their tax rates,
 *      so what this file guesses (the MRC, the programmed rates) is configured.
 *   3. Send each sale and USE THE RESPONSE — its date, time, SDC id, counters,
 *      internal data and signature — instead of manufacturing them. The
 *      `VsdcPort` seam exists so that this is one new class binding to
 *      `VSDC_PORT` and no change at any call site.
 *   4. Refuse to print when that call fails, per clause 10, rather than falling
 *      back to this class. A fallback that fabricates a signature when the real
 *      device is down is worse than an outage.
 *
 * Until then the honest description of this platform's position is: it renders
 * the RRA-recommended invoice layout, and it is not integrated with the RRA.
 *
 * It is `mock` on `AdapterMode` — the same flag the payment seam carries — so
 * any surface that wants to badge an unreal figure can read it rather than
 * infer it.
 */
@Injectable()
export class MockVsdcSigner implements VsdcPort {
  readonly mode: AdapterMode = 'mock';

  private readonly log = new Logger(MockVsdcSigner.name);

  /**
   * The alphabet the sample receipts in clause 13.1 use for internal data and
   * signatures: upper-case letters and digits, e.g. `TE68-SLA2-34J5-…`.
   */
  private static readonly ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  private static readonly LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  private static readonly DIGITS = '0123456789';

  /** Lengths taken from the specification's own worked examples (13.1). */
  private static readonly INTERNAL_DATA_LENGTH = 26;
  private static readonly SIGNATURE_LENGTH = 16;

  /**
   * `async` because the port is, and the port is because every real VSDC call
   * is a round trip that can time out. A synchronous fake would let callers be
   * written in a shape the real device cannot support.
   */
  async sign(request: VsdcSignRequest): Promise<VsdcSignature> {
    const { date, time } = ebmClockFor(request.occurredAt);

    /**
     * Device identity is derived from the SELLER, not from the sale.
     *
     * A VSDC belongs to a registered taxpayer and signs every receipt that
     * taxpayer issues, so an SDC id that changed from one receipt to the next
     * would not merely be fake, it would be fake in a way that contradicts the
     * specification. Same for the MRC (7.4), which names the invoicing machine.
     */
    const sdcId = `SDC${this.token(`${request.sellerKey}:sdc-id`, 9, MockVsdcSigner.DIGITS)}`;
    const mrc =
      this.token(`${request.sellerKey}:mrc`, 5, MockVsdcSigner.LETTERS) +
      this.token(`${request.sellerKey}:mrc-serial`, 6, MockVsdcSigner.DIGITS);

    /**
     * Everything else is derived from the BOOKING, so the same booking always
     * yields the same receipt. That is not a fiscal property — a real device
     * would answer with a fresh counter every time it was asked — it is a demo
     * property: a guest who reloads the receipt page must not watch the
     * document underneath them change.
     */
    const reference = request.bookingReference;
    const typeCounter = 1 + this.number(`${reference}:type-counter`, 999);
    const totalCounter =
      typeCounter + this.number(`${reference}:total-counter`, 5_000);

    /**
     * Clauses 16 and 17: a training ticket and a proforma are printed
     * "EXCLUDING digital signatures", so the device answers them with none. An
     * empty value is what the contract accepts for exactly this case, and what
     * keeps a fabricated signature off a document the specification says has
     * none, even in a consumer that forgot to hide it.
     */
    const signed = request.receiptType !== 'TS' && request.receiptType !== 'PS';

    const internalData = signed
      ? ebmGroupInFours(
          this.token(
            `${reference}:internal-data`,
            MockVsdcSigner.INTERNAL_DATA_LENGTH,
          ),
        )
      : '';

    /**
     * The one property this shares with a real signature: it covers the
     * amounts. Change the total, the tax or the item count and the value
     * changes. That is arithmetic, not cryptography — anyone can recompute it,
     * because the only input is public and there is no key — but it means the
     * signature cannot be quietly detached from the sale it sits under while
     * this build is used to develop the surfaces that read it.
     */
    const receiptSignature = signed
      ? ebmGroupInFours(
          this.token(
            [
              reference,
              request.receiptType,
              request.transaction,
              request.totalRwf,
              request.totalTaxRwf,
              request.itemsNumber,
              sdcId,
              typeCounter,
              totalCounter,
            ].join('|'),
            MockVsdcSigner.SIGNATURE_LENGTH,
          ),
        )
      : '';

    const sdc = {
      date,
      time,
      sdcId,
      typeCounter,
      totalCounter,
      receiptLabel: request.receiptType,
      internalData,
      receiptSignature,
      // 7.24.7. Built from this block by the one shared implementation, so the
      // string a guest scans is the string the contract describes.
      qrData: ebmQrPayload({
        date,
        time,
        sdcId,
        typeCounter,
        totalCounter,
        internalData,
        receiptSignature,
      }),
      // Travels with the document, so no surface has to remember by convention
      // that this platform is not integrated with the RRA.
      signerMode: this.mode,
    };

    /**
     * The CIS half. Its clock reads the same instant as the SDC block's on
     * purpose: on a real machine the two differ by however long the round trip
     * took (the sample receipt shows two minutes), and inventing a plausible
     * gap here would be fabricating the appearance of a round trip that did not
     * happen. One instant, honestly repeated, is the truer fake.
     */
    const cis = {
      receiptNumber: 1 + this.number(`${reference}:cis-receipt`, 99_999),
      date,
      time,
      mrc,
    };

    // Debug rather than dropped: while this seam is mocked, this line is the
    // only trace that a receipt was "signed" at all.
    this.log.debug(
      `MOCK VSDC signature for ${reference}: ${sdcId} ${typeCounter}/${totalCounter} ${request.receiptType}`,
    );

    return { sdc, cis };
  }

  /**
   * `length` characters drawn from `alphabet`, deterministic in `seed`.
   *
   * Hashed in blocks so a value longer than one digest is still fully derived
   * rather than padded. The modulo is very slightly biased toward the first few
   * characters of the alphabet; that would matter for a key and does not matter
   * here, because nothing about this value is secret or unpredictable — it is
   * derived from a booking reference anyone holding the receipt can read.
   */
  private token(
    seed: string,
    length: number,
    alphabet: string = MockVsdcSigner.ALPHANUM,
  ): string {
    let out = '';
    for (let block = 0; out.length < length; block++) {
      const digest = createHash('sha256').update(`${seed}#${block}`).digest();
      for (const byte of digest) {
        if (out.length === length) break;
        out += alphabet[byte % alphabet.length];
      }
    }
    return out;
  }

  /** A number in `[0, span)`, deterministic in `seed`. */
  private number(seed: string, span: number): number {
    return createHash('sha256').update(seed).digest().readUInt32BE(0) % span;
  }
}
