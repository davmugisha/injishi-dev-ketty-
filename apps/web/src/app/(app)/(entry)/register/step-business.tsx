"use client";

import { type RegistrantRole } from "@injishi/contracts";
import { Building2, MapPin } from "lucide-react";

import { upiError } from "@/lib/upi";

import { AddressPicker, type AddressDraft } from "./address-picker";
import {
  findRegistrationKind,
  type RegistrationKind,
} from "./registration-kinds";
import {
  ChoiceCard,
  Field,
  Fieldset,
  Notice,
  SelectField,
  StepActions,
  TextInput,
  YesNoField,
} from "./wizard-ui";

/**
 * Step 3 — Your business (F-S03 §6, D24, ADR-026).
 *
 * The domain AND the accommodation class are both DERIVED from the tile picked
 * on step 1, and neither is asked again. The domain never was asked twice; the
 * class was, and that was the bug: `/host` asked it, this step asked it again,
 * and the two could disagree. The class is now shown back as a read-only line
 * with a way back to the step that owns it (ADR-026, AC-1).
 *
 * The two branches differ in more than a label. Hospitality carries a TIN, a
 * tourism licence, the two memberships and a grade. A residence carries a UPI
 * and none of that apparatus — a database `check` enforces the same split, so
 * this mirrors a rule rather than inventing one.
 */

export interface BusinessDraft {
  legalName: string;
  accommodationClass: string;
  accommodationClassOther: string;
  residenceClass: string;
  tin: string;
  upi: string;
  tourismLicenseNumber: string;
  /**
   * `null` until answered (ADR-026 assumption 5, AC-6). An unanswered question
   * and an answered No are different acts, and the answer goes to an officer who
   * checks it, so neither may start as No.
   */
  chamberOfTourismMember: boolean | null;
  psfMember: boolean | null;
  eacStarGrade: string;
  address: AddressDraft;
}

