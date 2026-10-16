import { screens } from "@injishi/data";
import type {
  ReportsAgingBucket,
  ReportsArrear,
  ReportsChannel,
  ReportsDebtor,
  ReportsKpi,
  ReportsMeasureDefinition,
  ReportsPickupWeek,
  ReportsProfitLine,
  ReportsProperty,
  ReportsRoomType,
  ReportsSavedView,
  ReportsSchedule,
  ReportsSummaryKpi,
  ReportsTrendDay,
  ReportsVacantUnit,
} from "@injishi/data/fixtures/owner";
import type { Metadata } from "next";
import { ReportsView } from "@/features/owner/ReportsView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.Reports.pageTitle };

export default async function ReportsPage() {
  await requirePersona("Reports");
  const [
    properties,
    savedViews,
    kpis,
    definitions,
    trendDays,
    pickup,
    roomTypes,
    channels,
    summaryKpis,
    profitLines,
    aging,
    debtors,
    vacantUnits,
    arrears,
    schedules,
  ] = await Promise.all([
    getCollection<ReportsProperty>("owner.reportsProperties"),
    getCollection<ReportsSavedView>("owner.reportsSavedViews"),
    getCollection<ReportsKpi>("owner.reportsKpis"),
    getCollection<ReportsMeasureDefinition>("owner.reportsDefinitions"),
    getCollection<ReportsTrendDay>("owner.reportsTrendDays"),
    getCollection<ReportsPickupWeek>("owner.reportsPickup"),
    getCollection<ReportsRoomType>("owner.reportsRoomTypes"),
    getCollection<ReportsChannel>("owner.reportsChannels"),
    getCollection<ReportsSummaryKpi>("owner.reportsSummaryKpis"),
    getCollection<ReportsProfitLine>("owner.reportsProfitLines"),
    getCollection<ReportsAgingBucket>("owner.reportsAging"),
    getCollection<ReportsDebtor>("owner.reportsDebtors"),
    getCollection<ReportsVacantUnit>("owner.reportsVacantUnits"),
    getCollection<ReportsArrear>("owner.reportsArrears"),
    getCollection<ReportsSchedule>("owner.reportsSchedules"),
  ]);
  return (
    <ReportsView
      data={{
        properties,
        savedViews,
        kpis,
        definitions,
        trendDays,
        pickup,
        roomTypes,
        channels,
        summaryKpis,
        profitLines,
        aging,
        debtors,
        vacantUnits,
        arrears,
        schedules,
      }}
    />
  );
}
