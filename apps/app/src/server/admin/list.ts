/**
 * Reading the admin list kit's URL on the server (2026-11-09): one value of a search param, a positive id,
 * an allowed word, the page, and a "since" filter's days as the Kigali day it starts on.
 */
export type Search = Record<string, string | string[] | undefined>;

export const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

export const idOf = (v: string | string[] | undefined): number | undefined => {
  const n = Number(one(v));
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

export const pageOf = (v: string | string[] | undefined): number => Math.max(1, Number(one(v)) || 1);

export function wordOf<T extends string>(v: string | string[] | undefined, allowed: readonly T[]): T | undefined {
  const w = one(v);
  return w && (allowed as readonly string[]).includes(w) ? (w as T) : undefined;
}

/** `?since=30` as the Kigali calendar day 30 days ago, YYYY-MM-DD; undefined for anything else. */
export function sinceDay(v: string | string[] | undefined): string | undefined {
  const days = Number(one(v));
  if (![7, 30, 90, 365].includes(days)) return undefined;
  const kigali = new Date(Date.now() + 2 * 3600_000 - days * 86_400_000);
  return kigali.toISOString().slice(0, 10);
}

/** The area ids the URL carries, for `placeChainOf` and the API. */
export function areaOf(sp: Search) {
  return {
    provinceId: idOf(sp.provinceId),
    districtId: idOf(sp.districtId),
    sectorId: idOf(sp.sectorId),
    cellId: idOf(sp.cellId),
    villageId: idOf(sp.villageId),
  };
}