export function StepBusiness({
  role,
  kind,
  draft,
  onChange,
  errors,
  formError,
  busy,
  onBack,
  onNext,
  onChangeKind,
}: {
  role: RegistrantRole;
  /** The tile picked on step 1. It, not the class, names what is registered. */
  kind: RegistrationKind | null;
  draft: BusinessDraft;
  onChange: (next: BusinessDraft) => void;
  errors: Record<string, string>;
  formError: string;
  busy: boolean;
  onBack: () => void;
  onNext: () => void;
  /** Back to step 1, which owns the class. */
  onChangeKind: () => void;
}) {
  const isHospitality = role === "host";
  /**
   * Named from the TILE rather than from the class, because the two are no
   * longer the same word. A bar & restaurant is stored as `other` plus its own
   * name — RDB has no accommodation class for a venue with no rooms — so
   * reading the class back would print "Registering a other" on the one tile
   * whose whole point is that it is not an accommodation.
   */
  const kindLabel =
    isHospitality && kind ? (findRegistrationKind(kind)?.label ?? null) : null;
  /**
   * Only `other` asks. Every other tile already knows what it is, and
   * `bar_restaurant` fills the same free-text field from step 1 — asking again
   * would invite an answer that contradicts the tile.
   */
  const asksForClassName = kind === "other";

  /**
   * The UPI rule, applied as it is typed.
   *
   * A residence registration IS its parcel: the UPI is the only identifier a
   * landlord gives, and the district officer walks to whatever it names. A
   * wrong one is not caught by anything else on this form, so it is caught here
   * — but only once there is something to judge, because an empty field is not
   * yet a mistake. A server-side message wins wherever there is one.
   */
  const liveUpiError =
    !isHospitality && draft.upi.trim() !== "" ? upiError(draft.upi) : null;

  return (
    <section aria-labelledby="step-business">
      <h2 id="step-business" className="text-xl font-semibold tracking-tight">
        Your business
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {isHospitality
          ? "Tell us what you run and where. A government officer will check this."
          : "Tell us about the property you let. A government officer will check this."}
      </p>

      <div className="mt-6 space-y-6">
        {/* The answer from step 1, shown rather than asked. It is here because
            this is the step where it MATTERS — it is what decides which of the
            fields below appear — and a person filling in a TIN should be able
            to see that they are filling it in for a hotel. */}
        {kindLabel ? (
          <div className="flex items-center gap-3 rounded-card border border-border bg-secondary p-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground">
              <Building2 size={16} aria-hidden />
            </span>
            <span className="min-w-0 flex-1 text-sm">
              <span className="text-muted-foreground">Registering a </span>
              <b className="font-semibold">{kindLabel.toLowerCase()}</b>
            </span>
            <button
              type="button"
              onClick={onChangeKind}
              className="shrink-0 text-xs font-semibold text-accent-text underline underline-offset-2"
            >
              Change
            </button>
          </div>
        ) : null}

        <Field
          label="Registered business name"
          required
          hint="Exactly as it appears on your registration."
          error={errors["business.legalName"]}
        >
          <TextInput
            id="biz-legal-name"

            value={draft.legalName}
            onChange={(e) => onChange({ ...draft, legalName: e.target.value })}
          />
        </Field>

        {isHospitality ? (
          <>
            {asksForClassName ? (
              <Field
                label="Tell us what kind of place this is"
                required
                error={errors["business.accommodationClassOther"]}
              >
                <TextInput
                  value={draft.accommodationClassOther}
                  onChange={(e) =>
                    onChange({
                      ...draft,
                      accommodationClassOther: e.target.value,
                    })
                  }
                />
              </Field>
            ) : null}

            <Field
              label="TIN"
              required
              hint="Your 9 digit RRA Tax Identification Number. We check it against RRA."
              error={errors["business.tin"]}
            >
              <TextInput
                id="biz-tin"

                inputMode="numeric"
                value={draft.tin}
                onChange={(e) => onChange({ ...draft, tin: e.target.value })}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Tourism licence number"
                hint="Optional."
                error={errors["business.tourismLicenseNumber"]}
              >
                <TextInput
                  value={draft.tourismLicenseNumber}
                  onChange={(e) =>
                    onChange({ ...draft, tourismLicenseNumber: e.target.value })
                  }
                />
              </Field>
              <Field
                label="EAC star grade"
                hint="Optional. Leave blank if you are not graded yet."
                error={errors["business.eacStarGrade"]}
              >
                {/* "Not graded" is a real answer, so it stays an OPTION rather
                    than becoming the placeholder — a placeholder cannot be
                    chosen, and someone who grades and then ungrades needs a way
                    back. */}
                <SelectField
                  value={draft.eacStarGrade}
                  options={[
                    { value: "", label: "Not graded" },
                    ...[1, 2, 3, 4, 5].map((n) => ({
                      value: String(n),
                      label: `${n} star`,
                    })),
                  ]}
                  invalid={Boolean(errors["business.eacStarGrade"])}
                  onChange={(eacStarGrade) =>
                    onChange({ ...draft, eacStarGrade })
                  }
                />
              </Field>
            </div>

            <Fieldset
              legend="Memberships"
              hint="Answer both. Your verifying officer checks these, so an unanswered question is not the same as a No."
            >
              <div className="space-y-3">
                <YesNoField
                  name="chamberOfTourism"
                  legend="Are you a member of the Chamber of Tourism?"
                  hint="The tourism chamber of the Private Sector Federation."
                  logo={{
                    src: "/assets/partners/chamber-of-tourism-rwanda.png",
                    width: 2918,
                    height: 1244,
                  }}
                  value={draft.chamberOfTourismMember}
                  error={errors["business.chamberOfTourismMember"]}
                  onChange={(v) =>
                    onChange({ ...draft, chamberOfTourismMember: v })
                  }
                />
                <YesNoField
                  name="psf"
                  legend="Are you a member of the Private Sector Federation (PSF)?"
                  hint="Rwanda's private sector body. Not the same as the tourism chamber above."
                  logo={{ src: "/assets/partners/psf.png", width: 674, height: 930 }}
                  value={draft.psfMember}
                  error={errors["business.psfMember"]}
                  onChange={(v) => onChange({ ...draft, psfMember: v })}
                />
              </div>
            </Fieldset>
          </>
        ) : (
          <>
            <Fieldset
              legend="How do you hold this property?"
              error={errors["business.residenceClass"]}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <ChoiceCard
                  name="residenceClass"
                  value="residential_landlord"
                  checked={draft.residenceClass === "residential_landlord"}
                  title="I am the landlord"
                  description="You own the property you let."
                  onSelect={() =>
                    onChange({ ...draft, residenceClass: "residential_landlord" })
                  }
                />
                <ChoiceCard
                  name="residenceClass"
                  value="residential_property_manager"
                  checked={
                    draft.residenceClass === "residential_property_manager"
                  }
                  title="I manage it for the owner"
                  description="You run the letting on someone else's behalf."
                  onSelect={() =>
                    onChange({
                      ...draft,
                      residenceClass: "residential_property_manager",
                    })
                  }
                />
              </div>
            </Fieldset>

            <Field
              label="UPI"
              required
              hint="The Unique Parcel Identifier from your land title: province / district / sector / cell / parcel, like 1/03/07/02/1234. Slashes, not dashes."
              error={errors["business.upi"] ?? liveUpiError ?? undefined}
            >
              <TextInput
                id="biz-upi"
                inputMode="numeric"
                autoComplete="off"
                placeholder="1/03/07/02/1234"
                aria-invalid={
                  errors["business.upi"] ?? liveUpiError ? true : undefined
                }
                value={draft.upi}
                onChange={(e) => onChange({ ...draft, upi: e.target.value })}
              />
            </Field>
          </>
        )}

        <div className="rounded-card border border-border p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <MapPin size={16} aria-hidden className="text-muted-foreground" />
            Where the business is
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            A district officer visits this address, so it has to be the real one.
          </p>
          <div className="mt-4">
            <AddressPicker
              idPrefix="biz"
              errorPrefix="business.address"
              rwandaOnly
              draft={draft.address}
              onChange={(address) => onChange({ ...draft, address })}
              errors={errors}
            />
          </div>
        </div>

        {formError ? <Notice tone="danger">{formError}</Notice> : null}
      </div>

      <StepActions
        onBack={onBack}
        onNext={onNext}
        nextLabel="Continue"
        busy={busy}
      />
    </section>
  );
}
