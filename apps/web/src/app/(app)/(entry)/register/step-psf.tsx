"use client";

/**
 * The PSF membership step (ADR-056 AC-2 to AC-5).
 *
 * Only for a hotel that answered No to PSF and chose to apply now. It sits
 * after Documents and before Review, so the required registration is complete
 * before the optional part starts. Most of it arrives filled in from the steps
 * before; the TIN is shown and never asked. Checked with `PsfApplicationInput`,
 * the schema the server validates the registration with.
 */
import { Button } from "@heroui/react";
import {
  COUNTRIES,
  PSF_COMPANY_TYPE_LABEL,
  PSF_CONSENT_TEXT,
  PSF_CONTACT_ROLE_LABEL,
  PSF_FAMILY_LABEL,
  PSF_FEE_NOTICE,
  PSF_OWNERSHIP_LABEL,
  PSF_TRADE_DIRECTION_LABEL,
  PsfCompanyType,
  PsfContactRole,
  PsfMembershipFamily,
  PsfOwnership,
  PsfTradeDirection,
  psfBusinessActivityFor,
  splitPsfName,
  type MyProfileDocument,
  type PsfTier,
} from "@injishi/contracts";
import { Checkbox } from "@injishi/ui";
import { useState } from "react";

import type { PersonalDraft } from "./step-about-you";
import type { BusinessDraft } from "./step-business";
import { ChoiceCard, Field, Fieldset, Notice, SelectField, StepActions, TextInput, formatRwf } from "./wizard-ui";

export interface PsfDraft {
  requestedTierCode: string;
  companyName: string;
  streetAddress: string;
  website: string;
  companyType: string;
  ownership: string;
  ownershipOther: string;
  businessActivity: string;
  tradeDirection: string;
  tradeGoods: string;
  tradeCountries: string[];
  contactRole: string;
  firstName: string;
  lastName: string;
  gender: string;
  phoneE164: string;
  email: string;
  idDocumentType: string;
  idDocumentNumber: string;
  /**
   * The masked document on the registrant's profile, e.g. "National ID
   * ••••1234", when the application uses it (registration Phase 0). The server
   * copies the full number; null means the ID is typed above.
   */
  idOnFile: string | null;
  dateOfBirth: string;
  consent: boolean;
}

/**
 * What the step starts from (ADR-056 value sourcing). Owner: the About you
 * step. On behalf: the intended owner's name, National ID and email, and the
 * rest asked, because the agent is not the person PSF contacts.
 */
export function psfDraftFrom(input: {
  business: BusinessDraft;
  personal: PersonalDraft;
  onBehalf: boolean;
  intendedOwner: { name: string; nationalId: string; email: string };
  sessionEmail: string | null;
  /**
   * The document on a returning registrant's profile. Its number comes back
   * masked, so it can be named but never retyped for them; the application
   * says "use the one on file" instead.
   */
  documentOnFile?: MyProfileDocument | null;
}): PsfDraft {
  const { business, personal } = input;
  const base = {
    requestedTierCode: "",
    companyName: business.legalName,
    streetAddress: business.address.street ?? "",
    website: "",
    companyType: "",
    ownership: "",
    ownershipOther: "",
    businessActivity: psfBusinessActivityFor(business.accommodationClass || null, business.accommodationClassOther || null),
    tradeDirection: "none",
    tradeGoods: "",
    tradeCountries: [] as string[],
    consent: false,
  };
  if (input.onBehalf) {
    const name = splitPsfName(input.intendedOwner.name);
    return {
      ...base,
      contactRole: "",
      firstName: name.firstName,
      lastName: name.lastName,
      gender: "",
      phoneE164: "",
      email: input.intendedOwner.email,
      idDocumentType: "national_id",
      idDocumentNumber: input.intendedOwner.nationalId.replace(/\s+/g, ""),
      idOnFile: null,
      dateOfBirth: "",
    };
  }
  const onFile = input.documentOnFile ?? null;
  return {
    ...base,
    contactRole: "owner",
    // PSF's form has two name fields; a middle name rides with the first.
    firstName: [personal.firstName, personal.middleName].filter((s) => s.trim()).join(" "),
    lastName: personal.lastName,
    gender: personal.gender === "male" || personal.gender === "female" ? personal.gender : "",
    phoneE164: personal.phoneE164,
    email: input.sessionEmail ?? "",
    idDocumentType: onFile?.documentType ?? personal.documentType,
    idDocumentNumber: onFile ? "" : personal.documentNumber.replace(/\s+/g, ""),
    idOnFile: onFile
      ? `${onFile.documentType === "passport" ? "Passport" : "National ID"} ${onFile.documentNumberMasked}`
      : null,
    dateOfBirth: personal.dateOfBirth,
  };
}

