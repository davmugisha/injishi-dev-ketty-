"use client";

import { Description, Label, toast } from "@heroui/react";
import { RadioButtonGroup } from "@heroui-pro/react";
import { ID_KIND_LABEL, type IdKind, type LandlordSignatory, nationalPhone } from "@injishi/contracts";
import { ActionButton, EmailInput, Icon, KeyValueList, PhoneInput, SectionCard, SidePanel } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveSignatory } from "../actions";
import { fieldErrorsOnly, TextInput } from "../fields";

function SignatoryPanel({ signatory, onClose }: { signatory: LandlordSignatory; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(signatory.name ?? "");
  const [idKind, setIdKind] = useState<IdKind>(signatory.idKind ?? "national_id");
  const [idNumber, setIdNumber] = useState(signatory.idNumber ?? "");
  const [phone, setPhone] = useState<string | null>(signatory.contactPhone);
  const [phoneText, setPhoneText] = useState(signatory.contactPhone ?? "");
  const [email, setEmail] = useState(signatory.contactEmail ?? "");
  const [keepEmail, setKeepEmail] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const result = await saveSignatory({
        name,
        idKind,
        idNumber,
        contactPhone: phone ?? phoneText,
        contactEmail: email,
        ...(keepEmail ? { confirmEmail: true } : {}),
      });
      if (!result.ok) {
        setErrors(fieldErrorsOnly(result.fieldErrors));
        setFormError(result.fieldErrors ? null : result.error);
        return;
      }
      toast.success("Signatory saved");
      onClose();
      router.refresh();
    });

  return (
    <SidePanel
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title="Who signs leases"
      description="Contracts name this person, and tenants reach you here."
      submitLabel="Save"
      isPending={pending}
      validationErrors={errors}
      formError={formError}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <TextInput
        label="Full name"
        name="name"
        value={name}
        onChange={setName}
        description="As on the ID. They type it to sign."
        isRequired
      />
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">ID document</span>
        <RadioButtonGroup
          aria-label="ID document"
          layout="grid"
          value={idKind}
          onChange={(v) => setIdKind(v === "passport" ? "passport" : "national_id")}
          className="grid-cols-2 gap-2.5"
        >
          {(["national_id", "passport"] as const).map((k) => (
            <RadioButtonGroup.Item key={k} value={k} className="gap-1 px-3.5 py-3">
              <RadioButtonGroup.Indicator>
                <Icon name="CircleCheckFill" />
              </RadioButtonGroup.Indicator>
              <RadioButtonGroup.ItemContent>
                <Label className="font-semibold">{ID_KIND_LABEL[k]}</Label>
                <Description className="text-xs">
                  {k === "national_id" ? "16 digits" : "Letters and digits"}
                </Description>
              </RadioButtonGroup.ItemContent>
            </RadioButtonGroup.Item>
          ))}
        </RadioButtonGroup>
      </div>
      <TextInput
        label={idKind === "passport" ? "Passport number" : "ID number"}
        name="idNumber"
        value={idNumber}
        onChange={setIdNumber}
        inputMode={idKind === "passport" ? "text" : "numeric"}
        isRequired
      />
      <PhoneInput
        label="Phone"
        name="contactPhone"
        value={phone}
        onChange={(e164, text) => {
          setPhone(e164);
          setPhoneText(text);
        }}
        errorMessage={errors.contactPhone}
        isRequired
      />
      <EmailInput
        label="Email"
        name="contactEmail"
        value={email}
        onChange={setEmail}
        onTypoChange={(t) => setKeepEmail(t.kept)}
        errorMessage={errors.contactEmail}
        isRequired
      />
    </SidePanel>
  );
}

/** Who signs leases for the business, and the contact tenants see. */
export function Signatory({ signatory, canEdit }: { signatory: LandlordSignatory; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const set = Boolean(signatory.name && signatory.idNumber);
  return (
    <SectionCard
      title="Signatory"
      description={set ? "Named on every contract you sign." : "Say who signs leases for the business."}
      actions={
        canEdit ? (
          <ActionButton
            icon="PencilToSquare"
            size="sm"
            intent={set ? "secondary" : "primary"}
            onPress={() => setEditing(true)}
          >
            {set ? "Edit" : "Add signatory"}
          </ActionButton>
        ) : null
      }
    >
      {set ? (
        <KeyValueList
          items={[
            { label: "Name", value: signatory.name },
            {
              label: signatory.idKind ? ID_KIND_LABEL[signatory.idKind] : "ID",
              value: <span className="tabular">{signatory.idNumber}</span>,
            },
            {
              label: "Phone",
              value: signatory.contactPhone ? (
                <span className="tabular">{nationalPhone(signatory.contactPhone)}</span>
              ) : (
                "Not set"
              ),
            },
            { label: "Email", value: signatory.contactEmail ?? "Not set" },
          ]}
        />
      ) : (
        <p className="text-sm text-muted">{canEdit ? "Nobody yet." : "Nobody yet. The owner sets this."}</p>
      )}
      {editing ? <SignatoryPanel signatory={signatory} onClose={() => setEditing(false)} /> : null}
    </SectionCard>
  );
}
