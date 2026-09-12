/**
 * EVERY FILTERABLE ATTRIBUTE THE PLATFORM DOES NOT YET STORE, IN ONE FILE.
 *
 * The rebuilt explore rail offers the facet groups the reference offers:
 * cancellation terms, meal plans, payment options, accessibility features,
 * room views, nearby activities and traveller experience. The platform stores
 * none of them. There is no Inventory module holding a room view, no Policy
 * module holding a cancellation tier, and no Accessibility survey anywhere.
 *
 * So they are derived HERE, in one place, and the rules are written down so a
 * reader can tell which answers are true and which are invented:
 *
 *  - DERIVED FROM REAL DATA, and therefore true: breakfast and board (read off
 *    `price.includes`), every amenity facet (read off the property's own
 *    amenity list), the lake and mountain views (read off the amenity prose),
 *    the price bands, the star class, the score band and the bedroom count.
 *  - INVENTED, deterministically from the slug: cancellation tier, payment
 *    options, accessibility features, the remaining activities, VIP tier and
 *    rooms-left. These are the ones to delete when the real modules land.
 *
 * Nothing uses `Math.random`. A random attribute differs between the server
 * render and the client hydration, and React tears the row down and rebuilds
 * it on every load. Derived from the slug, a stay answers the same way for
 * ever, on both sides.
 *
 * The invented half must not be quoted to a guest or screenshotted for a
 * pitch. It is fixture data, exactly as `data/demo-commerce.ts` is.
 */
import type { PropertyDetail } from "@/data/properties";
import { amenityMark } from "@/lib/amenity-icon";

/* ------------------------------------------------------------ vocabulary */

export const CANCELLATION_OPTIONS = [
  { id: "fully_refundable", label: "Fully refundable property" },
  { id: "reserve_now_pay_later", label: "Reserve now, pay later" },
] as const;
export type CancellationId = (typeof CANCELLATION_OPTIONS)[number]["id"];

export const MEAL_PLANS = [
  { id: "breakfast", label: "Breakfast included" },
  { id: "lunch", label: "Lunch included" },
  { id: "dinner", label: "Dinner included" },
  { id: "all_inclusive", label: "All inclusive" },
] as const;
export type MealPlanId = (typeof MEAL_PLANS)[number]["id"];

export const PAYMENT_OPTIONS = [
  { id: "pay_online", label: "Pay online now" },
  { id: "pay_at_property", label: "Pay at the property" },
  { id: "instalments", label: "Pay over time in instalments" },
] as const;
export type PaymentId = (typeof PAYMENT_OPTIONS)[number]["id"];

export const ACCESS_FEATURES = [
  { id: "elevator", label: "Elevator" },
  { id: "step_free", label: "Step-free path to entrance" },
  { id: "accessible_bathroom", label: "Accessible bathroom" },
  { id: "roll_in_shower", label: "Roll-in shower" },
] as const;
export type AccessId = (typeof ACCESS_FEATURES)[number]["id"];

export const VIEW_KINDS = [
  { id: "lake", label: "Lake view" },
  { id: "mountain", label: "Mountain view" },
  { id: "garden", label: "Garden view" },
  { id: "city", label: "City view" },
] as const;
export type ViewId = (typeof VIEW_KINDS)[number]["id"];

export const ACTIVITY_KINDS = [
  { id: "national_park", label: "National park" },
  { id: "hiking", label: "Hiking and trekking" },
  { id: "water_sports", label: "Water sports" },
  { id: "museums", label: "Museums and memorials" },
  { id: "golf", label: "Golfing" },
] as const;
export type ActivityId = (typeof ACTIVITY_KINDS)[number]["id"];

export const EXPERIENCE_KINDS = [
  { id: "luxury", label: "Luxury" },
  { id: "business", label: "Business friendly" },
  { id: "family", label: "Family friendly" },
  { id: "budget", label: "Budget" },
  { id: "eco", label: "Eco stay" },
] as const;
export type ExperienceId = (typeof EXPERIENCE_KINDS)[number]["id"];

/**
 * The amenity facets, keyed by the SHORT name `lib/amenity-icon.ts` already
 * derives.
 *
 * Reusing that map rather than writing a second one is the point. The amenity
 * labels in the fixtures are prose — "Well-stocked bar and restaurant with
 * open terrace" is a real entry — so a facet list built from raw labels would
 * offer sixty options with a count of one each. `amenityMark` already folds
 * that prose into a canonical short name for the card, and a facet is the same
 * question the card answers.
 */
export const PROPERTY_AMENITIES = [
  { id: "Pool", label: "Pool" },
  { id: "Free WiFi", label: "WiFi included" },
  { id: "Restaurant", label: "Restaurant" },
  { id: "Bar", label: "Bar or lounge" },
  { id: "Spa", label: "Spa" },
  { id: "Fitness", label: "Fitness centre" },
  { id: "Parking", label: "Parking" },
  { id: "Airport shuttle", label: "Airport shuttle" },
  { id: "24h desk", label: "24-hour front desk" },
] as const;

export const ROOM_AMENITIES = [
  { id: "Terrace", label: "Balcony or patio" },
  { id: "En-suite", label: "Private bathroom" },
  { id: "Breakfast", label: "Breakfast service" },
  { id: "TV", label: "Television" },
  { id: "Pet friendly", label: "Pet friendly" },
] as const;

/* ------------------------------------------------------------ derivation */

