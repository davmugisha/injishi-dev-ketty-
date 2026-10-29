import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { PsfReportView } from "@/features/oversight/PsfReportView";
import { requirePersona } from "@/lib/session";
import { requestContext } from "@/server/data";
import { readPsfReport, readPsfScope } from "@/server/sources/psf";

export const metadata: Metadata = { title: screens.PsfReport.pageTitle };

/** "2026-10-26" in Kigali. */
function kigaliDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kigali" }).format(now);
}

/** Overview report — same WorkspaceShell as /officer/delegated. */
export default async function PsfReportPage() {
  await requirePersona("PsfReport");
  const ctx = await requestContext();
  const to = kigaliDay(ctx.now);
  const from = `${to.slice(0, 4)}-01-01`;
  const [scope, report] = await Promise.all([readPsfScope(ctx), readPsfReport(ctx, { from, to })]);
  return <PsfReportView scope={scope} report={report} />;
}
