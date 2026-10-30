/** The tenant's Moving out read (WP 1.7), as the signed-in person. Server side only. */
import type { TenancyMoveOut } from "@injishi/contracts";
import { cache } from "react";
import { currentApi } from "@/lib/session";

export const tenancyMoveOut = cache(async (leaseId: string): Promise<TenancyMoveOut> => {
  const api = await currentApi();
  return api.get<TenancyMoveOut>(`/api/v1/me/tenancies/${leaseId}/move-out`);
});
