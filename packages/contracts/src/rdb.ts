import { z } from "zod";
/**
 * RDB classification taxonomy (dox_context/rdb-classification.md).
 * Previously duplicated verbatim inside apps/admin/src/lib/types.ts — this is
 * now the single source; the admin app re-exports from here.
 */
export const RdbClassificationKind = z.enum([
    "entity_group",
    "accommodation_class",
    "residence_class",
]);
export type RdbClassificationKind = z.infer<typeof RdbClassificationKind>;
/** RDB tourism entity groups (§1). v1 onboards `accommodation`. */
export const RdbEntityGroup = z.enum([
    "accommodation",
    "restaurant_bar_nightclub",
    "travel_services",
    "tourism_information_center",
    "cultural_tourism",
]);
export type RdbEntityGroup = z.infer<typeof RdbEntityGroup>;
/**
 * The 8 accommodation classes the registration wizard offers as cards (D24).
 *
 * These replace the RDB licensing vocabulary, deliberately. A registrant knows
 * whether they run a guest house; they do not reliably know whether RDB would
 * call their hotel a Town Hotel or a Vacation Hotel & Resort, and forcing that
 * guess at signup writes a wrong licence class onto the row. `other` plus a
 * free-text description is the honest escape.
 *
 * The underlying table is a CATALOG, not an enum, so this list is the picker's
 * contract — never a reason to migrate. See `RetiredAccommodationClass` for the
 * codes an existing org may still legitimately hold.
 */
export const AccommodationClass = z.enum([
    "hotel",
    "motel",
    "tented_camp",
    "guest_house",
    "apartment",
    "lodge",
    "villa",
    "other",
]);
export type AccommodationClass = z.infer<typeof AccommodationClass>;
/**
 * Soft-retired RDB codes (D24). Never offered in the picker, still readable:
 * an org registered before the change keeps its code, because a vocabulary
 * change must not rewrite what someone already declared.
 */
export const RetiredAccommodationClass = z.enum([
    "town_hotel",
    "vacation_hotel_resort",
    "serviced_apartment",
    "cottage",
]);
export type RetiredAccommodationClass = z.infer<typeof RetiredAccommodationClass>;
/** What an org's `accommodation_class` column may hold: current or retired. */
export const StoredAccommodationClass = z.union([
    AccommodationClass,
    RetiredAccommodationClass,
]);
export type StoredAccommodationClass = z.infer<typeof StoredAccommodationClass>;
/** Display labels for the cards, in the order the wizard shows them. */
export const ACCOMMODATION_CLASS_LABEL: Readonly<Record<AccommodationClass, string>> = {
    hotel: "Hotel",
    motel: "Motel",
    tented_camp: "Tented Camp",
    guest_house: "Guest House",
    apartment: "Apartment",
    lodge: "Lodge",
    villa: "Villa",
    other: "Other",
};
/** Residence org classification (§3). */
export const ResidenceClass = z.enum([
    "residential_landlord",
    "residential_property_manager",
]);
export type ResidenceClass = z.infer<typeof ResidenceClass>;
/** EAC star grade; undefined = not yet graded. */
export const EacStarGrade = z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
]);
export type EacStarGrade = z.infer<typeof EacStarGrade>;