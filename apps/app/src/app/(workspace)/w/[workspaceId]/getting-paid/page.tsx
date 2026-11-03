import { type PayoutAccountList, type PayoutList, TOURISM_TAX_LABEL, tourismTaxIncludedRwf } from "@injishi/contracts";
import { KpiStrip, PageContent, PageHeader } from "@injishi/ui";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PayoutsView } from "@/features/rentals/PayoutsView";
import { PayoutAccounts } from "@/features/rentals/settings/PayoutAccounts";
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
  if (!(await currentAccount())) redirect(`/sign-in?next=${encodeURIComponent(`/w/${workspaceId}/getting-paid`)}`);
  const scope = await hostScope(workspaceId);
  if (!scope) notFound();
  const api = { workspaceId };
  const [accounts, payouts] = await Promise.all([
    orNull(scope.api.get<PayoutAccountList>("/api/v1/ops/payout-accounts", api)),
    can(scope, "money.view", "payout.manage") ? orNull(scope.api.get<PayoutList>("/api/v1/ops/payouts", api)) : null,
  ]);
  const manage = can(scope, "payout.manage");
  // What guests paid includes Rwanda's 3% tourism tax (2026-10-30): the business passes it on, so the
  // owner sees it apart from the room revenue that is theirs. Worked out per booking, as each was paid.
  const bookings = (payouts?.payouts ?? []).filter((p) => p.bookingReference);
  const bookingMoney = bookings.reduce((n, p) => n + p.amountRwf, 0);
  const tourismTax = bookings.reduce((n, p) => n + tourismTaxIncludedRwf(p.amountRwf), 0);
  return (
    <PageContent>
      <PageHeader
        eyebrow={`${scope.workspace.orgName ?? scope.workspace.label} · Getting paid`}
        title="Getting paid"
        description="Guests pay through Injishi when they book, and the money is held until they check out. Then it is sent to your primary payout account, in full: Injishi takes no commission."
      />
      <div className="flex max-w-[860px] flex-col gap-5">
        {payouts && bookings.length > 0 ? (
          <KpiStrip
            label="Booking money so far"
            items={[
              {
                id: "money",
                label: "Paid by guests",
                value: bookingMoney,
                format: "money",
                icon: "Wallet",
                footnote: `${bookings.length} ${bookings.length === 1 ? "booking" : "bookings"}`,
              },
              {
                id: "tax",
                label: TOURISM_TAX_LABEL,
                value: tourismTax,
                format: "money",
                icon: "Receipt",
                footnote: "Included in what guests paid · pass it on to RDB",
              },
              {
                id: "revenue",
                label: "Your room revenue",
                value: bookingMoney - tourismTax,
                format: "money",
                icon: "ChartColumn",
                footnote: "What guests paid, less the tourism tax",
              },
            ]}
          />
        ) : null}
        <PayoutAccounts accounts={accounts?.accounts ?? null} canManage={manage} business={{ host: workspaceId }} />
        <PayoutsView list={payouts} canRetry={manage} business={{ host: workspaceId }} embedded />
      </div>
    </PageContent>
  );
}
