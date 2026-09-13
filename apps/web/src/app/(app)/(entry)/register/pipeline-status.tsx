"use client";

import {
  REJECTION_REASON_LABEL,
  type OrgRegistrationStatus,
  type RegistrationSummary,
  stepForRejectionReason,
} from "@injishi/contracts";
import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { Button as UiButton } from "@injishi/ui";

import { fetchRegistration, resubmitRegistration } from "@/data/registration";
import { apiResultMessage } from "@/lib/api";

import { Notice, formatRwf } from "./wizard-ui";

/**
 * What the pending workspace renders while government reviews the business
 * (F-S03 §6).
 *
 * The point of this screen is that a multi-day approval must not feel like
 * silence. Every stage says who holds it and what happens next, so "waiting on
 * us" and "waiting on you" are never confusable — which is the difference
 * between a legible pipeline and a spinner.
 */

interface Stage {
  key: OrgRegistrationStatus;
  title: string;
  waiting: string;
  done: string;
}

/**
 * The pipeline as the registrant experiences it.
 *
 * `pending_payment` is deliberately absent: by the time this screen renders the
 * fee has settled, and showing a paid step as the first thing would suggest
 * money is still owed.
 */
const STAGES: Stage[] = [
  {
    key: "submitted",
    title: "Checking your TIN with RRA",
    waiting: "This is automatic and usually takes seconds.",
    done: "RRA confirmed your tax record.",
  },
  {
    key: "tin_verified",
    title: "District field verification",
    waiting:
      "An officer from your district will visit to confirm the business and its documents.",
    done: "An officer confirmed the business exists.",
  },
  {
    key: "field_verified",
    title: "Approval",
    waiting: "A business approver reviews the verifier's report.",
    done: "Approved.",
  },
  {
    key: "active",
    title: "Live on Injishi",
    waiting: "",
    done: "You can now list your inventory and take bookings.",
  },
];

const ORDER: OrgRegistrationStatus[] = [
  "submitted",
  "tin_verified",
  "field_verified",
  "approved",
  "active",
];

export function PipelineStatus({
  summary,
  onSummary,
}: {
  summary: RegistrationSummary;
  onSummary: (next: RegistrationSummary) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Poll while a machine holds it, and stop once a human does. The RRA check
  // resolves in seconds; a district visit takes days, and hammering the API for
  // days would tell the registrant nothing it has not already said.
  useEffect(() => {
    if (summary.status !== "submitted") return;
    const timer = setInterval(() => {
      void (async () => {
        const res = await fetchRegistration(summary.orgId);
        if (res.status === "ok") onSummary(res.data);
      })();
    }, 5_000);
    return () => clearInterval(timer);
  }, [summary.status, summary.orgId, onSummary]);

  const refresh = async () => {
    setBusy(true);
    setError("");
    const res = await fetchRegistration(summary.orgId);
    setBusy(false);
    if (res.status === "ok") onSummary(res.data);
    else setError(apiResultMessage(res));
  };

  const resubmit = async () => {
    setBusy(true);
    setError("");
    const res = await resubmitRegistration(summary.orgId);
    setBusy(false);
    if (res.status === "ok") onSummary(res.data);
    else setError(apiResultMessage(res));
  };

  if (summary.status === "rejected") {
    return (
      <RejectedPanel
        summary={summary}
        busy={busy}
        error={error}
        onResubmit={() => void resubmit()}
      />
    );
  }

  const reached = ORDER.indexOf(summary.status);

  return (
    <section aria-labelledby="pipeline">
      <h2 id="pipeline" className="text-xl font-semibold tracking-tight">
        {summary.legalName}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {summary.status === "active"
          ? "Your business is live."
          : "Registered and paid. Here is where it has got to."}
      </p>

      {summary.status === "approved" ? (
        <div className="mt-6">
          <Notice tone="info">
            <b>Approved, and waiting for the owner to claim it.</b> You registered
            this business on someone else&apos;s behalf, so it stays payout locked
            until they accept the invitation. Nothing more is needed from you.
          </Notice>
        </div>
      ) : null}

      <ol className="mt-6 space-y-3">
        {STAGES.map((stage) => {
          const at = ORDER.indexOf(stage.key);
          const state = at < reached ? "done" : at === reached ? "current" : "todo";
          return (
            <li
              key={stage.key}
              className={[
                "rounded-card border p-4",
                state === "current"
                  ? "border-accent-brand bg-accent-brand/10"
                  : "border-border",
              ].join(" ")}
            >
              <div className="flex items-center gap-2">
                <StageDot state={state} />
                <span
                  className={
                    state === "todo"
                      ? "text-sm font-semibold text-muted-foreground"
                      : "text-sm font-semibold"
                  }
                >
                  {stage.title}
                </span>
              </div>
              <p className="mt-1 pl-7 text-xs text-muted-foreground">
                {state === "done" || (state === "current" && stage.key === "active")
                  ? stage.done
                  : stage.waiting}
              </p>
            </li>
          );
        })}
      </ol>

      {error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex items-center gap-3">
        <Button variant="outline" onPress={() => void refresh()} isDisabled={busy} isPending={busy}>
          {busy ? "Checking…" : "Check for an update"}
        </Button>
        {summary.status === "active" ? (
          <UiButton asChild variant="primary">
            {/* Straight into setting the property up (2026-09-13); the
                approval mail links the same checklist. */}
            <a href={`/w/${summary.workspaceId}/setup`}>Set up your property</a>
          </UiButton>
        ) : null}
      </div>
    </section>
  );
}

function StageDot({ state }: { state: "done" | "current" | "todo" }) {
  const cls = {
    done: "bg-success",
    current: "bg-accent-brand",
    todo: "bg-muted",
  }[state];
  return (
    <span
      aria-hidden="true"
      className={`h-5 w-5 shrink-0 rounded-full ${cls}`}
    />
  );
}

/** A refusal the registrant can actually act on: a code, a note, a way back. */
function RejectedPanel({
  summary,
  busy,
  error,
  onResubmit,
}: {
  summary: RegistrationSummary;
  busy: boolean;
  error: string;
  onResubmit: () => void;
}) {
  const reason = summary.rejectionReason;
  const step = reason ? stepForRejectionReason(reason) : "none";
  const whereToFix = {
    identity: "Check your own details, then resubmit.",
    business: "Check your business details, then resubmit.",
    documents: "Get your certificates in order, then resubmit.",
    none: "Read the officer's note, put it right, then resubmit.",
  }[step];

  return (
    <section aria-labelledby="rejected">
      <h2 id="rejected" className="text-xl font-semibold tracking-tight">
        {summary.legalName}
      </h2>
      <div className="mt-6 space-y-4">
        <Notice tone="warning">
          <b>This registration was sent back.</b>
          <p className="mt-1">
            {reason ? REJECTION_REASON_LABEL[reason] : "No reason was recorded."}
          </p>
          {summary.rejectionNotes ? (
            <p className="mt-2 border-l-2 border-border pl-3 italic">
              {summary.rejectionNotes}
            </p>
          ) : null}
          <p className="mt-2">{whereToFix}</p>
        </Notice>

        <Notice tone="info">
          You will <b>not</b> be charged again. The registration fee is paid once
          and covers this review.
        </Notice>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Button variant="primary" onPress={onResubmit} isDisabled={busy} isPending={busy}>
          {busy ? "Sending…" : "Resubmit for review"}
        </Button>
      </div>
    </section>
  );
}

export { formatRwf };
