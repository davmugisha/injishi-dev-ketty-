"use client";

import { toast } from "@heroui/react";
import { type BrokerFeeRecordStatus, brokerFeeWords, type LeaseDetail } from "@injishi/contracts";
import {
  ActionButton,
  ConfirmDialog,
  DateText,
  FormDialog,
  formatLocalPhone,
  KeyValueList,
  Money,
  SectionCard,
  SidePanel,
  StarInput,
  Stars,
  StatusChip,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { feeDraftOf, feeTermsOf } from "../rentals/BrokerFeeFields";
import { TextInput } from "../rentals/fields";
import { editLease } from "./actions";
import { type BrokerDraft, BrokerPicker, noBroker } from "./BrokerPicker";
import { rateBroker, setBrokerFeePaid } from "./broker-actions";
import { editable } from "./shared";

const FEE_CHIP: Record<BrokerFeeRecordStatus, { tone: "warning" | "success" | "default"; label: string }> = {
  owed: { tone: "warning", label: "Owed" },
  paid: { tone: "success", label: "Paid" },
  void: { tone: "default", label: "Void" },
};

function draftOf(lease: LeaseDetail): BrokerDraft {
  const b = lease.broker;
  if (!b) return noBroker();
  return {
    on: true,
    broker: { id: b.id, name: b.name, phone: b.phone },
    placementId: b.placementId,
    fee: feeDraftOf(b.fee?.terms),
  };
}

/** Name, change or take off the broker on a lease that can still change. */
function BrokerPanel({ lease, onClose }: { lease: LeaseDetail; onClose: () => void }) {
  const router = useRouter();
  const [draft, setDraft] = useState<BrokerDraft>(() => draftOf(lease));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      if (draft.on && !draft.broker) {
        setErrors({ brokerId: "Pick the broker, or switch this off." });
        return;
      }
      if (!draft.on && !lease.broker) {
        onClose();
        return;
      }
      const fee = feeTermsOf(draft.fee);
      const result = await editLease(
        lease.id,
        draft.on && draft.broker
          ? { brokerId: draft.broker.id, placementId: draft.placementId, ...(fee ? { brokerFee: fee } : {}) }
          : { brokerId: null },
      );
      if (!result.ok) {
        const fields = result.fieldErrors ?? {};
        const fee = Object.entries(fields).find(([k]) => k.startsWith("brokerFee"))?.[1];
        setErrors({ ...fields, ...(fee ? { brokerFee: fee } : {}) });
        setFormError(Object.keys(fields).length > 0 ? null : result.error);
        return;
      }
      toast.success(draft.on ? "Broker saved" : "Broker taken off the lease");
      onClose();
      router.refresh();
    });
  return (
    <SidePanel
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title="Broker"
      description="Leave the fee empty to use the unit's fee."
      submitLabel="Save"
      isPending={pending}
      formError={formError}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <BrokerPicker
        value={draft}
        onChange={setDraft}
        unitId={lease.unit.id}
        unitFee={null}
        rentRwf={lease.terms.monthlyRentRwf}
        errors={errors}
      />
    </SidePanel>
  );
}

function RateDialog({ lease, onClose }: { lease: LeaseDetail; onClose: () => void }) {
  const router = useRouter();
  const [stars, setStars] = useState(lease.broker?.rating?.stars ?? 0);
  const [comment, setComment] = useState(lease.broker?.rating?.comment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      if (stars < 1) {
        setError("Pick 1 to 5 stars.");
        return;
      }
      const result = await rateBroker(lease.id, { stars, comment: comment.trim() || null });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Rating saved");
      onClose();
      router.refresh();
    });
  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={`Rate ${lease.broker?.name ?? "the broker"}`}
      size="sm"
      submitLabel="Save rating"
      isPending={pending}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <StarInput value={stars} onChange={setStars} error={error ?? undefined} />
      <TextInput label="Comment" name="comment" value={comment} onChange={setComment} multiline />
    </FormDialog>
  );
}

/**
 * The broker who brought the tenant (2026-10-25): who, the fee agreed as a record (owed until marked
 * paid; the money moves outside Injishi), and the landlord's rating once the tenancy has started.
 */
