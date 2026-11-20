"use client";

import { ArrowRight, Check, CircleCheckFill, Clock, Envelope, ShieldKeyhole } from "@gravity-ui/icons";
import { Alert, Avatar, Button, Checkbox, Chip, Label, Modal, Radio, RadioGroup, toast } from "@heroui/react";
import type { TeamRolesRoleId } from "@injishi/data/fixtures/owner";
import { toneColor } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { OwnershipTransferInfo } from "@/server/ownership-transfer";
import { cancelTransferAction, requestTransferAction } from "./OwnershipActions";
import {
  kigaliDay,
  type NotYetCandidate,
  type OwnershipCandidate,
  TRANSFER_KEEPS,
  TRANSFER_STEPS,
  timeLeft,
} from "./ownership-model";
import { isCode } from "./TeamRolesModel";
import { TeamRolesStepUp, type TeamRolesStepUpChannel } from "./TeamRolesPanel";

type Step = "understand" | "choose" | "confirm" | "sent";
const STEPS: { id: Exclude<Step, "sent">; label: string }[] = [
  { id: "understand", label: "Understand" },
  { id: "choose", label: "Choose" },
  { id: "confirm", label: "Confirm" },
];

/**
 * The dialog's frame: a header and a footer that never move, and between them the only part that scrolls. The dialog
 * is never taller than the screen (`scroll="inside"`, the container's height), so the buttons can never cover text.
 */
const HEAD = "shrink-0 border-b border-separator px-5 pt-5 pb-4 sm:px-6";
const BODY =
  "mx-0 min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";
const FOOT = "shrink-0 border-t border-separator bg-overlay px-5 py-3.5 sm:px-6";

export interface TransferRoleChoice {
  id: TeamRolesRoleId;
  name: string;
  cannot: string;
}

/**
 * Transfer ownership, step by step: understand what it means, choose the new owner and the role you keep, then review
 * it, confirm it is you with the emailed code and say so on purpose. The request is sent only then, and only the API
 * decides (the owner's own membership asks, the code must be from the last ten minutes, the member must be active and
 * identity-verified, one open request per business). Nothing changes hands until that member accepts on their own
 * screen within 7 days; until then the owner can cancel.
 */
export function TeamRolesTransfer({
  isOpen,
  onClose,
  candidates,
  notYet,
  afterRoles,
  pending,
  stepUp,
  ownerName,
}: {
  isOpen: boolean;
  onClose: () => void;
  candidates: OwnershipCandidate[];
  notYet: NotYetCandidate[];
  afterRoles: TransferRoleChoice[];
  /** The request already waiting for an answer, if any. */
  pending: OwnershipTransferInfo | null;
  stepUp: TeamRolesStepUpChannel;
  ownerName: string;
}) {
  // A request just sent stays on its "sent" page until the owner closes the dialog, even after the page refreshes.
  const [sent, setSent] = useState<OwnershipTransferInfo | null>(null);
  const close = () => {
    setSent(null);
    onClose();
  };
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => (open ? null : close())}>
      <Modal.Container placement="top" scroll="inside" className="max-w-[640px] max-sm:p-2">
        <Modal.Dialog aria-labelledby="tr-h" className="max-h-full gap-0 overflow-hidden p-0" data-ui="transfer-dialog">
          {isOpen ? (
            sent ? (
              <SentBody transfer={sent} onClose={close} />
            ) : pending ? (
              <PendingBody pending={pending} onClose={close} />
            ) : (
              <TransferBody
                candidates={candidates}
                notYet={notYet}
                afterRoles={afterRoles}
                stepUp={stepUp}
                ownerName={ownerName}
                onSent={setSent}
                onClose={close}
              />
            )
          ) : null}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

// ── The request waiting for an answer ──────────────────────────────────────────────────────────────

