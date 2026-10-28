/**
 * Admin's reads for broker plans: the three plans with their prices, and every broker's subscription.
 * `StaffGuard` decides (`admin.broker.view`); a refusal comes back as the API's status. Server side only.
 */
import type { AdminBrokerPlanList, AdminBrokerSubscriptionList } from "@injishi/contracts";
import { currentApi } from "@/lib/session";

export async function brokerPlanList(): Promise<AdminBrokerPlanList> {
  const api = await currentApi();
  return api.get<AdminBrokerPlanList>("/api/v1/admin/brokers/plans");
}

export async function brokerSubscriptions(page = 1, pageSize = 100): Promise<AdminBrokerSubscriptionList> {
  const api = await currentApi();
  return api.get<AdminBrokerSubscriptionList>("/api/v1/admin/brokers/subscriptions", {
    query: { page: String(page), pageSize: String(pageSize) },
  });
}
