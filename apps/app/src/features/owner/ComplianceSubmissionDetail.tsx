"use client";

import { FileArrowUp, ShieldExclamation, TriangleExclamation } from "@gravity-ui/icons";
import { Alert, Button, Card, Chip } from "@heroui/react";
import { DropZone, Stepper } from "@heroui-pro/react";
import type { ComplianceStage, ComplianceSubmission, Tone } from "@injishi/data/fixtures/owner";
import { GateChip, KeyValueList, toneColor } from "@injishi/ui";

const STEP_TITLES = ["Draft", "Internal review", "Approved to send", "Sent"] as const;
const ACTIONS: readonly string[] = ["Submit for review", "Approve to send", "Record as sent", "Record acknowledgement"];
const HINTS = [
  "A second person reviews before anything can be sent.",
  "Approving lets the preparer send it through the channel above. It does not send anything by itself.",
  "Attach proof of what was sent and when. Without it, the submission stays Approved to send.",
  "Sending is not acknowledgement. Record the counterpart’s reference or decision when it arrives.",
  "Closed with counterpart evidence. Corrections start a new submission.",
] as const;
const OUTCOME_TONE = { Acknowledged: "success", Rejected: "danger", "Needs follow-up": "warning" } as const;

/** Label shown in the State column and on the detail chip for a submission at a given stage. */
export function complianceStateOf(s: ComplianceSubmission, stage: ComplianceStage): string {
  return stage === 4 ? (s.outcome ?? "Acknowledged") : STEP_TITLES[stage];
}

/** Tone of that state: outcome colours once closed, otherwise draft grey, in-flight accent, sent info. */
export function complianceToneOf(s: ComplianceSubmission, stage: ComplianceStage): Tone {
  if (stage === 4) return OUTCOME_TONE[s.outcome ?? "Acknowledged"];
  if (stage === 3) return "info";
  return stage === 0 ? "default" : "accent";
}

/**
 * Detail card of the selected submission: workflow stepper, facts, proof and the next action.
 *
 * Submissions are sample data (`owner.complianceSubmissions` waits on an /architect decision), so moving a
 * stage, returning to draft and attaching proof are not available: each says so through `onUnavailable` and
 * nothing on screen changes. No file is kept, not even its name.
 */
export function ComplianceSubmissionDetail({
  submission: s,
  stage,
  onUnavailable,
}: {
  submission: ComplianceSubmission;
  stage: ComplianceStage;
  /** Tell the person this step is not available yet. */
  onUnavailable: (what: string) => void;
}) {
  const hasProof = stage >= 3;
  const steps = [...STEP_TITLES, stage === 4 ? (s.outcome ?? "Acknowledged") : "Acknowledged, rejected or follow-up"];
  const detailOf = (i: number) => {
    if (i === 0) return s.log[0];
    if (i === 1) return s.log[1];
    if (i === 3 && stage >= 3) return "Proof on file";
    if (i === 4 && stage === 4) return "Counterpart evidence on file";
    return "";
  };
  const needProof = stage === 2;
  const showNote = stage === 4 && s.note !== null;

  return (
    <section aria-labelledby="det-h">
      <Card className="gap-[14px] p-[18px]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs text-muted tabular">
              {s.id} · {s.party}
            </span>
            <h2 id="det-h" className="text-[15px] leading-[22px] font-semibold">
              {s.title}
            </h2>
          </div>
          <Chip size="sm" variant="soft" color={toneColor(complianceToneOf(s, stage))} className="shrink-0">
            {complianceStateOf(s, stage)}
          </Chip>
        </div>

        <Stepper orientation="vertical" size="sm" currentStep={stage} aria-label="Submission progress">
          {steps.map((title, i) => {
            const detail = detailOf(i);
            return (
              <Stepper.Step key={title}>
                <Stepper.Indicator />
                <Stepper.Content>
                  <Stepper.Title>{title}</Stepper.Title>
                  {detail ? (
                    <Stepper.Description className="text-xs leading-4 text-muted">{detail}</Stepper.Description>
                  ) : null}
                </Stepper.Content>
                <Stepper.Separator />
              </Stepper.Step>
            );
          })}
        </Stepper>

        <KeyValueList
          className="grid-cols-[92px_minmax(0,1fr)]! text-xs! leading-[18px]!"
          items={[
            { label: "Legal basis", value: s.basis },
            { label: "Contents", value: s.contents },
            { label: "Proof", value: s.proof },
          ]}
        />

        {s.mandateGate ? (
          <GateChip icon={<ShieldExclamation className="size-3" />} className="self-start">
            Mandate needs verification
          </GateChip>
        ) : null}

        {showNote ? (
          <Alert status="warning">
            <Alert.Indicator>
              <TriangleExclamation />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>{s.noteTitle}</Alert.Title>
              <Alert.Description>{s.note}</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}

        {needProof ? (
          <DropZone>
            <DropZone.Area className="p-[14px]" onDrop={() => onUnavailable("Attaching proof")}>
              <DropZone.Icon>
                <FileArrowUp />
              </DropZone.Icon>
              <DropZone.Label>Attach the portal or email confirmation</DropZone.Label>
              <DropZone.Description>
                Attaching proof is not available yet: no file is uploaded or kept
              </DropZone.Description>
              <DropZone.Trigger>Choose file</DropZone.Trigger>
            </DropZone.Area>
            <DropZone.Input onSelect={() => onUnavailable("Attaching proof")} />
          </DropZone>
        ) : null}

        {stage < 4 ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" isDisabled={stage === 2 && !hasProof} onPress={() => onUnavailable(ACTIONS[stage])}>
              {ACTIONS[stage]}
            </Button>
            {stage === 1 ? (
              <Button size="sm" variant="ghost" onPress={() => onUnavailable("Returning to draft")}>
                Return to draft
              </Button>
            ) : null}
          </div>
        ) : null}
        <p className="text-xs leading-4 text-muted">{HINTS[stage]}</p>
      </Card>
    </section>
  );
}
