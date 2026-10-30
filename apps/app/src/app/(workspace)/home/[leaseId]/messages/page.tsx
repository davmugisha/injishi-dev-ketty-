import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TenantMessagesView } from "@/features/messages/TenantMessagesView";
import { currentAccount, requirePersona } from "@/lib/session";
import { tenantThread } from "@/server/messages";
import { isLeaseId, mineOrNull } from "@/server/tenant/tenancies";

export const metadata: Metadata = { title: screens.TenantMessages.pageTitle };

/** The tenant's conversation with their landlord about one home. */
export default async function TenancyMessagesPage({ params }: { params: Promise<{ leaseId: string }> }) {
  await requirePersona("TenantMessages");
  const { leaseId } = await params;
  if (!isLeaseId(leaseId)) notFound();
  const [thread, account] = await Promise.all([mineOrNull(tenantThread(leaseId)), currentAccount()]);
  if (!thread) notFound();
  return <TenantMessagesView thread={thread} selfName={account?.user.name ?? null} />;
}

export const dynamic = "force-dynamic";
