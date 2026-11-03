"use client";

import { Accessibility, Briefcase, Check, Factory, ShoppingBag, Sparkles, Sprout, Users } from "lucide-react";
import {
  ENTERPRISE_REGISTRATION_KIND_LABEL,
  PSF_COMPANY_TYPE_LABEL,
  PSF_OWNERSHIP_LABEL,
  isOtherAssociation,
  type EnterpriseRegistrationKind,
  type PsfCatalogue,
  type PsfCompanyType,
  type PsfOwnerGroup,
  type PsfOwnership,
} from "@injishi/contracts";

import { ChoiceCard, Field, Fieldset, SelectField, TextArea, TextInput, TileCard } from "@/app/(app)/(entry)/register/wizard-ui";

import { TYPE_IT, type Errors, type PsfDraft } from "./draft";

const CLUSTER_ICON: Record<string, typeof Sprout> = {
  agriculture: Sprout,
  industry: Factory,
  trade: ShoppingBag,
  services: Briefcase,
};

const KIND_HINT: Record<EnterpriseRegistrationKind, string> = {
  tin: "9 digits, on your RRA certificate. We check it with RRA.",
  rca: "Registered with the Rwanda Cooperative Agency.",
  rgb: "Registered with the Rwanda Governance Board.",
  other: "Any other register, with its number.",
  none: "You can still join PSF, and add a TIN later.",
};

const GROUPS: { key: PsfOwnerGroup; title: string; blurb: string; icon: typeof Users }[] = [
  { key: "women", title: "Women owned", blurb: "A woman owns most of it", icon: Sparkles },
  { key: "youth", title: "Youth owned", blurb: "Owned by someone under 35", icon: Users },
  { key: "pwd", title: "Disability", blurb: "Owned by a person with a disability", icon: Accessibility },
];

/**
 * Step 1, Your business: how it is registered (its TIN first, 2026-11-02), its
 * name, and its sector, with the kind of business, the association it belongs
 * to and who owns it. Where it trades is the next step (`step-place.tsx`).
 */
