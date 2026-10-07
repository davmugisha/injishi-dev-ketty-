"use client";

/**
 * Step 2, the contact card: the front desk phone and the reservations email
 * guests and officers reach the property on (Onboarding board).
 *
 * The property's own contact, which is not always its owner's: a group runs
 * several front desks. Written through the same `PATCH /inventory/properties/:id`
 * as the profile, and checked against the contract's own `ContactPhone` rule so
 * a number this form accepts is one the API accepts.
 */

import { ContactPhone, type OperatorProperty } from "@injishi/contracts";
import { Input } from "@injishi/ui";
import { useState } from "react";

import { humanError } from "../../data/api";
import { useUpdateProperty } from "../../data/inventory";
import { StepFooter } from "./step-footer";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ContactStep({
  workspaceId,
  property,
  residence,
  onBack,
  onDone,
}: {
  workspaceId: string;
  property: OperatorProperty;
  /** A landlord's building has an office line, not a front desk. */
  residence: boolean;
  onBack?: () => void;
  onDone: () => void;
}) {
  const update = useUpdateProperty(workspaceId, property.id);
  const [phone, setPhone] = useState(property.contactPhone ?? "");
  const [email, setEmail] = useState(property.contactEmail ?? "");
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (!ContactPhone.safeParse(phone).success) {
      return setError(
        `Enter the ${residence ? "property's" : "front desk"} phone number, like 078 412 3390 or +250 788 123 456.`,
      );
    }
    if (!EMAIL.test(email.trim())) {
      return setError(residence ? "Enter an email address tenants can write to." : "Enter an email address for reservations.");
    }
    update.mutate(
      { contactPhone: phone.trim(), contactEmail: email.trim() },
      { onSuccess: onDone, onError: (err) => setError(humanError(err)) },
    );
  };

  return (
    <form
      className="flex flex-col gap-4"
      data-step-form="contact"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-foreground">{residence ? "Property phone" : "Reception phone"}</span>
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            className="pms-num"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setError(null);
            }}
            placeholder="078 000 0000"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-foreground">{residence ? "Property email" : "Reservations email"}</span>
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            placeholder={residence ? "office@yourbuilding.rw" : "reservations@yourhotel.rw"}
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        {residence
          ? "How tenants and officers reach the property itself. It need not be your own number."
          : "How guests and officers reach the property itself, usually the front desk. It need not be your own number."}
      </p>
      <StepFooter error={error} onBack={onBack} submits saving={update.isPending} />
    </form>
  );
}
