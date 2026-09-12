import { ebmGroupInFours, type EbmReceipt } from "@injishi/contracts";

import { QrCode } from "./qr-code";
import {
  amount,
  carriesSignature,
  clause11Designation,
  hasTaxLine,
  isSignedByRealDevice,
  itemTaxDesignation,
  NOT_OFFICIAL,
  quantity,
  receiptCounter,
  showsPayment,
  taxLineLabel,
} from "./receipt-format";
import styles from "./receipt.module.css";

/**
 * The receipt itself: the paper, top to bottom, in the order clause 13.1
 * prescribes.
 *
 * THE LAYOUT IS NOT A DESIGN. It is
 * `injishi.context/doc/rraebm.skill/CISforVSDC_technical_specsnew.pdf`,
 * "Technical Specification of CIS for VSDC, Ver.1.0, March 2018", and the
 * specimens on pages 6 to 10. A receipt that renders the same information in a
 * different order is not a prettier receipt, it is a non-compliant one, so the
 * order below is annotated section by section against the specimen and should
 * be changed only by someone holding the document open.
 *
 * It takes an `EbmReceipt` and nothing else — no fetching, no session, no
 * state. That is what lets the same component print all six receipt types, the
 * five specimens the specification itself publishes, and the one type the API
 * issues today, from one implementation.
 *
 * The eight sections, in order:
 *
 *   1. trade name, address, TIN, and the clause 11 designation if any
 *   2. the commercial message and client id — or, on a refund, the REFUND
 *      title and the approval warning (14.1)
 *   3. the item lines, each `name` then `unitPrice x quantity  total<label>`
 *   4. TOTAL, the per-rate totals, the per-rate taxes, TOTAL TAX
 *   5. the payment method and ITEMS NUMBER
 *   6. SDC INFORMATION: the VSDC's clock, device, counter, data, signature, QR
 *   7. the CIS block: its own receipt number, clock and MRC
 *   8. the closing commercial message
 */

export interface ReceiptDocumentProps {
  receipt: EbmReceipt;
}

