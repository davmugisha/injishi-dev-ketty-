import type { Metadata } from "next";
import { loadPosPage } from "@/features/pos/load";
import { PosBlocked } from "@/features/pos/pos-blocked";
import { POS_BOARDS } from "@/features/pos/pos-boards";
import { PosDashboardView } from "@/features/pos/pos-dashboard-view";
import { posDashboard } from "@/server/pos";

export const metadata: Metadata = { title: POS_BOARDS.PosDashboard.pageTitle };

/** The owner's and manager's dashboard: today's money, how it was paid, what is open and what is selling. */
export default async function PosDashboardPage({ searchParams }: { searchParams: Promise<{ outlet?: string }> }) {
  const { outlet: outletParam } = await searchParams;
  const page = await loadPosPage("PosDashboard", outletParam || undefined);
  if (!page.ok) return <PosBlocked title={page.title} message={page.message} />;
  if (!page.can.some((p) => p === "shift.review" || p === "money.view")) {
    return <PosBlocked title="Not open to you" message="The dashboard shows the day's money, which your role does not read." />;
  }
  // No outlet in the address means every outlet the person covers.
  const selected = outletParam ? (page.outlets.find((o) => o.id === outletParam) ?? null) : null;
  const dashboard = await posDashboard(page.ctx, selected?.id);
  return <PosDashboardView outlets={page.outlets} selected={selected} dashboard={dashboard} can={page.can} />;
}
