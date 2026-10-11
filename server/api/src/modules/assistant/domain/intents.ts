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

/**
 * The person's OWN trips: "show my trips", "my bookings", "where is my
 * reservation". Checked before places to stay, so "my stay" is a trip. A
 * question about bookings in general ("do hosts have to accept every
 * booking?") is not one: it once got the asker's own trips.
 */
export const TRIP_QUESTION =
  /\b(my|our|mine|upcoming|past|show|list|see)\b.*\b(trips?|bookings?|reservations?|stays?)\b|\bi (have )?(booked|reserved)\b/i;
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

/**
 * A greeting and nothing else ("hello", "good morning", "muraho"). Answered
 * with a greeting and what the assistant can do, never by the model.
 */
export const GREETING =
  /^\s*(hi|hello|hey|hiya|greetings|good (morning|afternoon|evening|day)|muraho|mwaramutse|mwiriwe|amakuru|bonjour|salut)( there| injishi| assistant)?[\s!.,?]*$/i;

/** Thanks and nothing else. */
export const THANKS = /^\s*((ok(ay)?|great|perfect|nice),? )?(thanks|thank you( (very|so) much)?|thx|murakoze( cyane)?|merci)[\s!.,]*$/i;

/** Asks for a video or tutorial. */
export const VIDEO_QUESTION = /\b(videos?|tutorials?|screen ?recordings?|watch (how|a))\b/i;

/**
 * The nightly budget a stay question names, in RWF: "under 150000",
 * "below 150,000 RWF", "up to 80k", "budget of 60 000". Null when none is
 * named, so a search never filters on a figure the person did not give.
 */
export function budgetIn(question: string): number | null {
  const match = question.match(
    /\b(?:under|below|less than|cheaper than|up to|at most|max(?:imum)?|within|budget(?: of)?|not more than)\s*(?:rwf|frw)?\s*(\d{1,3}(?:[ ,.]\d{3})+|\d+)\s*(k|thousand)?\b/i,
  );
  if (!match) return null;
  const amount = Number(match[1].replace(/[ ,.]/g, '')) * (match[2] ? 1000 : 1);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

/** "for 4 guests", "3 people", "2 adults": how many must fit. Null when none. */
export function guestsIn(question: string): number | null {
  const match = question.match(/\b(\d{1,2})\s*(?:guests?|people|persons?|adults?|pax|of us)\b/i);
  const n = match ? Number(match[1]) : NaN;
  return n >= 1 && n <= 50 ? n : null;
}

/** The question with its budget and guest phrases removed, for the place search. */
export function withoutFilters(question: string): string {
  return question
    .replace(/\b(?:under|below|less than|cheaper than|up to|at most|max(?:imum)?|within|budget(?: of)?|not more than)\s*(?:rwf|frw)?\s*(\d{1,3}(?:[ ,.]\d{3})+|\d+)\s*(k|thousand)?\s*(?:rwf|frw)?(?:\s*(?:a|per)\s*night)?/gi, ' ')
    .replace(/\b(?:for\s+)?\d{1,2}\s*(?:guests?|people|persons?|adults?|pax|of us)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const VAGUE_STOP = new Set(
  'a an and are as at be can do does for from how i if in is it me my of on or so the to what when where which who why will with you your please tell about any some there have has get need want know'.split(' '),
);

/** What a too short question is about, when it is one of the ambiguous topics. */
export type VagueTopic = 'price' | 'booking' | 'payment' | 'account' | 'listing' | 'general';

const VAGUE_TOPICS: Array<[VagueTopic, RegExp]> = [
  ['price', /^(price|prices|pricing|cost|costs|fee|fees|charge|charges|rate|rates|much|cheap|expensive)$/],
  ['booking', /^(book|booking|bookings|reserve|reservation|reservations|trip|trips)$/],
  ['payment', /^(pay|payment|payments|paid|payout|payouts|money|refund|refunds)$/],
  ['account', /^(account|accounts|login|signin|signup|register|registration|profile)$/],
  ['listing', /^(list|listing|listings|property|properties|host|hosting|publish)$/],
];

/**
 * A question too short to answer well: one meaningful word, or two when one
 * of them names an ambiguous topic ("price", "booking"). The router asks what
 * the person means instead of guessing (D-q tier 1). Null when the question
 * says enough.
 */
export function vagueTopicIn(question: string): VagueTopic | null {
  const words = (question.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => !VAGUE_STOP.has(w));
  // Only filler words ("what", "how"): nothing to search for, so ask.
  if (words.length === 0) return /[a-z]/i.test(question) ? 'general' : null;
  if (words.length > 2) return null;
  for (const [topic, pattern] of VAGUE_TOPICS) if (words.some((w) => pattern.test(w))) return topic;
  return words.length === 1 ? 'general' : null;
}
