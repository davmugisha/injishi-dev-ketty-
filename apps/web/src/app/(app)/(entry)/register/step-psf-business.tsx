"use client";

import { useEffect, useState } from "react";
import {
  PSF_OWNER_GROUP_LABEL,
  PsfOwnerGroup,
  type PsfCatalogue,
  type RegistryBusiness,
  type TinCheckResult,
} from "@injishi/contracts";
import { Badge, Button } from "@injishi/ui";
import { Briefcase, Check, Factory, ShoppingBag, Sprout } from "lucide-react";
import { cn } from "@injishi/utils";

import { fetchPsfCatalogue } from "@/data/psf";
import { checkTin } from "@/data/registration";

import { AddressPicker } from "./address-picker";
import { StepCard } from "./register-shell";
import { formatTin, normalizeTin, type BusinessDraft, type TinCheck } from "./step-business";
import { ChoiceCard, Field, Fieldset, Notice, SelectField, TextInput, TileCard } from "./wizard-ui";

/**
 * Your business, on the PSF path: a business of any sector registering to join
 * the Private Sector Federation (agreed with the owner, 2026-10-15).
 *
 * Four questions, in the order PSF reads a business:
 *
 *   1. Its name.
 *   2. How it is registered. A TIN is OPTIONAL here: a cooperative carries an
 *      RCA number, an NGO an RGB one, and the smallest businesses PSF wants are
 *      often registered nowhere yet. A TIN is checked with RRA exactly as a
 *      hotel's is, and fills the name in when the register holds it.
 *   3. Its sector: the cluster, then the PSF association it belongs to, from
 *      the catalogue admin keeps. Specialized (women, youth, disability) is not
 *      a sector, so it is asked separately, as who owns the business.
 *   4. Where it is. The district decides the business code it is given when
 *      the fee is paid, so the step says so.
 */

const CLUSTER_ICON: Record<string, typeof Factory> = {
  agriculture: Sprout,
  industry: Factory,
  trade: ShoppingBag,
  services: Briefcase,
};

const KINDS: readonly { value: string; title: string; description: string }[] = [
  { value: "tin", title: "RRA TIN", description: "9 digits, on your RRA certificate. We check it with RRA." },
  { value: "rca", title: "Cooperative", description: "Registered with the Rwanda Cooperative Agency (RCA)." },
  { value: "rgb", title: "NGO or association", description: "Registered with the Rwanda Governance Board (RGB)." },
  { value: "other", title: "Another registration", description: "Any other register, with its number." },
  { value: "none", title: "Not registered yet", description: "You can still join PSF, and add a TIN later." },
];

const GROUP_HINT: Record<PsfOwnerGroup, string> = {
  women: "A woman owns most of it",
  youth: "Owned by someone under 35",
  pwd: "Owned by a person with a disability",
};

/** The owner groups a draft holds, from its comma list. */
export function ownerGroupsOf(draft: BusinessDraft): PsfOwnerGroup[] {
  return draft.psfOwnerGroups
    .split(",")
    .map((g) => g.trim())
    .filter((g): g is PsfOwnerGroup => (PsfOwnerGroup.options as readonly string[]).includes(g));
}

