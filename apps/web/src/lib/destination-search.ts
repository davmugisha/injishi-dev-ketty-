import {
  DESTINATIONS,
  POPULAR_DESTINATIONS,
  type Destination,
  type DestinationKind,
} from "@/data/destinations";

/**
 * Ranking for the hero typeahead.
 *
 * The list is small enough to score on every keystroke — no debounce, no
 * request, so a suggestion is on screen in the same frame as the character.
 * That is the half of the reference bar we can beat outright: vrbo.com round
 * trips for its suggestions.
 *
 * Scoring, highest first:
 *
 *   1000  the whole label, exactly
 *    800  label starts with the query
 *    600  a later word in the label starts with the query
 *    500  an alias starts with the query   ("gisenyi" → Rubavu)
 *    300  the label contains the query
 *    200  the context line contains it     ("Gasabo" → Kacyiru, Kimihurura)
 *    150  an alias contains it
 *
 * Kind breaks ties: typing "ki" should offer Kigali the district before
 * Kimihurura the neighbourhood.
 */

const KIND_RANK: Record<DestinationKind, number> = {
  district: 0,
  landmark: 1,
  area: 2,
  stay: 3,
};

export interface RankedDestination {
  destination: Destination;
  score: number;
  /** [start, end) of the matched span in the label, for emphasis on render. */
  highlight: [number, number] | null;
}

/** Fold case and accents so "Nyungwé" and "nyungwe" are the same query. */
function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function scoreOne(destination: Destination, query: string): RankedDestination | null {
  const label = fold(destination.label);
  const context = fold(destination.context);

  if (label === query) {
    return { destination, score: 1000, highlight: [0, destination.label.length] };
  }
  if (label.startsWith(query)) {
    return { destination, score: 800, highlight: [0, query.length] };
  }

  // A later word — "national park" should be reachable by typing "park".
  const wordStart = label.indexOf(` ${query}`);
  if (wordStart !== -1) {
    return {
      destination,
      score: 600,
      highlight: [wordStart + 1, wordStart + 1 + query.length],
    };
  }

  const aliases = destination.aliases ?? [];
  if (aliases.some((alias) => fold(alias).startsWith(query))) {
    return { destination, score: 500, highlight: null };
  }

  const inside = label.indexOf(query);
  if (inside !== -1) {
    return { destination, score: 300, highlight: [inside, inside + query.length] };
  }
  if (context.includes(query)) {
    return { destination, score: 200, highlight: null };
  }
  if (aliases.some((alias) => fold(alias).includes(query))) {
    return { destination, score: 150, highlight: null };
  }
  return null;
}

/**
 * Rank the index against a raw query.
 *
 * An empty query returns the popular set rather than nothing, so the panel is
 * never a blank box — the reference fills that state with example phrasings,
 * which cost a sentence of typing where these cost one tap.
 */
export function rankDestinations(
  rawQuery: string,
  limit = 7,
  /** Stays the database published (`data/published-stays.ts`), beside the fixed list. */
  extra: readonly Destination[] = [],
): RankedDestination[] {
  const query = fold(rawQuery);

  if (!query) {
    return POPULAR_DESTINATIONS.map((destination) => ({
      destination,
      score: 0,
      highlight: null,
    }));
  }

  const scored: RankedDestination[] = [];
  for (const destination of [...DESTINATIONS, ...extra]) {
    const hit = scoreOne(destination, query);
    if (hit) scored.push(hit);
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const kind = KIND_RANK[a.destination.kind] - KIND_RANK[b.destination.kind];
    if (kind !== 0) return kind;
    return a.destination.label.localeCompare(b.destination.label);
  });

  return scored.slice(0, limit);
}

/** Section label for a run of rows of the same kind. */
export const KIND_LABELS: Record<DestinationKind, string> = {
  district: "Districts",
  landmark: "Regions & parks",
  area: "Neighbourhoods",
  stay: "Stays",
};
