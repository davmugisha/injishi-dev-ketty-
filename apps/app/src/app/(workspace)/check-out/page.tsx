import { screens } from "@injishi/data";
import type {
  CheckoutCase,
  CheckoutKey,
  CheckoutLedgerLine,
  FiscalReceiptDraft,
  MomoEvent,
} from "@injishi/data/fixtures/stays";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckoutView, type MomoState, type ReceiptOutcome } from "@/features/stays/CheckoutView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.Checkout.pageTitle };

const RECEIPTS: ReceiptOutcome[] = ["pending", "issued", "unknown"];
const MOMO: MomoState[] = ["idle", "pending", "unknown", "verified"];

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ receipt?: string; momo?: string }>;
}) {
  const persona = await requirePersona("Checkout");
  const [checkouts, ledger, momoTrail, receipts, keys] = await Promise.all([
    getCollection<CheckoutCase>("stays.checkouts"),
    getCollection<CheckoutLedgerLine>("stays.checkoutLedger"),
    getCollection<MomoEvent>("stays.momoTrail"),
    getCollection<FiscalReceiptDraft>("stays.fiscalReceipts"),
    getCollection<CheckoutKey>("stays.checkoutKeys"),
  ]);
  const checkout = checkouts[0];
  if (!checkout) notFound();
  const { receipt, momo } = await searchParams;
  return (
    <CheckoutView
      persona={persona}
      data={{ checkout, ledger, momoTrail, receipts, keys }}
      receipt={RECEIPTS.find((r) => r === receipt) ?? "pending"}
      initialMomo={MOMO.find((m) => m === momo) ?? "pending"}
    />
  );
}
