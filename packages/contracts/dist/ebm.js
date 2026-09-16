"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EbmReceipt = exports.EbmPayment = exports.EbmSeller = exports.EbmCisBlock = exports.EbmSdcBlock = exports.EbmReceiptItem = exports.EbmTaxLine = exports.EbmGroupedValue = exports.EbmTime = exports.EbmDate = exports.EbmAmount = exports.EBM_VAT_LABEL = exports.EBM_VAT_RATE_PERCENT = exports.EbmTaxLabel = exports.EbmTransaction = exports.EbmReceiptType = void 0;
exports.ebmGroupInFours = ebmGroupInFours;
exports.ebmReceiptNumber = ebmReceiptNumber;
exports.ebmQrPayload = ebmQrPayload;
exports.ebmTaxIncludedIn = ebmTaxIncludedIn;
const zod_1 = require("zod");
const primitives_1 = require("./primitives");
/**
 * RRA EBM receipt — the ONE definition of what a Rwandan fiscal receipt looks
 * like on this platform.
 *
 * Source: "Technical Specification of CIS for VSDC, Ver.1.0, March 2018"
 * (`injishi.context/doc/rraebm.skill/CISforVSDC_technical_specsnew.pdf`). The
 * clause numbers quoted below are that document's, and they are quoted rather
 * than paraphrased because the layout is prescribed, not designed: a receipt
 * that renders the same information in a different order is not a compliant
 * receipt.
 *
 * The shape lives here rather than in the API because BOTH sides need it and
 * they must not drift. The API fills it, the receipt screen prints it, and the
 * clause that says a field exists is written once.
 *
 * The two exported helpers are here for the same reason. `ebmGroupInFours`
 * (7.24.5, 7.24.6) and `ebmQrPayload` (7.24.7) are format rules a verifier
 * checks against, so a second implementation in the browser is a second thing
 * that can be wrong — and the one that is wrong would be the one a taxpayer
 * scans.
 *
 * WHAT THIS TYPE IS NOT: carrying this shape does not make a document fiscal.
 * A receipt is fiscal because a real VSDC signed it (clause 10: the CIS may not
 * print at all before the VSDC has answered). Today the API fills the SDC block
 * from a declared mock — see `server/api/src/modules/ebm/infrastructure/
 * mock-vsdc.signer.ts`, which states in full what it fabricates.
 */
// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------
/**
 * Receipt label (clauses 13, 14, 15, 16 and 17). The first letter is the
 * receipt type, the second the transaction: `NS` normal sale, `NR` normal
 * refund, `CS`/`CR` a copy of either (clause 15), `TS` training (clause 16),
 * `PS` proforma. It prints on the SDC line as the `RT` of `A/B RT` (7.25.3).
 */
exports.EbmReceiptType = zod_1.z.enum(["NS", "NR", "CS", "CR", "TS", "PS"]);
/** Which way the money moved. A `REFUND` carries only negative amounts (14). */
exports.EbmTransaction = zod_1.z.enum(["SALE", "REFUND"]);
/**
 * Tax rate label (7.21.5): the four rates a CIS may be programmed with,
 * "A", "B", "C" and "D", corresponding to indexes 1-4. Rwanda's standard VAT
 * is "B"; "A" is the exempt band the sample receipt prints as `A-EX`.
 */
exports.EbmTaxLabel = zod_1.z.enum(["A", "B", "C", "D"]);
/** Rwanda's standard VAT rate, the band a stay is sold under. */
exports.EBM_VAT_RATE_PERCENT = 18;
/** The label that rate is programmed against (7.21.5). */
exports.EBM_VAT_LABEL = "B";
// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------
/**
 * An amount in whole Rwandan francs.
 *
 * Deliberately NOT `RwfAmount`, which is non-negative. A refund receipt
 * "contains only negative, refunded amounts" (clause 14), so a shape that
 * cannot hold a negative cannot hold an `NR` receipt at all. Integer because
 * RWF has no subunit; clause 7.5's two decimal places are a DISPLAY rule and
 * the receipt screen applies it.
 */
exports.EbmAmount = zod_1.z.number().int();
/** `dd/mm/yyyy`, the date format 7.24.2 prescribes for the SDC block. */
exports.EbmDate = zod_1.z
    .string()
    .regex(/^\d{2}\/\d{2}\/\d{4}$/, "expected dd/mm/yyyy");
