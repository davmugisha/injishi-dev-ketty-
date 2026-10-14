import { screens } from "@injishi/data";
import type { AuditIssue, AuditRun, AuditStep } from "@injishi/data/fixtures/finance";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { NightAuditView } from "@/features/finance/NightAuditView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.NightAudit.pageTitle };

export default async function NightAuditPage() {
  await requirePersona("NightAudit");
  const [steps, issues, runs] = await Promise.all([
    getCollection<AuditStep>("finance.auditSteps"),
    getCollection<AuditIssue>("finance.auditIssues"),
    getCollection<AuditRun>("finance.auditRuns"),
  ]);
  return <NightAuditView data={{ steps, issues, runs }} />;
}
