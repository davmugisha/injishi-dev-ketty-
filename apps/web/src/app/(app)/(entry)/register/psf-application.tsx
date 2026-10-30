"use client";

import {
  PSF_COMPANY_TYPE_LABEL,
  PSF_CONSENT_TEXT,
  PSF_CONTACT_ROLE_LABEL,
  PSF_FEE_NOTICE,
  PSF_OWNERSHIP_LABEL,
  PSF_TRADE_DIRECTION_LABEL,
  PsfCompanyType,
  PsfContactRole,
  PsfOwnership,
  PsfTradeDirection,
  countryName,
  type PsfTier,
} from "@injishi/contracts";
import { Badge, Button, Checkbox } from "@injishi/web-ui";
import { X } from "lucide-react";

import { formatRwf } from "@/lib/money";

import { COUNTRY_OPTIONS } from "./country-options";
import { PhoneInput } from "./phone-input";
import { ChoiceCard, Field, Fieldset, SelectField, TextInput } from "./wizard-ui";

/**
 * PSF's own membership form (ADR-056), as the registration artboard draws it
 * under "Apply now": sent with the registration as `business.psfApplication`,
 * written in the same transaction, and passed to PSF only once the district's
 * PSF officer approves the business. Injishi takes no payment for PSF
 * (`PSF_FEE_NOTICE`).
 *
 * What the wizard already knows is filled in (the name RRA holds, the company
 * type, the name, birth date and phone), so most of it is read and confirmed
 * rather than typed. This form sits on Business, step one, BEFORE You asks for
 * the ID, so nothing has been checked in this walk yet: the ID it names is one
 * already on file, from an earlier scan or the account (`useDocumentOnFile`),
 * when there is one. With none it asks for a National ID or a passport, the two
 * `PsfIdDocument` takes; an ID recorded on You afterwards replaces the typed
 * one, because the request then names the document on file.
 */

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
  dateOfBirth: string;
  /** Only when no document is on file to use: which ID, and its number. */
  idType: "national_id" | "passport";
  idNumber: string;
  consent: boolean;
}

export const EMPTY_PSF: PsfDraft = {
  requestedTierCode: "",
  companyName: "",
  streetAddress: "",
  website: "",
  companyType: "private_company",
  ownership: "rwandan_100",
  ownershipOther: "",
  businessActivity: "",
  tradeDirection: "none",
  tradeGoods: "",
  tradeCountries: [],
  contactRole: "managing_director",
  firstName: "",
  lastName: "",
  gender: "",
  phoneE164: "",
  email: "",
  dateOfBirth: "",
  idType: "national_id",
  idNumber: "",
  consent: false,
};

/** The draft in the contract's shape: absent optionals absent, the ID from file when there is one. */
export function psfCandidate(d: PsfDraft, documentOnFile: boolean): unknown {
  const trading = d.tradeDirection !== "none";
  return {
    requestedTierCode: d.requestedTierCode,
    companyName: d.companyName,
    streetAddress: d.streetAddress,
    ...(d.website.trim() ? { website: d.website.trim() } : {}),
    companyType: d.companyType,
    ownership: d.ownership,
    ...(d.ownership === "other" ? { ownershipOther: d.ownershipOther } : {}),
    businessActivity: d.businessActivity,
    tradeDirection: d.tradeDirection,
    ...(trading ? { tradeGoods: d.tradeGoods } : {}),
    tradeCountries: trading ? d.tradeCountries : [],
    contactRole: d.contactRole,
    firstName: d.firstName,
    lastName: d.lastName,
    gender: d.gender,
    phoneE164: d.phoneE164,
    email: d.email,
    ...(documentOnFile
      ? { useDocumentOnFile: true }
      : {
          idDocument:
            d.idType === "passport"
              ? { documentType: "passport", documentNumber: d.idNumber }
              : { documentType: "national_id", documentNumber: d.idNumber.replace(/\s+/g, "") },
        }),
    dateOfBirth: d.dateOfBirth,
    ...(d.consent ? { consent: true } : {}),
  };
}

function tierLabel(t: PsfTier): string {
  if (t.priceKind === "fixed" && t.annualFeeRwf !== null) return `${t.nameEn}, ${formatRwf(t.annualFeeRwf)} a year`;
  if (t.priceKind === "range" && t.annualFeeMinRwf !== null && t.annualFeeMaxRwf !== null)
    return `${t.nameEn}, ${formatRwf(t.annualFeeMinRwf)} to ${formatRwf(t.annualFeeMaxRwf)} a year`;
  return `${t.nameEn}, priced by PSF`;
}

const opts = <T extends string>(values: readonly T[], labels: Readonly<Record<T, string>>) =>
  values.map((v) => ({ value: v, label: labels[v] }));

