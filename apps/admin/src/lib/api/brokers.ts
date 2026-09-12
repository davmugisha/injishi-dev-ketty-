import {
  AdminBrokerListResponse,
  AdminRevealListResponse,
} from "@injishi/contracts";

import { apiGet, type ApiResult, type PageQuery } from "./server";

/**
 * Brokers (F-A05) — `GET /api/v1/admin/brokers/**`.
 *
 * P: `admin.broker.view` on both routes. Broker phone numbers arrive masked,
 * like every other contact detail this console shows.
 */

const BASE = "/api/v1/admin/brokers";

/** The broker roster with reveal, placement and fee totals. */
export function listBrokers(
  query: PageQuery = {},
): Promise<ApiResult<AdminBrokerListResponse>> {
  return apiGet(BASE, AdminBrokerListResponse, {
    page: query.page,
    pageSize: query.pageSize,
  });
}

/**
 * The reveal log — who unlocked which landlord, and when.
 *
 * The reason it is a screen at all: a broker who reveals far more than they
 * place is either wasting credits or harvesting contacts, and only the sequence
 * of reveals shows which.
 */
export function listReveals(
  query: PageQuery = {},
): Promise<ApiResult<AdminRevealListResponse>> {
  return apiGet(`${BASE}/reveals`, AdminRevealListResponse, {
    page: query.page,
    pageSize: query.pageSize,
  });
}
