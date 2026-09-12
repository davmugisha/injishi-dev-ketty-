"use client";

import Link from "next/link";
import { Button } from "@injishi/ui";
import { TRAINING_COURSE } from "@/data/training";
import { formatRwf } from "@/lib/money";
import { useTrainingState } from "./use-training-state";

/**
 * What a learner who has not enrolled, or not settled the fee, is told at the
 * top of the course.
 *
 * THE DECISION THIS FILE ENCODES: the lessons are NOT locked. Three reasons,
 * and the first is the one that decides it.
 *
 *   1. The gate would be a lie. Enrolment and payment live in `localStorage`
 *      and nothing on the API knows about either, so a "locked" lesson is one
 *      console line away from open. Drawing a padlock over a door that is not
 *      shut teaches the room that the demo has an access control it does not
 *      have, which is the specific thing the handbook forbids.
 *   2. A presenter has to be able to open a lesson. Half the point of the
 *      course screens is showing the teaching content, and a demo that makes
 *      the audience watch a payment flow first before any of it can be read is
 *      a demo that runs out of time before the lessons.
 *   3. The real gate is downstream and already exists. `issueCertificate()`
 *      refuses without an enrolment and a confirmed fee, so the thing the fee
 *      actually buys — a certificate in your name — is genuinely withheld.
 *
 * So the refusal is moved from the lesson to the certificate, and this banner
 * is what makes that honest rather than silent: it names which of the two is
 * outstanding, in the same words the certificate screen will use, and links to
 * the step that clears it. Reading on is allowed and says so.
 *
 * Renders nothing once the fee is confirmed, and nothing before the first read
 * after mount — a banner that appears and then vanishes on every load is worse
 * than one that arrives a frame late.
 */
export function CourseAccessNotice() {
  const { state, ready } = useTrainingState();

  if (!ready) return null;
  if (state.enrolment !== null && state.payment.state === "confirmed") {
    return null;
  }

  const notice =
    state.enrolment === null
      ? {
          heading: "You are reading the course without an enrolment.",
          body: "Every lesson is open and your marks are kept in this browser, so nothing you do now is wasted. A certificate is issued in a name, though, and we do not have yours yet.",
          action: { label: "Enrol for the course", href: "/training/enroll" },
        }
      : state.payment.state === "declared"
        ? {
            heading: "Your MoMo payment has not been reconciled yet.",
            body: `You told us you paid ${formatRwf(TRAINING_COURSE.feeRwf)}${
              state.payment.reference
                ? ` with reference ${state.payment.reference}`
                : ""
            }. Nobody has matched that against MTN yet, and the certificate waits for that match. Carry on with the lessons in the meantime.`,
            action: { label: "Check the payment", href: "/training/pay" },
          }
        : {
            heading: `The ${formatRwf(TRAINING_COURSE.feeRwf)} course fee is still outstanding.`,
            body: `Read as much as you like — the lessons and the questions are open and your marks are kept. The certificate is what the fee buys, so it is issued once the payment on ${TRAINING_COURSE.momoCode} is settled.`,
            action: { label: "Pay the course fee", href: "/training/pay" },
          };

  return (
    /* Stacked at every width rather than a row above `sm`. The notice appears
       in two columns of very different widths — the 1120px module rail and the
       672px reading measure on a lesson — and a viewport breakpoint cannot tell
       them apart, so the row treatment that reads well on the rail squeezed the
       lesson copy into three ragged lines beside the button. */
    <div className="flex flex-col items-start gap-3 rounded-card border border-warning bg-warning/10 p-5">
      <div className="flex flex-col gap-1">
        <b className="text-page-fg">{notice.heading}</b>
        <p className="max-w-read text-sm text-page-fg-70">{notice.body}</p>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link href={notice.action.href}>{notice.action.label}</Link>
      </Button>
    </div>
  );
}
