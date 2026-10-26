import { screens } from "@injishi/data";
import type { ApprovalHistoryEntry, ApprovalRequest } from "@injishi/data/fixtures/owner";
import type { Metadata } from "next";
import { ApprovalsView } from "@/features/owner/ApprovalsView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.Approvals.pageTitle };

export default async function ApprovalsPage() {
  const persona = await requirePersona("Approvals");
  const [requests, history] = await Promise.all([
    getCollection<ApprovalRequest>("owner.approvalRequests"),
    getCollection<ApprovalHistoryEntry>("owner.approvalHistory"),
  ]);
  return <ApprovalsView persona={persona} requests={requests} history={history} />;
}