function PendingBody({ pending, onClose }: { pending: OwnershipTransferInfo; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  const cancel = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await cancelTransferAction(pending.id);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      toast.success(`Transfer to ${pending.toName} cancelled. You remain the owner.`);
      onClose();
      router.refresh();
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Modal.Header className={`${HEAD} flex flex-col items-start gap-1`}>
        <Modal.Heading id="tr-h" className="flex items-center gap-2 text-lg leading-[26px] font-semibold">
          <Clock className="size-5 text-warning" aria-hidden="true" />
          Transfer waiting for an answer
        </Modal.Heading>
        <p className="text-sm text-muted">You are still the owner. Nothing changes unless {pending.toName} accepts.</p>
      </Modal.Header>
      <Modal.Body
        tabIndex={0}
        aria-label="Transfer details"
        className={`${BODY} flex flex-col gap-4`}
        data-ui="transfer-pending"
      >
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-2xl bg-surface-secondary p-4 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted">New owner</dt>
          <dd className="font-medium break-words">
            {pending.toName} · {pending.toEmail}
          </dd>
          <dt className="text-muted">Your role afterwards</dt>
          <dd className="font-medium">{pending.previousOwnerRoleLabel}</dd>
          <dt className="text-muted">Requested</dt>
          <dd>{kigaliDay(pending.requestedAt)}</dd>
          <dt className="text-muted">Expires</dt>
          <dd>
            {kigaliDay(pending.expiresAt)}
            {now !== null ? ` · ${timeLeft(pending.expiresAt, now)}` : ""}
          </dd>
        </dl>
        <p className="text-sm text-muted">
          {pending.toName} accepts or declines on their own screen after signing in, with a code we email them. If they
          do not answer in time, the request simply expires and you stay the owner.
        </p>
        {sure ? (
          <Alert status="warning" data-ui="transfer-cancel-confirm">
            <Alert.Content>
              <Alert.Title>Cancel the request to {pending.toName}?</Alert.Title>
              <Alert.Description>
                They will no longer be able to accept it. You stay the owner, and you can ask again later.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}
        {error ? (
          <Alert status="danger" role="alert" data-ui="transfer-error">
            <Alert.Content>
              <Alert.Title>The request was not cancelled</Alert.Title>
              <Alert.Description>{error}</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}
      </Modal.Body>
      <Modal.Footer className={`${FOOT} flex flex-wrap items-center justify-end gap-2`}>
        {sure ? (
          <>
            <Button variant="secondary" isDisabled={busy} onPress={() => setSure(false)}>
              Keep the request
            </Button>
            <Button variant="danger" isDisabled={busy} onPress={() => void cancel()} data-ui="transfer-cancel-yes">
              {busy ? "Cancelling…" : "Yes, cancel it"}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onPress={onClose}>
              Close
            </Button>
            <Button variant="danger-soft" onPress={() => setSure(true)} data-ui="transfer-cancel">
              Cancel transfer
            </Button>
          </>
        )}
      </Modal.Footer>
    </>
  );
}

// ── The request just sent (the API confirmed it) ───────────────────────────────────────────────────

function SentBody({ transfer, onClose }: { transfer: OwnershipTransferInfo; onClose: () => void }) {
  return (
    <>
      <Modal.Header className={`${HEAD} flex flex-col items-start gap-2`}>
        <span className="flex size-11 items-center justify-center rounded-full bg-success-soft">
          <CircleCheckFill className="size-6 text-success" aria-hidden="true" />
        </span>
        <Modal.Heading id="tr-h" className="text-lg leading-[26px] font-semibold">
          Transfer request sent
        </Modal.Heading>
        <p className="text-sm text-muted" role="status" data-ui="transfer-sent">
          The request is waiting for {transfer.toName}: they see it as soon as they sign in, and we sent an email to{" "}
          {transfer.toEmail}. You are still the owner until they accept.
        </p>
      </Modal.Header>
      <Modal.Body tabIndex={0} aria-label="What happens next" className={`${BODY} flex flex-col gap-3`}>
        <div className="rounded-2xl border border-separator p-4 text-sm">
          <p className="pb-2 font-semibold">What happens next</p>
          <ol className="flex flex-col gap-2 text-muted">
            <li className="flex gap-2">
              <Envelope className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {transfer.toName} signs in and accepts or declines, confirming it is them with a code.
            </li>
            <li className="flex gap-2">
              <ShieldKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              When they accept, they become the owner and you become {transfer.previousOwnerRoleLabel}.
            </li>
            <li className="flex gap-2">
              <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              If they have not accepted by {kigaliDay(transfer.expiresAt)}, the request expires. You can cancel it from
              this page at any time before then.
            </li>
          </ol>
        </div>
      </Modal.Body>
      <Modal.Footer className={`${FOOT} flex justify-end`}>
        <Button onPress={onClose} data-ui="transfer-done">
          Done
        </Button>
      </Modal.Footer>
    </>
  );
}

// ── A new request, step by step ────────────────────────────────────────────────────────────────────

function TransferBody({
  candidates,
  notYet,
  afterRoles,
  stepUp,
  ownerName,
  onSent,
  onClose,
}: {
  candidates: OwnershipCandidate[];
  notYet: NotYetCandidate[];
  afterRoles: TransferRoleChoice[];
  stepUp: TeamRolesStepUpChannel;
  ownerName: string;
  onSent: (transfer: OwnershipTransferInfo) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Exclude<Step, "sent">>("understand");
  const [candidate, setCandidate] = useState<string>("");
  const [afterRole, setAfterRole] = useState<string>(
    afterRoles.find((r) => r.id === "manager")?.id ?? afterRoles[0]?.id ?? "",
  );
  const [code, setCode] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One request per press, even if the button is pressed twice before the first answer (the API also allows only one).
  const inFlight = useRef(false);

  const who = candidates.find((c) => c.userId === candidate) ?? null;
  const role = afterRoles.find((r) => r.id === afterRole) ?? null;
  const index = STEPS.findIndex((s) => s.id === step);
  const ready = !!who && !!role && isCode(code) && understood && !busy;

  const submit = async () => {
    if (!who || !role || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const r = await requestTransferAction({ toUserId: who.userId, afterRole: role.id, code });
      if (!r.ok) {
        // The API's own sentence: a wrong or old code, a request already waiting, a member no longer eligible.
        setError(r.message);
        return;
      }
      onSent(r.value);
      router.refresh();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      <Modal.Header className={`${HEAD} flex flex-col items-start gap-3`}>
        <Modal.Heading id="tr-h" className="flex items-center gap-2 text-lg leading-[26px] font-semibold">
          <ShieldKeyhole className="size-5 text-danger" aria-hidden="true" />
          Transfer ownership
        </Modal.Heading>
        <ol className="flex w-full items-center gap-1.5 text-[12.5px]" aria-label="Steps" data-ui="transfer-steps">
          {STEPS.map((s, i) => (
            <li
              key={s.id}
              aria-current={i === index ? "step" : undefined}
              className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-full px-2.5 py-1 ${
                i === index
                  ? "bg-accent-soft font-semibold text-accent-soft-foreground"
                  : i < index
                    ? "text-success"
                    : "text-muted"
              }`}
            >
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                  i < index ? "bg-success text-white" : i === index ? "bg-accent text-white" : "bg-default"
                }`}
              >
                {i < index ? <Check className="size-3" aria-hidden="true" /> : i + 1}
              </span>
              <span className="truncate">{s.label}</span>
            </li>
          ))}
        </ol>
      </Modal.Header>

      <Modal.Body
        key={step}
        tabIndex={0}
        aria-label="Transfer details"
        className={`${BODY} flex flex-col gap-4`}
        data-ui="transfer-body"
      >
        {step === "understand" ? (
          <div className="flex flex-col gap-4" data-ui="transfer-understand">
            <p className="text-sm">
              Transferring ownership hands the whole business to another member of your team. They get everything the
              owner can do, including the plan and billing and the right to transfer it again.
            </p>
            <div className="rounded-2xl border border-separator p-4 text-sm">
              <p className="pb-2 font-semibold">How it works</p>
              <ol className="flex flex-col gap-2">
                {TRANSFER_STEPS.map((t, i) => (
                  <li key={t} className="flex gap-2.5 text-muted">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-default text-[11px] font-semibold text-foreground">
                      {i + 1}
                    </span>
                    {t}
                  </li>
                ))}
              </ol>
            </div>
            <p className="rounded-2xl bg-surface-secondary p-3.5 text-[13px] text-muted">{TRANSFER_KEEPS}</p>
            {candidates.length === 0 ? (
              <Alert status="warning" data-ui="transfer-none">
                <Alert.Content>
                  <Alert.Title>Nobody can receive ownership yet</Alert.Title>
                  <Alert.Description>
                    The new owner must be an active member of the team who has verified their identity in their own
                    account.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}
          </div>
        ) : null}

        {step === "choose" ? (
          <div className="flex flex-col gap-5" data-ui="transfer-choose">
            <RadioGroup value={candidate} onChange={setCandidate} className="gap-2" data-ui="transfer-candidate">
              <Label>Who should become the owner?</Label>
              {candidates.map((c) => (
                <Radio
                  key={c.userId}
                  value={c.userId}
                  className="rounded-2xl border border-separator p-3 data-selected:border-accent data-selected:bg-accent-soft/40 data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-accent/40"
                >
                  <Radio.Content className="flex w-full items-center gap-3">
                    <Radio.Control>
                      <Radio.Indicator />
                    </Radio.Control>
                    <Avatar size="sm" variant="soft" color={c.avatarTone ? toneColor(c.avatarTone) : "default"}>
                      <Avatar.Fallback>{c.initials}</Avatar.Fallback>
                    </Avatar>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{c.name}</span>
                      <span className="truncate text-xs text-muted">
                        {[c.roleName, c.contact].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <Chip size="sm" variant="soft" color="success" className="shrink-0 max-sm:hidden">
                      Identity verified
                    </Chip>
                  </Radio.Content>
                </Radio>
              ))}
            </RadioGroup>
            {notYet.length ? (
              <details className="rounded-2xl border border-separator px-3.5 py-2.5 text-sm" data-ui="transfer-not-yet">
                <summary className="cursor-pointer font-medium">
                  Why can't I choose {notYet.length === 1 ? "1 other person" : `${notYet.length} other people`}?
                </summary>
                <ul className="flex flex-col gap-1.5 pt-2 text-[13px]">
                  {notYet.map((n) => (
                    <li key={n.userId}>
                      <span className="font-medium">{n.name}</span> <span className="text-muted">· {n.reason}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            <RadioGroup value={afterRole} onChange={setAfterRole} className="gap-2" data-ui="transfer-after-role">
              <Label>Your role after the transfer</Label>
              <p className="-mt-1 text-[12.5px] text-muted">
                You stay on the team with this role, in every branch, and lose the owner's rights.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {afterRoles.map((r) => (
                  <Radio
                    key={r.id}
                    value={r.id}
                    className="rounded-2xl border border-separator p-3 data-selected:border-accent data-selected:bg-accent-soft/40 data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-accent/40"
                  >
                    <Radio.Content className="flex w-full items-start gap-2.5">
                      <Radio.Control className="mt-0.5">
                        <Radio.Indicator />
                      </Radio.Control>
                      <span className="flex min-w-0 flex-col">
                        <span className="font-medium">{r.name}</span>
                        {r.cannot ? <span className="text-xs text-muted">{r.cannot}</span> : null}
                      </span>
                    </Radio.Content>
                  </Radio>
                ))}
              </div>
            </RadioGroup>
          </div>
        ) : null}

        {step === "confirm" && who && role ? (
          <div className="flex flex-col gap-4" data-ui="transfer-review">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
              <Person
                label="New owner"
                name={who.name}
                detail={[who.contact, `Now ${who.roleName}`].filter(Boolean).join(" · ")}
                after="Owner"
                initials={who.initials}
                tone={who.avatarTone}
              />
              <span className="flex items-center justify-center text-muted max-sm:hidden" aria-hidden="true">
                <ArrowRight className="size-4" />
              </span>
              <Person label="You" name={ownerName} detail="Now Owner" after={role.name} initials="" tone={null} />
            </div>
            <div className="rounded-2xl border border-separator p-4 text-sm">
              <p className="pb-1.5 font-semibold">When {who.name} accepts</p>
              <ul className="flex flex-col gap-1.5 text-muted">
                <li>
                  {who.name} gets full access, the plan and billing, and the right to transfer the business again.
                </li>
                <li>
                  {/* `cannot` is the API role's own sentence: "Cannot manage the team, … or open staff files." */}
                  You become {role.name}.
                  {role.cannot
                    ? ` As ${role.name}, you ${role.cannot.charAt(0).toLowerCase()}${role.cannot.slice(1)}`
                    : ""}
                </li>
                <li>{TRANSFER_KEEPS}</li>
              </ul>
            </div>
            <TeamRolesStepUp
              channel={stepUp}
              value={code}
              onChange={setCode}
              description="To protect the business we check it is you. Ask for a code, then enter it here; it works for ten minutes."
            />
            <Checkbox isSelected={understood} onChange={setUnderstood} data-ui="transfer-understood">
              <Checkbox.Content className="flex items-start gap-2.5">
                <Checkbox.Control className="mt-0.5">
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <span className="text-sm">
                  I understand that once {who.name} accepts, they become the owner of the business and I become{" "}
                  {role.name}.
                </span>
              </Checkbox.Content>
            </Checkbox>
            {error ? (
              <Alert status="danger" role="alert" data-ui="transfer-error">
                <Alert.Content>
                  <Alert.Title>The request was not sent</Alert.Title>
                  <Alert.Description>{error}</Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}
          </div>
        ) : null}
      </Modal.Body>

      <Modal.Footer className={`${FOOT} flex flex-wrap items-center justify-between gap-2`}>
        <Button variant="ghost" onPress={onClose} isDisabled={busy} data-ui="transfer-close">
          Cancel
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {index > 0 ? (
            <Button
              variant="secondary"
              isDisabled={busy}
              onPress={() => {
                setError(null);
                setStep(STEPS[index - 1]?.id ?? "understand");
              }}
              data-ui="transfer-back"
            >
              Back
            </Button>
          ) : null}
          {step === "understand" ? (
            <Button isDisabled={candidates.length === 0} onPress={() => setStep("choose")} data-ui="transfer-next">
              Continue
            </Button>
          ) : step === "choose" ? (
            <Button isDisabled={!who || !role} onPress={() => setStep("confirm")} data-ui="transfer-next">
              {who ? "Review" : "Choose a team member"}
            </Button>
          ) : (
            <Button variant="danger" isDisabled={!ready} onPress={() => void submit()} data-ui="transfer-request">
              {busy ? "Sending request…" : "Send transfer request"}
            </Button>
          )}
        </div>
      </Modal.Footer>
    </>
  );
}

function Person({
  label,
  name,
  detail,
  after,
  initials,
  tone,
}: {
  label: string;
  name: string;
  detail: string;
  after: string;
  initials: string;
  tone: OwnershipCandidate["avatarTone"];
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-2xl bg-surface-secondary p-3.5">
      <span className="text-[12px] font-medium tracking-wide text-muted uppercase">{label}</span>
      <span className="flex items-center gap-2.5">
        {initials ? (
          <Avatar size="sm" variant="soft" color={tone ? toneColor(tone) : "default"}>
            <Avatar.Fallback>{initials}</Avatar.Fallback>
          </Avatar>
        ) : null}
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-semibold">{name}</span>
          <span className="truncate text-xs text-muted">{detail}</span>
        </span>
      </span>
      <span className="flex items-center gap-1.5 text-[13px]">
        <span className="text-muted">Becomes</span>
        <Chip size="sm" variant="soft" color={after === "Owner" ? "success" : "default"}>
          {after}
        </Chip>
      </span>
    </div>
  );
}
