"use client";

import { Alert, toast } from "@heroui/react";
import {
  EXPENSE_METHOD_LABEL,
  EXPENSE_SOURCE_LABEL,
  FAULT_CATEGORY_LABEL,
  FAULT_PAYMENT_STATUS_LABEL,
  FAULT_URGENCY_LABEL,
  type FaultDetail,
  type OperatorTeamMember,
} from "@injishi/contracts";
import {
  ActionButton,
  DateText,
  EmptyBlock,
  ErrorBlock,
  EventTimeline,
  formatPhone,
  Icon,
  KeyValueList,
  LoadingBlock,
  Money,
  PhotoGallery,
  SectionHeader,
  SidePanel,
  StatusChip,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { SwitchRow, TextInput } from "../rentals/fields";
import { loadFault, replyOnFault } from "./actions";
import { AssignDialog, MoveDialog, PayFixerDialog } from "./FaultDialogs";
import { faultTimeline, PAYMENT_TONE } from "./shared";

type Dialog = "move" | "assign" | "pay" | null;

/**
 * One fault, beside the list: its photos (point or tap to zoom), the facts, the timeline with who did
 * what, a reply the tenant reads (or a note for the team), what was paid for the fix, and the moves
 * the chain allows from here, the assignment and paying the fixer.
 */
export function FaultPanel({
  faultId,
  team,
  canPay,
  canReply,
  onClose,
}: {
  faultId: string;
  team: OperatorTeamMember[] | null;
  canPay: boolean;
  canReply: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [fault, setFault] = useState<FaultDetail | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reply, setReply] = useState("");
  const [toTenant, setToTenant] = useState(true);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [sending, start] = useTransition();

  const load = useCallback(async () => {
    setFailed(null);
    const r = await loadFault(faultId);
    if (!r.ok) {
      setFailed(r.error);
      return;
    }
    setFault(r.value);
  }, [faultId]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = () =>
    start(async () => {
      if (!reply.trim()) {
        setReplyError("Write a message.");
        return;
      }
      const r = await replyOnFault(faultId, { body: reply.trim(), visibleToTenant: toTenant });
      if (!r.ok) {
        setReplyError(r.fieldErrors?.body ?? r.error);
        return;
      }
      setFault(r.value);
      setReply("");
      toast.success(toTenant ? "Reply sent to the tenant" : "Note added for the team");
      router.refresh();
    });

  const changed = useCallback((f: FaultDetail) => setFault(f), []);
  const settled = fault ? ["closed", "cancelled"].includes(fault.status) : false;

  const facts = fault
    ? [
        { label: "Kind", value: fault.category ? FAULT_CATEGORY_LABEL[fault.category] : "Not said" },
        { label: "How urgent", value: FAULT_URGENCY_LABEL[fault.urgency] },
        {
          label: "Reported",
          value: (
            <span>
              <DateText value={fault.reportedAt} style="long" />
              {fault.reportedBy === "tenant" ? " by the tenant" : " by your side"}
            </span>
          ),
        },
        ...(fault.tenantName ? [{ label: "Tenant", value: fault.tenantName }] : []),
        {
          label: "May come in",
          value:
            fault.staffMayEnter === null
              ? "Not said"
              : fault.staffMayEnter
                ? "Yes, when nobody is home"
                : "Only when someone is home",
        },
        {
          label: "Fixing it",
          value: fault.assignee
            ? [fault.assignee.name, fault.assignee.phone ? formatPhone(fault.assignee.phone) : null]
                .filter(Boolean)
                .join(" · ")
            : "Nobody yet",
        },
        ...(fault.reopenUntil
          ? [
              {
                label: "Tenant may reopen",
                value: (
                  <span>
                    Until <DateText value={fault.reopenUntil} style="long" />
                  </span>
                ),
              },
            ]
          : []),
        ...(fault.reopenedCount > 0
          ? [{ label: "Reopened", value: fault.reopenedCount === 1 ? "Once" : `${fault.reopenedCount} times` }]
          : []),
      ]
    : [];

  return (
    <>
      <SidePanel
        isOpen
        onOpenChange={(open) => (open ? undefined : onClose())}
        title={fault?.title ?? "Fault"}
        description={
          fault
            ? [fault.reference, fault.unitLabel ? `Unit ${fault.unitLabel}` : null, fault.propertyName]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
        headerExtra={fault ? <StatusChip kind="fault" status={fault.status} size="md" /> : null}
        size="lg"
        footer={
          fault ? (
            <>
              {canPay && fault.status !== "cancelled" ? (
                <ActionButton icon="Wallet" onPress={() => setDialog("pay")}>
                  Pay the fixer
                </ActionButton>
              ) : null}
              {!settled ? (
                <ActionButton icon="PersonWorker" onPress={() => setDialog("assign")}>
                  {fault.assignee ? "Reassign" : "Assign"}
                </ActionButton>
              ) : null}
              {fault.allowedMoves.length > 0 ? (
                <ActionButton icon="ArrowRight" intent="primary" onPress={() => setDialog("move")}>
                  Move to
                </ActionButton>
              ) : null}
            </>
          ) : undefined
        }
      >
        {failed ? (
          <ErrorBlock title="Couldn't load the fault" description={failed} onRetry={() => void load()} />
        ) : !fault ? (
          <LoadingBlock shape="list" label="fault" rows={5} />
        ) : (
          <div className="flex min-h-0 flex-col gap-5 overflow-y-auto [&>*]:shrink-0">
            {fault.status === "wont_fix" && fault.wontFixReason ? (
              <Alert status="warning">
                <Alert.Indicator>
                  <Icon name="TriangleExclamation" />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Won't fix</Alert.Title>
                  <Alert.Description>{fault.wontFixReason}</Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}
            <PhotoGallery
              photos={fault.photos.map((p) => ({ url: p.url, alt: fault.title }))}
              label={fault.title}
              empty={<EmptyBlock icon="Picture" title="No photos" size="sm" />}
            />
            {fault.description ? <p className="text-sm text-pretty whitespace-pre-line">{fault.description}</p> : null}
            <KeyValueList items={facts} />

            {fault.payments !== null ? (
              <section className="flex flex-col gap-2" aria-labelledby="fault-payments">
                <SectionHeader
                  id="fault-payments"
                  title="Paid for the fix"
                  description={fault.paidRwf ? undefined : "Nothing paid yet."}
                  action={fault.paidRwf ? <Money value={fault.paidRwf} className="font-semibold" /> : undefined}
                />
                {fault.payments.length > 0 ? (
                  <ul className="flex flex-col divide-y divide-separator rounded-xl border border-separator">
                    {fault.payments.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="text-sm font-medium">{p.payeeName ?? "Fixer"}</span>
                          <span className="text-xs text-muted">
                            {[
                              EXPENSE_SOURCE_LABEL[p.source],
                              p.destination ?? (p.method ? EXPENSE_METHOD_LABEL[p.method] : null),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                            {p.paidOn ? (
                              <>
                                {" · "}
                                <DateText value={p.paidOn} />
                              </>
                            ) : null}
                            {p.failureReason ? ` · ${p.failureReason}` : null}
                          </span>
                        </div>
                        {p.receiptUrl ? (
                          <a
                            href={p.receiptUrl}
                            download="receipt"
                            target="_blank"
                            rel="noopener"
                            className="text-xs text-accent hover:underline"
                          >
                            Receipt
                          </a>
                        ) : null}
                        <Money value={p.amountRwf} className="text-sm font-medium" />
                        <StatusChip tone={PAYMENT_TONE[p.status]}>{FAULT_PAYMENT_STATUS_LABEL[p.status]}</StatusChip>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}

            <section className="flex flex-col gap-2" aria-labelledby="fault-history">
              <SectionHeader id="fault-history" title="Timeline" />
              <EventTimeline label="Fault history" events={faultTimeline(fault.events, { showVisibility: true })} />
            </section>

            {canReply && fault.status !== "cancelled" ? (
              <form
                className="flex flex-col gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  send();
                }}
              >
                <TextInput
                  label="Reply"
                  name="body"
                  value={reply}
                  onChange={(v) => {
                    setReply(v);
                    setReplyError(null);
                  }}
                  placeholder={toTenant ? "The plumber comes tomorrow at 9." : "A note only your team sees"}
                  errorMessage={replyError}
                  multiline
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <SwitchRow label="The tenant sees this" isSelected={toTenant} onChange={setToTenant} />
                  </div>
                  <ActionButton type="submit" icon="PaperPlane" size="sm" isPending={sending}>
                    {toTenant ? "Send" : "Add note"}
                  </ActionButton>
                </div>
              </form>
            ) : null}
          </div>
        )}
      </SidePanel>
      {fault && dialog === "move" ? (
        <MoveDialog
          fault={fault}
          onClose={() => setDialog(null)}
          onMoved={(f) => {
            setFault(f);
            setDialog(null);
          }}
        />
      ) : null}
      {fault && dialog === "assign" ? (
        <AssignDialog
          fault={fault}
          team={team}
          onClose={() => setDialog(null)}
          onAssigned={(f) => {
            setFault(f);
            setDialog(null);
          }}
        />
      ) : null}
      {fault && dialog === "pay" ? (
        <PayFixerDialog fault={fault} onClose={() => setDialog(null)} onChanged={changed} />
      ) : null}
    </>
  );
}
