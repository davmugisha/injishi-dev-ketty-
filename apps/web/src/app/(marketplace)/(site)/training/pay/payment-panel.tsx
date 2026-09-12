"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Input } from "@injishi/ui";
import { TRAINING_COURSE, TRAINING_LESSONS } from "@/data/training";
import { formatRwf } from "@/lib/money";
import {
  confirmPayment,
  declarePayment,
  readTraining,
  subscribeTraining,
  type TrainingEnrolment,
  type TrainingPayment,
} from "@/lib/training-store";

/**
 * The half of `/training/pay` that knows who you are: declare the fee, watch it
 * be confirmed, and go on to the lessons.
 *
 * FOUR STATES, NOT A BOOLEAN, and the middle one is the reason this is not a
 * checkbox. `TrainingPayment.state` is `unpaid | declared | confirmed`, and
 * `declared` means the learner says they dialled the code and NOBODY HAS
 * CHECKED. A build with a payment provider reconciles that against MTN; this
 * one has no provider, so the move to `confirmed` is a button a presenter
 * presses, and it is labelled as exactly that rather than hidden behind a
 * timer pretending to be a webhook. A timer would be the dishonest version:
 * it looks like verification and verifies nothing.
 *
 * The fourth state is "nobody has enrolled on this device", which is what a
 * person who typed the URL or bookmarked the payment screen sees. It is a
 * working screen with a way forward, not a broken one — the alternative,
 * redirecting on mount, throws away the back button and makes the demo
 * impossible to show out of order.
 *
 * HYDRATION. `readTraining()` reads `localStorage` and returns the empty state
 * on the server, so it is called in an effect and never during render. Until
 * that effect runs the panel renders `ready: false`, which is the same markup
 * the server sent. `subscribeTraining` is kept here — unlike on the enrol form,
 * which owns a draft somebody may be typing into — because this panel holds no
 * text worth protecting once the fee is declared, and a presenter with the
 * lesson list open in a second tab should see this one follow.
 */

interface Snapshot {
  ready: boolean;
  enrolment: TrainingEnrolment | null;
  payment: TrainingPayment;
}

const NOT_READ: Snapshot = {
  ready: false,
  enrolment: null,
  payment: { state: "unpaid", reference: null, declaredAt: null },
};

/**
 * Why this reference is not usable, or `null`.
 *
 * Loose on purpose, and the comment in `declarePayment` says why: there is
 * nothing to validate it against. MTN's transaction IDs are long digit
 * strings, but a learner who paid from a second line is asked, on the page
 * beside this, to write that number next to the ID — so letters, spaces and
 * `+` all have to be legal. What is refused is a field somebody pressed the
 * button on without reading it.
 */
function referenceError(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "Enter the transaction ID from the MTN message.";
  }
  if (trimmed.length < 6) {
    return "That is shorter than any MTN reference. The ID in the message is a long number, such as 18293746501.";
  }
  return null;
}

export function PaymentPanel() {
  const [snapshot, setSnapshot] = useState<Snapshot>(NOT_READ);
  const [reference, setReference] = useState("");
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    const sync = () => {
      const state = readTraining();
      setSnapshot({
        ready: true,
        enrolment: state.enrolment,
        payment: state.payment,
      });
    };
    sync();
    return subscribeTraining(sync);
  }, []);

  const problem = referenceError(reference);

  const declare = () => {
    setAttempted(true);
    if (problem !== null) {
      document.getElementById("momo-reference")?.focus();
      return;
    }
    declarePayment(reference);
  };

  return (
    <aside className="flex h-fit flex-col gap-6 rounded-card border border-border p-6 lg:p-8">
      <Body
        snapshot={snapshot}
        reference={reference}
        error={attempted ? problem ?? undefined : undefined}
        onReference={setReference}
        onDeclare={declare}
      />
    </aside>
  );
}

