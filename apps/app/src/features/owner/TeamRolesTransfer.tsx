"use client";

import { Button, Label, ListBox, Modal, Select, toast } from "@heroui/react";
import type { TeamRolesRoleId } from "@injishi/data/fixtures/owner";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OwnershipTransferInfo } from "@/server/ownership-transfer";
import { cancelTransferAction, requestTransferAction } from "./OwnershipActions";
import { isCode } from "./TeamRolesModel";
import { TeamRolesStepUp, type TeamRolesStepUpChannel } from "./TeamRolesPanel";

interface TeamRolesTransferOption {
  id: string;
  label: string;
}

const day = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kigali",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));

/**
 * Transfer Ownership. The owner picks an active, identity-verified member and the role they keep, reads what will
 * happen, confirms it is them with the emailed step-up code, and asks. Nothing changes hands until that member accepts
 * on their own screen, with a code of their own, within 7 days; until then the owner can cancel. The API decides every
 * rule (only the owner asks, the step-up must be from the last ten minutes, one open request per business).
 */
export function TeamRolesTransfer({
  isOpen,
  onClose,
  candidates,
  afterRoles,
  pending,
  stepUp,
}: {
  isOpen: boolean;
  onClose: () => void;
  candidates: TeamRolesTransferOption[];
  afterRoles: TeamRolesTransferOption[];
  /** The request already waiting for an answer, if any. */
  pending: OwnershipTransferInfo | null;
  stepUp: TeamRolesStepUpChannel;
}) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => (open ? null : onClose())}>
      <Modal.Container placement="top" className="max-w-[560px]">
        <Modal.Dialog aria-labelledby="tr-h" className="gap-4 p-6" data-ui="transfer-dialog">
          {isOpen ? (
            pending ? (
              <PendingBody pending={pending} onClose={onClose} />
            ) : (
              <TransferBody candidates={candidates} afterRoles={afterRoles} stepUp={stepUp} onClose={onClose} />
            )
          ) : null}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function PendingBody({ pending, onClose }: { pending: OwnershipTransferInfo; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const cancel = async () => {
    setBusy(true);
    try {
      const r = await cancelTransferAction(pending.id);
      if (!r.ok) {
        toast.danger(r.message);
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
      <Modal.Header className="flex flex-col items-start gap-1">
        <Modal.Heading id="tr-h" className="text-lg leading-[26px] font-semibold">
          Transfer waiting for an answer
        </Modal.Heading>
        <p className="text-sm text-muted">You remain the owner until {pending.toName} accepts.</p>
      </Modal.Header>
      <Modal.Body className="flex flex-col gap-3" data-ui="transfer-pending">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl bg-surface-secondary p-4 text-sm">
          <dt className="text-muted">New owner</dt>
          <dd className="font-medium">
            {pending.toName} · {pending.toEmail}
          </dd>
          <dt className="text-muted">Your role afterwards</dt>
          <dd className="font-medium">{pending.previousOwnerRoleLabel}</dd>
          <dt className="text-muted">Asked</dt>
          <dd>{day(pending.requestedAt)}</dd>
          <dt className="text-muted">Expires</dt>
          <dd>{day(pending.expiresAt)} if not accepted</dd>
        </dl>
        <p className="text-sm text-muted">
          {pending.toName} accepts or declines on their own screen after signing in, with a code we email them. You can
          cancel the request until they answer.
        </p>
      </Modal.Body>
      <Modal.Footer className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="secondary" onPress={onClose}>
          Close
        </Button>
        <Button variant="danger" isDisabled={busy} onPress={() => void cancel()} data-ui="transfer-cancel">
          Cancel transfer
        </Button>
      </Modal.Footer>
    </>
  );
}

function TransferBody({
  candidates,
  afterRoles,
  stepUp,
  onClose,
}: {
  candidates: TeamRolesTransferOption[];
  afterRoles: TeamRolesTransferOption[];
  stepUp: TeamRolesStepUpChannel;
  onClose: () => void;
}) {
  const router = useRouter();
  const [candidate, setCandidate] = useState<string | null>(null);
  const [afterRole, setAfterRole] = useState<string | null>(
    afterRoles.find((r) => r.id === "manager")?.id ?? afterRoles[0]?.id ?? null,
  );
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const who = candidates.find((c) => c.id === candidate)?.label.split(" · ")[0] ?? null;
  const role = afterRoles.find((r) => r.id === afterRole)?.label.split(" · ")[0] ?? null;
  const ready = !!candidate && !!afterRole && isCode(code) && !busy;

  const submit = async () => {
    if (!candidate || !afterRole) return;
    setBusy(true);
    try {
      const r = await requestTransferAction({ toUserId: candidate, afterRole: afterRole as TeamRolesRoleId, code });
      if (!r.ok) {
        toast.danger(r.message);
        return;
      }
      toast.success(`Transfer requested. ${r.value.toName} has until ${day(r.value.expiresAt)} to accept.`);
      onClose();
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal.Header className="flex flex-col items-start gap-1">
        <Modal.Heading id="tr-h" className="text-lg leading-[26px] font-semibold">
          Transfer Ownership
        </Modal.Heading>
        <p className="text-sm text-muted">
          The new owner gets every permission, the plan and billing, and the right to transfer again. It takes effect
          only when they accept with a verified identity.
        </p>
      </Modal.Header>
      <Modal.Body className="flex flex-col gap-4 overflow-visible">
        {candidates.length === 0 ? (
          <p className="rounded-xl bg-surface-secondary p-3 text-sm text-muted" data-ui="transfer-none">
            Nobody on the team can take ownership yet: the new owner must be an active member with a verified identity.
          </p>
        ) : null}
        <Select
          fullWidth
          value={candidate}
          onChange={(v) => setCandidate(v === null ? null : String(v))}
          className="gap-1"
          placeholder="Choose a team member"
          isDisabled={candidates.length === 0}
          data-ui="transfer-candidate"
        >
          <Label>New owner</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {candidates.map((c) => (
                <ListBox.Item key={c.id} id={c.id} textValue={c.label}>
                  {c.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <Select
          fullWidth
          value={afterRole}
          onChange={(v) => setAfterRole(v === null ? null : String(v))}
          className="gap-1"
          data-ui="transfer-after-role"
        >
          <Label>Your role afterwards</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {afterRoles.map((r) => (
                <ListBox.Item key={r.id} id={r.id} textValue={r.label}>
                  {r.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <div className="rounded-xl border border-separator p-3.5 text-sm" data-ui="transfer-review">
          <p className="pb-1.5 font-medium">What will happen</p>
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-muted">
            <li>
              Nothing changes now. {who ?? "The new owner"} is asked to accept within 7 days, after signing in, with a
              verified identity and a code we email them.
            </li>
            <li>
              When they accept, {who ?? "they"} become{who ? "s" : ""} the owner: every permission, the plan and
              billing, and the right to transfer again.
            </li>
            <li>
              At that moment you stay on the team as {role ?? "the role you choose"}, with that role's permissions only.
            </li>
            <li>Until they answer, you can cancel the request. Every step is recorded in the audit log.</li>
          </ol>
        </div>
        <TeamRolesStepUp
          channel={stepUp}
          value={code}
          onChange={setCode}
          description="Requesting a transfer needs a code from the last ten minutes. It is checked when you press Request transfer."
        />
      </Modal.Body>
      <Modal.Footer className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="secondary" onPress={onClose}>
          Cancel
        </Button>
        <Button variant="danger" isDisabled={!ready} onPress={() => void submit()} data-ui="transfer-request">
          {busy ? "Requesting…" : "Request transfer"}
        </Button>
      </Modal.Footer>
    </>
  );
}
