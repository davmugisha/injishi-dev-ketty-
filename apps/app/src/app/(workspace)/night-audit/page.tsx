import { screens } from "@injishi/data";
import type { AuditIssue, AuditRun, AuditStep } from "@injishi/data/fixtures/finance";
import type { Metadata } from "next";
import { NightAuditView } from "@/features/finance/NightAuditView";
import { PmsMount } from "@/features/pms/pms-mount";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.NightAudit.pageTitle };

export default async function NightAuditPage() {
  await requirePersona("NightAudit");
  const [steps, issues, runs] = await Promise.all([
    getCollection<AuditStep>("finance.auditSteps"),
    getCollection<AuditIssue>("finance.auditIssues"),
    getCollection<AuditRun>("finance.auditRuns"),
  ]);
  return (
    <PmsMount>
      <NightAuditView data={{ steps, issues, runs }} />
    </PmsMount>
  );
}
