import type { LeaderSummary } from "@injishi/contracts";
import { GuestReportQuery } from "@injishi/contracts";
import { screens } from "@injishi/data";
import { EmptyBlock, kigaliDay, PageContent, PageHeader, presetPeriod } from "@injishi/ui";
import type { Metadata } from "next";
import { LeaderReportsView } from "@/features/oversight/guests/LeaderReportsView";
import { currentApi, requirePersona } from "@/lib/session";
import { ApiError } from "@/server/api";
import { leaderReport, leaderSummary } from "@/server/oversight/guests";

export const metadata: Metadata = { title: screens.LeaderReports.pageTitle };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/** The narrowing choices follow what is chosen: a sector offers its cells, a cell its villages. */
async function summaryFor(narrow: Record<string, string | undefined>): Promise<LeaderSummary | null> {
  if (!narrow.sectorId && !narrow.cellId) return leaderSummary();
  const api = await currentApi();
  try {
    return await api.get<LeaderSummary>("/api/v1/oversight/guests/summary", { query: narrow });
  } catch (error) {
    if (error instanceof ApiError && error.forbidden) return null;
    throw error;
  }
}

/**
 * The local leader's reports (P5): a period (this month unless the address says otherwise) and an
 * optional sector, cell or village inside their area.
 */
export default async function LeaderReportsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePersona("LeaderReports");
  const sp = await searchParams;
  const today = kigaliDay();
  const month = presetPeriod("this_month", today);
  const parsed = GuestReportQuery.safeParse({
    from: one(sp.from) ?? month.start,
    to: one(sp.to) ?? month.end,
    sectorId: one(sp.sectorId),
    cellId: one(sp.cellId),
    villageId: one(sp.villageId),
    origin: one(sp.origin),
    nationality: one(sp.nationality),
    relationship: one(sp.relationship),
    placeType: one(sp.placeType),
    length: one(sp.length),
    flagged: one(sp.flagged),
  });
  const query = parsed.success ? parsed.data : { from: month.start, to: month.end };
  const narrow = { sectorId: one(sp.sectorId), cellId: one(sp.cellId) };
  const [report, summary] = await Promise.all([leaderReport(query), summaryFor(narrow)]);
  if (!report || !summary) {
    return (
      <PageContent>
        <PageHeader title="Guest reports" />
        <EmptyBlock
          icon="ChartColumn"
          title="You do not hold a local leader post"
          description="Reports cover the guests in a leader's own area."
        />
      </PageContent>
    );
  }
  const qs = new URLSearchParams(
    Object.entries(query).flatMap(([k, v]) => (v === undefined || v === null ? [] : [[k, String(v)]])),
  ).toString();
  return (
    <LeaderReportsView
      report={report}
      summary={summary}
      today={today}
      downloads={{
        xlsx: `/api/oversight/report.xlsx?${qs}`,
        csv: `/api/oversight/report.csv?${qs}`,
        pdf: `/api/oversight/report.pdf?${qs}`,
      }}
    />
  );
}
