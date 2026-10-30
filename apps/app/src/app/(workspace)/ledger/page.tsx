import { screens } from "@injishi/data";
import type {
  AccountingKpi,
  ClosePeriod,
  ExportBatch,
  JournalEntry,
  LedgerAccount,
} from "@injishi/data/fixtures/accounting";
import { GeneralLedgerView, type LedgerTab } from "@injishi/product-finance/web";
import type { Metadata } from "next";
import { FinanceMount } from "@/features/finance/finance-mount";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.GeneralLedger.pageTitle };

const TABS: LedgerTab[] = ["journal", "coa", "close", "exports"];

export default async function GeneralLedgerPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePersona("GeneralLedger");
  const [kpis, entries, accounts, periods, batches] = await Promise.all([
    getCollection<AccountingKpi>("accounting.kpis"),
    getCollection<JournalEntry>("accounting.journalEntries"),
    getCollection<LedgerAccount>("accounting.ledgerAccounts"),
    getCollection<ClosePeriod>("accounting.closePeriods"),
    getCollection<ExportBatch>("accounting.exportBatches"),
  ]);
  const { tab } = await searchParams;
  return (
    <FinanceMount>
      <GeneralLedgerView
        initialTab={TABS.find((t) => t === tab) ?? "journal"}
        data={{ kpis: kpis.filter((k) => k.board === "GeneralLedger"), entries, accounts, periods, batches }}
      />
    </FinanceMount>
  );
}
