import type { RoomPriceBasis } from "./booking";
import type { PropertySetupCounts } from "./inventory";
import type { Domain } from "./primitives";
import { AccommodationClass, RdbEntityGroup, RetiredAccommodationClass } from "./rdb";

/**
 * What a business sets up before it can trade, per kind of business.
 *
 * The ONE definition. The operator app's checklist renders it, the approval mail
 * points at it, and `PropertySetupCounts` is only the raw numbers it is judged
 * against. Neither side decides for itself what "done" means, so a hotel cannot
 * be told it is finished by one screen and unfinished by another.
 *
 * WHY THE STEPS DIFFER. Every business sells the same underlying rows — a
 * property, room types, rooms — but not the same words or the same obligations.
 * A tented camp sells tents and runs a kitchen; an apartment block sells units
 * and runs no restaurant; a landlord lets units by the month and has no
 * departments at all. So the vocabulary and which steps are REQUIRED follow the
 * business, and the underlying calls do not.
 *
 * Nothing here opens a door. The registration gate still decides whether a
 * business may write any of this: from the moment its fee is paid it may build
 * the listing (`canSetUpDuringReview`), and publishing waits for `active`.
 */

/** Every step any business can have, in the order the checklist shows them. */
export const SETUP_STEP_KEYS = [
    "property",
    "contact",
    "departments",
    "room_types",
    "rooms",
    "photos",
    "amenities",
    "outlets",
    "staff",
    "listing",
] as const;
export type SetupStepKey = (typeof SETUP_STEP_KEYS)[number];

export interface SetupStep {
    key: SetupStepKey;
    title: string;
    /** One sentence on what the step is for, in the business's own words. */
    description: string;
    /** Required steps gate "ready to publish"; the rest are recommended. */
    required: boolean;
}

/** The words a kind of business uses for what it sells. */
export interface SetupVocabulary {
    /** "Room types", "Tent types", "Unit types". */
    typePlural: string;
    /** "rooms", "tents", "units". */
    unitPlural: string;
    /** "room", "tent", "unit". */
    unitSingular: string;
    /**
     * "per person, per night", "per night" or "per month". A room says per
     * person because that is what the guest is charged (`computeBreakdown`:
     * rate x billable guests x nights); a host reading "per night" priced a room
     * and the guest page showed the same figure per person. A villa or an
     * apartment is let whole, so its price is per night for the whole place.
     */
    pricePeriod: string;
    /** How a price this business sets is counted (`RoomPriceBasis`). */
    priceBasis: RoomPriceBasis;
}

type StoredClass = AccommodationClass | RetiredAccommodationClass;

/** Retired codes read as the class that replaced them (D24). */
const CURRENT_CLASS: Readonly<Record<RetiredAccommodationClass, AccommodationClass>> = {
    town_hotel: "hotel",
    vacation_hotel_resort: "hotel",
    serviced_apartment: "apartment",
    cottage: "lodge",
};

/**
 * A hotel's room, priced per room per night with an optional lower price for one guest (owner
 * decision, 2026-10-29), the way hotels quote and the booking platforms ask. Counted like a villa:
 * the party does not multiply it (`chargedGuests`).
 */
const PER_ROOM = { pricePeriod: "per room, per night", priceBasis: "per_unit" } as const;
/** Let whole, to one party (owner decision, 2026-10-29). */
const PER_UNIT = { pricePeriod: "per night, for the whole place", priceBasis: "per_unit" } as const;

