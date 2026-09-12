"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EacStarGrade = exports.ResidenceClass = exports.ACCOMMODATION_CLASS_LABEL = exports.StoredAccommodationClass = exports.RetiredAccommodationClass = exports.AccommodationClass = exports.RdbEntityGroup = exports.RdbClassificationKind = void 0;
const zod_1 = require("zod");
/**
 * RDB classification taxonomy (dox_context/rdb-classification.md).
 * Previously duplicated verbatim inside apps/admin/src/lib/types.ts — this is
 * now the single source; the admin app re-exports from here.
 */
exports.RdbClassificationKind = zod_1.z.enum([
    "entity_group",
    "accommodation_class",
    "residence_class",
]);
/** RDB tourism entity groups (§1). v1 onboards `accommodation`. */
exports.RdbEntityGroup = zod_1.z.enum([
    "accommodation",
    "restaurant_bar_nightclub",
    "travel_services",
    "tourism_information_center",
    "cultural_tourism",
]);
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
exports.AccommodationClass = zod_1.z.enum([
    "hotel",
    "motel",
    "tented_camp",
    "guest_house",
    "apartment",
    "lodge",
    "villa",
    "other",
]);
/**
 * Soft-retired RDB codes (D24). Never offered in the picker, still readable:
 * an org registered before the change keeps its code, because a vocabulary
 * change must not rewrite what someone already declared.
 */
exports.RetiredAccommodationClass = zod_1.z.enum([
    "town_hotel",
    "vacation_hotel_resort",
    "serviced_apartment",
    "cottage",
]);
/** What an org's `accommodation_class` column may hold: current or retired. */
exports.StoredAccommodationClass = zod_1.z.union([
    exports.AccommodationClass,
    exports.RetiredAccommodationClass,
]);
/** Display labels for the cards, in the order the wizard shows them. */
exports.ACCOMMODATION_CLASS_LABEL = {
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
exports.ResidenceClass = zod_1.z.enum([
    "residential_landlord",
    "residential_property_manager",
]);
/** EAC star grade; undefined = not yet graded. */
exports.EacStarGrade = zod_1.z.union([
    zod_1.z.literal(1),
    zod_1.z.literal(2),
    zod_1.z.literal(3),
    zod_1.z.literal(4),
    zod_1.z.literal(5),
]);
//# sourceMappingURL=rdb.js.map