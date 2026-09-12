import { ReceiptDocument } from "./receipt-document";
import { SPECIMENS } from "./specimen-receipts";
import styles from "./receipt.module.css";
// Global print reset. Not a module: it has to reach `html` and `body`, which a
// pure-selector module may not. See the file for why.
import "./receipt-print.css";

/**
 * Every receipt type the specification defines, rendered by the real component.
 *
 * This is a VERIFICATION surface, and it earns its place for one reason: the
 * API issues `NS` and nothing else, so five of the six types — and with them
 * the whole of clause 11, the refund titles and the suppressed signature of a
 * training ticket — cannot be seen from a booking. A reviewer with the PDF open
 * can compare all six here against pages 6 to 10, using the specification's own
 * numbers, through the same `ReceiptDocument` a guest's receipt goes through.
 *
 * It renders on the server: nothing here fetches, and the data is a constant.
 */
export function SpecimenGallery() {
  return (
    <div className={styles.screen}>
      <div className={styles.specimenIntro}>
        <h1>RRA receipt specimens</h1>
        <p>
          The worked examples from &ldquo;Technical Specification of CIS for
          VSDC, Ver.1.0, March 2018&rdquo;, pages 6 to 10, rendered by the same
          component that prints a guest&rsquo;s receipt. They exist so the five
          receipt types this platform does not issue can still be checked
          against the specification.
        </p>
        <p>
          <strong>None of these is a receipt.</strong> Every value is a
          placeholder printed in the public standard — &ldquo;Trade Name&rdquo;,
          TIN 000000000, SDC001000001 — and none of them was signed by a
          certified device, which is why each one carries the same warning a
          live receipt carries.
        </p>
      </div>

      {SPECIMENS.map((specimen) => (
        <section className={styles.specimenItem} key={specimen.id}>
          <div className={styles.specimenCaption}>
            <h2>{specimen.caption}</h2>
            <p>{specimen.note}</p>
          </div>
          <ReceiptDocument receipt={specimen.receipt} />
        </section>
      ))}
    </div>
  );
}
