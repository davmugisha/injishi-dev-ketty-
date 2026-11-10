/**
 * Admin's platform reads (2026-11-09): system health, analytics, and the assistant's usage for a month.
 * Server side only; a refusal comes back as the API's status.
 */
import type { AdminAnalytics, AdminSystemHealth, AssistantUsageReport } from "@injishi/contracts";
import { currentApi } from "@/lib/session";

export async function systemHealth(): Promise<AdminSystemHealth> {
  return (await currentApi()).get<AdminSystemHealth>("/api/v1/admin/system-health");
}

export async function analytics(): Promise<AdminAnalytics> {
  return (await currentApi()).get<AdminAnalytics>("/api/v1/admin/analytics");
}

export async function assistantUsage(month?: string): Promise<AssistantUsageReport> {
  return (await currentApi()).get<AssistantUsageReport>("/api/v1/admin/assistant/usage", {
    query: month ? { month } : {},
  });
}
