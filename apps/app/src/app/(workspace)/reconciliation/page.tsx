import { screens } from "@injishi/data";
import type {
  MatchSummaryItem,
  ReconInvoice,
  ReconMatch,
  ReconSource,
  SettlementBatch,
} from "@injishi/data/fixtures/finance";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { ReconciliationView } from "@/features/finance/ReconciliationView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.Reconciliation.pageTitle };

export default async function ReconciliationPage() {
  await requirePersona("Reconciliation");
  const [sources, summary, matches, invoices, batches] = await Promise.all([
    getCollection<ReconSource>("finance.reconSources"),
    getCollection<MatchSummaryItem>("finance.matchSummary"),
    getCollection<ReconMatch>("finance.reconMatches"),
    getCollection<ReconInvoice>("finance.reconInvoices"),
    getCollection<SettlementBatch>("finance.settlementBatches"),
  ]);
  return <ReconciliationView data={{ sources, summary, matches, invoices, batches }} />;
}
