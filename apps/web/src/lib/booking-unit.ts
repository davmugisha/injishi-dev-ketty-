import type { AccommodationClass } from "@injishi/contracts";

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

