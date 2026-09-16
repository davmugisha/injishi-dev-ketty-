import { Cell, District, Province, Sector, Village } from "@injishi/contracts";

import { apiFetch, type ApiResult } from "@/lib/api";

/**
 * Rwandan geography for the address picker — Province → District → Sector →
 * Cell → Village (D24).
 *
 * Reference data that never changes within a session, so each level is fetched
 * once and kept. The cascade is five requests rather than one nested payload
 * because that is the shape the picker actually asks for: nobody needs all
 * 14,835 villages, they need the ones in the cell just chosen.
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
  provinceId?: number,
): Promise<GeographyList<District>> {
  // The province filter is optional on the endpoint and optional here: the
  // registration wizard narrows by province, the waitlist form offers all
  // thirty districts at once.
  const res = await apiFetch<unknown>(
    provinceId === undefined
      ? `/api/v1/geography/districts`
      : `/api/v1/geography/districts?provinceId=${provinceId}`,
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

export async function fetchCells(sectorId: number): Promise<GeographyList<Cell>> {
  const res = await apiFetch<unknown>(
    `/api/v1/geography/cells?sectorId=${sectorId}`,
  );
  return parseList(res, Cell);
}

/**
 * The villages in one cell.
 *
 * The scope is not optional here, unlike on the endpoint: the unscoped list is
 * every village in Rwanda, and no screen this app owns wants that.
 */
export async function fetchVillages(
  cellId: number,
): Promise<GeographyList<Village>> {
  const res = await apiFetch<unknown>(
    `/api/v1/geography/villages?cellId=${cellId}`,
  );
  return parseList(res, Village);
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
