import type { AdapterMode } from '@injishi/contracts';
import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';

import { PLATFORM, type Platform } from '../../../shared/config/platform';
import type {
  VsdcPort,
  VsdcSignRequest,
  VsdcSignature,
} from '../domain/vsdc-port';
import {
  VsdcResponseError,
  readVsdcSale,
  signatureFromVsdc,
} from '../domain/vsdc-response';
import {
  EbmEmissionRepository,
  type EmissionPayload,
} from './ebm-emission.repository';
import { MockVsdcSigner } from './mock-vsdc.signer';

/** A receipt for a sale RRA has not certified yet. The guest's wording. */
export const NOT_CERTIFIED_YET =
  "This stay is still being certified with RRA. Its receipt will be available once that completes.";

/** A certified sale whose receipt cannot be printed as it stands. */
export const NOT_PRINTABLE = "This stay's RRA receipt is not available yet.";

/**
 * The live side of `VSDC_PORT` (ADR-041): the VSDC's answer, as RRA gave it,
 * read back from where the emission worker stored it.
 *
 * It does NOT call the provider. That is the whole difference from the mock,
 * and the reason the port could be kept: `sign()` on the mock fabricates a
 * signature on every read, which is harmless because it is fake. A live
 * `sign()` that called RRA on every read would certify a NEW sale each time a
 * guest reloaded their receipt — a stay declared once per page view. So the
 * certification happens exactly once, in `EbmEmissionService`, and this class
 * returns what that one certification said.
 *
 * Clause 10 holds: no answer from the VSDC, no receipt. A sale still queued, a
 * sale parked for a person, or a certified sale whose answer is missing a
 * device field all refuse — never fall back to the mock, never print what is
 * there and leave a blank where a signature belongs.
 *
 * And the totals are checked against what was certified. The receipt the guest
 * sees is built from the booking at read time; the signature was issued over
 * the figures priced at emission. If the two disagree, the booking changed after
 * it was declared, and printing today's lines under yesterday's signature would
 * put RRA's authority behind figures RRA never saw.
 */
@Injectable()
export class LiveVsdcSigner implements VsdcPort {
  readonly mode: AdapterMode = 'live';

  private readonly log = new Logger(LiveVsdcSigner.name);

  /**
   * What a DEMO receipt is signed with. A demo process refuses to boot in live
   * mode (ADR-043 AC-13), so this branch is the second line of ADR-041 D-p: the
   * demo's bookings are never certified (the trigger refuses them), so a live
   * read would answer "being certified" forever and break the demo. It gets the
   * declared mock instead, which puts `signerMode: "mock"` on the document and
   * NOT A FISCAL RECEIPT on the paper.
   */
  private readonly demoSigner = new MockVsdcSigner();

  constructor(
    private readonly emissions: EbmEmissionRepository,
    @Inject(PLATFORM)
    private readonly platform: Platform,
  ) {}

  async sign(request: VsdcSignRequest): Promise<VsdcSignature> {
    if (this.platform.environment === 'demo') return this.demoSigner.sign(request);

    const row = await this.emissions.findForBookingReference(request.bookingReference);
    if (!row || row.status !== 'emitted' || !row.emittedAt) {
      throw new ConflictException(NOT_CERTIFIED_YET);
    }

    const payload = row.payload as EmissionPayload | null;
    const refuse = (detail: string): never => {
      this.log.error(`EBM receipt for ${request.bookingReference} not printed: ${detail}`);
      throw new ConflictException(NOT_PRINTABLE);
    };

    if (!payload?.response) return refuse('the certified sale has no stored answer');
    if (payload.readError) return refuse(payload.readError);

    const certified = payload.totals;
    if (
      certified.totalRwf !== request.totalRwf ||
      certified.totalTaxRwf !== request.totalTaxRwf ||
      certified.itemsNumber !== request.itemsNumber
    ) {
      return refuse(
        `the receipt prices ${request.totalRwf}/${request.totalTaxRwf} RWF over ${request.itemsNumber} line(s), ` +
          `but the sale was certified at ${certified.totalRwf}/${certified.totalTaxRwf} RWF over ${certified.itemsNumber}`,
      );
    }

    try {
      return signatureFromVsdc(readVsdcSale(payload.response), request.receiptType, row.emittedAt);
    } catch (error) {
      if (error instanceof VsdcResponseError) return refuse(error.message);
      throw error;
    }
  }
}
