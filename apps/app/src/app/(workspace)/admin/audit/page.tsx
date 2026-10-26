import { screens } from "@injishi/data";
import type { AuditEvent, AuditKpi } from "@injishi/data/fixtures/platformops";
import type { Metadata } from "next";
import { AdminAuditView } from "@/features/platformops/AdminAuditView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.AdminAudit.pageTitle };

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ exportOpen?: string }> }) {
  await requirePersona("AdminAudit");
  const { exportOpen } = await searchParams;
  const [kpis, events] = await Promise.all([
    getCollection<AuditKpi>("platformops.auditKpis"),
    getCollection<AuditEvent>("platformops.auditEvents"),
  ]);
  return <AdminAuditView data={{ kpis, events }} exportOpen={exportOpen === "true"} />;
}
