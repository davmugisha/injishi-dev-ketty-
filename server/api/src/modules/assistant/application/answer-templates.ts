/**
 * Fixed wording for answers made from a tool's result without the model
 * (ADR-061 D-q), shared by the request router and the mock model so a direct
 * answer and its mock twin always read the same.
 *
 * Every function takes the tool's JSON content exactly as the model would
 * have read it, and returns null when the result is not the shape it words,
 * so the router hands that question on instead of guessing.
 */

export const NO_ANSWER = "I don't have a verified answer for that. The support page at /support can help.";
export const NO_LISTINGS = 'No published property matches that.';
export const LISTINGS_CLOSED = 'Listings are not open yet.';
export const SIGN_IN_FOR_TRIPS = 'Sign in and I can look up your trips.';
export const NO_TRIPS = 'I found no trips on your account.';
export const NO_OPERATOR = 'I can only check rooms from the operator app, in a business you work in.';
export const CANNOT_CHANGE = 'Your account cannot change prices here.';
export const ESCALATION_OFFERED =
  'I can pass this to a person at Injishi support. Press "Send to Injishi support" and they will reply by email.';
/** Leads a fallback answer from the closest help article (D-u). */
export const FALLBACK_ARTICLE = 'Here is the closest help article I have:';
/** Leads a fallback answer when no article is close (D-u). */
export const CANNOT_ANSWER_NOW = "I can't answer that fully right now.";
/** Shown when a model answer states a figure this turn's data does not hold (D-v). */
export const UNCONFIRMED_FIGURE =
  "I couldn't confirm that from current Injishi data. Check the screen that shows it, or ask me to pass this to Injishi support.";
export const NO_TUTORIAL =
  'There is no recorded tutorial for this yet. I can pass this to a person at Injishi support: press "Send to Injishi support" and they will reply by email.';
export const NEED_A_DAY = 'Which day do you mean? Ask about rooms "today", "tomorrow" or on a date such as 2026-10-10.';
export const NEED_A_PRICE = 'Tell me the room type and the new price, for example "change the Double room price to 70,000".';

type Json = Record<string, unknown>;

function parse(content: string): Json | null {
  try {
    const value = JSON.parse(content) as unknown;
    return value && typeof value === 'object' ? (value as Json) : null;
  } catch {
    return null;
  }
}

export function proposalAnswer(content: string): string | null {
  const p = parse(content);
  if (!p || typeof p.proposalId !== 'string') return null;
  return `Ready to change ${String(p.roomType)} from ${String(p.current)} to ${String(p.proposed)}. Nothing has changed yet: press Approve on the card to make it, or Reject.`;
}

/** The guide's steps, numbered. Null when no guide matched. */
export function guideAnswer(content: string): { text: string; guideId: string } | null {
  const guide = parse(content)?.guide as { id?: string; title?: string; steps?: string[] } | null | undefined;
  if (!guide || typeof guide.id !== 'string') return null;
  const steps = (guide.steps ?? []).map((s, i) => `${i + 1}. ${s}`).join(' ');
  return { text: `${guide.title}: ${steps}`, guideId: guide.id };
}

export function tutorialAnswer(content: string): string | null {
  const tutorial = parse(content)?.tutorial as { title?: string; videoUrl?: string } | null | undefined;
  if (!tutorial || typeof tutorial.videoUrl !== 'string') return null;
  return `Here is the tutorial "${tutorial.title}": ${tutorial.videoUrl}`;
}

export function roomsAnswer(content: string): string | null {
  const rooms = parse(content)?.rooms as Array<{ room?: string; heldForDates?: boolean }> | undefined;
  if (!Array.isArray(rooms)) return null;
  const taken = rooms.filter((r) => r.heldForDates).map((r) => r.room);
  const free = rooms.filter((r) => !r.heldForDates).map((r) => r.room);
  return `Held: ${taken.join(', ') || 'none'}. Free: ${free.join(', ') || 'none'}.`;
}

export function publishBlockersAnswer(content: string): string | null {
  const props = parse(content)?.properties as Array<{ property?: string; blockers?: Array<{ fix?: string }> }> | undefined;
  if (!Array.isArray(props)) return null;
  if (props.length === 0) return 'You have no property in this workspace yet.';
  return props.map((p) => `${p.property}: ${(p.blockers ?? []).map((b) => b.fix).join(' ') || 'ready to publish.'}`).join(' ');
}

export function tripsAnswer(content: string): string | null {
  const trips = parse(content)?.trips as Array<{ property?: string; checkIn?: string; reference?: string }> | undefined;
  if (!Array.isArray(trips)) return null;
  if (trips.length === 0) return NO_TRIPS;
  const first = trips[0];
  return `Your next stay is at ${first.property} from ${first.checkIn}, reference ${first.reference}.`;
}

/** Names with source markers, so citations are checked like a model's. */
export function listingsAnswer(content: string): string | null {
  const found = parse(content)?.results as Array<{ propertyId?: string; name?: string }> | undefined;
  if (!Array.isArray(found)) return null;
  if (found.length === 0) return NO_LISTINGS;
  return `Published places that match: ${found.map((r) => `${r.name} [source:${r.propertyId}]`).join(', ')}.`;
}

/** The top article's summary with its source marker, or null. */
export function knowledgeAnswer(content: string): string | null {
  const top = (parse(content)?.results as Array<{ id?: unknown; summary?: unknown }> | undefined)?.[0];
  if (!top || typeof top.id !== 'string' || typeof top.summary !== 'string') return null;
  return `${top.summary} [source:${top.id}]`;
}

/** A tool's refusal or error sentence, when it gave one. */
export function errorSentence(content: string): string | null {
  const error = parse(content)?.error;
  return typeof error === 'string' && error.trim() ? error : null;
}