const HOSPITALITY_VOCABULARY: Readonly<Record<AccommodationClass, SetupVocabulary>> = {
    hotel: { typePlural: "Room types", unitPlural: "rooms", unitSingular: "room", ...PER_ROOM },
    motel: { typePlural: "Room types", unitPlural: "rooms", unitSingular: "room", ...PER_ROOM },
    tented_camp: { typePlural: "Tent types", unitPlural: "tents", unitSingular: "tent", pricePeriod: "per tent, per night", priceBasis: "per_unit" },
    guest_house: { typePlural: "Room types", unitPlural: "rooms", unitSingular: "room", ...PER_ROOM },
    apartment: { typePlural: "Apartment types", unitPlural: "apartments", unitSingular: "apartment", ...PER_UNIT },
    lodge: { typePlural: "Room and cottage types", unitPlural: "rooms and cottages", unitSingular: "room", ...PER_ROOM },
    villa: { typePlural: "Villa types", unitPlural: "villas", unitSingular: "villa", ...PER_UNIT },
    other: { typePlural: "Room types", unitPlural: "rooms", unitSingular: "room", ...PER_ROOM },
};

const RESIDENCE_VOCABULARY: SetupVocabulary = {
    typePlural: "Unit types",
    unitPlural: "units",
    unitSingular: "unit",
    pricePeriod: "per month",
    // Rentals price leases on their own terms; per unit is the nearest reading.
    priceBasis: "per_unit",
};

/**
 * Coffee shops, bars and restaurants: same inventory rows as lodging (a
 * "room type" is still the sellable thing with a price), but the words and
 * the obligations are venue — no rooms to number, no check-in.
 */
const VENUE_VOCABULARY: SetupVocabulary = {
    typePlural: "What you sell",
    unitPlural: "offerings",
    unitSingular: "offering",
    pricePeriod: "each",
    // Listed with prices, never booked (owner decision, 2026-10-29).
    priceBasis: "per_item",
};

/**
 * Which hospitality classes run departments and outlets as a matter of course.
 *
 * A hotel, motel, lodge and tented camp run a front office, housekeeping and a
 * kitchen with somebody in charge of each, so departments are REQUIRED and
 * outlets (a restaurant, a bar) are offered. A guest house, an apartment block,
 * a villa or an unusual business often runs with the owner doing all of it, so
 * departments are recommended rather than demanded, and outlets are still
 * offered for the ones that do serve food.
 */
const RUNS_DEPARTMENTS: ReadonlySet<AccommodationClass> = new Set([
    "hotel",
    "motel",
    "lodge",
    "tented_camp",
]);

/** Inputs that decide lodging vs food-and-drink setup words. */
export type SetupBusinessKind = {
    domain: Domain;
    accommodationClass: StoredClass | string | null;
    /** RDB entity group on the org; coffee shops land in `restaurant_bar_nightclub`. */
    entityGroup?: string | null;
    /** Free text when class is `other` (e.g. "Coffee shop"). */
    accommodationClassOther?: string | null;
    /**
     * `orgs.business_kind`: what the business said it is at registration. Wins
     * over the class and the free text when present.
     */
    businessKind?: string | null;
};

const VENUE_KINDS: ReadonlySet<string> = new Set(["bar_restaurant", "coffee_shop"]);

/**
 * True for coffee shops, bars and restaurants: F&B venues registered under
 * `restaurant_bar_nightclub`, or `other` whose free text names a venue.
 *
 * They share lodging inventory tables but must not be asked for rooms,
 * check-in times or "per person, per night" pricing.
 */
export function isFoodVenue(business: {
    entityGroup?: string | null;
    accommodationClass?: string | null;
    accommodationClassOther?: string | null;
    businessKind?: string | null;
}): boolean {
    if (business.businessKind && VENUE_KINDS.has(business.businessKind)) return true;
    if (business.entityGroup === "restaurant_bar_nightclub") return true;
    const parsed = RdbEntityGroup.safeParse(business.entityGroup);
    if (parsed.success && parsed.data === "restaurant_bar_nightclub") return true;
    if (business.accommodationClass !== "other") return false;
    const other = (business.accommodationClassOther ?? "").toLowerCase();
    return (
        other.includes("coffee") ||
        other.includes("bar") ||
        other.includes("restaurant") ||
        other.includes("nightclub") ||
        other.includes("café") ||
        other.includes("cafe")
    );
}

