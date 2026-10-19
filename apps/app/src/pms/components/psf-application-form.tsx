"use client";

/**
 * The PSF membership application, as the business's portal asks it (ADR-056
 * AC-2 to AC-5, AC-16, and the PSF path).
 *
 * It opens on the membership, in three short steps: the family (Golden Circle,
 * Indashyikirwa or Indatwa), the band inside it where a family has several,
 * and the amount the business will pay a year, which it chooses by what it can
 * afford inside that band. The amount is checked as it is typed with
 * `psfFeeProblem`, the rule the server applies on the POST, so the page and the
 * server refuse the same amount for the same reason.
 *
 * Then PSF's paper form, starting from what the server already knows
 * (`prefill`), and checked against `PsfApplicationInput`. The registration the
 * form is filed under is shown, never asked.
 */
import { useMemo, useState } from "react";
import { Check, Crown, Medal, Sprout } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  COUNTRIES,
  PSF_COMPANY_TYPE_LABEL,
  PSF_CONSENT_TEXT,
  PSF_CONTACT_ROLE_LABEL,
  PSF_FAMILY_BLURB,
  PSF_FAMILY_LABEL,
  PSF_FEE_NOTICE,
  PSF_OFFERED_FAMILIES,
  PSF_OWNERSHIP_LABEL,
  PSF_TRADE_DIRECTION_LABEL,
  PsfApplicationInput,
  PsfCompanyType,
  PsfContactRole,
  PsfOwnership,
  PsfTradeDirection,
  psfFeeProblem,
  psfStartingFee,
  type PsfApplicationPrefill,
  type PsfMembershipFamily,
  type PsfTier,
} from "@injishi/contracts";
import { Button, Checkbox, Input } from "@injishi/ui";
import { formatPrice } from "@injishi/utils";

import { cn } from "@/lib/utils";
import { ActionButton, surfaceClass } from "./ui";

const selectClass =
  "h-10 w-full rounded border border-line2 bg-field px-2 text-sm text-foreground disabled:opacity-50";

/** A tier's price in words: one amount, a band, a floor, or PSF's own. */
export function priceOf(t: Pick<PsfTier, "priceKind" | "annualFeeRwf" | "annualFeeMinRwf" | "annualFeeMaxRwf">): string {
  if (t.priceKind === "fixed" && t.annualFeeRwf !== null) return `${formatPrice(t.annualFeeRwf)} a year`;
  if (t.priceKind === "range" && t.annualFeeMinRwf !== null && t.annualFeeMaxRwf !== null) {
    return `${formatPrice(t.annualFeeMinRwf)} to ${formatPrice(t.annualFeeMaxRwf)} a year`;
  }
  if (t.priceKind === "minimum" && t.annualFeeMinRwf !== null) return `From ${formatPrice(t.annualFeeMinRwf)} a year`;
  return "Price set by PSF";
}

/** A band's ends, short, for a chip: `10,000 – 19,999`. */
function bandOf(t: PsfTier): string {
  const n = (v: number | null) => (v ?? 0).toLocaleString("en-US");
  if (t.priceKind === "range") return `${n(t.annualFeeMinRwf)} – ${n(t.annualFeeMaxRwf)}`;
  if (t.priceKind === "minimum") return `${n(t.annualFeeMinRwf)} and up`;
  if (t.priceKind === "fixed") return n(t.annualFeeRwf);
  return "Set by PSF";
}

/** A family's whole span, from its lowest band to its highest. */
function familySpan(group: PsfTier[]): string {
  const mins = group.map((t) => t.annualFeeMinRwf ?? t.annualFeeRwf).filter((v): v is number => v !== null);
  const maxes = group.map((t) => (t.priceKind === "minimum" ? null : (t.annualFeeMaxRwf ?? t.annualFeeRwf)));
  if (mins.length === 0) return "Price set by PSF";
  const low = Math.min(...mins);
  if (maxes.some((v) => v === null)) return `From ${formatPrice(low)}`;
  const high = Math.max(...(maxes as number[]));
  return `${formatPrice(low)} to ${formatPrice(high)}`;
}

const FAMILY_ICON: Partial<Record<PsfMembershipFamily, LucideIcon>> = {
  golden_circle: Crown,
  indashyikirwa: Medal,
  indatwa: Sprout,
};

/** Highest band first inside a family, so the list reads from the top down. */
const byBandDesc = (a: PsfTier, b: PsfTier) => (b.annualFeeMinRwf ?? b.annualFeeRwf ?? 0) - (a.annualFeeMinRwf ?? a.annualFeeRwf ?? 0);

