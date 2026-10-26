"use client";

import { toast } from "@heroui/react";
import { type LeaseDefaults as Defaults, ordinal } from "@injishi/contracts";
import { ActionButton, KeyValueList, SectionCard, SelectField, SidePanel } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveLeaseDefaults } from "../actions";
import { CountInput, fieldErrorsOnly, SwitchRow } from "../fields";

const START_DAY = "start";
const DUE_DAYS = [
  { id: START_DAY, label: "The day of the month the lease starts" },
  ...Array.from({ length: 28 }, (_, i) => ({ id: String(i + 1), label: `The ${ordinal(i + 1)} of each month` })),
];

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

function DefaultsPanel({ defaults, onClose }: { defaults: Defaults; onClose: () => void }) {
  const router = useRouter();
  const [dueDay, setDueDay] = useState<string>(defaults.rentDueDay === null ? START_DAY : String(defaults.rentDueDay));
  const [grace, setGrace] = useState<number | null>(defaults.graceDays);
  const [notice, setNotice] = useState<number | null>(defaults.noticeDays);
  const [autoStart, setAutoStart] = useState(defaults.autoStartLeases);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const result = await saveLeaseDefaults({
        rentDueDay: dueDay === START_DAY ? null : Number(dueDay),
        graceDays: grace,
        noticeDays: notice,
        autoStartLeases: autoStart,
      });
      if (!result.ok) {
        setErrors(fieldErrorsOnly(result.fieldErrors));
        setFormError(result.fieldErrors ? null : result.error);
        return;
      }
      toast.success("Lease defaults saved");
      onClose();
      router.refresh();
    });

  return (
    <SidePanel
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title="Lease defaults"
      description="New leases start from these."
      submitLabel="Save"
      isPending={pending}
      validationErrors={errors}
      formError={formError}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <SelectField
        label="Rent is due on"
        name="rentDueDay"
        options={DUE_DAYS}
        value={dueDay}
        onChange={setDueDay}
        errorMessage={errors.rentDueDay}
      />
      <CountInput
        label="Late after"
        name="graceDays"
        value={grace}
        onChange={setGrace}
        minValue={0}
        maxValue={31}
        unit="days"
        description="Days after the due day before rent counts as overdue."
        isRequired
      />
      <CountInput
        label="Notice to move out"
        name="noticeDays"
        value={notice}
        onChange={setNotice}
        minValue={15}
        maxValue={180}
        unit="days"
        description="At least 15 days."
        isRequired
      />
      <SwitchRow
        label="Start tenancies on their start date"
        description="Otherwise you start each one yourself."
        isSelected={autoStart}
        onChange={setAutoStart}
      />
    </SidePanel>
  );
}

/** What a new lease starts from: the due day, the grace days, the notice, and whether it starts itself. */
export function LeaseDefaults({ defaults, canEdit }: { defaults: Defaults; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  return (
    <SectionCard
      title="New leases start with"
      description={defaults.setAt ? undefined : "Check these before your first lease."}
      actions={
        canEdit ? (
          <ActionButton
            icon="PencilToSquare"
            size="sm"
            intent={defaults.setAt ? "secondary" : "primary"}
            onPress={() => setEditing(true)}
          >
            {defaults.setAt ? "Edit" : "Check and save"}
          </ActionButton>
        ) : null
      }
    >
      <KeyValueList
        items={[
          {
            label: "Rent due",
            value:
              defaults.rentDueDay === null
                ? "The day the lease starts"
                : `The ${ordinal(defaults.rentDueDay)} of each month`,
          },
          { label: "Late after", value: days(defaults.graceDays) },
          { label: "Notice", value: days(defaults.noticeDays) },
          { label: "Tenancies start", value: defaults.autoStartLeases ? "On their start date" : "When you start them" },
        ]}
      />
      {editing ? <DefaultsPanel defaults={defaults} onClose={() => setEditing(false)} /> : null}
    </SectionCard>
  );
}
