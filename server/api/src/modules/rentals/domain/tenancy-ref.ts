/**
 * A lease the caller holds as its tenant, as the tenancy guard resolved it.
 *
 * Its own file so a service that only takes one (`LeaseBrokersService`) does
 * not import `TenanciesService`, which injects it: that pair was an import
 * cycle the API's ratchet refuses. `tenancies.service.ts` re-exports it.
 */
export interface TenancyRef {
  leaseId: string;
  tenantId: string;
  userId: string;
  workspaceId: string;
}
