/**
 * The filterable attributes of a stay, read off its own record.
 *
 * Only what the stay's data says: board from `price.includes`, amenity facets
 * from its amenity list, views and nearby activities from that list's prose
 * and its district, and the traveller experience from its class, rate and
 * size. Nothing is drawn from a hash of the slug any more (2026-10-08):
 * cancellation tiers, payment options, accessibility, golf, "VIP Access" and
 * "only N left" were invented that way, and printed on real properties as if
 * the property had said them. They come back when a module stores them.
 */
import type { PropertyDetail } from "@/data/properties";
import { amenityMark } from "@/lib/amenity-icon";

/* ------------------------------------------------------------ vocabulary */

export const MEAL_PLANS = [
  { id: "breakfast", label: "Breakfast included" },
  { id: "lunch", label: "Lunch included" },
  { id: "dinner", label: "Dinner included" },
  { id: "all_inclusive", label: "All inclusive" },
] as const;
export type MealPlanId = (typeof MEAL_PLANS)[number]["id"];

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

export interface StayFacets {
  /** Canonical amenity short names this stay offers. Real. */
  amenityKeys: string[];
  meals: MealPlanId[];
  views: ViewId[];
  activities: ActivityId[];
  experience: ExperienceId[];
}

export function facetsFor(property: PropertyDetail): StayFacets {
  const includes = property.price.includes.toLowerCase();
  const prose = property.amenities.map((a) => a.label.toLowerCase()).join(" | ");

  // The canonical amenity set, folded through the same map the card uses.
  const amenityKeys = [
    ...new Set(property.amenities.map((a) => amenityMark(a.label).short)),
  ];

  // Board is stated on every price record.
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

  // Where the prose says so. A lodge on Lake Kivu whose own amenity list says
  // "private balcony with lake views" is a lake view; one that says nothing
  // has no view on record.
  const views: ViewId[] = [];
  if (/lake|kivu|beach|shore|water/.test(prose)) views.push("lake");
  if (/volcano|mountain|virunga|hill|forest/.test(prose)) views.push("mountain");
  if (/garden|terrace|veranda|deck/.test(prose)) views.push("garden");

  // The district and the property's own prose place it near things.
  const activities: ActivityId[] = [];
  if (property.district === "musanze" || property.district === "nyagatare") {
    activities.push("national_park", "hiking");
  }
  if (property.district === "rusizi") activities.push("national_park");
  if (/lake|beach|kivu|jet ski|windsurf|kayak|boat/.test(prose)) {
    activities.push("water_sports");
  }
  if (property.district === "kigali") activities.push("museums");

  // Where the class and rate say so.
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

  return {
    amenityKeys,
    meals: [...new Set(meals)],
    views: [...new Set(views)],
    activities: [...new Set(activities)],
    experience: [...new Set(experience)],
  };
}
