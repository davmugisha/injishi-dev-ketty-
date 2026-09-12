import { AdminConfiguration, AdminFeeSchedule } from "@injishi/contracts";

import { apiGet, type ApiResult } from "./server";

/**
 * Configuration (F-A07) — `GET /api/v1/admin/configuration/**`.
 *
 * Two different permissions, deliberately: `admin.config.edit` reads the
 * versioned config entries and feature flags, `admin.fee.edit` reads the money
 * schedule. Changing what a registration costs is not the same power as
 * flipping a flag, so the console must not offer them together.
 *
 * Both are READ routes gated behind an `.edit` permission. That is the
 * contract's choice, not a slip: a config entry carries `lockedOnUse` and
 * `reversible`, and knowing which levers are already welded shut is itself
 * operational knowledge.
 */

const BASE = "/api/v1/admin/configuration";

/** Versioned config entries and feature flags. P: `admin.config.edit`. */
export function getConfiguration(): Promise<ApiResult<AdminConfiguration>> {
  return apiGet(BASE, AdminConfiguration);
}

/** Registration fees, subscription plans and the placement-fee totals. P: `admin.fee.edit`. */
export function getFeeSchedule(): Promise<ApiResult<AdminFeeSchedule>> {
  return apiGet(`${BASE}/fees`, AdminFeeSchedule);
}
