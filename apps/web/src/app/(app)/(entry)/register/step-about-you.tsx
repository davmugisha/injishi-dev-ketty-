"use client";

import { nationalIdError, nationalIdFacts } from "@/lib/rwanda-id";

import { type AddressDraft } from "./address-picker";
import { COUNTRY_OPTIONS } from "./country-options";
import {
  Field,
  Fieldset,
  SelectField,
  TextInput,
} from "./wizard-ui";

/**
 * The person registering: their draft, their name, and the details typed as
 * printed when the ID scan read nothing (F-S03 §6, ADR-075 S4). The step is
 * `section-identity.tsx`.
 *
 * Formerly Step 1, About you.
 *
 * The identity document is never shown in full once it is on file: the API
 * masks it, and the step renders what it was given. Nothing here needs the
 * number after it is typed once.
 */

/**
 * THE NAME IS THREE FIELDS, NOT ONE, and only in the draft.
 *
 * One "Full name" box is a box people fill in three different orders. Rwandan
 * names are written family name first — `MUKAMANA Aline` — and the same person
 * filling a form built elsewhere writes `Aline Mukamana`, so a single string
 * cannot be searched, sorted, or matched against a National ID register without
 * guessing which half is which. Asking the three parts separately is the only
 * point at which the person themselves knows the answer.
 *
 * `middleName` is optional because plenty of people have none, and a required
 * middle-name field teaches everybody who has none to type a full stop.
 *
 * The CONTRACT still carries one `fullName`, and this does not try to change
 * that — `@injishi/contracts` is not modified by this work, and the profile the
 * server returns is a single string. The three parts are recomposed at the one
 * point of submission, in `register-wizard.tsx`.
 */
export interface PersonalDraft {
  firstName: string;
  middleName: string;
  lastName: string;
  documentType: "national_id" | "passport";
  documentNumber: string;
  issuingCountry: string;
  gender: string;
  dateOfBirth: string;
  phoneE164: string;
  address: AddressDraft;
}

/**
 * First, middle and last, joined the way the person wrote them.
 *
 * Space-separated in the order asked, with the middle name dropped when there
 * is none — the naive `[first, middle, last].join(" ")` leaves a double space
 * for everybody without one, and `PersonalDetails.fullName` only trims the ends.
 * `collapse` also absorbs a stray space somebody typed into a box, so the stored
 * name is the same whether it was typed carefully or not.
 *
 * It lives beside the type rather than in the wizard so the review step can read
 * the name back the same way it will be sent. Two spellings of one name on two
 * screens of one form is the bug this prevents.
 */
export function composeFullName(d: PersonalDraft): string {
  return collapse([d.firstName, d.middleName, d.lastName].join(" "));
}

/**
 * The reverse, for the one direction the server still speaks in: `MyProfile`
 * carries a single `fullName`, so an editing registrant's stored name has to be
 * split back into the three boxes before it can be shown in them.
 *
 * First token first, last token last, everything between is the middle. That is
 * a guess, and it is a guess the person can see and correct in the boxes — which
 * is exactly why the three fields exist. It is never applied to what they type.
 */
