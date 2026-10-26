import {
  ebmQrPayload,
  type EbmReceipt,
  type EbmSdcBlock,
} from "@injishi/contracts";

/**
 * The specification's OWN worked examples, transcribed as `EbmReceipt` values.
 *
 * Source: `injishi.context/doc/rraebm.skill/CISforVSDC_technical_specsnew.pdf`,
 * clauses 13.1 (page 6), 14.1 (page 7), 15.1 (page 8), 16.1 (page 9) and 17.1
 * (page 10).
 *
 * WHY THIS FILE EXISTS. The API issues exactly one receipt type, `NS`, so five
 * of the six branches in `receipt-document.tsx` — the refund titles, the clause
 * 11 designation, the watermark, the "THIS IS NOT AN OFFICIAL RECEIPT" line,
 * the suppressed signature on a training or proforma ticket — are unreachable
 * from a real booking and could be quietly broken for months. Rendering the
 * specification's own drawings from the real component is the cheapest way to
 * make them checkable: a reviewer holds the PDF beside `/receipt/specimen` and
 * compares like with like, with the same numbers.
 *
 * TWO ARITHMETIC ERRORS IN THE SPECIFICATION ARE CORRECTED HERE, and both are
 * noted at the line. Transcribing them faithfully would produce a page whose
 * lines do not add up to its own totals, which teaches a reader to distrust the
 * component rather than the drawing.
 *
 * NOTHING HERE IS A RECEIPT. Every value is a placeholder printed in a public
 * standards document — "Trade Name", `TIN: 000000000`, `SDC001000001`. No
 * `signerMode` is set, which the contract says means the same as `"mock"`, so
 * every one of these renders with the not-a-fiscal-document warning the real
 * receipts carry.
 */

/** The taxpayer every specimen is issued by (13.1, header). */
const SELLER = {
  tradeName: "Trade Name",
  address: "Address, City",
  tin: "000000000",
} as const;

/** The Machine Registration Code every specimen prints (7.4). */
const MRC = "AAACC123456";

/** The device identifier every specimen prints (7.24.3). */
const SDC_ID = "SDC001000001";

/**
 * Complete an SDC block by DERIVING its QR payload rather than transcribing it.
 *
 * Two reasons, and the second is the one that matters. The payload is exactly
 * clause 7.24.7 applied to the six fields above it, so `ebmQrPayload` — the
 * contract's own implementation, the same one the API calls — is the right
 * source; a hand-typed copy would be a second answer that could disagree with
 * the drawing it claims to reproduce.
 *
 * And a transcribed payload is a string full of `#110735`, which reads to
 * `injishi/no-raw-color-classes` as a hex colour and fails the build. That rule
 * is right to be blunt about it: the fix is to stop writing the literal, not to
 * silence the rule.
 */
function withQr(block: Omit<EbmSdcBlock, "qrData">): EbmSdcBlock {
  return { ...block, qrData: ebmQrPayload(block) };
}

/**
 * Clause 13.1, page 6 — NORMAL SALE. This is the layout every other specimen
 * refers back to, and the one the driver walks section by section.
 *
 * The dates read `25/5/2012` in the drawing and `25/05/2012` here: `EbmDate` is
 * `dd/mm/yyyy` and the single-digit month in the PDF is the drawing being
 * loose, not a second date format.
 */
const NORMAL_SALE: EbmReceipt = {
  bookingReference: "SPEC-13-1",
  receiptType: "NS",
  transaction: "SALE",
  seller: SELLER,
  commercialMessage: "Welcome to our shop",
  clientId: "000000000",
  items: [
    {
      name: "Plain Bread",
      unitPriceRwf: 1000,
      quantity: 1,
      totalRwf: 1000,
      taxLabel: "A",
      discountPercent: null,
      discountedTotalRwf: null,
    },
    {
      name: "Gouda cheese",
      unitPriceRwf: 33600,
      quantity: 0.2,
      totalRwf: 6720,
      taxLabel: "B",
      discountPercent: 25,
      discountedTotalRwf: 5040,
    },
    {
      name: "Wriggly gum",
      unitPriceRwf: 60,
      quantity: 5,
      totalRwf: 300,
      taxLabel: "B",
      discountPercent: null,
      discountedTotalRwf: null,
    },
  ],
  totalRwf: 6340,
  totalTaxRwf: 814.58,
  taxLines: [
    { label: "A", ratePercent: 0, taxableRwf: 1000, taxRwf: 0 },
    { label: "B", ratePercent: 18, taxableRwf: 5340, taxRwf: 814.58 },
  ],
  payment: { label: "CASH", amountRwf: 6340 },
  itemsNumber: 3,
  sdc: withQr({
    date: "25/05/2012",
    time: "11:07:35",
    sdcId: SDC_ID,
    typeCounter: 168,
    totalCounter: 258,
    receiptLabel: "NS",
    internalData: "TE68-SLA2-34J5-EAV3-N569-88LJ-Q7",
    receiptSignature: "V249-J39C-FJ48-HE2W",
  }),
  cis: {
    receiptNumber: 152,
    date: "25/05/2012",
    time: "11:09:32",
    mrc: MRC,
  },
  closingMessage: [
    "THANK YOU",
    "COME BACK AGAIN",
    "YOUR BEST STORE IN TOWN",
  ],
};

