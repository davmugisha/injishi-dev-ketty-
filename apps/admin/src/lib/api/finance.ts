import {
  AdminFailedChargeResponse,
  AdminLedgerResponse,
  AdminPayoutResponse,
  AdminReconRunResponse,
  type AdminPayoutQuery,
} from "@injishi/contracts";

import { apiGet, type ApiResult, type PageQuery } from "./server";

/**
 * Finance (F-A06) — `GET /api/v1/admin/finance/**`.
 *
 * All four routes are P: `admin.finance.view`. Every amount crosses as an
 * integer number of francs plus a currency tag, never a formatted string,
 * because "RWF 45,000" cannot be summed, sorted or compared — the console
 * formats it in `lib/present/finance.ts` and nowhere else.
 *
 * Every ledger row also carries the `adapterMode` it was written under. A
 * console that shows mock money next to live money without saying which is
 * which is worse than one that shows neither.
 */

const BASE = "/api/v1/admin/finance";

/** The double-entry ledger. */
export function listLedger(
  query: PageQuery = {},
): Promise<ApiResult<AdminLedgerResponse>> {
  return apiGet(`${BASE}/ledger`, AdminLedgerResponse, {
    page: query.page,
    pageSize: query.pageSize,
  });
}

/** Payouts, optionally narrowed to one status (`held` is the one people open this for). */
export function listPayouts(
  query: AdminPayoutQuery = {},
): Promise<ApiResult<AdminPayoutResponse>> {
  return apiGet(`${BASE}/payouts`, AdminPayoutResponse, {
    status: query.status,
    page: query.page,
    pageSize: query.pageSize,
  });
}

/** Subscription invoices that failed to charge. */
export function listFailedCharges(
  query: PageQuery = {},
): Promise<ApiResult<AdminFailedChargeResponse>> {
  return apiGet(`${BASE}/failed-charges`, AdminFailedChargeResponse, {
    page: query.page,
    pageSize: query.pageSize,
  });
}

/** Reconciliation runs, and how many entries each one could not match. */
export function listReconRuns(
  query: PageQuery = {},
): Promise<ApiResult<AdminReconRunResponse>> {
  return apiGet(`${BASE}/reconciliation-runs`, AdminReconRunResponse, {
    page: query.page,
    pageSize: query.pageSize,
  });
}
