import { screens } from "@injishi/data";
import type {
  PlanBillingEntitlement,
  PlanBillingInvoice,
  PlanBillingInvoiceKind,
  PlanBillingInvoiceLine,
  PlanBillingMethod,
  PlanBillingOption,
  PlanBillingStep,
} from "@injishi/data/fixtures/owner";
import type { Metadata } from "next";
import { PlanBillingView } from "@/features/owner/PlanBillingView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.PlanBilling.pageTitle };

export default async function PlanBillingPage({ searchParams }: { searchParams: Promise<{ billing?: string }> }) {
  await requirePersona("PlanBilling");
  const [activation, nextLines, retries, entitlements, invoices, methods, invoiceKinds, options] = await Promise.all([
    getCollection<PlanBillingStep>("owner.planBillingActivation"),
    getCollection<PlanBillingInvoiceLine>("owner.planBillingNextLines"),
    getCollection<PlanBillingStep>("owner.planBillingRetries"),
    getCollection<PlanBillingEntitlement>("owner.planBillingEntitlements"),
    getCollection<PlanBillingInvoice>("owner.planBillingInvoices"),
    getCollection<PlanBillingMethod>("owner.planBillingMethods"),
    getCollection<PlanBillingInvoiceKind>("owner.planBillingInvoiceKinds"),
    getCollection<PlanBillingOption>("owner.planBillingOptions"),
  ]);
  const { billing } = await searchParams;
  return (
    <PlanBillingView
      billing={billing === "paid" ? "paid" : "retrying"}
      data={{ activation, nextLines, retries, entitlements, invoices, methods, invoiceKinds, options }}
    />
  );
}
