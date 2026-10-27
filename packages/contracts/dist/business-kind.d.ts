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
export declare const BusinessKind: z.ZodEnum<["hotel", "motel", "tented_camp", "guest_house", "apartment", "lodge", "villa", "other", "bar_restaurant", "coffee_shop", "residence", "broker"]>;
export type BusinessKind = z.infer<typeof BusinessKind>;
/** The kinds that are a place guests stay the night; each is also its own accommodation class. */
export declare const STAY_KINDS: readonly ["hotel", "motel", "tented_camp", "guest_house", "apartment", "lodge", "villa", "other"];
export type StayKind = (typeof STAY_KINDS)[number];
/** The kinds that serve food and drink and have no rooms (ADR-075 O-14). */
export declare const VENUE_KINDS: readonly ["bar_restaurant", "coffee_shop"];
export type VenueKind = (typeof VENUE_KINDS)[number];
/** The kinds a hospitality org may carry: every stay and every venue. */
export declare const HospitalityKind: z.ZodEnum<["hotel", "motel", "tented_camp", "guest_house", "apartment", "lodge", "villa", "other", "bar_restaurant", "coffee_shop"]>;
export type HospitalityKind = z.infer<typeof HospitalityKind>;
export declare function isVenueKind(kind: string): kind is VenueKind;
export declare function isStayKind(kind: string): kind is StayKind;
/** The name of a kind, as a tile or a list says it. */
export declare const BUSINESS_KIND_LABEL: Readonly<Record<BusinessKind, string>>;
/**
 * The kind as a noun in a sentence: "Register your coffee shop" (ADR-075 O-2, AC-2). Null where no noun fits,
 * which a heading reads as "business": "Other" is "Register your business".
 */
export declare const BUSINESS_KIND_NOUN: Readonly<Record<BusinessKind, string | null>>;
/** "Register your coffee shop", or "Register your business" for a kind with no noun. */
export declare function registerHeadingFor(kind: BusinessKind): string;
/** The fee table's key for a kind (ADR-075 D-j): every stay and venue is `hospitality`. */
export declare function businessTypeForKind(kind: BusinessKind): "hospitality" | "residence" | "broker";
/** The RDB entity group a hospitality kind sits in: a venue is `restaurant_bar_nightclub`, a stay `accommodation`. */
export declare function entityGroupForKind(kind: HospitalityKind): "accommodation" | "restaurant_bar_nightclub";
/**
 * The kind of a hospitality registration from what it says, for a request that names no `businessKind` (one
 * built before ADR-075). A stay's kind is its accommodation class; the old free text Bar & Restaurant is
 * `bar_restaurant`.
 */
export declare function hospitalityKindOf(b: {
    businessKind?: HospitalityKind;
    accommodationClass?: AccommodationClass;
    accommodationClassOther?: string;
    entityGroup?: string;
}): HospitalityKind | null;
//# sourceMappingURL=business-kind.d.ts.map