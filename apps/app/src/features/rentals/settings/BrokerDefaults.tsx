"use client";

import { toast } from "@heroui/react";
import { type BrokerFeeTerms, brokerFeeWords } from "@injishi/contracts";
import { ActionButton, ConfirmDialog, KeyValueList, SectionCard, SidePanel } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveBrokerDefaults } from "../actions";
import { BrokerFeeFields, feeDraftOf, feeTermsOf } from "../BrokerFeeFields";
import { fieldErrorsOnly } from "../fields";

function FeePanel({ fee, onClose }: { fee: BrokerFeeTerms | null; onClose: () => void }) {
  const router = useRouter();
  const [draft, setDraft] = useState(feeDraftOf(fee));
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      const terms = feeTermsOf(draft);
      if (!terms) {
        setError("Enter the fee.");
        return;
      }
      const result = await saveBrokerDefaults({ fee: terms });
      if (!result.ok) {
        const fields = fieldErrorsOnly(result.fieldErrors);
        setError(Object.entries(fields).find(([k]) => k.startsWith("fee"))?.[1] ?? null);
        setFormError(result.fieldErrors ? null : result.error);
        return;
      }
      toast.success("Broker fee saved");
      onClose();
      router.refresh();
    });
  return (
    <SidePanel
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title="Broker fee"
      description="Units open to brokers start with this fee."
      submitLabel="Save"
      isPending={pending}
      formError={formError}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <BrokerFeeFields value={draft} onChange={setDraft} errorMessage={error} />
    </SidePanel>
  );
}

/** The broker fee a unit starts with when the landlord lets brokers offer it (2026-10-25). */
export function BrokerDefaults({ fee, canEdit }: { fee: BrokerFeeTerms | null; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [pending, start] = useTransition();
  const clear = () =>
    start(async () => {
      const result = await saveBrokerDefaults({ fee: null });
      if (!result.ok) {
        toast.danger(result.error);
        return;
      }
      setClearing(false);
      toast.success("Broker fee cleared");
      router.refresh();
    });
  return (
    <SectionCard
      title="Broker fee"
      description={fee ? undefined : "Set the fee brokers earn when they bring a tenant."}
      actions={
        canEdit ? (
          <div className="flex gap-2">
            {fee ? (
              <ActionButton icon="TrashBin" size="sm" intent="ghost" onPress={() => setClearing(true)}>
                Clear
              </ActionButton>
            ) : null}
            <ActionButton
              icon="PencilToSquare"
              size="sm"
              intent={fee ? "secondary" : "primary"}
              onPress={() => setEditing(true)}
            >
              {fee ? "Edit" : "Set fee"}
            </ActionButton>
          </div>
        ) : null
      }
    >
      <KeyValueList
        items={[
          { label: "Default fee", value: fee ? brokerFeeWords(fee) : "Not set" },
          { label: "Paid", value: "Outside Injishi, recorded on the lease" },
        ]}
      />
      {editing ? <FeePanel fee={fee} onClose={() => setEditing(false)} /> : null}
      <ConfirmDialog
        isOpen={clearing}
        onOpenChange={setClearing}
        title="Clear the broker fee?"
        confirmLabel="Clear fee"
        intent="danger"
        isPending={pending}
        onConfirm={clear}
      >
        Units keep the fee they have.
      </ConfirmDialog>
    </SectionCard>
  );
}
