"use client";

import { ArrowLeft, Clock, Envelope, ShieldCheck } from "@gravity-ui/icons";
import { Alert, Button, Card, Checkbox, Chip, ProgressBar } from "@heroui/react";
import { ListView, Stepper, Timeline } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type {
  CaseAuditEntry,
  CaseEvent,
  CaseFile,
  CaseStage,
  RejectionReason,
  Tone,
} from "@injishi/data/fixtures/oversight";
import { Icon, LinkButton, PageContent, PageHeader } from "@injishi/ui";
import NextLink from "next/link";
import { useState } from "react";
import { caseRef } from "@/server/sources/oversight";
import { approveAction, checkDocumentAction, fieldVerifyAction, rejectAction } from "./actions";
import { CaseDecision, type Choice } from "./CaseDecision";
import { CaseDocuments } from "./CaseDocuments";
import { CaseInfoDialog } from "./CaseInfoDialog";
import { CardHeading, FactGrid, ToneChip } from "./shared";

const STAGE_CHIP: Record<CaseStage, { label: string; tone: Tone }> = {
  review: { label: "In review", tone: "accent" },
  info: { label: "Information requested", tone: "warning" },
  verified: { label: "Verified · awaiting approval", tone: "info" },
  rejected: { label: "Rejection awaiting confirmation", tone: "danger" },
};

