"use client";

import { ShieldKeyhole } from "@gravity-ui/icons";
import { Button, Modal, toast } from "@heroui/react";
import { useEffect, useState } from "react";
import type { OwnershipTransferInfo } from "@/server/ownership-transfer";
import {
  acceptTransferAction,
  declineTransferAction,
  myTransfersAction,
  sendOwnershipCodeAction,
} from "./OwnershipActions";
import { isCode } from "./TeamRolesModel";
import { TeamRolesStepUp } from "./TeamRolesPanel";

const day = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kigali",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));

/**
 * A request to become the owner of a business, on the screen of the person it names. It is read for whoever is signed
 * in (the API answers only requests addressed to them), shown as a notice, and decided in a dialog: what happens, then
 * the person's own email step-up code, then Accept or Decline. The API refuses unless the person is signed in as the
 * one named, identity-verified and stepped up within the last ten minutes; the request is decided once. Accepting
 * reloads the screen, so the new owner's permissions apply at once.
 */
export function OwnershipInbox() {
  const [transfers, setTransfers] = useState<OwnershipTransferInfo[]>([]);
  const [open, setOpen] = useState<OwnershipTransferInfo | null>(null);
  useEffect(() => {
    let live = true;
    void myTransfersAction().then((t) => {
      if (live) setTransfers(t);
    });
    return () => {
      live = false;
    };
  }, []);
  const first = transfers[0];
  if (!first) return null;
  return (
    <>
      <div
        data-ui="ownership-notice"
        role="status"
        className="mx-4 mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-[#f5c46b] bg-[#fff7e6] px-4 py-3 md:mx-7"
      >
        <ShieldKeyhole className="size-5 shrink-0 text-[#8a5a00]" aria-hidden="true" />
        <p className="min-w-0 flex-[1_1_280px] text-[13.5px] text-[#5c3d00]">
          <span className="font-semibold">{first.fromName}</span> asked to make you the owner of{" "}
          <span className="font-semibold">{first.legalName}</span>. Nothing changes unless you accept, by{" "}
          {day(first.expiresAt)}.
        </p>
        <Button size="sm" variant="primary" onPress={() => setOpen(first)} data-ui="ownership-review">
          Review
        </Button>
      </div>
      <Modal.Backdrop isOpen={open !== null} onOpenChange={(o) => (o ? null : setOpen(null))}>
        <Modal.Container placement="top" className="max-w-[540px]">
          <Modal.Dialog aria-labelledby="own-in-h" className="gap-4 p-6" data-ui="ownership-dialog">
            {open ? (
              <Decide
                transfer={open}
                onClose={() => setOpen(null)}
                onDecided={(id) => setTransfers((all) => all.filter((t) => t.id !== id))}
              />
            ) : null}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}

function Decide({
  transfer,
  onClose,
  onDecided,
}: {
  transfer: OwnershipTransferInfo;
  onClose: () => void;
  onDecided: (id: string) => void;
}) {
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);

  const send = async () => {
    setSending(true);
    try {
      const r = await sendOwnershipCodeAction();
      if (r.ok) {
        setSentTo(r.value.sentTo);
        toast.success(`Code sent to ${r.value.sentTo}`);
      } else toast.danger(r.message);
    } finally {
      setSending(false);
    }
  };
  const accept = async () => {
    setBusy("accept");
    try {
      const r = await acceptTransferAction(transfer.id, code);
      if (!r.ok) {
        toast.danger(r.message);
        return;
      }
      onDecided(transfer.id);
      onClose();
      toast.success(`You are now the owner of ${transfer.legalName}.`);
      // The new owner's permissions apply on the next request: load the screen again so every menu shows them.
      window.setTimeout(() => window.location.reload(), 1200);
    } finally {
      setBusy(null);
    }
  };
  const decline = async () => {
    setBusy("decline");
    try {
      const r = await declineTransferAction(transfer.id);
      if (!r.ok) {
        toast.danger(r.message);
        return;
      }
      onDecided(transfer.id);
      onClose();
      toast.success(`Declined. ${transfer.fromName} remains the owner of ${transfer.legalName}.`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Modal.Header className="flex flex-col items-start gap-1">
        <Modal.Heading id="own-in-h" className="text-lg leading-[26px] font-semibold">
          Become the owner of {transfer.legalName}?
        </Modal.Heading>
        <p className="text-sm text-muted">
          {transfer.fromName} asked on {day(transfer.requestedAt)}. The request expires on {day(transfer.expiresAt)}.
        </p>
      </Modal.Header>
      <Modal.Body className="flex flex-col gap-4">
        <div className="rounded-xl border border-separator p-3.5 text-sm" data-ui="ownership-review-text">
          <p className="pb-1.5 font-medium">If you accept</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-muted">
            <li>You become the owner: every permission, the plan and billing, and the right to transfer it again.</li>
            <li>
              {transfer.fromName} stays on the team as {transfer.previousOwnerRoleLabel}.
            </li>
            <li>It happens at once, and it is recorded in the audit log. Declining changes nothing.</li>
          </ul>
          <p className="pt-2 text-[12.5px] text-muted">
            Accepting needs a verified identity and a code we email you now.
          </p>
        </div>
        <TeamRolesStepUp
          channel={{ sentTo, sending, onSend: () => void send() }}
          value={code}
          onChange={setCode}
          description="The code is checked when you press Accept, and must be from the last ten minutes."
        />
      </Modal.Body>
      <Modal.Footer className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" onPress={onClose} isDisabled={busy !== null}>
          Not now
        </Button>
        <Button
          variant="danger-soft"
          onPress={() => void decline()}
          isDisabled={busy !== null}
          data-ui="ownership-decline"
        >
          {busy === "decline" ? "Declining…" : "Decline"}
        </Button>
        <Button
          variant="primary"
          onPress={() => void accept()}
          isDisabled={busy !== null || !isCode(code)}
          data-ui="ownership-accept"
        >
          {busy === "accept" ? "Accepting…" : "Accept ownership"}
        </Button>
      </Modal.Footer>
    </>
  );
}