export function LeaseBrokerCard({
  lease,
  canManage: mayManage,
  marketplaceOn,
}: {
  lease: LeaseDetail;
  canManage: boolean;
  /**
   * Whether Marketplace is on for this business. Choosing a broker, the fee and the rating are its broker
   * network's routes, so while it is off the card only shows the broker already named (ADR-076 G14).
   */
  marketplaceOn: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<"edit" | "fee" | "rate" | null>(null);
  const [pending, start] = useTransition();
  const broker = lease.broker;
  const canManage = mayManage && marketplaceOn;
  const changeable = canManage && editable(lease.status);
  if (!broker && !changeable) return null;

  const fee = broker?.fee ?? null;
  const markPaid = fee?.status === "owed";
  const toggleFee = () =>
    start(async () => {
      const result = await setBrokerFeePaid(lease.id, markPaid);
      if (!result.ok) {
        toast.danger(result.error);
        return;
      }
      setOpen(null);
      toast.success(markPaid ? "Fee marked paid" : "Fee marked owed");
      router.refresh();
    });

  return (
    <SectionCard
      title="Broker"
      actions={
        fee ? (
          <StatusChip tone={FEE_CHIP[fee.status].tone}>{FEE_CHIP[fee.status].label}</StatusChip>
        ) : changeable && !broker ? (
          <ActionButton icon="Plus" size="sm" onPress={() => setOpen("edit")}>
            Add broker
          </ActionButton>
        ) : null
      }
      footer={
        broker && canManage && (changeable || (fee && fee.status !== "void") || broker.canRate) ? (
          <div className="flex flex-wrap gap-2">
            {changeable ? (
              <ActionButton icon="PencilToSquare" size="sm" onPress={() => setOpen("edit")}>
                Change
              </ActionButton>
            ) : null}
            {fee && fee.status !== "void" ? (
              <ActionButton
                icon={markPaid ? "CircleCheck" : "ArrowRotateLeft"}
                size="sm"
                onPress={() => setOpen("fee")}
              >
                {markPaid ? "Mark paid" : "Mark owed"}
              </ActionButton>
            ) : null}
            {broker.canRate ? (
              <ActionButton icon="Star" size="sm" onPress={() => setOpen("rate")}>
                {broker.rating ? "Change rating" : "Rate broker"}
              </ActionButton>
            ) : null}
          </div>
        ) : undefined
      }
    >
      {broker ? (
        <KeyValueList
          items={[
            { label: "Name", value: broker.name ?? "A broker" },
            ...(broker.phone
              ? [
                  {
                    label: "Phone",
                    value: (
                      <a href={`tel:${broker.phone}`} className="tabular hover:underline">
                        {formatLocalPhone(broker.phone)}
                      </a>
                    ),
                  },
                ]
              : []),
            {
              label: "Fee",
              value: fee ? (
                <span className="flex flex-col">
                  <Money value={fee.amountRwf} />
                  <span className="text-xs text-muted">
                    {fee.terms.kind === "percent" ? brokerFeeWords(fee.terms) : "Fixed"}
                    {fee.paidAt ? (
                      <>
                        {" · paid "}
                        <DateText value={fee.paidAt} />
                      </>
                    ) : null}
                  </span>
                </span>
              ) : (
                <span className="text-muted">None agreed</span>
              ),
            },
            ...(broker.rating ? [{ label: "Your rating", value: <Stars value={broker.rating.stars} /> }] : []),
          ]}
        />
      ) : (
        <p className="text-sm text-muted">Did a broker bring this tenant?</p>
      )}
      {fee && fee.status !== "void" ? <p className="text-xs text-muted">Paid outside Injishi.</p> : null}
      {open === "edit" ? <BrokerPanel lease={lease} onClose={() => setOpen(null)} /> : null}
      {open === "rate" ? <RateDialog lease={lease} onClose={() => setOpen(null)} /> : null}
      <ConfirmDialog
        isOpen={open === "fee"}
        onOpenChange={(o) => setOpen(o ? "fee" : null)}
        title={markPaid ? "Mark the broker fee paid?" : "Mark the broker fee owed again?"}
        confirmLabel={markPaid ? "Mark paid" : "Mark owed"}
        isPending={pending}
        onConfirm={toggleFee}
      >
        {fee
          ? `${brokerFeeWords({ kind: "fixed", amountRwf: fee.amountRwf })} to ${broker?.name ?? "the broker"}.`
          : null}
      </ConfirmDialog>
    </SectionCard>
  );
}