/** FNV-1a, the same stable slug hash `data/demo-commerce.ts` uses. */
function hash(slug: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < slug.length; i += 1) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A deterministic bit out of the hash: true for `numerator` cases in `of`. */
function bit(seed: number, offset: number, numerator: number, of: number): boolean {
  return ((seed >>> offset) & 0xffff) % of < numerator;
}

export interface StayFacets {
  /** Canonical amenity short names this stay offers. Real. */
  amenityKeys: string[];
  cancellation: CancellationId[];
  meals: MealPlanId[];
  payment: PaymentId[];
  access: AccessId[];
  views: ViewId[];
  activities: ActivityId[];
  experience: ExperienceId[];
  /** Paid placement tier. Invented; owed by an Ads module that does not exist. */
  vip: boolean;
  /** Scarcity. Invented; owed by the Inventory module. Null means "not scarce". */
  roomsLeft: number | null;
}

export function facetsFor(property: PropertyDetail): StayFacets {
  const seed = hash(property.slug);
  const includes = property.price.includes.toLowerCase();
  const prose = property.amenities.map((a) => a.label.toLowerCase()).join(" | ");

  // REAL: the canonical amenity set, folded through the same map the card uses.
  const amenityKeys = [
    ...new Set(property.amenities.map((a) => amenityMark(a.label).short)),
  ];

  // REAL: board is stated on every price record.
  const meals: MealPlanId[] = [];
  const allIn = /all meals|all inclusive|all-inclusive/.test(includes);
  if (allIn) meals.push("all_inclusive", "breakfast", "lunch", "dinner");
  else {
    if (/breakfast/.test(includes) || amenityKeys.includes("Breakfast")) {
      meals.push("breakfast");
    }
    if (/dinner|half board|full board/.test(includes)) meals.push("dinner");
    if (/lunch|full board/.test(includes)) meals.push("lunch");
  }

  // REAL where the prose says so, invented for the rest. A lodge on Lake Kivu
  // whose own amenity list says "private balcony with lake views" is a lake
  // view; a city hotel that says nothing gets one from the hash.
  const views: ViewId[] = [];
  if (/lake|kivu|beach|shore|water/.test(prose)) views.push("lake");
  if (/volcano|mountain|virunga|hill|forest/.test(prose)) views.push("mountain");
  if (/garden|terrace|veranda|deck/.test(prose)) views.push("garden");
  if (views.length === 0) views.push(bit(seed, 2, 1, 2) ? "city" : "garden");

  // REAL: the district and the property's own prose place it near things.
  const activities: ActivityId[] = [];
  if (property.district === "musanze" || property.district === "nyagatare") {
    activities.push("national_park", "hiking");
  }
  if (property.district === "rusizi") activities.push("national_park");
  if (/lake|beach|kivu|jet ski|windsurf|kayak|boat/.test(prose)) {
    activities.push("water_sports");
  }
  if (property.district === "kigali") activities.push("museums");
  // INVENTED: golf. Nothing in the fixtures records a course.
  if (bit(seed, 6, 1, 4)) activities.push("golf");

  // REAL where the class and rate say so.
  const experience: ExperienceId[] = [];
  const rate = property.nightlyRateRwf;
  if ((property.starClass ?? 0) >= 5 || (rate !== null && rate >= 200_000)) {
    experience.push("luxury");
  }
  if (rate !== null && rate <= 40_000) experience.push("budget");
  if (amenityKeys.includes("Fitness") || /business centre|conference|convention/.test(prose)) {
    experience.push("business");
  }
  if (property.maxGuests >= 4) experience.push("family");
  if (/solar|organic|eco|conserv|plantation|forest/.test(prose)) experience.push("eco");

  // INVENTED from here down. Each names the module that owes it.
  //
  // Owed by a Policy module. Roughly two thirds refundable, matching the
  // reference's own mix — a page where every stay is refundable makes the
  // filter useless, and one where none is makes it look broken.
  const cancellation: CancellationId[] = [];
  if (bit(seed, 10, 2, 3)) cancellation.push("fully_refundable");
  if (bit(seed, 14, 1, 2)) cancellation.push("reserve_now_pay_later");

  // Owed by the Payments module. Every stay can be paid online; the other two
  // are the property's choice.
  const payment: PaymentId[] = ["pay_online"];
  if (bit(seed, 18, 1, 2)) payment.push("pay_at_property");
  if (rate !== null && rate >= 80_000 && bit(seed, 22, 1, 2)) payment.push("instalments");

  // Owed by an Accessibility survey. A multi-storey property is the only one
  // that can have an elevator, which is the one real constraint available.
  const access: AccessId[] = [];
  const storeys = property.rooms ?? 0;
  if (storeys >= 40 && bit(seed, 3, 3, 4)) access.push("elevator");
  if (bit(seed, 7, 1, 2)) access.push("step_free");
  if (bit(seed, 11, 1, 3)) access.push("accessible_bathroom");
  if (bit(seed, 15, 1, 5)) access.push("roll_in_shower");

  return {
    amenityKeys,
    cancellation,
    meals: [...new Set(meals)],
    payment,
    access,
    views: [...new Set(views)],
    activities: [...new Set(activities)],
    experience: [...new Set(experience)],
    // Owed by an Ads module. One stay in six, matching `demo-commerce`'s
    // sponsored rate so the two marks do not contradict each other.
    vip: bit(seed, 19, 1, 6),
    // Owed by the Inventory module. Only ever a small number: "we have 9 left"
    // is not scarcity and nobody would print it.
    roomsLeft: bit(seed, 23, 2, 5) ? 1 + (((seed >>> 26) & 0xff) % 5) : null,
  };
}
