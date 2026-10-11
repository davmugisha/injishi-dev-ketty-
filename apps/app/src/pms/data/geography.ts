/**
 * Rwandan geography for the operator property create form — Province → District
 * → Sector (D24). Same cascade the registration wizard uses; a separate client
 * so the operator app does not import web's data layer. A staff file's home
 * address goes two steps further, to the cell and the village (058-people-file).
 */

import { Cell, District, Province, Sector, Village } from "@injishi/contracts";

import { API_BASE, ApiError, REQUEST_TIMEOUT_MS } from "./api";

async function readList<T>(
  path: string,
  parse: (row: unknown) => T,
): Promise<T[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/api/v1${path}`, {
      credentials: "include",
      signal: controller.signal,
    });
    if (!res.ok) throw new ApiError(res.status, "We couldn't load that list.");
    const body = (await res.json()) as unknown;
    if (!Array.isArray(body)) {
      throw new ApiError(500, "Geography answer was not a list.");
    }
    return body.map(parse);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, "We couldn't reach the server. Try again.");
  } finally {
    clearTimeout(timer);
  }
}

export function fetchProvinces(): Promise<Province[]> {
  return readList("/geography/provinces", (row) => Province.parse(row));
}

export function fetchDistricts(provinceId: number): Promise<District[]> {
  return readList(
    `/geography/districts?provinceId=${provinceId}`,
    (row) => District.parse(row),
  );
}

export function fetchSectors(districtId: number): Promise<Sector[]> {
  return readList(
    `/geography/sectors?districtId=${districtId}`,
    (row) => Sector.parse(row),
  );
}

export function fetchCells(sectorId: number): Promise<Cell[]> {
  return readList(`/geography/cells?sectorId=${sectorId}`, (row) => Cell.parse(row));
}

export function fetchVillages(cellId: number): Promise<Village[]> {
  return readList(`/geography/villages?cellId=${cellId}`, (row) => Village.parse(row));
}
