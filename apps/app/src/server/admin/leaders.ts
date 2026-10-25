/**
 * Admin's reads for local leaders and officers (P5): every appointment with the guests waiting for a
 * leader, the coverage report, and the government bodies an appointment can name. `StaffGuard` decides
 * (staff, the emailed step-up, `admin.user.view`); a refusal comes back as the API's status so the page
 * can say which. Server side only.
 */
import type {
  GovernmentBody,
  LeaderCoverage,
  OversightAppointmentList,
  OversightAppointmentQuery,
} from "@injishi/contracts";
import { currentApi } from "@/lib/session";
import { apiRequest } from "../api";

type Query = Record<string, string | number | undefined>;

function clean(q: Query): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(q).map(([k, v]) => [k, v === undefined || v === "" ? undefined : String(v)]),
  );
}

export async function appointments(query: Partial<OversightAppointmentQuery>): Promise<OversightAppointmentList> {
  const api = await currentApi();
  return api.get<OversightAppointmentList>("/api/v1/admin/local-leaders", { query: clean(query) });
}

export async function leaderCoverage(): Promise<LeaderCoverage> {
  const api = await currentApi();
  return api.get<LeaderCoverage>("/api/v1/admin/local-leaders/coverage");
}

export async function governmentBodies(): Promise<GovernmentBody[]> {
  const api = await currentApi();
  return api.get<GovernmentBody[]>("/api/v1/admin/government-bodies");
}

/** What this staffer may do here (presentation only: the API decides on every call). */
export async function staffAccess(): Promise<{ permissions: string[]; steppedUp: boolean }> {
  const api = await currentApi();
  const access = await api.get<{ permissions: string[]; twoFactor?: { required?: boolean; verified?: boolean } }>(
    "/api/v1/me/staff",
  );
  return {
    permissions: access.permissions ?? [],
    steppedUp: !access.twoFactor?.required || access.twoFactor.verified === true,
  };
}

const GEO: [level: "province" | "district" | "sector" | "cell" | "village", path: string, parent: string | null][] = [
  ["province", "/api/v1/geography/provinces", null],
  ["district", "/api/v1/geography/districts", "provinceId"],
  ["sector", "/api/v1/geography/sectors", "districtId"],
  ["cell", "/api/v1/geography/cells", "sectorId"],
  ["village", "/api/v1/geography/villages", "cellId"],
];

/**
 * A place chain from ids in the address (`?districtId=…&sectorId=…`), with the names the place picker
 * shows, read level by level from the public geography lists. Stops at the first id that is missing or
 * does not sit in the level above.
 */
export async function placeChainOf(
  ids: Partial<Record<"province" | "district" | "sector" | "cell" | "village", number>>,
): Promise<Partial<Record<"province" | "district" | "sector" | "cell" | "village", { id: number; name: string }>>> {
  const out: Partial<Record<"province" | "district" | "sector" | "cell" | "village", { id: number; name: string }>> =
    {};
  let parentId: number | null = null;
  for (const [level, path, parent] of GEO) {
    const id = ids[level];
    if (!id) break;
    const rows: { id: number; name: string }[] = await apiRequest<{ id: number; name: string }[]>(null, path, {
      query: parent && parentId !== null ? { [parent]: parentId } : {},
    });
    const hit: { id: number; name: string } | undefined = rows.find((r: { id: number }) => r.id === id);
    if (!hit) break;
    out[level] = { id: hit.id, name: hit.name };
    parentId = hit.id;
  }
  return out;
}
