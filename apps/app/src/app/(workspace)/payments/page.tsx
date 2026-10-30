import { screens } from "@injishi/data";
import type { DeskMethod, PaymentIntent, RefundRequest } from "@injishi/data/fixtures/finance";
import type { Metadata } from "next";
import { PaymentsView } from "@/features/finance/PaymentsView";
import { PayMount } from "@/features/pay/pay-mount";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.Payments.pageTitle };

export default async function PaymentsPage() {
  await requirePersona("Payments");
  const [payments, refunds, deskMethods] = await Promise.all([
    getCollection<PaymentIntent>("finance.payments"),
    getCollection<RefundRequest>("finance.refunds"),
    getCollection<DeskMethod>("finance.deskMethods"),
  ]);
  return (
    <PayMount>
      <PaymentsView data={{ payments, refunds, deskMethods }} />
    </PayMount>
  );
}
