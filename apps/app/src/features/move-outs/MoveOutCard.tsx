"use client";

import {
  canSettleDeposit,
  canTakeNotice,
  type LeaseDetail,
  MOVE_OUT_REASON_LABEL,
  NOTICE_CHANNEL_LABEL,
} from "@injishi/contracts";
import { ActionButton, formatDay, KeyValueList, SectionCard, StatusChip } from "@injishi/ui";
import { useState } from "react";
import {
  AcknowledgeDialog,
  Breakdown,
  RecordMoveOutDialog,
  RecordNoticeDialog,
  SettleDepositPanel,
} from "./MoveOutDialogs";
import { daysLeftWords } from "./MoveOutsView";

/**
 * Moving out on the lease record (WP 1.7): the notice and where it stands, the moved-out day, the
 * deposit's settlement, and the one next step (record a notice, acknowledge, record the move out,
 * settle the deposit). Hidden on a lease that never ran.
 */
export function MoveOutCard({
  lease,
  today,
  can,
}: {
  lease: LeaseDetail;
  today: string;
  can: { manage: boolean; settle: boolean };
}) {
  const [open, setOpen] = useState<"notice" | "ack" | "moveout" | "settle" | null>(null);
  const n = lease.notice;
  const d = lease.deposit;
  const running = canTakeNotice(lease.status);
  if (!running && lease.status !== "ended") return null;
  if (running && !n && lease.status === "active" && !can.manage) return null;

  const days = n ? Math.round((Date.parse(n.moveOutOn) - Date.parse(today)) / 86_400_000) : null;
  let action = null;
  if (running && !n && can.manage) {
    action = (
      <ActionButton size="sm" icon="ArrowRightFromSquare" onPress={() => setOpen("notice")}>
        Record a notice
      </ActionButton>
    );
  } else if (n?.status === "submitted" && can.manage) {
    action = (
      <ActionButton size="sm" icon="CircleCheck" intent="primary" onPress={() => setOpen("ack")}>
        Acknowledge
      </ActionButton>
    );
  } else if (lease.status === "ending" && can.manage) {
    action = (
      <ActionButton size="sm" icon="ArrowRightFromSquare" onPress={() => setOpen("moveout")}>
        Record move out
      </ActionButton>
    );
  } else if (lease.status === "ended" && d && can.settle && canSettleDeposit(d, lease.status)) {
    action = (
      <ActionButton size="sm" icon="Vault" intent="primary" onPress={() => setOpen("settle")}>
        Settle deposit
      </ActionButton>
    );
  }

  return (
    <SectionCard
      title="Moving out"
      actions={
        <span className="flex items-center gap-2">
          {n && lease.status !== "ended" ? <StatusChip kind="notice" status={n.status} /> : null}
          {action}
        </span>
      }
    >
      {lease.status === "ended" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <KeyValueList
            items={[
              { label: "Moved out", value: lease.endedOn ? formatDay(lease.endedOn, "long") : "-" },
              ...(lease.endReason ? [{ label: "Why", value: lease.endReason }] : []),
              {
                label: "Deposit",
                value: d ? <StatusChip kind="deposit" status={d.tenantDisputedAt ? "disputed" : d.status} /> : "None",
              },
            ]}
          />
          {d?.status === "settled" ? <Breakdown deposit={d} /> : null}
        </div>
      ) : n ? (
        <KeyValueList
          items={[
            { label: "Moving out on", value: `${formatDay(n.moveOutOn, "long")} · ${daysLeftWords(days)}` },
            {
              label: "Given",
              value: `${formatDay(n.filedOn, "long")} · ${NOTICE_CHANNEL_LABEL[n.channel]}${n.givenBy === "landlord" ? " · by you" : ""}${n.isShortNotice ? " · short notice" : ""}`,
            },
            { label: "Reason", value: MOVE_OUT_REASON_LABEL[n.reasonCode] },
            ...(n.message ? [{ label: "Message", value: n.message }] : []),
          ]}
        />
      ) : (
        <p className="text-sm text-muted">
          {lease.status === "ending"
            ? `The lease ends on ${formatDay(lease.terms.endDate, "long")}.`
            : "No notice. A notice from the tenant on Injishi shows here."}
        </p>
      )}

      {open === "notice" ? (
        <RecordNoticeDialog
          leaseId={lease.id}
          startDate={lease.terms.startDate}
          endDate={lease.terms.endDate}
          today={today}
          onClose={() => setOpen(null)}
        />
      ) : null}
      {open === "ack" && n ? (
        <AcknowledgeDialog
          leaseId={lease.id}
          tenantName={lease.tenant.fullName}
          moveOutOn={n.moveOutOn}
          onClose={() => setOpen(null)}
        />
      ) : null}
      {open === "moveout" ? (
        <RecordMoveOutDialog
          leaseId={lease.id}
          tenantName={lease.tenant.fullName}
          startDate={lease.terms.startDate}
          today={today}
          suggested={n?.moveOutOn ?? lease.terms.endDate}
          onClose={() => setOpen(null)}
        />
      ) : null}
      {open === "settle" && d ? (
        <SettleDepositPanel
          deposit={d}
          tenantName={lease.tenant.fullName}
          tenantPhone={lease.tenant.phone ?? null}
          endedOn={lease.endedOn}
          today={today}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </SectionCard>
  );
}
