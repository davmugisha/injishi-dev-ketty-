"use client";

/**
 * The PSF membership tier catalogue (ADR-056 AC-19).
 *
 * Every tier, retired ones included, and one editor for adding and changing
 * them. Only a staffer whose server permissions include `admin.fee.edit` gets
 * the editor; everyone else reads the list, which is the same answer the API
 * would give them.
 *
 * PSF's tiers as the owner gave them on 2026-10-15: Golden Circle from
 * 5,000,000 a year (`minimum`, a floor with no ceiling), Indashyikirwa from
 * 200,000, and Indatwa in four bands down to 10,000. Ordinary and Junior
 * Giants are retired; their rows stay so the applications that name them read.
 */
import {
  CreatePsfTierRequest,
  PSF_FAMILY_LABEL,
  PsfMembershipFamily,
  PsfPriceKind,
  type PsfTier,
} from "@injishi/contracts";
import { Badge, Button, Input, Textarea } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { useStaffPermissions } from "@/components/shell/staff-access-provider";
import { createPsfTier, updatePsfTier } from "@/lib/actions/psf-tiers";
import { useAdminUi } from "@/lib/store";

const subscribeNothing = () => () => {};

const PRICE_KIND_LABEL: Record<PsfPriceKind, string> = {
  fixed: "A fixed amount",
  range: "A range",
  minimum: "From an amount up",
  set_by_psf: "Set by PSF",
};

const selectClass = "mt-1 h-10 w-full rounded border border-border bg-field px-2 text-sm text-foreground";

function price(t: PsfTier): string {
  const rwf = (n: number) => `${n.toLocaleString("en-US")} RWF`;
  if (t.priceKind === "fixed" && t.annualFeeRwf !== null) return `${rwf(t.annualFeeRwf)} a year`;
  if (t.priceKind === "range" && t.annualFeeMinRwf !== null && t.annualFeeMaxRwf !== null) {
    return `${rwf(t.annualFeeMinRwf)} to ${rwf(t.annualFeeMaxRwf)} a year`;
  }
  if (t.priceKind === "minimum" && t.annualFeeMinRwf !== null) return `From ${rwf(t.annualFeeMinRwf)} a year`;
  return "Set by PSF";
}

interface Draft {
  code: string;
  family: string;
  nameEn: string;
  nameRw: string;
  priceKind: string;
  fee: string;
  min: string;
  max: string;
  benefitsEn: string;
  benefitsRw: string;
  sortOrder: string;
  active: boolean;
  reason: string;
}

const EMPTY: Draft = {
  code: "",
  family: "indatwa",
  nameEn: "",
  nameRw: "",
  priceKind: "fixed",
  fee: "",
  min: "",
  max: "",
  benefitsEn: "",
  benefitsRw: "",
  sortOrder: "100",
  active: true,
  reason: "",
};

function draftOf(t: PsfTier): Draft {
  return {
    code: t.code,
    family: t.family,
    nameEn: t.nameEn,
    nameRw: t.nameRw ?? "",
    priceKind: t.priceKind,
    fee: t.annualFeeRwf?.toString() ?? "",
    min: t.annualFeeMinRwf?.toString() ?? "",
    max: t.annualFeeMaxRwf?.toString() ?? "",
    benefitsEn: t.benefitsEn.join("\n"),
    benefitsRw: (t.benefitsRw ?? []).join("\n"),
    sortOrder: String(t.sortOrder),
    active: t.active,
    reason: "",
  };
}

/** The draft in the request's shape: the price columns that belong to its kind, and no others. */
function requestOf(d: Draft) {
  const num = (s: string) => (s.trim() ? Number(s.replace(/[,\s]/g, "")) : null);
  const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
  const rw = lines(d.benefitsRw);
  return {
    code: d.code.trim(),
    family: d.family,
    nameEn: d.nameEn.trim(),
    nameRw: d.nameRw.trim() || null,
    priceKind: d.priceKind,
    annualFeeRwf: d.priceKind === "fixed" ? num(d.fee) : null,
    annualFeeMinRwf: d.priceKind === "range" || d.priceKind === "minimum" ? num(d.min) : null,
    annualFeeMaxRwf: d.priceKind === "range" ? num(d.max) : null,
    benefitsEn: lines(d.benefitsEn),
    benefitsRw: rw.length > 0 ? rw : null,
    sortOrder: Number(d.sortOrder),
    active: d.active,
    reason: d.reason.trim(),
  };
}

