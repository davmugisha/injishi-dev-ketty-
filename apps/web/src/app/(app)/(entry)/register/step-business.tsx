"use client";

import { useState } from "react";
import {
  type RegistrantCapacity,
  type RegistryBusiness,
  type TinCheckResult,
} from "@injishi/contracts";
import { Badge, Button, Checkbox } from "@injishi/ui";
import { ChevronDown } from "lucide-react";
import { cn } from "@injishi/utils";

import { checkTin } from "@/data/registration";
import { upiError } from "@/lib/upi";

import { AddressPicker, EMPTY_ADDRESS, useAddressLine, type AddressDraft } from "./address-picker";
import { BusinessDocuments, type DocumentDraft } from "./business-documents";
import { StepCard } from "./register-shell";
import { type RegistrationKind } from "./registration-kinds";
import { IntendedOwnerFields } from "./step-about-you";
import { BranchesEditor, type BranchDraft } from "./step-branches";
import { ChoiceCard, Field, Fieldset, Notice, TextInput } from "./wizard-ui";

/**
 * Your business (RegisterIA board): the register fills it, you confirm it.
 *
 * A hotel types ONE number, its RRA TIN. "Check with RRA" asks the company
 * register (ADR-060), which answers the legal name, the directors and the
 * registered address, so none of them is typed. Ownership is DERIVED from the
 * directors: a registrant the register lists registers as the owner, one it
 * does not registers on the owner's behalf, and "I am registering for someone
 * else" opens the three owner fields only when it is needed. Where guests find
 * it is one press: the registered address, or somewhere else.
 *
 * Everything that is not needed to be approved sits in ONE optional section,
 * "Add more now": documents (the verifier asks at the visit), the EAC grade,
 * the two memberships and other locations. The PSF application and the tourism
 * licence NUMBER left registration: the licence is a document, and PSF is
 * applied for from the workspace once approved (Journey board).
 *
 * A residence carries a UPI rather than a TIN. No land register is reachable
 * from here, so its name and address are given by hand, and the step says so.
 */

export interface BusinessDraft {
  legalName: string;
  accommodationClass: string;
  accommodationClassOther: string;
  residenceClass: string;
  tin: string;
  upi: string;
  tourismLicenseNumber: string;
  /** Null until answered on drafts kept before the optional section; read as No. */
  chamberOfTourismMember: boolean | null;
  psfMember: boolean | null;
  /** Kept so drafts saved before ADR-069 still parse; never asked now. */
  psfApply: boolean | null;
  psfMembershipNumber: string;
  eacStarGrade: string;
  address: AddressDraft;
}

export type TinCheck = { tin: string; verdict: TinCheckResult } | null;

/** The TIN as the contract reads it: spaces dropped. */
export function normalizeTin(raw: string): string {
  return raw.replace(/\s+/g, "");
}

/** `102345678` as `102 345 678`, the way it is printed on the certificate. */
export function formatTin(raw: string): string {
  const t = normalizeTin(raw);
  return /^\d{9}$/.test(t) ? `${t.slice(0, 3)} ${t.slice(3, 6)} ${t.slice(6)}` : raw;
}

/** The register's address as the picker's draft. */
export function registryAddressDraft(found: RegistryBusiness): AddressDraft | null {
  if (!found.address) return null;
  return {
    ...EMPTY_ADDRESS,
    country: "RW",
    provinceId: String(found.address.provinceId),
    districtId: String(found.address.districtId),
    sectorId: String(found.address.sectorId),
    street: found.address.street ?? "",
  };
}

const GRADES = ["", "1", "2", "3", "4", "5"] as const;

