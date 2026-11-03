import { screens } from "@injishi/data";
import { EmptyBlock, PageContent, PageHeader } from "@injishi/ui";
import type { Metadata } from "next";
import { BrokerPlansView } from "@/features/admin/brokers/BrokerPlansView";
import { requirePersona } from "@/lib/session";
import { brokerPlanList, brokerSubscriptions } from "@/server/admin/brokers";
import { staffAccess } from "@/server/admin/leaders";
import { ApiError } from "@/server/api";

export const metadata: Metadata = { title: screens.AdminBrokerPlans.pageTitle };

/** Broker plan prices and subscriptions, read from the admin API as this staffer. */
export default async function AdminBrokerPlansPage() {
  await requirePersona("AdminBrokerPlans");
  try {
    const [plans, subscriptions, access] = await Promise.all([brokerPlanList(), brokerSubscriptions(), staffAccess()]);
    return (
      <BrokerPlansView
        view="subscriptions"
        plans={plans.plans}
        subscriptions={subscriptions.items}
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
