"use client";

/**
 * The PSF membership application, as the workspace asks it (ADR-056 AC-2 to
 * AC-5, AC-16).
 *
 * The same questions as PSF's paper form, starting from what the server
 * already knows (`prefill`), and checked against `PsfApplicationInput`, the
 * schema the API validates the POST with, so the page and the server refuse
 * the same thing for the same reason. The registration number is the TIN and
 * is shown, never asked.
 */
import { useMemo, useState } from "react";

import {
  COUNTRIES,
  PSF_COMPANY_TYPE_LABEL,
  PSF_CONSENT_TEXT,
  PSF_CONTACT_ROLE_LABEL,
  PSF_FAMILY_LABEL,
  PSF_FEE_NOTICE,
  PSF_OWNERSHIP_LABEL,
  PSF_TRADE_DIRECTION_LABEL,
  PsfApplicationInput,
  PsfCompanyType,
  PsfContactRole,
  PsfMembershipFamily,
  PsfOwnership,
  PsfTradeDirection,
  type PsfApplicationPrefill,
  type PsfTier,
} from "@injishi/contracts";
import { Button, Checkbox, Input } from "@injishi/ui";
import { formatPrice } from "@injishi/utils";

import { cn } from "@/lib/utils";
import { ActionButton, surfaceClass } from "./ui";

const selectClass =
  "h-10 w-full rounded border border-line2 bg-field px-2 text-sm text-foreground disabled:opacity-50";

export function priceOf(t: Pick<PsfTier, "priceKind" | "annualFeeRwf" | "annualFeeMinRwf" | "annualFeeMaxRwf">): string {
  if (t.priceKind === "fixed" && t.annualFeeRwf !== null) return `${formatPrice(t.annualFeeRwf)} a year`;
  if (t.priceKind === "range" && t.annualFeeMinRwf !== null && t.annualFeeMaxRwf !== null) {
    return `${formatPrice(t.annualFeeMinRwf)} to ${formatPrice(t.annualFeeMaxRwf)} a year`;
  }
  return "Price set by PSF";
}

interface Draft {
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
  dateOfBirth: string;
  consent: boolean;
}

function draftFrom(prefill: PsfApplicationPrefill, tiers: PsfTier[]): Draft {
  return {
    requestedTierCode: tiers[0]?.code ?? "",
    companyName: prefill.companyName ?? "",
    streetAddress: prefill.streetAddress ?? "",
    website: prefill.website ?? "",
    companyType: prefill.companyType ?? "",
    ownership: prefill.ownership ?? "",
    ownershipOther: prefill.ownershipOther ?? "",
    businessActivity: prefill.businessActivity ?? "",
    tradeDirection: prefill.tradeDirection ?? "none",
    tradeGoods: prefill.tradeGoods ?? "",
    tradeCountries: prefill.tradeCountries ?? [],
    contactRole: prefill.contactRole ?? "",
    firstName: prefill.firstName ?? "",
    lastName: prefill.lastName ?? "",
    gender: prefill.gender ?? "",
    phoneE164: prefill.phoneE164 ?? "",
    email: prefill.email ?? "",
    idDocumentType: prefill.idDocumentType ?? "national_id",
    idDocumentNumber: prefill.idDocumentNumber ?? "",
    dateOfBirth: prefill.dateOfBirth ?? "",
    consent: false,
  };
}

/** The draft as the wire wants it: empty optional fields left out. */
function candidateOf(d: Draft): unknown {
  const trading = d.tradeDirection !== "none";
  return {
    requestedTierCode: d.requestedTierCode,
    companyName: d.companyName,
    streetAddress: d.streetAddress,
    ...(d.website.trim() ? { website: d.website.trim() } : {}),
    companyType: d.companyType || undefined,
    ownership: d.ownership || undefined,
    ...(d.ownership === "other" && d.ownershipOther.trim() ? { ownershipOther: d.ownershipOther } : {}),
    businessActivity: d.businessActivity,
    tradeDirection: d.tradeDirection,
    ...(trading && d.tradeGoods.trim() ? { tradeGoods: d.tradeGoods } : {}),
    tradeCountries: trading ? d.tradeCountries : [],
    contactRole: d.contactRole || undefined,
    firstName: d.firstName,
    lastName: d.lastName,
    gender: d.gender || undefined,
    phoneE164: d.phoneE164,
    email: d.email,
    idDocument: { documentType: d.idDocumentType, documentNumber: d.idDocumentNumber },
    dateOfBirth: d.dateOfBirth,
    consent: d.consent,
  };
}