/** Resolve a stored class, retired or unknown, to one the steps are keyed on. */
export function currentAccommodationClass(stored: string | null | undefined): AccommodationClass {
    const current = AccommodationClass.safeParse(stored);
    if (current.success) return current.data;
    const retired = RetiredAccommodationClass.safeParse(stored);
    if (retired.success) return CURRENT_CLASS[retired.data];
    // A hospitality business with no class on file is set up like "other":
    // every step offered, the heavy ones recommended rather than required.
    return "other";
}

/** The words a business uses, for its checklist and its forms. */
export function setupVocabularyFor(business: SetupBusinessKind): SetupVocabulary {
    if (business.domain === "residence") return RESIDENCE_VOCABULARY;
    if (isFoodVenue(business)) return VENUE_VOCABULARY;
    return HOSPITALITY_VOCABULARY[stayClassOf(business)];
}

/** The class a stay is set up as: the registered kind when it is a class, else the stored class. */
function stayClassOf(business: SetupBusinessKind): AccommodationClass {
    const kind = AccommodationClass.safeParse(business.businessKind);
    return kind.success ? kind.data : currentAccommodationClass(business.accommodationClass);
}

/** How this business's prices are counted: per person, per whole unit, or per menu item. */
export function priceBasisFor(business: SetupBusinessKind): RoomPriceBasis {
    return setupVocabularyFor(business).priceBasis;
}

/** The name of the kind, for a heading: "hotel", "villa", "coffee shop". */
export function setupKindLabel(business: SetupBusinessKind): string {
    if (business.domain === "residence") return "residence";
    if (business.businessKind === "coffee_shop") return "coffee shop";
    if (business.businessKind === "bar_restaurant") return "bar and restaurant";
    if (isFoodVenue(business)) return "venue";
    return stayClassOf(business).replace(/_/g, " ");
}

/**
 * The steps this business sets up, in order.
 *
 * Residence has no departments and no outlets: a landlord lets units, and a
 * restaurant in the building is somebody else's business. A coffee shop or bar
 * has no rooms to number: priced offerings and photographs are enough to go live.
 */
