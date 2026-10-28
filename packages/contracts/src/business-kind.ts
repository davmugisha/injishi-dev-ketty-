import { z } from "zod";
import { type AccommodationClass } from "./rdb";

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
export const BusinessKind = z.enum([
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
export type BusinessKind = z.infer<typeof BusinessKind>;

/** The kinds that are a place guests stay the night; each is also its own accommodation class. */
export const STAY_KINDS = ["hotel", "motel", "tented_camp", "guest_house", "apartment", "lodge", "villa", "other"] as const;
export type StayKind = (typeof STAY_KINDS)[number];

/** The kinds that serve food and drink and have no rooms (ADR-075 O-14). */
export const VENUE_KINDS = ["bar_restaurant", "coffee_shop"] as const;
export type VenueKind = (typeof VENUE_KINDS)[number];

/** The kinds a hospitality org may carry: every stay and every venue. */
export const HospitalityKind = z.enum([...STAY_KINDS, ...VENUE_KINDS]);
export type HospitalityKind = z.infer<typeof HospitalityKind>;

export function isVenueKind(kind: string): kind is VenueKind {
    return (VENUE_KINDS as readonly string[]).includes(kind);
}

export function isStayKind(kind: string): kind is StayKind {
    return (STAY_KINDS as readonly string[]).includes(kind);
}

/** The name of a kind, as a tile or a list says it. */
export const BUSINESS_KIND_LABEL: Readonly<Record<BusinessKind, string>> = {
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
export const BUSINESS_KIND_NOUN: Readonly<Record<BusinessKind, string | null>> = {
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
export function registerHeadingFor(kind: BusinessKind): string {
    return `Register your ${BUSINESS_KIND_NOUN[kind] ?? "business"}`;
}

/** The fee table's key for a kind (ADR-075 D-j): every stay and venue is `hospitality`. */
export function businessTypeForKind(kind: BusinessKind): "hospitality" | "residence" | "broker" {
    if (kind === "residence" || kind === "broker") return kind;
    return "hospitality";
}

/** The RDB entity group a hospitality kind sits in: a venue is `restaurant_bar_nightclub`, a stay `accommodation`. */
export function entityGroupForKind(kind: HospitalityKind): "accommodation" | "restaurant_bar_nightclub" {
    return isVenueKind(kind) ? "restaurant_bar_nightclub" : "accommodation";
}

/**
 * The kind of a hospitality registration from what it says, for a request that names no `businessKind` (one
 * built before ADR-075). A stay's kind is its accommodation class; the old free text Bar & Restaurant is
 * `bar_restaurant`.
 */
export function hospitalityKindOf(b: {
    businessKind?: HospitalityKind;
    accommodationClass?: AccommodationClass;
    accommodationClassOther?: string;
    entityGroup?: string;
}): HospitalityKind | null {
    if (b.businessKind) return b.businessKind;
    if (
        b.accommodationClass === "other" &&
        b.entityGroup === "restaurant_bar_nightclub" &&
        b.accommodationClassOther?.trim().toLowerCase() === "bar & restaurant"
    ) {
        return "bar_restaurant";
    }
    return b.accommodationClass ?? null;
}
