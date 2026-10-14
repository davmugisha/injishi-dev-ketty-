import { screens } from "@injishi/data";
import type { DeskMethod, PaymentIntent, RefundRequest } from "@injishi/data/fixtures/finance";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { PaymentsView } from "@/features/finance/PaymentsView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.Payments.pageTitle };

export default async function PaymentsPage() {
  await requirePersona("Payments");
  const [payments, refunds, deskMethods] = await Promise.all([
    getCollection<PaymentIntent>("finance.payments"),
    getCollection<RefundRequest>("finance.refunds"),
    getCollection<DeskMethod>("finance.deskMethods"),
  ]);
  return <PaymentsView data={{ payments, refunds, deskMethods }} />;
}
