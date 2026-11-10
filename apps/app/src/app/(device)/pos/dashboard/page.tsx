import type { Metadata } from "next";
import { loadPosPage } from "@/features/pos/load";
import { PosBlocked } from "@/features/pos/pos-blocked";
import { POS_BOARDS } from "@/features/pos/pos-boards";
import { PosDashboardView } from "@/features/pos/pos-dashboard-view";
import { posAudit, posDashboard, posSetup } from "@/server/pos";

export const metadata: Metadata = { title: POS_BOARDS.PosDashboard.pageTitle };

/** The owner's and manager's dashboard: today's money, how it was paid, what is open and what is selling. */
export default async function PosDashboardPage({ searchParams }: { searchParams: Promise<{ outlet?: string }> }) {
  const { outlet: outletParam } = await searchParams;
  const page = await loadPosPage("PosDashboard", outletParam || undefined);
  if (!page.ok) return <PosBlocked title={page.title} message={page.message} firstOutlet={page.firstOutlet} />;
  if (!page.can.some((p) => p === "shift.review" || p === "money.view")) {
    return (
      <PosBlocked
        title="Not open to you"
        message="The dashboard shows the day's money, which your role does not read."
      />
    );
  }
  // No outlet in the address means every outlet the person covers.
  const selected = outletParam ? (page.outlets.find((o) => o.id === outletParam) ?? null) : null;
  const dashboard = await posDashboard(page.ctx, selected?.id);
  // The setup nudge is a courtesy for someone who can change the setup: it never stops the dashboard from opening.
  const forSetup = selected ?? (page.outlets.length === 1 ? page.outlets[0] : null);
  const [setup, byOutlet, audit] = await Promise.all([
    forSetup && page.can.includes("outlet.manage") ? posSetup(page.ctx, forSetup.id).catch(() => null) : null,
    // Across several outlets, each outlet's own figures, so the owner can compare branches. A failed read drops the row.
    !selected && page.outlets.length > 1
      ? Promise.all(
          page.outlets.map((o) =>
            posDashboard(page.ctx, o.id)
              .then((d) => ({ outlet: o, dashboard: d }))
              .catch(() => null),
          ),
        ).then((rows) => rows.filter((r) => r !== null))
      : Promise.resolve([]),
    // The week's sensitive actions (voids, refunds, discounts, cash in and out…) with who did them. Never blocks the page.
    posAudit(page.ctx, { outletId: selected?.id, from: dashboard.week.period.from, limit: 200 }).catch(() => []),
  ]);
  return (
    <PosDashboardView
      outlets={page.outlets}
      selected={selected}
      dashboard={dashboard}
      byOutlet={byOutlet}
      audit={audit}
      can={page.can}
      setup={setup}
    />
  );
}
