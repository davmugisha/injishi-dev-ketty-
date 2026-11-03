import { EXPLORE_FACT_ORDER, EXPLORE_MAX_FACTS, type ExploreSearchQuery } from '@injishi/contracts';

/** Where a search looks: a picked suggestion, or free text over name, sector and district. */
export type ExploreArea =
  | { kind: 'district'; id: number }
  | { kind: 'sector'; id: number }
  | { kind: 'property'; slug: string }
  | { kind: 'text'; text: string }
  | { kind: 'all' };

/** The last row of a page, as the cursor carries it. */
export type ExploreKey =
  | { sort: 'top_rated'; score: string; name: string; id: string }
  | { sort: 'price_asc' | 'price_desc'; price: number | null; name: string; id: string };

/**
 * The area a search names (D-g): a picked suggestion wins over the typed words, which match the
 * property's name, its sector or its district; nothing typed is everywhere.
 */
export function areaOf(query: Pick<ExploreSearchQuery, 'place' | 'q'>): ExploreArea {
  if (query.place) {
    const at = query.place.indexOf(':');
    const kind = query.place.slice(0, at);
    const value = query.place.slice(at + 1);
    if (kind === 'district' || kind === 'sector') return { kind, id: Number(value) };
    return { kind: 'property', slug: value };
  }
  const text = query.q?.trim() ?? '';
  return text ? { kind: 'text', text } : { kind: 'all' };
}

/**
 * A page's facts (the property page child): its amenities in `EXPLORE_FACT_ORDER`, then the rest in
 * the order given (by label), at most `EXPLORE_MAX_FACTS`. No fact is invented.
 */
export function factsOf<T extends { code: string }>(amenities: T[]): T[] {
  const rank = (code: string): number => {
    const at = EXPLORE_FACT_ORDER.indexOf(code);
    return at === -1 ? EXPLORE_FACT_ORDER.length : at;
  };
  return amenities
    .map((a, i) => ({ a, i }))
    .sort((x, y) => rank(x.a.code) - rank(y.a.code) || x.i - y.i)
    .slice(0, EXPLORE_MAX_FACTS)
    .map(({ a }) => a);
}