export function PsfApplication({
  draft,
  onChange,
  tiers,
  tiersFailed,
  onRetryTiers,
  documentLine,
  errors,
}: {
  draft: PsfDraft;
  onChange: (next: PsfDraft) => void;
  /** Null while loading or when the tiers could not be read. */
  tiers: PsfTier[] | null;
  tiersFailed: boolean;
  onRetryTiers: () => void;
  /** "National ID ending 6789, already checked", or null when no document is on file. */
  documentLine: string | null;
  errors: Record<string, string>;
}) {
  const set = <K extends keyof PsfDraft>(key: K, value: PsfDraft[K]) => onChange({ ...draft, [key]: value });
  const e = (k: string) => errors[`psf.${k}`];
  const trading = draft.tradeDirection !== "none";

  return (
    <div className="flex flex-col gap-5 rounded-card bg-secondary p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-base font-semibold">PSF membership application</h4>
        <Badge variant="subtle" size="sm">
          Sent to PSF after approval
        </Badge>
      </div>

      <div className="max-w-form">
        <Field label="Membership tier" hint={PSF_FEE_NOTICE} error={e("requestedTierCode")}>
          <SelectField
            id="psf-tier"
            value={draft.requestedTierCode}
            placeholder={tiersFailed ? "Could not load tiers" : tiers === null ? "Loading PSF's tiers…" : tiers.some((t) => t.active) ? "Pick a tier" : "No active tiers"}
            disabled={tiersFailed || tiers === null || !tiers.some((t) => t.active)}
            invalid={Boolean(e("requestedTierCode"))}
            options={(tiers ?? []).filter((t) => t.active).map((t) => ({ value: t.code, label: tierLabel(t) }))}
            onChange={(v) => set("requestedTierCode", v)}
          />
        </Field>
        {tiersFailed || (tiers !== null && !tiers.some((t) => t.active)) ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-destructive" role="alert">
            <span>{tiersFailed ? "We couldn't load PSF's membership tiers." : "PSF has no active membership tiers right now."}</span>
            <Button variant="ghost" size="sm" onClick={onRetryTiers}>Try again</Button>
          </div>
        ) : null}
      </div>

      <p className="text-sm font-semibold">The business</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name PSF records" error={e("companyName")}>
          <TextInput className="w-full" value={draft.companyName} onChange={(ev) => set("companyName", ev.target.value)} />
        </Field>
        <Field label="Street address" error={e("streetAddress")}>
          <TextInput className="w-full" value={draft.streetAddress} onChange={(ev) => set("streetAddress", ev.target.value)} />
        </Field>
        <Field label="Website (optional)" error={e("website")}>
          <TextInput
            className="w-full"
            type="url"
            placeholder="https://"
            value={draft.website}
            onChange={(ev) => set("website", ev.target.value)}
          />
        </Field>
        <Field label="Company type" error={e("companyType")}>
          <SelectField
            value={draft.companyType}
            options={opts(PsfCompanyType.options, PSF_COMPANY_TYPE_LABEL)}
            onChange={(v) => set("companyType", v)}
          />
        </Field>
        <Field label="Ownership" error={e("ownership")}>
          <SelectField
            value={draft.ownership}
            options={opts(PsfOwnership.options, PSF_OWNERSHIP_LABEL)}
            onChange={(v) => onChange({ ...draft, ownership: v, ownershipOther: v === "other" ? draft.ownershipOther : "" })}
          />
        </Field>
        {draft.ownership === "other" ? (
          <Field label="What the ownership is" error={e("ownershipOther")}>
            <TextInput className="w-full" value={draft.ownershipOther} onChange={(ev) => set("ownershipOther", ev.target.value)} />
          </Field>
        ) : null}
        <Field label="Export or import" error={e("tradeDirection")}>
          <SelectField
            value={draft.tradeDirection}
            options={opts(PsfTradeDirection.options, PSF_TRADE_DIRECTION_LABEL).map((o) =>
              o.value === "none" ? { ...o, label: "Neither" } : o,
            )}
            onChange={(v) =>
              onChange({ ...draft, tradeDirection: v, ...(v === "none" ? { tradeGoods: "", tradeCountries: [] } : {}) })
            }
          />
        </Field>
      </div>
      {trading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Which goods or services" error={e("tradeGoods")}>
            <TextInput className="w-full" value={draft.tradeGoods} onChange={(ev) => set("tradeGoods", ev.target.value)} />
          </Field>
          <Field label="To or from which countries" error={e("tradeCountries")}>
            <SelectField
              value=""
              placeholder="Add a country"
              options={COUNTRY_OPTIONS.filter((c) => !draft.tradeCountries.includes(c.value))}
              onChange={(code) => code && set("tradeCountries", [...draft.tradeCountries, code])}
            />
          </Field>
          {draft.tradeCountries.length ? (
            <ul className="flex flex-wrap gap-2 sm:col-span-2" aria-label="Countries">
              {draft.tradeCountries.map((code) => (
                <li key={code} className="flex items-center gap-1 rounded-full bg-card py-0.5 pl-3 pr-1 text-xs font-medium">
                  {countryName(code)}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${countryName(code)}`}
                    onClick={() => set("tradeCountries", draft.tradeCountries.filter((c) => c !== code))}
                  >
                    <X size={14} aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <Field label="What the business does" error={e("businessActivity")}>
        <TextInput
          className="w-full"
          placeholder="Hotel rooms, a restaurant and conference rooms"
          value={draft.businessActivity}
          onChange={(ev) => set("businessActivity", ev.target.value)}
        />
      </Field>

      <p className="text-sm font-semibold">The contact person</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Role" error={e("contactRole")}>
          <SelectField
            value={draft.contactRole}
            options={opts(PsfContactRole.options, PSF_CONTACT_ROLE_LABEL)}
            onChange={(v) => set("contactRole", v)}
          />
        </Field>
        <Field label="First name" error={e("firstName")}>
          <TextInput className="w-full" value={draft.firstName} onChange={(ev) => set("firstName", ev.target.value)} />
        </Field>
        <Field label="Last name" error={e("lastName")}>
          <TextInput className="w-full" value={draft.lastName} onChange={(ev) => set("lastName", ev.target.value)} />
        </Field>
        {/* A row of its own: the country picker and the number side by side
            do not fit half a card. */}
        <div className="sm:col-span-2">
          <Field label="Phone" composite error={e("phoneE164")}>
            <PhoneInput id="psf-phone" value={draft.phoneE164} invalid={Boolean(e("phoneE164"))} onChange={(v) => set("phoneE164", v)} />
          </Field>
        </div>
        <Field label="Email" error={e("email")}>
          <TextInput className="w-full" type="email" value={draft.email} onChange={(ev) => set("email", ev.target.value)} />
        </Field>
        <Field label="Date of birth" error={e("dateOfBirth")}>
          <TextInput className="w-full tabular-nums" type="date" value={draft.dateOfBirth} onChange={(ev) => set("dateOfBirth", ev.target.value)} />
        </Field>
      </div>

      <Fieldset
        legend="Gender, as PSF's form asks it"
        hint="This goes to PSF only. Your Injishi profile keeps your own answer."
        error={e("gender")}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["male", "Male"],
              ["female", "Female"],
            ] as const
          ).map(([value, label]) => (
            <ChoiceCard
              key={value}
              name="psf-gender"
              value={value}
              checked={draft.gender === value}
              title={label}
              onSelect={() => set("gender", value)}
            />
          ))}
        </div>
      </Fieldset>

      {documentLine ? (
        <dl className="flex flex-wrap gap-x-4 gap-y-1 rounded-card bg-card px-4 py-3 text-sm">
          <dt className="text-muted-foreground">ID for PSF</dt>
          <dd className="font-medium">{documentLine}</dd>
        </dl>
      ) : (
        <div className="grid max-w-form gap-4 sm:grid-cols-2">
          <Field label="ID for PSF">
            <SelectField
              id="psf-id-type"
              value={draft.idType}
              options={[
                { value: "national_id", label: "Rwandan National ID" },
                { value: "passport", label: "Passport" },
              ]}
              onChange={(v) => onChange({ ...draft, idType: v === "passport" ? "passport" : "national_id", idNumber: "" })}
            />
          </Field>
          <Field
            label={draft.idType === "passport" ? "Passport number" : "National ID number"}
            hint={draft.idType === "passport" ? "6 to 12 letters or digits" : "16 digits"}
            error={e("idDocument.documentNumber") ?? e("idDocument")}
          >
            <TextInput
              className="w-full tabular-nums"
              inputMode={draft.idType === "passport" ? "text" : "numeric"}
              value={draft.idNumber}
              onChange={(ev) => set("idNumber", ev.target.value)}
            />
          </Field>
        </div>
      )}

      <Checkbox
        isSelected={draft.consent}
        onChange={(on: boolean) => set("consent", on)}
        className="items-start gap-3"
        controlClassName="mt-0.5"
      >
        <span className="text-sm">{PSF_CONSENT_TEXT}</span>
      </Checkbox>
      {e("consent") ? (
        <span role="alert" className="-mt-3 text-sm text-destructive">
          {e("consent")}
        </span>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Injishi sends this to PSF only after your business is approved. If it never is, PSF never sees it.
      </p>
    </div>
  );
}
