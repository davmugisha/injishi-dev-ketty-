"use client";

import { CloudSlash, FileCheck, Lock, PlugConnection, Receipt, ShieldExclamation } from "@gravity-ui/icons";
import { Alert, Card, Chip, Tabs } from "@heroui/react";
import { EmptyState, Segment } from "@heroui-pro/react";
import { GateChip, KeyValueList, LinkButton, PageContent, PageHeader, TextLink } from "@injishi/ui";
import { type ReactNode, useState } from "react";
import type {
  FiscalDocumentKind,
  FiscalInvoice,
  FiscalJournalEvent,
  FiscalProfile,
  FiscalQueueItem,
  FiscalReceipt,
  ItemCode,
  VsdcDevice,
  ZReport,
} from "../../model/accounting.ts";
import type { Persona } from "../../model/shared.ts";
import { CardHeading, type KpiItem, KpiStrip, LINE_LIST, LINE_PANEL, LINE_TAB } from "../accounting-parts.tsx";
import { useBoardHref, useFinanceShell } from "../mount.tsx";
import { buildQueueRows } from "./fiscal.ts";
import { FiscalItemCodesPanel } from "./fiscal-item-codes-panel.tsx";
import {
  FiscalInvoicesPanel,
  FiscalJournalPanel,
  FiscalNumberingPanel,
  FiscalReceiptsPanel,
} from "./fiscal-panels.tsx";
import { FiscalQueuePanel } from "./fiscal-queue-panel.tsx";

export type FiscalTab = "invoices" | "receipts" | "queue" | "numbering" | "journal" | "items";

interface FiscalReceiptsData {
  profiles: FiscalProfile[];
  queue: FiscalQueueItem[];
  kinds: FiscalDocumentKind[];
  invoices: FiscalInvoice[];
  receipts: FiscalReceipt[];
  devices: VsdcDevice[];
  journal: FiscalJournalEvent[];
  zReports: ZReport[];
  items: ItemCode[];
}

type Flags = Record<string, boolean>;

function PanelEmpty({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <EmptyState size="sm">
      <EmptyState.Header>
        <EmptyState.Media variant="icon">{icon}</EmptyState.Media>
        <EmptyState.Title>{title}</EmptyState.Title>
        <EmptyState.Description>{text}</EmptyState.Description>
      </EmptyState.Header>
    </EmptyState>
  );
}

