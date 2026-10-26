import { screens } from "@injishi/data";
import type { GoodsReceipt, MatchResolution, ReasonOption, ReceiptLine } from "@injishi/data/fixtures/stock";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GoodsReceiptView } from "@/features/stock/GoodsReceiptView";
import { requirePersona } from "@/lib/session";
import { getCollection, getDocument } from "@/server/data";

export const metadata: Metadata = { title: screens.GoodsReceipt.pageTitle };

/** The receipt being counted at the gate: GRN-26-0318 for PO-26-0142 (Kivu Fresh Fish Co.). */
const OPEN_RECEIPT = "GRN-26-0318";

export default async function GoodsReceiptPage() {
  await requirePersona("GoodsReceipt");
  const [receipt, lines, reasons, resolutions] = await Promise.all([
    getDocument<GoodsReceipt>("stock.receipts", OPEN_RECEIPT),
    getCollection<ReceiptLine>("stock.receiptLines"),
    getCollection<ReasonOption>("stock.rejectionReasons"),
    getCollection<MatchResolution>("stock.matchResolutions"),
  ]);
  if (!receipt) notFound();
  return <GoodsReceiptView data={{ receipt, lines, reasons, resolutions }} />;
}
