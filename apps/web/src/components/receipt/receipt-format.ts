import type {
  EbmReceipt,
  EbmReceiptItem,
  EbmReceiptType,
  EbmSdcBlock,
  EbmTaxLabel,
  EbmTaxLine,
} from "@injishi/contracts";

/**
 * The printing rules of the RRA receipt, in one place.
 *
 * Source: "Technical Specification of CIS for VSDC, Ver.1.0, March 2018"
 * (`injishi.context/doc/rraebm.skill/CISforVSDC_technical_specsnew.pdf`). Every
 * function here is a clause, and the clause number is on it. They are separated
 * from the component because a layout rule that is also arithmetic — how many
 * decimals, which suffix, which title — is a thing to be read and checked
 * against the specification, and that is far harder to do inside JSX.
 *
 * Nothing here recomputes a value the server sent. The receipt arrives priced,
 * totalled and signed; this file decides how those numbers are SPELLED.
 */

/**
 * Clause 7.5 — every amount shows two decimal places.
 *
 * `EbmAmount` is an integer number of francs because RWF has no subunit, so
 * the two decimals are always `.00` on a genuine line. They are printed anyway:
 * the rule is about the shape of the column an auditor reads down, not about
 * precision, and a receipt that dropped them would be non-compliant while
 * looking tidier.
 *
 * No thousands separator, matching the specimen (`33600.00`, not `33,600.00`).
 * A separator is a locale decision and this document has no locale — it has a
 * prescribed format.
 *
 * Negative amounts keep their sign, because a REFUND receipt "contains only
 * negative, refunded amounts" (clause 14) and the sign is the whole content of
 * that sentence. `Object.is` guards -0, which `toFixed` would print as `-0.00`
 * and which means nothing on a receipt.
 */
export function amount(rwf: number): string {
  const safe = Object.is(rwf, -0) ? 0 : rwf;
  return safe.toFixed(2);
}

/**
 * Quantity, as the specimen prints it: `1.00`, `0.200`, `5.354`.
 *
 * Two decimals for a whole number of units, three otherwise. That rule
 * reproduces all four quantities the specification prints — `1.00` and `5.00`
 * for counted goods, `0.200` for a weighed cheese, `5.354` for tonnes of gravel
 * — which is the only evidence there is: no clause prescribes a decimal count
 * for a quantity, and 7.5's two places are about amounts.
 *
 * A stay is sold in whole nights and always takes the two-decimal branch. The
 * other branch exists because `EbmReceiptItem.quantity` is deliberately not an
 * integer, and a formatter that rounded 5.354 to `5.35` would print a quantity
 * that does not multiply out to its own line total.
 *
 * The integer test is on the value ROUNDED to three places, so a quantity that
 * arithmetic left at 2.0000000000000004 still prints `2.00` rather than
 * `2.000`.
 */
export function quantity(value: number): string {
  const rounded = Number(value.toFixed(3));
  return Number.isInteger(rounded) ? value.toFixed(2) : rounded.toFixed(3);
}

/** The rate programmed against each label on this receipt, from its tax lines. */
function ratesByLabel(taxLines: readonly EbmTaxLine[]): Map<EbmTaxLabel, number> {
  return new Map(taxLines.map((line) => [line.label, line.ratePercent]));
}

/**
 * The tax designation printed hard against an item's total: `A-EX` or `B`.
 *
 * The specimen's `1000.00A-EX` and `6720.00B` are the whole rule. A zero rate
 * is the exempt band and says so; a rate above zero prints its bare label,
 * because the rate itself is stated once in the totals section and repeating it
 * on every line would be noise on 80mm of paper.
 *
 * A label with no matching tax line prints bare rather than throwing. The
 * server owns the arithmetic and refuses to build a receipt whose labels it
 * cannot price (`taxLinesFor`); if one reaches here anyway, printing the label
 * an auditor can question beats a screen that will not render.
 */
export function itemTaxDesignation(
  item: EbmReceiptItem,
  taxLines: readonly EbmTaxLine[],
): string {
  const rate = ratesByLabel(taxLines).get(item.taxLabel);
  return rate === 0 ? `${item.taxLabel}-EX` : item.taxLabel;
}

