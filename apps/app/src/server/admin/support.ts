/**
 * Admin's support reads (2026-11-09): tickets, escalations and reviews to moderate (`admin.moderation.view`),
 * and privacy requests with the compliance documents (`admin.compliance.view`). Server side only.
 */
import type { AdminCompliance, AdminModeration } from "@injishi/contracts";
import { currentApi } from "@/lib/session";

export async function moderation(): Promise<AdminModeration> {
  return (await currentApi()).get<AdminModeration>("/api/v1/admin/moderation");
}

export async function compliance(): Promise<AdminCompliance> {
  return (await currentApi()).get<AdminCompliance>("/api/v1/admin/compliance");
}
