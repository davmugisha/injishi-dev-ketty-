import { District, Province, Sector } from "@injishi/contracts";

import { apiFetch, type ApiResult } from "@/lib/api";

/**
 * Rwandan geography for the address picker — Province → District → Sector (D24).
 *
 * Reference data that never changes within a session, so each level is fetched
 * once and kept. The cascade is three requests rather than one nested payload
 * because that is the shape the picker actually asks for: nobody needs all 417
 * sectors, they need the ones in the district just chosen.
 *
 * Responses are parsed against the same contracts the API validates its own
 * answers with, so a drift fails here rather than rendering a half-empty list.
 */

export type GeographyList<T> = ApiResult<T[]>;

export async function fetchProvinces(): Promise<GeographyList<Province>> {
  const res = await apiFetch<unknown>("/api/v1/geography/provinces");
  return parseList(res, Province);
}

export async function fetchDistricts(
  provinceId: number,
): Promise<GeographyList<District>> {
  const res = await apiFetch<unknown>(
    `/api/v1/geography/districts?provinceId=${provinceId}`,
  );
  return parseList(res, District);
}

export async function fetchSectors(
  districtId: number,
): Promise<GeographyList<Sector>> {
  const res = await apiFetch<unknown>(
    `/api/v1/geography/sectors?districtId=${districtId}`,
  );
  return parseList(res, Sector);
}

/**
 * Validate a list against its contract.
 *
 * A shape we cannot vouch for is reported as `failed`, not rendered partially:
 * a picker showing three of thirty districts is worse than one saying it could
 * not load, because only the second is obviously wrong.
 */
function parseList<T>(
  res: ApiResult<unknown>,
  schema: { array: () => { safeParse: (v: unknown) => { success: boolean; data?: T[] } } },
): GeographyList<T> {
  if (res.status !== "ok") return res;
  const parsed = schema.array().safeParse(res.data);
  if (!parsed.success || !parsed.data) return { status: "failed" };
  return { status: "ok", data: parsed.data };
}
