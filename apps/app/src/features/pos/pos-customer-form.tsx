"use client";

import { Checkbox, Input, Label, TextArea, TextField } from "@heroui/react";
import { type CustomerForm, storedPhone } from "./customer-form";

/** The fields of one customer, shared by "New customer", "Edit customer" and the quick-register inside the order's customer picker. */
export function CustomerFormFields({
  value,
  onChange,
  withNotes = true,
  disabled,
}: {
  value: CustomerForm;
  onChange: (next: CustomerForm) => void;
  withNotes?: boolean;
  disabled?: boolean;
}) {
  const stored = value.phone.trim() ? storedPhone(value.phone) : null;
  const phoneBad = value.phone.trim() !== "" && !stored;
  return (
    <>
      <TextField
        value={value.fullName}
        onChange={(v) => onChange({ ...value, fullName: v })}
        fullWidth
        isRequired
        isDisabled={disabled}
        autoComplete="off"
      >
        <Label>Name</Label>
        <Input placeholder="Full name" maxLength={120} />
      </TextField>
      <div className="flex flex-col gap-1">
        <TextField
          value={value.phone}
          onChange={(v) => onChange({ ...value, phone: v })}
          fullWidth
          isRequired
          isInvalid={phoneBad}
          isDisabled={disabled}
          autoComplete="off"
        >
          <Label>Phone</Label>
          <Input inputMode="tel" placeholder="0788 123 456" className="tabular" />
        </TextField>
        <p className={`text-[12px] ${phoneBad ? "text-danger" : "text-muted"}`} aria-live="polite">
          {phoneBad
            ? "Not a valid number. Use a Rwandan mobile like 0788 123 456, or start with + and the country code."
            : stored
              ? `Will be saved as ${stored}`
              : "A Rwandan mobile, or another country's number starting with +."}
        </p>
      </div>
      <TextField
        value={value.email}
        onChange={(v) => onChange({ ...value, email: v })}
        fullWidth
        isDisabled={disabled}
        autoComplete="off"
      >
        <Label>Email (optional)</Label>
        <Input type="email" inputMode="email" placeholder="name@example.com" maxLength={200} />
      </TextField>
      {withNotes ? (
        <TextField
          value={value.notes}
          onChange={(v) => onChange({ ...value, notes: v })}
          fullWidth
          isDisabled={disabled}
        >
          <Label>Note (optional)</Label>
          <TextArea rows={2} maxLength={500} placeholder="Preferences, allergies, favourite table" />
        </TextField>
      ) : null}
      <Checkbox
        isSelected={value.marketingConsent}
        onChange={(on) => onChange({ ...value, marketingConsent: on })}
        isDisabled={disabled}
      >
        <Checkbox.Content className="gap-2">
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          The customer agreed to receive offers and news
        </Checkbox.Content>
      </Checkbox>
    </>
  );
}
