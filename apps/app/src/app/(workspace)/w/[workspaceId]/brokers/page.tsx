import type { BrokerDealList } from "@injishi/contracts";
import { EmptyBlock, PageContent, PageHeader } from "@injishi/ui";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BrokerDealsView } from "@/features/owner/broker-deals-view";
import { currentAccount } from "@/lib/session";
import { can, hostScope, orNull } from "@/server/rentals/client";

export const metadata: Metadata = { title: "Brokers" };

/**
 * Brokers, for a hotel (0124, 2026-11-02): the commission deals brokers propose, answered by whoever holds
 * `payout.manage` (the owner, by default), because a deal decides what the hotel is paid for the stays a
 * broker brings.
 */
export default async function BrokersPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  if (!(await currentAccount())) redirect(`/sign-in?next=${encodeURIComponent(`/w/${workspaceId}/brokers`)}`);
  const scope = await hostScope(workspaceId);
  if (!scope) notFound();
  const allowed = can(scope, "payout.manage");
  const data = allowed
    ? await orNull(scope.api.get<BrokerDealList>("/api/v1/ops/broker-deals", { workspaceId }))
    : null;
  return (
    <PageContent>
      <PageHeader
        eyebrow={`${scope.workspace.orgName ?? scope.workspace.label} · Brokers`}
        title="Brokers"
        description="Brokers bring you bookings for a commission you agree with them. Accept a deal, and the commission comes off what you are paid for each stay they bring, once the guest checks out."
      />
      <div className="flex max-w-[960px] flex-col gap-5">
        {data ? (
          <BrokerDealsView workspaceId={workspaceId} data={data} />
        ) : (
          <EmptyBlock
            icon="Briefcase"
            title="Only the owner answers brokers"
            description="Broker deals change what the business is paid, so they need the right to manage payouts."
          />
        )}
      </div>
    </PageContent>
  );
}

export const dynamic = "force-dynamic";
