"use client";

import {
  type MyProfile,
  type RegistrantCapacity,
  countryName,
  isRwandanAddress,
} from "@injishi/contracts";

import { nationalIdError } from "@/lib/rwanda-id";

import {
  AddressPicker,
  type AddressDraft,
} from "./address-picker";
import { Button } from "@heroui/react";
import { COUNTRY_OPTIONS } from "./country-options";
import { PhoneInput } from "./phone-input";
import {
  ChoiceCard,
  Field,
  Fieldset,
  Notice,
  SelectField,
  StepActions,
  TextInput,
} from "./wizard-ui";

/**
 * Step 1 — About you (F-S03 §6).
 *
 * Two shapes, decided by whether this account already has a profile. A new
 * registrant fills the form; a returning one is SHOWN their details to confirm
 * rather than made to retype them, and is then asked the question that only
 * applies to them: are they the owner, or acting on behalf of one (FL02)?
 *
 * The identity document is never shown in full on the returning path — the API
 * masks it, and this renders what it was given. Nothing here needs the number.
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

export function StepAboutYou({
  profile,
  editing,
  onEdit,
  draft,
  onDraftChange,
  capacity,
  onCapacityChange,
  intendedOwner,
  onIntendedOwnerChange,
  errors,
  formError,
  busy,
  onBack,
  onNext,
}: {
  profile: MyProfile | null;
  editing: boolean;
  onEdit: () => void;
  draft: PersonalDraft;
  onDraftChange: (next: PersonalDraft) => void;
  capacity: RegistrantCapacity;
  onCapacityChange: (next: RegistrantCapacity) => void;
  intendedOwner: { name: string; nationalId: string; email: string };
  onIntendedOwnerChange: (next: {
    name: string;
    nationalId: string;
    email: string;
  }) => void;
  errors: Record<string, string>;
  formError: string;
  busy: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const showStored = profile?.complete === true && !editing;

  return (
    <section aria-labelledby="step-about">
      <h2 id="step-about" className="text-xl font-semibold tracking-tight">
        About you
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        A business belongs to the person who registers it, so we need to know who
        that is.
      </p>

      <div className="mt-6 space-y-6">
        {showStored ? (
          <StoredProfile profile={profile} onEdit={onEdit} />
        ) : (
          <PersonalForm draft={draft} onChange={onDraftChange} errors={errors} />
        )}

        <Fieldset
          legend="Are you the owner?"
          hint="An agent may register for an owner who will claim the business later. The agent never becomes the owner and never receives its money."
          error={errors["capacity"]}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <ChoiceCard
              name="capacity"
              value="owner"
              checked={capacity === "owner"}
              title="I own this business"
              description="You will be its owner on Injishi."
              onSelect={() => onCapacityChange("owner")}
            />
            <ChoiceCard
              name="capacity"
              value="on_behalf_of"
              checked={capacity === "on_behalf_of"}
              title="I'm registering for someone else"
              description="Payouts stay locked until they claim it."
              onSelect={() => onCapacityChange("on_behalf_of")}
            />
          </div>
        </Fieldset>

        {capacity === "on_behalf_of" ? (
          <div className="space-y-4 rounded-card border border-border p-4">
            <p className="text-sm font-semibold">Who are you registering for?</p>
            <Field
              label="Their full name"
              required
              error={errors["intendedOwner.name"]}
            >
              <TextInput
                value={intendedOwner.name}
                onChange={(e) =>
                  onIntendedOwnerChange({ ...intendedOwner, name: e.target.value })
                }
              />
            </Field>
            {/* Optional, but not "optional therefore unchecked". A wrong ID
                here is worse than none: it is what the claim is matched on, so
                a typo hands the business to nobody and the real owner is told
                their own ID does not match. Checked only once typed. */}
            <Field
              label="Their National ID"
              hint="Optional, but it is how we match the owner when they claim. 16 digits."
              error={
                errors["intendedOwner.nationalId"] ??
                (intendedOwner.nationalId.trim() !== ""
                  ? (nationalIdError(intendedOwner.nationalId) ?? undefined)
                  : undefined)
              }
            >
              <TextInput
                inputMode="numeric"
                placeholder="1 1995 8 0012345 12 3"
                maxLength={24}
                value={intendedOwner.nationalId}
                onChange={(e) =>
                  onIntendedOwnerChange({
                    ...intendedOwner,
                    nationalId: e.target.value,
                  })
                }
              />
            </Field>
            <Field
              label="Their email"
              hint="Optional. We send the claim invitation here."
              error={errors["intendedOwner.email"]}
            >
              <TextInput
                type="email"
                value={intendedOwner.email}
                onChange={(e) =>
                  onIntendedOwnerChange({
                    ...intendedOwner,
                    email: e.target.value,
                  })
                }
              />
            </Field>
          </div>
        ) : null}

        {formError ? <Notice tone="danger">{formError}</Notice> : null}
      </div>

      <StepActions
        onBack={onBack}
        // Step 1 asks what you are registering, not what role you hold — the
        // role is derived from the tile now (ADR-026). "Change role" pointed
        // at a question that no longer exists.
        backLabel="Change what you are registering"
        onNext={onNext}
        nextLabel="Continue to your business"
        busy={busy}
      />
    </section>
  );
}

