"use client";

import { useEffect, useState } from "react";
import {
  ACCOMMODATION_CLASS_LABEL,
  REJECTION_REASON_LABEL,
  type RegistrationSummary,
  stepForRejectionReason,
} from "@injishi/contracts";
import { Alert } from "@heroui/react";
import { Avatar, AvatarFallback, Badge, Button } from "@injishi/web-ui";
import { cn } from "@injishi/utils";
import { Check, X } from "lucide-react";

import { fetchRegistration } from "@/data/registration";
import { setupLink, setupNote } from "@/lib/setup-link";

import { StepCard } from "./register-shell";
import { Notice } from "./wizard-ui";

/**
 * In review (RegisterIA board, Journey stage 2): ONE page from the payment to
 * the approval, for anyone whose business is past payment and not yet open.
 *
 * It used to be a pipeline that opened on "Checking your TIN with RRA", a check
 * the person had already passed on Business, and a sent-back registration was
 * a status line with no way to act on it. Here the officers' steps sit inside
 * one stage the owner reads: registered and paid (the TIN checked when it was
 * entered), the field visit, the approval, then set up. A sent-back registration
 * names its reason, in the officer's own words when they left any, with a Fix
 * button. Setting up the property opens once the business is approved: before
 * that the API refuses every inventory write (D20), so the page says when it
 * opens rather than linking to a setup nobody could use (lib/setup-link.ts).
 *
 * WHAT IT CANNOT SAY, AND DOES NOT INVENT. The board prints the payment method,
 * a receipt number, the verifier's district and the visit's date and time.
 * `RegistrationSummary` carries none of them (only the submission time, the
 * status and a rejection reason), so the page says what is known and no more.
 */

type StageState = "done" | "current" | "todo" | "problem";

interface Stage {
  title: string;
  sub: string;
  state: StageState;
}

const KIGALI: Intl.DateTimeFormatOptions = { timeZone: "Africa/Kigali" };

function onDay(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString("en-GB", { ...KIGALI, day: "numeric", month: "short", year: "numeric" });
}

function stagesFor(summary: RegistrationSummary): Stage[] {
  const s = summary.status;
  const paid = onDay(summary.submittedAt);
  const id = summary.domain === "residence" ? "UPI" : "TIN";
  const pastVisit = s === "field_verified" || s === "approved" || s === "active";
  const approved = s === "approved" || s === "active";
  return [
    {
      title: "Registered and paid",
      sub:
        s === "submitted"
          ? `${paid ? `Paid ${paid}. ` : ""}RRA is confirming the ${id} once more, which usually takes seconds.`
          : `${paid ? `${paid}. ` : ""}${id} checked when you entered it.`,
      state: s === "submitted" ? "current" : "done",
    },
    {
      title: "Field visit",
      sub:
        s === "rejected"
          ? "Sent back. Once you resubmit, it goes straight back to the district verifier."
          : pastVisit
            ? "The district verifier confirmed the visit."
            : "A verifier from your district visits to confirm the place, the address and your documents. Have your licence and ID to hand.",
      state: s === "rejected" ? "problem" : pastVisit ? "done" : s === "tin_verified" ? "current" : "todo",
    },
    {
      title: "Approval",
      sub: approved
        ? s === "approved"
          ? "Approved. It opens once the owner claims it."
          : "Approved."
        : "A second officer approves after the visit.",
      state: approved ? "done" : s === "field_verified" ? "current" : "todo",
    },
    {
      title: "Set up and publish",
      sub:
        s === "active"
          ? "Open now. Publish when the required steps are done."
          : "Opens once you are approved. Guests see nothing until you publish.",
      state: s === "active" ? "current" : "todo",
    },
  ];
}

function chipFor(summary: RegistrationSummary): { label: string; variant: "accent" | "success" | "danger" } {
  switch (summary.status) {
    case "rejected":
      return { label: "Needs one fix", variant: "danger" };
    case "active":
      return { label: "Approved", variant: "success" };
    case "approved":
      return { label: "Approved · waiting for the owner", variant: "success" };
    case "field_verified":
      return { label: "In review · approval", variant: "accent" };
    case "tin_verified":
      return { label: "In review · field visit", variant: "accent" };
    default:
      return { label: "In review · TIN check", variant: "accent" };
  }
}

