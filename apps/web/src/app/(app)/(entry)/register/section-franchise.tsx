"use client";

import { useTranslations } from "next-intl";
import { Button } from "@injishi/web-ui";
import { ArrowLeft } from "lucide-react";

import type { BusinessDraft } from "./business-draft";
import { COUNTRY_OPTIONS } from "./country-options";
import { ChoiceCard, Field, Fieldset, SelectField, TextInput } from "./wizard-ui";

/**
 * Franchise (ADR-075 O-7, AC-8): whether the business is part of a franchise,
 * and how. It follows Location and comes before Branches.
 *
 * No · "We run another company's brand" (a franchisee: the brand, and the
 * franchisor's registered name and country; its agreement, optional, goes up
 * on Documents) · "We own the brand and license it" (a franchisor: the brand,
 * and how many locations run under it). The API holds the answer to the same
 * contract, `FranchiseDeclaration`, and stores it as the org's
 * `org_franchises` row.
 */
export function SectionFranchise({
  draft,
  onChange,
  errors,
  onNext,
  onBack = null,
}: {
  draft: BusinessDraft;
  onChange: (next: BusinessDraft) => void;
  errors: Record<string, string>;
  onNext: () => void;
  /** Back: the section before, reopened with its answers, or the step before. */
  onBack?: (() => void) | null;
}) {
  const t = useTranslations("registerForms.franchise");
  const back = onBack ? (
    <Button variant="ghost" onClick={onBack}>
      <ArrowLeft size={16} aria-hidden />
      {t("back")}
    </Button>
  ) : null;
  const role = draft.franchiseRole;
  const pick = (next: string) => onChange({ ...draft, franchiseRole: next as BusinessDraft["franchiseRole"] });

  return (
    <>
      <Fieldset legend={t("legend")} error={errors["business.franchise"]}>
        <div className="mt-2 grid gap-3">
          <ChoiceCard name="franchise" value="none" checked={role === "none"} title={t("no")} onSelect={pick} />
          <ChoiceCard
            name="franchise"
            value="franchisee"
            checked={role === "franchisee"}
            title={t("franchisee")}
            onSelect={pick}
          />
          <ChoiceCard
            name="franchise"
            value="franchisor"
            checked={role === "franchisor"}
            title={t("franchisor")}
            onSelect={pick}
          />
        </div>
      </Fieldset>

      {role === "franchisee" ? (
        <div className="flex max-w-form flex-col gap-4">
          <Field label={t("brandName")} required error={errors["business.franchise.brandName"]}>
            <TextInput
              id="register-franchise-brand"
              className="w-full"
              value={draft.franchiseBrand}
              onChange={(e) => onChange({ ...draft, franchiseBrand: e.target.value })}
            />
          </Field>
          <Field label={t("franchisorName")} required error={errors["business.franchise.franchisorLegalName"]}>
            <TextInput
              id="register-franchisor-name"
              className="w-full"
              value={draft.franchisorLegalName}
              onChange={(e) => onChange({ ...draft, franchisorLegalName: e.target.value })}
            />
          </Field>
          <Field label={t("franchisorCountry")} required error={errors["business.franchise.franchisorCountry"]}>
            <SelectField
              value={draft.franchisorCountry}
              options={COUNTRY_OPTIONS}
              placeholder={t("chooseCountry")}
              invalid={Boolean(errors["business.franchise.franchisorCountry"])}
              onChange={(franchisorCountry) => onChange({ ...draft, franchisorCountry })}
            />
          </Field>
          <p className="text-xs text-muted-foreground">{t("agreementNote")}</p>
        </div>
      ) : null}

      {role === "franchisor" ? (
        <div className="flex max-w-form flex-col gap-4">
          <Field label={t("brandName")} required error={errors["business.franchise.brandName"]}>
            <TextInput
              id="register-franchise-brand"
              className="w-full"
              value={draft.franchiseBrand}
              onChange={(e) => onChange({ ...draft, franchiseBrand: e.target.value })}
            />
          </Field>
          <Field
            label={t("locations")}
            required
            hint={t("locationsHint")}
            error={errors["business.franchise.franchisedLocations"]}
          >
            <TextInput
              id="register-franchised-locations"
              className="w-full"
              inputMode="numeric"
              value={draft.franchisedLocations}
              onChange={(e) => onChange({ ...draft, franchisedLocations: e.target.value })}
            />
          </Field>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {back}
        <Button onClick={onNext} disabled={role === ""}>
          {t("next")}
        </Button>
      </div>
    </>
  );
}
