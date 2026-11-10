/**
 * Admin's reads for broker plans: the three plans with their prices, and every broker's subscription.
 * `StaffGuard` decides (`admin.broker.view`); a refusal comes back as the API's status. Server side only.
 */
import type {
  AdminBrokerPlanList,
  AdminBrokerSubscriptionList,
  AdminBrokerSubscriptionQuery,
  BrokerPlanCode,
} from "@injishi/contracts";
import { currentApi } from "@/lib/session";

export async function brokerPlanList(): Promise<AdminBrokerPlanList> {
  const api = await currentApi();
  return api.get<AdminBrokerPlanList>("/api/v1/admin/brokers/plans");
}

/** One page of broker subscriptions, filtered (`GET /admin/brokers/subscriptions`). */
export async function brokerSubscriptions(query: AdminBrokerSubscriptionQuery): Promise<AdminBrokerSubscriptionList> {
  const api = await currentApi();
  const clean = Object.fromEntries(
    Object.entries({ pageSize: 25, ...query }).filter(([, v]) => v !== undefined && v !== ""),
  ) as Record<string, string | number>;
  return api.get<AdminBrokerSubscriptionList>("/api/v1/admin/brokers/subscriptions", { query: clean });
}

/** Brokers on each plan now (active or in grace), counted by the server. */
export async function brokersPerPlan(
  codes: readonly BrokerPlanCode[],
): Promise<Partial<Record<BrokerPlanCode, number>>> {
  const lists = await Promise.all(codes.map((plan) => brokerSubscriptions({ plan, pageSize: 1 })));
  return Object.fromEntries(
    codes.map((c, i) => [c, (lists[i]?.statusCounts?.active ?? 0) + (lists[i]?.statusCounts?.past_due ?? 0)]),
  );
}
