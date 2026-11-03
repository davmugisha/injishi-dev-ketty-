import { GUEST_LIST_FILTER_KEYS, LeaderGuestQuery, LeaderGuestTab } from "@injishi/contracts";

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v) || undefined;

/**
 * The address as a list query: each filter it carries checked on its own, so one bad value (a hand-edited
 * link) drops only itself and the rest of a shared view still applies.
 */
export function guestListQuery(sp: Search): LeaderGuestQuery {
  const tab = LeaderGuestTab.safeParse(one(sp.tab)).success ? (one(sp.tab) as LeaderGuestTab) : "all";
  const base = { tab, when: one(sp.when) === "later" ? "later" : "soon", page: one(sp.page) ?? 1 };
  const candidates: Record<string, string | undefined> = {
    sectorId: one(sp.sectorId),
    cellId: one(sp.cellId),
    villageId: one(sp.villageId),
    q: one(sp.q),
    ...Object.fromEntries(GUEST_LIST_FILTER_KEYS.map((k) => [k, one(sp[k])])),
  };
  const kept: Record<string, string> = {};
  for (const [k, v] of Object.entries(candidates)) {
    if (v !== undefined && LeaderGuestQuery.safeParse({ ...base, [k]: v }).success) kept[k] = v;
  }
  const parsed = LeaderGuestQuery.safeParse({ ...base, ...kept });
  if (parsed.success) return parsed.data;
  // A range whose end is before its start: drop the range, keep the rest.
  const { arrivedFrom: _from, arrivedTo: _to, ...rest } = kept;
  return LeaderGuestQuery.parse({ ...base, ...rest });
}

/** The query a download carries: exactly the view on screen (every filter, the status, the search), not the page. */
export function downloadQuery(query: LeaderGuestQuery): string {
  const { page: _page, ...view } = query;
  return new URLSearchParams(
    Object.entries(view).flatMap(([k, v]) => (v === undefined || v === null ? [] : [[k, String(v)]])),
  ).toString();
}
