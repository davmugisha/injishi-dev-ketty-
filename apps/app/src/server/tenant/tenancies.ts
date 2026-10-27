/**
 * The tenant's reads (P3): their tenancies, one tenancy with its contract, timeline, charges, payments and
 * guests, and an invitation's public preview. A tenancy belongs to the person, not to a workspace: every
 * call is as the signed-in person, and the API answers 404 for a lease that is not theirs. Server side only.
 */
import type {
  HostGuestTab,
  LeaseContractView,
  LeaseEventList,
  LeaseInvitationPreview,
  TenancyDetail,
  TenancyList,
  TenantChargeList,
  TenantGuestList,
  TenantPaymentList,
} from "@injishi/contracts";
import { cache } from "react";
import { currentApi } from "@/lib/session";
import { ApiError, apiRequest } from "../api";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isLeaseId(value: string | undefined): value is string {
  return typeof value === "string" && UUID.test(value);
}

async function get<T>(path: string, query?: Record<string, string | undefined>): Promise<T> {
  const api = await currentApi();
  return api.get<T>(path, { query });
}

/** A lease that is not this person's (404) comes back null; anything else throws. */
export async function mineOrNull<T>(read: Promise<T>): Promise<T | null> {
  try {
    return await read;
  } catch (error) {
    if (error instanceof ApiError && error.notFound) return null;
    throw error;
  }
}

export const tenancyList = cache(() => get<TenancyList>("/api/v1/me/tenancies"));
export const tenancyDetail = cache((leaseId: string) => get<TenancyDetail>(`/api/v1/me/tenancies/${leaseId}`));
export const tenancyEvents = cache((leaseId: string) => get<LeaseEventList>(`/api/v1/me/tenancies/${leaseId}/events`));
export const tenancyContract = cache((leaseId: string) =>
  get<LeaseContractView>(`/api/v1/me/tenancies/${leaseId}/contract`),
);
export const tenancyCharges = cache((leaseId: string) =>
  get<TenantChargeList>(`/api/v1/me/tenancies/${leaseId}/charges`),
);
export const tenancyPayments = cache((leaseId: string) =>
  get<TenantPaymentList>(`/api/v1/me/tenancies/${leaseId}/payments`),
);
export const tenantGuests = cache((leaseId: string, tab?: HostGuestTab) =>
  get<TenantGuestList>(`/api/v1/me/tenancies/${leaseId}/guests`, { tab }),
);

/** The public preview of an invitation link, or null when the link is not one the API knows. */
export const invitationPreview = cache(async (token: string): Promise<LeaseInvitationPreview | null> => {
  try {
    return await apiRequest<LeaseInvitationPreview>(null, `/api/v1/lease-invitations/${encodeURIComponent(token)}`);
  } catch (error) {
    if (error instanceof ApiError && (error.notFound || error.status === 400)) return null;
    throw error;
  }
});