/**
 * The label on a `TOTAL <label>` line: `A-EX`, or `B-18.00%`.
 *
 * The rate carries two decimals like every other number on the receipt, which
 * is why the specimen reads `B-18.00%` and not `B-18%`.
 */
export function taxLineLabel(line: EbmTaxLine): string {
  return line.ratePercent === 0
    ? `${line.label}-EX`
    : `${line.label}-${line.ratePercent.toFixed(2)}%`;
}

/**
 * Clause 7.23 — a `TOTAL TAX <label>` line prints only for a rate above zero.
 *
 * The specimen is explicit: it carries `TOTAL A-EX 1000.00` and no
 * `TOTAL TAX A`, because the tax on an exempt band is not zero-that-was-
 * charged, it is a tax that does not apply. Printing `TOTAL TAX A 0.00` would
 * assert the opposite.
 */
export function hasTaxLine(line: EbmTaxLine): boolean {
  return line.ratePercent > 0;
}

/**
 * Clause 7.25 — the receipt counter, `A/B RT`.
 *
 * `A` counts receipts of this type, `B` counts every receipt the machine has
 * issued, and `RT` is the type's own label. All three are the VSDC's, not ours.
 */
export function receiptCounter(sdc: EbmSdcBlock): string {
  return `${sdc.typeCounter}/${sdc.totalCounter}  ${sdc.receiptLabel}`;
}

/**
 * Clause 11 — the designation a non-NORMAL receipt must carry.
 *
 * `null` for `NS` and `NR`, which are normal receipts: `NR` is a real refund of
 * a real sale and is not a copy, a rehearsal or a quote. The other four are,
 * and each has to be "clearly distinguishable from the NORMAL receipt type".
 *
 * The exact words come from the specification's own specimens: `COPY` on page
 * 8, `TRAINING MODE` on page 9 (not `TRAINING`, which is the mode's name in the
 * prose but not what the receipt prints), `PROFORMA` on page 10.
 */
export function clause11Designation(type: EbmReceiptType): string | null {
  switch (type) {
    case "CS":
    case "CR":
      return "COPY";
    case "TS":
      return "TRAINING MODE";
    case "PS":
      return "PROFORMA";
    default:
      return null;
  }
}

/** Clause 11 — the sentence a copy, a training ticket or a proforma must print. */
export const NOT_OFFICIAL = "THIS IS NOT AN OFFICIAL RECEIPT";

/**
 * Clauses 16 and 17 — training and proforma printouts carry no digital
 * signature, so the SDC block prints its date, device and counter and stops.
 *
 * The specimens on pages 9 and 10 show exactly that: no `Internal Data`, no
 * `Receipt Signature`, and no QR code, because there is nothing to encode. A
 * copy (`CS`/`CR`) is the opposite case — page 8 reprints the original's
 * signature verbatim — which is why it is not in this list.
 */
export function carriesSignature(type: EbmReceiptType): boolean {
  return type !== "TS" && type !== "PS";
}

/**
 * Clause 17 — a proforma prints no payment method and no item count.
 *
 * The specimen on page 10 runs `TOTAL TAX` straight into the `PROFORMA` title,
 * where the sale, refund, copy and training specimens all print a payment line
 * and `ITEMS NUMBER` first. That is not an omission in the drawing: a proforma
 * is an advance receipt for money nobody has paid, so a means of payment on it
 * would be a statement about a transaction that has not happened.
 */
export function showsPayment(type: EbmReceiptType): boolean {
  return type !== "PS";
}

/**
 * Whether the SDC block on this receipt came from a real certified device.
 *
 * ABSENT MEANS MOCK. `signerMode` is optional on the contract so that adding it
 * changed no existing shape, and the contract says in as many words that a
 * consumer "reading `mock` — or reading nothing at all, which today means the
 * same thing — must not present the document as a tax receipt". Defaulting the
 * other way would make a forgotten field silently upgrade a decoration into
 * evidence, and that is the one direction this must never fail in.
 */
export function isSignedByRealDevice(receipt: EbmReceipt): boolean {
  return receipt.sdc.signerMode === "live";
}