export function InReview({
  summary,
  onSummary,
  onFix,
  onStartNew,
  signedDownload,
}: {
  summary: RegistrationSummary;
  onSummary: (next: RegistrationSummary) => void;
  onFix: () => void;
  onStartNew: () => void;
  /** The agreement signed in this browser, ready to keep, when there is one. */
  signedDownload: (() => void) | null;
}) {
  const [checking, setChecking] = useState(false);

  // Poll while a machine holds it (the RRA check settles in seconds), and stop
  // once a person does: a district visit takes days, and asking the API every
  // few seconds for days would tell the owner nothing new. Coming back to the
  // tab asks once, which is when a person actually looks.
  useEffect(() => {
    const ask = async () => {
      const res = await fetchRegistration(summary.orgId);
      if (res.status === "ok") onSummary(res.data);
    };
    const onFocus = () => void ask();
    window.addEventListener("focus", onFocus);
    const timer = summary.status === "submitted" ? setInterval(() => void ask(), 5_000) : null;
    return () => {
      window.removeEventListener("focus", onFocus);
      if (timer) clearInterval(timer);
    };
  }, [summary.status, summary.orgId, onSummary]);

  const refresh = async () => {
    setChecking(true);
    const res = await fetchRegistration(summary.orgId);
    setChecking(false);
    if (res.status === "ok") onSummary(res.data);
  };

  const active = summary.status === "active";
  const rejected = summary.status === "rejected";
  const chip = chipFor(summary);
  const kindWord =
    summary.domain === "residence"
      ? "Residence"
      : summary.accommodationClass
        ? (ACCOMMODATION_CLASS_LABEL[summary.accommodationClass as keyof typeof ACCOMMODATION_CLASS_LABEL] ?? null)
        : null;
  const paid = onDay(summary.submittedAt);
  const reason = summary.rejectionReason;
  const setupHref = setupLink(summary, process.env.NEXT_PUBLIC_WEB_URL, process.env.NEXT_PUBLIC_PMS_URL);

  return (
    <>
      <StepCard
        id="register-review"
        chip={
          <Badge variant={chip.variant} size="sm">
            {chip.label}
          </Badge>
        }
        title={
          active || summary.status === "approved"
            ? `${summary.legalName} is approved`
            : rejected
              ? `${summary.legalName} needs one fix`
              : `${summary.legalName} is registered`
        }
        lead={
          active
            ? "Set up your property and publish when you are ready."
            : `${kindWord ? `${kindWord} · ` : ""}${paid ? `Registration fee paid ${paid}. ` : "Registration fee paid. "}We email you at each step, so there is nothing to refresh.`
        }
      >
        {rejected ? (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>
                Sent back: {reason ? REJECTION_REASON_LABEL[reason] : "the reviewing officer recorded no reason."}
              </Alert.Title>
              <Alert.Description>
                {summary.rejectionNotes ? <>&ldquo;{summary.rejectionNotes}&rdquo; </> : null}
                Fix that one thing and resubmit. There is no new fee.
              </Alert.Description>
            </Alert.Content>
            <Button variant="danger" size="sm" onClick={onFix} className="shrink-0 self-center">
              Fix it
            </Button>
          </Alert>
        ) : null}

        {summary.status === "approved" ? (
          <Notice tone="info">
            You registered this business for its owner, so it opens once they accept the
            invitation we sent them. Nothing more is needed from you.
          </Notice>
        ) : null}

        <ol className="flex flex-col">
          {stagesFor(summary).map((stage, i) => (
            <li key={stage.title} className="flex gap-3.5 border-t border-border py-3.5 first:border-t-0">
              <Avatar className="size-8">
                <AvatarFallback
                  className={cn(
                    "text-xs font-semibold",
                    stage.state === "problem"
                      ? "bg-destructive/15 text-destructive"
                      : stage.state === "todo"
                        ? "bg-secondary text-muted-foreground"
                        : "bg-accent-brand/15 text-accent-text",
                  )}
                >
                  {stage.state === "done" ? (
                    <Check size={16} aria-label="Done" />
                  ) : stage.state === "problem" ? (
                    <X size={16} aria-label="Sent back" />
                  ) : (
                    <span aria-hidden>{i + 1}</span>
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold">
                  {stage.title}
                  {stage.state === "current" ? <span className="sr-only"> (now)</span> : null}
                </span>
                <span className="text-sm tabular-nums text-muted-foreground">{stage.sub}</span>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {summary.status === "submitted" ? null : (
            <Button variant="link" size="sm" pending={checking} onClick={() => void refresh()}>
              {checking ? "Checking…" : "Check for an update"}
            </Button>
          )}
          {signedDownload ? (
            <Button variant="link" size="sm" onClick={signedDownload}>
              Download the signed agreement
            </Button>
          ) : null}
          <Button variant="link" size="sm" onClick={onStartNew}>
            Register another business
          </Button>
        </div>
      </StepCard>

      {rejected ? null : (
        <section
          aria-labelledby="register-prepare"
          className="flex flex-wrap items-center gap-5 rounded-card border border-border bg-secondary p-5 sm:p-6"
        >
          <div className="flex min-w-0 flex-1 basis-72 flex-col gap-1.5">
            <h2 id="register-prepare" className="text-lg font-semibold">
              Set up your property
            </h2>
            <p className="text-sm text-muted-foreground">{setupNote(summary.status)}</p>
          </div>
          {setupHref ? (
            <Button asChild>
              <a href={setupHref}>Set up your property</a>
            </Button>
          ) : null}
        </section>
      )}
    </>
  );
}

/**
 * Business, in fix mode: what was sent back, and the one way on that exists.
 *
 * The board's fix mode reopens Business on the field that was wrong, takes a
 * clearer photo, and resubmits. The API has no route that changes a submitted
 * registration's details or attaches a document to it; `resubmit` only sends it
 * back for review. So this says plainly what can be done online (resubmit, with
 * no new fee) and where the fix itself goes (to the verifier), rather than
 * offering fields whose answers would be thrown away.
 */
export function FixBusiness({
  summary,
  busy,
  error,
  onResubmit,
  onBack,
}: {
  summary: RegistrationSummary;
  busy: boolean;
  error: string;
  onResubmit: () => void;
  onBack: () => void;
}) {
  const reason = summary.rejectionReason;
  const where = reason ? stepForRejectionReason(reason) : "none";
  const fixHint = {
    identity: "It is about who owns the business: have the owner's ID, or your authority to act for them, ready for the verifier.",
    business: "It is about the business's own details: have your RRA certificate ready, so the verifier can match the TIN and the name.",
    documents: "It is about a document: have a clear, current copy of it ready for the verifier.",
    none: "Read the officer's note, put it right, and the verifier checks it again.",
  }[where];

  return (
    <StepCard
      id="register-fix"
      title="Your business"
      lead={`${summary.legalName}, sent back for one fix.`}
      footer={
        <>
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onResubmit} pending={busy}>
            {busy ? "Sending…" : "Resubmit for review, no new fee"}
          </Button>
        </>
      }
    >
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{reason ? REJECTION_REASON_LABEL[reason] : "The officer recorded no reason."}</Alert.Title>
          <Alert.Description>
            {summary.rejectionNotes ? <>&ldquo;{summary.rejectionNotes}&rdquo; </> : null}
            {fixHint}
          </Alert.Description>
        </Alert.Content>
      </Alert>
      <Notice tone="info">
        The details you registered cannot be changed online yet, and a document cannot be added to
        a registration once it is sent. Resubmitting sends it straight back to the district
        verifier, who checks the fix with you. You are not charged again.
      </Notice>
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </StepCard>
  );
}
