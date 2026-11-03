import { createHash } from 'node:crypto';

import type { ExploreSort } from '@injishi/contracts';
import { z } from 'zod';

import type { ExploreArea, ExploreKey } from './explore-query';

/**
 * Explore's cursor (mobile spec 0005, D-as): base64url JSON of the sort, the platform mean frozen on
 * the first page, the last row's sort key, and a hash of the filters it was made for.
 *
 * The mean is frozen so a review landing between two fetches cannot shift every score and repeat or
 * skip rows across the page boundary. The filters are hashed so a cursor from one search is refused
 * on another, rather than starting it in the middle.
 */

const Payload = z.object({
  v: z.literal(1),
  s: z.enum(['top_rated', 'price_asc', 'price_desc']),
  /** The platform mean, a decimal string. */
  c: z.string().regex(/^\d+(\.\d+)?$/),
  /** top rated: [score, lower name, id]; price: [price or null, lower name, id]. */
  k: z.tuple([z.union([z.string(), z.number(), z.null()]), z.string(), z.string().uuid()]),
  f: z.string().length(16),
});

export interface ExploreFilters {
  mode: string;
  area: ExploreArea;
}

export interface DecodedCursor {
  mean: string;
  key: ExploreKey;
}

/** Why a cursor was refused; the service answers each with a 400. */
export class ExploreCursorError extends Error {}

/** A short, stable hash of the filters a page was made for. */
export function filtersHash(filters: ExploreFilters): string {
  return createHash('sha256').update(JSON.stringify([filters.mode, filters.area])).digest('hex').slice(0, 16);
}

export function encodeCursor(input: { mean: string; key: ExploreKey; filters: ExploreFilters }): string {
  const k: [string | number | null, string, string] =
    input.key.sort === 'top_rated'
      ? [input.key.score, input.key.name, input.key.id]
      : [input.key.price, input.key.name, input.key.id];
  const payload: z.infer<typeof Payload> = { v: 1, s: input.key.sort, c: input.mean, k, f: filtersHash(input.filters) };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/** The cursor's mean and key, or `ExploreCursorError` when it is unreadable or made for another search. */
export function decodeCursor(cursor: string, expect: { sort: ExploreSort; filters: ExploreFilters }): DecodedCursor {
  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new ExploreCursorError('That page link is not readable. Start the search again.');
  }
  const parsed = Payload.safeParse(raw);
  if (!parsed.success) throw new ExploreCursorError('That page link is not readable. Start the search again.');
  const { s, c, k, f } = parsed.data;
  if (s !== expect.sort || f !== filtersHash(expect.filters)) {
    throw new ExploreCursorError('The search changed since that page. Start it again from the top.');
  }
  const [first, name, id] = k;
  if (s === 'top_rated') {
    if (typeof first !== 'string' || !/^-?\d+(\.\d+)?$/.test(first)) {
      throw new ExploreCursorError('That page link is not readable. Start the search again.');
    }
    return { mean: c, key: { sort: s, score: first, name, id } };
  }
  if (first !== null && (typeof first !== 'number' || !Number.isSafeInteger(first))) {
    throw new ExploreCursorError('That page link is not readable. Start the search again.');
  }
  return { mean: c, key: { sort: s, price: first, name, id } };
}
