"use client";

/**
 * The PSF console's Fees (2026-10-20): what each membership band costs, by
 * place. The public form shows this amount read only; a business no longer
 * types its own.
 *
 * A national officer sets PSF's national price for each band. A district (or
 * province) officer sets their district's own, which wins inside it; a band
 * the district has not priced uses the national price, and a band nobody has
 * priced uses its starting price from the catalogue.
 */
import { useCallback, useEffect, useState } from "react";
import { Check, Globe2, Info, MapPin, Pencil, RotateCcw, X } from "lucide-react";

import { PSF_FAMILY_LABEL, PSF_OFFERED_FAMILIES, type PsfOfficerFeeRow, type PsfOfficerFeesView } from "@injishi/contracts";
import { formatPrice } from "@injishi/utils";

import { humanError } from "../../data/api";
import { refusalField } from "../../data/psf";
import { LoadFailed } from "../../components/ui";
import type { QueuedToast } from "../../lib/toast-queue";
import { fetchPsfFees, setPsfFee } from "../data/psf-console";
import { PsfConsoleShell, usePsfConsole } from "../components/psf-console-shell";
import { cn } from "@/lib/utils";

export function PsfFees() {
  const [toasts, setToasts] = useState<QueuedToast[]>([]);
  const toast = useCallback((txt: string, intent: QueuedToast["intent"] = "ok") => {
    setToasts((t) => [...t, { id: Date.now() + Math.random(), txt, intent }]);
  }, []);
  return (
    <PsfConsoleShell title="Fees" lede="What each membership band costs a year" toasts={toasts}>
      <Body toast={toast} />
    </PsfConsoleShell>
  );
}

const SOURCE: Record<PsfOfficerFeeRow["source"], { label: string; className: string }> = {
  district: { label: "District price", className: "bg-accent-soft text-accent-text" },
  national: { label: "National price", className: "bg-info-bg text-info" },
  band: { label: "Band start", className: "bg-hover text-muted-foreground" },
};

function bandText(r: PsfOfficerFeeRow): string {
  if (r.priceKind === "range" && r.bandMinRwf !== null && r.bandMaxRwf !== null) return `${formatPrice(r.bandMinRwf)} to ${formatPrice(r.bandMaxRwf)}`;
  if (r.priceKind === "minimum" && r.bandMinRwf !== null) return `From ${formatPrice(r.bandMinRwf)}`;
  if (r.priceKind === "fixed" && r.bandFeeRwf !== null) return `Fixed at ${formatPrice(r.bandFeeRwf)}`;
  return "PSF names the price";
}

function Body({ toast }: { toast: (txt: string, intent?: QueuedToast["intent"]) => void }) {
  const { area, areaLabel } = usePsfConsole();
  const [view, setView] = useState<PsfOfficerFeesView | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    const r = await fetchPsfFees(area);
    if (r.outcome === "ok") setView(r.data);
    else setFailed(true);
  }, [area]);
  useEffect(() => {
    setEditing(null);
    void load();
  }, [load]);

  if (failed) return <LoadFailed onRetry={() => void load()}>We couldn&apos;t load the fees.</LoadFailed>;
  if (!view) return <div className="h-96 animate-pulse rounded bg-hover" />;

  const district = view.districtId !== null;
  // The column the officer edits here: the district's when one is shown, else the national one.
  const editable = district ? view.canEditDistrict : view.canEditNational;
  const families = PSF_OFFERED_FAMILIES.map((f) => ({ family: f, rows: view.rows.filter((r) => r.family === f) })).filter((g) => g.rows.length);

  const save = async (row: PsfOfficerFeeRow, amountRwf: number | null): Promise<string | null> => {
    try {
      const next = await setPsfFee({ tierCode: row.tierCode, districtId: view.districtId, amountRwf });
      setView(next);
      setEditing(null);
      toast(
        amountRwf === null
          ? `${row.tierName} in ${view.districtName ?? "Rwanda"} now uses ${district ? "the national price" : "its band start"}.`
          : `${row.tierName} is ${formatPrice(amountRwf)} a year ${district ? `in ${view.districtName}` : "nationally"}.`,
      );
      return null;
    } catch (error) {
      return refusalField(error)?.message ?? humanError(error);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 rounded border border-line bg-card p-4 shadow-sm sm:flex-row sm:items-start">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text">
          {district ? <MapPin size={18} aria-hidden /> : <Globe2 size={18} aria-hidden />}
        </span>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold text-ink">
            {district ? `Prices for ${view.districtName} district` : "PSF's national prices"}
          </p>
          <p className="mt-0.5 max-w-[78ch] text-muted-foreground">
            {district
              ? "A business registering here pays the amount under “On the form”. Set the district’s own price for a band, or leave it on the national price."
              : view.canEditNational
                ? "Every district uses these unless it sets its own. Pick a district in the place switcher to see or set its prices."
                : `Set by PSF's national office. Pick a district in the place switcher to set its prices for ${areaLabel}.`}
          </p>
        </div>
      </div>

      {families.map(({ family, rows }) => (
        <section key={family} className="overflow-hidden rounded border border-line bg-card shadow-sm">
          <h2 className="border-b border-line bg-hover/60 px-4 py-2.5 text-sm font-bold text-ink">{PSF_FAMILY_LABEL[family]}</h2>
          <div
            className={cn(
              "hidden gap-4 border-b border-line px-4 py-2 text-2xs font-bold uppercase tracking-wide text-muted-foreground lg:grid",
              district ? "lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_8rem]" : "lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.3fr)_8rem]",
            )}
          >
            <span>Band</span>
            <span>National</span>
            {district ? <span>{view.districtName}</span> : null}
            <span>On the form</span>
            <span />
          </div>
          <ul className="flex list-none flex-col divide-y divide-line p-0">
            {rows.map((r) => (
              <FeeRow
                key={r.tierCode}
                row={r}
                district={district}
                editable={editable}
                editing={editing === r.tierCode}
                onEdit={() => setEditing(r.tierCode)}
                onCancel={() => setEditing(null)}
                onSave={save}
              />
            ))}
          </ul>
        </section>
      ))}

      <p className="inline-flex items-start gap-2 text-xs text-muted-foreground">
        <Info size={13} aria-hidden className="mt-px shrink-0" />A new price applies to forms sent from now on. An application already sent keeps the
        amount it paid.
      </p>
    </div>
  );
}

