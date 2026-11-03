"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUSINESS_KIND_NOUN = exports.BUSINESS_KIND_LABEL = exports.HospitalityKind = exports.VENUE_KINDS = exports.STAY_KINDS = exports.BusinessKind = void 0;
exports.isVenueKind = isVenueKind;
exports.isStayKind = isStayKind;
exports.registerHeadingFor = registerHeadingFor;
exports.businessTypeForKind = businessTypeForKind;
exports.entityGroupForKind = entityGroupForKind;
exports.hospitalityKindOf = hospitalityKindOf;
const zod_1 = require("zod");
/**
 * What kind of business an org is (ADR-075 D-h, AC-31): one value on every org, and the one vocabulary the
 * register's heading, the fee, the documents, the PSF case, setup and search filters read.
 *
 * Before it, Bar & Restaurant was free text under accommodation class `other`, and Coffee Shop had nowhere to
 * live at all. The accommodation class stays, for stays only: it is RDB's classification of a place guests sleep,
 * and a venue with no rooms has none.
 *
 * `broker` is in the vocabulary so a broker can be named in the same words, but a broker is a `brokers` row, never
 * an org: it registers at `POST /registrations/broker` and is outside the register (AC-1).
 */
exports.BusinessKind = zod_1.z.enum([
    "hotel",
    "motel",
    "tented_camp",
    "guest_house",
    "apartment",
    "lodge",
    "villa",
    "other",
    "bar_restaurant",
    "coffee_shop",
    "residence",
    "broker",
]);
/** The kinds that are a place guests stay the night; each is also its own accommodation class. */
exports.STAY_KINDS = ["hotel", "motel", "tented_camp", "guest_house", "apartment", "lodge", "villa", "other"];
/** The kinds that serve food and drink and have no rooms (ADR-075 O-14). */
exports.VENUE_KINDS = ["bar_restaurant", "coffee_shop"];
/** The kinds a hospitality org may carry: every stay and every venue. */
exports.HospitalityKind = zod_1.z.enum([...exports.STAY_KINDS, ...exports.VENUE_KINDS]);
function isVenueKind(kind) {
    return exports.VENUE_KINDS.includes(kind);
}
function isStayKind(kind) {
    return exports.STAY_KINDS.includes(kind);
}
/** The name of a kind, as a tile or a list says it. */
exports.BUSINESS_KIND_LABEL = {
    hotel: "Hotel",
    motel: "Motel",
    tented_camp: "Tented Camp",
    guest_house: "Guest House",
    apartment: "Apartment",
    lodge: "Lodge",
    villa: "Villa",
    other: "Other",
    bar_restaurant: "Bar & Restaurant",
    coffee_shop: "Coffee Shop",
    residence: "Residence",
    broker: "Broker",
};
/**
 * The kind as a noun in a sentence: "Register your coffee shop" (ADR-075 O-2, AC-2). Null where no noun fits,
 * which a heading reads as "business": "Other" is "Register your business".
 */
exports.BUSINESS_KIND_NOUN = {
    hotel: "hotel",
    motel: "motel",
    tented_camp: "tented camp",
    guest_house: "guest house",
    apartment: "apartment",
    lodge: "lodge",
    villa: "villa",
    other: null,
    bar_restaurant: "bar & restaurant",
    coffee_shop: "coffee shop",
    residence: "residence",
    broker: null,
};
/** "Register your coffee shop", or "Register your business" for a kind with no noun. */
function registerHeadingFor(kind) {
    return `Register your ${exports.BUSINESS_KIND_NOUN[kind] ?? "business"}`;
}
/** The fee table's key for a kind (ADR-075 D-j): every stay and venue is `hospitality`. */
function businessTypeForKind(kind) {
    if (kind === "residence" || kind === "broker")
        return kind;
    return "hospitality";
}
/** The RDB entity group a hospitality kind sits in: a venue is `restaurant_bar_nightclub`, a stay `accommodation`. */
function entityGroupForKind(kind) {
    return isVenueKind(kind) ? "restaurant_bar_nightclub" : "accommodation";
}
/**
 * The kind of a hospitality registration from what it says, for a request that names no `businessKind` (one
 * built before ADR-075). A stay's kind is its accommodation class; the old free text Bar & Restaurant is
 * `bar_restaurant`.
 */
function hospitalityKindOf(b) {
    if (b.businessKind)
        return b.businessKind;
    if (b.accommodationClass === "other" &&
        b.entityGroup === "restaurant_bar_nightclub" &&
        b.accommodationClassOther?.trim().toLowerCase() === "bar & restaurant") {
        return "bar_restaurant";
    }
    return b.accommodationClass ?? null;
}
//# sourceMappingURL=business-kind.js.map