export function StepBusiness({
  role,
  kind,
  draft,
  onChange,
  branches,
  onBranchesChange,
  docs,
  onDocsChange,
  tinCheck,
  onTinCheck,
  registry,
  onRegistry,
  registrantName,
  capacity,
  onCapacityChange,
  intendedOwner,
  onIntendedOwnerChange,
  addressMode,
  onAddressModeChange,
  errors,
  formError,
  busy,
  onBack,
  onNext,
}: {
  role: "host" | "landlord";
  kind: RegistrationKind | null;
  draft: BusinessDraft;
  onChange: (next: BusinessDraft) => void;
  branches: BranchDraft[];
  onBranchesChange: (next: BranchDraft[]) => void;
  docs: DocumentDraft[];
  onDocsChange: (next: DocumentDraft[]) => void;
  tinCheck: TinCheck;
  onTinCheck: (next: TinCheck) => void;
  registry: RegistryBusiness | null;
  onRegistry: (found: RegistryBusiness | null, registrantIsDirector: boolean | null) => void;
  /** The registrant's verified or typed name, to mark "(you)" among the directors. */
  registrantName: string;
  capacity: RegistrantCapacity;
  onCapacityChange: (next: RegistrantCapacity) => void;
  intendedOwner: { name: string; nationalId: string; email: string };
  onIntendedOwnerChange: (next: { name: string; nationalId: string; email: string }) => void;
  addressMode: "registered" | "other";
  onAddressModeChange: (next: "registered" | "other") => void;
  errors: Record<string, string>;
  formError: string;
  busy: boolean;
  onBack: () => void;
  /** Continue; the wizard validates. Only called once the TIN is not refused. */
  onNext: () => void;
}) {
  const isHospitality = role === "host";
  const [checking, setChecking] = useState(false);
  const optionalAnswered =
    docs.length > 0 ||
    branches.length > 0 ||
    draft.eacStarGrade !== "" ||
    draft.chamberOfTourismMember === true ||
    draft.psfMembershipNumber.trim() !== "";
  const [more, setMore] = useState(optionalAnswered);
  const moreHasError = Object.keys(errors).some(
    (k) => k.startsWith("documents.") || k.startsWith("business.branches") || k.startsWith("business.eacStarGrade") || k.startsWith("business.psf"),
  );
  const moreOpen = more || moreHasError;

  const tin = normalizeTin(draft.tin);
  const verdict = isHospitality && tinCheck?.tin === tin ? tinCheck.verdict : null;
  const tinOk = verdict?.result === "verified" || verdict?.result === "pending";
  const tinRefusal = verdict?.result === "failed" || verdict?.result === "taken" ? verdict.message : undefined;
  const found = verdict?.result === "verified" ? registry : null;
  const registered = found ? registryAddressDraft(found) : null;
  const registeredLine = useAddressLine(registered ?? EMPTY_ADDRESS);
  const isDirector = verdict?.registrantIsDirector ?? null;

  async function runCheck(): Promise<TinCheckResult | null> {
    if (!/^\d{9}$/.test(tin)) return null;
    if (tinCheck?.tin === tin) return tinCheck.verdict;
    setChecking(true);
    const res = await checkTin(tin);
    setChecking(false);
    // No answer at all reads like RRA being down: never a refusal, because the
    // check after payment still runs.
    if (res.status !== "ok") {
      const pending: TinCheckResult = {
        tin,
        result: "pending",
        message: "We could not reach RRA just now. You can carry on: the TIN is checked again after payment.",
        business: null,
        registrantIsDirector: null,
      };
      onTinCheck({ tin, verdict: pending });
      return pending;
    }
    onTinCheck({ tin, verdict: res.data });
    if (res.data.result === "verified") onRegistry(res.data.business, res.data.registrantIsDirector);
    return res.data;
  }

  /**
   * Continue. A TIN nobody has checked yet is checked first and the step stays
   * put, so the person sees what the register filled in before moving on; a
   * TIN RRA refused, or another business holds, goes no further.
   */
  async function next() {
    if (isHospitality && /^\d{9}$/.test(tin) && tinCheck?.tin !== tin) {
      await runCheck();
      return;
    }
    if (verdict?.result === "failed" || verdict?.result === "taken") return;
    onNext();
  }

  const directorLine = found
    ? found.directors
        .map((d) =>
          isDirector && d.name.trim().toLowerCase() === registrantName.trim().toLowerCase()
            ? `${d.name} (you)`
            : d.name,
        )
        .join(", ")
    : "";

  const liveUpiError = !isHospitality && draft.upi.trim() !== "" ? upiError(draft.upi) : null;
  const showGrade = isHospitality && kind !== "bar_restaurant";

  const moreSummary = [
    docs.length ? `${docs.length} document${docs.length === 1 ? "" : "s"}` : "",
    draft.eacStarGrade ? `${draft.eacStarGrade} star${draft.eacStarGrade === "1" ? "" : "s"}` : "",
    draft.chamberOfTourismMember ? "Chamber" : "",
    draft.psfMembershipNumber.trim() ? "PSF" : "",
    branches.length ? `${branches.length} more location${branches.length === 1 ? "" : "s"}` : "",
  ].filter(Boolean);

  return (
    <StepCard
      id="register-business"
      title="Your business"
      lead={
        isHospitality
          ? "Your TIN finds the company on the registers, so its name, directors and address fill themselves in."
          : "Your UPI is the plot an officer visits. Give the name it is let under and where it is."
      }
      footer={
        <>
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button onClick={() => void next()} pending={busy || checking}>
            {busy ? "Working…" : "Continue to sign and pay"}
          </Button>
        </>
      }
    >
      {isHospitality ? (
        <>
          <div className="flex flex-wrap items-end gap-2.5">
            <div className="min-w-0 flex-1 basis-64">
              <Field
                label="RRA TIN"
                hint="9 digits, on your RRA certificate."
                error={errors["business.tin"] ?? tinRefusal}
              >
                <TextInput
                  id="biz-tin"
                  className="w-full tabular-nums"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="102 345 678"
                  disabled={tinOk}
                  value={draft.tin}
                  onChange={(e) => onChange({ ...draft, tin: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void runCheck();
                  }}
                />
              </Field>
            </div>
            {tinOk ? (
              <Button
                variant="ghost"
                onClick={() => {
                  onTinCheck(null);
                  onRegistry(null, null);
                }}
              >
                Change the TIN
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => void runCheck()}
                disabled={!/^\d{9}$/.test(tin)}
                pending={checking}
              >
                {checking ? "Checking…" : "Check with RRA"}
              </Button>
            )}
          </div>

          {verdict?.result === "pending" ? <Notice tone="warning">{verdict.message}</Notice> : null}

          {found ? (
            <div className="flex flex-col gap-2 rounded-card bg-secondary p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold">{found.legalName}</span>
                <Badge variant="success" size="sm">
                  From the company register
                </Badge>
              </div>
              <span className="text-sm tabular-nums text-muted-foreground">
                TIN {formatTin(tin)}
                {directorLine ? ` · directors: ${directorLine}` : ""}
              </span>
              {found.generated ? (
                <span className="text-xs text-muted-foreground">
                  Demo: no real register is connected, so this company was generated.
                </span>
              ) : null}
              <p className="text-sm">
                {isDirector === false
                  ? "The register does not list you as a director, so you register it for its owner, who claims it once it is approved."
                  : isDirector === true
                    ? "You are a director, so you register as the owner."
                    : "You register as the owner."}{" "}
                {isDirector === false ? null : (
                  <button
                    type="button"
                    onClick={() => onCapacityChange(capacity === "owner" ? "on_behalf_of" : "owner")}
                    className="rounded font-semibold text-accent-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {capacity === "owner" ? "I am registering for someone else" : "No, I own it"}
                  </button>
                )}
              </p>
            </div>
          ) : verdict ? (
            <>
              {verdict.result === "verified" ? (
                <p className="text-sm text-muted-foreground" role="status">
                  {verdict.message} The register holds no details for it, so give its name here.
                </p>
              ) : null}
              {tinOk ? (
                <Field
                  label="Registered business name"
                  hint="Exactly as it appears on your RRA certificate."
                  error={errors["business.legalName"]}
                >
                  <TextInput
                    id="biz-legal-name"
                    className="w-full"
                    value={draft.legalName}
                    onChange={(e) => onChange({ ...draft, legalName: e.target.value })}
                  />
                </Field>
              ) : null}
              {tinOk ? (
                <p className="text-sm">
                  {capacity === "owner" ? "You register as the owner." : "You register it for its owner."}{" "}
                  <button
                    type="button"
                    onClick={() => onCapacityChange(capacity === "owner" ? "on_behalf_of" : "owner")}
                    className="rounded font-semibold text-accent-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {capacity === "owner" ? "I am registering for someone else" : "No, I own it"}
                  </button>
                </p>
              ) : null}
            </>
          ) : null}

          {kind === "other" && tinOk ? (
            <Field
              label="What kind of place this is"
              error={errors["business.accommodationClassOther"]}
            >
              <TextInput
                className="w-full"
                value={draft.accommodationClassOther}
                onChange={(e) => onChange({ ...draft, accommodationClassOther: e.target.value })}
              />
            </Field>
          ) : null}
        </>
      ) : (
        <>
          <Field
            label="Property UPI"
            hint="On your land title: five parts separated by slashes, like 1/02/03/04/1234."
            error={errors["business.upi"] ?? liveUpiError ?? undefined}
          >
            <TextInput
              id="biz-upi"
              className="w-full tabular-nums"
              autoComplete="off"
              placeholder="1/02/03/04/1234"
              value={draft.upi}
              onChange={(e) => onChange({ ...draft, upi: e.target.value })}
            />
          </Field>
          <Field
            label="Name it is registered under"
            hint="Yours or your company's, as on the land title. The land register cannot be searched from here yet."
            error={errors["business.legalName"]}
          >
            <TextInput
              id="biz-legal-name"
              className="w-full"
              value={draft.legalName}
              onChange={(e) => onChange({ ...draft, legalName: e.target.value })}
            />
          </Field>
          <Fieldset legend="How you hold it" error={errors["business.residenceClass"]}>
            <div className="grid gap-3 sm:grid-cols-2">
              <ChoiceCard
                name="residenceClass"
                value="residential_landlord"
                checked={draft.residenceClass === "residential_landlord"}
                title="I am the landlord"
                description="You own the property you let."
                onSelect={() => onChange({ ...draft, residenceClass: "residential_landlord" })}
              />
              <ChoiceCard
                name="residenceClass"
                value="residential_property_manager"
                checked={draft.residenceClass === "residential_property_manager"}
                title="I manage it for the owner"
                description="You run the letting on someone else's behalf."
                onSelect={() => onChange({ ...draft, residenceClass: "residential_property_manager" })}
              />
            </div>
          </Fieldset>
          <p className="text-sm">
            {capacity === "owner" ? "You register it in your own name." : "You register it for its owner."}{" "}
            <button
              type="button"
              onClick={() => onCapacityChange(capacity === "owner" ? "on_behalf_of" : "owner")}
              className="rounded font-semibold text-accent-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {capacity === "owner" ? "I am registering for someone else" : "No, it is mine"}
            </button>
          </p>
        </>
      )}

      {capacity === "on_behalf_of" && (!isHospitality || tinOk) ? (
        <IntendedOwnerFields
          title="Who owns it"
          value={intendedOwner}
          onChange={onIntendedOwnerChange}
          errors={errors}
        />
      ) : null}
      {capacity === "on_behalf_of" && (!isHospitality || tinOk) ? (
        <p className="-mt-2 text-xs text-muted-foreground">
          They get a link to claim the business once it is approved. Payouts wait for their claim.
        </p>
      ) : null}

      {!isHospitality || tinOk ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-semibold">
            {isHospitality ? "Where guests find it" : "Where the property is"}
          </legend>
          {registered ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <ChoiceCard
                name="where"
                value="registered"
                checked={addressMode === "registered"}
                title="At the registered address"
                description={`${registeredLine ?? "The address the register holds"} (from the company register)`}
                onSelect={() => {
                  onAddressModeChange("registered");
                  onChange({ ...draft, address: { ...registered } });
                }}
              />
              <ChoiceCard
                name="where"
                value="other"
                checked={addressMode === "other"}
                title="Somewhere else"
                description="Pick the province, district and sector, then the street."
                onSelect={() => {
                  onAddressModeChange("other");
                  onChange({ ...draft, address: { ...EMPTY_ADDRESS } });
                }}
              />
            </div>
          ) : (
            <p className="-mt-1 text-xs text-muted-foreground">
              A district officer visits this address, so it has to be the real one.
            </p>
          )}
          {!registered || addressMode === "other" ? (
            <AddressPicker
              idPrefix="biz"
              errorPrefix="business.address"
              rwandaOnly
              collectVillage
              draft={draft.address}
              onChange={(address) => onChange({ ...draft, address })}
              errors={errors}
            />
          ) : null}
        </fieldset>
      ) : null}

      {!isHospitality || tinOk ? (
        <div className="rounded-card bg-secondary px-4 py-1">
          <h2 className="m-0">
            <button
              type="button"
              aria-expanded={moreOpen}
              aria-controls="biz-more"
              onClick={() => setMore(!moreOpen)}
              className="flex min-h-13 w-full items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex flex-1 flex-col">
                <span className="text-sm font-semibold">
                  Add more now <span className="font-normal text-muted-foreground">(optional)</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {moreSummary.length
                    ? moreSummary.join(" · ")
                    : isHospitality
                      ? "Documents, star grade, memberships, other locations"
                      : "Documents you already hold"}
                </span>
              </span>
              <ChevronDown
                size={18}
                aria-hidden
                className={cn("shrink-0 transition-transform", moreOpen && "rotate-180")}
              />
            </button>
          </h2>
          {moreOpen ? (
            <div id="biz-more" className="flex flex-col gap-5 pb-4 pt-1">
              <BusinessDocuments
                role={role}
                docs={docs}
                onChange={onDocsChange}
                errors={errors}
                hint={
                  isHospitality
                    ? "Documents you have to hand: your RDB grade, tourism licence, tax clearance, fire safety or health certificate."
                    : "Documents you have to hand: a tax clearance or a fire safety certificate."
                }
              />
              {showGrade ? (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-semibold" id="biz-grade">
                    EAC star grade
                  </span>
                  <div role="radiogroup" aria-labelledby="biz-grade" className="flex flex-wrap gap-1.5">
                    {GRADES.map((g) => (
                      <label
                        key={g || "none"}
                        className={cn(
                          "cursor-pointer rounded border px-3 py-1.5 text-sm font-medium transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-ring",
                          draft.eacStarGrade === g
                            ? "border-accent-brand bg-accent-brand/10 text-accent-text"
                            : "border-border bg-card hover:bg-secondary",
                        )}
                      >
                        <input
                          type="radio"
                          name="eac-grade"
                          className="sr-only"
                          checked={draft.eacStarGrade === g}
                          onChange={() => onChange({ ...draft, eacStarGrade: g })}
                        />
                        {g === "" ? "None" : `${g} star${g === "1" ? "" : "s"}`}
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
              {isHospitality ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Checkbox
                    isSelected={draft.chamberOfTourismMember === true}
                    onChange={(on: boolean) => onChange({ ...draft, chamberOfTourismMember: on })}
                    className="items-start gap-3"
                    controlClassName="mt-0.5"
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">A member of the Chamber of Tourism</span>
                      <span className="text-xs text-muted-foreground">
                        Leave it unticked if you are not a member.
                      </span>
                    </span>
                  </Checkbox>
                  <Field
                    label="PSF member number"
                    hint="Not a member? Apply from your workspace after approval."
                    error={errors["business.psfMembershipNumber"]}
                  >
                    <TextInput
                      className="w-full tabular-nums"
                      value={draft.psfMembershipNumber}
                      onChange={(e) => onChange({ ...draft, psfMembershipNumber: e.target.value })}
                    />
                  </Field>
                </div>
              ) : null}
              {isHospitality ? (
                <BranchesEditor
                  headOfficeAddress={draft.address}
                  drafts={branches}
                  onChange={onBranchesChange}
                  errors={errors}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {formError ? <Notice tone="danger">{formError}</Notice> : null}
    </StepCard>
  );
}