export function StepPsfBusiness({
  draft,
  onChange,
  tinCheck,
  onTinCheck,
  onRegistry,
  errors,
  formError,
  busy,
  onBack,
  onNext,
}: {
  draft: BusinessDraft;
  onChange: (next: BusinessDraft) => void;
  tinCheck: TinCheck;
  onTinCheck: (next: TinCheck) => void;
  onRegistry: (found: RegistryBusiness | null, registrantIsDirector: boolean | null) => void;
  errors: Record<string, string>;
  formError: string;
  busy: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const [catalogue, setCatalogue] = useState<PsfCatalogue | null>(null);
  const [catalogueFailed, setCatalogueFailed] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let live = true;
    void fetchPsfCatalogue().then((res) => {
      if (!live) return;
      if (res.status === "ok") setCatalogue(res.data);
      else setCatalogueFailed(true);
    });
    return () => {
      live = false;
    };
  }, []);

  const kind = draft.psfRegistrationKind;
  const tin = normalizeTin(draft.tin);
  const verdict = kind === "tin" && tinCheck?.tin === tin ? tinCheck.verdict : null;
  const tinOk = verdict?.result === "verified" || verdict?.result === "pending";
  const tinRefusal = verdict?.result === "failed" || verdict?.result === "taken" ? verdict.message : undefined;
  const found = verdict?.result === "verified" ? verdict.business : null;
  const groups = ownerGroupsOf(draft);
  const cluster = catalogue?.clusters.find((c) => c.code === draft.psfClusterCode) ?? null;

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

  /** Continue. A TIN nobody has checked yet is checked first, and the step stays put. */
  async function next() {
    if (kind === "tin" && /^\d{9}$/.test(tin) && tinCheck?.tin !== tin) {
      await runCheck();
      return;
    }
    if (tinRefusal) return;
    onNext();
  }

  const setKind = (value: string) => {
    onTinCheck(null);
    onChange({
      ...draft,
      psfRegistrationKind: value,
      tin: value === "tin" ? draft.tin : "",
      psfRegistrationNumber: value === "rca" || value === "rgb" || value === "other" ? draft.psfRegistrationNumber : "",
    });
  };

  const toggleGroup = (g: PsfOwnerGroup) => {
    const next = groups.includes(g) ? groups.filter((x) => x !== g) : [...groups, g];
    onChange({ ...draft, psfOwnerGroups: next.join(",") });
  };

  return (
    <StepCard
      id="register-psf-business"
      title="Your business"
      lead="Tell PSF who you are: your business, how it is registered, the sector you work in and where you are."
      footer={
        <>
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button onClick={() => void next()} pending={busy || checking}>
            {busy ? "Working…" : "Continue to check and pay"}
          </Button>
        </>
      }
    >
      <Field label="Business name" hint="As your customers and your certificate know it." error={errors["business.legalName"]}>
        <TextInput
          id="psf-legal-name"
          className="w-full"
          value={draft.legalName}
          onChange={(e) => onChange({ ...draft, legalName: e.target.value })}
        />
      </Field>

      <Fieldset
        legend="How is your business registered?"
        hint="A TIN is not required to join PSF."
        error={errors["business.registrationKind"]}
      >
        <div className="grid gap-2.5 sm:grid-cols-2">
          {KINDS.map((k) => (
            <ChoiceCard
              key={k.value}
              name="psf-registration-kind"
              value={k.value}
              checked={kind === k.value}
              title={k.title}
              description={k.description}
              onSelect={setKind}
            />
          ))}
        </div>
      </Fieldset>

      {kind === "tin" ? (
        <>
          <div className="flex flex-wrap items-end gap-2.5">
            <div className="min-w-0 flex-1 basis-64">
              <Field label="RRA TIN" hint="9 digits, on your RRA certificate." error={errors["business.tin"] ?? tinRefusal}>
                <TextInput
                  id="psf-tin"
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
              <Button variant="secondary" onClick={() => void runCheck()} disabled={!/^\d{9}$/.test(tin)} pending={checking}>
                {checking ? "Checking…" : "Check with RRA"}
              </Button>
            )}
          </div>
          {verdict?.result === "pending" ? <Notice tone="warning">{verdict.message}</Notice> : null}
          {found ? (
            <div className="flex flex-col gap-1.5 rounded-card bg-secondary p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold">{found.legalName}</span>
                <Badge variant="success" size="sm">
                  From the company register
                </Badge>
              </div>
              <span className="text-sm tabular-nums text-muted-foreground">TIN {formatTin(tin)}</span>
            </div>
          ) : verdict?.result === "verified" ? (
            <p className="text-sm text-muted-foreground" role="status">
              {verdict.message}
            </p>
          ) : null}
        </>
      ) : kind === "rca" || kind === "rgb" || kind === "other" ? (
        <Field
          label={kind === "rca" ? "RCA registration number" : kind === "rgb" ? "RGB registration number" : "Registration number"}
          hint="As printed on your certificate."
          error={errors["business.registrationNumber"]}
        >
          <TextInput
            id="psf-registration-number"
            className="w-full"
            value={draft.psfRegistrationNumber}
            onChange={(e) => onChange({ ...draft, psfRegistrationNumber: e.target.value })}
          />
        </Field>
      ) : kind === "none" ? (
        <Notice tone="info">
          PSF welcomes businesses not yet registered. Its officer sees that you have no TIN, and you can add one from your
          portal once you have it.
        </Notice>
      ) : null}

      <Fieldset
        legend="Your sector"
        hint="PSF groups businesses by sector. Pick yours, then the association you belong to."
        error={errors["business.associationCode"]}
      >
        {catalogueFailed ? (
          <Notice tone="danger">We could not load PSF’s sectors. Reload the page to try again.</Notice>
        ) : !catalogue ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="h-24 animate-pulse rounded-card bg-secondary" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {catalogue.clusters.map((c) => {
                const Icon = CLUSTER_ICON[c.code] ?? Briefcase;
                return (
                  <TileCard
                    key={c.code}
                    name="psf-cluster"
                    value={c.code}
                    checked={draft.psfClusterCode === c.code}
                    label={c.nameEn}
                    blurb={c.description ?? undefined}
                    icon={<Icon size={20} strokeWidth={1.7} />}
                    onSelect={(value) =>
                      onChange({
                        ...draft,
                        psfClusterCode: value,
                        psfAssociationCode: value === draft.psfClusterCode ? draft.psfAssociationCode : "",
                        psfSectorLabel: value === draft.psfClusterCode ? draft.psfSectorLabel : "",
                      })
                    }
                  />
                );
              })}
            </div>
            {cluster ? (
              <Field label="Your association" hint="Not on the list? Pick the last one, and PSF places you." error={undefined}>
                <SelectField
                  id="psf-association"
                  value={draft.psfAssociationCode}
                  onChange={(value) => {
                    const association = cluster.associations.find((a) => a.code === value);
                    onChange({
                      ...draft,
                      psfAssociationCode: value,
                      psfSectorLabel: association ? `${cluster.nameEn} · ${association.nameEn}` : "",
                    });
                  }}
                  placeholder="Choose your association"
                  invalid={Boolean(errors["business.associationCode"])}
                  options={cluster.associations.map((a) => ({
                    value: a.code,
                    label: a.acronym ? `${a.nameEn} (${a.acronym})` : a.nameEn,
                  }))}
                />
              </Field>
            ) : null}
          </div>
        )}
      </Fieldset>

      <Fieldset legend="Who owns it (optional)" hint="PSF’s Specialized cluster supports these businesses. Tick any that are true.">
        <div className="grid gap-2.5 sm:grid-cols-3">
          {PsfOwnerGroup.options.map((g) => {
            const on = groups.includes(g);
            return (
              <button
                key={g}
                type="button"
                aria-pressed={on}
                onClick={() => toggleGroup(g)}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-card border p-3.5 text-left transition-colors",
                  on ? "border-accent-brand bg-accent-brand/10" : "border-input hover:bg-secondary",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border",
                    on ? "border-accent-brand bg-accent-brand text-white" : "border-input",
                  )}
                >
                  {on ? <Check size={14} strokeWidth={3} /> : null}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">{PSF_OWNER_GROUP_LABEL[g]}</span>
                  <span className="text-xs text-muted-foreground">{GROUP_HINT[g]}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Fieldset>

      <Fieldset legend="Where it is" hint="Your district gives your business its code, for example KIC0001 in Kicukiro.">
        <AddressPicker
          draft={draft.address}
          onChange={(address) => onChange({ ...draft, address })}
          errors={errors}
          rwandaOnly
          collectVillage
          idPrefix="psf-address"
          errorPrefix="business.address"
        />
      </Fieldset>

      {formError ? <Notice tone="danger">{formError}</Notice> : null}
    </StepCard>
  );
}
