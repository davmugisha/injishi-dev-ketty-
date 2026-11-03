"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  PSF_TRADE_DIRECTION_LABEL,
  provinceDisplayName,
  type Cell,
  type District,
  type Province,
  type PsfTradeDirection,
  type Sector,
  type Village,
} from "@injishi/contracts";

import { COUNTRY_OPTIONS } from "@/app/(app)/(entry)/register/country-options";
import { Field, Fieldset, SelectField, TextInput } from "@/app/(app)/(entry)/register/wizard-ui";
import { fetchCells, fetchDistricts, fetchProvinces, fetchSectors, fetchVillages } from "@/data/geography";

import { BranchesEditor } from "./branches";
import { type Errors, type PsfDraft } from "./draft";
import { Section } from "./step-business";

/**
 * Step 2, Where it trades (2026-11-02, split from Your business so neither
 * step is long): the head office's place and street, any branches, and what it
 * trades abroad. Branches share the business's name, so a branch is asked only
 * where it is.
 *
 * The street line is optional (2026-11-02): the village already places the
 * business, and not every plot has a street.
 */
export function StepPlace({
  draft,
  onChange,
  errors,
}: {
  draft: PsfDraft;
  onChange: (next: Partial<PsfDraft>) => void;
  errors: Errors;
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

  const e = (k: string) => errors[`business.${k}`];

  return (
    <div className="flex flex-col gap-10">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Where it trades</h2>
        <p className="mt-1.5 text-muted-foreground">Where the business is, any other places it trades from, and whether it trades abroad.</p>
      </header>

      <Section number={1} title="Where it is">
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
        <Field label="Street address" hint="Optional. Where PSF can find you, like “KK 15 Ave” or “Masaka trading centre”." error={e("address.street")}>
          <TextInput id="psf-street" className="w-full" value={draft.street} onChange={(ev) => onChange({ street: ev.target.value })} />
        </Field>
      </Section>

      <Section number={2} title="Branches">
        <p className="-mt-2 text-sm text-muted-foreground">
          Optional. List any other place the business trades from, under the same name. The PSF office of each branch&rsquo;s
          district admits it.
        </p>
        <BranchesEditor branches={draft.branches} onChange={(branches) => onChange({ branches })} provinces={provinces} errors={errors} />
      </Section>

      <Section number={3} title="Trade">
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
    </div>
  );
}
