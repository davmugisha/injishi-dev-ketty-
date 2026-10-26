"use client";

import { ChartColumn, CircleDashed, Lock, Plus } from "@gravity-ui/icons";
import { Button, Card, Tabs } from "@heroui/react";
import { screenHref } from "@injishi/data";
import type {
  AccountingKpi,
  ClosePeriod,
  ExportBatch,
  JournalEntry,
  LedgerAccount,
} from "@injishi/data/fixtures/accounting";
import { GateChip, LinkButton, PageContent, PageHeader } from "@injishi/ui";
import { type ReactNode, useState } from "react";
import { LedgerAccountsPanel, LedgerClosePanel, LedgerExportsPanel, LedgerJournalPanel } from "./LedgerPanels";
import { KpiStrip, LINE_LIST, LINE_PANEL, LINE_TAB } from "./shared";

export type LedgerTab = "journal" | "coa" | "close" | "exports";

interface GeneralLedgerData {
  kpis: AccountingKpi[];
  entries: JournalEntry[];
  accounts: LedgerAccount[];
  periods: ClosePeriod[];
  batches: ExportBatch[];
}

const TABS: { id: LedgerTab; label: string }[] = [
  { id: "journal", label: "Journal entries" },
  { id: "coa", label: "Chart of accounts" },
  { id: "close", label: "Period close" },
  { id: "exports", label: "Exports" },
];

export function GeneralLedgerView({ initialTab, data }: { initialTab: LedgerTab; data: GeneralLedgerData }) {
  const [tab, setTab] = useState<LedgerTab>(initialTab);
  const [source, setSource] = useState("all");
  const [open, setOpen] = useState("JE-26-10-0436");
  const [onlyAttention, setOnlyAttention] = useState(false);
  const [proposed, setProposed] = useState<Record<string, boolean>>({});
  const [rerun, setRerun] = useState<Record<string, boolean>>({});
  const [reopen, setReopen] = useState(false);

  const panels: Record<LedgerTab, ReactNode> = {
    journal: (
      <LedgerJournalPanel
        entries={data.entries}
        source={source}
        onSourceChange={setSource}
        open={open}
        onToggle={(id) => setOpen((cur) => (cur === id ? "" : id))}
      />
    ),
    coa: (
      <LedgerAccountsPanel
        accounts={data.accounts}
        proposed={proposed}
        onPropose={(id) => setProposed((o) => ({ ...o, [id]: true }))}
        onlyAttention={onlyAttention}
        onFilterChange={setOnlyAttention}
      />
    ),
    close: <LedgerClosePanel periods={data.periods} reopenRequested={reopen} onRequestReopen={() => setReopen(true)} />,
    exports: (
      <LedgerExportsPanel
        batches={data.batches}
        rerun={rerun}
        onRerun={(id) => setRerun((o) => ({ ...o, [id]: true }))}
      />
    ),
  };

  return (
    <PageContent>
      <PageHeader
        eyebrow="Amahoro Hospitality Ltd · TIN 102 345 678 · Fiscal year 2026 · RWF"
        title="General Ledger"
        description="Balanced postings from folio close, verified payments and approved supplier invoices. Amahoro Residences Ltd keeps a separate ledger."
        actions={
          <>
            <LinkButton href={screenHref("Reports")} variant="secondary">
              <ChartColumn className="size-4" aria-hidden="true" />
              Financial reports
            </LinkButton>
            <Button>
              <Plus className="size-4" aria-hidden="true" />
              Manual journal
            </Button>
          </>
        }
      />

      <KpiStrip
        items={data.kpis}
        label="Ledger status"
        minWidth="220px"
        valueClassName="text-[20px] leading-7 tabular"
      />

      <Tabs variant="secondary" selectedKey={tab} onSelectionChange={(k) => setTab(String(k) as LedgerTab)}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Ledger workspace" className={LINE_LIST}>
            {TABS.map((t) => (
              <Tabs.Tab key={t.id} id={t.id} className={LINE_TAB}>
                {t.label}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
            <Tabs.Tab id="consolidation" isDisabled className={LINE_TAB}>
              <Lock className="size-4" aria-hidden="true" />
              Consolidation
              <span className="sr-only"> (needs legal-entity relationships and elimination rules)</span>
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        {TABS.map((t) => (
          <Tabs.Panel key={t.id} id={t.id} aria-label={t.label} className={LINE_PANEL}>
            {panels[t.id]}
          </Tabs.Panel>
        ))}
      </Tabs>

      <Card variant="secondary" role="region" aria-labelledby="cons-h" className="gap-2 px-[18px] py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="cons-h" className="text-[15px] leading-[22px] font-semibold">
            Multicompany Consolidation
          </h2>
          <GateChip icon={<Lock className="size-3" aria-hidden="true" />}>Off until rules exist</GateChip>
        </div>
        <p className="text-[13px] leading-5">
          Amahoro Hospitality Ltd and Amahoro Residences Ltd keep separate ledgers. Consolidating them needs the
          legal-entity relationships, intercompany accounts and elimination rules to be defined and approved by the
          owner. None are defined yet, so no consolidated figures are produced.
        </p>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          {["Entity relationships", "Intercompany accounts", "Elimination rules"].map((r) => (
            <span key={r} className="flex items-center gap-1.5">
              <CircleDashed className="size-4 text-muted" aria-hidden="true" />
              {r} · not defined
            </span>
          ))}
          <Button size="sm" variant="secondary" isDisabled>
            Run consolidation
          </Button>
        </div>
      </Card>
    </PageContent>
  );
}
