import type { AssistantSuggestion, AssistantSurface } from '@injishi/contracts';

import { FOLLOW_UPS, FOLLOW_UP_ONLY, SUGGESTIONS, type SuggestionEntry } from '../content/suggestions';

/** How many starters a new conversation shows, and follow ups after an answer. */
export const STARTERS_SHOWN = 4;
export const FOLLOW_UPS_SHOWN = 3;

const BY_ID = new Map([...SUGGESTIONS, ...FOLLOW_UP_ONLY].map((s) => [s.id, s]));

/**
 * The starters for a caller (ADR-061 D-q): only those whose tool the caller is
 * offered (D-f), most asked first. "Most asked" is how many answers on this
 * surface had the starter's route in the last 30 days (the turn log, which
 * holds no text); a tie, or no history yet, keeps the order written for the
 * surface.
 */
export function startersFor(offered: Set<string>, surface: AssistantSurface, popularity: Map<string, number>): SuggestionEntry[] {
  const allowed = SUGGESTIONS.filter((s) => offeredTo(s, offered));
  const base = (s: SuggestionEntry): number => (s.firstOn.includes(surface) ? 0 : 1) * 1000 + SUGGESTIONS.indexOf(s);
  return [...allowed].sort((a, b) => (popularity.get(b.route) ?? 0) - (popularity.get(a.route) ?? 0) || base(a) - base(b));
}

/** The opening suggestions: the top starters, one per route so they are varied. */
export function openingSuggestions(offered: Set<string>, surface: AssistantSurface, popularity: Map<string, number>): AssistantSuggestion[] {
  const picked: SuggestionEntry[] = [];
  const routes = new Set<string>();
  const ranked = startersFor(offered, surface, popularity);
  for (const s of ranked) {
    if (picked.length >= STARTERS_SHOWN) break;
    if (routes.has(s.route)) continue;
    picked.push(s);
    routes.add(s.route);
  }
  // Fewer distinct routes than slots: fill with the next ranked.
  for (const s of ranked) {
    if (picked.length >= STARTERS_SHOWN) break;
    if (!picked.includes(s)) picked.push(s);
  }
  return picked.map(toSuggestion);
}

/**
 * What to offer after an answer: the natural next questions for its route,
 * then the most asked starters, never the question just asked.
 */
export function followUpSuggestions(
  route: string | null,
  lastQuestion: string | null,
  offered: Set<string>,
  surface: AssistantSurface,
  popularity: Map<string, number>,
): AssistantSuggestion[] {
  const asked = lastQuestion?.trim().toLowerCase();
  const picked: SuggestionEntry[] = [];
  const add = (s: SuggestionEntry | undefined): void => {
    if (!s || picked.length >= FOLLOW_UPS_SHOWN || picked.includes(s) || !offeredTo(s, offered)) return;
    if (s.message.toLowerCase() === asked) return;
    picked.push(s);
  };
  for (const id of FOLLOW_UPS[route ?? ''] ?? []) add(BY_ID.get(id));
  for (const s of startersFor(offered, surface, popularity)) add(s);
  return picked.map(toSuggestion);
}

/** Every suggestion, for the test that pins each to an answer without the model. */
export function allSuggestionEntries(): SuggestionEntry[] {
  return [...SUGGESTIONS, ...FOLLOW_UP_ONLY];
}

/** The tools only a caller working in a business is offered (D-f). */
const OPERATOR_TOOLS = ['rooms_on_dates', 'publish_blockers', 'list_reservations', 'propose_room_price'];

/**
 * Whether this caller is offered a suggestion (D-f): its tool, no better one,
 * and, for a task done inside a business, a workspace to do it in.
 */
export function offeredTo(s: SuggestionEntry, offered: Set<string>): boolean {
  if (!offered.has(s.needs)) return false;
  if (s.unless !== undefined && offered.has(s.unless)) return false;
  return !s.operatorOnly || OPERATOR_TOOLS.some((t) => offered.has(t));
}

function toSuggestion(s: SuggestionEntry): AssistantSuggestion {
  return { label: s.label, message: s.message };
}