function FeeRow({
  row,
  district,
  editable,
  editing,
  onEdit,
  onCancel,
  onSave,
}: {
  row: PsfOfficerFeeRow;
  district: boolean;
  editable: boolean;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (row: PsfOfficerFeeRow, amountRwf: number | null) => Promise<string | null>;
}) {
  const current = district ? row.districtRwf : row.nationalRwf;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    if (editing) {
      setText(String(current ?? row.effectiveRwf ?? ""));
      setProblem(null);
    }
  }, [editing, current, row.effectiveRwf]);

  const amount = Number(text.replace(/[^\d]/g, ""));
  const submit = async (value: number | null) => {
    setBusy(true);
    setProblem(await onSave(row, value));
    setBusy(false);
  };
  const src = SOURCE[row.source];

  return (
    <li
      className={cn(
        "grid grid-cols-1 items-center gap-x-4 gap-y-2 px-4 py-3",
        district ? "lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_8rem]" : "lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.3fr)_8rem]",
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{row.tierName}</span>
        <span className="block text-xs text-muted-foreground">{bandText(row)}</span>
      </span>

      <span className="text-sm">
        <span className="text-xs text-muted-foreground lg:hidden">National: </span>
        {row.nationalRwf !== null ? <span className="pms-num font-medium">{formatPrice(row.nationalRwf)}</span> : <span className="text-muted-foreground">Not set</span>}
      </span>

      {district ? (
        <span className="text-sm">
          <span className="text-xs text-muted-foreground lg:hidden">District: </span>
          {row.districtRwf !== null ? <span className="pms-num font-medium">{formatPrice(row.districtRwf)}</span> : <span className="text-muted-foreground">Not set</span>}
        </span>
      ) : null}

      {editing ? (
        <span className="flex flex-col gap-1 lg:col-span-2">
          <span className="flex flex-wrap items-center gap-2">
            <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded border border-primary bg-field px-3 focus-within:ring-2 focus-within:ring-ring">
              <span className="text-xs font-medium text-muted-foreground">RWF</span>
              <input
                autoFocus
                inputMode="numeric"
                aria-label={`${row.tierName}, RWF a year`}
                value={text ? Number(text.replace(/[^\d]/g, "") || 0).toLocaleString("en-US") : ""}
                onChange={(e) => setText(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && amount > 0) void submit(amount);
                  if (e.key === "Escape") onCancel();
                }}
                className="pms-num h-full min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => void submit(amount)}
              disabled={busy || !(amount > 0)}
              className="inline-flex h-9 items-center gap-1 rounded bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-sm disabled:opacity-50"
            >
              <Check size={14} aria-hidden /> Save
            </button>
            <button type="button" onClick={onCancel} disabled={busy} aria-label="Cancel" className="rounded p-2 text-muted-foreground hover:bg-hover">
              <X size={15} aria-hidden />
            </button>
          </span>
          {current !== null ? (
            <button
              type="button"
              onClick={() => void submit(null)}
              disabled={busy}
              className="inline-flex items-center gap-1 self-start text-xs font-medium text-accent-text hover:underline"
            >
              <RotateCcw size={12} aria-hidden /> {district ? "Use the national price instead" : "Clear, and use the band start"}
            </button>
          ) : null}
          {problem ? <span className="text-xs text-bad">{problem}</span> : null}
        </span>
      ) : (
        <>
          <span className="flex flex-wrap items-center gap-2">
            {row.effectiveRwf !== null ? (
              <span className="pms-num text-base font-bold text-ink">{formatPrice(row.effectiveRwf)}</span>
            ) : (
              <span className="text-sm text-muted-foreground">Not offered</span>
            )}
            <span className={cn("rounded-full px-2 py-0.5 text-2xs font-semibold", src.className)}>{src.label}</span>
          </span>
          <span className="lg:text-right">
            {editable ? (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex h-8 items-center gap-1.5 rounded border border-input bg-card px-3 text-sm font-medium shadow-sm hover:bg-hover"
              >
                <Pencil size={13} aria-hidden /> {current !== null ? "Change" : "Set price"}
              </button>
            ) : null}
          </span>
        </>
      )}
    </li>
  );
}
