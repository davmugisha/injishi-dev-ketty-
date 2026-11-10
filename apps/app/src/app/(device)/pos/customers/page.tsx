import type { Metadata } from "next";
import { loadPosPage, readOrBlock } from "@/features/pos/load";
import { PosBlocked } from "@/features/pos/pos-blocked";
import { POS_BOARDS } from "@/features/pos/pos-boards";
import { PosCustomersScreen } from "@/features/pos/pos-customers-view";
import { ApiError } from "@/server/api";
import { type PosCustomerProfile, posCustomer, posCustomers } from "@/server/pos";

export const metadata: Metadata = { title: POS_BOARDS.PosCustomers.pageTitle };

/**
 * The customers of the business: search, a profile with its order history, and (by permission) registering,
 * correcting, merging, exporting and erasing. What each person sees is the API's decision, not this page's.
 */
export default async function PosCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ outlet?: string; q?: string; c?: string }>;
}) {
  const { outlet: outletParam, q: qParam, c: customerParam } = await searchParams;
  const page = await loadPosPage("PosCustomers", outletParam || undefined);
  if (!page.ok) return <PosBlocked title={page.title} message={page.message} firstOutlet={page.firstOutlet} />;
  if (!page.can.some((p) => p === "customer.view" || p === "customer.manage")) {
    return (
      <PosBlocked
        title="Not open to you"
        message="Customers are kept by the managers, the cashiers and the floor staff."
      />
    );
  }
  const q = (qParam ?? "").trim().slice(0, 80);
  const read = await readOrBlock(() => posCustomers(page.ctx, { q: q || undefined }));
  if (!read.ok) return <PosBlocked title={read.title} message={read.message} />;

  let selected: PosCustomerProfile | null = null;
  if (customerParam) {
    try {
      selected = await posCustomer(page.ctx, customerParam);
    } catch (error) {
      // A link to a customer who was merged, erased, or never existed shows the list, not an error page.
      if (!(error instanceof ApiError)) throw error;
    }
  }
  return (
    <PosCustomersScreen
      outlets={page.outlets}
      outlet={page.outlet}
      list={read.value}
      selected={selected}
      q={q}
      can={page.can}
    />
  );
}
