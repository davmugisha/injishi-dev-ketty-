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
import { useTranslations } from "next-intl";
import { CardHeading, InlineTitle, ToneChip } from "./shared";

export type Choice = "verify" | "reject";

/** What a live case adds: the gate this officer decides, and the state of the call to the API. */
interface LiveDecision {
  /** `review`: a PSF District Manager's one step, whose Reviewed approves the business (0119). */
  gate: "field" | "approval" | "review";
  /** The officer field-verified this case themselves, so the API will refuse their approval. */
  blocked: boolean;
  busy: boolean;
  /** The API's refusal or failure, in words. */
  error: string;
  /** The status the business moved to after the decision ("active", "approved", "field_verified", "rejected"). */
  outcome: string | null;
}

const CHOICES = [
  { id: "verify", Icon: CircleCheck },
  { id: "reject", Icon: CircleXmark },
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
  live,
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
  live?: LiveDecision;
}) {
  const t = useTranslations("officialReview.decision");
  const flow = useTranslations("officialFlow");
  const decided = stage === "verified" || stage === "rejected";
  const approver = officers.find((o) => o.duty === "approver")?.name ?? t("approverRole");
  const oneStep = live?.gate === "review";
  // Both open the business: the approver's gate, and the manager's one-step review.
  const approving = live?.gate === "approval" || oneStep;
  const passLabel = oneStep ? t("reviewAndApprove") : approving ? t("approveBusiness") : t("verify");
  const choices = CHOICES.map((c) =>
    c.id === "verify"
      ? { ...c, label: passLabel, desc: t("docsSupport") }
      : { ...c, label: t("reject"), desc: t("explanationHint") },
  );

  return (
    <Card render={(p) => <section {...p} />} aria-labelledby="dec-h" className="gap-3.5 p-[18px]">
      <Card.Header>
        <CardHeading id="dec-h">{t("title")}</CardHeading>
        <Card.Description>
          {live
            ? oneStep
              ? t("managerRole")
              : approving
                ? t("approverRole")
                : t("fieldRole")
            : t("fieldRole")}
        </Card.Description>
      </Card.Header>

      {stage === "review" ? (
        <>
          <RadioButtonGroup
            aria-label={t("title")}
            layout="grid"
            value={choice}
            onChange={(v) => onChoice(v === "reject" ? "reject" : "verify")}
            className="grid-cols-1 gap-2.5 sm:grid-cols-2"
          >
            {choices.map((o) => (
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
              {live?.blocked ? (
                <p className="flex items-start gap-2 text-[13px] leading-[18px] text-muted">
                  <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{t("otherApprover")}</span>
                </p>
              ) : missing.length ? (
                <p className="flex items-start gap-2 text-[13px] leading-[18px] text-muted">
                  <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>
                    {live
                      ? t("documentRead", { action: passLabel, missing: missing.join(", ") })
                      : t("missingChecks", { missing: missing.join(", ") })}
                  </span>
                </p>
              ) : null}
              <Button fullWidth isDisabled={missing.length > 0 || !!live?.blocked || !!live?.busy} onPress={onVerify}>
                <Check className="size-4" />
                {live
                  ? oneStep
                    ? t("reviewAndApprove")
                    : approving
                      ? t("approveBusiness")
                      : t("recordVerification")
                  : t("recordVerification")}
              </Button>
            </>
          ) : (
            <>
              <RadioGroup value={reason} onChange={onReason} className="gap-2">
                <Label>{t("reasonCode")}</Label>
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
                <Label>{t("explanation")}</Label>
                <TextArea rows={3} />
                <Description>{t("explanationHint")}</Description>
              </TextField>
              <Button variant="danger-soft" fullWidth isDisabled={!note.trim() || !!live?.busy} onPress={onReject}>
                {t("recordRejection")}
              </Button>
            </>
          )}
        </>
      ) : null}

      {live?.error ? (
        <Alert status="danger" role="alert">
          <Alert.Content>
            <Alert.Title>{t("registryFailure")}</Alert.Title>
            <Alert.Description>{live.error}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      {decided && live ? (
        <Alert status={stage === "rejected" ? "danger" : "success"} role="status">
          <Alert.Indicator>
            <PersonsLock />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>
              {stage === "rejected"
                ? t("rejectionRecorded")
                : approving
                  ? live.outcome === "active"
                    ? t("approvedOpen")
                    : t("approvedClaim")
                  : t("sentForApproval")}
            </Alert.Title>
            <Alert.Description>
              {stage === "rejected"
                ? t("rejectionMail")
                : approving
                  ? live.outcome === "active"
                    ? t("approvalMail")
                    : t("claimMail")
                  : t("secondOfficer")}
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      {decided && !live ? (
        <>
          <Alert status={stage === "rejected" ? "danger" : "accent"} role="status">
            <Alert.Indicator>
              <PersonsLock />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>
                {stage === "rejected"
                  ? flow("rejectionHeld")
                  : flow("verifySent")}
              </Alert.Title>
              <Alert.Description>
                {stage === "rejected"
                  ? flow("approverConfirm", { approver })
                  : flow("approverQueue", { approver })}
              </Alert.Description>
            </Alert.Content>
          </Alert>
          <Button variant="secondary" fullWidth isDisabled>
            {flow("verifierBlocked")}
          </Button>
          <Button variant="ghost" fullWidth onPress={onWithdraw}>
            <ArrowUturnCcwLeft className="size-4" />
            {flow("withdraw")}
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
              <Alert.Title>{t("waitingBusiness")}</Alert.Title>
              <Alert.Description>
                {flow("infoResponse")}
              </Alert.Description>
            </Alert.Content>
          </Alert>
          <Button variant="ghost" fullWidth onPress={onCancelInfo}>
            {flow("cancelRequest")}
          </Button>
        </>
      ) : null}

      <Separator />

      <div className="flex flex-col gap-2.5">
        <InlineTitle>{t("twoPerson")}</InlineTitle>
        {live ? (
          <p className="text-[12px] leading-4 text-muted">
            {flow("twoPersonLead")}
          </p>
        ) : null}
        {officers.map((p) => {
          const state =
            p.duty === "verifier"
              ? decided
                ? { label: flow("recorded"), tone: "success" as const }
                : { label: flow("inProgress"), tone: "accent" as const }
              : decided
                ? { label: flow("notifiedPending"), tone: "warning" as const }
                : { label: flow("notYet"), tone: "default" as const };
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
        {live ? null : (
          <p className="text-[12px] leading-4 text-muted">
            {flow("districtPolicy")}
          </p>
        )}
      </div>
    </Card>
  );
}
