import type { Metadata } from "next";
import { addDays, kigaliToday } from "@/features/pos/format";
import { loadPosPage } from "@/features/pos/load";
import { PosBlocked } from "@/features/pos/pos-blocked";
import { POS_BOARDS } from "@/features/pos/pos-boards";
import { PERIODS, type PeriodKey, PosReportsView } from "@/features/pos/pos-reports-view";
import { posReport } from "@/server/pos";

export const metadata: Metadata = { title: POS_BOARDS.PosReports.pageTitle };

/** The Kigali date range of a named period. */
function rangeOf(period: PeriodKey): { from: string; to: string } {
  const today = kigaliToday();
  const monthStart = `${today.slice(0, 7)}-01`;
  switch (period) {
    case "yesterday":
      return { from: addDays(today, -1), to: addDays(today, -1) };
    case "week":
      return { from: addDays(today, -6), to: today };
    case "month":
      return { from: monthStart, to: today };
    case "lastmonth": {
      const end = addDays(monthStart, -1);
      return { from: `${end.slice(0, 7)}-01`, to: end };
    }
    default:
      return { from: today, to: today };
  }
}

/** Sales, payments, products, waiters, profit and loss, tax, expenses and stock value for a period. */
export default async function PosReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ outlet?: string; period?: string }>;
}) {
  const { outlet: outletParam, period: periodParam } = await searchParams;
  const page = await loadPosPage("PosReports", outletParam || undefined);
  if (!page.ok) return <PosBlocked title={page.title} message={page.message} />;
  if (!page.can.some((p) => p === "shift.review" || p === "money.view")) {
    return <PosBlocked title="Not open to you" message="The reports show the business's money, which your role does not read." />;
  }
  const period = (PERIODS.some(([k]) => k === periodParam) ? periodParam : "today") as PeriodKey;
  const selected = outletParam ? (page.outlets.find((o) => o.id === outletParam) ?? null) : null;
  const report = await posReport(page.ctx, { outletId: selected?.id, ...rangeOf(period) });
  return <PosReportsView outlets={page.outlets} selected={selected} period={period} report={report} can={page.can} />;
}