interface Draft {
  requestedTierCode: string;
  declaredFee: string;
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

function draftFrom(prefill: PsfApplicationPrefill): Draft {
  return {
    requestedTierCode: "",
    declaredFee: "",
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

/** Digits only, as an amount: `150,000` and `150 000` are both 150000. */
function amountOf(raw: string): number | null {
  const digits = raw.replace(/[\s,]/g, "");
  return /^\d+$/.test(digits) ? Number(digits) : null;
}

/** The draft as the wire wants it: empty optional fields left out. */
function candidateOf(d: Draft, tier: PsfTier | null): unknown {
  const trading = d.tradeDirection !== "none";
  const amount = amountOf(d.declaredFee);
  return {
    requestedTierCode: d.requestedTierCode,
    ...(tier && tier.priceKind !== "set_by_psf" && amount !== null ? { declaredFeeRwf: amount } : {}),
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
  registrationLabel,
  submitting,
  refusal,
  refusalField,
  onSubmit,
  onCancel,
}: {
  tiers: PsfTier[];
  prefill: PsfApplicationPrefill;
  /** What PSF's form is filed under, in words: `TIN 123456789`, `Not registered yet`. */
  registrationLabel: string;
  submitting: boolean;
  refusal: string | null;
  /** A refusal the server tied to one field, so it shows under that field. */
  refusalField?: { path: string; message: string } | null;
  onSubmit: (input: PsfApplicationInput) => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState<Draft>(() => draftFrom(prefill));
  const [family, setFamily] = useState<PsfMembershipFamily | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [countryToAdd, setCountryToAdd] = useState("");
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((prev) => ({ ...prev, [key]: value }));

  const families = useMemo(
    () =>
      PSF_OFFERED_FAMILIES.map((f) => ({ family: f, tiers: tiers.filter((t) => t.family === f).sort(byBandDesc) })).filter(
        (g) => g.tiers.length > 0,
      ),
    [tiers],
  );
  const group = families.find((g) => g.family === family)?.tiers ?? [];
  const tier = tiers.find((t) => t.code === d.requestedTierCode) ?? null;
  const amount = amountOf(d.declaredFee);
  const amountProblem = tier && d.declaredFee.trim() ? psfFeeProblem(tier, amount) : null;

  const pickTier = (t: PsfTier) => {
    setD((prev) => ({
      ...prev,
      requestedTierCode: t.code,
      declaredFee: psfStartingFee(t) !== null ? String(psfStartingFee(t)) : "",
    }));
    setErrors((e) => ({ ...e, requestedTierCode: "", declaredFeeRwf: "" }));
  };

  const pickFamily = (f: PsfMembershipFamily) => {
    setFamily(f);
    const first = families.find((g) => g.family === f)?.tiers ?? [];
    // A family with one tier is its own band: picking it picks the tier.
    if (first.length === 1 && first[0]) pickTier(first[0]);
    else setD((prev) => ({ ...prev, requestedTierCode: "", declaredFee: "" }));
  };

  const submit = () => {
    const next: Record<string, string> = {};
    if (!tier) next.requestedTierCode = family ? "Pick the band your business can afford." : "Pick a membership.";
    else if (tier.priceKind !== "set_by_psf") {
      const problem = psfFeeProblem(tier, amount);
      if (problem) next.declaredFeeRwf = problem;
    }
    const parsed = PsfApplicationInput.safeParse(candidateOf(d, tier));
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (!next[key]) next[key] = issue.message;
      }
    }
    setErrors(next);
    if (Object.keys(next).length > 0 || !parsed.success) {
      document.getElementById(next.requestedTierCode || next.declaredFeeRwf ? "psf-membership-pick" : "psf-form-details")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }
    onSubmit(parsed.data);
  };

  const err = (key: string) => errors[key] || (refusalField?.path === key ? refusalField.message : undefined);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Step 1–3: the membership ─────────────────────────────────── */}
      <section id="psf-membership-pick" className="flex flex-col gap-4">
        <div>
          <h3 className="pms-display text-lg font-bold text-ink">Choose your membership</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick the level that fits your business, then the amount you can afford each year.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3" role="radiogroup" aria-label="Membership">
          {families.map((g) => {
            const on = family === g.family;
            const IconCmp = FAMILY_ICON[g.family] ?? Sprout;
            return (
              <button
                key={g.family}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => pickFamily(g.family)}
                className={cn(
                  "group relative flex cursor-pointer flex-col gap-2 rounded-card border p-4 text-left transition-colors duration-quick ease-settle",
                  on ? "border-accent-text bg-accent-soft" : "border-card-bd bg-card hover:bg-hover",
                )}
              >
                <span className="flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full",
                      on ? "bg-accent text-accent-foreground" : "bg-hover text-ink2",
                    )}
                  >
                    <IconCmp className="size-[18px]" strokeWidth={2} />
                  </span>
                  <span className="text-base font-bold text-ink">{PSF_FAMILY_LABEL[g.family]}</span>
                  {on && <Check aria-hidden="true" className="ml-auto size-4 text-accent-text" strokeWidth={2.6} />}
                </span>
                <span className="pms-num text-sm font-semibold text-ink2">{familySpan(g.tiers)}</span>
                <span className="text-xs leading-snug text-muted-foreground">{PSF_FAMILY_BLURB[g.family]}</span>
              </button>
            );
          })}
        </div>

        {family && group.length > 1 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-ink">Your band, a year (RWF)</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Band">
              {group.map((t) => {
                const on = d.requestedTierCode === t.code;
                return (
                  <button
                    key={t.code}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => pickTier(t)}
                    className={cn(
                      "pms-num cursor-pointer rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors duration-quick",
                      on ? "border-accent-text bg-accent-soft text-accent-text" : "border-line2 bg-field text-ink2 hover:bg-hover",
                    )}
                  >
                    {bandOf(t)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {tier && tier.priceKind !== "set_by_psf" && (
          <div className={cn(surfaceClass, "flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between")}>
            <label className="flex max-w-xs flex-1 flex-col gap-1 text-sm font-semibold text-ink">
              What you will pay a year
              <span className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                  RWF
                </span>
                <Input
                  inputMode="numeric"
                  className="pms-num pl-12 text-base font-semibold"
                  value={d.declaredFee}
                  aria-invalid={Boolean(amountProblem || err("declaredFeeRwf"))}
                  onChange={(e) => set("declaredFee", e.target.value)}
                  readOnly={tier.priceKind === "fixed"}
                />
              </span>
              <span className={cn("text-xs font-normal", amountProblem || err("declaredFeeRwf") ? "text-bad" : "text-muted-foreground")}>
                {amountProblem ?? err("declaredFeeRwf") ?? priceOf(tier)}
              </span>
            </label>
            <TierBenefits tier={tier} />
          </div>
        )}
        {tier && tier.priceKind === "set_by_psf" && (
          <p className={cn(surfaceClass, "p-4 text-sm text-muted-foreground")}>PSF names the price of this membership when it approves you.</p>
        )}

        {err("requestedTierCode") && <p className="text-xs text-bad">{err("requestedTierCode")}</p>}
        <p className="rounded border border-info bg-info-bg px-3.5 py-2.5 text-xs text-info">{PSF_FEE_NOTICE}</p>
      </section>

      {/* ── PSF's form ───────────────────────────────────────────────── */}
      <section id="psf-form-details" className={cn(surfaceClass, "flex flex-col gap-3 p-4")}>
        <h3 className="text-sm font-bold text-ink">Your business</h3>
        <Field label="Registration" hint="As PSF’s form records it, from your registration.">
          <Input value={registrationLabel} readOnly disabled />
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
        <div className="grid gap-3 sm:grid-cols-2">
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
        </div>
        {d.ownership === "other" && (
          <Field label="What is the ownership?" error={err("ownershipOther")}>
            <Input value={d.ownershipOther} onChange={(e) => set("ownershipOther", e.target.value)} />
          </Field>
        )}
        <Field label="What does the business do?" error={err("businessActivity")}>
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
        <Field label="Gender" hint="PSF’s form asks for Male or Female. Your own profile is not changed." error={err("gender")}>
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

      {refusal && !refusalField && <p className="rounded border border-bad bg-bad-bg px-3.5 py-3 text-xs text-bad">{refusal}</p>}

      {/* The commitment, said once more where the button is. */}
      <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {tier ? (
            <>
              <span className="font-semibold text-ink">{tier.nameEn}</span>
              {tier.priceKind !== "set_by_psf" && amount !== null && !amountProblem ? (
                <>
                  {" "}
                  · <span className="pms-num font-semibold text-ink">{formatPrice(amount)}</span> a year, paid once PSF approves you
                </>
              ) : null}
            </>
          ) : (
            "Choose a membership to continue."
          )}
        </p>
        <div className="flex flex-wrap gap-2.5">
          <ActionButton className="h-11" disabled={submitting} onClick={onCancel}>
            Cancel
          </ActionButton>
          <ActionButton variant="primary" className="h-11" disabled={submitting} onClick={submit}>
            {submitting ? "Sending your application" : "Send to PSF"}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

/** What the tier gives, folded: the list is long for Golden Circle. */
function TierBenefits({ tier }: { tier: PsfTier }) {
  const [open, setOpen] = useState(false);
  if (tier.benefitsEn.length === 0) return null;
  const shown = open ? tier.benefitsEn : tier.benefitsEn.slice(0, 3);
  return (
    <div className="min-w-0 flex-1 sm:max-w-sm">
      <p className="mb-1.5 text-2xs font-bold tracking-wide text-muted-foreground uppercase">What you get</p>
      <ul className="flex flex-col gap-1">
        {shown.map((b) => (
          <li key={b} className="flex gap-1.5 text-xs leading-snug text-ink2">
            <Check aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-ok" strokeWidth={2.4} />
            {b}
          </li>
        ))}
      </ul>
      {tier.benefitsEn.length > 3 && (
        <button type="button" className="mt-1.5 cursor-pointer text-xs font-semibold text-accent-text" onClick={() => setOpen((o) => !o)}>
          {open ? "Show less" : `And ${tier.benefitsEn.length - 3} more`}
        </button>
      )}
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
