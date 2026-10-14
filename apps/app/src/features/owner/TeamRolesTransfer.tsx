"use client";

import { Button, Label, ListBox, Modal, Select } from "@heroui/react";
import { useState } from "react";
import { isCode } from "./TeamRolesModel";
import { TeamRolesStepUp } from "./TeamRolesPanel";

export interface TeamRolesTransferOption {
  id: string;
  label: string;
}

/** Transfer Ownership dialog (artifact: .ij-dialog "Transfer Ownership"). */
export function TeamRolesTransfer({
  isOpen,
  onClose,
  candidates,
  afterRoles,
  phone,
  onRequest,
}: {
  isOpen: boolean;
  onClose: () => void;
  candidates: TeamRolesTransferOption[];
  afterRoles: TeamRolesTransferOption[];
  phone: string;
  onRequest: (candidateId: string, afterRoleId: string) => void;
}) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => (open ? null : onClose())}>
      <Modal.Container placement="top" className="max-w-[520px]">
        <Modal.Dialog aria-labelledby="tr-h" className="gap-4 p-6">
          {isOpen ? (
            <TransferBody
              candidates={candidates}
              afterRoles={afterRoles}
              phone={phone}
              onClose={onClose}
              onRequest={onRequest}
            />
          ) : null}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function TransferBody({
  candidates,
  afterRoles,
  phone,
  onClose,
  onRequest,
}: {
  candidates: TeamRolesTransferOption[];
  afterRoles: TeamRolesTransferOption[];
  phone: string;
  onClose: () => void;
  onRequest: (candidateId: string, afterRoleId: string) => void;
}) {
  const [candidate, setCandidate] = useState<string | null>(candidates[0]?.id ?? null);
  const [afterRole, setAfterRole] = useState<string | null>(afterRoles[0]?.id ?? null);
  const [code, setCode] = useState("");
  const ready = isCode(code) && !!candidate && !!afterRole;
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
        <TeamRolesStepUp phone={phone} value={code} onChange={setCode} />
      </Modal.Body>
      <Modal.Footer className="flex justify-end gap-2">
        <Button variant="secondary" onPress={onClose}>
          Cancel
        </Button>
        <Button
          variant="danger"
          isDisabled={!ready}
          onPress={() => candidate && afterRole && onRequest(candidate, afterRole)}
        >
          Request transfer
        </Button>
      </Modal.Footer>
    </>
  );
}
