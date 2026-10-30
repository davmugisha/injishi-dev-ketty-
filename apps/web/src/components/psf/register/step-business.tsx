"use client";

import { useEffect, useState } from "react";
import { Accessibility, Briefcase, Check, Factory, ShoppingBag, Sparkles, Sprout, Users, X } from "lucide-react";
import {
  ENTERPRISE_REGISTRATION_KIND_LABEL,
  PSF_COMPANY_TYPE_LABEL,
  PSF_OWNERSHIP_LABEL,
  PSF_TRADE_DIRECTION_LABEL,
  isOtherAssociation,
  provinceDisplayName,
  type District,
  type EnterpriseRegistrationKind,
  type Province,
  type PsfCatalogue,
  type PsfCompanyType,
  type PsfOwnerGroup,
  type PsfOwnership,
  type PsfTradeDirection,
  type Sector,
  type Cell,
  type Village,
} from "@injishi/contracts";

import { COUNTRY_OPTIONS } from "@/app/(app)/(entry)/register/country-options";
import { ChoiceCard, Field, Fieldset, SelectField, TextArea, TextInput, TileCard } from "@/app/(app)/(entry)/register/wizard-ui";
import { fetchCells, fetchDistricts, fetchProvinces, fetchSectors, fetchVillages } from "@/data/geography";

