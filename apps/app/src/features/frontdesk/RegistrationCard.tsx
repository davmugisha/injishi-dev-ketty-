"use client";

import { Input, Label, TextField } from "@heroui/react";
import { COUNTRIES } from "@injishi/contracts";

/** The registration card the desk fills for the guest it checks in (0114). */
export interface RegistrationCardValue {
  nationality: string;
  documentType: "national_id" | "passport" | "other";
  idNumber: string;
}

export const EMPTY_REGISTRATION_CARD: RegistrationCardValue = { nationality: "RW", documentType: "national_id", idNumber: "" };

/** What the check-in and walk-in routes take as `guest`; the document number only when one was typed. */
export function registrationDetails(card: RegistrationCardValue) {
  const idNumber = card.idNumber.trim();
  return { nationality: card.nationality, documentType: card.documentType, ...(idNumber ? { idNumber } : {}) };
}

const SELECT =
  "h-10 w-full rounded-xl border border-separator bg-field px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus";

/**
 * Nationality and the document, as on the guest's ID. Every check in is filed for the village leader, DASSO
 * and the district where the property stands, and a guest from abroad for DGIE as well: the nationality is what
 * decides that, so it is asked here rather than assumed Rwandan.
 */
export function RegistrationCard({
  value,
  onChange,
}: {
  value: RegistrationCardValue;
  onChange: (next: RegistrationCardValue) => void;
}) {
  const foreign = value.nationality !== "RW";
  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr))]">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Nationality
          <select
            className={SELECT}
            value={value.nationality}
            onChange={(e) =>
              onChange({
                ...value,
                nationality: e.target.value,
                // A guest from abroad travels on a passport; a Rwandan on the national ID.
                documentType: e.target.value === "RW" ? "national_id" : "passport",
              })
            }
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Document
          <select
            className={SELECT}
            value={value.documentType}
            onChange={(e) => onChange({ ...value, documentType: e.target.value as RegistrationCardValue["documentType"] })}
          >
            <option value="national_id">National ID</option>
            <option value="passport">Passport</option>
            <option value="other">Other</option>
          </select>
        </label>
        <TextField
          value={value.idNumber}
          onChange={(idNumber) => onChange({ ...value, idNumber })}
          className="flex flex-col gap-1"
        >
          <Label>Document number</Label>
          <Input placeholder="As printed" className="tabular" />
        </TextField>
      </div>
      <p className="text-xs text-muted">
        {foreign
          ? "Reported to the local leaders where the property is, and to DGIE because the guest is from abroad."
          : "Reported to the village leader, DASSO and the district where the property is."}
      </p>
    </div>
  );
}
