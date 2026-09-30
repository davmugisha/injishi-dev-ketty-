"use client";

import {
  type RegistrantCapacity,
  type RegistrantRole,
  type RegistryBusiness,
  type TinCheckResult,
} from "@injishi/contracts";
import { Button } from "@heroui/react";
import { Building2, CheckCircle2, Home, MapPin } from "lucide-react";
import { useState } from "react";

import { checkTin } from "@/data/registration";
import { upiError } from "@/lib/upi";

import { AddressPicker, type AddressDraft } from "./address-picker";
import { IntendedOwnerFields } from "./step-about-you";
import { BranchesEditor, type BranchDraft } from "./step-branches";
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
  /**
   * ADR-056. With a No: whether to apply to PSF now, `null` until answered, so
   * the PSF step only appears for someone who chose it. With a Yes: the
   * membership number, optional and unchecked.
   */
  psfApply: boolean | null;
  psfMembershipNumber: string;
  eacStarGrade: string;
  address: AddressDraft;
}

/** The TIN as the contract reads it: spaces dropped. */
function normalizeTin(raw: string): string {
  return raw.replace(/\s+/g, "");
}

function isFullTin(raw: string): boolean {
  return /^\d{9}$/.test(normalizeTin(raw));
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
  homeAddress,
  branches,
  onBranchesChange,
  registry,
  onRegistry,
  capacity,
  intendedOwner,
  onIntendedOwnerChange,
}: {
  /** The address About you holds, stored or typed; null when none. */
  homeAddress: AddressDraft | null;
  /** A hotel's other locations, declared on this step since ADR-060. */
  branches: BranchDraft[];
  onBranchesChange: (next: BranchDraft[]) => void;
  /** The company the register holds for the TIN, once asked (ADR-060). */
  registry: RegistryBusiness | null;
  onRegistry: (found: RegistryBusiness | null, registrantIsDirector: boolean | null) => void;
  capacity: RegistrantCapacity;
  intendedOwner: { name: string; nationalId: string; email: string };
  onIntendedOwnerChange: (next: { name: string; nationalId: string; email: string }) => void;
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
   * The home address from About you, offered as a one-press copy (registration
   * Phase 0) when it is a placed Rwandan address and not already the answer.
   * Many small hosts run the business from home; everyone else ignores it.
   */
  const canUseHome =
    homeAddress !== null &&
    homeAddress.country === "RW" &&
    homeAddress.sectorId !== "" &&
    JSON.stringify(homeAddress) !== JSON.stringify(draft.address);

  /**
   * The TIN, asked of RRA here rather than after payment (registration Phase
   * 0). The verdict is kept against the TIN it answered, so editing the field
   * drops a stale one instead of showing a tick beside a different number.
   */
  const [tinCheck, setTinCheck] = useState<{
    tin: string;
    verdict: TinCheckResult;
  } | null>(null);
  const [tinChecking, setTinChecking] = useState(false);
  const tinVerdict =
    isHospitality && tinCheck?.tin === normalizeTin(draft.tin)
      ? tinCheck.verdict
      : null;
  const tinRefusal =
    tinVerdict?.result === "failed" || tinVerdict?.result === "taken"
      ? tinVerdict.message
      : undefined;

  /**
   * The legal name is the register's once the register named it (ADR-060),
   * and `create` refuses any other, so the field is locked rather than left to
   * be typed into a refusal.
   */
  const nameFromRegister =
    isHospitality && registry !== null && draft.legalName === registry.legalName;

  async function validateTin(): Promise<TinCheckResult | null> {
    const tin = normalizeTin(draft.tin);
    if (tinCheck?.tin === tin) return tinCheck.verdict;
    setTinChecking(true);
    const res = await checkTin(tin);
    setTinChecking(false);
    // No answer at all is read like RRA being down: never a refusal, because
    // the check after payment still runs.
    if (res.status !== "ok") return null;
    setTinCheck({ tin, verdict: res.data });
    // The register's answer fills the step (ADR-060): legal name, address,
    // and whether the registrant is one of its directors.
    if (res.data.result === "verified") {
      onRegistry(res.data.business, res.data.registrantIsDirector);
    }
    return res.data;
  }

  /** Continue, but never past a TIN RRA refused or another business holds. */
  async function guardedNext(): Promise<void> {
    if (isHospitality && isFullTin(draft.tin)) {
      const verdict = await validateTin();
      if (verdict?.result === "failed" || verdict?.result === "taken") return;
    }
    onNext();
  }

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
          hint={
            nameFromRegister
              ? "As the company register holds it for this TIN. It cannot be changed here."
              : "Exactly as it appears on your registration."
          }
          error={errors["business.legalName"]}
        >
          <TextInput
            id="biz-legal-name"
            readOnly={nameFromRegister}
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
              hint="Your 9 digit RRA Tax Identification Number. We check it with RRA now, before you pay anything."
              error={errors["business.tin"] ?? tinRefusal}
            >
              <span className="flex gap-2">
                <TextInput
                  id="biz-tin"
                  className="grow"
                  inputMode="numeric"
                  value={draft.tin}
                  onChange={(e) => onChange({ ...draft, tin: e.target.value })}
                  onBlur={() => {
                    if (isFullTin(draft.tin)) void validateTin();
                  }}
                />
                <Button
                  variant="outline"
                  onPress={() => void validateTin()}
                  isDisabled={!isFullTin(draft.tin)}
                  isPending={tinChecking}
                >
                  {tinChecking ? "Checking…" : "Validate"}
                </Button>
              </span>
            </Field>
            {tinVerdict?.result === "verified" ? (
              <p className="flex items-center gap-1.5 text-sm" role="status">
                <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                {tinVerdict.message}
              </p>
            ) : tinVerdict?.result === "pending" ? (
              <p className="text-sm text-muted-foreground" role="status">
                {tinVerdict.message}
              </p>
            ) : null}

            {/* What the company register said (ADR-060): the name and address
                above came from it, and a registrant it does not list as a
                director registers on the owner's behalf. */}
            {registry && tinVerdict?.result === "verified" ? (
              <Notice tone="info">
                <b>From the company register:</b> {registry.legalName}
                {registry.registeredOn ? `, registered on ${registry.registeredOn}` : ""}.
                We filled in its name and address; add what the register does
                not hold.
                {registry.directors.length > 0
                  ? ` Directors: ${registry.directors.map((d) => d.name).join(", ")}.`
                  : ""}
                {registry.generated
                  ? " (Demo: no real register is connected, so this company was generated.)"
                  : ""}
              </Notice>
            ) : null}
            {registry && registry.directors.length > 0 && capacity === "on_behalf_of" ? (
              <IntendedOwnerFields
                title={
                  tinVerdict?.registrantIsDirector === false
                    ? "You are not one of its directors, so you register on the owner's behalf. Who owns it?"
                    : "Who are you registering for?"
                }
                value={intendedOwner}
                onChange={onIntendedOwnerChange}
                errors={errors}
              />
            ) : null}

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
                  onChange={(v) =>
                    onChange({
                      ...draft,
                      psfMember: v,
                      // The follow up belongs to the answer given; a changed
                      // answer asks its own follow up afresh.
                      psfApply: null,
                      psfMembershipNumber: "",
                    })
                  }
                />
                {draft.psfMember === true ? (
                  <Field
                    label="PSF membership number (optional)"
                    hint="If you have it to hand. Nobody checks it here."
                    error={errors["business.psfMembershipNumber"]}
                  >
                    <TextInput
                      value={draft.psfMembershipNumber}
                      onChange={(e) => onChange({ ...draft, psfMembershipNumber: e.target.value })}
                    />
                  </Field>
                ) : null}
                {draft.psfMember === false ? (
                  <YesNoField
                    name="psfApply"
                    legend="Would you like to apply for PSF membership now?"
                    hint="You fill in PSF's form on a later step, most of it from what you tell us here. PSF invoices you directly; Injishi never takes that fee. You can also apply later from your workspace."
                    value={draft.psfApply}
                    error={errors["business.psfApply"]}
                    onChange={(v) => onChange({ ...draft, psfApply: v })}
                  />
                ) : null}
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
            Give the cell and village if you know them — that is what gets
            someone to the door.
          </p>
          {canUseHome ? (
            <Button
              className="mt-3"
              variant="outline"
              size="sm"
              onPress={() => onChange({ ...draft, address: { ...homeAddress } })}
            >
              <Home size={14} aria-hidden />
              Same as my home address
            </Button>
          ) : null}
          <div className="mt-4">
            <AddressPicker
              idPrefix="biz"
              errorPrefix="business.address"
              rwandaOnly
              collectVillage
              draft={draft.address}
              onChange={(address) => onChange({ ...draft, address })}
              errors={errors}
            />
          </div>
        </div>

        {/* A hotel's other locations, on this step since ADR-060. */}
        {isHospitality ? (
          <BranchesEditor
            headOfficeAddress={draft.address}
            drafts={branches}
            onChange={onBranchesChange}
            errors={errors}
          />
        ) : null}

        {formError ? <Notice tone="danger">{formError}</Notice> : null}
      </div>

      <StepActions
        onBack={onBack}
        onNext={() => void guardedNext()}
        nextLabel="Continue"
        busy={busy || tinChecking}
      />
    </section>
  );
}