/** `hh:mm:ss`, 24 hour, per 7.24.2. */
exports.EbmTime = zod_1.z
    .string()
    .regex(/^\d{2}:\d{2}:\d{2}$/, "expected hh:mm:ss");
/**
 * A value already grouped the way 7.24.5 and 7.24.6 require: dashes after every
 * fourth character, so the last group may be shorter than four.
 *
 * The empty string is allowed on purpose: a TRAINING receipt prints "similar to
 * the NORMAL receipt information EXCLUDING digital signatures" (clause 16), and
 * a shape that demanded a signature could not express one.
 */
exports.EbmGroupedValue = zod_1.z
    .string()
    .regex(/^$|^[A-Z0-9]{4}(-[A-Z0-9]{4})*(-[A-Z0-9]{1,3})?$/, "expected upper-case alphanumerics grouped in fours by dashes (7.24.5)");
// ---------------------------------------------------------------------------
// Receipt body
// ---------------------------------------------------------------------------
/**
 * One `TOTAL <label>-<rate>%` / `TOTAL TAX <label>` pair (clause 13.1).
 *
 * `taxableRwf` is the amount sold under this rate INCLUDING its tax, which is
 * what the sample receipt prints: 5340.00 under `B-18.00%` carries 814.58 of
 * tax, not 5340.00 + 961.20. Rwandan VAT is quoted inclusive, and reading this
 * field as tax-exclusive overstates every total by the tax.
 */
exports.EbmTaxLine = zod_1.z.object({
    label: exports.EbmTaxLabel,
    /** Percentage points, e.g. `18` for B-18.00%. Zero for an exempt band. */
    ratePercent: zod_1.z.number().min(0).max(100),
    taxableRwf: exports.EbmAmount,
    taxRwf: exports.EbmAmount,
});
/**
 * One sold line: `name`, then `unitPrice x quantity  total<TaxLabel>` (13.1).
 *
 * `quantity` is not an integer. The sample receipt sells 0.200 of a cheese and
 * 5.354 tonnes of gravel, so a CIS that could only sell whole units could not
 * print a compliant receipt for a weighed good. A night of a stay happens to be
 * a whole number; the shape does not assume it.
 *
 * `discountPercent` and `discountedTotalRwf` travel together — both null for an
 * undiscounted line, both set for a discounted one — because the discount line
 * (`discount -25%  5040.00`) prints the percentage and the resulting total on
 * one row, and half of that pair is not printable.
 */
exports.EbmReceiptItem = zod_1.z.object({
    name: zod_1.z.string().min(1),
    unitPriceRwf: exports.EbmAmount,
    quantity: zod_1.z.number().positive(),
    totalRwf: exports.EbmAmount,
    taxLabel: exports.EbmTaxLabel,
    discountPercent: zod_1.z.number().min(0).max(100).nullable(),
    discountedTotalRwf: exports.EbmAmount.nullable(),
});
/**
 * The block a CIS prints from the VSDC's response, verbatim (7.24).
 *
 * Every field here ORIGINATES AT THE VSDC. The CIS may format it — group it in
 * fours, build the QR string — and may not compute it. That is the whole point
 * of the device: the taxpayer's own system cannot mint these values, so a
 * receipt carrying them can be checked against the Authority's record.
 */