export function ReceiptDocument({ receipt }: ReceiptDocumentProps) {
  const { seller, sdc, cis, taxLines } = receipt;

  const designation = clause11Designation(receipt.receiptType);
  const isRefund = receipt.transaction === "REFUND";
  const showsSignature =
    carriesSignature(receipt.receiptType) &&
    sdc.internalData.length > 0 &&
    sdc.receiptSignature.length > 0;
  const genuine = isSignedByRealDevice(receipt);

  /**
   * The watermark carries the clause 11 designation when there is one, because
   * clause 11 REQUIRES it there. On every other receipt it carries the truth
   * about this platform instead, which is the same job — telling a reader at a
   * glance that what they are holding is not the thing it resembles.
   */
  const watermark = designation ?? (genuine ? null : "NOT A FISCAL RECEIPT");

  return (
    <article
      /*
       * Two class names, and the second is not decoration. `styles.sheet` is
       * hashed by the CSS Module and is therefore unnameable from outside it;
       * `injishi-receipt-paper` is a plain global hook so that
       * `receipt-print.css` — which cannot import the module's names — can say
       * "everything except this, and its ancestors, is not printed". It carries
       * no styles of its own.
       */
      className={`${styles.sheet} injishi-receipt-paper`}
      aria-label={`Receipt for booking ${receipt.bookingReference}`}
    >
      {watermark ? (
        <div className={styles.watermark} aria-hidden="true">
          {/*
            An SVG rather than styled text, so the word FILLS the paper whatever
            it says. Clause 11 asks for a watermark, and a watermark that is
            hard to see is not one: at a fixed font size `NOT A FISCAL RECEIPT`
            spans the sheet while `COPY` — four characters — reads as a smudge,
            which is the type that most needs to be unmistakable.

            The viewBox is sized from the string: 0.68em of advance per
            character (0.6 for a monospace glyph plus the 0.08em of tracking
            below), against a 100-unit em. `preserveAspectRatio` then scales the
            whole thing to the box, so every designation is drawn at the same
            physical width.
          */}
          <svg
            className={styles.watermarkText}
            viewBox={`0 0 ${Math.round(watermark.length * 68)} 100`}
            preserveAspectRatio="xMidYMid meet"
            xmlns="http://www.w3.org/2000/svg"
          >
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="100"
              fontWeight="700"
              letterSpacing="8"
            >
              {watermark}
            </text>
          </svg>
        </div>
      ) : null}

      {/* --- 1. The taxpayer (13.1, header) -------------------------------- */}
      <div className={`${styles.band} ${styles.headerBand}`}>
        {/*
          Clause 7.29 — "print official RRA logo on each receipt regardless the
          type". Regardless of type, and so regardless of every condition on
          this page: it is outside every branch on purpose.

          A plain <img>, not next/image: this is a fixed 9KB asset printed at
          one size, so there is nothing for a resizing pipeline to do, and the
          print path must not depend on an optimiser endpoint answering.
          `width` and `height` are the file's own, so the box is reserved before
          the bytes arrive and the header does not jump.
        */}
        <img
          src="/brand/rra.png"
          alt="Rwanda Revenue Authority"
          width={400}
          height={358}
          className={styles.logo}
        />
        <p className={styles.tradeName}>{seller.tradeName}</p>
        {seller.address ? (
          <p className={styles.headerLine}>{seller.address}</p>
        ) : null}
        <p className={styles.headerLine}>TIN: {seller.tin}</p>
        {/*
          Clause 11 — "The designation COPY, TRAINING, PROFORMA has to be placed
          on the invoice below receipt header and above item description
          section". The specimens on pages 8, 9 and 10 put it here, tight under
          the TIN and inside the header band rather than after the rule.
        */}
        {designation ? <p className={styles.designation}>{designation}</p> : null}
      </div>

      {/* --- 2. Commercial message and client, or the refund titles (14.1) -- */}
      {isRefund ? (
        <>
          <div className={`${styles.band} ${styles.centre}`}>
            <p className={styles.designation}>REFUND</p>
            {/*
              Page 7 also prints `REF. NORMAL RECEIPT#: NNNN`, the SDC receipt
              number of the sale being reversed. `EbmReceipt` carries no field
              for it and this leaf does not own the contract, so the line is
              omitted rather than printed empty: a prescribed field with nothing
              in it invites a reader to assume the sale had no reference. The
              API issues no `NR` receipt today, so nothing renders this branch
              yet; adding the field to the contract is what unblocks the line.
            */}
          </div>
          <div className={styles.band}>
            <p className={`${styles.headerLine} ${styles.strong}`}>
              REFUND IS APPROVED ONLY FOR ORIGINAL SALES RECEIPT
            </p>
            {receipt.clientId ? (
              <p className={styles.headerLine}>Client ID: {receipt.clientId}</p>
            ) : null}
          </div>
        </>
      ) : receipt.commercialMessage || receipt.clientId ? (
        <div className={styles.band}>
          {receipt.commercialMessage ? (
            <p className={styles.headerLine}>{receipt.commercialMessage}</p>
          ) : null}
          {/* 13.1 marks the client's identification optional. A stay never
              collects one, so this line is normally absent — and absent is
              correct, where `Client ID:` followed by nothing would not be. */}
          {receipt.clientId ? (
            <p className={styles.headerLine}>Client ID: {receipt.clientId}</p>
          ) : null}
        </div>
      ) : null}

      {/* --- 3. The items (13.1, item description section) ------------------ */}
      <div className={styles.band}>
        {receipt.items.map((item, index) => (
          <div key={`${item.name}-${index}`}>
            <p className={styles.itemName}>{item.name}</p>
            <p className={styles.line}>
              {/* `1000.00x 1.00` — the specimen's own spacing: the multiplier
                  is joined to the unit price and separated from the quantity. */}
              <span>
                {amount(item.unitPriceRwf)}x {quantity(item.quantity)}
              </span>
              <span className={styles.value}>
                {amount(item.totalRwf)}
                {itemTaxDesignation(item, taxLines)}
              </span>
            </p>
            {/* `discount -25%  5040.00`. The pair travels together on the
                contract, so one half can never print without the other. */}
            {item.discountPercent !== null &&
            item.discountedTotalRwf !== null ? (
              <p className={`${styles.line} ${styles.discount}`}>
                <span>discount -{item.discountPercent}%</span>
                <span className={styles.value}>
                  {amount(item.discountedTotalRwf)}
                </span>
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {/* --- 4. The totals (13.1, totals section) --------------------------- */}
      <div className={styles.band}>
        <p className={`${styles.line} ${styles.strong}`}>
          <span>TOTAL</span>
          <span className={styles.value}>{amount(receipt.totalRwf)}</span>
        </p>
        {/* `TOTAL A-EX` and `TOTAL B-18.00%`: the amount sold under each rate,
            tax INCLUDED, which is what the specimen's 5340.00 under B is. */}
        {taxLines.map((line) => (
          <p className={styles.line} key={`taxable-${line.label}`}>
            <span>TOTAL {taxLineLabel(line)}</span>
            <span className={styles.value}>{amount(line.taxableRwf)}</span>
          </p>
        ))}
        {/* `TOTAL TAX B`: the tax contained in that amount. Clause 7.23 keeps
            the exempt band out of this list — see `hasTaxLine`. */}
        {taxLines.filter(hasTaxLine).map((line) => (
          <p className={styles.line} key={`tax-${line.label}`}>
            <span>TOTAL TAX {line.label}</span>
            <span className={styles.value}>{amount(line.taxRwf)}</span>
          </p>
        ))}
        <p className={styles.line}>
          <span>TOTAL TAX</span>
          <span className={styles.value}>{amount(receipt.totalTaxRwf)}</span>
        </p>
      </div>

      {/*
        Clause 11 — "the following text should appear below the amount totals of
        the ticket: THIS IS NOT AN OFFICIAL RECEIPT", at least twice the size of
        the amount text (which `.notOfficial` derives from the amount size
        rather than restating).

        PLACEMENT, because the document contradicts itself and the choice has to
        be recorded. The normative sentence in clause 11 says BELOW the totals;
        the three specimens on pages 8, 9 and 10 print it between the items and
        the totals. The normative text wins here, and the compromise costs
        almost nothing: this sits immediately under the last totals line and
        immediately above the payment line, which is one band away from where
        the specimens draw it.
      */}
      {designation ? (
        <div className={styles.band}>
          <p className={styles.notOfficial}>{NOT_OFFICIAL}</p>
        </div>
      ) : null}

      {/* --- 5. Payment and item count (7.13, 7.27) ------------------------- */}
      {showsPayment(receipt.receiptType) ? (
        <div className={styles.band}>
          <p className={styles.line}>
            <span>{receipt.payment.label}</span>
            <span className={styles.value}>
              {amount(receipt.payment.amountRwf)}
            </span>
          </p>
          {/* Left aligned with the count beside it, as the specimen prints it —
              this is a count, not an amount, and does not belong in the money
              column an auditor reads down. */}
          <p className={styles.headerLine}>ITEMS NUMBER {receipt.itemsNumber}</p>
        </div>
      ) : null}

      {/* Clause 11's designation a second time, between ITEMS NUMBER and the
          SDC block. Pages 8, 9 and 10 all repeat it here. */}
      {designation ? (
        <div className={`${styles.band} ${styles.centre}`}>
          <p className={styles.designation}>{designation}</p>
        </div>
      ) : null}

      {/* --- 6. The VSDC's own block (7.24) --------------------------------- */}
      <div className={styles.band}>
        {/* 7.24.1 — the designation, verbatim. */}
        <p className={styles.blockHeading}>SDC INFORMATION</p>
        {/* 7.24.2 — the VSDC's clock, not ours. */}
        <p className={styles.headerLine}>
          Date: {sdc.date} Time: {sdc.time}
        </p>
        {/* 7.24.3 */}
        <p className={styles.headerLine}>SDC ID: {sdc.sdcId}</p>
        {/* 7.24.4 and 7.25 — `A/B RT`. */}
        <p className={styles.headerLine}>
          RECEIPT NUMBER: {receiptCounter(sdc)}
        </p>

        {showsSignature ? (
          <>
            {/*
              7.24.5 and 7.24.6 — dashes after every fourth character. Grouped
              with `ebmGroupInFours` from `@injishi/contracts`, the same
              function the API used, rather than a second copy of the rule: the
              function is idempotent, so passing an already-grouped value
              through it is a no-op rather than a double dash.
            */}
            <p className={styles.headerLine}>Internal Data:</p>
            <p className={styles.grouped}>{ebmGroupInFours(sdc.internalData)}</p>
            <p className={styles.headerLine}>Receipt Signature:</p>
            <p className={styles.grouped}>
              {ebmGroupInFours(sdc.receiptSignature)}
            </p>
            {/*
              7.24.7 — the QR code. `sdc.qrData` IS the payload; the server
              built it with `ebmQrPayload` and committed to it, so rebuilding it
              here would create a second answer to a question a verifier asks
              once. What is scanned must be what was issued.
            */}
            <div className={styles.qrWrap}>
              <QrCode
                value={sdc.qrData}
                size={148}
                label={`Verification QR code for receipt ${receiptCounter(sdc)}, encoding the VSDC date, time, device identifier, counter, internal data and signature`}
              />
            </div>
          </>
        ) : null}
      </div>

      {/*
        NOT A CLAUSE. The block above is filled by a declared mock signer
        (`server/api/src/modules/ebm/infrastructure/mock-vsdc.signer.ts`),
        whose own source states that the SDC id, internal data, receipt
        signature, counters and MRC are fabricated, that nothing is signed, and
        that what it produces "is NOT a fiscal document, and must never be
        handed to a taxpayer, a guest or a tax officer as one".

        It is printed INSIDE the paper, immediately under the values it is
        about, for the reason a banner outside the document would fail: a
        receipt gets screenshotted, printed and photographed, and every one of
        those keeps the paper and loses the page around it.

        `signerMode === "live"` is the ONLY thing that removes it. A missing
        field reads as a mock, per the contract's own note on that field.
      */}
      {genuine ? null : (
        <div className={styles.band}>
          <div className={styles.mockNotice}>
            <p className={styles.mockHeading}>NOT A FISCAL RECEIPT</p>
            <p className={styles.mockBody}>
              No certified VSDC signed this document. The SDC identifier,
              counters, internal data and signature above are simulated, and the
              Machine Registration Code below is not a registered machine. This
              is a booking record in the RRA layout. It is not a tax invoice, it
              discharges no EBM obligation, and it must not be presented to the
              Rwanda Revenue Authority or accepted as proof of tax paid.
            </p>
          </div>
        </div>
      )}

      {/* --- 7. The CIS's own block (13.1, lower section) ------------------- */}
      <div className={styles.band}>
        {/* Deliberately the same three facts the SDC block carries, from the
            other machine. An auditor compares them; they are not expected to
            be identical, and the specimen's two clocks differ by two minutes. */}
        <p className={styles.headerLine}>RECEIPT NUMBER: {cis.receiptNumber}</p>
        <p className={styles.headerLine}>
          DATE: {cis.date} TIME: {cis.time}
        </p>
        {/* 7.4 — the Machine Registration Code. */}
        <p className={styles.headerLine}>MRC: {cis.mrc}</p>
      </div>

      {/* --- 8. The closing commercial message (13.1, last block) ----------- */}
      <div className={`${styles.band} ${styles.centre}`}>
        {receipt.closingMessage.map((line, index) => (
          <p className={styles.closingLine} key={`${line}-${index}`}>
            {line}
          </p>
        ))}
        {/*
          Ours, not the Authority's, and marked as such by being the only line
          on the paper in ordinary sentence case. Without it nothing on a
          printed receipt says which booking it belongs to: `Client ID` is null
          for a stay and the SDC counters are the machine's, not ours.
        */}
        <p className={styles.footnote}>
          Booking reference {receipt.bookingReference}
        </p>
      </div>
    </article>
  );
}
