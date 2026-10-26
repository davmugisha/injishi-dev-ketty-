import { screens } from "@injishi/data";
import type {
  ApprovalRule,
  BuyRequisition,
  DraftPoLine,
  PurchaseOrder,
  SupplierQuote,
} from "@injishi/data/fixtures/stock";
import type { Metadata } from "next";
import { type BuyingTab, PurchaseOrdersView } from "@/features/stock/PurchaseOrdersView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.PurchaseOrders.pageTitle };

const TABS: BuyingTab[] = ["po", "req"];

export default async function PurchaseOrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const persona = await requirePersona("PurchaseOrders");
  const [orders, quotes, lines, rules, requisitions] = await Promise.all([
    getCollection<PurchaseOrder>("stock.purchaseOrders"),
    getCollection<SupplierQuote>("stock.supplierQuotes"),
    getCollection<DraftPoLine>("stock.draftPoLines"),
    getCollection<ApprovalRule>("stock.approvalRules"),
    getCollection<BuyRequisition>("stock.buyRequisitions"),
  ]);
  const { tab } = await searchParams;
  return (
    <PurchaseOrdersView
      persona={persona}
      initialTab={TABS.find((t) => t === tab) ?? "po"}
      data={{ orders, quotes, lines, rules, requisitions }}
    />
  );
}
