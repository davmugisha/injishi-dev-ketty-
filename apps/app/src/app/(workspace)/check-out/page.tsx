import { screens } from "@injishi/data";
import type { CheckoutCase, CheckoutLedgerLine } from "@injishi/data/fixtures/stays";
import { CheckoutView, type MomoState, type ReceiptOutcome } from "@injishi/product-pms/web";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PmsMount } from "@/features/pms/pms-mount";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.Checkout.pageTitle };

const RECEIPTS: ReceiptOutcome[] = ["pending", "issued", "unknown"];
const MOMO: MomoState[] = ["idle", "pending", "unknown", "verified"];

/**
 * Checkout opens on the next guest due out, read live with the evidence behind the balance. The
 * prototype's MoMo trail, receipt drafts and key list are not read (none of them is this guest's).
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ receipt?: string; momo?: string }>;
}) {
  const persona = await requirePersona("Checkout");
  const [checkouts, ledger] = await Promise.all([
    getCollection<CheckoutCase>("stays.checkouts"),
    getCollection<CheckoutLedgerLine>("stays.checkoutLedger"),
  ]);
  const checkout = checkouts[0];
  if (!checkout) notFound();
  const { receipt, momo } = await searchParams;
  return (
    <PmsMount>
      <CheckoutView
        persona={persona}
        data={{ checkout, ledger }}
        receipt={RECEIPTS.find((r) => r === receipt) ?? "pending"}
        initialMomo={MOMO.find((m) => m === momo) ?? "pending"}
      />
    </PmsMount>
  );
}
