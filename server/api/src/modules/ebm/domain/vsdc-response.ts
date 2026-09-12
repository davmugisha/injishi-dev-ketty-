import {
  EbmCisBlock,
  EbmSdcBlock,
  ebmGroupInFours,
  ebmQrPayload,
  type EbmReceiptType,
} from '@injishi/contracts';

import { ebmClockFor } from './receipt-time';
import type { VsdcSignature } from './vsdc-port';

/**
 * Reading a certified sale's device fields out of what the provider answered.
 *
 * RRA's own `saveSales` response (VSDC SPECIFICATION v1.0.5, §3.3.6.1) carries
 * exactly what clause 7.24 prints and nothing a CIS may compute:
 *
 *   { "rcptNo": 27, "intrlData": "GZGG…", "rcptSign": "TQZM…",
 *     "totRcptNo": 32, "vsdcRcptPbctDate": "20211027162114",
 *     "sdcId": "SDC010000005", "mrcNo": "WIS01006230" }
 *
 * The Injishi EBM provider wraps that call, and its documented `CertifiedInvoice`
 * lists only part of it — `rcptNo`, `intrlData`, `rcptSign`, `sdcId`, `mrcNo` —
 * with no device clock and no total counter. So this reader looks for RRA's
 * field names wherever the provider may have put them (top level, under
 * `vsdcResponse`, or under `vsdcResponse.data`), and when a field is in none of
 * those places it REFUSES.
 *
 * It never fills a gap. Clause 7.24 is the list of values the taxpayer's own
 * system is not allowed to mint — that is what makes them evidence — and a
 * receipt whose VSDC clock was really the CIS's clock, or whose total counter
 * was really its type counter, is a fiscal document asserting something the
 * device never said. The mock signer fabricates these on purpose and says so;
 * the live path must not do it by accident.
 */

/** Why a certified sale's answer cannot be printed as a receipt. */
export class VsdcResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VsdcResponseError';
  }
}

/** The device's answer, as RRA names it, after extraction and type checks. */
export interface VsdcSaleFields {
  /** `A` of 7.25: the counter for this receipt type. */
  rcptNo: number;
  /** `B` of 7.25: the counter across every receipt type. */
  totRcptNo: number;
  /** The VSDC's clock, `yyyyMMddHHmmss`. */
  vsdcRcptPbctDate: string;
  sdcId: string;
  mrcNo: string;
  intrlData: string;
  rcptSign: string;
  /** The provider's consecutive invoice number: the CIS receipt number (7.3). */
  invcNo: number;
  /** What the provider says it certified, for the comparison against our charge. */
  totAmt: number | null;
  taxAmtB: number | null;
}

type Bag = Record<string, unknown>;

function asBag(value: unknown): Bag | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Bag)
    : null;
}

/** The places the provider may have put RRA's fields, most specific first. */
function sources(raw: Bag): Bag[] {
  const vsdc = asBag(raw.vsdcResponse);
  return [asBag(vsdc?.data), vsdc, asBag(raw.data), raw].filter(
    (bag): bag is Bag => bag !== null,
  );
}

