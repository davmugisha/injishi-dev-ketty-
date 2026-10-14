import { screens } from "@injishi/data";
import type { CommissionLine, Payout } from "@injishi/data/fixtures/accounting";
import type { Metadata } from "next";
import { CommissionsView } from "@/features/accounting/CommissionsView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.Commissions.pageTitle };

export default async function CommissionsPage() {
  await requirePersona("Commissions");
  const [lines, payouts] = await Promise.all([
    getCollection<CommissionLine>("accounting.commissions"),
    getCollection<Payout>("accounting.payouts"),
  ]);
  return <CommissionsView lines={lines} payouts={payouts} />;
}
