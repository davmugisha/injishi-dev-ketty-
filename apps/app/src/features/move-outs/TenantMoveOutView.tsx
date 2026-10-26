"use client";

import { Alert, Toast, toast } from "@heroui/react";
import {
  MOVE_OUT_REASON_LABEL,
  MOVE_OUT_STAGE_LABEL,
  MoveOutStage,
  NOTICE_CHANNEL_LABEL,
  TENANT_MOVE_OUT_REASONS,
  type TenancyDetail,
  type TenancyMoveOut,
} from "@injishi/contracts";
import {
  ActionButton,
  BoundedDatePicker,
  ConfirmDialog,
  EmptyBlock,
  FlowStepper,
  FormDialog,
  formatDay,
  Icon,
  KeyValueList,
  Money,
  PageContent,
  PageHeader,
  SectionCard,
  SelectField,
  StatusChip,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { placeWords } from "../leases/shared";
import { TextInput } from "../rentals/fields";
import { disputeDeposit, giveNotice, withdrawNotice } from "./actions";
import { Breakdown } from "./MoveOutDialogs";

const STEPS = MoveOutStage.options.map((id) => ({ id, title: MOVE_OUT_STAGE_LABEL[id] }));

/**
 * The tenant's Moving out (WP 1.7): give notice (only the days the lease allows can be picked), where it
 * stands (Submitted, Acknowledged, Moved out, Deposit settled), withdraw it until the landlord
 * acknowledges it, and the deposit with its breakdown, which they can dispute once.
 */
export function TenantMoveOutView({ tenancy, view }: { tenancy: TenancyDetail; view: TenancyMoveOut }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"notice" | "withdraw" | "dispute" | null>(null);
  const [pending, start] = useTransition();
  const n = view.notice;
  const d = view.deposit;
  const current =
    view.stage === null ? 0 : view.stage === "settled" ? STEPS.length : STEPS.findIndex((s) => s.id === view.stage) + 1;

  const withdraw = () =>
    start(async () => {
      const r = await withdrawNotice(tenancy.id);
      if (!r.ok) {
        toast.danger(r.error);
        return;
      }
      toast.success("Notice withdrawn");
      setDialog(null);
      router.refresh();
    });

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <PageHeader
        eyebrow={placeWords(tenancy)}
        title="Moving out"
        actions={
          <>
            {view.canWithdraw ? (
              <ActionButton icon="ArrowUturnCcwLeft" intent="ghost" onPress={() => setDialog("withdraw")}>
                Withdraw notice
              </ActionButton>
            ) : null}
            {view.canGiveNotice ? (
              <ActionButton icon="ArrowRightFromSquare" intent="primary" onPress={() => setDialog("notice")}>
                Give notice
              </ActionButton>
            ) : null}
          </>
        }
      />

      {view.stage !== null ? (
        <SectionCard>
          <FlowStepper label="Moving out steps" steps={STEPS} current={current} />
        </SectionCard>
      ) : null}

      <div className="grid min-w-0 items-stretch gap-5 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Your notice"
          actions={
            n ? (
              <StatusChip kind="notice" status={n.status}>
                {n.status === "submitted" ? "Submitted" : undefined}
              </StatusChip>
            ) : null
          }
        >
          {n ? (
            <KeyValueList
              items={[
                { label: "Moving out on", value: formatDay(n.moveOutOn, "long") },
                { label: "Given on", value: `${formatDay(n.filedOn, "long")} · ${NOTICE_CHANNEL_LABEL[n.channel]}` },
                { label: "Reason", value: MOVE_OUT_REASON_LABEL[n.reasonCode] },
                ...(n.message ? [{ label: "Message", value: n.message }] : []),
                ...(n.givenBy === "landlord" ? [{ label: "From", value: "Your landlord" }] : []),
              ]}
            />
          ) : view.leaseStatus === "ended" ? (
            <p className="text-sm text-muted">
              You moved out on {view.endedOn ? formatDay(view.endedOn, "long") : "the last day"}.
            </p>
          ) : view.noticeNotNeeded ? (
            <EmptyBlock
              size="sm"
              icon="Calendar"
              title="No notice needed"
              description={`Your lease ends on ${formatDay(view.endDate, "long")}, within its ${view.noticeDays} days of notice.`}
            />
          ) : view.canGiveNotice ? (
            <EmptyBlock
              size="sm"
              icon="ArrowRightFromSquare"
              title="No notice given"
              // The header holds "Give notice": the page offers it once.
              description={`Give at least ${view.noticeDays} days of notice before you move out.`}
            />
          ) : (
            <p className="text-sm text-muted">Notice can be given once your tenancy has started.</p>
          )}
        </SectionCard>

        <SectionCard
          title="Deposit"
          actions={d ? <StatusChip kind="deposit" status={d.tenantDisputedAt ? "disputed" : d.status} /> : null}
        >
          {!d ? (
            <p className="text-sm text-muted">This lease has no deposit.</p>
          ) : d.status === "settled" ? (
            <div className="flex flex-col gap-3">
              <Breakdown deposit={d} />
              {d.tenantDisputedAt ? (
                <p className="text-xs text-muted">You said you do not agree: {d.disputeNote}</p>
              ) : view.canDispute ? (
                <ActionButton icon="CircleExclamation" intent="ghost" size="sm" onPress={() => setDialog("dispute")}>
                  I don&apos;t agree
                </ActionButton>
              ) : null}
            </div>
          ) : (
            <KeyValueList
              items={[
                { label: "Paid", value: <Money value={d.paidRwf} /> },
                { label: "Held by", value: tenancy.landlord.name },
                {
                  label: "Next",
                  value:
                    d.refundStatus === "waiting"
                      ? "Your refund is on its way."
                      : view.leaseStatus === "ended"
                        ? "Your landlord settles it now."
                        : "Settled after you move out.",
                },
              ]}
            />
          )}
        </SectionCard>
      </div>

      {dialog === "notice" && view.window ? (
        <NoticeDialog leaseId={tenancy.id} view={view} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "dispute" ? <DisputeDialog leaseId={tenancy.id} onClose={() => setDialog(null)} /> : null}
      <ConfirmDialog
        isOpen={dialog === "withdraw"}
        onOpenChange={(o) => (o ? undefined : setDialog(null))}
        title="Withdraw your notice?"
        confirmLabel="Withdraw notice"
        isPending={pending}
        onConfirm={withdraw}
      >
        Your lease runs on as before. Your landlord is told.
      </ConfirmDialog>
    </PageContent>
  );
}

function NoticeDialog({ leaseId, view, onClose }: { leaseId: string; view: TenancyMoveOut; onClose: () => void }) {
  const router = useRouter();
  const [day, setDay] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const window = view.window as { min: string; max: string };
  return (
    <FormDialog
      isOpen
      onOpenChange={(o) => (o ? undefined : onClose())}
      title="Give notice"
      submitLabel="Give notice"
      isPending={pending}
      formError={formError}
      footerHint="Your landlord gets an email. You can withdraw it until they acknowledge it."
      onSubmit={(e) => {
        e.preventDefault();
        const missing: Record<string, string> = {};
        if (!day) missing.moveOutOn = "Pick a date.";
        if (!reason) missing.reasonCode = "Pick a reason.";
        setErrors(missing);
        if (Object.keys(missing).length > 0) return;
        start(async () => {
          const r = await giveNotice(leaseId, { moveOutOn: day, reasonCode: reason, message: message || undefined });
          if (!r.ok) {
            setErrors(r.fieldErrors ?? {});
            setFormError(r.fieldErrors ? null : r.error);
            return;
          }
          toast.success("Notice given");
          onClose();
          router.refresh();
        });
      }}
    >
      <BoundedDatePicker
        label="Moving out on"
        value={day}
        onChange={(v) => {
          setDay(v);
          setErrors((x) => ({ ...x, moveOutOn: "" }));
        }}
        minValue={window.min}
        maxValue={window.max}
        description={`At least ${view.noticeDays} days from today, by ${formatDay(window.max, "long")}.`}
        errorMessage={errors.moveOutOn || null}
        isRequired
      />
      <SelectField
        label="Reason"
        options={TENANT_MOVE_OUT_REASONS.map((c) => ({ id: c, label: MOVE_OUT_REASON_LABEL[c] }))}
        value={reason}
        onChange={(v) => {
          setReason(v);
          setErrors((x) => ({ ...x, reasonCode: "" }));
        }}
        errorMessage={errors.reasonCode || null}
        isRequired
      />
      <TextInput label="Message to your landlord" name="message" value={message} onChange={setMessage} multiline />
    </FormDialog>
  );
}

function DisputeDialog({ leaseId, onClose }: { leaseId: string; onClose: () => void }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <FormDialog
      isOpen
      onOpenChange={(o) => (o ? undefined : onClose())}
      title="You don't agree"
      size="sm"
      submitLabel="Send"
      isPending={pending}
      onSubmit={(e) => {
        e.preventDefault();
        if (note.trim().length < 5) {
          setError("Say what you don't agree with.");
          return;
        }
        start(async () => {
          const r = await disputeDeposit(leaseId, { note });
          if (!r.ok) {
            setError(r.fieldErrors?.note ?? r.error);
            return;
          }
          toast.success("Your landlord was told");
          onClose();
          router.refresh();
        });
      }}
    >
      <Alert status="default">
        <Alert.Indicator>
          <Icon name="CircleInfo" />
        </Alert.Indicator>
        <Alert.Content>
          <Alert.Title>Your landlord gets your note by email.</Alert.Title>
        </Alert.Content>
      </Alert>
      <TextInput
        label="What is wrong"
        name="note"
        value={note}
        onChange={setNote}
        multiline
        errorMessage={error}
        isRequired
      />
    </FormDialog>
  );
}
