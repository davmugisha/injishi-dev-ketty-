"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Download, Printer, X } from "lucide-react";
import { Button, Skeleton } from "@injishi/ui";
import {
  TRAINING_COURSE,
  TRAINING_LESSONS,
  TRAINING_PASS_MARK,
} from "@/data/training";
import { formatRwf } from "@/lib/money";
import {
  certificateBlock,
  EMPTY_TRAINING,
  issueCertificate,
  readTraining,
  subscribeTraining,
  trainingProgress,
  type TrainingCertificateBlock,
  type TrainingState,
} from "@/lib/training-store";
import { CertificateDocument, certificateDate } from "./certificate-document";
import {
  certificateFileName,
  certificateSvg,
  type CertificateInk,
} from "./certificate-file";
import styles from "./certificate.module.css";
// Global print reset. Not a module: it has to reach `html` and `body`, which a
// pure-selector module may not. See the file for why.
import "./certificate-print.css";

/**
 * `/training/certificate` — the end of the flow.
 *
 * THE CERTIFICATE ISSUES ITSELF ON ARRIVAL. There is no "issue my certificate"
 * button, because pressing one would be the second time the learner asked: they
 * enrolled, they paid, they finished seven lessons and they passed the
 * questions, and a demo that then stalls on one more click is a demo that
 * stalls in front of a room. `issueCertificate()` is idempotent and derives the
 * serial rather than randomising it, so arriving here twice shows the same
 * document with the same number — which is the whole reason that function was
 * written the way it was.
 *
 * IT REFUSES IN FIVE DIFFERENT WAYS AND SAYS WHICH. `issueCertificate()`
 * answers the state unchanged when it will not issue and cannot say why;
 * `certificateBlock()` beside it asks the same questions in the same order and
 * names the first one that fails. Collapsing those five into "you are not
 * eligible" is what turns a thirty-second fix — press the button on the payment
 * screen — into a support ticket.
 *
 * NO E-MAIL IS SENT. Nothing in this build can send one: there is no API, no
 * mail transport and no queue. So the page says the certificate IS issued, and
 * that it WOULD be e-mailed to the enrolment address, and it carries the same
 * demonstration notice the other three training screens carry. "We have sent
 * your certificate" would be the one sentence on this route that a room could
 * not check and that is not true.
 *
 * HYDRATION. `readTraining()` reads `localStorage` and answers the empty state
 * on the server, so it is called in an effect and never during render. Until
 * that effect runs the screen renders its skeleton, which is the markup the
 * server sent. `subscribeTraining` keeps it following a second tab — a
 * presenter with the payment screen open beside this one sees the refusal here
 * turn into a certificate the moment the fee is marked received.
 */

interface Snapshot {
  ready: boolean;
  state: TrainingState;
}

const NOT_READ: Snapshot = { ready: false, state: EMPTY_TRAINING };