export function setupStepsFor(business: SetupBusinessKind): SetupStep[] {
    const words = setupVocabularyFor(business);
    const residence = business.domain === "residence";
    const venue = !residence && isFoodVenue(business);
    const cls = residence ? null : stayClassOf(business);
    const departmentsRequired = cls !== null && !venue && RUNS_DEPARTMENTS.has(cls);

    const steps: SetupStep[] = [
        {
            key: "property",
            title: venue ? "Venue profile" : "Property profile",
            description: residence
                ? "The building tenants will live in: its name, address and house rules."
                : venue
                  ? "The place customers visit: its name, address and a short description."
                  : "The place guests will book: its name, address, check-in and check-out times.",
            required: true,
        },
        {
            key: "contact",
            title: "Contact details",
            description: residence
                ? "The phone number and email tenants and officers reach the property on."
                : venue
                  ? "The phone number and email customers and officers reach you on."
                  : "The front desk phone number and email guests and officers reach you on.",
            required: true,
        },
    ];

    if (!residence) {
        steps.push({
            key: "departments",
            title: venue ? "Kitchen and service teams" : "Departments and heads",
            description: venue
                ? "If you run separate teams (kitchen, service, cash), name each and who heads it."
                : departmentsRequired
                  ? "Front office, housekeeping, food and beverage and the rest, each with the name and phone number of its head."
                  : "If you run separate teams, name each department and who heads it, with their phone number.",
            required: departmentsRequired,
        });
    }

    steps.push(
        {
            key: "room_types",
            title: words.typePlural,
            description: venue
                ? `Menu items or packages you sell, and the price ${words.pricePeriod}, in Rwandan francs.`
                : words.priceBasis === "per_unit" && !residence && words.pricePeriod === PER_UNIT.pricePeriod
                  ? `Each kind of ${words.unitSingular} you let whole, how many people it sleeps, and its price ${words.pricePeriod}.`
                  : words.priceBasis === "per_unit" && !residence
                    ? `Each kind of ${words.unitSingular} you sell: its beds, who may sleep in it, and its price ${words.pricePeriod}.`
                  : `What you ${residence ? "let" : "sell"}, how many people each sleeps, and its price ${words.pricePeriod}.`,
            required: true,
        },
        {
            key: "rooms",
            title: venue ? "Seating or counters (optional)" : `Your ${words.unitPlural}`,
            description: venue
                ? "Optional. Number tables or counters if you want to track capacity; most coffee shops skip this."
                : `Every ${words.unitSingular} by the number or name on its door, so bookings${residence ? " and leases" : ""} land on a real one and its cleaning status can be tracked.`,
            // Venues do not sell numbered rooms; publish only needs a priced offering.
            required: !venue,
        },
        {
            key: "photos",
            title: "Photos",
            description: venue
                ? "Pictures of the venue. A listing needs at least one before it can go live."
                : "Pictures of the property. A listing needs at least one before it can go live.",
            required: true,
        },
        {
            key: "amenities",
            title: venue ? "Facilities" : "Amenities",
            description: residence
                ? "What the building includes: water, parking, security, internet."
                : venue
                  ? "What the venue offers: Wi-Fi, outdoor seating, parking, takeaway."
                  : "What a stay includes: Wi-Fi, breakfast, parking, a pool.",
            required: false,
        },
    );

    if (!residence) {
        steps.push({
            key: "outlets",
            title: venue ? "Service points" : "Outlets",
            description: venue
                ? "Counters, a terrace or a takeaway point customers order from, and who runs each."
                : "Restaurants, bars, a spa or a shop guests can order from, and who runs each.",
            required: false,
        });
    }

    steps.push(
        {
            key: "staff",
            title: "Staff members",
            description: residence
                ? "Invite a property manager to help run the building."
                : venue
                  ? "Invite managers and staff, each with the role that decides what they can do."
                  : "Invite your manager, front office and housekeeping staff, each with the role that decides what they can do.",
            required: false,
        },
        {
            key: "listing",
            title: "Go live",
            description: residence
                ? "Publish your units so tenants and brokers can find them."
                : venue
                  ? "Publish the venue on the marketplace so customers can find it."
                  : "Publish the property on the marketplace so guests can book it.",
            required: false,
        },
    );

    return steps;
}

/** Is one step finished, judged against the counts the API returned? */
export function isSetupStepDone(key: SetupStepKey, counts: PropertySetupCounts): boolean {
    switch (key) {
        case "property":
            return counts.properties > 0;
        case "contact":
            return counts.contactDetails > 0;
        case "departments":
            // Seeded departments exist the moment a property does, so "done" is
            // somebody having named who heads at least one of them.
            return counts.departmentHeads > 0;
        case "room_types":
            return counts.pricedRoomTypes > 0;
        case "rooms":
            return counts.rooms > 0;
        case "photos":
            return counts.photos > 0;
        case "amenities":
            return counts.amenities > 0;
        case "outlets":
            return counts.outlets > 0;
        case "staff":
            return counts.staff > 0;
        case "listing":
            return counts.published > 0;
    }
}

/** How much of the checklist is finished: all steps, and the required ones. */
export function setupCompletion(
    steps: readonly SetupStep[],
    counts: PropertySetupCounts,
): { done: number; total: number; requiredDone: number; requiredTotal: number } {
    let done = 0;
    let requiredDone = 0;
    let requiredTotal = 0;
    for (const step of steps) {
        const finished = isSetupStepDone(step.key, counts);
        if (finished) done += 1;
        if (step.required) {
            requiredTotal += 1;
            if (finished) requiredDone += 1;
        }
    }
    return { done, total: steps.length, requiredDone, requiredTotal };
}
