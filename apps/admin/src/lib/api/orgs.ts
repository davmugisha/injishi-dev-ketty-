import {
  AdminOboAuditResponse,
  AdminOboListResponse,
  AdminOrgDetail,
  AdminOrgListResponse,
  AdminOrgMoney,
  AdminOrgPeopleResponse,
  AdminOrgPropertiesResponse,
  AdminOrgReviewQueueResponse,
  AdminOrgSubscription,
  AdminOrgTimelineResponse,
  type AdminOrgListQuery,
} from "@injishi/contracts";

import { apiGet, type ApiResult, type PageQuery } from "./server";

/**
 * Businesses (F-A03) — `GET /api/v1/admin/orgs/**`.
 *
 * Two of these routes return identity data and therefore take a `reason`. It is
 * a REQUIRED ARGUMENT rather than a defaulted one on purpose: the route writes
 * a `record_access_logs` row naming the actor, the subject and that reason, and
 * a default buried in this file would make every such row say the same
 * sentence — which is the same as the log saying nothing. The caller states a
 * purpose because the caller is the only one who knows it.
 */

const BASE = "/api/v1/admin/orgs";

/** The business directory. P: `admin.business.view`. */
export function listOrgs(
  query: AdminOrgListQuery = {},
): Promise<ApiResult<AdminOrgListResponse>> {
  return apiGet(`${BASE}`, AdminOrgListResponse, {
    q: query.q,
    districtId: query.districtId,
    domain: query.domain,
    registrationStatus: query.registrationStatus,
    page: query.page,
    pageSize: query.pageSize,
  });
}

/**
 * The registration review queue. P: `admin.business.review`.
 *
 * A separate permission from `admin.business.view` because looking at the
 * directory and standing in the pipeline that admits businesses to it are two
 * different powers (D20, D23).
 */
export function listOrgReviewQueue(
  query: PageQuery = {},
): Promise<ApiResult<AdminOrgReviewQueueResponse>> {
  return apiGet(`${BASE}/review-queue`, AdminOrgReviewQueueResponse, {
    page: query.page,
    pageSize: query.pageSize,
  });
}

/**
 * On-behalf-of registrations. P: `admin.business.view`. PII: reason required.
 *
 * The intended-owner name and email are another person's identity data, which
 * is what makes this row loggable and this argument mandatory.
 */
export function listObo(
  reason: string,
  query: PageQuery = {},
): Promise<ApiResult<AdminOboListResponse>> {
  return apiGet(`${BASE}/obo`, AdminOboListResponse, {
    reason,
    page: query.page,
    pageSize: query.pageSize,
  });
}

/** One business record. P: `admin.business.view`. */
export function getOrg(orgId: string): Promise<ApiResult<AdminOrgDetail>> {
  return apiGet(`${BASE}/${orgId}`, AdminOrgDetail);
}

/** Who holds a role in this workspace. P: `admin.business.view`. PII: reason required. */
export function getOrgPeople(
  orgId: string,
  reason: string,
): Promise<ApiResult<AdminOrgPeopleResponse>> {
  return apiGet(`${BASE}/${orgId}/people`, AdminOrgPeopleResponse, { reason });
}

/** The properties this business operates. P: `admin.business.view`. */
export function getOrgProperties(
  orgId: string,
): Promise<ApiResult<AdminOrgPropertiesResponse>> {
  return apiGet(`${BASE}/${orgId}/properties`, AdminOrgPropertiesResponse);
}

/**
 * Subscription and its invoices. P: `admin.finance.view`.
 *
 * Note the permission: this hangs off a business record but it is money, so it
 * is gated as money. An ops staffer who may read the record may not read this.
 */
export function getOrgSubscription(
  orgId: string,
): Promise<ApiResult<AdminOrgSubscription>> {
  return apiGet(`${BASE}/${orgId}/subscription`, AdminOrgSubscription);
}

/** Registration fee, invoices, payouts and ledger for one business. P: `admin.finance.view`. */
export function getOrgMoney(orgId: string): Promise<ApiResult<AdminOrgMoney>> {
  return apiGet(`${BASE}/${orgId}/money`, AdminOrgMoney);
}

/** Everything that happened to this business. P: `admin.business.view`. */
export function getOrgTimeline(
  orgId: string,
  query: PageQuery = {},
): Promise<ApiResult<AdminOrgTimelineResponse>> {
  return apiGet(`${BASE}/${orgId}/timeline`, AdminOrgTimelineResponse, {
    page: query.page,
    pageSize: query.pageSize,
  });
}

/**
 * The OBO paper trail. P: `admin.audit.read`.
 *
 * Events AND the access logs of who read the intended owner's details, in one
 * answer, because "who looked" is half of what an OBO audit is for.
 */
export function getOboAudit(
  orgId: string,
): Promise<ApiResult<AdminOboAuditResponse>> {
  return apiGet(`${BASE}/${orgId}/obo-audit`, AdminOboAuditResponse);
}
