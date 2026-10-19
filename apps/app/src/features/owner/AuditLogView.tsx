"use client";

import { ListTimeline, ShieldCheck, ShieldKeyhole } from "@gravity-ui/icons";
import { Button, Card, ListBox, SearchField, Select, Table, Tabs, Toast, toast } from "@heroui/react";
import { EmptyState, Segment } from "@heroui-pro/react";
import type {
  AuditLogArea,
  AuditLogChain,
  AuditLogEntry,
  AuditLogExportFormat,
  AuditLogRetentionRule,
} from "@injishi/data/fixtures/owner";
import { formatNumber, PageContent, PageHeader } from "@injishi/ui";
import { useState } from "react";
import { AuditLogExportDialog } from "./AuditLogExportDialog";
import { AuditLogInspector } from "./AuditLogInspector";
import { AuditLogRetention, type AuditLogRetentionState, auditLogRetentionInitial } from "./AuditLogRetention";
import { SettingsNav } from "./SettingsNav";

export interface AuditLogData {
  areas: AuditLogArea[];
  entries: AuditLogEntry[];
  retention: AuditLogRetentionRule[];
  formats: AuditLogExportFormat[];
  chain: AuditLogChain;
}

export type AuditLogTab = "entries" | "retention";

/** The entry the inspector opens on (the artifact's dirty-room override). */
const DEFAULT_ENTRY_ID = "48207";

const PROPERTIES = [
  { id: "all", label: "All properties", scope: "all properties" },
  { id: "Isangano", label: "Isangano", scope: "Isangano" },
  { id: "Ishyamba", label: "Ishyamba", scope: "Ishyamba" },
] as const;
const PERIODS = [
  { id: "today", label: "Today", scope: "Today", span: "today" },
  { id: "7d", label: "Last 7 days", scope: "Last 7 days", span: "the last 7 days" },
  { id: "30d", label: "Last 30 days", scope: "Last 30 days", span: "the last 30 days" },
] as const;

/**
 * What this screen cannot do yet, said plainly. The entries, the chain and the retention rules are sample
 * data (`owner.auditLog*` are deferred), and no route verifies the chain, exports entries or stores
 * retention rules, so these controls change nothing.
 */
const unavailable = (what: string) =>
  toast.warning(`${what} is not available yet. This audit log is sample data; nothing was checked, saved or queued.`);

/** Shorten a reason for the table column; the inspector shows it in full. */
const shortReason = (reason: string) => {
  if (!reason) return "—";
  return reason.length > 60 ? `${reason.slice(0, 58)}…` : reason;
};

