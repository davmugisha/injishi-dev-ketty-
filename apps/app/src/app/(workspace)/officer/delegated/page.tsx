import { screens } from "@injishi/data";
import type {
  AccessLogEntry,
  DataExport,
  DatasetTerm,
  ExportChannel,
  OccupancyMonth,
  OccupancySector,
  ReportingRequirement,
} from "@injishi/data/fixtures/oversight";
import type { Metadata } from "next";
import { DelegatedReportsView } from "@/features/oversight/DelegatedReportsView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.DelegatedReports.pageTitle };

/** Datasets shared with the district under a verified legal basis. */
export default async function DelegatedReportsPage() {
  await requirePersona("DelegatedReports");
  const [months, sectors, terms, requirements, exports, log, channels] = await Promise.all([
    getCollection<OccupancyMonth>("oversight.occupancyMonths"),
    getCollection<OccupancySector>("oversight.occupancySectors"),
    getCollection<DatasetTerm>("oversight.datasetTerms"),
    getCollection<ReportingRequirement>("oversight.reportingRequirements"),
    getCollection<DataExport>("oversight.dataExports"),
    getCollection<AccessLogEntry>("oversight.accessLog"),
    getCollection<ExportChannel>("oversight.exportChannels"),
  ]);
  return <DelegatedReportsView data={{ months, sectors, terms, requirements, exports, log, channels }} />;
}
