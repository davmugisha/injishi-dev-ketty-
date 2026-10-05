/**
 * The fixed rules that classify a question (ADR-061 D-q).
 *
 * One home for them, read by the request router (which answers without the
 * model) and by the mock model (which stands in for the model in tests), so
 * the two can never drift apart on what a question means.
 *
 * Every rule is deliberately narrow: a rule that matches too much answers a
 * question it did not understand, which is worse than letting the model read
 * it.
 */

/** Asks for a person. */
export const HUMAN_QUESTION = /\b(a (human|person)|real person|someone at injishi|talk to (someone|support)|escalate)\b/i;

/** "change the Double room price to 70,000" -> "Double room". */
export const PRICE_CHANGE = /\b(?:change|set)\s+(?:the\s+)?(.+?)\s+price\b/i;

export const PUBLISH_QUESTION = /\bpublish/i;
export const ROOMS_QUESTION = /\brooms?\b.*\b(free|taken|available|held|tonight|tomorrow|today|\d{4}-\d{2}-\d{2})\b/i;
export const HOW_TO_QUESTION = /\bhow (do|can|to)\b/i;

/** Checked before places to stay: "my stay" is a trip question. */
export const TRIP_QUESTION = /\b(trips?|bookings?|reservations?|my stay)\b/i;
export const STAY_QUESTION = /\b(stay|stays|hotels?|lodges?|places?|guest ?houses?|apartments?|villas?|motels?|camps?)\b/i;

/**
 * Still stuck after steps were given. Only acted on when a guide was given
 * earlier in the same conversation, so a tutorial never comes before the steps.
 */
export const STILL_STUCK =
  /\b(still (stuck|confused|lost|not sure)|(did ?n[o']?t|does ?n[o']?t|not) (work|help|understand)|i('m| am) (stuck|confused|lost)|(show|send) me (a |the )?(video|tutorial)|is there a (video|tutorial))\b/i;

/**
 * Asks for explanation, comparison or advice: the model's job, even when a
 * data rule would match a word in it ("explain my booking like I'm new").
 */
export const ANALYSIS_QUESTION =
  /\b(why|compare|comparison|explain|should i|would you|recommend|analy[sz]e|analysis|what do you think|advice|advise|improve|pros and cons|difference between|strategy)\b/i;

export interface PriceChangeIntent {
  roomTypeName: string;
  newPriceRwf: number;
}

/** The room type and the LAST amount named, or null when either is missing. */
export function priceChangeIn(question: string): PriceChangeIntent | null {
  const match = question.match(PRICE_CHANGE);
  if (!match) return null;
  const amounts = [...question.matchAll(/\d[\d,]*/g)].map((m) => Number(m[0].replace(/,/g, '')));
  const newPriceRwf = amounts.at(-1);
  if (!newPriceRwf || !Number.isFinite(newPriceRwf)) return null;
  return { roomTypeName: match[1].trim(), newPriceRwf };
}

/** Kigali is UTC+2 all year (no daylight saving), the business day the screens use. */
const KIGALI_OFFSET_MS = 2 * 60 * 60 * 1000;

function kigaliDay(at: Date): string {
  return new Date(at.getTime() + KIGALI_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * The day a rooms question is about: an explicit yyyy-mm-dd, "tomorrow", or
 * today (also for "tonight"), in Kigali time. Null when none is named, so the
 * router does not guess a date the person did not give.
 */
export function dayIn(question: string, now: Date): string | null {
  const explicit = question.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
  if (explicit) return explicit;
  if (/\btomorrow\b/i.test(question)) return kigaliDay(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  if (/\b(today|tonight)\b/i.test(question)) return kigaliDay(now);
  return null;
}

/** "places to stay in Musanze" -> "Musanze"; otherwise the whole question. */
export function placeIn(question: string): string {
  const match = question.match(/\b(?:in|near|around)\s+([^?.!,]+)/i);
  return (match ? match[1] : question).trim().slice(0, 120);
}
