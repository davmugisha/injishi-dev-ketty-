"use client";

import { Button } from "@injishi/web-ui";
import { ArrowLeft } from "lucide-react";

import { upiError } from "@/lib/upi";

import type { BusinessDraft } from "./business-draft";
import { ChoiceTile, Field, TextInput } from "./wizard-ui";

/**
 * The property (Register.dc.html, a Residence's step two): the name it is let
 * under, its UPI from the land title, and how it is held. No land register is
 * reachable from here, so the UPI's FORMAT is what is checked; an officer
 * compares it with the land title before approving.
 *
 * "How you hold it" is not on the artboard. It is here because the API requires
 * a residence class on every residence (`ResidenceBusiness.residenceClass`), and
 * a landlord and a manager letting for one are registered differently.
 */
export function SectionProperty({
  draft,
  onChange,
  errors,
  onNext,
  onBack = null,
}: {
  draft: BusinessDraft;
  onChange: (next: BusinessDraft) => void;
  errors: Record<string, string>;
  onNext: () => void;
  /** Back: the section before, reopened with its answers, or the step before. */
  onBack?: (() => void) | null;
}) {
  const back = onBack ? (
    <Button variant="ghost" onClick={onBack}>
      <ArrowLeft size={16} aria-hidden />
      Back
    </Button>
  ) : null;
  const liveUpi = draft.upi.trim() ? upiError(draft.upi) : null;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Residence name" hint="As it is let, or as on the land title." error={errors["business.legalName"]}>
          <TextInput
            id="register-residence-name"
            className="w-full"
            value={draft.legalName}
            onChange={(e) => onChange({ ...draft, legalName: e.target.value })}
          />
        </Field>
        <Field label="UPI" hint="The parcel number on your land title" error={errors["business.upi"] ?? liveUpi ?? undefined}>
          <TextInput
            id="register-upi"
            className="w-full tabular-nums"
            autoComplete="off"
            placeholder="1/03/09/02/4417"
            value={draft.upi}
            onChange={(e) => onChange({ ...draft, upi: e.target.value })}
          />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-sm font-semibold">How you hold it</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceTile
            name="residence-class"
            checked={draft.residenceClass === "residential_landlord"}
            title="I am the landlord"
            description="You own the property you let."
            onSelect={() => onChange({ ...draft, residenceClass: "residential_landlord" })}
          />
          <ChoiceTile
            name="residence-class"
            checked={draft.residenceClass === "residential_property_manager"}
            title="I manage it for the owner"
            description="You run the letting on someone else's behalf."
            onSelect={() => onChange({ ...draft, residenceClass: "residential_property_manager" })}
          />
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-2">
        {back}
        <Button onClick={onNext} disabled={draft.legalName.trim().length < 2 || upiError(draft.upi) !== null}>
          Next
        </Button>
      </div>
    </>
  );
}
