/**
 * The tenant's faults (P4): their list on one lease and one fault in full. Every call is as the
 * signed-in person; the API answers 404 for a lease or a fault that is not theirs. Server side only.
 */
import type { TenantFaultDetail, TenantFaultList } from "@injishi/contracts";
import { cache } from "react";
import { currentApi } from "@/lib/session";

export const tenantFaults = cache(async (leaseId: string) =>
  (await currentApi()).get<TenantFaultList>(`/api/v1/me/tenancies/${leaseId}/faults`),
);
export const tenantFault = cache(async (leaseId: string, id: string) =>
  (await currentApi()).get<TenantFaultDetail>(`/api/v1/me/tenancies/${leaseId}/faults/${id}`),
);
