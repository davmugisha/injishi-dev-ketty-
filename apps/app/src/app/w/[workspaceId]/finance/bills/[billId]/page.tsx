import { AppShell } from "@/pms/components/app-shell";
import { FinanceBill } from "@/pms/screens/finance-bill";

/**
 * One bill, inside Finance: the one address of a folio that bills no record
 * (ADR-044, D-c).
 *
 * Not a second way in to a guest's bill. That lives on its stay, or on its
 * reservation before the guest arrives, and this route is a 404 for it. The
 * record's name reaches the topbar from `ObjectPage` once the folio is read.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ billId: string }>;
}) {
  const { billId } = await params;
  return (
    <AppShell title="Bill">
      <FinanceBill id={billId} />
    </AppShell>
  );
}