import { BranchesEditor } from "./branches";
import { LogoField } from "./logo-field";
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
 * Step 2, Your business: everything PSF's form asks about the business. Its
 * name comes first, then the sector, with the kind of business and the
 * association it belongs to; the rest (how it is registered, where it is, its
 * branches and what it trades) opens only once a sector is picked. Branches
 * share the business's name, so a branch is asked only where it is.
 *
 * The street line is REQUIRED here, unlike on the hotel form, because PSF's
 * form asks for it: asking once, here, is what keeps the officer from sending
 * the application back for it.
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
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [country, setCountry] = useState("");

  useEffect(() => {
    void fetchProvinces().then((r) => r.status === "ok" && setProvinces(r.data));
  }, []);
  useEffect(() => {
    setDistricts([]);
    if (draft.provinceId) void fetchDistricts(Number(draft.provinceId)).then((r) => r.status === "ok" && setDistricts(r.data));
  }, [draft.provinceId]);
  useEffect(() => {
    setSectors([]);
    if (draft.districtId) void fetchSectors(Number(draft.districtId)).then((r) => r.status === "ok" && setSectors(r.data));
  }, [draft.districtId]);
  useEffect(() => {
    setCells([]);
    if (draft.sectorId) void fetchCells(Number(draft.sectorId)).then((r) => r.status === "ok" && setCells(r.data));
  }, [draft.sectorId]);
  useEffect(() => {
    setVillages([]);
    if (draft.cellId) void fetchVillages(Number(draft.cellId)).then((r) => r.status === "ok" && setVillages(r.data));
  }, [draft.cellId]);

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
          Start with your business&rsquo;s name and the sector it works in. Then tell PSF how it is registered and where it is.
        </p>
      </header>

      <Section number={1} title="The business">
        <Field
          label="Business name"
          hint="As your customers and your certificate know it. Every branch goes by this name too."
          required
          error={e("legalName")}
        >
          <TextInput id="psf-legal-name" className="w-full" value={draft.legalName} onChange={(ev) => onChange({ legalName: ev.target.value })} />
        </Field>
        <LogoField
          checkToken={draft.applicant?.checkToken ?? null}
          objectKey={draft.logoObjectKey}
          name={draft.logoName}
          error={e("logoObjectKey")}
          onChange={onChange}
        />
      </Section>

      <Section number={2} title="Sector">
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

      {/* The sector comes first: it decides which kinds of business and which
          associations are offered, so the rest of the step waits for it. */}
      {draft.clusterCode ? (
        <>
        <Section number={3} title="Registration">
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

        <Section number={4} title="Where it is">
          <p className="-mt-2 text-sm text-muted-foreground">Your district gives the business its code, for example KIC0001 in Kicukiro.</p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <Field label="Province" required error={e("address.provinceId")}>
              <SelectField
                id="psf-province"
                value={draft.provinceId}
                placeholder="Choose"
                onChange={(v) =>
                  onChange({
                    provinceId: v,
                    districtId: "",
                    sectorId: "",
                    cellId: "",
                    villageId: "",
                    placeNames: { province: provinceDisplayName(provinces.find((p) => String(p.id) === v)?.name), district: "", sector: "", cell: "", village: "" },
                  })
                }
                options={provinces.map((p) => ({ value: String(p.id), label: provinceDisplayName(p.name) }))}
              />
            </Field>
            <Field label="District" required error={e("address.districtId")}>
              <SelectField
                id="psf-district"
                value={draft.districtId}
                placeholder={draft.provinceId ? "Choose" : "Pick a province first"}
                disabled={!draft.provinceId}
                onChange={(v) =>
                  onChange({
                    districtId: v,
                    sectorId: "",
                    cellId: "",
                    villageId: "",
                    placeNames: { ...draft.placeNames, district: districts.find((d) => String(d.id) === v)?.name ?? "", sector: "", cell: "", village: "" },
                  })
                }
                options={districts.map((d) => ({ value: String(d.id), label: d.name }))}
              />
            </Field>
            <Field label="Sector" required error={e("address.sectorId")}>
              <SelectField
                id="psf-sector"
                value={draft.sectorId}
                placeholder={draft.districtId ? "Choose" : "Pick a district first"}
                disabled={!draft.districtId}
                onChange={(v) =>
                  onChange({
                    sectorId: v,
                    cellId: "",
                    villageId: "",
                    placeNames: { ...draft.placeNames, sector: sectors.find((x) => String(x.id) === v)?.name ?? "", cell: "", village: "" },
                  })
                }
                options={sectors.map((s) => ({ value: String(s.id), label: s.name }))}
              />
            </Field>
            <Field label="Cell" required error={e("address.cellId")}>
              <SelectField
                id="psf-cell"
                value={draft.cellId}
                placeholder={draft.sectorId ? "Choose" : "Pick a sector first"}
                disabled={!draft.sectorId}
                onChange={(v) =>
                  onChange({
                    cellId: v,
                    villageId: "",
                    placeNames: { ...draft.placeNames, cell: cells.find((c) => String(c.id) === v)?.name ?? "", village: "" },
                  })
                }
                options={cells.map((c) => ({ value: String(c.id), label: c.name }))}
              />
            </Field>
            <Field label="Village" required error={e("address.villageId")}>
              <SelectField
                id="psf-village"
                value={draft.villageId}
                placeholder={draft.cellId ? "Choose" : "Pick a cell first"}
                disabled={!draft.cellId}
                onChange={(v) =>
                  onChange({ villageId: v, placeNames: { ...draft.placeNames, village: villages.find((x) => String(x.id) === v)?.name ?? "" } })
                }
                options={villages.map((x) => ({ value: String(x.id), label: x.name }))}
              />
            </Field>
          </div>
          <Field label="Street address" hint="Where PSF can find you, like “KK 15 Ave” or “Masaka trading centre”." required error={e("address.street")}>
            <TextInput id="psf-street" className="w-full" value={draft.street} onChange={(ev) => onChange({ street: ev.target.value })} />
          </Field>
          <Field label="Website (optional)" error={e("website")}>
            <TextInput id="psf-website" className="w-full" placeholder="https://" value={draft.website} onChange={(ev) => onChange({ website: ev.target.value })} />
          </Field>
        </Section>

        <Section number={5} title="Branches">
          <p className="-mt-2 text-sm text-muted-foreground">
            Optional. List any other place the business trades from, under the same name. The PSF office of each branch&rsquo;s
            district admits it.
          </p>
          <BranchesEditor branches={draft.branches} onChange={(branches) => onChange({ branches })} provinces={provinces} errors={errors} />
        </Section>

        <Section number={6} title="Trade">
          <Fieldset legend="Do you export or import?">
            <div className="inline-flex flex-wrap gap-2 rounded-full bg-secondary p-1">
              {(Object.keys(PSF_TRADE_DIRECTION_LABEL) as PsfTradeDirection[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={draft.tradeDirection === t}
                  onClick={() => onChange({ tradeDirection: t })}
                  className={[
                    "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                    draft.tradeDirection === t ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {PSF_TRADE_DIRECTION_LABEL[t]}
                </button>
              ))}
            </div>
          </Fieldset>
          {draft.tradeDirection !== "none" ? (
            <>
              <Field label="What do you trade?" required error={e("tradeGoods")}>
                <TextInput id="psf-trade-goods" className="w-full" value={draft.tradeGoods} onChange={(ev) => onChange({ tradeGoods: ev.target.value })} />
              </Field>
              <Field label="Countries you trade with" required error={e("tradeCountries")}>
                <div className="flex flex-col gap-3">
                  <SelectField
                    id="psf-trade-country"
                    value={country}
                    placeholder="Add a country"
                    onChange={(v) => {
                      setCountry("");
                      if (v && !draft.tradeCountries.includes(v)) onChange({ tradeCountries: [...draft.tradeCountries, v] });
                    }}
                    options={COUNTRY_OPTIONS.filter((o) => o.value !== "RW" && !draft.tradeCountries.includes(o.value))}
                  />
                  {draft.tradeCountries.length > 0 ? (
                    <ul className="flex list-none flex-wrap gap-2 p-0">
                      {draft.tradeCountries.map((c) => (
                        <li key={c}>
                          <button
                            type="button"
                            onClick={() => onChange({ tradeCountries: draft.tradeCountries.filter((x) => x !== c) })}
                            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-sm hover:bg-secondary"
                            aria-label={`Remove ${COUNTRY_OPTIONS.find((o) => o.value === c)?.label ?? c}`}
                          >
                            {COUNTRY_OPTIONS.find((o) => o.value === c)?.label ?? c}
                            <X size={13} aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </Field>
            </>
          ) : null}
        </Section>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Pick your sector to continue with the rest of your business details.</p>
      )}
    </div>
  );
}

function Section({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
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
