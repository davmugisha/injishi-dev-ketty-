import type { PropertySetupCounts } from "./inventory";
import type { Domain } from "./primitives";
import { AccommodationClass, RetiredAccommodationClass } from "./rdb";
/**
 * What an APPROVED business sets up before it can trade, per kind of business.
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
 * business may write any of this (D20): these steps only exist once it is
 * `active`, which is the ruling this file was written under (2026-09-13).
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
    /** "per night" or "per month". */
    pricePeriod: string;
}
type StoredClass = AccommodationClass | RetiredAccommodationClass;
/** Resolve a stored class, retired or unknown, to one the steps are keyed on. */
export declare function currentAccommodationClass(stored: string | null | undefined): AccommodationClass;
/** The words a business uses, for its checklist and its forms. */
export declare function setupVocabularyFor(business: {
    domain: Domain;
    accommodationClass: StoredClass | string | null;
}): SetupVocabulary;
/**
 * The steps this business sets up, in order.
 *
 * Residence has no departments and no outlets: a landlord lets units, and a
 * restaurant in the building is somebody else's business.
 */
export declare function setupStepsFor(business: {
    domain: Domain;
    accommodationClass: StoredClass | string | null;
}): SetupStep[];
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