export function CertificateScreen() {
  const [snapshot, setSnapshot] = useState<Snapshot>(NOT_READ);

  useEffect(() => {
    const sync = () => {
      const current = readTraining();
      const state =
        current.certificate === null && certificateBlock(current) === null
          ? issueCertificate()
          : current;
      setSnapshot({ ready: true, state });
    };
    sync();
    return subscribeTraining(sync);
  }, []);

  const print = useCallback(() => {
    window.print();
  }, []);

  const download = useCallback(() => {
    const { certificate, enrolment } = readTraining();
    if (certificate === null || enrolment === null) return;

    const svg = certificateSvg({
      certificate,
      holder: enrolment.fullName,
      issuedOn: certificateDate(certificate.issuedAt),
      ink: readInk(),
    });

    const url = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = certificateFileName(certificate);
    // Appended rather than clicked detached: Firefox ignores a click on an
    // anchor that is not in the document, and the download silently does not
    // happen.
    document.body.append(link);
    link.click();
    link.remove();
    // Released on the next frame rather than immediately: revoking the URL in
    // the same task as the click races the browser's own fetch of it, and the
    // file arrives empty often enough to ruin a demonstration.
    requestAnimationFrame(() => URL.revokeObjectURL(url));
  }, []);

  if (!snapshot.ready) return <LoadingCertificate />;

  const { state } = snapshot;
  const block = state.certificate === null ? certificateBlock(state) : null;

  if (state.certificate === null || state.enrolment === null) {
    return <Refusal block={block ?? "not-enrolled"} state={state} />;
  }

  return (
    <div className={styles.screen}>
      <CertificateDocument
        certificate={state.certificate}
        holder={state.enrolment.fullName}
      />

      <div className="flex flex-col gap-6 rounded-card border border-border bg-secondary p-6 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
        <div className="flex max-w-read flex-col gap-2">
          <h2 className="text-xl font-bold text-page-fg">
            Issued to {state.enrolment.fullName}
          </h2>
          {/* THE DELIVERY LINE. Present tense for what has happened — the
              certificate is issued, it carries a serial — and the conditional
              for what has not: it WOULD be e-mailed. The notice below says why
              in as many words. */}
          <p className="text-sm text-page-fg">
            Serial{" "}
            <code className="font-bold tracking-wide text-page-fg">
              {state.certificate.serial}
            </code>
            , issued on {certificateDate(state.certificate.issuedAt)} at{" "}
            {state.certificate.score}%. Delivery is by e-mail: this certificate
            would be sent to{" "}
            <b className="text-page-fg">{state.certificate.emailedTo}</b>, the
            address you gave when you enrolled.
          </p>
          <p className="text-sm text-page-fg-70">
            Keep a copy of your own as well. Printing it gives you a PDF on any
            device with a print dialog; the download is a single scalable file
            you can attach to an e-mail or drop into a slide.
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
          <Button type="button" size="lg" onClick={print}>
            <Printer aria-hidden className="size-4" />
            Print or save as PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={download}
          >
            <Download aria-hidden className="size-4" />
            Download the certificate
          </Button>
        </div>
      </div>

      <DemoNotice email={state.certificate.emailedTo} />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-page-fg-70">
        <Link href="/training/learn" className="underline underline-offset-[4px]">
          Back to the module
        </Link>
        <Link href="/support" className="underline underline-offset-[4px]">
          Ask the support desk about your certificate
        </Link>
      </div>
    </div>
  );
}

/**
 * The screen before the first read after mount.
 *
 * A skeleton in the shape of the document rather than a spinner: this route is
 * reached by somebody who has just been told they passed, and a blank page for
 * one frame reads as "there is nothing here" — which is what the refusal states
 * below look like, and is exactly the wrong first impression.
 */
function LoadingCertificate() {
  return (
    <div className={styles.screen} role="status" aria-live="polite">
      <span className="sr-only">Reading your course record on this device…</span>
      <Skeleton className="aspect-[297/210] w-full rounded-card" />
      <Skeleton className="h-28 w-full rounded-card" />
    </div>
  );
}

/* ------------------------------------------------------------------ refusals */

interface RefusalCopy {
  heading: string;
  body: string;
  action: { label: string; href: string };
}

/**
 * What to say, and where to send the reader, for each of the five refusals.
 *
 * Every one of them names the step that clears it and links to it. A refusal
 * that says only "not yet" leaves a person on a dead page, and this is the one
 * screen in the course where a person has arrived expecting a reward.
 *
 * The wording deliberately echoes `CourseAccessNotice` on `/training/learn`:
 * that banner has been telling this learner about the same outstanding fee for
 * seven lessons, and meeting a different sentence for the same fact here would
 * read as a different problem.
 */
