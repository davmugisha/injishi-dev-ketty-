import { screens } from "@injishi/data";
import type { ApprovalHistoryEntry, ApprovalRequest } from "@injishi/data/fixtures/owner";
import type { Metadata } from "next";
import { ApprovalsView } from "@/features/owner/ApprovalsView";
import { requirePersona } from "@/lib/session";
import { getCollection, requestContext } from "@/server/data";

export const metadata: Metadata = { title: screens.Approvals.pageTitle };

export default async function ApprovalsPage() {
  const persona = await requirePersona("Approvals");
  const [requests, history] = await Promise.all([
    getCollection<ApprovalRequest>("owner.approvalRequests"),
    getCollection<ApprovalHistoryEntry>("owner.approvalHistory"),
  ]);
  const { today } = await requestContext();
  const todayLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${today.iso}T12:00:00Z`));
  return <ApprovalsView persona={persona} requests={requests} history={history} todayLabel={todayLabel} />;
}