/** One verification case: documents, checks, the officer's decision and what the business is told. */
export function OfficerCaseView({ file, reasons }: { file: CaseFile; reasons: RejectionReason[] }) {
  const [stage, setStage] = useState<CaseStage>(file.stage);
  const [checks, setChecks] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(file.checks.map((c) => [c.id, c.recorded !== null])),
  );
  const [choice, setChoice] = useState<Choice>("verify");
  const [reason, setReason] = useState(reasons[0]?.id ?? "");
  const [note, setNote] = useState(file.rejectionNote);
  const [infoOpen, setInfoOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<string | null>(null);

  /** Set on a case read from the registry: which gate this officer decides here. Absent on sample cases. */
  const gate = file.gate;
  const live = gate !== undefined;
  const ref = live ? caseRef(file.id) : file.id;

  const locked = stage !== "review";
  // The approver does not re-read the documents: they decide on what the field verifier recorded.
  const missing = gate === "approval" ? [] : file.checks.filter((c) => !checks[c.id]);

  /** Record one document as read on the registry (the field verifier's act), then tick it here. */
  const readDocument = async (id: string) => {
    setBusy(true);
    setError("");
    const res = await checkDocumentAction(file.id, id);
    setBusy(false);
    if (res.ok) setChecks((s) => ({ ...s, [id]: true }));
    else setError(res.error);
  };

  /** Send a decision to the registry; the stage changes only when the registry accepted it. */
  const decide = async (call: Promise<{ ok: true; value: string } | { ok: false; error: string }>, next: CaseStage) => {
    setBusy(true);
    setError("");
    const res = await call;
    setBusy(false);
    if (res.ok) {
      setOutcome(res.value);
      setStage(next);
    } else setError(res.error);
  };
  const onVerify = () => {
    if (!gate) return setStage("verified");
    void decide(gate === "field" ? fieldVerifyAction(file.id, "") : approveAction(file.id, ""), "verified");
  };
  const onReject = () => {
    if (!gate) return setStage("rejected");
    void decide(rejectAction(file.id, gate, reason, note), "rejected");
  };
  const done = file.checks.length - missing.length;
  const pct = file.checks.length ? Math.round((done / file.checks.length) * 100) : 0;
  const approver = file.officers.find((o) => o.duty === "approver")?.name ?? "";
  const reasonLabel = reasons.find((r) => r.id === reason)?.label ?? "";
  const submitted = `${file.submitted.date} · ${file.submitted.by}`;

  const steps: { current: number; items: [string, string][] } = {
    review: {
      current: 1,
      items: [
        ["Submitted", submitted],
        ["Verification", "You · in review"],
        ["Approval", "Second officer"],
        ["Decision sent", "To the business"],
      ] as [string, string][],
    },
    info: {
      current: 1,
      items: [
        ["Submitted", submitted],
        ["Verification", "Waiting for business"],
        ["Approval", "Second officer"],
        ["Decision sent", "To the business"],
      ] as [string, string][],
    },
    verified: {
      current: 2,
      items: [
        ["Submitted", submitted],
        ["Verified", "You · just now"],
        ["Approval", approver],
        ["Decision sent", "After approval"],
      ] as [string, string][],
    },
    rejected: {
      current: 2,
      items: [
        ["Submitted", submitted],
        ["Rejection recorded", "You · just now"],
        ["Confirmation", approver],
        ["Decision sent", "After confirmation"],
      ] as [string, string][],
    },
  }[stage];

  const liveStep: { current: number; items: [string, string][] } | null = gate
    ? {
        current:
          gate === "field" ? (stage === "review" ? 1 : stage === "verified" ? 2 : 3) : stage === "review" ? 2 : 3,
        items: [
          ["Submitted", submitted],
          [
            "Field verification",
            gate === "approval"
              ? "Recorded"
              : stage === "review"
                ? "You · in review"
                : stage === "verified"
                  ? "You · just now"
                  : "Rejected · you",
          ],
          [
            "Approval",
            gate === "field"
              ? stage === "verified"
                ? "Waiting for an approver"
                : stage === "rejected"
                  ? "Not needed"
                  : "Second officer"
              : stage === "review"
                ? "You · in review"
                : stage === "verified"
                  ? "You · just now"
                  : "Rejected · you",
          ],
          ["Decision sent", stage === "review" ? "To the business" : "To the business · just now"],
        ] as [string, string][],
      }
    : null;
  const stepper = liveStep ?? steps;

  const liveEvent: CaseEvent | null =
    gate && stage !== "review"
      ? stage === "rejected"
        ? {
            id: "rejected",
            icon: "Xmark",
            title: "Rejected · your reason code and explanation went to the owner",
            when: "Just now · Injishi and email",
            state: "Delivered",
            tone: "danger",
          }
        : gate === "field"
          ? {
              id: "verified",
              icon: "Check",
              title: "Field verified · waiting for an approving officer",
              when: "Just now · Injishi",
              state: "Delivered",
              tone: "success",
            }
          : {
              id: "approved",
              icon: "Check",
              title:
                outcome === "active"
                  ? "Approved · the business is open"
                  : "Approved · it opens once the owner claims it",
              when: "Just now · Injishi and email",
              state: "Delivered",
              tone: "success",
            }
      : null;

  const stageEvent: CaseEvent | null = gate
    ? liveEvent
    : stage === "info"
      ? {
          id: "info",
          icon: "Envelope",
          title: "Information requested: licence page 2 and owner ID · due 24 Oct",
          when: "Just now · Injishi and SMS",
          state: "Delivered",
          tone: "success",
        }
      : stage === "verified"
        ? {
            id: "verified",
            icon: "Check",
            title: "Verified · waiting for a second officer’s approval",
            when: "Just now · Injishi",
            state: "Delivered",
            tone: "success",
          }
        : stage === "rejected"
          ? {
              id: "held",
              icon: "Clock",
              title: "Rejection is not sent until a second officer confirms it",
              when: "Held · nothing shown to the business yet",
              state: "Held",
              tone: "default",
            }
          : null;
  const sent = file.events.filter((e) => e.id !== "final");
  const final = file.events.filter((e) => e.id === "final");
  const events = [...sent, ...(stageEvent ? [stageEvent] : []), ...final];

  const liveAudit: CaseAuditEntry | null =
    gate && stage !== "review"
      ? stage === "rejected"
        ? {
            id: "now",
            status: "danger",
            title: "You recorded a rejection",
            detail: `${reasonLabel} · sent to the business`,
          }
        : {
            id: "now",
            status: "success",
            title: gate === "field" ? "You recorded the field verification" : "You approved the registration",
            detail:
              gate === "field"
                ? "Just now · routed to an approving officer"
                : "Just now · the registry holds the decision",
          }
      : null;

  const auditTop: CaseAuditEntry | null = gate
    ? liveAudit
    : stage === "info"
      ? { id: "now", status: "warning", title: "You requested more information", detail: "Just now · SLA clock paused" }
      : stage === "verified"
        ? {
            id: "now",
            status: "current",
            title: "You recorded verification · 6 of 6 checks",
            detail: `Just now · routed to ${approver}`,
          }
        : stage === "rejected"
          ? {
              id: "now",
              status: "danger",
              title: "You recorded a rejection",
              detail: `${reasonLabel} · held for confirmation`,
            }
          : null;
  const audit = auditTop ? [auditTop, ...file.audit.slice(0, gate ? 6 : 5)] : file.audit;

  const chip = STAGE_CHIP[stage];

  return (
    <PageContent className="text-[14px] leading-5">
      <PageHeader
        eyebrow={
          <>
            <NextLink href={screenHref("OfficerHome")} className="text-inherit no-underline hover:underline">
              Queues
            </NextLink>
            <span aria-hidden="true">›</span>
            <span>{file.queue}</span>
            <span aria-hidden="true">›</span>
            <span className="tabular">{ref}</span>
          </>
        }
        title={file.business}
        description={
          <>
            {file.summary}
            <span className="mt-2 flex flex-wrap items-center gap-2">
              <ToneChip tone={chip.tone}>{chip.label}</ToneChip>
              <Chip size="sm" variant="soft" color={stage === "info" ? "default" : "warning"}>
                <Clock className="size-3" aria-hidden="true" />
                <Chip.Label>
                  {stage === "info" ? `SLA paused · was due ${file.due}` : `Due ${file.due} · ${file.slaLeft}`}
                </Chip.Label>
              </Chip>
              <ToneChip tone="default">{file.assigned}</ToneChip>
            </span>
          </>
        }
        actions={
          <>
            <LinkButton href={screenHref("OfficerHome")} variant="ghost">
              <ArrowLeft className="size-4" />
              Queues
            </LinkButton>
            {live ? null : (
              <Button variant="secondary" isDisabled={locked} onPress={() => setInfoOpen(true)}>
                <Envelope className="size-4" />
                Request more information
              </Button>
            )}
          </>
        }
      />

      <Card render={(p) => <section {...p} />} aria-label="Approval progress" className="px-[18px] py-3.5">
        <Stepper size="sm" currentStep={stepper.current} className="w-full">
          {stepper.items.map(([title, sub]) => (
            <Stepper.Step key={title}>
              <Stepper.Indicator />
              <Stepper.Content>
                <Stepper.Title>{title}</Stepper.Title>
                <Stepper.Description className="text-[12px] leading-4 text-muted">{sub}</Stepper.Description>
              </Stepper.Content>
              <Stepper.Separator />
            </Stepper.Step>
          ))}
        </Stepper>
      </Card>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-4">
          <Card render={(p) => <section {...p} />} aria-labelledby="biz-h" className="gap-3 p-[18px]">
            <Card.Header>
              <CardHeading id="biz-h">Business and Claim</CardHeading>
              <Card.Description>Declared by the business · checked against the documents below</Card.Description>
            </Card.Header>
            <FactGrid min={200} className="gap-x-5 gap-y-3" items={file.facts} />
            <Alert>
              <Alert.Indicator>
                <ShieldCheck />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>Nothing is activated on paperwork alone</Alert.Title>
                <Alert.Description>
                  {live
                    ? `${file.business} is registered only after a field verifier has visited and a second officer approves. Injishi records the decision; it does not make it.`
                    : "Isangano Lakeside Hotel shows as registered with Rubavu District only after you verify and a second officer approves. Injishi records the decision; it does not make it."}
                </Alert.Description>
              </Alert.Content>
            </Alert>
          </Card>

          <CaseDocuments file={file} />

          <Card render={(p) => <section {...p} />} aria-labelledby="chk-h" className="gap-3 p-[18px]">
            <Card.Header className="flex flex-row items-start gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <CardHeading id="chk-h">{live ? "Documents read" : "Checks"}</CardHeading>
                <Card.Description>
                  {live
                    ? gate === "field"
                      ? "Open each document, then tick it. The registry records your name and time. Every document must be read before you can verify."
                      : "Recorded by the field verifier. You decide on what they saw."
                    : "Every check records your name and time. All six are needed to verify."}
                </Card.Description>
              </div>
              <span className="font-semibold tabular">
                {done} of {file.checks.length}
              </span>
            </Card.Header>
            <ProgressBar value={pct} aria-label="Checks complete">
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
            <ul className="flex flex-col gap-0.5">
              {file.checks.map((c) => {
                const on = !!checks[c.id];
                const when = on ? (c.recorded ?? "You · just now") : "Open";
                return (
                  <li key={c.id} className="flex items-start justify-between gap-3 border-t border-separator py-2">
                    <Checkbox
                      isSelected={on}
                      isDisabled={locked || (live && (gate !== "field" || on || busy))}
                      onChange={(v) =>
                        live ? (v ? void readDocument(c.id) : undefined) : setChecks((s) => ({ ...s, [c.id]: v }))
                      }
                    >
                      <Checkbox.Content className="flex items-start gap-2.5">
                        <Checkbox.Control className="mt-0.5">
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <span className="flex min-w-0 flex-col">
                          <span className="font-medium">{c.label}</span>
                          <span className="text-[12px] leading-4 text-muted">{c.how}</span>
                        </span>
                      </Checkbox.Content>
                    </Checkbox>
                    <span className="text-[12px] whitespace-nowrap text-muted">{when}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-4">
          <CaseDecision
            stage={stage}
            choice={choice}
            onChoice={setChoice}
            missing={missing.map((c) => c.short)}
            reasons={reasons}
            reason={reason}
            onReason={setReason}
            note={note}
            onNote={setNote}
            officers={file.officers}
            onVerify={onVerify}
            onReject={onReject}
            live={gate ? { gate, blocked: !!file.blocked, busy, error, outcome } : undefined}
            onWithdraw={() => setStage("review")}
            onCancelInfo={() => setStage("review")}
          />

          <Card render={(p) => <section {...p} />} aria-labelledby="ev-h" className="gap-2.5 p-[18px]">
            <Card.Header>
              <CardHeading id="ev-h">Events Sent to the Business</CardHeading>
              <Card.Description>
                {live
                  ? `What ${file.owner} sees in Injishi and by email`
                  : `What ${file.owner} sees in Injishi and by SMS`}
              </Card.Description>
            </Card.Header>
            <ListView aria-labelledby="ev-h" variant="secondary" items={events}>
              {(ev) => (
                <ListView.Item id={ev.id} textValue={ev.title}>
                  <ListView.ItemContent>
                    <Icon name={ev.icon} className="size-4 shrink-0 text-muted" />
                    <div className="flex min-w-0 flex-col">
                      <ListView.Title className="whitespace-normal">{ev.title}</ListView.Title>
                      <ListView.Description>{ev.when}</ListView.Description>
                    </div>
                  </ListView.ItemContent>
                  <ListView.ItemAction>
                    <ToneChip tone={ev.tone}>{ev.state}</ToneChip>
                  </ListView.ItemAction>
                </ListView.Item>
              )}
            </ListView>
          </Card>

          <Card render={(p) => <section {...p} />} aria-labelledby="aud-h" className="gap-3 p-[18px]">
            <Card.Header>
              <CardHeading id="aud-h">Case Audit Trail</CardHeading>
              <Card.Description>Newest first · entries cannot be edited or deleted</Card.Description>
            </Card.Header>
            <Timeline size="sm" density="compact">
              {audit.map((a) => (
                <Timeline.Item key={a.id} status={a.status}>
                  <Timeline.Rail>
                    <Timeline.Marker />
                    <Timeline.Connector />
                  </Timeline.Rail>
                  <Timeline.Content className="flex flex-col pb-0.5">
                    <span className="text-[13px] font-medium">{a.title}</span>
                    <span className="text-[12px] leading-4 text-muted">{a.detail}</span>
                  </Timeline.Content>
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
        </div>
      </div>

      <CaseInfoDialog
        file={file}
        isOpen={infoOpen}
        onOpenChange={setInfoOpen}
        onSend={() => {
          setInfoOpen(false);
          setStage("info");
        }}
      />
    </PageContent>
  );
}
