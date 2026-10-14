import { screens } from "@injishi/data";
import type { ProblemCategory, ProblemReport, ReportPlace, UrgencyLevel } from "@injishi/data/fixtures/staff";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StaffReportView } from "@/features/staff/StaffReportView";
import { requirePersona } from "@/lib/session";
import { getCollection, getDocument } from "@/server/data";

export const metadata: Metadata = { title: screens.StaffReport.pageTitle };

export default async function StaffReportPage({ searchParams }: { searchParams: Promise<{ offline?: string }> }) {
  await requirePersona("StaffReport");
  const [places, categories, urgencies, report] = await Promise.all([
    getCollection<ReportPlace>("staff.reportPlaces"),
    getCollection<ProblemCategory>("staff.problemCategories"),
    getCollection<UrgencyLevel>("staff.urgencyLevels"),
    getDocument<ProblemReport>("staff.problemReports", "WO-318"),
  ]);
  if (!report || !places.length || !categories.length || !urgencies.length) notFound();
  const { offline } = await searchParams;
  return <StaffReportView data={{ places, categories, urgencies, report }} offline={offline === "1"} />;
}
