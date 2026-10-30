"use client";

import { Button, Label, ListBox, Modal, Select } from "@heroui/react";
import { useState } from "react";
import { TeamRolesStepUp } from "./TeamRolesPanel";

interface TeamRolesTransferOption {
  id: string;
  label: string;
}

/**
 * Transfer Ownership dialog (artifact: .ij-dialog "Transfer Ownership"). Not available yet: ownership changes hands
 * through the owner claim, which checks the new owner's identity document, and the platform has no transfer request.
 * So the step-up takes no code and "Request transfer" stays disabled with the reason beside it.
 */
export function TeamRolesTransfer({
  isOpen,
  onClose,
  candidates,
  afterRoles,
}: {
  isOpen: boolean;
  onClose: () => void;
  candidates: TeamRolesTransferOption[];
  afterRoles: TeamRolesTransferOption[];
}) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => (open ? null : onClose())}>
      <Modal.Container placement="top" className="max-w-[520px]">
        <Modal.Dialog aria-labelledby="tr-h" className="gap-4 p-6">
          {isOpen ? <TransferBody candidates={candidates} afterRoles={afterRoles} onClose={onClose} /> : null}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function TransferBody({
  candidates,
  afterRoles,
  onClose,
}: {
  candidates: TeamRolesTransferOption[];
  afterRoles: TeamRolesTransferOption[];
  onClose: () => void;
}) {
  const [candidate, setCandidate] = useState<string | null>(candidates[0]?.id ?? null);
  const [afterRole, setAfterRole] = useState<string | null>(afterRoles[0]?.id ?? null);
  return (
    <>
      <Modal.Header className="flex flex-col items-start gap-1">
        <Modal.Heading id="tr-h" className="text-lg leading-[26px] font-semibold">
          Transfer Ownership
        </Modal.Heading>
        <p className="text-sm text-muted">
          The new owner gets every permission, plan and billing, and the right to transfer again. It takes effect only
          when they accept with verified identity.
        </p>
      </Modal.Header>
      <Modal.Body className="flex flex-col gap-4 overflow-visible">
        <Select
          fullWidth
          value={candidate}
          onChange={(v) => setCandidate(v === null ? null : String(v))}
          className="gap-1"
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
        <TeamRolesStepUp
          channel={null}
          value=""
          onChange={() => undefined}
          description="Not asked for: requesting a transfer is not available yet."
        />
      </Modal.Body>
      <Modal.Footer className="flex flex-wrap items-center justify-end gap-2">
        <span id="tr-why" className="mr-auto max-w-[300px] text-xs leading-4 text-muted">
          Ownership transfer is not available yet. It will go through the owner claim, which checks an ID.
        </span>
        <Button variant="secondary" onPress={onClose}>
          Cancel
        </Button>
        <Button variant="danger" isDisabled aria-describedby="tr-why">
          Request transfer
        </Button>
      </Modal.Footer>
    </>
  );
}
