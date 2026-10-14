import { screens } from "@injishi/data";
import type {
  CountLine,
  ReasonOption,
  StockLocation,
  StockMovement,
  StockTransfer,
} from "@injishi/data/fixtures/stock";
import type { Metadata } from "next";
import { type LedgerTab, StockLedgerView } from "@/features/stock/StockLedgerView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.StockLedger.pageTitle };

const TABS: LedgerTab[] = ["mv", "count", "tr"];

export default async function StockLedgerPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePersona("StockLedger");
  const [movements, locations, countLines, reasons, transfers] = await Promise.all([
    getCollection<StockMovement>("stock.movements"),
    getCollection<StockLocation>("stock.locations"),
    getCollection<CountLine>("stock.countLines"),
    getCollection<ReasonOption>("stock.varianceReasons"),
    getCollection<StockTransfer>("stock.transfers"),
  ]);
  const { tab } = await searchParams;
  return (
    <StockLedgerView
      initialTab={TABS.find((t) => t === tab) ?? "mv"}
      data={{ movements, locations, countLines, reasons, transfers }}
    />
  );
}