export function StepBusiness({
  draft,
  onChange,
  errors,
  catalogue,
}: {
  draft: PsfDraft;
  onChange: (next: Partial<PsfDraft>) => void;
  errors: Errors;
  catalogue: PsfCatalogue | null;
}) {
  const cluster = catalogue?.clusters.find((c) => c.code === draft.clusterCode) ?? null;
  // The cluster's catch-all row (`trade_other`) is not offered as a name: it is
  // what "type it" files under, beside the name the business gives.
  // The associations follow the kind of business: the ones PSF filed under it,
  // or, for a kind typed by the business or one with none linked, the sector's.
  const subsector = cluster?.subsectors.find((x) => x.id === draft.subsectorId) ?? null;
  const pool = cluster?.associations.filter((a) => !isOtherAssociation(a.code)) ?? [];
  const linked = subsector ? pool.filter((a) => subsector.associationCodes.includes(a.code)) : [];
  const listed = linked.length ? linked : pool;
  const otherCode = cluster?.associations.find((a) => isOtherAssociation(a.code))?.code ?? null;
  const typing = Boolean(draft.associationCode) && isOtherAssociation(draft.associationCode);
  const e = (k: string) => errors[`business.${k}`];

  const toggleGroup = (g: PsfOwnerGroup) =>
    onChange({ ownerGroups: draft.ownerGroups.includes(g) ? draft.ownerGroups.filter((x) => x !== g) : [...draft.ownerGroups, g] });

  return (
    <div className="flex flex-col gap-10">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Your business</h2>
        <p className="mt-1.5 text-muted-foreground">
          Start with how your business is registered, its TIN if it has one. Then its name and the sector it works in.
        </p>
      </header>

      {/* How it is registered comes first: the TIN is what PSF and RRA know the business by. */}
      <Section number={1} title="Registration">
        <Fieldset legend="How is it registered?" hint="A TIN is not required to join PSF." error={e("registrationKind")}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(Object.keys(ENTERPRISE_REGISTRATION_KIND_LABEL) as EnterpriseRegistrationKind[]).map((k) => (
              <ChoiceCard
                key={k}
                name="psf-registration-kind"
                value={k}
                checked={draft.registrationKind === k}
                title={k === "tin" ? "RRA TIN" : k === "rca" ? "Cooperative (RCA)" : k === "rgb" ? "NGO or association (RGB)" : ENTERPRISE_REGISTRATION_KIND_LABEL[k]}
                description={KIND_HINT[k]}
                // A cooperative and an NGO say what kind of company they are in how they registered.
                onSelect={() =>
                  onChange({
                    registrationKind: k,
                    ...(!draft.companyType && k === "rca" ? { companyType: "cooperative" as const } : {}),
                    ...(!draft.companyType && k === "rgb" ? { companyType: "ngo" as const } : {}),
                  })
                }
              />
            ))}
          </div>
        </Fieldset>
        {draft.registrationKind === "tin" ? (
          <Field label="TIN" required error={e("tin")}>
            <TextInput
              id="psf-tin"
              className="w-full font-mono tracking-wider sm:max-w-tile"
              inputMode="numeric"
              maxLength={9}
              value={draft.tin}
              onChange={(ev) => onChange({ tin: ev.target.value.replace(/\D/g, "").slice(0, 9) })}
            />
          </Field>
        ) : null}
        {["rca", "rgb", "other"].includes(draft.registrationKind) ? (
          <Field label="Registration number" hint="As printed on your certificate." required error={e("registrationNumber")}>
            <TextInput
              id="psf-reg-number"
              className="w-full sm:max-w-tile"
              value={draft.registrationNumber}
              onChange={(ev) => onChange({ registrationNumber: ev.target.value })}
            />
          </Field>
        ) : null}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Kind of company" required error={e("companyType")}>
            <SelectField
              id="psf-company-type"
              value={draft.companyType}
              placeholder="Choose"
              onChange={(v) => onChange({ companyType: v as PsfCompanyType })}
              options={Object.entries(PSF_COMPANY_TYPE_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </Field>
          <Field label="Ownership" required error={e("ownership")}>
            <SelectField
              id="psf-ownership"
              value={draft.ownership}
              placeholder="Choose"
              onChange={(v) => onChange({ ownership: v as PsfOwnership })}
              options={Object.entries(PSF_OWNERSHIP_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </Field>
        </div>
        {draft.ownership === "other" ? (
          <Field label="What is the ownership?" required error={e("ownershipOther")}>
            <TextInput id="psf-ownership-other" className="w-full" value={draft.ownershipOther} onChange={(ev) => onChange({ ownershipOther: ev.target.value })} />
          </Field>
        ) : null}
      </Section>

      <Section number={2} title="The business">
        <Field
          label="Business name"
          hint="As your customers and your certificate know it. Every branch goes by this name too."
          required
          error={e("legalName")}
        >
          <TextInput id="psf-legal-name" className="w-full" value={draft.legalName} onChange={(ev) => onChange({ legalName: ev.target.value })} />
        </Field>
        <Field label="Website (optional)" error={e("website")}>
          <TextInput id="psf-website" className="w-full" placeholder="https://" value={draft.website} onChange={(ev) => onChange({ website: ev.target.value })} />
        </Field>
      </Section>

      <Section number={3} title="Sector">
        <Fieldset legend="Your sector" hint="PSF groups its members by sector. Pick yours, then the association you belong to." error={e("clusterCode")}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(catalogue?.clusters ?? []).map((c) => {
              const Icon = CLUSTER_ICON[c.code] ?? Briefcase;
              return (
                <TileCard
                  key={c.code}
                  name="psf-cluster"
                  value={c.code}
                  checked={draft.clusterCode === c.code}
                  label={c.nameEn}
                  icon={<Icon size={20} strokeWidth={1.7} />}
                  onSelect={() => onChange({ clusterCode: c.code, subsectorId: "", subsectorOther: "", associationCode: "", associationOther: "" })}
                />
              );
            })}
            {catalogue === null ? [0, 1, 2, 3].map((i) => <span key={i} className="h-24 animate-pulse rounded-card bg-secondary" />) : null}
          </div>
        </Fieldset>
        {cluster ? (
          <div className="flex flex-col gap-3">
            <Field
              label="Kind of business"
              hint={`The part of ${cluster.nameEn} your business is in. Not on the list? Choose Other and type it.`}
              required
              error={e("subsectorId")}
            >
              <SelectField
                id="psf-subsector"
                value={draft.subsectorId}
                placeholder="Choose the kind of business"
                onChange={(v) =>
                  // A new kind narrows the associations, so the old pick may no longer be among them.
                  onChange({ subsectorId: v, subsectorOther: v === TYPE_IT ? draft.subsectorOther : "", associationCode: "", associationOther: "" })
                }
                options={[
                  ...cluster.subsectors.map((x) => ({ value: x.id, label: x.nameEn })),
                  { value: TYPE_IT, label: "Other" },
                ]}
              />
            </Field>
            {draft.subsectorId === TYPE_IT ? (
              <Field label="What kind of business is it?" hint="A few words, like “Beekeeping” or “Solar installation”." required error={e("subsectorOther")}>
                <TextInput
                  id="psf-subsector-other"
                  className="w-full"
                  value={draft.subsectorOther}
                  onChange={(ev) => onChange({ subsectorOther: ev.target.value })}
                />
              </Field>
            ) : null}
          </div>
        ) : null}
        {cluster && draft.subsectorId ? (
          <div className="flex flex-col gap-3">
            <Field
              label="Your association"
              hint="Pick yours from PSF's list. Not there? Choose the last line and type it."
              required
              error={e("associationCode")}
            >
              <SelectField
                id="psf-association"
                value={typing ? TYPE_IT : draft.associationCode}
                placeholder="Choose your association"
                onChange={(v) =>
                  v === TYPE_IT
                    ? onChange({ associationCode: otherCode ?? "", associationOther: draft.associationOther })
                    : onChange({ associationCode: v, associationOther: "" })
                }
                options={[
                  ...listed.map((a) => ({ value: a.code, label: a.acronym ? `${a.nameEn} (${a.acronym})` : a.nameEn })),
                  ...(otherCode ? [{ value: TYPE_IT, label: "Not on the list: I will type it" }] : []),
                ]}
              />
            </Field>
            {typing ? (
              <Field
                label="Name of your association"
                hint={`Or what the business does, if it belongs to none. PSF files it under ${cluster.nameEn} and places you.`}
                required
                error={e("associationOther")}
              >
                <TextInput
                  id="psf-association-other"
                  className="w-full"
                  autoFocus
                  placeholder="Like “Rwanda Beekeepers Association”"
                  value={draft.associationOther}
                  onChange={(ev) => onChange({ associationOther: ev.target.value })}
                />
              </Field>
            ) : null}
          </div>
        ) : null}
        {cluster ? (
          <>
            <Field label="What does the business do?" hint="In a few words, like “Fresh produce shop” or “Metal fabrication”." required error={e("businessActivity")}>
              <TextArea
                id="psf-activity"
                className="w-full"
                rows={2}
                value={draft.businessActivity}
                onChange={(ev) => onChange({ businessActivity: ev.target.value })}
              />
            </Field>
            <Fieldset legend="Who owns it (optional)" hint="PSF’s Specialized cluster supports these businesses. Tick any that are true.">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {GROUPS.map((g) => {
                  const on = draft.ownerGroups.includes(g.key);
                  return (
                    <button
                      key={g.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleGroup(g.key)}
                      className={[
                        "flex items-start gap-3 rounded-card border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        on ? "border-accent-brand bg-accent-brand/10" : "border-input hover:bg-secondary",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border",
                          on ? "border-accent-brand bg-accent-brand text-accent-brand-foreground" : "border-input",
                        ].join(" ")}
                      >
                        {on ? <Check size={12} strokeWidth={3} aria-hidden /> : null}
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">{g.title}</span>
                        <span className="block text-xs text-muted-foreground">{g.blurb}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Fieldset>
          </>
        ) : null}
      </Section>

    </div>
  );
}

export function Section({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold tabular-nums text-muted-foreground ring-1 ring-border">
          {number}
        </span>
        <h3 className="text-base font-semibold">{title}</h3>
        <span className="h-px flex-1 bg-border" aria-hidden />
      </div>
      {children}
    </section>
  );
}
