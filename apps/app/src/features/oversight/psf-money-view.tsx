"use client";

import { Button } from "@heroui/react";
import type { PsfMoneyView } from "@injishi/contracts";
import { DataTable, KpiStrip, LinkButton, PageContent, PageHeader, SectionCard } from "@injishi/ui";
import { formatMoney } from "@injishi/ui";

import { FeeStrip, FeeViewSwitch, useFeeAmount, useFeeView } from "./psf-fee-view";

type Line = PsfMoneyView["byDistrict"][number];

const kigaliToday = (): string => new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10);

function presets(today: string): { label: string; from: string; to: string }[] {
  const y = Number(today.slice(0, 4));
  const m = today.slice(0, 7);
  return [
    { label: "This month", from: `${m}-01`, to: today },
    { label: "This year", from: `${y}-01-01`, to: today },
    { label: "Last year", from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
  ];
}

function download(view: PsfMoneyView): void {
  const head = "Region,District,New memberships,Renewals,Upgrades,All fees,District share,Headquarters share,Payments,Members today";
  const lines = view.byDistrict.map((d) => [d.provinceName, d.districtName, d.kinds.application.totalRwf, d.kinds.renewal.totalRwf, d.kinds.upgrade.totalRwf, d.totalRwf, d.districtRwf, d.headquartersRwf, d.payments, d.members].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  const url = URL.createObjectURL(new Blob([[head, ...lines].join("\n")], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `psf-money-${view.from}-to-${view.to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Money (2026-11-06, the owner): who PSF's fees are for. The National Manager tracks headquarters' share
 * and compares regions and districts; a Regional Manager its districts; a District Manager its own share.
 * A record: the money reaches PSF's one account.
 */
export function PsfMoneyScreen({ view }: { view: PsfMoneyView }) {
  const today = kigaliToday();
  const hqPercent = 100 - view.districtPercent;
  const national = view.level === "country";
  const district = view.level === "district";
  const t = view.totals;
  const feeView = useFeeView();
  const ours = feeView === "ours";
  const amount = useFeeAmount(view.ourShare);
  const query = ours ? "&fees=ours" : "";
  return (
    <PageContent>
      <PageHeader
        title="Money"
        description={`${view.from} to ${view.to}. Today's split is ${view.districtPercent}% to the district and ${hqPercent}% to headquarters. Past payments keep the rate they were paid at. The money itself reaches PSF's one account.`}
      />
      <div className="flex flex-wrap items-center gap-2">
        {presets(today).map((p) => (
          <LinkButton key={p.label} size="sm" variant={p.from === view.from && p.to === view.to ? "primary" : "secondary"} href={`/psf/money?from=${p.from}&to=${p.to}${query}`}>
            {p.label}
          </LinkButton>
        ))}
        <FeeViewSwitch ours={view.ourShare} districtPercent={view.districtPercent} />
        <span className="grow" />
        <Button size="sm" variant="secondary" onPress={() => download(view)}>
          Download CSV
        </Button>
      </div>
      <FeeStrip kinds={t.kinds} ours={view.ourShare} />
      <KpiStrip
        label="The split"
        items={[
          { id: "total", label: "Fees in the period", value: t.totalRwf, format: "money", icon: "Wallet" },
          { id: "hq", label: national ? "Headquarters' share" : "To headquarters", value: t.headquartersRwf, format: "money", icon: "Briefcase" },
          { id: "district", label: district ? "Your district's share" : "Districts' share", value: t.districtRwf, format: "money", icon: "MapPin" },
          { id: "members", label: "Members today", value: t.members, format: "count", icon: "Persons" },
        ]}
      />
      {!district && view.byRegion.length > 1 ? (
        <SectionCard title="Regions" description="Which regions bring in the most" contentClassName="gap-3">
          <DataTable
            label="Regions"
            rows={view.byRegion}
            rowKey={(r) => String(r.provinceId)}
            columns={[
              { id: "region", header: "Region", isRowHeader: true, cell: (r) => <span className="font-medium text-foreground">{r.provinceName}</span> },
              { id: "new", header: "New", cell: (r) => <span className="tabular">{formatMoney(amount(r.kinds.application))}</span> },
              { id: "renewal", header: "Renewals", cell: (r) => <span className="tabular">{formatMoney(amount(r.kinds.renewal))}</span> },
              { id: "upgrade", header: "Upgrades", cell: (r) => <span className="tabular">{formatMoney(amount(r.kinds.upgrade))}</span> },
              { id: "total", header: ours ? "Our revenue" : "All fees", cell: (r) => <span className="tabular">{formatMoney(amount(r))}</span> },
              ...(ours
                ? []
                : [
                    { id: "hq", header: "Headquarters' share", cell: (r: (typeof view.byRegion)[number]) => <span className="tabular">{formatMoney(r.headquartersRwf)}</span> },
                    { id: "district", header: "Districts' share", cell: (r: (typeof view.byRegion)[number]) => <span className="tabular">{formatMoney(r.districtRwf)}</span> },
                  ]),
              { id: "payments", header: "Payments", cell: (r) => <span className="tabular">{r.payments}</span> },
              { id: "members", header: "Members today", cell: (r) => <span className="tabular">{r.members}</span> },
            ]}
          />
        </SectionCard>
      ) : null}
      <SectionCard title={district ? "Your district" : "Districts"} description="Highest fees first" contentClassName="gap-3">
        <DataTable
          label="Districts"
          rows={view.byDistrict}
          rowKey={(r: Line) => String(r.districtId)}
          columns={[
            {
              id: "district",
              header: "District",
              isRowHeader: true,
              cell: (r: Line) => (
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">{r.districtName}</span>
                  <span className="text-xs text-muted">{r.provinceName}</span>
                </span>
              ),
            },
            { id: "new", header: "New", cell: (r: Line) => <span className="tabular">{formatMoney(amount(r.kinds.application))}</span> },
            { id: "renewal", header: "Renewals", cell: (r: Line) => <span className="tabular">{formatMoney(amount(r.kinds.renewal))}</span> },
            { id: "upgrade", header: "Upgrades", cell: (r: Line) => <span className="tabular">{formatMoney(amount(r.kinds.upgrade))}</span> },
            { id: "total", header: ours ? "Our revenue" : "All fees", cell: (r: Line) => <span className="tabular">{formatMoney(amount(r))}</span> },
            ...(ours
              ? []
              : [
                  { id: "hq", header: "Headquarters' share", cell: (r: Line) => <span className="tabular">{formatMoney(r.headquartersRwf)}</span> },
                  { id: "own", header: "District's share", cell: (r: Line) => <span className="tabular">{formatMoney(r.districtRwf)}</span> },
                ]),
            { id: "payments", header: "Payments", cell: (r: Line) => <span className="tabular">{r.payments}</span> },
            { id: "members", header: "Members today", cell: (r: Line) => <span className="tabular">{r.members}</span> },
          ]}
        />
      </SectionCard>
    </PageContent>
  );
}
