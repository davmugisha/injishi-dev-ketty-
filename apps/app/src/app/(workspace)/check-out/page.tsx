import { screens } from "@injishi/data";
import type { CheckoutCase, CheckoutLedgerLine } from "@injishi/data/fixtures/stays";
import { CheckoutView, type MomoState, type ReceiptOutcome } from "@injishi/product-pms/web";
import { ActionLink, EmptyBlock, PageContent, PageHeader } from "@injishi/ui";
import type { Metadata } from "next";
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
  // Nobody left to check out, which is where the desk lands right after the last checkout of the day.
  if (!checkout) {
    return (
      <PageContent>
        <PageHeader title={screens.Checkout.pageTitle} />
        <EmptyBlock
          icon="CircleCheck"
          title="Nobody is due out"
          description="Every guest due to leave has checked out. A guest leaving early checks out from their stay's page."
          action={
            <ActionLink href="/front-desk" icon="ArrowLeft">
              Front desk
            </ActionLink>
          }
        />
      </PageContent>
    );
  }
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
