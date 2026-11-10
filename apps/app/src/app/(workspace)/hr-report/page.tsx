import { screens } from "@injishi/data";
import { HrReportView, REPORT_TABS, type ReportTab } from "@injishi/product-hr/web";
import type { Metadata } from "next";
import { HrMount } from "@/features/hr/hr-mount";
import { requirePersona } from "@/lib/session";
import { requestContext } from "@/server/data";
import { hrFeaturesOff } from "@/server/hr-features";
import { readHrReport } from "@/server/hr-report";

export const metadata: Metadata = { title: screens.HrReport.pageTitle };

/** The twelve months to today's, newest first ("2026-11", "2026-10", …). */
function lastMonths(today: string, count: number): string[] {
  const out: string[] = [];
  let [y, m] = today.slice(0, 7).split("-").map(Number);
  for (let i = 0; i < count; i++) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

function lastDayOf(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
}

/** HR report: one month of everything that took place, the last whole month unless one is chosen. */
export default async function HrReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; tab?: string }>;
}) {
  await requirePersona("HrReport");
  const ctx = await requestContext();
  const months = lastMonths(ctx.today.iso, 12);
  const { month: asked, tab } = await searchParams;
  const month = asked && months.includes(asked) ? asked : months[1];
  const report = await readHrReport(ctx, `${month}-01`, lastDayOf(month));
  const initialTab: ReportTab = REPORT_TABS.find((t) => t === tab) ?? "attendance";
  return (
    <HrMount off={await hrFeaturesOff()}>
      <HrReportView key={month} report={report} month={month} months={months} initialTab={initialTab} />
    </HrMount>
  );
}