/**
 * Clause 14.1, page 7 — NORMAL REFUND. Every amount is negative, which is the
 * whole content of clause 14, and the header carries the `REFUND` title and the
 * "approved only for original sales receipt" warning instead of a commercial
 * message.
 */
const NORMAL_REFUND: EbmReceipt = {
  bookingReference: "SPEC-14-1",
  receiptType: "NR",
  transaction: "REFUND",
  seller: SELLER,
  commercialMessage: "",
  clientId: "000000000",
  items: [
    {
      name: "Gravel /t",
      unitPriceRwf: 9000,
      quantity: 5.354,
      totalRwf: -48186,
      taxLabel: "B",
      discountPercent: 25,
      discountedTotalRwf: -36139.5,
    },
  ],
  totalRwf: -36139.5,
  totalTaxRwf: -5512.81,
  taxLines: [
    { label: "B", ratePercent: 18, taxableRwf: -36139.5, taxRwf: -5512.81 },
  ],
  payment: { label: "CASH", amountRwf: -36139.5 },
  itemsNumber: 1,
  sdc: withQr({
    date: "25/05/2012",
    time: "11:48:27",
    sdcId: SDC_ID,
    typeCounter: 12,
    totalCounter: 259,
    receiptLabel: "NR",
    internalData: "IR84-99TN-FCYY-CE22-4HWE-V5TA-EE",
    receiptSignature: "669X-TBMM-GPE4-445D",
  }),
  cis: {
    receiptNumber: 153,
    date: "25/05/2012",
    time: "11:50:24",
    mrc: MRC,
  },
  closingMessage: ["THANK YOU"],
};

/**
 * Clause 15.1, page 8 — COPY of a REFUND. The type the user's own instruction
 * named. It reprints the original's internal data verbatim (a copy is a copy)
 * under its own signature and counter, and carries the clause 11 designation,
 * watermark and warning.
 */
const COPY_REFUND: EbmReceipt = {
  ...NORMAL_REFUND,
  bookingReference: "SPEC-15-1",
  receiptType: "CR",
  sdc: withQr({
    ...NORMAL_REFUND.sdc,
    time: "11:49:47",
    typeCounter: 24,
    totalCounter: 260,
    receiptLabel: "CR",
    // A copy is signed as itself, so the signature differs from the original's
    // while the internal data it copies does not.
    receiptSignature: "REE4-EGMK-DSA2-PKMM",
  }),
  cis: {
    receiptNumber: 154,
    date: "25/05/2012",
    time: "11:51:44",
    mrc: MRC,
  },
  closingMessage: ["THANK YOU", "WE APPRECIATE YOUR BUSINESS"],
};

/** Clause 15 — a COPY of a SALE. Not drawn in the PDF; the sixth of six types. */
const COPY_SALE: EbmReceipt = {
  ...NORMAL_SALE,
  bookingReference: "SPEC-15-CS",
  receiptType: "CS",
  sdc: withQr({
    ...NORMAL_SALE.sdc,
    time: "11:08:41",
    typeCounter: 31,
    totalCounter: 261,
    receiptLabel: "CS",
  }),
  cis: {
    receiptNumber: 153,
    date: "25/05/2012",
    time: "11:10:04",
    mrc: MRC,
  },
};

/**
 * Clause 16.1, page 9 — TRAINING. "The printed information looks similar to the
 * NORMAL receipt information EXCLUDING digital signatures", so the SDC block
 * stops after the counter and there is no QR code.
 */
const TRAINING_SALE: EbmReceipt = {
  bookingReference: "SPEC-16-1",
  receiptType: "TS",
  transaction: "SALE",
  seller: SELLER,
  commercialMessage: "Welcome to our shop",
  clientId: "000000000",
  items: [
    {
      name: "Plain Bread",
      unitPriceRwf: 1000,
      quantity: 1,
      totalRwf: 1000,
      taxLabel: "A",
      discountPercent: null,
      discountedTotalRwf: null,
    },
    {
      name: "Wriggly gum",
      unitPriceRwf: 60,
      quantity: 5,
      totalRwf: 300,
      taxLabel: "B",
      discountPercent: null,
      discountedTotalRwf: null,
    },
  ],
  totalRwf: 1300,
  totalTaxRwf: 45.76,
  taxLines: [
    { label: "A", ratePercent: 0, taxableRwf: 1000, taxRwf: 0 },
    { label: "B", ratePercent: 18, taxableRwf: 300, taxRwf: 45.76 },
  ],
  // CORRECTION 1. Page 9 prints `CASH 6340.00` under a `TOTAL 1300.00`: the
  // figure was copied from the page 6 specimen. 1300.00 is what the drawing's
  // own lines add up to.
  payment: { label: "CASH", amountRwf: 1300 },
  itemsNumber: 2,
  sdc: withQr({
    date: "25/05/2012",
    time: "11:55:12",
    sdcId: SDC_ID,
    typeCounter: 33,
    totalCounter: 261,
    receiptLabel: "TS",
    // Empty on purpose, and legal: `EbmGroupedValue` admits the empty string
    // precisely so a training ticket can be expressed.
    internalData: "",
    receiptSignature: "",
  }),
  cis: {
    receiptNumber: 155,
    date: "25/05/2012",
    time: "11:57:08",
    mrc: MRC,
  },
  closingMessage: [
    "THANK YOU",
    "COME BACK AGAIN",
    "YOUR BEST STORE IN TOWN",
  ],
};

