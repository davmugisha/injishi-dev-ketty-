import { District, GovernmentBody, Province } from "@injishi/contracts";

import { apiGet, type ApiResult } from "./server";

/**
 * The government body catalogue and the regions an officer can cover (ADR-053,
 * AC-G4) — `GET /api/v1/admin/government-bodies` and the public geography reads.
 *
 * The catalogue read is `admin.config.view`, which every staff role holds, so
 * finance and compliance read the list they cannot change. Retired bodies come
 * back too: an existing appointment still names one, and the catalogue is where
 * a staffer learns why a body is no longer offered.
 */

const GovernmentBodyList = GovernmentBody.array();
const ProvinceList = Province.array();
const DistrictList = District.array();

/** Every body, live and retired. P: `admin.config.view`. */
export function listGovernmentBodies(): Promise<ApiResult<GovernmentBody[]>> {
  return apiGet("/api/v1/admin/government-bodies", GovernmentBodyList);
}

/** The five provinces. Public: the regions are not a secret. */
export function listProvinces(): Promise<ApiResult<Province[]>> {
  return apiGet("/api/v1/geography/provinces", ProvinceList);
}

/** Every district, each naming its province, in one read. Public. */
export function listDistricts(): Promise<ApiResult<District[]>> {
  return apiGet("/api/v1/geography/districts", DistrictList);
}