function refusalCopy(
  block: TrainingCertificateBlock,
  state: TrainingState,
): RefusalCopy {
  const progress = trainingProgress(state);
  const nextUp =
    TRAINING_LESSONS.find((lesson) => !state.completed.includes(lesson.slug)) ??
    TRAINING_LESSONS[0];

  switch (block) {
    case "not-enrolled":
      return {
        heading: "There is no enrolment on this device",
        body: "A certificate is issued in a name and delivered to an e-mail address, and we hold neither. Enrolling takes about a minute — your name, e-mail, phone and National ID — and the address you give is where the certificate goes.",
        action: { label: "Enrol for the course", href: "/training/enroll" },
      };
    case "fee-unpaid":
      return {
        heading: `The ${formatRwf(TRAINING_COURSE.feeRwf)} course fee is still outstanding`,
        body: `The lessons and the question sets are open and your marks are kept, but the certificate is what the fee buys. Dial ${TRAINING_COURSE.momoCode} on the MTN line you enrolled with, tell us the reference, and the certificate is issued as soon as the payment is settled.`,
        action: { label: "Pay the course fee", href: "/training/pay" },
      };
    case "fee-unreconciled":
      return {
        heading: "Your MoMo payment has not been reconciled yet",
        body: `You have told us you paid${
          state.payment.reference
            ? ` with reference ${state.payment.reference}`
            : ""
        }, and nothing more is needed from you. A payment is matched against the MTN record before a certificate is issued, and that match has not happened yet.`,
        action: { label: "Check the payment", href: "/training/pay" },
      };
    case "lessons-outstanding":
      return {
        heading: `${progress.completed} of ${progress.total} lessons finished`,
        body: "A certificate says every lesson and every question set of the module is done, so it is issued when that is true. Your marks are kept in this browser, so picking up where you left off costs you nothing.",
        action: {
          label: `Continue: ${nextUp.title}`,
          href: `/training/learn/${nextUp.slug}`,
        },
      };
    case "mark-below-pass":
      return {
        heading: `Your mark is ${progress.mark}%, and the pass mark is ${TRAINING_PASS_MARK}%`,
        body: `Every lesson is complete, so the only thing between you and the certificate is the mark. The BEST mark you have ever scored on a lesson is the one that counts, so taking a question set again can only move you up — and every answer is explained, including the ones you got right.`,
        action: { label: "Retake a question set", href: "/training/learn" },
      };
  }
}

/**
 * The screen for somebody who has not earned the certificate yet.
 *
 * It shows the four requirements as a list with the reader's own standing
 * against each, and not only the one that is missing. The refusal at the top
 * answers "what do I do now"; the list answers "how much is left", which is the
 * question a person actually has when they are told no — and it is the honest
 * version of a progress bar, because it names conditions the course has to be
 * able to check rather than a percentage.
 */