/** What a returning registrant confirms rather than retypes. */
function StoredProfile({
  profile,
  onEdit,
}: {
  profile: MyProfile;
  onEdit: () => void;
}) {
  const address = profile.address;
  const addressLine =
    address === null
      ? "Not given"
      : isRwandanAddress(address)
        ? [address.street, "Rwanda"].filter(Boolean).join(" · ")
        : `${address.addressText} · ${countryName(address.country)}`;

  return (
    <div className="rounded-card border border-border p-4">
      <div className="flex items-start gap-3">
        <div className="grow">
          <p className="text-sm font-semibold">{profile.fullName}</p>
          <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <Row label="Date of birth" value={profile.dateOfBirth} />
            <Row label="Phone" value={profile.phoneE164} />
            <Row
              label={
                profile.document?.documentType === "passport"
                  ? "Passport"
                  : "National ID"
              }
              value={
                profile.document
                  ? `${profile.document.documentNumberMasked} · ${countryName(profile.document.issuingCountry)}`
                  : null
              }
            />
            <Row label="Address" value={addressLine} />
          </dl>
        </div>
        <Button variant="ghost" size="sm" onPress={onEdit}>
          Edit
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        These are the details on your Injishi account. Government reviewers see
        them alongside your business.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value ?? "Not given"}</dd>
    </div>
  );
}

/** The form a new registrant fills in. */
function PersonalForm({
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
   * The National ID rule, applied as it is typed rather than on Continue.
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

  return (
    <div className="space-y-4">
      {/* One legend over three inputs, because they are one question. The
          fieldset also carries `errors["fullName"]` — the contract validates
          the composed name and reports against that one path, and hanging its
          message on the first name box alone would blame the wrong field. */}
      <Fieldset
        legend="Your name"
        hint="Exactly as written on your ID or passport, in the same order."
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
          <Field
            label="Middle name"
            hint="Leave blank if you have none."
            error={errors["middleName"]}
          >
            <TextInput
              id="you-middle-name"
              autoComplete="additional-name"
              value={draft.middleName}
              onChange={(e) =>
                onChange({ ...draft, middleName: e.target.value })
              }
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

      <Fieldset legend="Which document do you have?" error={errors["document"]}>
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            name="documentType"
            value="national_id"
            checked={!isPassport}
            title="Rwandan National ID"
            description="16 digits."
            onSelect={() =>
              onChange({
                ...draft,
                documentType: "national_id",
                documentNumber: "",
                issuingCountry: "RW",
              })
            }
          />
          <ChoiceCard
            name="documentType"
            value="passport"
            checked={isPassport}
            title="Passport"
            description="Any country."
            onSelect={() =>
              onChange({
                ...draft,
                documentType: "passport",
                documentNumber: "",
              })
            }
          />
        </div>
      </Fieldset>

      <Field
        label={isPassport ? "Passport number" : "National ID number"}
        required
        hint={
          isPassport
            ? "6 to 12 letters or digits."
            : "16 digits, as printed on the card. Type it in groups if you like — 1 1995 8 0012345 12 3 — the spaces are ignored."
        }
        error={errors["document.documentNumber"] ?? liveIdError ?? undefined}
      >
        <TextInput
          id="you-document-number"
          inputMode={isPassport ? "text" : "numeric"}
          autoComplete="off"
          placeholder={isPassport ? "PC1234567" : "1 1995 8 0012345 12 3"}
          maxLength={isPassport ? 12 : 24}
          aria-invalid={
            errors["document.documentNumber"] ?? liveIdError ? true : undefined
          }
          value={draft.documentNumber}
          onChange={(e) => onChange({ ...draft, documentNumber: e.target.value })}
        />
      </Field>

      {isPassport ? (
        <Field
          label="Issuing country"
          required
          error={errors["document.issuingCountry"]}
        >
          <SelectField
            value={draft.issuingCountry}
            options={COUNTRY_OPTIONS}
            placeholder="Choose a country"
            invalid={Boolean(errors["document.issuingCountry"])}
            onChange={(issuingCountry) =>
              onChange({ ...draft, issuingCountry })
            }
          />
        </Field>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Date of birth"
          required
          hint="You must be 18 or over to register a business."
          error={errors["dateOfBirth"]}
        >
          <TextInput
            type="date"
            value={draft.dateOfBirth}
            onChange={(e) => onChange({ ...draft, dateOfBirth: e.target.value })}
          />
        </Field>

        <Field label="Gender" hint="Optional." error={errors["gender"]}>
          {/* "Rather not say now" is an answer, not an absence, so it stays
              an option. See the sentinel note on `SelectField`. */}
          <SelectField
            value={draft.gender}
            options={[
              { value: "", label: "Rather not say now" },
              { value: "female", label: "Female" },
              { value: "male", label: "Male" },
              { value: "other", label: "Other" },
              { value: "prefer_not_to_say", label: "Prefer not to say" },
            ]}
            invalid={Boolean(errors["gender"])}
            onChange={(gender) => onChange({ ...draft, gender })}
          />
        </Field>
      </div>

      <Field
        label="Phone"
        required
        hint="Pick your country, then the number as you would dial it at home. Leave off the leading 0."
        error={errors["phoneE164"]}
      >
        <PhoneInput
          id="you-phone"
          value={draft.phoneE164}
          invalid={Boolean(errors["phoneE164"])}
          onChange={(phoneE164) => onChange({ ...draft, phoneE164 })}
        />
      </Field>

      <div className="rounded-card border border-border p-4">
        <p className="text-sm font-semibold">Where you live</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Rwanda uses Province, District and Sector. Anywhere else, just write the
          address.
        </p>
        <div className="mt-4">
          <AddressPicker
            idPrefix="you"
            draft={draft.address}
            onChange={(address) => onChange({ ...draft, address })}
            errors={errors}
          />
        </div>
      </div>
    </div>
  );
}
