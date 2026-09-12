import { InjishiGlyph } from "@/components/icons/marks";
import { TRAINING_COURSE, TRAINING_QUESTION_COUNT } from "@/data/training";
import type { TrainingCertificate } from "@/lib/training-store";
import styles from "./certificate.module.css";

/**
 * The certificate as a document: the thing that gets printed, screenshotted and
 * dropped into a slide.
 *
 * PURE AND PROP-DRIVEN, with no access to the store at all. Two callers need
 * exactly this markup — the screen, and the SVG builder that mirrors it for the
 * downloaded file — and a component that read `localStorage` itself could not
 * be handed a certificate to draw. It is a Server Component by omission: there
 * is no state and no handler here, so the `"use client"` boundary starts at
 * `certificate-screen.tsx` and this subtree is rendered inside it.
 *
 * EVERY FACT ON IT COMES FROM SOMEWHERE. The holder's name is the enrolment,
 * the serial, date and mark are the issued certificate, and the module title,
 * lesson count and question count are read off `data/training.ts` rather than
 * retyped — so the certificate cannot claim a curriculum the course does not
 * teach.
 *
 * The one thing it asserts on its own is the footnote, and that is the point of
 * the footnote: this document is going to leave the page it was issued on, and
 * the page's demonstration notice does not travel with it.
 */

const MODULE = TRAINING_COURSE.modules[0];

export interface CertificateDocumentProps {
  /** The issued certificate: serial, date, mark, and the address it goes to. */
  certificate: TrainingCertificate;
  /** The holder's name, as given at enrolment. */
  holder: string;
}

export function CertificateDocument({
  certificate,
  holder,
}: CertificateDocumentProps) {
  return (
    <article
      /* `injishi-certificate-paper` carries no styles. It is the global handle
         `certificate-print.css` uses to name this element from outside the CSS
         Module, whose class names are hashed at build time and therefore
         unnameable from a plain stylesheet. */
      className={`${styles.paper} injishi-certificate-paper`}
      aria-label={`Certificate of completion for ${holder}, serial ${certificate.serial}`}
    >
      <div className={styles.frame}>
        <header className={styles.crest}>
          <InjishiGlyph className={styles.glyph} aria-hidden focusable="false" />
          <p className={styles.issuer}>Injishi · Rwanda</p>
        </header>

        <div className={styles.award}>
          <p className={styles.title}>Certificate of Completion</p>
          <p className={styles.preamble}>This is to certify that</p>
          {/* The holder's name is the document's own heading. A `<p>` here left
              the certificate with no heading at all, so a screen reader landing
              on it read a paragraph of decoration before reaching the name. */}
          <h2 className={styles.holder}>{holder}</h2>
          <hr className={styles.holderRule} />
          <p className={styles.preamble}>
            has completed every lesson and question set of the module
          </p>
          <p className={styles.module}>{MODULE.title}</p>
          <p className={styles.detail}>
            {TRAINING_COURSE.title} · {MODULE.lessons.length} lessons ·{" "}
            {TRAINING_QUESTION_COUNT} marked questions
          </p>
          <p className={styles.result}>
            Awarded with a mark of {certificate.score}%
          </p>
        </div>

        <div className={styles.registry}>
          <div className={styles.entry}>
            <span className={styles.entryLabel}>Date of issue</span>
            <span className={styles.entryValue}>
              {certificateDate(certificate.issuedAt)}
            </span>
          </div>

          {/* A seal, not a signature. Nobody signed this, and drawing a
              signature on it would be the one lie this document must not tell;
              a seal says "issued by the register", which is what happened. */}
          <div className={styles.seal} aria-hidden>
            <span className={styles.sealTop}>Injishi</span>
            <span className={styles.sealMark}>IST</span>
            <span className={styles.sealFoot}>Training</span>
          </div>

          <div className={`${styles.entry} ${styles.entryRight}`}>
            <span className={styles.entryLabel}>Certificate serial</span>
            <span className={styles.entryValue}>{certificate.serial}</span>
          </div>
        </div>

        <p className={styles.footnote}>
          Demonstration certificate, issued by a prototype of the Injishi
          platform and delivered by e-mail to {certificate.emailedTo}. The
          course is not accredited and this document is not a recognised
          qualification.
        </p>
      </div>
    </article>
  );
}

/**
 * The issue date, written the way a certificate writes one.
 *
 * `en-GB` and a long month, fixed rather than left to the browser, for two
 * reasons: the same demonstration then reads the same way on two laptops in one
 * room, and "8 September 2026" cannot be misread as a different day the way
 * `09/08/2026` can by half its readers.
 *
 * Safe from hydration mismatch because the certificate only ever exists after
 * `readTraining()` has answered in an effect — there is no server render of
 * this component with a real date in it.
 */
export function certificateDate(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "Not recorded";
  return when.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
