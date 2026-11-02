"use client";

import { Alert, Button, Input } from "@heroui/react";
import {
  PSF_FAMILY_LABEL,
  PSF_OFFERED_FAMILIES,
  type PsfOfficerFeeRow,
  type PsfOfficerFeesView,
} from "@injishi/contracts";
import { DataTable, PageContent, PageHeader, SectionCard, StatusChip } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { rwf } from "@/server/format";
import type { PsfScope } from "@/server/sources/psf";
import { setPsfFeeAction } from "./psf-fees-actions";

const SOURCE: Record<PsfOfficerFeeRow["source"], { label: string; tone: "success" | "info" | "default" }> = {
  district: { label: "District price", tone: "success" },
  national: { label: "National price", tone: "info" },
  band: { label: "Band start", tone: "default" },
};

function bandText(r: PsfOfficerFeeRow): string {
  if (r.priceKind === "range" && r.bandMinRwf !== null && r.bandMaxRwf !== null) return `${rwf(r.bandMinRwf)} to ${rwf(r.bandMaxRwf)}`;
  if (r.priceKind === "minimum" && r.bandMinRwf !== null) return `From ${rwf(r.bandMinRwf)}`;
  if (r.priceKind === "fixed" && r.bandFeeRwf !== null) return `Fixed at ${rwf(r.bandFeeRwf)}`;
  return "PSF names the price";
}

/**
 * Fees (2026-11-02, rebuilt on the console's own parts): what each membership band costs a year on
 * the public PSF form. A district officer prices their district; a province or national officer picks
 * a district, and a national officer also sets the national prices every district falls back to.
 */
