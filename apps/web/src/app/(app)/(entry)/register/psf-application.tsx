"use client";

import {
  PSF_CONSENT_TEXT,
  PsfCompanyType,
  PsfOwnership,
  PsfTradeDirection,
  countryName,
  isOtherAssociation,
  psfFeeProblem,
  psfStartingFee,
  type PsfCatalogue,
  type PsfTier,
} from "@injishi/contracts";
import { Badge, Button, Checkbox } from "@injishi/web-ui";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

import { formatRwf } from "@/lib/money";

import { COUNTRY_OPTIONS } from "./country-options";
import { ChoiceCard, Field, Fieldset, SelectField, TextInput } from "./wizard-ui";

/**
 * PSF's own membership form (ADR-056), as the registration artboard draws it
 * under "Apply now": sent with the registration as `business.psfApplication`,
 * written in the same transaction, and passed to PSF only once the district's
 * PSF officer approves the business. Injishi takes no payment for PSF
 * (`PSF_FEE_NOTICE`).
 *
 * It asks only for the business (2026-11-03, the owner: "all we need is
 * business information"): the tier, the sector, kind of business and
 * association as the /psf form asks them, and how the business is owned and
 * trades. The name and place come from the registration, and the contact
 * person and the ID from You, which the server copies at submit. Gender is
 * asked here only when You holds neither of the two PSF's form knows.
 */