function Body({
  snapshot,
  reference,
  error,
  onReference,
  onDeclare,
}: {
  snapshot: Snapshot;
  reference: string;
  error?: string;
  onReference: (next: string) => void;
  onDeclare: () => void;
}) {
  if (!snapshot.ready) {
    return (
      <>
        <PanelHeading title="Tell us you have paid" />
        <p className="text-sm text-page-fg-70" role="status">
          Reading this device…
        </p>
      </>
    );
  }

  if (snapshot.enrolment === null) {
    return (
      <>
        <PanelHeading title="Enrol first" />
        <p className="text-sm text-page-fg-70">
          There is no enrolment on this device, so there is nothing to attach a
          payment to yet. Enrolment takes about a minute and asks for four
          things: your name, e-mail, phone and National ID.
        </p>
        <p className="text-sm text-page-fg-70">
          You can read the code above and pay first if you would rather — just
          keep the MTN message, and enter the reference here once you have
          enrolled.
        </p>
        <div>
          <Button asChild size="lg">
            <Link href="/training/enroll">Enrol in the course</Link>
          </Button>
        </div>
      </>
    );
  }

  const { enrolment, payment } = snapshot;

  if (payment.state === "confirmed") {
    return (
      <>
        <PanelHeading title="Fee received" />
        <p className="text-sm text-page-fg">
          The {formatRwf(TRAINING_COURSE.feeRwf)} fee is settled against{" "}
          <b>{enrolment.fullName}</b>. The course is open — all{" "}
          {TRAINING_LESSONS.length} lessons, for as long as you need them.
        </p>
        <Receipt enrolment={enrolment} payment={payment} />
        <div className="flex flex-col gap-3">
          <Button asChild size="lg">
            <Link href="/training/learn">Start the course</Link>
          </Button>
          <p className="text-sm text-page-fg-70">
            There is no deadline. Stop whenever you like and the course
            remembers where you were.
          </p>
        </div>
      </>
    );
  }

  if (payment.state === "declared") {
    return (
      <>
        <PanelHeading title="We are confirming your payment" />
        <p className="text-sm text-page-fg">
          Thank you — we have your reference and nothing more is needed from
          you. A payment is matched against the MTN record before the course
          opens, which normally takes a few minutes.
        </p>
        <Receipt enrolment={enrolment} payment={payment} />
        <p className="text-sm text-page-fg-70">
          If the reference above is wrong, do not dial the code a second time —
          you have already paid. Send the correct ID to{" "}
          <Link href="/support" className="underline underline-offset-[4px]">
            the support desk
          </Link>{" "}
          and it will be matched by hand.
        </p>
        <DemoControl />
      </>
    );
  }

  return (
    <>
      <PanelHeading title="Tell us you have paid" />
      <p className="text-sm text-page-fg">
        Enrolled as <b>{enrolment.fullName}</b>
        {enrolment.phone ? <>, paying from {enrolment.phone}</> : null}.{" "}
        <Link
          href="/training/enroll"
          className="underline underline-offset-[4px]"
        >
          Change these details
        </Link>
      </p>
      <p className="text-sm text-page-fg-70">
        Dial the code, pay {formatRwf(TRAINING_COURSE.feeRwf)}, then enter the
        transaction ID out of the MTN message here. The lessons open once the
        fee is matched.
      </p>

      <form
        className="flex flex-col gap-3"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onDeclare();
        }}
      >
        <label
          htmlFor="momo-reference"
          className="text-sm font-bold text-page-fg"
        >
          MoMo transaction reference
        </label>
        <Input
          id="momo-reference"
          name="momo-reference"
          type="text"
          inputMode="text"
          autoComplete="off"
          placeholder="18293746501"
          value={reference}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "momo-reference-error" : undefined}
          onChange={(event) => onReference(event.target.value)}
        />
        {error ? (
          <p
            id="momo-reference-error"
            role="alert"
            className="text-sm font-medium text-destructive"
          >
            {error}
          </p>
        ) : null}
        <div className="mt-2">
          <Button type="submit" size="lg">
            I have paid the fee
          </Button>
        </div>
      </form>
    </>
  );
}

function PanelHeading({ title }: { title: string }) {
  return <h2 className="text-xl font-bold text-page-fg">{title}</h2>;
}

/** What was declared, against whom, so the two can be checked against the SMS. */
function Receipt({
  enrolment,
  payment,
}: {
  enrolment: TrainingEnrolment;
  payment: TrainingPayment;
}) {
  return (
    <dl className="m-0 flex flex-col gap-3 rounded-card border border-border bg-secondary p-4">
      <Row label="Learner" value={enrolment.fullName} />
      <Row label="Amount" value={formatRwf(TRAINING_COURSE.feeRwf)} />
      <Row label="Paid from" value={enrolment.phone || "Not recorded"} />
      <Row
        label="Reference"
        value={payment.reference ?? "Not recorded"}
        mono
      />
      {payment.declaredAt ? (
        <Row label="Declared" value={declaredOn(payment.declaredAt)} />
      ) : null}
    </dl>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <dt className="text-2xs uppercase tracking-widest text-page-fg-70">
        {label}
      </dt>
      <dd className="m-0 text-sm text-page-fg">
        {/* A reference is read back digit by digit against an SMS, so it is set
            as code and allowed to break mid-string; a name is not. */}
        {mono ? (
          <code className="break-all tracking-wide">{value}</code>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

/**
 * The presenter's control, labelled as what it is.
 *
 * There is no payment provider in this build, so nothing will ever move the
 * fee from `declared` to `confirmed` on its own, and a demo that stops at
 * "we are confirming" cannot show the lessons. This is the honest version of
 * the missing webhook: a visible button that says out loud it is standing in
 * for a reconciliation, rather than a `setTimeout` that would look like the
 * real thing and check nothing.
 *
 * It is deliberately quiet and outlined rather than a primary action — the
 * learner's action on this screen is already taken, and this one belongs to
 * whoever is driving the demonstration.
 */
function DemoControl() {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-dashed border-border p-4">
      <p className="text-2xs uppercase tracking-widest text-page-fg-70">
        Demonstration control
      </p>
      <p className="text-sm text-page-fg-70">
        This build has no payment provider, so no reconciliation with MTN will
        ever run and no money has moved. Press this to mark the fee received, as
        a matched payment would, and the course opens.
      </p>
      <div>
        <Button type="button" variant="outline" onClick={() => confirmPayment()}>
          Mark the fee as received
        </Button>
      </div>
    </div>
  );
}

/**
 * A stored ISO timestamp as a date and time a person reads.
 *
 * Only reachable after the mount effect has run, so the fixed `en-GB` locale
 * cannot produce a server/client mismatch. It is fixed rather than left to the
 * browser so the same demo reads the same way on two laptops in one room.
 */
function declaredOn(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "Just now";
  return when.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