export function FiscalReceiptsView({
  persona,
  offline,
  initialTab,
  initialMerchant,
  data,
}: {
  persona: Persona;
  offline: boolean;
  initialTab: FiscalTab;
  initialMerchant: string;
  data: FiscalReceiptsData;
}) {
  const screenHref = useBoardHref();
  const { TopbarStatus } = useFinanceShell();
  const [merchant, setMerchant] = useState(initialMerchant);
  const [tab, setTab] = useState<FiscalTab>(initialTab);
  const [selQ, setSelQ] = useState("");
  const [selR, setSelR] = useState("");
  const [retried, setRetried] = useState<Flags>({});
  const [asked, setAsked] = useState<Flags>({});
  const [resubmitted, setResubmitted] = useState<Flags>({});
  const [mapped, setMapped] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<Flags>({});
  const [mapItem, setMapItem] = useState("");
  const [xRun, setXRun] = useState(false);
  const [onlyUnmapped, setOnlyUnmapped] = useState(false);

  const prof = data.profiles.find((p) => p.id === merchant) ?? data.profiles[0];
  const mine = <T extends { merchant: string }>(list: T[]) => list.filter((x) => x.merchant === prof.id);
  const flag = (set: (fn: (o: Flags) => Flags) => void, id: string) => set((o) => ({ ...o, [id]: true }));

  const rows = buildQueueRows(mine(data.queue), { retried, asked, resubmitted });
  const sel = rows.find((r) => r.id === selQ) ?? rows[0];
  const count = (st: string) => rows.filter((r) => r.current === st).length;
  const pending = count("pending");
  const oldest = rows.find((r) => r.status === "pending" && r.current === "pending");

  const items = mine(data.items);
  const unmapped = items.filter((i) => i.status === "unmapped" && !mapped[i.id]).length;
  const receipts = mine(data.receipts);
  const receipt = receipts.find((c) => c.id === selR) ?? receipts[0];

  const kpis: KpiItem[] = [
    {
      id: "issued",
      label: "Issued today",
      value: prof.issuedToday,
      format: "count",
      foot: "Signed by the VSDC, with fiscal numbers",
      icon: "FileCheck",
      status: "success",
    },
    {
      id: "pending",
      label: "Pending",
      value: pending,
      format: "count",
      foot: oldest
        ? `Oldest waiting ${oldest.age}`
        : pending
          ? "Resubmitted 10:14 · waiting for the VSDC"
          : "Nothing waiting at the VSDC",
      icon: "Clock",
      status: pending ? "warning" : "default",
    },
    {
      id: "unknown",
      label: "Unknown",
      value: count("unknown"),
      format: "count",
      foot: "Outcome being checked with the provider",
      icon: "CircleQuestion",
      status: count("unknown") ? "warning" : "default",
    },
    {
      id: "rejected",
      label: "Rejected",
      value: count("rejected"),
      format: "count",
      foot: "Need a correction before resubmitting",
      icon: "OctagonXmark",
      status: count("rejected") ? "danger" : "default",
    },
    {
      id: "refunds",
      label: "Refund receipts",
      value: prof.refundsThisMonth,
      format: "count",
      foot: "October · each credits its original",
      icon: "ArrowUturnCcwLeft",
      status: "default",
    },
  ];

  const tabs: { id: FiscalTab; label: string; chip?: { n: number; color: "warning" | "danger" } }[] = [
    { id: "invoices", label: "Invoices" },
    { id: "receipts", label: "Receipts" },
    { id: "queue", label: "Queue", chip: rows.length ? { n: rows.length, color: "warning" } : undefined },
    { id: "numbering", label: "Numbering" },
    { id: "journal", label: "Journal" },
    { id: "items", label: "Item codes", chip: unmapped ? { n: unmapped, color: "danger" } : undefined },
  ];

  const panels: Record<FiscalTab, ReactNode> = {
    queue: sel ? (
      <FiscalQueuePanel
        rows={rows}
        selected={sel}
        onSelect={setSelQ}
        merchantName={prof.name}
        offline={offline}
        mapped={mapped}
        onRetry={(id) => !offline && flag(setRetried, id)}
        onAsk={(id) => flag(setAsked, id)}
        onResubmit={(id) => flag(setResubmitted, id)}
        onMapItem={(itemId) => {
          setTab("items");
          setMapItem(itemId);
        }}
      />
    ) : (
      <PanelEmpty
        icon={<FileCheck />}
        title="Nothing waiting at the VSDC"
        text="Every document of this merchant is signed and has its fiscal number."
      />
    ),
    invoices: <FiscalInvoicesPanel kinds={data.kinds} invoices={mine(data.invoices)} note={prof.invoiceNote} />,
    receipts: receipt ? (
      <FiscalReceiptsPanel
        receipts={receipts}
        selected={receipt}
        onSelect={setSelR}
        profile={prof}
        copied={Boolean(copied[receipt.id])}
        onCopy={() => flag(setCopied, receipt.id)}
      />
    ) : (
      <PanelEmpty
        icon={<Receipt />}
        title="No fiscal receipts yet"
        text="Receipts appear here once the VSDC signs them."
      />
    ),
    numbering: <FiscalNumberingPanel devices={mine(data.devices)} profile={prof} />,
    journal: (
      <FiscalJournalPanel
        events={mine(data.journal)}
        zReports={mine(data.zReports)}
        profile={prof}
        xRun={xRun}
        onRunX={() => setXRun(true)}
      />
    ),
    items: (
      <FiscalItemCodesPanel
        items={items}
        allItems={data.items}
        mapped={mapped}
        mapItem={mapItem}
        onlyUnmapped={onlyUnmapped}
        onFilterChange={setOnlyUnmapped}
        onStartMap={setMapItem}
        onSave={(id, code) => {
          setMapped((m) => ({ ...m, [id]: code }));
          setMapItem("");
        }}
        onCancel={() => setMapItem("")}
        actorName={persona.name}
      />
    ),
  };

  return (
    <PageContent>
      {/* Top-bar pill follows the VSDC link and this merchant's live queue (board: topGate). */}
      <TopbarStatus
        kind="gate"
        icon="FileExclamation"
        label={
          offline
            ? "VSDC unreachable · sales queue as Pending"
            : `VSDC: ${pending} pending · ${count("unknown")} unknown`
        }
      />
      <PageHeader
        eyebrow="Monday 12 October 2026 · Reconcile & comply"
        title="Fiscal Receipts"
        description="EBM documents signed through the VSDC, kept per legal merchant. Issued documents are never edited; corrections are refund receipts."
        actions={
          <>
            <Segment
              aria-label="Merchant fiscal profile"
              selectedKey={prof.id}
              onSelectionChange={(k) => {
                setMerchant(String(k));
                setSelQ("");
                setSelR("");
                setMapItem("");
              }}
            >
              {data.profiles.map((p) => (
                <Segment.Item key={p.id} id={p.id}>
                  {p.name}
                </Segment.Item>
              ))}
            </Segment>
            <LinkButton href={screenHref("Integrations")} variant="secondary">
              <PlugConnection className="size-4" aria-hidden="true" />
              VSDC connection
            </LinkButton>
          </>
        }
      />

      {offline ? (
        <Alert status="danger" role="status">
          <Alert.Indicator>
            <CloudSlash />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>VSDC unreachable since 10:02</Alert.Title>
            <Alert.Description>
              New sales are saved as Pending with their request IDs and sent automatically when the connection returns.
              Guests see “fiscal receipt pending”, never an invented number.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      <Card role="region" aria-labelledby="prof-h" className="gap-3 p-[18px]">
        <Card.Header>
          <CardHeading id="prof-h">{prof.name} · Fiscal Profile</CardHeading>
          <Card.Description>Counters, journal and devices are kept apart from {prof.other}</Card.Description>
        </Card.Header>
        <div className="grid gap-x-8 gap-y-3 [grid-template-columns:repeat(auto-fit,minmax(min(360px,100%),1fr))]">
          <KeyValueList
            items={[
              { label: "TIN", value: <span className="tabular">{prof.tin}</span> },
              { label: "Sells through", value: prof.scope },
              { label: "Number series", value: <span className="tabular">{prof.series}</span> },
              { label: "Your access", value: prof.access },
            ]}
          />
          <KeyValueList
            items={[
              {
                label: "Provider certification",
                value: (
                  <>
                    <GateChip icon={<Lock className="size-3" aria-hidden="true" />}>External gate</GateChip>{" "}
                    <span className="font-normal text-muted">
                      Copy requested from the VSDC provider on 2 Oct; go-live sign-off stays with Compliance
                    </span>
                  </>
                ),
              },
              {
                label: "Device credentials",
                value: (
                  <>
                    <Chip size="sm" variant="soft" color={offline ? "danger" : "success"}>
                      {offline ? "Unreachable" : "Checked 06:00"}
                    </Chip>{" "}
                    <span className="font-normal text-muted">{prof.credentials}</span>
                  </>
                ),
              },
              {
                label: "Tax rules",
                value: (
                  <>
                    <GateChip icon={<ShieldExclamation className="size-3" aria-hidden="true" />}>
                      Awaiting sign-off
                    </GateChip>{" "}
                    <TextLink href={screenHref("TaxSummary")} className="font-normal">
                      VAT rule v3 from 1 Jul 2026
                    </TextLink>
                  </>
                ),
              },
              { label: "Last Z report", value: <span className="tabular">{prof.lastZ}</span> },
            ]}
          />
        </div>
      </Card>

      <KpiStrip items={kpis} label={`Fiscal status for ${prof.name}`} />

      <Tabs variant="secondary" selectedKey={tab} onSelectionChange={(k) => setTab(String(k) as FiscalTab)}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Fiscal workspace" className={LINE_LIST}>
            {tabs.map((t) => (
              <Tabs.Tab key={t.id} id={t.id} className={LINE_TAB}>
                {t.label}
                {t.chip ? (
                  <Chip size="sm" variant="soft" color={t.chip.color}>
                    {t.chip.n}
                  </Chip>
                ) : null}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
        {tabs.map((t) => (
          <Tabs.Panel key={t.id} id={t.id} aria-label={t.label} className={LINE_PANEL}>
            {panels[t.id]}
          </Tabs.Panel>
        ))}
      </Tabs>
    </PageContent>
  );
}
