"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@injishi/web-ui";
import { MAX_PSF_BRANCHES, provinceDisplayName, type District, type Province, type Sector } from "@injishi/contracts";

import { Field, SelectField, TextInput } from "@/app/(app)/(entry)/register/wizard-ui";
import { fetchDistricts, fetchSectors } from "@/data/geography";

import { newBranch, type Errors, type PsfBranchDraft } from "./draft";

/**
 * The other places the business trades from (2026-10-23). Optional: most
 * businesses have one. A branch trades under the business's own name, so only
 * where it is gets asked. Each goes to the PSF office of ITS district to
 * admit, so each carries the full place, like the head office.
 */
export function BranchesEditor({
  branches,
  onChange,
  provinces,
  errors,
}: {
  branches: PsfBranchDraft[];
  onChange: (next: PsfBranchDraft[]) => void;
  provinces: Province[];
  errors: Errors;
}) {
  const update = (i: number, next: Partial<PsfBranchDraft>) =>
    onChange(branches.map((b, j) => (j === i ? { ...b, ...next } : b)));

  return (
    <div className="flex flex-col gap-4">
      {branches.map((b, i) => (
        <BranchCard
          key={b.key}
          index={i}
          branch={b}
          provinces={provinces}
          errors={errors}
          onChange={(next) => update(i, next)}
          onRemove={() => onChange(branches.filter((_, j) => j !== i))}
        />
      ))}
      {branches.length < MAX_PSF_BRANCHES ? (
        <div>
          <Button variant="outline" onClick={() => onChange([...branches, newBranch()])}>
            <Plus size={16} aria-hidden /> {branches.length ? "Add another branch" : "Add a branch"}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">That is the most one form can list. PSF can add more later.</p>
      )}
    </div>
  );
}

function BranchCard({
  index,
  branch,
  provinces,
  errors,
  onChange,
  onRemove,
}: {
  index: number;
  branch: PsfBranchDraft;
  provinces: Province[];
  errors: Errors;
  onChange: (next: Partial<PsfBranchDraft>) => void;
  onRemove: () => void;
}) {
  const [districts, setDistricts] = useState<District[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  useEffect(() => {
    setDistricts([]);
    if (branch.provinceId) void fetchDistricts(Number(branch.provinceId)).then((r) => r.status === "ok" && setDistricts(r.data));
  }, [branch.provinceId]);
  useEffect(() => {
    setSectors([]);
    if (branch.districtId) void fetchSectors(Number(branch.districtId)).then((r) => r.status === "ok" && setSectors(r.data));
  }, [branch.districtId]);

  const e = (k: string) => errors[`business.branches.${index}.${k}`];
  const id = (k: string) => `psf-branch-${branch.key}-${k}`;

  return (
    <div className="flex flex-col gap-4 rounded-card border border-border p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold">Branch {index + 1}</h4>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <Trash2 size={14} aria-hidden /> Remove
        </button>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Field label="Province" required error={e("address.provinceId")}>
          <SelectField
            id={id("province")}
            value={branch.provinceId}
            placeholder="Choose"
            onChange={(v) =>
              onChange({
                provinceId: v,
                districtId: "",
                sectorId: "",
                placeNames: { province: provinceDisplayName(provinces.find((p) => String(p.id) === v)?.name), district: "", sector: "" },
              })
            }
            options={provinces.map((p) => ({ value: String(p.id), label: provinceDisplayName(p.name) }))}
          />
        </Field>
        <Field label="District" required error={e("address.districtId")}>
          <SelectField
            id={id("district")}
            value={branch.districtId}
            placeholder={branch.provinceId ? "Choose" : "Pick a province first"}
            disabled={!branch.provinceId}
            onChange={(v) =>
              onChange({
                districtId: v,
                sectorId: "",
                placeNames: { ...branch.placeNames, district: districts.find((d) => String(d.id) === v)?.name ?? "", sector: "" },
              })
            }
            options={districts.map((d) => ({ value: String(d.id), label: d.name }))}
          />
        </Field>
        <Field label="Sector" required error={e("address.sectorId")}>
          <SelectField
            id={id("sector")}
            value={branch.sectorId}
            placeholder={branch.districtId ? "Choose" : "Pick a district first"}
            disabled={!branch.districtId}
            onChange={(v) =>
              onChange({ sectorId: v, placeNames: { ...branch.placeNames, sector: sectors.find((x) => String(x.id) === v)?.name ?? "" } })
            }
            options={sectors.map((s) => ({ value: String(s.id), label: s.name }))}
          />
        </Field>
      </div>
      <Field label="Street address" hint="Optional." error={e("address.street")}>
        <TextInput id={id("street")} className="w-full" value={branch.street} onChange={(ev) => onChange({ street: ev.target.value })} />
      </Field>
    </div>
  );
}