exports.EbmSdcBlock = zod_1.z.object({
    /** 7.24.2 — the VSDC's clock, not the CIS's. */
    date: exports.EbmDate,
    time: exports.EbmTime,
    /** 7.24.3 — `SDCXXXXXXXXX`, the device's identity. */
    sdcId: zod_1.z.string().regex(/^SDC\d{9}$/, "expected SDC followed by 9 digits"),
    /** 7.25.1 — `A`, the counter for this receipt type. */
    typeCounter: zod_1.z.number().int().positive(),
    /** 7.25.2 — `B`, the counter across every receipt type. */
    totalCounter: zod_1.z.number().int().positive(),
    /** 7.25.3 — `RT`, the label printed after the counters. */
    receiptLabel: exports.EbmReceiptType,
    /** 7.24.5 — grouped in fours by `ebmGroupInFours`. */
    internalData: exports.EbmGroupedValue,
    /** 7.24.6 — grouped in fours by `ebmGroupInFours`. */
    receiptSignature: exports.EbmGroupedValue,
    /**
     * 7.24.7 — the exact string the QR code encodes. Stored rather than derived
     * at paint time so the value a verifier scans is the value the server
     * committed to, and so `ebmQrPayload` has exactly one caller per receipt.
     */
    qrData: zod_1.z
        .string()
        .regex(/^\d{8}#\d{6}#[^#]*#\d+\/\d+#[^#]*#[^#]*$/, "expected ddmmyyyy#hhmmss#sdcId#A/B#internalData#signature (7.24.7)"),
    /**
     * Whether a REAL device produced this block, or a mock did.
     *
     * Not part of the printed layout — no clause asks for it, and a genuine
     * receipt would never need it. It is here because the alternative is worse:
     * without it, a screen holding this object cannot tell a signature from a
     * decoration, and every consumer would have to know by convention that the
     * platform is not yet integrated with the RRA. A field that says so travels
     * with the document and cannot be forgotten in one surface.
     *
     * Optional so that the shape agreed for this receipt is unchanged for
     * anything that does not set it. A consumer reading `"mock"` — or reading
     * nothing at all, which today means the same thing — must not present the
     * document as a tax receipt.
     */
    signerMode: primitives_1.AdapterMode.optional(),
});
/**
 * The block the CIS prints from its OWN record (13.1, bottom section).
 *
 * It repeats a receipt number, a date and a time that the SDC block also
 * carries, and the duplication is the point: the two are produced by different
 * machines and an auditor compares them. They are not expected to be identical
 * — the sample receipt's CIS clock reads two minutes after its VSDC clock.
 */
exports.EbmCisBlock = zod_1.z.object({
    /** The CIS's own consecutive receipt number (7.3). */
    receiptNumber: zod_1.z.number().int().positive(),
    date: exports.EbmDate,
    time: exports.EbmTime,
    /** 7.4 — the Machine Registration Code identifying this CIS. */
    mrc: zod_1.z.string().min(1),
});
/** The taxpayer the receipt is issued by (13.1, header). */
exports.EbmSeller = zod_1.z.object({
    tradeName: zod_1.z.string().min(1),
    /** "Address, City" as one printable line. */
    address: zod_1.z.string(),
    /**
     * The taxpayer's TIN as registered. Not shape-validated here: what a valid
     * TIN looks like is the registration pipeline's fact, and a receipt that
     * refused to render because a seeded org carried an unusual TIN would hide
     * a data problem behind a 500 instead of printing it where it is visible.
     */
    tin: zod_1.z.string().min(1),
});
/** How the sale was settled (7.13, printed above `ITEMS NUMBER`). */
exports.EbmPayment = zod_1.z.object({
    label: zod_1.z.string().min(1),
    amountRwf: exports.EbmAmount,
});
/**
 * A complete RRA EBM receipt, top to bottom in printing order.
 *
 * No cross-field arithmetic is enforced here on purpose. This schema is the
 * WIRE contract — the thing a client uses to decide whether it can render what
 * it received — and a client that rejects a receipt because the issuer's
 * rounding differs from its own has turned a display into an outage. The
 * arithmetic is the issuer's responsibility and is pinned by the API's own
 * tests, where a wrong total is a failing build rather than a blank screen.
 */
exports.EbmReceipt = zod_1.z.object({
    /** Which booking this receipt is for. Our key, not the Authority's. */
    bookingReference: zod_1.z.string().min(1),
    receiptType: exports.EbmReceiptType,
    transaction: exports.EbmTransaction,
    seller: exports.EbmSeller,
    /** Free text printed under the header, e.g. "Welcome to our shop". */
    commercialMessage: zod_1.z.string(),
    /** 13.1 marks the client's identification optional; null when unknown. */
    clientId: zod_1.z.string().nullable(),
    items: zod_1.z.array(exports.EbmReceiptItem).min(1),
    /** The `TOTAL` line: what is actually paid, tax included. */
    totalRwf: exports.EbmAmount,
    /** The `TOTAL TAX` line: the sum of every `taxLines[].taxRwf`. */
    totalTaxRwf: exports.EbmAmount,
    taxLines: zod_1.z.array(exports.EbmTaxLine).min(1),
    payment: exports.EbmPayment,
    /** 7.27 — the number of items shown on the receipt, excluding voids. */
    itemsNumber: zod_1.z.number().int().nonnegative(),
    sdc: exports.EbmSdcBlock,
    cis: exports.EbmCisBlock,
    /** Closing commercial message, one entry per printed line. */
    closingMessage: zod_1.z.array(zod_1.z.string()),
});
// ---------------------------------------------------------------------------
// Format rules (7.24.5, 7.24.6, 7.24.7, 7.25)
// ---------------------------------------------------------------------------
/** 7.24.5 and 7.24.6: "separate by dash after every 4th character". */
const GROUP_SIZE = 4;
/**
 * Group a VSDC value in fours, e.g.
 * `TE68SLA234J5EAV3N56988LJQ7` -> `TE68-SLA2-34J5-EAV3-N569-88LJ-Q7`.
 *
 * A value shorter than one group, or empty, comes back unchanged: there is no
 * separator to place, and returning a trailing dash would corrupt the QR
 * payload this value is also embedded in.
 *
 * Dashes already present are stripped first, so the function is idempotent.
 * Both ends of the wire have a copy of this rule and the receipt already
 * arrives grouped; re-grouping it in the browser must not produce
 * `TE68--SLA2`. Nothing else is stripped — an unexpected character is left
 * where it is rather than silently swallowed, because a value that does not
 * look like a VSDC value is a signal, not noise to be tidied.
 */
function ebmGroupInFours(value) {
    const raw = value.replace(/-/g, "");
    if (raw.length <= GROUP_SIZE)
        return raw;
    const groups = [];
    for (let i = 0; i < raw.length; i += GROUP_SIZE) {
        groups.push(raw.slice(i, i + GROUP_SIZE));
    }
    return groups.join("-");
}
/** The counters half of 7.25's `A/B RT`, without the receipt label. */
function ebmReceiptNumber(sdc) {
    return `${sdc.typeCounter}/${sdc.totalCounter}`;
}
/**
 * 7.24.7, verbatim: the QR code is
 * `invoice_date(ddmmyyyy)#time(hhmmss)#sdc number#sdc_receipt_number#internal_data#receipt_signature`.
 *
 * Note the date loses its slashes and the time its colons — `ddmmyyyy` and
 * `hhmmss`, not the `dd/mm/yyyy` and `hh:mm:ss` the same values print as three
 * lines above. The separators are removed rather than the string reformatted,
 * so a date the schema already vouched for cannot be reordered by accident on
 * the way into the payload.
 *
 * The receipt number is the `A/B` form of 7.25 WITHOUT the `RT` label: the
 * label prints on the receipt and is not part of the scanned string.
 */
function ebmQrPayload(sdc) {
    const date = sdc.date.replace(/\D/g, "");
    const time = sdc.time.replace(/\D/g, "");
    return [
        date,
        time,
        sdc.sdcId,
        ebmReceiptNumber(sdc),
        sdc.internalData,
        sdc.receiptSignature,
    ].join("#");
}
// ---------------------------------------------------------------------------
// Tax arithmetic
// ---------------------------------------------------------------------------
/**
 * The tax contained in a tax-INCLUSIVE total, in whole francs.
 *
 * Rwandan VAT is quoted inclusive, and the specification's own sample receipt
 * is the proof: 5340.00 sold under `B-18.00%` prints `TOTAL TAX B 814.58`, and
 * 5340 x 18 / 118 = 814.576. The tax-exclusive reading (5340 x 0.18 = 961.20)
 * is not what that receipt says.
 *
 * It lives beside the schema because it DEFINES what `EbmTaxLine.taxRwf` means,
 * which is the test for putting arithmetic in this package rather than in one
 * of its consumers.
 *
 * Rounding is half-away-from-zero rather than `Math.round`, which rounds -0.5
 * up to -0. A refund receipt carries negative amounts (clause 14) and must
 * round to the same magnitude as the sale it reverses, or the two disagree by a
 * franc and the refund no longer balances.
 */
function ebmTaxIncludedIn(totalRwf, ratePercent = exports.EBM_VAT_RATE_PERCENT) {
    if (ratePercent <= 0)
        return 0;
    const raw = (totalRwf * ratePercent) / (100 + ratePercent);
    return raw < 0 ? -Math.round(-raw) : Math.round(raw);
}
//# sourceMappingURL=ebm.js.map