function find(raw: Bag, key: string): unknown {
  for (const bag of sources(raw)) {
    const value = bag[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function integer(raw: Bag, key: string): number {
  const value = find(raw, key);
  const n = typeof value === 'string' ? Number(value.trim()) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n <= 0) {
    throw new VsdcResponseError(
      value === undefined
        ? `the certified sale's answer has no ${key}`
        : `the certified sale's ${key} is not a positive integer`,
    );
  }
  return n;
}

function text(raw: Bag, key: string): string {
  const value = find(raw, key);
  if (typeof value !== 'string' || value.trim() === '') {
    throw new VsdcResponseError(`the certified sale's answer has no ${key}`);
  }
  return value.trim();
}

function amount(raw: Bag, key: string): number | null {
  const value = find(raw, key);
  if (value === undefined) return null;
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/**
 * Pull RRA's fields out of a certified invoice, or `VsdcResponseError` naming
 * the first one missing.
 */
export function readVsdcSale(raw: unknown): VsdcSaleFields {
  const bag = asBag(raw);
  if (!bag) {
    throw new VsdcResponseError('the certified sale has no answer to read');
  }
  const pbct = text(bag, 'vsdcRcptPbctDate');
  if (!/^\d{14}$/.test(pbct)) {
    throw new VsdcResponseError(
      `the certified sale's vsdcRcptPbctDate "${pbct}" is not yyyyMMddHHmmss`,
    );
  }
  return {
    rcptNo: integer(bag, 'rcptNo'),
    totRcptNo: integer(bag, 'totRcptNo'),
    vsdcRcptPbctDate: pbct,
    sdcId: text(bag, 'sdcId'),
    mrcNo: text(bag, 'mrcNo'),
    intrlData: text(bag, 'intrlData'),
    rcptSign: text(bag, 'rcptSign'),
    invcNo: integer(bag, 'invcNo'),
    totAmt: amount(bag, 'totAmt'),
    taxAmtB: amount(bag, 'taxAmtB'),
  };
}

/**
 * `yyyyMMddHHmmss` → `dd/mm/yyyy` + `hh:mm:ss`, by re-slicing the device's own
 * digits. Deliberately NOT parsed into a `Date` and re-formatted: the VSDC
 * states its time in its own (Kigali) clock with no zone, and a round trip
 * through `Date` would reinterpret it in the server's zone. The value printed is
 * the value the device sent, in the layout 7.24.2 prescribes.
 */
export function vsdcClock(pbct: string): { date: string; time: string } {
  const y = pbct.slice(0, 4);
  const mo = pbct.slice(4, 6);
  const d = pbct.slice(6, 8);
  const h = pbct.slice(8, 10);
  const mi = pbct.slice(10, 12);
  const s = pbct.slice(12, 14);
  const valid =
    Number(mo) >= 1 && Number(mo) <= 12 &&
    Number(d) >= 1 && Number(d) <= 31 &&
    Number(h) <= 23 && Number(mi) <= 59 && Number(s) <= 59;
  if (!valid) {
    throw new VsdcResponseError(`the device clock "${pbct}" is not a real instant`);
  }
  return { date: `${d}/${mo}/${y}`, time: `${h}:${mi}:${s}` };
}

/**
 * The two receipt blocks for a certified sale.
 *
 * `sdc` is the device's answer verbatim, formatted only in the two ways the
 * specification permits: grouped in fours (7.24.5, 7.24.6) and assembled into
 * the QR string (7.24.7).
 *
 * `cis` is the Certified Invoicing System's own record (13.1, bottom block). The
 * provider is that system here, so its consecutive invoice number (`invcNo`) is
 * the CIS receipt number and its MRC is the machine code. The CIS clock is the
 * instant this platform received the certification (`certifiedAt`), in Kigali
 * time: the provider does not report its own print time, and that instant is
 * the one at which this receipt came into existence on this side.
 *
 * Both blocks are validated against the contract before they are returned, so
 * a device value outside the prescribed shape (an SDC id that is not
 * `SDC` + 9 digits, say) is caught here with its field named, rather than
 * surfacing as a generic invalid receipt later.
 */
export function signatureFromVsdc(
  fields: VsdcSaleFields,
  receiptType: EbmReceiptType,
  certifiedAt: Date,
): VsdcSignature {
  const { date, time } = vsdcClock(fields.vsdcRcptPbctDate);
  const internalData = ebmGroupInFours(fields.intrlData.toUpperCase());
  const receiptSignature = ebmGroupInFours(fields.rcptSign.toUpperCase());

  const sdcCandidate = {
    date,
    time,
    sdcId: fields.sdcId,
    typeCounter: fields.rcptNo,
    totalCounter: fields.totRcptNo,
    receiptLabel: receiptType,
    internalData,
    receiptSignature,
    qrData: ebmQrPayload({
      date,
      time,
      sdcId: fields.sdcId,
      typeCounter: fields.rcptNo,
      totalCounter: fields.totRcptNo,
      internalData,
      receiptSignature,
    }),
    signerMode: 'live' as const,
  };
  const sdc = EbmSdcBlock.safeParse(sdcCandidate);
  if (!sdc.success) {
    const issue = sdc.error.issues[0];
    throw new VsdcResponseError(
      `the device's ${issue.path.join('.')} does not have the shape clause 7.24 prescribes: ${issue.message}`,
    );
  }

  const cisClock = ebmClockFor(certifiedAt);
  const cis = EbmCisBlock.safeParse({
    receiptNumber: fields.invcNo,
    date: cisClock.date,
    time: cisClock.time,
    mrc: fields.mrcNo,
  });
  if (!cis.success) {
    const issue = cis.error.issues[0];
    throw new VsdcResponseError(
      `the CIS block's ${issue.path.join('.')} is invalid: ${issue.message}`,
    );
  }

  return { sdc: sdc.data, cis: cis.data };
}
