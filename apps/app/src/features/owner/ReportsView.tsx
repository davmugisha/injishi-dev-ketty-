"use client";

import { ArrowDownToLine, Bookmark, Plus } from "@gravity-ui/icons";
import { Button, Card, Chip, Label, ListBox, Select, Tabs, Toast, toast } from "@heroui/react";
import { ListView, Segment } from "@heroui-pro/react";
import type {
  ReportsAgingBucket,
  ReportsArrear,
  ReportsChannel,
  ReportsDebtor,
  ReportsKpi,
  ReportsMeasureDefinition,
  ReportsMeasureId,
  ReportsPickupWeek,
  ReportsProfitLine,
  ReportsProperty,
  ReportsPropertyId,
  ReportsRoomType,
  ReportsSavedView,
  ReportsSchedule,
  ReportsSummaryKpi,
  ReportsTab,
  ReportsTrendDay,
  ReportsVacantUnit,
} from "@injishi/data/fixtures/owner";
import { Icon, PageContent, PageHeader, toneColor } from "@injishi/ui";
import { useState } from "react";
import { saveReportsView } from "./ReportsActions";
import { ReportsFinancialPanel, ReportsResidencePanel, ReportsSummary } from "./ReportsFinancial";
import { ReportsPerformancePanel, type ReportsTrendMetric } from "./ReportsPerformance";

export interface ReportsData {
  properties: ReportsProperty[];
  savedViews: ReportsSavedView[];
  kpis: ReportsKpi[];
  definitions: ReportsMeasureDefinition[];
  trendDays: ReportsTrendDay[];
  pickup: ReportsPickupWeek[];
  roomTypes: ReportsRoomType[];
  channels: ReportsChannel[];
  summaryKpis: ReportsSummaryKpi[];
  profitLines: ReportsProfitLine[];
  aging: ReportsAgingBucket[];
  debtors: ReportsDebtor[];
  vacantUnits: ReportsVacantUnit[];
  arrears: ReportsArrear[];
  schedules: ReportsSchedule[];
}

const TABS: { id: ReportsTab; label: string }[] = [
  { id: "perf", label: "Performance" },
  { id: "fin", label: "Financial" },
  { id: "res", label: "Residence" },
];

/** Month to date in Kigali, tonight included: the window the key figures are read over. */
function monthToDate(now = new Date()): { range: string; lastYear: string } {
  const part = (type: "day" | "month" | "year") =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Kigali",
      [type]: type === "month" ? "short" : "numeric",
    }).format(now);
  const year = Number(part("year"));
  return { range: `1–${part("day")} ${part("month")} ${year} · month to date`, lastYear: `Same dates ${year - 1}` };
}
const WINDOW = monthToDate();
const DATE_RANGES = [{ id: "mtd", label: WINDOW.range }];
const COMPARISONS = [{ id: "ly", label: WINDOW.lastYear }];

/** A filter label above its control (artifact: 12px muted caption). */
function FilterLabel({ children }: { children: string }) {
  return <Label className="text-xs font-normal text-muted">{children}</Label>;
}

