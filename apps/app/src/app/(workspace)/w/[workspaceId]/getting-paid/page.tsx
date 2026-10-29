import type { PayoutAccountList, PayoutList } from "@injishi/contracts";
import { PageContent, PageHeader } from "@injishi/ui";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PayoutAccounts } from "@/features/rentals/settings/PayoutAccounts";
import { Payouts } from "@/features/rentals/settings/Payouts";
import { currentAccount } from "@/lib/session";
import { can, hostScope, orNull } from "@/server/rentals/client";

export const metadata: Metadata = { title: "Getting paid" };

/**
 * Getting paid, for a hotel, lodge, venue or any hospitality business (0116): where its booking money goes, and
 * every payout so far. When a guest checks out, what they paid is released from escrow and sent to the primary
 * payout account; with none, it is held until one is added. The account form and the payout list are the
 * landlord's own, scoped to this business.
 */
export default async function GettingPaidPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  if (!(await currentAccount()))
    redirect(`/sign-in?next=${encodeURIComponent(`/w/${workspaceId}/getting-paid`)}`);
  const scope = await hostScope(workspaceId);
  if (!scope) notFound();
  const api = { workspaceId };
  const [accounts, payouts] = await Promise.all([
    orNull(scope.api.get<PayoutAccountList>("/api/v1/ops/payout-accounts", api)),
    can(scope, "money.view", "payout.manage") ? orNull(scope.api.get<PayoutList>("/api/v1/ops/payouts", api)) : null,
  ]);
  const manage = can(scope, "payout.manage");
  return (
    <PageContent>
      <PageHeader
        eyebrow={`${scope.workspace.orgName ?? scope.workspace.label} · Getting paid`}
        title="Getting paid"
        description="Guests pay through Injishi when they book, and the money is held until they check out. Then it is sent to your primary payout account, in full: Injishi takes no commission."
      />
      <div className="flex max-w-[860px] flex-col gap-5">
        <PayoutAccounts accounts={accounts?.accounts ?? null} canManage={manage} business={{ host: workspaceId }} />
        <Payouts list={payouts} canRetry={manage} business={{ host: workspaceId }} />
      </div>
    </PageContent>
  );
}