/** The draft in the wire's shape: an unanswered field absent, never "". */
export function psfCandidate(d: PsfDraft): unknown {
  const trading = d.tradeDirection !== "none";
  return {
    requestedTierCode: d.requestedTierCode,
    companyName: d.companyName,
    streetAddress: d.streetAddress,
    ...(d.website.trim() ? { website: d.website.trim() } : {}),
    ...(d.companyType ? { companyType: d.companyType } : {}),
    ...(d.ownership ? { ownership: d.ownership } : {}),
    ...(d.ownership === "other" && d.ownershipOther.trim() ? { ownershipOther: d.ownershipOther } : {}),
    businessActivity: d.businessActivity,
    tradeDirection: d.tradeDirection,
    ...(trading && d.tradeGoods.trim() ? { tradeGoods: d.tradeGoods } : {}),
    tradeCountries: trading ? d.tradeCountries : [],
    ...(d.contactRole ? { contactRole: d.contactRole } : {}),
    firstName: d.firstName,
    lastName: d.lastName,
    ...(d.gender ? { gender: d.gender } : {}),
    phoneE164: d.phoneE164,
    email: d.email,
    ...(d.idOnFile
      ? { useDocumentOnFile: true }
      : { idDocument: { documentType: d.idDocumentType, documentNumber: d.idDocumentNumber } }),
    dateOfBirth: d.dateOfBirth,
    consent: d.consent,
  };
}

export function psfPriceOf(t: Pick<PsfTier, "priceKind" | "annualFeeRwf" | "annualFeeMinRwf" | "annualFeeMaxRwf">): string {
  if (t.priceKind === "fixed" && t.annualFeeRwf !== null) return `${formatRwf(t.annualFeeRwf)} a year`;
  if (t.priceKind === "range" && t.annualFeeMinRwf !== null && t.annualFeeMaxRwf !== null) {
    return `${formatRwf(t.annualFeeMinRwf)} to ${formatRwf(t.annualFeeMaxRwf)} a year`;
  }
  return "Price set by PSF";
}

const options = <T extends string>(values: readonly T[], labels: Readonly<Record<T, string>>) =>
  values.map((value) => ({ value, label: labels[value] }));