export function ReportsView({ data }: { data: ReportsData }) {
  // The screen opens on the person's first saved view (their default comes first), not a fixed record.
  const first = data.savedViews[0];
  const [tab, setTab] = useState<ReportsTab>(first?.tab ?? "perf");
  const [propertyId, setPropertyId] = useState<ReportsPropertyId>(first?.property ?? "all");
  const [view, setView] = useState<string | null>(first?.id ?? null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [metric, setMetric] = useState<ReportsTrendMetric>("occ");
  const [definition, setDefinition] = useState<ReportsMeasureId | null>("occ");

  const property = data.properties.find((p) => p.id === propertyId) ?? data.properties[0];
  const pickView = (v: ReportsSavedView) => {
    setView(v.id);
    setTab(v.tab);
    setPropertyId(v.property);
    setSaved(false);
  };
  const pickProperty = (id: ReportsPropertyId) => {
    setPropertyId(id);
    setView(null);
    setSaved(false);
  };
  const saveView = async () => {
    setSaving(true);
    try {
      const result = await saveReportsView({ tab, property: propertyId, propertyLabel: property?.label ?? propertyId });
      if (result.ok) {
        setSaved(true);
        toast.success(`Saved as “${result.name}”`);
      } else toast.danger(result.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <PageHeader
        eyebrow="Amahoro Hospitality Group · Reports"
        title="Reports"
        description="Defined measures with their source. Open any figure to see the records behind it."
        actions={
          <>
            <Button
              variant="secondary"
              onPress={() => toast.warning("Exporting reports is not available yet. No file was made.")}
            >
              <ArrowDownToLine className="size-4" />
              Export
            </Button>
            <Button isDisabled={saving || saved} onPress={saveView}>
              <Bookmark className="size-4" />
              {saved ? "View saved" : "Save view"}
            </Button>
          </>
        }
      />

      <Card
        variant="secondary"
        render={(props) => <section {...props} />}
        aria-label="Filters"
        className="flex-row flex-wrap items-center gap-2.5 px-3.5 py-3"
      >
        <Select defaultValue="mtd" className="flex min-w-[min(200px,100%)] flex-col gap-0.5">
          <FilterLabel>Dates</FilterLabel>
          <Select.Trigger className="min-w-[min(220px,100%)]">
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {DATE_RANGES.map((r) => (
                <ListBox.Item key={r.id} id={r.id} textValue={r.label}>
                  {r.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <Select defaultValue="ly" className="flex flex-col gap-0.5">
          <FilterLabel>Compared with</FilterLabel>
          <Select.Trigger className="min-w-[180px]">
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {COMPARISONS.map((r) => (
                <ListBox.Item key={r.id} id={r.id} textValue={r.label}>
                  {r.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted">Property</span>
          <Segment
            aria-label="Property"
            selectedKey={propertyId}
            onSelectionChange={(k) => pickProperty(String(k) as ReportsPropertyId)}
          >
            {data.properties.map((p) => (
              <Segment.Item key={p.id} id={p.id}>
                <Segment.Separator />
                {p.label}
              </Segment.Item>
            ))}
          </Segment>
        </div>
        <span className="flex-1" />
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">Saved views</span>
          <div className="flex flex-wrap gap-1.5">
            {data.savedViews.map((v) => (
              <Button
                key={v.id}
                size="sm"
                variant={view === v.id ? "secondary" : "ghost"}
                aria-pressed={view === v.id}
                onPress={() => pickView(v)}
              >
                {v.label}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      <Tabs
        selectedKey={tab}
        onSelectionChange={(k) => {
          setTab(String(k) as ReportsTab);
          setSaved(false);
        }}
        className="w-full gap-0"
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Report" className="w-full">
            {TABS.map((t) => (
              <Tabs.Tab key={t.id} id={t.id}>
                {t.label}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel id="perf" className="mt-5 p-0">
          <ReportsPerformancePanel
            property={property}
            kpis={data.kpis.filter((k) => k.property === property.id)}
            definitions={data.definitions}
            openDefinition={definition}
            onDefinitionChange={setDefinition}
            metric={metric}
            onMetricChange={setMetric}
            trendDays={data.trendDays}
            pickup={data.pickup}
            roomTypes={data.roomTypes.filter((r) => property.id === "all" || r.property === property.id)}
            channels={data.channels}
          />
        </Tabs.Panel>
        <Tabs.Panel id="fin" className="mt-5 flex flex-col gap-5 p-0">
          <ReportsSummary tab="fin" kpis={data.summaryKpis.filter((k) => k.tab === "fin")} />
          <ReportsFinancialPanel profitLines={data.profitLines} aging={data.aging} debtors={data.debtors} />
        </Tabs.Panel>
        <Tabs.Panel id="res" className="mt-5 flex flex-col gap-5 p-0">
          <ReportsSummary tab="res" kpis={data.summaryKpis.filter((k) => k.tab === "res")} />
          <ReportsResidencePanel vacantUnits={data.vacantUnits} arrears={data.arrears} />
        </Tabs.Panel>
      </Tabs>

      <Card render={(props) => <section {...props} />} aria-labelledby="sch-h" className="gap-3 p-[18px]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Card.Header>
            <Card.Title id="sch-h" render={(props) => <h2 {...props} />} className="text-[15px] font-semibold">
              Scheduled Exports
            </Card.Title>
            <Card.Description>Each copy is cut to what the recipient is allowed to see</Card.Description>
          </Card.Header>
          <Button
            size="sm"
            variant="secondary"
            onPress={() =>
              toast.warning(
                "Scheduling exports is not available yet. The schedules listed here are sample data; nothing was scheduled.",
              )
            }
          >
            <Plus className="size-4" />
            New schedule
          </Button>
        </div>
        <ListView aria-label="Scheduled exports" variant="secondary" items={data.schedules}>
          {(s) => (
            <ListView.Item id={s.id} textValue={s.name} className="items-start">
              <ListView.ItemContent className="items-start">
                <Icon name={s.icon} className="mt-0.5 size-4 shrink-0" />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <ListView.Title>{s.name}</ListView.Title>
                  <ListView.Description className="whitespace-normal">{s.detail}</ListView.Description>
                </div>
              </ListView.ItemContent>
              <ListView.ItemAction className="flex flex-col items-end gap-0.5">
                <Chip size="sm" variant="soft" color={toneColor(s.tone)}>
                  {s.status}
                </Chip>
                <span className="text-xs whitespace-nowrap text-muted">{s.next}</span>
              </ListView.ItemAction>
            </ListView.Item>
          )}
        </ListView>
      </Card>
    </PageContent>
  );
}
