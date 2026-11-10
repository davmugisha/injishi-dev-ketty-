import { BrokerPlanCode, BrokerPlanStatus } from "@injishi/contracts";
import { screens } from "@injishi/data";
import { EmptyBlock, PageContent, PageHeader } from "@injishi/ui";
import type { Metadata } from "next";
import { BrokerPlansView } from "@/features/admin/brokers/BrokerPlansView";
import { requirePersona } from "@/lib/session";
import { brokerPlanList, brokerSubscriptions } from "@/server/admin/brokers";
import { placeChainOf, staffAccess } from "@/server/admin/leaders";
import { idOf, one, pageOf, type Search, sinceDay, wordOf } from "@/server/admin/list";
import { ApiError } from "@/server/api";

export const metadata: Metadata = { title: screens.AdminBrokerPlans.pageTitle };

/** Broker subscriptions, read from the admin API as this staffer, one page at a time and filtered by the URL. */
export default async function AdminBrokerPlansPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePersona("AdminBrokerPlans");
  const sp = await searchParams;
  const provinceId = idOf(sp.provinceId);
  try {
    const [plans, subscriptions, access, areaChain] = await Promise.all([
      brokerPlanList(),
      brokerSubscriptions({
        q: one(sp.q)?.trim() || undefined,
        status: wordOf(sp.status, BrokerPlanStatus.options),
        plan: wordOf(sp.plan, BrokerPlanCode.options),
        provinceId,
        createdFrom: sinceDay(sp.since),
        page: pageOf(sp.page),
      }),
      staffAccess(),
      placeChainOf({ province: provinceId }),
    ]);
    return (
      <BrokerPlansView
        view="subscriptions"
        plans={plans.plans}
        subscriptions={subscriptions}
        holding={{}}
        areaChain={areaChain}
        canEdit={access.permissions.includes("admin.fee.edit")}
      />
    );
  } catch (error) {
    if (error instanceof ApiError && error.forbidden) {
      return (
        <PageContent>
          <PageHeader title="Broker plans" />
          <EmptyBlock icon="ShieldKeyhole" title="Your staff role cannot see broker plans" />
        </PageContent>
      );
    }
    throw error;
  }
}

export const dynamic = "force-dynamic";
