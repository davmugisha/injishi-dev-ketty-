import type { AccommodationClass } from "@injishi/contracts";
import { pluralize } from "@injishi/utils";
import { isPerPerson } from "@/lib/rate-basis";

/**
 * How to say a property's size so a guest can picture it.
 *
 * The catalogue carries two numbers: `rooms`, how many bookable units the
 * property has (the hotels' sourced figure is bookable rooms), and
 * `bedrooms`, how many bedrooms ONE booking gets. Printed side by side as
 * "10 rooms" and "Bedrooms 2" they read as a contradiction, and "bedrooms per
 * unit" was jargon. So both are said in one sentence, in the word for what is
 * actually booked: "10 cottages · each has 2 bedrooms and sleeps up to 4".
 *
 * The word comes from the property's own name when it says ("Virunga Ridge
 * Cottages", "Karongi Hillside Villas"), else from its class.
 */

type Noun = { one: string; many: string };

const NOUN = {
  room: { one: "room", many: "rooms" },
  cottage: { one: "cottage", many: "cottages" },
  villa: { one: "villa", many: "villas" },
  apartment: { one: "apartment", many: "apartments" },
  suite: { one: "suite", many: "suites" },
  tent: { one: "tent", many: "tents" },
} satisfies Record<string, Noun>;

export function bookingUnit(kind: AccommodationClass, name: string): Noun {
  if (/cottage/i.test(name)) return NOUN.cottage;
  if (/villa/i.test(name)) return NOUN.villa;
  if (/suite/i.test(name)) return NOUN.suite;
  if (/apartment|flats?\b|residence/i.test(name)) return NOUN.apartment;
  if (/tent|camp/i.test(name) || kind === "tented_camp") return NOUN.tent;
  if (kind === "villa") return NOUN.villa;
  if (kind === "apartment") return NOUN.apartment;
  return NOUN.room;
}

export type SizeFacts = {
  kind: AccommodationClass;
  name: string;
  rooms: number | null;
  bedrooms: number;
  maxGuests: number;
  /** The rate's basis ("per person, per night"); a per-person rate says so. */
  basis?: string;
};

/** "2 guests pay twice the rate." Read beside "sleeps 2", a per-person price
 * otherwise left a guest asking whether the room or each sleeper pays it. */
function perPersonNote({ basis, maxGuests }: SizeFacts): string {
  if (!basis || !isPerPerson(basis) || maxGuests <= 1) return "";
  return ` The rate is per person, so ${maxGuests} guests pay ${maxGuests} times it.`;
}

/**
 * The property's size, short: "10 cottages", "292 rooms", or, for a place
 * booked whole, "2-bedroom place".
 */
export function sizeSummary({ kind, name, rooms, bedrooms }: SizeFacts): string {
  if (rooms) {
    const noun = bookingUnit(kind, name);
    return `${rooms} ${rooms === 1 ? noun.one : noun.many}`;
  }
  return `${bedrooms}-bedroom place`;
}

/**
 * What one booking gets, as a sentence: "Each cottage has 2 bedrooms and
 * sleeps up to 4." A one-bedroom room just says who it sleeps; the bedroom
 * count adds nothing there.
 */
export function perBookingSentence(facts: SizeFacts): string {
  const { kind, name, rooms, bedrooms, maxGuests } = facts;
  const sleeps = `sleeps up to ${maxGuests}`;
  const note = perPersonNote(facts);
  if (!rooms) return `The whole place is yours: ${pluralize(bedrooms, "bedroom")}, ${sleeps}.${note}`;
  const noun = bookingUnit(kind, name);
  if (bedrooms <= 1 && noun.one === "room") return `Each room ${sleeps}.${note}`;
  return `Each ${noun.one} has ${pluralize(bedrooms, "bedroom")} and ${sleeps}.${note}`;
}

/**
 * Specification rows, one idea each: "Bedrooms · 2 per cottage", "Sleeps ·
 * 4 per cottage". The rate basis has its own row, so it is not repeated here.
 */
export function perBookingSpecs(facts: SizeFacts): { label: string; value: string }[] {
  const per = facts.rooms ? `per ${bookingUnit(facts.kind, facts.name).one}` : "whole place";
  return [
    { label: "Bedrooms", value: `${facts.bedrooms} ${per}` },
    { label: "Sleeps", value: `${facts.maxGuests} ${per}` },
  ];
}