export interface PsfDraft {
  requestedTierCode: string;
  /** Digits the applicant will pay a year for the chosen band (declared to PSF). */
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
  /** The /psf form's sector, kind of business and association (2026-11-03). */
  clusterCode: string;
  subsectorId: string;
  subsectorOther: string;
  associationCode: string;
  associationOther: string;
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
  declaredFee: "",
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
  // A hotel starts in Services, filed with the Rwanda Hospitality Association: it may pick another.
  clusterCode: "services",
  subsectorId: "",
  subsectorOther: "",
  associationCode: "rha",
  associationOther: "",
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

/** Digits only: `5,000,000` and `5 000 000` both become 5000000. */
function amountOf(raw: string): number | null {
  const digits = raw.replace(/[\s,]/g, "");
  return /^\d+$/.test(digits) ? Number(digits) : null;
}

/** "Other" in the kind-of-business list: the business types its own. */
export const PSF_TYPE_IT = "__type__";

/**
 * The draft in the contract's shape: the business alone (2026-11-03). The contact person and the ID are
 * You's, copied by the server; gender travels only when asked here.
 */
export function psfCandidate(d: PsfDraft, documentOnFile: boolean, askGender = false): unknown {
  const trading = d.tradeDirection !== "none";
  const amount = amountOf(d.declaredFee);
  const typedKind = d.subsectorId === PSF_TYPE_IT;
  return {
    requestedTierCode: d.requestedTierCode,
    ...(amount !== null ? { declaredFeeRwf: amount } : {}),
    ...(d.associationCode ? { associationCode: d.associationCode } : {}),
    ...(d.associationCode && isOtherAssociation(d.associationCode) && d.associationOther.trim() ? { associationOther: d.associationOther.trim() } : {}),
    ...(d.subsectorId && !typedKind ? { subsectorId: d.subsectorId } : {}),
    ...(typedKind && d.subsectorOther.trim() ? { subsectorOther: d.subsectorOther.trim() } : {}),
    ...(d.website.trim() ? { website: d.website.trim() } : {}),
    companyType: d.companyType,
    ownership: d.ownership,
    ...(d.ownership === "other" ? { ownershipOther: d.ownershipOther } : {}),
    businessActivity: d.businessActivity,
    tradeDirection: d.tradeDirection,
    ...(trading ? { tradeGoods: d.tradeGoods } : {}),
    tradeCountries: trading ? d.tradeCountries : [],
    ...(askGender && d.gender ? { gender: d.gender } : {}),
    ...(documentOnFile
      ? { useDocumentOnFile: true }
      : {
          idDocument:
            d.idType === "passport"
              ? { documentType: "passport", documentNumber: d.idNumber }
              : { documentType: "national_id", documentNumber: d.idNumber.replace(/\s+/g, "") },
        }),
    ...(d.consent ? { consent: true } : {}),
  };
}

/** The form's own messages, under `registerForms.psfForm`. */
type PsfFormMessages = ReturnType<typeof useTranslations<"registerForms.psfForm">>;

/** A tier's name beside what it costs a year, as the locale words it. */
function tierLabel(tier: PsfTier, t: PsfFormMessages): string {
  const name = tier.nameEn;
  if (tier.priceKind === "fixed" && tier.annualFeeRwf !== null)
    return t("tierFixed", { name, fee: formatRwf(tier.annualFeeRwf) });
  if (tier.priceKind === "range" && tier.annualFeeMinRwf !== null && tier.annualFeeMaxRwf !== null)
    return t("tierRange", {
      name,
      min: formatRwf(tier.annualFeeMinRwf),
      max: formatRwf(tier.annualFeeMaxRwf),
    });
  if (tier.priceKind === "minimum" && tier.annualFeeMinRwf !== null)
    return t("tierMinimum", { name, fee: formatRwf(tier.annualFeeMinRwf) });
  return t("tierSetByPsf", { name });
}

export function PsfApplication({
  draft,
  onChange,
  tiers,
  tiersFailed,
  onRetryTiers,
  errors,
  catalogue,
  askGender,
}: {
  draft: PsfDraft;
  onChange: (next: PsfDraft) => void;
  /** PSF's sectors, kinds of business and associations; null while they load. */
  catalogue: PsfCatalogue | null;
  /** True when You holds no male or female answer: PSF's form needs one of the two. */
  askGender: boolean;
  /** Null while loading or when the tiers could not be read. */
  tiers: PsfTier[] | null;
  tiersFailed: boolean;
  onRetryTiers: () => void;
  /** Kept for the callers: the ID is You's now (2026-11-03), so nothing of it shows here. */
  documentLine?: string | null;
  errors: Record<string, string>;
}) {
  const t = useTranslations("registerForms.psfForm");
  /** A choice list whose labels are the catalog's, one key per value. */
  const opts = (values: readonly string[], group: "companyTypes" | "ownerships" | "trades") =>
    values.map((value) => ({ value, label: t(`${group}.${value}`) }));
  const set = <K extends keyof PsfDraft>(key: K, value: PsfDraft[K]) => onChange({ ...draft, [key]: value });
  const e = (k: string) => errors[`psf.${k}`] ?? errors[`business.psfApplication.${k}`];
  const trading = draft.tradeDirection !== "none";
  const tier = (tiers ?? []).find((row) => row.code === draft.requestedTierCode) ?? null;
  const amount = amountOf(draft.declaredFee);
  const amountProblem = tier && tier.priceKind !== "set_by_psf" && draft.declaredFee.trim() ? psfFeeProblem(tier, amount) : null;
  const needsDeclared = tier !== null && tier.priceKind !== "set_by_psf";
  // The sector, kind of business and association, as the /psf form lists them.
  const cluster = catalogue?.clusters.find((c) => c.code === draft.clusterCode) ?? null;
  const subsector = cluster?.subsectors.find((x) => x.id === draft.subsectorId) ?? null;
  const pool = cluster?.associations.filter((a) => !isOtherAssociation(a.code)) ?? [];
  const linked = subsector ? pool.filter((a) => subsector.associationCodes.includes(a.code)) : [];
  const listed = linked.length ? linked : pool;
  const otherCode = cluster?.associations.find((a) => isOtherAssociation(a.code))?.code ?? null;
  const typingAssociation = Boolean(draft.associationCode) && isOtherAssociation(draft.associationCode);

  const pickTier = (code: string) => {
    const next = (tiers ?? []).find((row) => row.code === code) ?? null;
    const start = next ? psfStartingFee(next) : null;
    onChange({
      ...draft,
      requestedTierCode: code,
      declaredFee: start !== null ? String(start) : "",
    });
  };

  return (
    <div className="flex flex-col gap-5 rounded-card bg-secondary p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-base font-semibold">{t("title")}</h4>
        <Badge variant="subtle" size="sm">
          {t("filedWith")}
        </Badge>
      </div>

      <div className="max-w-form flex flex-col gap-4">
        <Field label={t("tier")} hint={t("feeNotice")} error={e("requestedTierCode")}>
          <SelectField
            id="psf-tier"
            value={draft.requestedTierCode}
            placeholder={
              tiersFailed
                ? t("tierFailedPlaceholder")
                : tiers === null
                  ? t("tierLoading")
                  : tiers.some((x) => x.active)
                    ? t("tierPick")
                    : t("tierNone")
            }
            disabled={tiersFailed || tiers === null || !tiers.some((x) => x.active)}
            invalid={Boolean(e("requestedTierCode"))}
            options={(tiers ?? []).filter((x) => x.active).map((x) => ({ value: x.code, label: tierLabel(x, t) }))}
            onChange={pickTier}
          />
        </Field>
        {tier && needsDeclared ? (
          <Field
            label={t("declaredFee")}
            hint={
              amountProblem ??
              e("declaredFeeRwf") ??
              (tier.priceKind === "minimum" && tier.annualFeeMinRwf !== null
                ? t("bandStarts", { amount: formatRwf(tier.annualFeeMinRwf) })
                : tierLabel(tier, t))
            }
            error={amountProblem ?? e("declaredFeeRwf")}
          >
            <TextInput
              className="w-full tabular-nums"
              inputMode="numeric"
              value={draft.declaredFee ? Number(draft.declaredFee).toLocaleString("en-US") : ""}
              aria-invalid={Boolean(amountProblem || e("declaredFeeRwf"))}
              readOnly={tier.priceKind === "fixed"}
              onChange={(ev) => set("declaredFee", ev.target.value.replace(/[^\d]/g, "").slice(0, 12))}
            />
          </Field>
        ) : null}
        {tiersFailed || (tiers !== null && !tiers.some((row) => row.active)) ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-destructive" role="alert">
            <span>{tiersFailed ? t("tiersFailed") : t("tiersNoneBody")}</span>
            <Button variant="ghost" size="sm" onClick={onRetryTiers}>
              {t("tryAgain")}
            </Button>
          </div>
        ) : null}
      </div>

      <p className="text-sm font-semibold">{t("sectorTitle")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("sector")} hint={t("sectorHint")} error={e("clusterCode")}>
          <SelectField
            id="psf-cluster"
            value={draft.clusterCode}
            placeholder={catalogue === null ? t("sectorLoading") : t("sectorChoose")}
            disabled={catalogue === null}
            options={(catalogue?.clusters ?? []).map((c) => ({ value: c.code, label: c.nameEn }))}
            onChange={(v) => onChange({ ...draft, clusterCode: v, subsectorId: "", subsectorOther: "", associationCode: "", associationOther: "" })}
          />
        </Field>
        {cluster ? (
          <Field label={t("kind")} hint={t("kindHint")} error={e("subsectorId")}>
            <SelectField
              id="psf-subsector"
              value={draft.subsectorId}
              placeholder={t("kindChoose")}
              options={[...cluster.subsectors.map((x) => ({ value: x.id, label: x.nameEn })), { value: PSF_TYPE_IT, label: t("other") }]}
              onChange={(v) => {
                const nextSub = cluster.subsectors.find((x) => x.id === v) ?? null;
                // A new kind narrows the associations: the old pick stays only while it is still among them.
                const keep = draft.associationCode && (!nextSub || nextSub.associationCodes.length === 0 || nextSub.associationCodes.includes(draft.associationCode));
                onChange({ ...draft, subsectorId: v, subsectorOther: v === PSF_TYPE_IT ? draft.subsectorOther : "", ...(keep ? {} : { associationCode: "", associationOther: "" }) });
              }}
            />
          </Field>
        ) : null}
        {draft.subsectorId === PSF_TYPE_IT ? (
          <Field label={t("kindOwn")} error={e("subsectorOther")}>
            <TextInput className="w-full" value={draft.subsectorOther} onChange={(ev) => set("subsectorOther", ev.target.value)} />
          </Field>
        ) : null}
        {cluster ? (
          <Field label={t("association")} hint={t("associationHint")} error={e("associationCode")}>
            <SelectField
              id="psf-association"
              value={typingAssociation ? PSF_TYPE_IT : draft.associationCode}
              placeholder={t("associationChoose")}
              options={[
                ...listed.map((a) => ({ value: a.code, label: a.acronym ? `${a.nameEn} (${a.acronym})` : a.nameEn })),
                ...(otherCode ? [{ value: PSF_TYPE_IT, label: t("associationType") }] : []),
              ]}
              onChange={(v) =>
                v === PSF_TYPE_IT
                  ? onChange({ ...draft, associationCode: otherCode ?? "", associationOther: draft.associationOther })
                  : onChange({ ...draft, associationCode: v, associationOther: "" })
              }
            />
          </Field>
        ) : null}
        {typingAssociation ? (
          <Field label={t("associationName")} error={e("associationOther")}>
            <TextInput className="w-full" value={draft.associationOther} onChange={(ev) => set("associationOther", ev.target.value)} />
          </Field>
        ) : null}
      </div>

      <p className="text-sm font-semibold">{t("businessTitle")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("website")} error={e("website")}>
          <TextInput
            className="w-full"
            type="url"
            placeholder="https://"
            value={draft.website}
            onChange={(ev) => set("website", ev.target.value)}
          />
        </Field>
        <Field label={t("companyType")} error={e("companyType")}>
          <SelectField
            value={draft.companyType}
            options={opts(PsfCompanyType.options, "companyTypes")}
            onChange={(v) => set("companyType", v)}
          />
        </Field>
        <Field label={t("ownership")} error={e("ownership")}>
          <SelectField
            value={draft.ownership}
            options={opts(PsfOwnership.options, "ownerships")}
            onChange={(v) => onChange({ ...draft, ownership: v, ownershipOther: v === "other" ? draft.ownershipOther : "" })}
          />
        </Field>
        {draft.ownership === "other" ? (
          <Field label={t("ownershipOther")} error={e("ownershipOther")}>
            <TextInput className="w-full" value={draft.ownershipOther} onChange={(ev) => set("ownershipOther", ev.target.value)} />
          </Field>
        ) : null}
        <Field label={t("trade")} error={e("tradeDirection")}>
          <SelectField
            value={draft.tradeDirection}
            options={opts(PsfTradeDirection.options, "trades")}
            onChange={(v) =>
              onChange({ ...draft, tradeDirection: v, ...(v === "none" ? { tradeGoods: "", tradeCountries: [] } : {}) })
            }
          />
        </Field>
      </div>
      {trading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("goods")} error={e("tradeGoods")}>
            <TextInput className="w-full" value={draft.tradeGoods} onChange={(ev) => set("tradeGoods", ev.target.value)} />
          </Field>
          <Field label={t("countries")} error={e("tradeCountries")}>
            <SelectField
              value=""
              placeholder={t("addCountry")}
              options={COUNTRY_OPTIONS.filter((c) => !draft.tradeCountries.includes(c.value))}
              onChange={(code) => code && set("tradeCountries", [...draft.tradeCountries, code])}
            />
          </Field>
          {draft.tradeCountries.length ? (
            <ul className="flex flex-wrap gap-2 sm:col-span-2" aria-label={t("countriesLabel")}>
              {draft.tradeCountries.map((code) => (
                <li key={code} className="flex items-center gap-1 rounded-full bg-card py-0.5 pl-3 pr-1 text-xs font-medium">
                  {countryName(code)}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("removeCountry", { country: countryName(code) })}
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
      <Field label={t("activity")} error={e("businessActivity")}>
        <TextInput
          className="w-full"
          placeholder={t("activityPlaceholder")}
          value={draft.businessActivity}
          onChange={(ev) => set("businessActivity", ev.target.value)}
        />
      </Field>

      {/* The contact person is You's (2026-11-03): gender alone is asked, when You holds no male or female. */}
      {askGender ? (
      <Fieldset
        legend={t("genderLegend")}
        hint={t("genderHint")}
        error={e("gender")}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["male", t("male")],
              ["female", t("female")],
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
      ) : null}

      {/* The ID is the one checked on You (2026-11-03): nothing asked or shown here. */}
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
      <p className="text-xs text-muted-foreground">{t("sentToPsf")}</p>
    </div>
  );
}
