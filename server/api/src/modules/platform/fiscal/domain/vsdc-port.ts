import type {
  AdapterMode,
  EbmCisBlock,
  EbmReceiptType,
  EbmSdcBlock,
  EbmTransaction,
} from '@injishi/contracts';

/** Nest injection token. Everything depends on the interface, not a class. */
export const VSDC_PORT = 'VSDC_PORT';

/**
 * What the Certified Invoicing System hands the VSDC before it may print.
 *
 * Clause 7.19 says the CIS "send[s] receipt data to VSDC in prescribed format";
 * clause 10 says it "shall be impossible to issue receipt if the CIS did not
 * receive any response from the VSDC". So this is not an optional decoration
 * step at the end of building a receipt — it is the step that decides whether
 * there is a receipt at all, which is why the port sits in front of the builder
 * rather than beside it.
 *
 * The fields are the ones a signature has to cover. A device that signed only
 * a reference would be signing nothing an auditor could check the totals
 * against.
 */
export interface VsdcSignRequest {
  /**
   * Our own key for the sale, and the reason a receipt is reproducible: the
   * same booking asked twice must come back with the same signature, or a guest
   * who reloads the page holds two different fiscal documents for one stay.
   */
  bookingReference: string;
  /**
   * The taxpayer whose device signs. A VSDC belongs to a registered taxpayer,
   * not to the platform, so the seller is part of the request and not an
   * ambient setting — the day this runs against a real VSDC there is one
   * device per business, and this is the field that picks it.
   */
  sellerKey: string;
  receiptType: EbmReceiptType;
  transaction: EbmTransaction;
  /** When the sale was concluded. Stamped onto both blocks (7.24.2). */
  occurredAt: Date;
  /** The tax-inclusive `TOTAL` being signed. */
  totalRwf: number;
  /** The `TOTAL TAX` line that total contains. */
  totalTaxRwf: number;
  /** 7.27 — how many item lines the receipt shows. */
  itemsNumber: number;
}

/**
 * The two machine-produced blocks a printed receipt carries.
 *
 * `sdc` is the VSDC's response verbatim (7.20, 7.24) — its clock, its device
 * id, its counters, its signature. Nothing in it may be computed by us.
 *
 * `cis` is OUR machine's own record (13.1, bottom block): the CIS receipt
 * number, the CIS clock and the Machine Registration Code from 7.4. In a real
 * deployment it does NOT come from the VSDC — the MRC is configuration and the
 * receipt number is a durable ascending counter (7.3). It rides along on this
 * one seam today because both halves are fabricated by the same mock and both
 * become real in the same piece of work: a registered machine with a counter.
 * Splitting the seam before either exists would only make the fake look more
 * like an architecture than it is.
 */
export interface VsdcSignature {
  sdc: EbmSdcBlock;
  cis: EbmCisBlock;
}

/**
 * The seam between this platform and a Virtual Sales Data Controller.
 *
 * There is exactly one implementation today and it is a declared mock. The
 * interface exists anyway, for the reason the payment seam exists: the callers
 * that will one day have to handle a device that is unreachable, slow, or
 * refusing are written now, against something shaped like the real thing,
 * rather than discovered on the day a real device is connected.
 */
export interface VsdcPort {
  /** Which side of the seam this implementation is. Never inferred. */
  readonly mode: AdapterMode;

  sign(request: VsdcSignRequest): Promise<VsdcSignature>;
}