export function StepPsf({
  tiers,
  tiersFailed,
  onRetryTiers,
  draft,
  onChange,
  registrationNumber,
  errors,
  formError,
  busy,
  onBack,
  onNext,
  onSkip,
}: {
  tiers: PsfTier[] | null;
  tiersFailed: boolean;
  onRetryTiers: () => void;
  draft: PsfDraft;
  onChange: (next: PsfDraft) => void;
  registrationNumber: string;
  errors: Record<string, string>;
  formError: string;
  busy: boolean;
  onBack: () => void;
  onNext: () => void;
  /** Change the answer to "not now", which drops this step. */
  onSkip: () => void;
}) {
  const [countryToAdd, setCountryToAdd] = useState("");
  const set = <K extends keyof PsfDraft>(key: K, value: PsfDraft[K]) => onChange({ ...draft, [key]: value });
  const err = (key: string) => errors[`psf.${key}`];
  const chosen = tiers?.find((t) => t.code === draft.requestedTierCode) ?? null;

  return (
    <section aria-labelledby="step-psf">
      <h2 id="step-psf" className="text-xl font-semibold tracking-tight">
        Apply for PSF membership
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The Private Sector Federation&apos;s own form. It goes to a PSF membership officer once the Rwanda Revenue
        Authority has checked your TIN. Changed your mind?{" "}
        <button type="button" onClick={onSkip} className="font-semibold text-accent-text underline underline-offset-2">
          Skip it for now
        </button>
        ; you can apply later from your workspace.
      </p>

      <div className="mt-6 space-y-6">
        <Notice tone="info">{PSF_FEE_NOTICE}</Notice>

        <Fieldset legend="Pick a membership" error={err("requestedTierCode")}>
          {tiersFailed ? (
            <Notice tone="warning">
              We couldn&apos;t load PSF&apos;s tiers.{" "}
              <button type="button" onClick={onRetryTiers} className="font-semibold underline underline-offset-2">
                Try again
              </button>
            </Notice>
          ) : tiers === null ? (
            <p className="text-sm text-muted-foreground">Loading the tiers</p>
          ) : (
            <div className="space-y-4">
              {PsfMembershipFamily.options
                .map((family) => ({ family, group: tiers.filter((t) => t.family === family) }))
                .filter((g) => g.group.length > 0)
                .map(({ family, group }) => (
                  <div key={family}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {PSF_FAMILY_LABEL[family]}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {group.map((t) => (
                        <ChoiceCard
                          key={t.code}
                          name="psfTier"
                          value={t.code}
                          checked={draft.requestedTierCode === t.code}
                          title={t.nameEn}
                          description={psfPriceOf(t)}
                          onSelect={(v) => set("requestedTierCode", v)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              {chosen && chosen.benefitsEn.length > 0 ? (
                <div className="rounded-card border border-border bg-secondary p-4">
                  <p className="text-sm font-semibold">What {chosen.nameEn} includes</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {chosen.benefitsEn.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </Fieldset>

        <Fieldset legend="Your business, as PSF records it">
          <div className="space-y-4">
            <Field label="Registration" hint="Your TIN. PSF's form records the business under it.">
              <TextInput value={`TIN ${registrationNumber}`} readOnly disabled />
            </Field>
            <Field label="Company name" error={err("companyName")} required>
              <TextInput value={draft.companyName} onChange={(e) => set("companyName", e.target.value)} />
            </Field>
            <Field label="Street address" error={err("streetAddress")} required>
              <TextInput value={draft.streetAddress} onChange={(e) => set("streetAddress", e.target.value)} />
            </Field>
            <Field label="Website" hint="Optional." error={err("website")}>
              <TextInput value={draft.website} placeholder="https://" onChange={(e) => set("website", e.target.value)} />
            </Field>
            <Field label="Company type" error={err("companyType")} required>
              <SelectField
                value={draft.companyType}
                onChange={(v) => set("companyType", v)}
                options={options(PsfCompanyType.options, PSF_COMPANY_TYPE_LABEL)}
                placeholder="Choose"
                invalid={Boolean(err("companyType"))}
              />
            </Field>
            <Field label="Ownership" error={err("ownership")} required>
              <SelectField
                value={draft.ownership}
                onChange={(v) => set("ownership", v)}
                options={options(PsfOwnership.options, PSF_OWNERSHIP_LABEL)}
                placeholder="Choose"
                invalid={Boolean(err("ownership"))}
              />
            </Field>
            {draft.ownership === "other" ? (
              <Field label="What is the ownership?" error={err("ownershipOther")} required>
                <TextInput value={draft.ownershipOther} onChange={(e) => set("ownershipOther", e.target.value)} />
              </Field>
            ) : null}
            <Field label="Business activity" error={err("businessActivity")} required>
              <TextInput value={draft.businessActivity} onChange={(e) => set("businessActivity", e.target.value)} />
            </Field>
            <Field label="Do you export or import?" error={err("tradeDirection")} required>
              <SelectField
                value={draft.tradeDirection}
                onChange={(v) => set("tradeDirection", v)}
                options={options(PsfTradeDirection.options, PSF_TRADE_DIRECTION_LABEL)}
              />
            </Field>
            {draft.tradeDirection !== "none" ? (
              <>
                <Field label="Which goods or services?" error={err("tradeGoods")} required>
                  <TextInput value={draft.tradeGoods} onChange={(e) => set("tradeGoods", e.target.value)} />
                </Field>
                <Field label="Which countries?" error={err("tradeCountries") ?? err("tradeCountries.0")} required>
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <SelectField
                        value={countryToAdd}
                        onChange={setCountryToAdd}
                        options={COUNTRIES.filter((c) => !draft.tradeCountries.includes(c.code)).map((c) => ({
                          value: c.code,
                          label: c.name,
                        }))}
                        placeholder="Choose a country"
                      />
                    </div>
                    <Button
                      variant="secondary"
                      isDisabled={!countryToAdd}
                      onPress={() => {
                        set("tradeCountries", [...draft.tradeCountries, countryToAdd]);
                        setCountryToAdd("");
                      }}
                    >
                      Add
                    </Button>
                  </div>
                  {draft.tradeCountries.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {draft.tradeCountries.map((code) => (
                        <Button
                          key={code}
                          size="sm"
                          variant="secondary"
                          onPress={() => set("tradeCountries", draft.tradeCountries.filter((c) => c !== code))}
                          aria-label={`Remove ${COUNTRIES.find((c) => c.code === code)?.name ?? code}`}
                        >
                          {COUNTRIES.find((c) => c.code === code)?.name ?? code} ×
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </Field>
              </>
            ) : null}
          </div>
        </Fieldset>

        <Fieldset legend="The person PSF will contact">
          <div className="space-y-4">
            <Field label="Role" error={err("contactRole")} required>
              <SelectField
                value={draft.contactRole}
                onChange={(v) => set("contactRole", v)}
                options={options(PsfContactRole.options, PSF_CONTACT_ROLE_LABEL)}
                placeholder="Choose"
                invalid={Boolean(err("contactRole"))}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" error={err("firstName")} required>
                <TextInput value={draft.firstName} onChange={(e) => set("firstName", e.target.value)} />
              </Field>
              <Field label="Last name" error={err("lastName")} required>
                <TextInput value={draft.lastName} onChange={(e) => set("lastName", e.target.value)} />
              </Field>
            </div>
            <Field
              label="Gender"
              hint="PSF's form asks for Male or Female. Your own profile is not changed."
              error={err("gender")}
              required
            >
              <SelectField
                value={draft.gender}
                onChange={(v) => set("gender", v)}
                options={[
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                ]}
                placeholder="Choose"
                invalid={Boolean(err("gender"))}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone" error={err("phoneE164")} required>
                <TextInput value={draft.phoneE164} placeholder="+250788123456" onChange={(e) => set("phoneE164", e.target.value)} />
              </Field>
              <Field label="Email" error={err("email")} required>
                <TextInput type="email" value={draft.email} onChange={(e) => set("email", e.target.value)} />
              </Field>
            </div>
            {draft.idOnFile ? (
              <div>
                <span className="text-sm font-semibold">ID</span>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-sm">
                  <span>{draft.idOnFile}, from your profile</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={() => onChange({ ...draft, idOnFile: null })}
                  >
                    Use a different ID
                  </Button>
                </p>
              </div>
            ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="ID type" required>
                <SelectField
                  value={draft.idDocumentType}
                  onChange={(v) => set("idDocumentType", v)}
                  options={[
                    { value: "national_id", label: "National ID" },
                    { value: "passport", label: "Passport" },
                  ]}
                />
              </Field>
              <Field label="ID number" error={err("idDocument.documentNumber")} required>
                <TextInput value={draft.idDocumentNumber} onChange={(e) => set("idDocumentNumber", e.target.value)} />
              </Field>
            </div>
            )}
            <Field label="Date of birth" error={err("dateOfBirth")} required>
              <TextInput type="date" value={draft.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
            </Field>
          </div>
        </Fieldset>

        <div>
          <Checkbox
            isSelected={draft.consent}
            onChange={(on) => set("consent", on)}
            className="flex items-start gap-3 text-sm"
          >
            {PSF_CONSENT_TEXT}
          </Checkbox>
          {err("consent") ? <p className="mt-1 text-sm text-danger">{err("consent")}</p> : null}
        </div>

        {formError ? <Notice tone="danger">{formError}</Notice> : null}

        <StepActions onBack={onBack} onNext={onNext} nextLabel="Review" busy={busy} />
      </div>
    </section>
  );
}