/**
 * Clause 17.1, page 10 — PROFORMA. Like training, no signature and no QR; and
 * unlike every other specimen, no payment line and no `ITEMS NUMBER`, because
 * nobody has paid.
 */
const PROFORMA_SALE: EbmReceipt = {
  bookingReference: "SPEC-17-1",
  receiptType: "PS",
  transaction: "SALE",
  seller: SELLER,
  commercialMessage: "Welcome to our shop",
  clientId: "000000000",
  items: [
    {
      name: "Cement 42.5/50kg",
      unitPriceRwf: 11000,
      quantity: 65,
      totalRwf: 715000,
      taxLabel: "B",
      discountPercent: null,
      discountedTotalRwf: null,
    },
    {
      // CORRECTION 2. Page 10 prints `30.00x 5500.00 16500.00B`, but 30 x 5500
      // is 165000, and 715000 + 165000 is the 880000.00 the same drawing gives
      // as its TOTAL. The line total is the digit that was dropped.
      name: "Clay local made brick",
      unitPriceRwf: 30,
      quantity: 5500,
      totalRwf: 165000,
      taxLabel: "B",
      discountPercent: null,
      discountedTotalRwf: null,
    },
  ],
  totalRwf: 880000,
  totalTaxRwf: 134237.29,
  taxLines: [
    { label: "B", ratePercent: 18, taxableRwf: 880000, taxRwf: 134237.29 },
  ],
  // Carried because the contract requires it, and not printed: `showsPayment`
  // refuses it for `PS`, which is what page 10 draws.
  payment: { label: "NOT PAID", amountRwf: 880000 },
  itemsNumber: 2,
  sdc: withQr({
    date: "25/05/2012",
    time: "12:17:41",
    sdcId: SDC_ID,
    typeCounter: 25,
    totalCounter: 262,
    receiptLabel: "PS",
    internalData: "",
    receiptSignature: "",
  }),
  cis: {
    receiptNumber: 156,
    date: "25/05/2012",
    time: "12:19:38",
    mrc: MRC,
  },
  closingMessage: [
    "THANK YOU",
    "WE LOOK FORWARD TO EARNING",
    "YOUR BUSINESS",
  ],
};

/** One specimen, with the clause and page it is transcribed from. */
interface Specimen {
  id: string;
  /** e.g. "Clause 13.1, page 6 — NORMAL SALE (NS)". */
  caption: string;
  /** What a reviewer should be looking at on this one. */
  note: string;
  receipt: EbmReceipt;
}

/** Every receipt type, in the order the specification introduces them. */
export const SPECIMENS: readonly Specimen[] = [
  {
    id: "ns",
    caption: "Clause 13.1, page 6 — NORMAL SALE (NS)",
    note: "The layout every other type refers back to: header, commercial message, items with a discount line, the four kinds of total, payment, the SDC block with its QR code, the CIS block, the closing message.",
    receipt: NORMAL_SALE,
  },
  {
    id: "nr",
    caption: "Clause 14.1, page 7 — NORMAL REFUND (NR)",
    note: "The REFUND title and the approval warning replace the commercial message, and every amount is negative.",
    receipt: NORMAL_REFUND,
  },
  {
    id: "cr",
    caption: "Clause 15.1, page 8 — COPY of a REFUND (CR)",
    note: "Clause 11 in full: COPY under the header, COPY again above the SDC block, COPY as a watermark, and THIS IS NOT AN OFFICIAL RECEIPT at twice the size of the amounts.",
    receipt: COPY_REFUND,
  },
  {
    id: "cs",
    caption: "Clause 15 — COPY of a SALE (CS)",
    note: "Not drawn in the specification. The same clause 11 treatment applied to the page 6 sale.",
    receipt: COPY_SALE,
  },
  {
    id: "ts",
    caption: "Clause 16.1, page 9 — TRAINING (TS)",
    note: "TRAINING MODE rather than TRAINING, and no internal data, signature or QR code: clause 16 excludes digital signatures.",
    receipt: TRAINING_SALE,
  },
  {
    id: "ps",
    caption: "Clause 17.1, page 10 — PROFORMA (PS)",
    note: "No signature, no QR code, and no payment or ITEMS NUMBER line: nothing has been paid.",
    receipt: PROFORMA_SALE,
  },
];
