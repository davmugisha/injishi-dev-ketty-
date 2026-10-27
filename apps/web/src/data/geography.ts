import { Cell, District, Province, Sector, Village } from "@injishi/contracts";

import { apiFetch, type ApiResult } from "@/lib/api";

/**
 * Rwandan geography for the address picker — Province → District → Sector →
 * Cell → Village (D24).
 *
 * Reference data that never changes within a session, so each level is fetched
 * once and kept (`kept`, below): a picker opened again, or a registration
 * carried on with no connection (ADR-075 S9), lists what it already listed. The
 * cascade is five requests rather than one nested payload because that is the
 * shape the picker actually asks for: nobody needs all 14,835 villages, they
 * need the ones in the cell just chosen.
 *
 * Responses are parsed against the same contracts the API validates its own
 * answers with, so a drift fails here rather than rendering a half-empty list.
 */

export type GeographyList<T> = ApiResult<T[]>;

export function fetchProvinces(): Promise<GeographyList<Province>> {
  return list("/api/v1/geography/provinces", Province);
}

export function fetchDistricts(provinceId?: number): Promise<GeographyList<District>> {
  // The province filter is optional on the endpoint and optional here; the
  // registration wizard always narrows by province.
  return list(
    provinceId === undefined ? `/api/v1/geography/districts` : `/api/v1/geography/districts?provinceId=${provinceId}`,
    District,
  );
}

export function fetchSectors(districtId: number): Promise<GeographyList<Sector>> {
  return list(`/api/v1/geography/sectors?districtId=${districtId}`, Sector);
}

export function fetchCells(sectorId: number): Promise<GeographyList<Cell>> {
  return list(`/api/v1/geography/cells?sectorId=${sectorId}`, Cell);
}

/**
 * The villages in one cell.
 *
 * The scope is not optional here, unlike on the endpoint: the unscoped list is
 * every village in Rwanda, and no screen this app owns wants that.
 */
export function fetchVillages(cellId: number): Promise<GeographyList<Village>> {
  return list(`/api/v1/geography/villages?cellId=${cellId}`, Village);
}

/** Every list that came back whole, by its path, for the rest of the page's life. A failure is never kept. */
const kept = new Map<string, unknown[]>();

async function list<T>(
  path: string,
  schema: { array: () => { safeParse: (v: unknown) => { success: boolean; data?: T[] } } },
): Promise<GeographyList<T>> {
  const known = kept.get(path);
  if (known) return { status: "ok", data: known as T[] };
  const res = await apiFetch<unknown>(path);
  const parsed = parseList(res, schema);
  if (parsed.status === "ok") kept.set(path, parsed.data);
  return parsed;
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