export function AuditLogView({ initialTab, data }: { initialTab: AuditLogTab; data: AuditLogData }) {
  const { chain } = data;
  const [tab, setTab] = useState<AuditLogTab>(initialTab);
  const [area, setArea] = useState("all");
  const [query, setQuery] = useState("");
  const [property, setProperty] = useState<string>("all");
  const [period, setPeriod] = useState<string>("7d");
  const [selectedId, setSelectedId] = useState(DEFAULT_ENTRY_ID);
  const [exportOpen, setExportOpen] = useState(false);
  const [retention, setRetention] = useState<AuditLogRetentionState>(() => auditLogRetentionInitial(data.retention));

  const areaOf = (id: string) => data.areas.find((a) => a.id === id);
  const prop = PROPERTIES.find((p) => p.id === property) ?? PROPERTIES[0];
  const per = PERIODS.find((p) => p.id === period) ?? PERIODS[1];
  const needle = query.trim().toLowerCase();

  const rows = data.entries.filter(
    (e) =>
      (area === "all" || e.area === area) &&
      (prop.id === "all" || e.property === prop.id) &&
      (per.id !== "today" || e.day === "Today") &&
      (!needle ||
        [e.actor, e.role, e.action, e.record, e.requestId, e.property].join(" ").toLowerCase().includes(needle)),
  );
  const selected = data.entries.find((e) => e.id === selectedId) ?? data.entries[0];
  const areaName = area === "all" ? "all areas" : (areaOf(area)?.label.toLowerCase() ?? area);
  const exportScope = `${per.scope} · ${areaName} · ${prop.scope}`;

  const entriesCount = formatNumber(chain.entries);
  const chainTitle = `Chain intact · ${entriesCount} entries · checked ${chain.checkedAt} · no gaps`;

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <PageHeader
        eyebrow="Settings · Amahoro Hospitality Group"
        title="Audit Log"
        description="Every change is written in the same step as the change itself: who, what, where and why. Entries cannot be edited or deleted."
        actions={
          <Button variant="secondary" onPress={() => setExportOpen(true)}>
            <ShieldKeyhole className="size-4" />
            Export
          </Button>
        }
      />

      <SettingsNav current="AuditLog" />

      <Card variant="secondary" role="status" className="flex-row flex-wrap items-center gap-3 px-[14px] py-2.5">
        <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
        <span className="flex min-w-[min(260px,100%)] flex-1 flex-col">
          <span className="text-[13px] leading-[18px] font-semibold">{chainTitle}</span>
          <span className="text-xs text-muted tabular">
            Each entry carries the hash of the one before it, so a missing or altered entry breaks the chain. Latest #
            {entriesCount} · {chain.latestHash}
          </span>
        </span>
        <Button size="sm" variant="ghost" onPress={() => unavailable("Verifying the chain")}>
          Verify now
        </Button>
      </Card>

      <Tabs
        variant="secondary"
        selectedKey={tab}
        onSelectionChange={(key) => setTab(key === "retention" ? "retention" : "entries")}
        className="flex-row flex-wrap items-center justify-between gap-x-2.5 gap-y-5"
      >
        <Tabs.ListContainer className="border-b-0">
          <Tabs.List aria-label="Audit views">
            <Tabs.Tab id="entries" className="h-10 w-auto px-3">
              Entries
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="retention" className="h-10 w-auto px-3">
              Retention policy
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        {tab === "entries" ? (
          <div className="flex flex-wrap items-center gap-2">
            <SearchField aria-label="Search the audit log" value={query} onChange={setQuery} className="w-[220px]">
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Search actor, record, request ID" />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <Select
              aria-label="Property"
              value={property}
              onChange={(v) => setProperty(typeof v === "string" ? v : "all")}
              className="w-auto"
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox aria-label="Property">
                  {PROPERTIES.map((p) => (
                    <ListBox.Item key={p.id} id={p.id} textValue={p.label}>
                      {p.label}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <Select
              aria-label="Period"
              value={period}
              onChange={(v) => setPeriod(typeof v === "string" ? v : "7d")}
              className="w-auto"
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox aria-label="Period">
                  {PERIODS.map((p) => (
                    <ListBox.Item key={p.id} id={p.id} textValue={p.label}>
                      {p.label}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
        ) : null}

        <Tabs.Panel id="entries" className="mt-0 flex basis-full flex-col gap-5 p-0">
          <Segment
            aria-label="Filter by area"
            selectedKey={area}
            onSelectionChange={(key) => setArea(String(key))}
            className="self-start"
          >
            <Segment.Item id="all">All</Segment.Item>
            {data.areas.map((a) => (
              <Segment.Item key={a.id} id={a.id}>
                <Segment.Separator />
                {a.filterLabel}
              </Segment.Item>
            ))}
          </Segment>

          <div className="flex flex-wrap items-start gap-4">
            <section className="flex min-w-0 flex-[2_1_600px] flex-col gap-2" aria-label="Audit entries">
              <Table>
                <Table.ScrollContainer>
                  <Table.Content
                    aria-label="Audit entries"
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={new Set([selected?.id ?? ""])}
                    onSelectionChange={(keys) => {
                      if (keys === "all") return;
                      const [key] = keys;
                      if (key !== undefined) setSelectedId(String(key));
                    }}
                  >
                    <Table.Header>
                      <Table.Column isRowHeader>Time</Table.Column>
                      <Table.Column>Actor</Table.Column>
                      <Table.Column>Action and record</Table.Column>
                      <Table.Column>Property</Table.Column>
                      <Table.Column>Reason</Table.Column>
                    </Table.Header>
                    <Table.Body
                      renderEmptyState={() => (
                        <EmptyState size="sm">
                          <EmptyState.Header>
                            <EmptyState.Media variant="icon">
                              <ListTimeline />
                            </EmptyState.Media>
                            <EmptyState.Title>No entries in this area for {per.span}</EmptyState.Title>
                          </EmptyState.Header>
                        </EmptyState>
                      )}
                    >
                      {rows.map((e) => (
                        <Table.Row key={e.id} id={e.id} className="cursor-pointer">
                          <Table.Cell className="text-xs whitespace-nowrap tabular">
                            <span className="flex flex-col">
                              <span>{e.day}</span>
                              <span className="text-muted">{e.time}</span>
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="flex flex-col">
                              <span className="text-[13px] font-medium">{e.actor}</span>
                              <span className="text-xs text-muted">{e.role}</span>
                            </span>
                          </Table.Cell>
                          <Table.Cell className="whitespace-normal">
                            <span className="flex flex-col">
                              <span className="text-[13px] font-medium">{e.action}</span>
                              <span className="text-xs text-muted">{e.record}</span>
                            </span>
                          </Table.Cell>
                          <Table.Cell className="text-[13px]">{e.property}</Table.Cell>
                          <Table.Cell className="max-w-[220px] text-xs whitespace-normal">
                            {shortReason(e.reason)}
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
              <p className="text-xs text-muted">
                Showing {rows.length} of {formatNumber(chain.weekEntries)} entries this week. Reads of guest ID and
                money records are logged too.
              </p>
            </section>

            {selected ? <AuditLogInspector entry={selected} area={areaOf(selected.area)} /> : null}
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="retention" className="mt-0 basis-full p-0">
          <AuditLogRetention
            rules={data.retention}
            state={retention}
            onChange={setRetention}
            onSave={() => unavailable("Saving retention rules")}
          />
        </Tabs.Panel>
      </Tabs>

      <AuditLogExportDialog
        isOpen={exportOpen}
        onOpenChange={setExportOpen}
        scope={exportScope}
        formats={data.formats}
      />
    </PageContent>
  );
}
