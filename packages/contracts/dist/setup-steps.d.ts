import type { RoomPriceBasis } from "./booking";
import type { PropertySetupCounts } from "./inventory";
import type { Domain } from "./primitives";
import { AccommodationClass, RetiredAccommodationClass } from "./rdb";
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
export declare const SETUP_STEP_KEYS: readonly ["property", "contact", "departments", "room_types", "rooms", "photos", "amenities", "outlets", "staff", "listing"];
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
/**
 * True for coffee shops, bars and restaurants: F&B venues registered under
 * `restaurant_bar_nightclub`, or `other` whose free text names a venue.
 *
 * They share lodging inventory tables but must not be asked for rooms,
 * check-in times or "per person, per night" pricing.
 */
export declare function isFoodVenue(business: {
    entityGroup?: string | null;
    accommodationClass?: string | null;
    accommodationClassOther?: string | null;
    businessKind?: string | null;
}): boolean;
/** Resolve a stored class, retired or unknown, to one the steps are keyed on. */
export declare function currentAccommodationClass(stored: string | null | undefined): AccommodationClass;
/** The words a business uses, for its checklist and its forms. */
export declare function setupVocabularyFor(business: SetupBusinessKind): SetupVocabulary;
/** How this business's prices are counted: per person, per whole unit, or per menu item. */
export declare function priceBasisFor(business: SetupBusinessKind): RoomPriceBasis;
/** The name of the kind, for a heading: "hotel", "villa", "coffee shop". */
export declare function setupKindLabel(business: SetupBusinessKind): string;
/**
 * The steps this business sets up, in order.
 *
 * Residence has no departments and no outlets: a landlord lets units, and a
 * restaurant in the building is somebody else's business. A coffee shop or bar
 * has no rooms to number: priced offerings and photographs are enough to go live.
 */
export declare function setupStepsFor(business: SetupBusinessKind): SetupStep[];
/** Is one step finished, judged against the counts the API returned? */
export declare function isSetupStepDone(key: SetupStepKey, counts: PropertySetupCounts): boolean;
/** How much of the checklist is finished: all steps, and the required ones. */
export declare function setupCompletion(steps: readonly SetupStep[], counts: PropertySetupCounts): {
    done: number;
    total: number;
    requiredDone: number;
    requiredTotal: number;
};
export {};
//# sourceMappingURL=setup-steps.d.ts.map