export function PsfFeesView({ scope, initial }: { scope: PsfScope; initial: PsfOfficerFeesView }) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const district = view.districtId !== null;
  // The column the officer edits here: the district's when one is shown, else the national one.
  const editable = district ? view.canEditDistrict : view.canEditNational;
  const families = PSF_OFFERED_FAMILIES.map((f) => ({ family: f, rows: view.rows.filter((r) => r.family === f) })).filter((g) => g.rows.length);
  const districts = scope.provinces.flatMap((p) => p.districts);

  const save = async (row: PsfOfficerFeeRow, amountRwf: number | null): Promise<string | null> => {
    const res = await setPsfFeeAction(row.tierCode, view.districtId, amountRwf);
    if (!res.ok) return res.error;
    setView(res.value);
    setEditing(null);
    setSaved(
      amountRwf === null
        ? `${row.tierName} in ${view.districtName ?? "Rwanda"} now uses ${district ? "the national price" : "its band start"}.`
        : `${row.tierName} is ${rwf(amountRwf)} a year ${district ? `in ${view.districtName}` : "nationally"}.`,
    );
    return null;
  };

  return (
    <PageContent>
      <PageHeader
        eyebrow={`${scope.title} · ${scope.label}`}
        title="Fees"
        description="What each membership band costs a year on the public PSF form. A new price applies to forms sent from now on; an application already sent keeps the amount it paid."
      />

      <Alert status="accent">
        <Alert.Content>
          <Alert.Title>{district ? `Prices for ${view.districtName} district` : "PSF's national prices"}</Alert.Title>
          <Alert.Description>
            {district
              ? "A business registering here pays the amount under “On the form”. Set the district’s own price for a band, or leave it on the national price."
              : view.canEditNational
                ? "Every district uses these unless it sets its own. Pick a district to see or set its prices."
                : "Set by PSF's national office. Pick a district to set its prices."}
          </Alert.Description>
        </Alert.Content>
      </Alert>

      {scope.level !== "district" && districts.length > 0 ? (
        <label className="flex max-w-sm flex-col gap-1.5 text-sm">
          <span className="font-medium">Prices for</span>
          <select
            className="h-10 rounded-xl border border-border bg-field px-3 text-sm"
            value={view.districtId ?? ""}
            onChange={(e) => router.push(e.target.value ? `/psf/fees?district=${e.target.value}` : "/psf/fees")}
          >
            {scope.level === "country" ? <option value="">Rwanda (national prices)</option> : <option value="">Choose a district</option>}
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {saved ? (
        <Alert status="success">
          <Alert.Content>
            <Alert.Description>{saved}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      {families.map(({ family, rows }) => (
        <SectionCard key={family} title={PSF_FAMILY_LABEL[family]} contentClassName="gap-3">
          <DataTable
            label={`${PSF_FAMILY_LABEL[family]} prices`}
            rows={rows}
            rowKey={(r) => r.tierCode}
            columns={[
              {
                id: "band",
                header: "Band",
                isRowHeader: true,
                cell: (r) => (
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium text-foreground">{r.tierName}</span>
                    <span className="text-xs text-muted">{bandText(r)}</span>
                  </span>
                ),
              },
              {
                id: "national",
                header: "National",
                cell: (r) => (r.nationalRwf !== null ? <span className="tabular">{rwf(r.nationalRwf)}</span> : <span className="text-muted">Not set</span>),
              },
              ...(district
                ? [
                    {
                      id: "district",
                      header: view.districtName ?? "District",
                      cell: (r: PsfOfficerFeeRow) =>
                        r.districtRwf !== null ? <span className="tabular">{rwf(r.districtRwf)}</span> : <span className="text-muted">Not set</span>,
                    },
                  ]
                : []),
              {
                id: "form",
                header: "On the form",
                cell: (r) =>
                  editing === r.tierCode ? (
                    <PriceEditor
                      row={r}
                      current={district ? r.districtRwf : r.nationalRwf}
                      district={district}
                      onSave={save}
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    <span className="flex flex-col items-start gap-1">
                      {r.effectiveRwf !== null ? (
                        <span className="tabular font-semibold">{rwf(r.effectiveRwf)}</span>
                      ) : (
                        <span className="text-muted">Not offered</span>
                      )}
                      <StatusChip tone={SOURCE[r.source].tone}>{SOURCE[r.source].label}</StatusChip>
                    </span>
                  ),
              },
              {
                id: "edit",
                header: "",
                align: "end",
                cell: (r) =>
                  editable && editing !== r.tierCode ? (
                    <Button size="sm" variant="secondary" onPress={() => setEditing(r.tierCode)}>
                      {(district ? r.districtRwf : r.nationalRwf) !== null ? "Change" : "Set price"}
                    </Button>
                  ) : null,
              },
            ]}
            mobile={{
              title: (r) => r.tierName,
              description: (r) => (r.effectiveRwf !== null ? `${rwf(r.effectiveRwf)} · ${SOURCE[r.source].label}` : "Not offered"),
              trailing: (r) =>
                editable ? (
                  <Button size="sm" variant="secondary" onPress={() => setEditing(r.tierCode)}>
                    Set price
                  </Button>
                ) : null,
            }}
          />
        </SectionCard>
      ))}
    </PageContent>
  );
}

function PriceEditor({
  row,
  current,
  district,
  onSave,
  onCancel,
}: {
  row: PsfOfficerFeeRow;
  current: number | null;
  district: boolean;
  onSave: (row: PsfOfficerFeeRow, amountRwf: number | null) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(String(current ?? row.effectiveRwf ?? ""));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const amount = Number(text.replace(/[^\d]/g, ""));
  const submit = async (value: number | null) => {
    setBusy(true);
    setProblem(await onSave(row, value));
    setBusy(false);
  };
  return (
    <span className="flex min-w-[16rem] flex-col gap-1.5">
      <span className="flex items-center gap-2">
        <Input
          aria-label={`${row.tierName}, RWF a year`}
          inputMode="numeric"
          autoFocus
          value={text ? Number(text.replace(/[^\d]/g, "") || 0).toLocaleString("en-US") : ""}
          onChange={(e) => setText(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && amount > 0) void submit(amount);
            if (e.key === "Escape") onCancel();
          }}
          className="min-w-0 flex-1"
        />
        <Button size="sm" variant="primary" isPending={busy} isDisabled={busy || !(amount > 0)} onPress={() => void submit(amount)}>
          Save
        </Button>
        <Button size="sm" variant="ghost" isDisabled={busy} onPress={onCancel}>
          Cancel
        </Button>
      </span>
      {current !== null ? (
        <button type="button" disabled={busy} onClick={() => void submit(null)} className="self-start text-xs font-medium text-accent hover:underline">
          {district ? "Use the national price instead" : "Clear, and use the band start"}
        </button>
      ) : null}
      {problem ? <span className="text-xs text-danger">{problem}</span> : null}
    </span>
  );
}