export function PsfApplicationForm({
  tiers,
  prefill,
  registrationNumber,
  submitting,
  refusal,
  onSubmit,
  onCancel,
}: {
  tiers: PsfTier[];
  prefill: PsfApplicationPrefill;
  registrationNumber: string;
  submitting: boolean;
  refusal: string | null;
  onSubmit: (input: PsfApplicationInput) => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState<Draft>(() => draftFrom(prefill, tiers));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [countryToAdd, setCountryToAdd] = useState("");
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((prev) => ({ ...prev, [key]: value }));

  const byFamily = useMemo(
    () =>
      PsfMembershipFamily.options
        .map((family) => ({ family, tiers: tiers.filter((t) => t.family === family) }))
        .filter((g) => g.tiers.length > 0),
    [tiers],
  );

  const submit = () => {
    const parsed = PsfApplicationInput.safeParse(candidateOf(d));
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  };

  const err = (key: string) => errors[key];

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="pms-display text-lg font-bold text-ink">Pick a membership</h3>
        <p className="mt-1 text-xs text-muted-foreground">{PSF_FEE_NOTICE}</p>
        <div className="mt-3 flex flex-col gap-4">
          {byFamily.map(({ family, tiers: group }) => (
            <div key={family}>
              <p className="mb-2 text-2xs font-bold uppercase tracking-wide text-muted-foreground">
                {PSF_FAMILY_LABEL[family]}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.map((t) => {
                  const on = d.requestedTierCode === t.code;
                  return (
                    <Button
                      key={t.code}
                      type="button"
                      variant="ghost"
                      aria-pressed={on}
                      onClick={() => set("requestedTierCode", t.code)}
                      className={cn(
                        "h-auto flex-col items-start gap-1 rounded border px-3.5 py-3 text-left",
                        on ? "border-accent-text bg-accent-soft" : "border-line2 bg-field hover:bg-hover",
                      )}
                    >
                      <span className="text-sm font-semibold text-ink">{t.nameEn}</span>
                      <span className="text-xs text-muted-foreground">{priceOf(t)}</span>
                      {t.benefitsEn.length > 0 && (
                        <ul className="mt-1 list-disc pl-4 text-2xs text-muted-foreground">
                          {t.benefitsEn.map((b) => (
                            <li key={b} className="whitespace-normal">
                              {b}
                            </li>
                          ))}
                        </ul>
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
          {err("requestedTierCode") && <p className="text-xs text-bad">{err("requestedTierCode")}</p>}
        </div>
      </section>

      <section className={cn(surfaceClass, "flex flex-col gap-3 p-4")}>
        <h3 className="text-sm font-bold text-ink">Your business</h3>
        <Field label="Registration" hint="Your TIN, as PSF's form records it.">
          <Input value={`TIN ${registrationNumber}`} readOnly disabled />
        </Field>
        <Field label="Company name" error={err("companyName")}>
          <Input value={d.companyName} onChange={(e) => set("companyName", e.target.value)} />
        </Field>
        <Field label="Street address" error={err("streetAddress")}>
          <Input value={d.streetAddress} onChange={(e) => set("streetAddress", e.target.value)} />
        </Field>
        <Field label="Website (optional)" error={err("website")}>
          <Input value={d.website} placeholder="https://" onChange={(e) => set("website", e.target.value)} />
        </Field>
        <Field label="Company type" error={err("companyType")}>
          <select className={selectClass} value={d.companyType} onChange={(e) => set("companyType", e.target.value)}>
            <option value="">Choose</option>
            {PsfCompanyType.options.map((o) => (
              <option key={o} value={o}>
                {PSF_COMPANY_TYPE_LABEL[o]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ownership" error={err("ownership")}>
          <select className={selectClass} value={d.ownership} onChange={(e) => set("ownership", e.target.value)}>
            <option value="">Choose</option>
            {PsfOwnership.options.map((o) => (
              <option key={o} value={o}>
                {PSF_OWNERSHIP_LABEL[o]}
              </option>
            ))}
          </select>
        </Field>
        {d.ownership === "other" && (
          <Field label="What is the ownership?" error={err("ownershipOther")}>
            <Input value={d.ownershipOther} onChange={(e) => set("ownershipOther", e.target.value)} />
          </Field>
        )}
        <Field label="Business activity" error={err("businessActivity")}>
          <Input value={d.businessActivity} onChange={(e) => set("businessActivity", e.target.value)} />
        </Field>
        <Field label="Do you export or import?" error={err("tradeDirection")}>
          <select className={selectClass} value={d.tradeDirection} onChange={(e) => set("tradeDirection", e.target.value)}>
            {PsfTradeDirection.options.map((o) => (
              <option key={o} value={o}>
                {PSF_TRADE_DIRECTION_LABEL[o]}
              </option>
            ))}
          </select>
        </Field>
        {d.tradeDirection !== "none" && (
          <>
            <Field label="Which goods or services?" error={err("tradeGoods")}>
              <Input value={d.tradeGoods} onChange={(e) => set("tradeGoods", e.target.value)} />
            </Field>
            <Field label="Which countries?" error={err("tradeCountries") ?? err("tradeCountries.0")}>
              <div className="flex gap-2">
                <select className={selectClass} value={countryToAdd} onChange={(e) => setCountryToAdd(e.target.value)}>
                  <option value="">Choose a country</option>
                  {COUNTRIES.filter((c) => !d.tradeCountries.includes(c.code)).map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ActionButton
                  disabled={!countryToAdd}
                  onClick={() => {
                    set("tradeCountries", [...d.tradeCountries, countryToAdd]);
                    setCountryToAdd("");
                  }}
                >
                  Add
                </ActionButton>
              </div>
              {d.tradeCountries.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {d.tradeCountries.map((code) => (
                    <Button
                      key={code}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => set("tradeCountries", d.tradeCountries.filter((c) => c !== code))}
                      aria-label={`Remove ${COUNTRIES.find((c) => c.code === code)?.name ?? code}`}
                    >
                      {COUNTRIES.find((c) => c.code === code)?.name ?? code} ×
                    </Button>
                  ))}
                </div>
              )}
            </Field>
          </>
        )}
      </section>

      <section className={cn(surfaceClass, "flex flex-col gap-3 p-4")}>
        <h3 className="text-sm font-bold text-ink">The person PSF will contact</h3>
        <Field label="Role" error={err("contactRole")}>
          <select className={selectClass} value={d.contactRole} onChange={(e) => set("contactRole", e.target.value)}>
            <option value="">Choose</option>
            {PsfContactRole.options.map((o) => (
              <option key={o} value={o}>
                {PSF_CONTACT_ROLE_LABEL[o]}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name" error={err("firstName")}>
            <Input value={d.firstName} onChange={(e) => set("firstName", e.target.value)} />
          </Field>
          <Field label="Last name" error={err("lastName")}>
            <Input value={d.lastName} onChange={(e) => set("lastName", e.target.value)} />
          </Field>
        </div>
        <Field label="Gender" hint="PSF's form asks for Male or Female. Your own profile is not changed." error={err("gender")}>
          <select className={selectClass} value={d.gender} onChange={(e) => set("gender", e.target.value)}>
            <option value="">Choose</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Phone" error={err("phoneE164")}>
            <Input value={d.phoneE164} placeholder="+250788123456" onChange={(e) => set("phoneE164", e.target.value)} />
          </Field>
          <Field label="Email" error={err("email")}>
            <Input value={d.email} type="email" onChange={(e) => set("email", e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ID type">
            <select className={selectClass} value={d.idDocumentType} onChange={(e) => set("idDocumentType", e.target.value)}>
              <option value="national_id">National ID</option>
              <option value="passport">Passport</option>
            </select>
          </Field>
          <Field label="ID number" error={err("idDocument.documentNumber")}>
            <Input value={d.idDocumentNumber} onChange={(e) => set("idDocumentNumber", e.target.value)} />
          </Field>
        </div>
        <Field label="Date of birth" error={err("dateOfBirth")}>
          <Input type="date" value={d.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
        </Field>
      </section>

      <section className="flex flex-col gap-2">
        <Checkbox
          isSelected={d.consent}
          onChange={(on) => set("consent", on)}
          className="flex w-full items-start gap-2.5 text-sm font-normal text-ink"
        >
          {PSF_CONSENT_TEXT}
        </Checkbox>
        {err("consent") && <p className="text-xs text-bad">{err("consent")}</p>}
      </section>

      {refusal && <p className="rounded border border-bad bg-bad-bg px-3.5 py-3 text-xs text-bad">{refusal}</p>}

      <div className="flex flex-wrap gap-2.5">
        <ActionButton variant="primary" className="h-11" disabled={submitting} onClick={submit}>
          {submitting ? "Sending your application" : "Send to PSF"}
        </ActionButton>
        <ActionButton className="h-11" disabled={submitting} onClick={onCancel}>
          Cancel
        </ActionButton>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
      {label}
      {children}
      {hint && <span className="text-2xs font-normal text-muted-foreground">{hint}</span>}
      {error && <span className="text-xs font-normal text-bad">{error}</span>}
    </label>
  );
}
