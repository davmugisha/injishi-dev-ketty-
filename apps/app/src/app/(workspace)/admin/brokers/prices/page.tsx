import { screens } from "@injishi/data";
import { EmptyBlock, PageContent, PageHeader } from "@injishi/ui";
import type { Metadata } from "next";
import { BrokerPlansView } from "@/features/admin/brokers/BrokerPlansView";
import { requirePersona } from "@/lib/session";
import { brokerPlanList, brokersPerPlan } from "@/server/admin/brokers";
import { staffAccess } from "@/server/admin/leaders";
import { ApiError } from "@/server/api";

export const metadata: Metadata = { title: screens.AdminBrokerPrices.pageTitle };

/** Broker plan prices, read from the admin API as this staffer. */
export default async function AdminBrokerPricesPage() {
  await requirePersona("AdminBrokerPrices");
  try {
    const [plans, access] = await Promise.all([brokerPlanList(), staffAccess()]);
    const holding = await brokersPerPlan(plans.plans.map((p) => p.code));
    return (
      <BrokerPlansView
        view="prices"
        plans={plans.plans}
        subscriptions={null}
        holding={holding}
        areaChain={{}}
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
