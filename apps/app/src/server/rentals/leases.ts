/**
 * The landlord's lease reads (WP 2.4): the lease list by tab, the counts, one lease with its timeline,
 * its contract, the rent on it, the tenants to pick from, and the landlord's own guests. Typed calls over
 * the API client in the residence business this request acts in (`landlordScope`), each cached for the
 * request. Server side only.
 */
import type {
  GuestRelationship,
  HostGuestTab,
  LandlordGuestList,
  LeaseChargeList,
  LeaseContractView,
  LeaseCounts,
  LeaseDetail,
  LeaseEventList,
  LeaseListPage,
  LeasePaymentList,
  LeaseTab,
  TenantList,
} from "@injishi/contracts";
import { cache } from "react";
import { apiRequest } from "../api";
import { landlordScope, NoRentalsBusinessError } from "./client";

async function get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
  const s = await landlordScope();
  if (!s) throw new NoRentalsBusinessError();
  return s.api.get<T>(path, { workspaceId: s.workspace.workspaceId, query });
}

export const leaseList = cache((tab?: LeaseTab, q?: string, page?: number) =>
  get<LeaseListPage>("/api/v1/ops/leases", { tab, q: q || undefined, page: page && page > 1 ? page : undefined }),
);
export const leaseCounts = cache(() => get<LeaseCounts>("/api/v1/ops/leases/counts"));
export const leaseDetail = cache((id: string) => get<LeaseDetail>(`/api/v1/ops/leases/${id}`));
export const leaseEvents = cache((id: string) => get<LeaseEventList>(`/api/v1/ops/leases/${id}/events`));
export const leaseContract = cache((id: string) => get<LeaseContractView>(`/api/v1/ops/leases/${id}/contract`));
/** The rent on one lease: every charge raised, and every payment, newest first. */
export const leaseCharges = cache((leaseId: string) => get<LeaseChargeList>("/api/v1/ops/rent/charges", { leaseId }));
export const leasePayments = cache((leaseId: string) =>
  get<LeasePaymentList>("/api/v1/ops/rent/payments", { leaseId }),
);
/** The business's tenants, by name or email. */
export const tenantSearch = cache((q?: string) => get<TenantList>("/api/v1/ops/tenants", { q: q || undefined }));
/** The landlord's own guests (never a tenant's), with the buildings a new one can stay at. */
export const landlordGuests = cache((tab?: HostGuestTab) => get<LandlordGuestList>("/api/v1/ops/guests", { tab }));
/** Who a guest can be to the host: public reference data, the same list for every form. */
export const guestRelationships = cache(() =>
  apiRequest<GuestRelationship[]>(null, "/api/v1/reference/guest-relationships"),
);