export function splitFullName(fullName: string): {
  firstName: string;
  middleName: string;
  lastName: string;
} {
  const parts = collapse(fullName).split(" ").filter(Boolean);
  if (parts.length === 0) return { firstName: "", middleName: "", lastName: "" };
  if (parts.length === 1) {
    return { firstName: parts[0], middleName: "", lastName: "" };
  }
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

/** One space between words, none at the ends. */
function collapse(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Who a registration is for, when it is registered on someone's behalf: the
 * three answers the claim binds to (ADR-053 J25). Shared by About you and, when
 * the company register moves a registrant onto this path, the Business step
 * (ADR-060).
 */
export function IntendedOwnerFields({
  value,
  onChange,
  errors,
  title = "Who are you registering for?",
}: {
  value: { name: string; nationalId: string; email: string };
  onChange: (next: { name: string; nationalId: string; email: string }) => void;
  errors: Record<string, string>;
  title?: string;
}) {
  return (
    <div className="space-y-4 rounded-card border border-border p-4">
      <p className="text-sm font-semibold">{title}</p>
      <Field
        label="Their full name"
        required
        error={errors["intendedOwner.name"]}
      >
        <TextInput
          value={value.name}
          onChange={(e) =>
            onChange({ ...value, name: e.target.value })
          }
        />
      </Field>
      {/* Required (ADR-053 J25): it is what the claim is matched on, so
          without it nobody can ever claim the business, and a typo hands
          it to nobody. Checked as you type once something is typed. */}
      <Field
        label="Their National ID"
        required
        hint="It is how we match the owner when they claim. 16 digits."
        error={
          errors["intendedOwner.nationalId"] ??
          (value.nationalId.trim() !== ""
            ? (nationalIdError(value.nationalId) ?? undefined)
            : undefined)
        }
      >
        <TextInput
          inputMode="numeric"
          placeholder="1 1995 8 0012345 12 3"
          maxLength={24}
          value={value.nationalId}
          onChange={(e) =>
            onChange({
              ...value,
              nationalId: e.target.value,
            })
          }
        />
      </Field>
      <Field
        label="Their email"
        required
        hint="We send their claim invitation here."
        error={errors["intendedOwner.email"]}
      >
        <TextInput
          type="email"
          value={value.email}
          onChange={(e) =>
            onChange({
              ...value,
              email: e.target.value,
            })
          }
        />
      </Field>
    </div>
  );
}

/**
 * The details as printed on the ID, typed after a scan that read nothing: no
 * checker here (ADR-075 D-a), or the tries ran out (AC-5). Only what the ID
 * shows; the phone and the home address are asked beside it by the step. The
 * document type is the one scanned, so it is not asked again.
 */
export function TypedIdentityFields({
  draft,
  onChange,
  errors,
}: {
  draft: PersonalDraft;
  onChange: (next: PersonalDraft) => void;
  errors: Record<string, string>;
}) {
  const isPassport = draft.documentType === "passport";

  /**
   * The National ID rule, applied as it is typed rather than on Confirm.
   *
   * Only once something has been typed: an empty field is not yet a mistake,
   * and a form that turns red before it has been touched reads as broken. The
   * server-side message wins where there is one, so a rejection the API knows
   * about is never overwritten by a local guess.
   */
  const liveIdError =
    !isPassport && draft.documentNumber.trim() !== ""
      ? nationalIdError(draft.documentNumber)
      : null;

  /** What the card says, and whether the date of birth disagrees with it. */
  const idFacts = isPassport ? null : nationalIdFacts(draft.documentNumber);
  const birthYearClash =
    idFacts !== null &&
    /^\d{4}-/.test(draft.dateOfBirth) &&
    Number(draft.dateOfBirth.slice(0, 4)) !== idFacts.birthYear;

  return (
    <div className="space-y-4">
      {/* One legend over three inputs, because they are one question. The
          fieldset also carries `errors["fullName"]` — the contract validates
          the composed name and reports against that one path, and hanging its
          message on the first name box alone would blame the wrong field. */}
      <Fieldset
        legend="Your name"
        hint="Exactly as printed on your ID, in the same order."
        error={errors["fullName"]}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="First name" required error={errors["firstName"]}>
            <TextInput
              id="you-first-name"
              autoComplete="given-name"
              value={draft.firstName}
              onChange={(e) => onChange({ ...draft, firstName: e.target.value })}
            />
          </Field>
          <Field label="Middle name" hint="Leave blank if you have none." error={errors["middleName"]}>
            <TextInput
              id="you-middle-name"
              autoComplete="additional-name"
              value={draft.middleName}
              onChange={(e) => onChange({ ...draft, middleName: e.target.value })}
            />
          </Field>
          <Field label="Last name" required error={errors["lastName"]}>
            <TextInput
              id="you-last-name"
              autoComplete="family-name"
              value={draft.lastName}
              onChange={(e) => onChange({ ...draft, lastName: e.target.value })}
            />
          </Field>
        </div>
      </Fieldset>

      <Field
        label={isPassport ? "Passport number" : "National ID number"}
        required
        hint={
          isPassport
            ? "6 to 12 letters or digits."
            : "16 digits, as printed on the card. Spaces are ignored."
        }
        error={errors["document.documentNumber"] ?? liveIdError ?? undefined}
      >
        <TextInput
          id="you-document-number"
          inputMode={isPassport ? "text" : "numeric"}
          autoComplete="off"
          placeholder={isPassport ? "PC1234567" : "1 1995 8 0012345 12 3"}
          maxLength={isPassport ? 12 : 24}
          aria-invalid={errors["document.documentNumber"] ?? liveIdError ? true : undefined}
          value={draft.documentNumber}
          onChange={(e) => onChange({ ...draft, documentNumber: e.target.value })}
        />
      </Field>

      {isPassport ? (
        <Field label="Issuing country" required error={errors["document.issuingCountry"]}>
          <SelectField
            value={draft.issuingCountry}
            options={COUNTRY_OPTIONS}
            placeholder="Choose a country"
            invalid={Boolean(errors["document.issuingCountry"])}
            onChange={(issuingCountry) => onChange({ ...draft, issuingCountry })}
          />
        </Field>
      ) : null}

      <Field
        label="Date of birth"
        required
        hint={
          birthYearClash
            ? `Your National ID says you were born in ${idFacts?.birthYear}. Check the year.`
            : "As printed on your ID. You must be 18 or over to register a business."
        }
        error={errors["dateOfBirth"]}
      >
        <TextInput
          type="date"
          className="w-full max-w-form"
          value={draft.dateOfBirth}
          onChange={(e) => onChange({ ...draft, dateOfBirth: e.target.value })}
        />
      </Field>
    </div>
  );
}
