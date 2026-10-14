"use client";

import {
  ArrowUturnCcwLeft,
  Check,
  CircleCheck,
  CircleCheckFill,
  CircleXmark,
  Envelope,
  Lock,
  PersonsLock,
} from "@gravity-ui/icons";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Description,
  Label,
  Radio,
  RadioGroup,
  Separator,
  TextArea,
  TextField,
} from "@heroui/react";
import { RadioButtonGroup } from "@heroui-pro/react";
import type { CaseOfficer, CaseStage, RejectionReason } from "@injishi/data/fixtures/oversight";
import { toneColor } from "@injishi/ui";
import { CardHeading, InlineTitle, ToneChip } from "./shared";

export type Choice = "verify" | "reject";

const CHOICES = [
  { id: "verify", label: "Verify", Icon: CircleCheck, desc: "Documents support the registration" },
  { id: "reject", label: "Reject", Icon: CircleXmark, desc: "With a reason code the business sees" },
] as const;

/** The verifying officer's decision: verify or reject, then the two-person approval that follows. */
export function CaseDecision({
  stage,
  choice,
  onChoice,
  missing,
  reasons,
  reason,
  onReason,
  note,
  onNote,
  officers,
  onVerify,
  onReject,
  onWithdraw,
  onCancelInfo,
}: {
  stage: CaseStage;
  choice: Choice;
  onChoice: (c: Choice) => void;
  /** Short names of the checks still open. */
  missing: string[];
  reasons: RejectionReason[];
  reason: string;
  onReason: (id: string) => void;
  note: string;
  onNote: (v: string) => void;
  officers: CaseOfficer[];
  onVerify: () => void;
  onReject: () => void;
  onWithdraw: () => void;
  onCancelInfo: () => void;
}) {
  const decided = stage === "verified" || stage === "rejected";
  const approver = officers.find((o) => o.duty === "approver")?.name ?? "The approving officer";

  return (
    <Card render={(p) => <section {...p} />} aria-labelledby="dec-h" className="gap-3.5 p-[18px]">
      <Card.Header>
        <CardHeading id="dec-h">Your Decision</CardHeading>
        <Card.Description>You are the verifying officer. A different officer approves.</Card.Description>
      </Card.Header>

      {stage === "review" ? (
        <>
          <RadioButtonGroup
            aria-label="Decision"
            layout="grid"
            value={choice}
            onChange={(v) => onChoice(v === "reject" ? "reject" : "verify")}
            className="grid-cols-1 gap-2.5 sm:grid-cols-2"
          >
            {CHOICES.map((o) => (
              <RadioButtonGroup.Item key={o.id} value={o.id} className="gap-1 px-3.5 py-3">
                <RadioButtonGroup.Indicator>
                  <CircleCheckFill />
                </RadioButtonGroup.Indicator>
                <RadioButtonGroup.ItemContent className="gap-1">
                  <Label className="flex items-center gap-1.5 font-semibold">
                    <o.Icon className="size-4" aria-hidden="true" />
                    {o.label}
                  </Label>
                  <Description className="text-[12px] leading-4">{o.desc}</Description>
                </RadioButtonGroup.ItemContent>
              </RadioButtonGroup.Item>
            ))}
          </RadioButtonGroup>

          {choice === "verify" ? (
            <>
              {missing.length ? (
                <p className="flex items-start gap-2 text-[13px] leading-[18px] text-muted">
                  <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>Verify unlocks when all six checks are done. Still open: {missing.join(", ")}.</span>
                </p>
              ) : null}
              <Button fullWidth isDisabled={missing.length > 0} onPress={onVerify}>
                <Check className="size-4" />
                Record verification
              </Button>
            </>
          ) : (
            <>
              <RadioGroup value={reason} onChange={onReason} className="gap-2">
                <Label>Reason code</Label>
                {reasons.map((r) => (
                  <Radio key={r.id} value={r.id}>
                    <Radio.Content>
                      <Radio.Control>
                        <Radio.Indicator />
                      </Radio.Control>
                      {r.label}
                    </Radio.Content>
                  </Radio>
                ))}
              </RadioGroup>
              <TextField fullWidth isRequired value={note} onChange={onNote} className="gap-1">
                <Label>Explanation sent to the business</Label>
                <TextArea rows={3} />
                <Description>Required. The business sees this text and your reason code.</Description>
              </TextField>
              <Button variant="danger-soft" fullWidth isDisabled={!note.trim()} onPress={onReject}>
                Record rejection
              </Button>
            </>
          )}
        </>
      ) : null}

      {decided ? (
        <>
          <Alert status={stage === "rejected" ? "danger" : "accent"} role="status">
            <Alert.Indicator>
              <PersonsLock />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>
                {stage === "rejected"
                  ? "Rejection recorded · held for a second officer"
                  : "Verification recorded · sent for approval"}
              </Alert.Title>
              <Alert.Description>
                {stage === "rejected"
                  ? `${approver} must confirm before the business is told. You cannot confirm your own rejection.`
                  : `${approver} now has this case in his approval queue. You cannot approve a case you verified.`}
              </Alert.Description>
            </Alert.Content>
          </Alert>
          <Button variant="secondary" fullWidth isDisabled>
            Approve · not allowed for the verifier
          </Button>
          <Button variant="ghost" fullWidth onPress={onWithdraw}>
            <ArrowUturnCcwLeft className="size-4" />
            Withdraw before approval
          </Button>
        </>
      ) : null}

      {stage === "info" ? (
        <>
          <Alert status="warning" role="status">
            <Alert.Indicator>
              <Envelope />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>Waiting for the business · SLA clock paused</Alert.Title>
              <Alert.Description>
                You asked for a readable tourism licence page 2 and the owner’s ID. Response due Saturday 24 Oct.
                Decisions are locked until they reply or you cancel the request.
              </Alert.Description>
            </Alert.Content>
          </Alert>
          <Button variant="ghost" fullWidth onPress={onCancelInfo}>
            Cancel request
          </Button>
        </>
      ) : null}

      <Separator />

      <div className="flex flex-col gap-2.5">
        <InlineTitle>Two-Person Approval</InlineTitle>
        {officers.map((p) => {
          const state =
            p.duty === "verifier"
              ? decided
                ? { label: "Recorded", tone: "success" as const }
                : { label: "In progress", tone: "accent" as const }
              : decided
                ? { label: "Notified · pending", tone: "warning" as const }
                : { label: "Not yet", tone: "default" as const };
          return (
            <div key={p.id} className="flex items-center gap-2.5">
              <Avatar size="sm" variant="soft" color={toneColor(p.avatarTone)} className="shrink-0">
                <Avatar.Fallback>{p.initials}</Avatar.Fallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{p.name}</span>
                <span className="text-[12px] leading-4 text-muted">{p.role}</span>
              </div>
              <ToneChip tone={state.tone}>{state.label}</ToneChip>
            </div>
          );
        })}
        <p className="text-[12px] leading-4 text-muted">
          Rubavu District policy: every verification or rejection is confirmed by a second officer. The verifier is
          excluded from the approver pool for this case.
        </p>
      </div>
    </Card>
  );
}