function Refusal({
  block,
  state,
}: {
  block: TrainingCertificateBlock;
  state: TrainingState;
}) {
  const copy = refusalCopy(block, state);
  const progress = trainingProgress(state);

  const requirements: { label: string; met: boolean; detail: string }[] = [
    {
      label: "Enrolled in the course",
      met: state.enrolment !== null,
      detail:
        state.enrolment === null
          ? "No enrolment on this device"
          : `${state.enrolment.fullName} · ${state.enrolment.email}`,
    },
    {
      label: `${formatRwf(TRAINING_COURSE.feeRwf)} fee settled`,
      met: state.payment.state === "confirmed",
      detail:
        state.payment.state === "confirmed"
          ? "Received"
          : state.payment.state === "declared"
            ? "Declared, waiting to be matched against MTN"
            : "Not paid",
    },
    {
      label: "Every lesson complete",
      met: progress.allLessonsDone,
      detail: `${progress.completed} of ${progress.total} lessons`,
    },
    {
      label: `Mark of ${TRAINING_PASS_MARK}% or better`,
      met: progress.mark >= TRAINING_PASS_MARK,
      detail:
        Object.keys(state.scores).length === 0
          ? "No question set marked yet"
          : `${progress.mark}% across the question sets you have taken`,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col items-start gap-4 rounded-card border border-warning bg-warning/10 p-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-bold text-page-fg">{copy.heading}</h2>
          <p className="max-w-read text-sm text-page-fg-70">{copy.body}</p>
        </div>
        <Button asChild size="lg">
          <Link href={copy.action.href}>{copy.action.label}</Link>
        </Button>
      </div>

      <section
        aria-label="What the certificate needs"
        className="flex flex-col gap-4 rounded-card border border-border p-6"
      >
        <h3 className="text-lg font-bold text-page-fg">
          A certificate is issued when all four of these are true
        </h3>
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {requirements.map((requirement) => (
            <li key={requirement.label} className="flex items-start gap-3">
              <span
                aria-hidden
                className={
                  requirement.met
                    ? "flex size-6 shrink-0 items-center justify-center rounded-full border border-success-text text-success-text"
                    : "flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-page-fg-70"
                }
              >
                {requirement.met ? (
                  <Check className="size-3.5" />
                ) : (
                  <X className="size-3.5" />
                )}
              </span>
              <span className="flex flex-col gap-0.5">
                <b className="text-page-fg">
                  {requirement.label}
                  <span className="sr-only">
                    {requirement.met ? " — done" : " — not yet"}
                  </span>
                </b>
                <span className="text-sm text-page-fg-70">
                  {requirement.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <DemoNotice email={state.enrolment?.email ?? null} />
    </div>
  );
}

/**
 * The demonstration notice, in the words `/training`, `/training/enroll` and
 * `/training/pay` already use.
 *
 * It opens with the same bolded sentence and sits in the same bordered block,
 * because a presenter walking four screens in a row should hear one voice
 * saying one thing, not four paraphrases that invite the room to wonder which
 * of them is the real disclaimer.
 *
 * What this screen adds to the shared sentence is the e-mail. It is the only
 * screen in the course that claims a delivery, and an unqualified "sent to your
 * inbox" is the exact failure the handbook names.
 */
function DemoNotice({ email }: { email: string | null }) {
  return (
    <p className="max-w-read rounded-card border border-border p-4 text-sm text-page-fg-70">
      <b className="text-page-fg">This is a demonstration build.</b> No e-mail
      is sent and no message leaves this device: there is no mail server behind
      this page, so the certificate is issued here, in this browser, and
      {email ? <> would be e-mailed to {email}</> : <> would be e-mailed to the address given at enrolment</>}{" "}
      in a live build. No fee was collected either — the MoMo code on{" "}
      <Link href="/training/pay" className="underline underline-offset-[4px]">
        the payment screen
      </Link>{" "}
      is a placeholder merchant code, and the enrolment, marks and certificate
      are held in this browser only.
    </p>
  );
}

/* ------------------------------------------------------------------ the file */

/**
 * The document's four colours, resolved to plain sRGB for the downloaded file.
 *
 * A standalone SVG cannot resolve `var(--ink)`: it has left the document that
 * defines it. So the values are READ OFF THE LIVE PAPER — the same custom
 * properties `certificate.module.css` declares on it — and converted to `rgb()`
 * through a 1×1 canvas, which is the browser's own colour parser and therefore
 * understands whatever colour syntax the token package is using this month.
 *
 * The alternative was four hex literals in `certificate-file.ts`. That is a
 * fifth definition of the brand's ink that regenerating the palette cannot
 * move and no contrast measurement covers, which is precisely what
 * `injishi/no-raw-color-classes` exists to refuse.
 */
function readInk(): CertificateInk {
  // The same global handle `certificate-print.css` uses to name the document
  // from outside the CSS Module, and for the same reason: the module's class
  // names are hashed at build time, so neither a stylesheet nor a query can
  // spell one.
  const paper = document.querySelector<HTMLElement>(".injishi-certificate-paper");
  const style = paper === null ? null : window.getComputedStyle(paper);
  const read = (name: string) =>
    toRgb(style === null ? "" : style.getPropertyValue(name).trim());

  return {
    paper: read("--certificate-paper"),
    ink: read("--certificate-ink"),
    rule: read("--certificate-rule"),
    seal: read("--certificate-seal"),
  };
}

/**
 * One colour, in whatever syntax the tokens use, as `rgb(r, g, b)`.
 *
 * Returns the input untouched when the browser cannot paint it, rather than a
 * fallback colour: a fallback would be a literal, and an SVG carrying the
 * original `oklch()` still renders correctly in every browser that produced it.
 * The sentinel is what detects that case — assigning an unparseable value to
 * `fillStyle` leaves the previous one in place rather than throwing, so a naive
 * version of this function silently returns black for every colour.
 */
function toRgb(value: string): string {
  if (value === "") return value;
  try {
    const context = document.createElement("canvas").getContext("2d");
    if (context === null) return value;

    context.fillStyle = "rgb(1, 2, 3)";
    const sentinel = context.fillStyle;
    context.fillStyle = value;
    if (context.fillStyle === sentinel) return value;

    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    return value;
  }
}
