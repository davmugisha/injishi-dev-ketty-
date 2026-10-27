/**
 * Rwanda's places for `PlacePicker`: Province, District, Sector, Cell, Village, each narrowed by the one
 * above. Plain functions, checked by `tests/place.test.ts`.
 *
 * The lists come from the API's geography endpoints (`server/api/src/api/public/geography`), public and
 * read only. `geographyRequest(level, parentId)` gives the path and query to call for a level:
 *
 * | Level    | GET                              | Query        | Each row                         |
 * |----------|----------------------------------|--------------|----------------------------------|
 * | province | `/api/v1/geography/provinces`    |              | `{ id, name }`                   |
 * | district | `/api/v1/geography/districts`    | `provinceId` | `{ id, name, provinceId }`       |
 * | sector   | `/api/v1/geography/sectors`      | `districtId` | `{ id, name, districtId }`       |
 * | cell     | `/api/v1/geography/cells`        | `sectorId`   | `{ id, name, sectorId }`         |
 * | village  | `/api/v1/geography/villages`     | `cellId`     | `{ id, name, cellId }`           |
 *
 * Ids are integers. The rows can be handed to the picker as they come (it reads `id` and `name`).
 */

export const PLACE_LEVELS = ["province", "district", "sector", "cell", "village"] as const;
export type PlaceLevel = (typeof PLACE_LEVELS)[number];

export const PLACE_LEVEL_LABEL: Record<PlaceLevel, string> = {
  province: "Province",
  district: "District",
  sector: "Sector",
  cell: "Cell",
  village: "Village",
};

/** One place in a list: what the geography endpoints return (extra fields are ignored). */
export interface PlaceOption {
  id: number | string;
  name: string;
}

/** The places chosen so far, from the province down. A level below an empty one is always empty. */
export type PlaceChain = { [L in PlaceLevel]?: PlaceOption | null };

export const GEOGRAPHY_ENDPOINTS: Record<PlaceLevel, { path: string; parentParam: string | null }> = {
  province: { path: "/api/v1/geography/provinces", parentParam: null },
  district: { path: "/api/v1/geography/districts", parentParam: "provinceId" },
  sector: { path: "/api/v1/geography/sectors", parentParam: "districtId" },
  cell: { path: "/api/v1/geography/cells", parentParam: "sectorId" },
  village: { path: "/api/v1/geography/villages", parentParam: "cellId" },
};

/** The request that lists a level's places under `parentId` (none for provinces). */
export function geographyRequest(
  level: PlaceLevel,
  parentId: number | string | null,
): { path: string; query: Record<string, string | number> } {
  const { path, parentParam } = GEOGRAPHY_ENDPOINTS[level];
  return { path, query: parentParam && parentId != null ? { [parentParam]: parentId } : {} };
}

/** The levels a picker shows, down to `depth`. */
export function levelsTo(depth: PlaceLevel): PlaceLevel[] {
  return PLACE_LEVELS.slice(0, PLACE_LEVELS.indexOf(depth) + 1);
}

/** The level above (null for province). */
export function parentLevel(level: PlaceLevel): PlaceLevel | null {
  const i = PLACE_LEVELS.indexOf(level);
  return i > 0 ? PLACE_LEVELS[i - 1] : null;
}

/** Choose a place at one level: every level below it is cleared, so the parts never disagree. */
export function choosePlace(chain: PlaceChain, level: PlaceLevel, option: PlaceOption | null): PlaceChain {
  const i = PLACE_LEVELS.indexOf(level);
  const next: PlaceChain = {};
  for (const l of PLACE_LEVELS.slice(0, i)) next[l] = chain[l] ?? null;
  next[level] = option;
  for (const l of PLACE_LEVELS.slice(i + 1)) next[l] = null;
  return next;
}

/** Whether a level can be chosen yet: the province always, any other once the level above is. */
export function isLevelOpen(chain: PlaceChain, level: PlaceLevel): boolean {
  const parent = parentLevel(level);
  return parent === null || Boolean(chain[parent]);
}

/** The id the level's list is narrowed by (the chosen place one level up), or null. */
export function parentIdFor(chain: PlaceChain, level: PlaceLevel): number | string | null {
  const parent = parentLevel(level);
  return parent ? (chain[parent]?.id ?? null) : null;
}

/** Every level down to `depth` is chosen. */
export function isPlaceComplete(chain: PlaceChain, depth: PlaceLevel = "village"): boolean {
  return levelsTo(depth).every((l) => Boolean(chain[l]));
}

/** The deepest place chosen, or null. */
export function deepestPlace(chain: PlaceChain): { level: PlaceLevel; place: PlaceOption } | null {
  for (const level of [...PLACE_LEVELS].reverse()) {
    const place = chain[level];
    if (place) return { level, place };
  }
  return null;
}

/** "Amahoro, Rugando, Kimihurura, Gasabo, Kigali City": the chosen places, the smallest first. */
export function placeLine(chain: PlaceChain): string {
  return [...PLACE_LEVELS]
    .reverse()
    .map((l) => chain[l]?.name)
    .filter(Boolean)
    .join(", ");
}

/** Places whose name contains what was typed, accents and case ignored. */
export function matchesPlace(place: PlaceOption, query: string): boolean {
  const fold = (t: string) =>
    t
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  const q = fold(query.trim());
  return !q || fold(place.name).includes(q);
}
