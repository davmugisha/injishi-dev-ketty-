"use server";

import { geographyRequest, type PlaceLevel, type PlaceOption } from "@injishi/ui";
import { apiRequest } from "@/server/api";

const LEVELS = new Set<PlaceLevel>(["province", "district", "sector", "cell", "village"]);

/** One level's places under the one chosen above it, for `PlacePicker` (the geography lists are public). */
export async function loadPlaces(level: PlaceLevel, parentId: number | string | null): Promise<PlaceOption[]> {
  if (!LEVELS.has(level)) return [];
  const { path, query } = geographyRequest(level, parentId);
  const rows = await apiRequest<{ id: number; name: string }[]>(null, path, { query });
  return rows.map((r) => ({ id: r.id, name: r.name }));
}