export function TierCatalogue({ tiers }: { tiers: PsfTier[] }) {
  const mayEdit = useStaffPermissions().includes("admin.fee.edit");
  const toast = useAdminUi((s) => s.toast);
  const router = useRouter();
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  /** Null: no editor open. `new`: adding. A code: editing that tier. */
  const [editing, setEditing] = useState<string | null>(null);
  const [d, setD] = useState<Draft>(EMPTY);
  const [pending, setPending] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  const open = (target: PsfTier | null) => {
    setRefusal(null);
    setD(target ? draftOf(target) : EMPTY);
    setEditing(target ? target.code : "new");
  };

  const save = async () => {
    const request = requestOf(d);
    // Checked with the contract the API validates with, so the reason a save
    // would be refused is named here, beside the field.
    const checked = CreatePsfTierRequest.safeParse(request);
    if (!checked.success) {
      setRefusal(checked.error.issues[0]?.message ?? "Check the tier's details.");
      return;
    }
    setRefusal(null);
    setPending(true);
    try {
      const { code, ...rest } = request;
      const out = editing === "new" ? await createPsfTier(request) : await updatePsfTier(code, rest);
      if (out.ok) {
        toast(out.message, out.tone);
        setEditing(null);
        router.refresh();
      } else {
        setRefusal(out.message);
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-6">
      {mayEdit && editing === null && (
        <Button variant="primary" onClick={() => open(null)} disabled={!hydrated}>
          Add a tier
        </Button>
      )}

      {mayEdit && editing !== null && (
        <section aria-label="Tier editor" className="rounded-card border border-border bg-field p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            {editing === "new" ? "Add a tier" : `Edit ${d.nameEn || editing}`}
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block text-sm font-semibold">
              Code {editing === "new" ? "(permanent)" : ""}
              <Input
                aria-label="Code"
                value={d.code}
                readOnly={editing !== "new"}
                onChange={(e) => set("code", e.target.value)}
                className="mt-1 w-full"
              />
            </label>
            <label className="block text-sm font-semibold">
              Family
              <select aria-label="Family" value={d.family} onChange={(e) => set("family", e.target.value)} className={selectClass}>
                {PsfMembershipFamily.options.map((f) => (
                  <option key={f} value={f}>
                    {PSF_FAMILY_LABEL[f]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Name in English
              <Input aria-label="Name in English" value={d.nameEn} onChange={(e) => set("nameEn", e.target.value)} className="mt-1 w-full" />
            </label>
            <label className="block text-sm font-semibold">
              Name in Kinyarwanda (optional)
              <Input aria-label="Name in Kinyarwanda" value={d.nameRw} onChange={(e) => set("nameRw", e.target.value)} className="mt-1 w-full" />
            </label>
            <label className="block text-sm font-semibold">
              Price
              <select aria-label="Price" value={d.priceKind} onChange={(e) => set("priceKind", e.target.value)} className={selectClass}>
                {PsfPriceKind.options.map((k) => (
                  <option key={k} value={k}>
                    {PRICE_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            {d.priceKind === "fixed" && (
              <label className="block text-sm font-semibold">
                Annual fee (RWF)
                <Input aria-label="Annual fee" inputMode="numeric" value={d.fee} onChange={(e) => set("fee", e.target.value)} className="mt-1 w-full" />
              </label>
            )}
            {d.priceKind === "minimum" && (
              <label className="block text-sm font-semibold">
                From (RWF), with no ceiling
                <Input aria-label="Lowest fee" inputMode="numeric" value={d.min} onChange={(e) => set("min", e.target.value)} className="mt-1 w-full" />
              </label>
            )}
            {d.priceKind === "range" && (
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-semibold">
                  From (RWF)
                  <Input aria-label="Lowest fee" inputMode="numeric" value={d.min} onChange={(e) => set("min", e.target.value)} className="mt-1 w-full" />
                </label>
                <label className="block text-sm font-semibold">
                  To (RWF)
                  <Input aria-label="Highest fee" inputMode="numeric" value={d.max} onChange={(e) => set("max", e.target.value)} className="mt-1 w-full" />
                </label>
              </div>
            )}
            <label className="block text-sm font-semibold md:col-span-2">
              Benefits in English, one per line
              <Textarea aria-label="Benefits in English" value={d.benefitsEn} rows={5} onChange={(e) => set("benefitsEn", e.target.value)} className="mt-1" />
            </label>
            <label className="block text-sm font-semibold md:col-span-2">
              Benefits in Kinyarwanda, one per line (optional)
              <Textarea aria-label="Benefits in Kinyarwanda" value={d.benefitsRw} rows={3} onChange={(e) => set("benefitsRw", e.target.value)} className="mt-1" />
            </label>
            <label className="block text-sm font-semibold">
              Order on the form
              <Input aria-label="Order" inputMode="numeric" value={d.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} className="mt-1 w-full" />
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold">
              <input type="checkbox" checked={d.active} onChange={(e) => set("active", e.target.checked)} />
              Offered on the form
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-semibold">Reason, recorded on the audit trail with your name</span>
              <Textarea aria-label="Reason" value={d.reason} rows={2} onChange={(e) => set("reason", e.target.value)} className="mt-1" />
            </label>
          </div>
          {refusal && (
            <p role="alert" className="mt-3 rounded-card border border-destructive/40 bg-destructive/5 p-3 text-sm text-foreground">
              {refusal}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <Button variant="primary" pending={pending} onClick={() => void save()}>
              {pending ? "Saving" : "Save tier"}
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </section>
      )}

      <section aria-label="Tiers" className="overflow-hidden rounded-card border border-border">
        <table className="w-full text-sm">
          <thead className="bg-field text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Family</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">State</th>
              {mayEdit && <th className="px-4 py-3" aria-label="Actions" />}
            </tr>
          </thead>
          <tbody>
            {tiers.map((t) => (
              <tr key={t.code} className="border-t border-border align-top">
                <td className="px-4 py-3">
                  <p className="font-semibold">{t.nameEn}</p>
                  <p className="text-xs text-muted-foreground">{t.code}</p>
                </td>
                <td className="px-4 py-3">{PSF_FAMILY_LABEL[t.family]}</td>
                <td className="px-4 py-3">{price(t)}</td>
                <td className="px-4 py-3">
                  <Badge variant={t.active ? "success" : "default"}>{t.active ? "Offered" : "Retired"}</Badge>
                </td>
                {mayEdit && (
                  <td className="px-4 py-3 text-right">
                    <Button variant="secondary" size="sm" disabled={!hydrated || editing !== null} onClick={() => open(t)}>
                      Edit
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
