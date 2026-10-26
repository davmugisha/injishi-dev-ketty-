import { screens } from "@injishi/data";
import type { ProblemCategory, ProblemReport, ReportPlace, UrgencyLevel } from "@injishi/data/fixtures/staff";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StaffReportView } from "@/features/staff/StaffReportView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.StaffReport.pageTitle };

/** A new report starts empty: nothing is copied from a report the person sent before. */
export default async function StaffReportPage({ searchParams }: { searchParams: Promise<{ offline?: string }> }) {
  await requirePersona("StaffReport");
  const [places, categories, urgencies, open] = await Promise.all([
    getCollection<ReportPlace>("staff.reportPlaces"),
    getCollection<ProblemCategory>("staff.problemCategories"),
    getCollection<UrgencyLevel>("staff.urgencyLevels"),
    // The person's own open reports, listed above the form so nothing is sent twice (never copied into it).
    getCollection<ProblemReport>("staff.problemReports"),
  ]);
  if (!categories.length || !urgencies.length) notFound();
  const { offline } = await searchParams;
  return <StaffReportView data={{ places, categories, urgencies, open }} offline={offline === "1"} />;
}
