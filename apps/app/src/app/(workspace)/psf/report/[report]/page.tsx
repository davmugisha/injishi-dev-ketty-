import { screens } from "@injishi/data";
import { presetPeriod } from "@injishi/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PsfReportsView } from "@/features/oversight/PsfReportsView";
import { PSF_REPORTS, type PsfReportId } from "@/features/oversight/psf-reports";
import { requirePersona } from "@/lib/session";
import { requestContext } from "@/server/data";
import { readPsfReport, readPsfScope } from "@/server/sources/psf";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-10-30" in Kigali. */
function kigaliDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kigali" }).format(now);
}

export async function generateMetadata({ params }: { params: Promise<{ report: string }> }): Promise<Metadata> {
  const { report } = await params;
  const found = PSF_REPORTS.find((r) => r.id === report);
  return { title: found ? `PSF · ${found.title}` : screens.PsfReport.pageTitle };
}

/**
 * One PSF report on its own page (2026-10-30): the overview, membership, business approvals, the
 * district economy and the member register, each for a period (this year unless the address names one),
 * each downloadable and printable on its own.
 */
export default async function PsfReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ report: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requirePersona("PsfReport");
  const { report } = await params;
  if (!PSF_REPORTS.some((r) => r.id === report)) notFound();
  const ctx = await requestContext();
  const today = kigaliDay(ctx.now);
  const q = await searchParams;
  const year = presetPeriod("this_year", today);
  const from = q.from && DAY.test(q.from) ? q.from : year.start;
  const to = q.to && DAY.test(q.to) && q.to >= from ? q.to : year.end;
  const [scope, data] = await Promise.all([readPsfScope(ctx), readPsfReport(ctx, { from, to })]);
  return <PsfReportsView id={report as PsfReportId} scope={scope} report={data} today={today} />;
}
