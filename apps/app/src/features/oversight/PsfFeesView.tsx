"use client";

import { Alert, Button, Input } from "@heroui/react";
import {
  psfFamilyName,
  type PsfOfficerFeeRow,
  type PsfOfficerFeesView,
} from "@injishi/contracts";
import { DataTable, PageContent, PageHeader, SectionCard, StatusChip } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { rwf } from "@/server/format";
import type { PsfScope } from "@/server/sources/psf";
import { setPsfFeeAction, setPsfServiceFeeAction } from "./psf-fees-actions";

const SOURCE: Record<PsfOfficerFeeRow["source"], { tone: "success" | "info" | "default" }> = {
  district: { tone: "success" },
  national: { tone: "info" },
  band: { tone: "default" },
};

/**
 * Fees (2026-11-02, rebuilt on the console's own parts): what each membership band costs a year on
 * the public PSF form. A district officer prices their district; a province or national officer picks
 * a district, and a national officer also sets the national prices every district falls back to.
 */
export function PsfFeesView({ scope, initial }: { scope: PsfScope; initial: PsfOfficerFeesView }) {
  const t = useTranslations("psfOperations.fees");
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const district = view.districtId !== null;
  // The column the officer edits here: the district's when one is shown, else the national one.
  const editable = district ? view.canEditDistrict : view.canEditNational;
  // PSF's own levels, in the order the API lists its bands (2026-11-06).
  const families = [...new Set(view.rows.map((r) => r.family))].map((f) => ({ family: f, name: view.rows.find((r) => r.family === f)?.familyName || psfFamilyName(f), rows: view.rows.filter((r) => r.family === f) })).filter((g) => g.rows.length);
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
        title={t("title")}
        description={t("description")}
      />

      <Alert status="accent">
        <Alert.Content>
          <Alert.Title>{district ? t("districtTitle", { district: view.districtName ?? "" }) : t("nationalTitle")}</Alert.Title>
          <Alert.Description>
            {district
              ? t("description")
              : view.canEditNational
                ? t("description")
                : t("description")}
          </Alert.Description>
        </Alert.Content>
      </Alert>

      {scope.level !== "district" && districts.length > 0 ? (
        <label className="flex max-w-sm flex-col gap-1.5 text-sm">
          <span className="font-medium">{t("pricesFor")}</span>
          <select
            className="h-10 rounded-xl border border-border bg-field px-3 text-sm"
            value={view.districtId ?? ""}
            onChange={(e) => router.push(e.target.value ? `/psf/fees?district=${e.target.value}` : "/psf/fees")}
          >
            {scope.level === "country" ? <option value="">{t("nationalPrices")}</option> : <option value="">{t("chooseDistrict")}</option>}
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

      {families.map(({ family, name, rows }) => (
        <SectionCard key={family} title={name} contentClassName="gap-3">
          <DataTable
            label={`${name} prices`}
            rows={rows}
            rowKey={(r) => r.tierCode}
            columns={[
              {
                id: "band",
                header: t("band"),
                isRowHeader: true,
                cell: (r) => (
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium text-foreground">{r.tierName}</span>
                    <span className="text-xs text-muted">
                      {r.priceKind === "range" && r.bandMinRwf !== null && r.bandMaxRwf !== null
                        ? `${rwf(r.bandMinRwf)} – ${rwf(r.bandMaxRwf)}`
                        : r.priceKind === "minimum" && r.bandMinRwf !== null
                          ? t("from", { amount: rwf(r.bandMinRwf) })
                          : r.priceKind === "fixed" && r.bandFeeRwf !== null
                            ? t("fixed", { amount: rwf(r.bandFeeRwf) })
                            : t("namesPrice")}
                    </span>
                  </span>
                ),
              },
              {
                id: "national",
                header: t("national"),
                cell: (r) => (r.nationalRwf !== null ? <span className="tabular">{rwf(r.nationalRwf)}</span> : <span className="text-muted">{t("notSet")}</span>),
              },
              ...(district
                ? [
                    {
                      id: "district",
                      header: view.districtName ?? t("district"),
                      cell: (r: PsfOfficerFeeRow) =>
                        r.districtRwf !== null ? <span className="tabular">{rwf(r.districtRwf)}</span> : <span className="text-muted">{t("notSet")}</span>,
                    },
                  ]
                : []),
              {
                id: "form",
                header: t("onForm"),
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
                        <span className="text-muted">{t("notOffered")}</span>
                      )}
                      <StatusChip tone={SOURCE[r.source].tone}>{r.source === "district" ? t("district") : r.source === "national" ? t("national") : t("band")}</StatusChip>
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
                      {(district ? r.districtRwf : r.nationalRwf) !== null ? t("change") : t("setPrice")}
                    </Button>
                  ) : null,
              },
            ]}
            mobile={{
              title: (r) => r.tierName,
              description: (r) => (r.effectiveRwf !== null ? `${rwf(r.effectiveRwf)} · ${r.source === "district" ? t("district") : r.source === "national" ? t("national") : t("band")}` : t("notOffered")),
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
      {/* A salon may cost RWF 1M here and RWF 3M elsewhere (2026-11-05): optional, the floor for that kind here. */}
      {district && view.services.length ? (
        <SectionCard
          title="Prices by kind of business"
          description={`Optional. A kind with a price here pays at least that in ${view.districtName}, inside the band that holds it, and so does a branch of that kind here.`}
        >
          <ul className="flex flex-col divide-y divide-separator">
            {view.services.map((row) => (
              <ServiceFeeRow key={row.subsectorId} row={row} districtId={view.districtId as number} editable={editable} onSaved={setView} />
            ))}
          </ul>
        </SectionCard>
      ) : null}
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
  const t = useTranslations("psfOperations.fees");
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
          {t("save")}
        </Button>
        <Button size="sm" variant="ghost" isDisabled={busy} onPress={onCancel}>
          {t("cancel")}
        </Button>
      </span>
      {current !== null ? (
        <button type="button" disabled={busy} onClick={() => void submit(null)} className="self-start text-xs font-medium text-accent hover:underline">
          {district ? t("useNational") : t("useBand")}
        </button>
      ) : null}
      {problem ? <span className="text-xs text-danger">{problem}</span> : null}
    </span>
  );
}

/** One kind of business's price in the district: shown, or edited in place. */
function ServiceFeeRow({
  row,
  districtId,
  editable,
  onSaved,
}: {
  row: PsfOfficerFeesView["services"][number];
  districtId: number;
  editable: boolean;
  onSaved: (next: PsfOfficerFeesView) => void;
}) {
  const [text, setText] = useState(row.amountRwf ? String(row.amountRwf) : "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const amount = Number(text.replace(/[^\d]/g, ""));
  const save = async (value: number | null) => {
    setBusy(true);
    setProblem(null);
    const res = await setPsfServiceFeeAction(row.subsectorId, districtId, value);
    setBusy(false);
    if (!res.ok) return setProblem(res.error);
    if (value === null) setText("");
    onSaved(res.value);
  };
  const changed = (amount || null) !== row.amountRwf;
  return (
    <li className="flex flex-wrap items-center gap-3 py-2.5">
      <span className="min-w-0 flex-1 text-sm font-medium">{row.name}</span>
      {editable ? (
        <>
          <Input
            aria-label={`${row.name}, RWF a year`}
            inputMode="numeric"
            placeholder="No price of its own"
            value={text ? Number(text.replace(/[^\d]/g, "") || 0).toLocaleString("en-US") : ""}
            onChange={(e) => setText(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
            className="w-44 tabular"
          />
          <Button size="sm" variant="primary" isPending={busy} isDisabled={busy || !changed} onPress={() => void save(amount || null)}>
            Save
          </Button>
        </>
      ) : (
        <span className="tabular text-sm">{row.amountRwf ? rwf(row.amountRwf) : "No price of its own"}</span>
      )}
      {problem ? <span className="w-full text-xs text-danger">{problem}</span> : null}
    </li>
  );
}
