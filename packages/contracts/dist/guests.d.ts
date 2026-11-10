import { z } from "zod";
import { OversightRole, OversightScopeLevel } from "./primitives";
import { IdKind } from "./rentals/vocab";
/** Rwanda's ISO code: the nationality a guest has unless the form says otherwise. */
export declare const RWANDA_CODE = "RW";
/** How long a guest record is kept after the guest leaves, then purged (counts are kept). */
export declare const GUEST_RETENTION_MONTHS = 12;
/** How far ahead the leader's Arriving tab looks. */
export declare const LEADER_ARRIVING_DAYS = 7;
/**
 * Every leader post the database knows. Two chains are in use, each village, cell, district
 * (`CHAIN_ROLES`): local government reads every guest, Rwandan or foreign; the immigration directorate
 * (DGIE) reads guests from abroad only. The DASSO, sector executive and DGIE province and headquarters
 * posts are retired: kept so older records still read, never routed to or appointed again.
 */
export declare const LEADER_ROLES: readonly ["village_leader", "cell_executive", "district_officer", "dgie_village", "dgie_cell", "district_immigration", "dasso", "sector_executive", "dgie_province", "dgie_national"];
export declare const LeaderRole: z.ZodEnum<["village_leader", "cell_executive", "district_officer", "dgie_village", "dgie_cell", "district_immigration", "dasso", "sector_executive", "dgie_province", "dgie_national"]>;
export type LeaderRole = z.infer<typeof LeaderRole>;
/** Is this oversight role one of the local leaders? */
export declare function isLeaderRole(role: OversightRole | string): role is LeaderRole;
/** The posts guests are routed to and admins appoint, in the order of the chains. */
export declare const CHAIN_ROLES: readonly ["village_leader", "cell_executive", "district_officer", "dgie_village", "dgie_cell", "district_immigration"];
export type ChainRole = (typeof CHAIN_ROLES)[number];
/** Is this post one guests go to now (not a retired one)? */
export declare function isChainRole(role: string): role is ChainRole;
/** The roles that review businesses (field verification and approval). */
export declare const REVIEWER_ROLES: readonly ["business_field_verifier", "business_approver"];
/** What each leader is called, in full. */
export declare const LEADER_ROLE_LABEL: Readonly<Record<LeaderRole, string>>;
/** The short words a chip or a column uses. */
export declare const LEADER_ROLE_SHORT: Readonly<Record<LeaderRole, string>>;
/** Where each post sits in a registration's chain, from 1: local government 1 to 3, DGIE 4 to 6. */
export declare const LEADER_ROLE_STEP: Readonly<Record<LeaderRole, number>>;
/** Which body's chain a post is in: local government sees every guest, DGIE guests from abroad. */
export declare const LEADER_ROLE_CHAIN: Readonly<Record<LeaderRole, "local" | "dgie">>;
/** The level of the map each leader covers: the one scope level their appointment may name. */
export type LeaderLevel = "village" | "cell" | "sector" | "district" | "province" | "country";
export declare const LEADER_ROLE_SCOPE: Readonly<Record<LeaderRole, LeaderLevel>>;
/** The government body a leader is appointed under unless the admin picks another. */
export declare const LEADER_ROLE_BODY: Readonly<Record<LeaderRole, string>>;
/**
 * The scope levels each oversight role may be appointed at. A leader covers one
 * level; a business reviewer or tax officer the country, a province or a
 * district; a PSF membership officer the country only.
 */
export declare const OVERSIGHT_ROLE_SCOPES: Readonly<Record<OversightRole, readonly OversightScopeLevel[]>>;
/**
 * The chain a registration goes along, in order: local government's village leader, cell executive
 * secretary and district officer for every guest; DGIE's village, cell and district officers too for a
 * guest from abroad.
 */
export declare function guestChainFor(fromAbroad: boolean): LeaderRole[];
/** A guest is "from abroad" when their nationality is not Rwandan. */
export declare function isFromAbroad(nationality: string): boolean;
/** `hotel`: a guest checked in at a hotel, motel or lodge, filed by the desk (0114). */
export declare const GuestHostKind: z.ZodEnum<["tenant", "landlord", "hotel"]>;
export type GuestHostKind = z.infer<typeof GuestHostKind>;
export declare const GuestRegistrationStatus: z.ZodEnum<["submitted", "cancelled"]>;
export type GuestRegistrationStatus = z.infer<typeof GuestRegistrationStatus>;
/** Where a stay is on a given day. */
export declare const GuestStay: z.ZodEnum<["arriving", "staying", "left"]>;
export type GuestStay = z.infer<typeof GuestStay>;
/** Where one step of the chain stands: nobody holds the post yet, delivered, or opened. */
export declare const GuestRouteState: z.ZodEnum<["waiting", "delivered", "seen"]>;
export type GuestRouteState = z.infer<typeof GuestRouteState>;
/** Where a stay is on `today`: still to come, under way, or over. */
export declare function guestStayOn(today: string, arrivalOn: string, departureOn: string): GuestStay;
/** Nights a stay covers: arriving and leaving the same day is 0. */
export declare function guestNights(arrivalOn: string, departureOn: string): number;
/**
 * Who a guest is to the host: the `guest_relationships` reference table's rows,
 * in the order a form offers them. `other` asks for a few words.
 */
export declare const GUEST_RELATIONSHIPS: ReadonlyArray<{
    code: string;
    label: string;
    needsDetail: boolean;
}>;
/** The relationship that asks for its own words. */
export declare const OTHER_RELATIONSHIP = "other";
/**
 * The type of place, as a leader's filter and column name it: a hotel desk files its guests from the business
 * (`orgs.business_kind`), a tenant or landlord from a residence. A motel counts as a hotel, a tented camp as
 * a lodge and a villa as apartments; the exact kind is still shown (`guestPlaceKindLabel`).
 */
export declare const GUEST_PLACE_TYPES: readonly ["hotel", "lodge", "guest_house", "apartment", "residence", "other"];
export declare const GuestPlaceType: z.ZodEnum<["hotel", "lodge", "guest_house", "apartment", "residence", "other"]>;
export type GuestPlaceType = z.infer<typeof GuestPlaceType>;
export declare const GUEST_PLACE_TYPE_LABEL: Readonly<Record<GuestPlaceType, string>>;
/** The business kinds each type of place covers (a residence is any tenant's or landlord's guest). */
export declare const GUEST_PLACE_TYPE_KINDS: Readonly<Record<Exclude<GuestPlaceType, "residence" | "other">, readonly string[]>>;
/** The type of place from who filed the guest and the business's kind. */
export declare function guestPlaceTypeOf(hostKind: GuestHostKind, businessKind: string | null | undefined): GuestPlaceType;
/** The place's own kind in words: "Motel", "Tented camp", "Residence". */
export declare function guestPlaceKindLabel(hostKind: GuestHostKind, businessKind: string | null | undefined): string;
/** When guests arrived, relative to the Kigali day: a shared link keeps meaning "today". */
export declare const GuestArrived: z.ZodEnum<["today", "yesterday", "last_7_days", "this_month"]>;
export type GuestArrived = z.infer<typeof GuestArrived>;
export declare const GUEST_ARRIVED_LABEL: Readonly<Record<GuestArrived, string>>;
/** The days a preset covers, first and last included. */
export declare function guestArrivedRange(preset: GuestArrived, today: string): {
    from: string;
    to: string;
};
/** When guests leave: today, or within the next 7 days (today included). */
export declare const GuestLeaving: z.ZodEnum<["today", "next_7_days"]>;
export type GuestLeaving = z.infer<typeof GuestLeaving>;
export declare const GUEST_LEAVING_LABEL: Readonly<Record<GuestLeaving, string>>;
/** How long the stay is, in nights from arrival to departure. */
export declare const GuestLength: z.ZodEnum<["under_3", "week", "month"]>;
export type GuestLength = z.infer<typeof GuestLength>;
export declare const GUEST_LENGTH_LABEL: Readonly<Record<GuestLength, string>>;
/** The nights each length covers: `min` and `max` included. */
export declare const GUEST_LENGTH_NIGHTS: Readonly<Record<GuestLength, {
    min?: number;
    max?: number;
}>>;
/** Does a stay of so many nights fall in a length? */
export declare function guestLengthHolds(length: GuestLength, nights: number): boolean;
/**
 * Who reads a console: local government (every guest, Rwandan or foreign) or DGIE (guests from abroad only).
 * A person holding posts in both reads as local government, the wider of the two.
 */
export declare const LeaderAudience: z.ZodEnum<["local", "dgie"]>;
export type LeaderAudience = z.infer<typeof LeaderAudience>;
export declare function leaderAudienceOf(roles: readonly LeaderRole[]): LeaderAudience;
/**
 * Where a guest stays, in two lines for a list or a file: the place (the business, or the landlord's
 * building), and who hosted them there (the room, the tenant and their unit, or the landlord).
 */
export declare function guestHostLines(g: {
    host: {
        kind: GuestHostKind;
        name: string;
    };
    place: {
        name: string;
        room: string | null;
    };
}): {
    place: string;
    detail: string;
};
/**
 * A guest's phone in E.164: a Rwandan mobile however it is spaced
 * (`0788 123 456`), or a number from another country with its + code. The
 * same rule as the kit's `PhoneInput` with `allowInternational`.
 */
export declare function normaliseGuestPhone(raw: string): string | null;
export declare const GuestPhone: z.ZodEffects<z.ZodString, string, string>;
/** An ISO 3166-1 alpha-2 code from the list the country picker offers. */
export declare const GuestCountryCode: z.ZodEffects<z.ZodString, string, string>;
/**
 * Where the guest is coming from: a village in Rwanda, picked down the place
 * cascade, or another country.
 */
export declare const GuestOrigin: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
    kind: z.ZodLiteral<"village">;
    villageId: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    kind: "village";
    villageId: number;
}, {
    kind: "village";
    villageId: number;
}>, z.ZodObject<{
    kind: z.ZodLiteral<"country">;
    countryCode: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    kind: "country";
    countryCode: string;
}, {
    kind: "country";
    countryCode: string;
}>]>;
export type GuestOrigin = z.infer<typeof GuestOrigin>;
/**
 * Why an ID is not acceptable for this nationality, or null. Optional: an empty
 * number is fine. A national ID is Rwandan only; a number given with no kind is
 * read as a national ID for a Rwandan and a passport otherwise.
 */
export declare function guestIdProblem(input: {
    nationality: string;
    idKind?: IdKind | null;
    idNumber?: string | null;
}): {
    path: "idKind" | "idNumber";
    message: string;
} | null;
/** The ID as stored: both null when none was given, else the kind and the normalised number. */
export declare function guestIdOf(input: {
    nationality: string;
    idKind?: IdKind | null;
    idNumber?: string | null;
}): {
    idKind: IdKind | null;
    idNumber: string | null;
};
/** A tenant registers a guest for their lease: `POST /me/tenancies/:leaseId/guests`, and `PATCH …/:id`. */
export declare const TenantGuestRequest: z.ZodEffects<z.ZodObject<{
    fullName: z.ZodString;
    phone: z.ZodEffects<z.ZodString, string, string>;
    nationality: z.ZodDefault<z.ZodEffects<z.ZodString, string, string>>;
    idKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["national_id", "passport"]>>>;
    idNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    relationship: z.ZodString;
    relationshipOther: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    origin: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
        kind: z.ZodLiteral<"village">;
        villageId: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        kind: "village";
        villageId: number;
    }, {
        kind: "village";
        villageId: number;
    }>, z.ZodObject<{
        kind: z.ZodLiteral<"country">;
        countryCode: z.ZodEffects<z.ZodString, string, string>;
    }, "strip", z.ZodTypeAny, {
        kind: "country";
        countryCode: string;
    }, {
        kind: "country";
        countryCode: string;
    }>]>;
    arrivalOn: z.ZodEffects<z.ZodString, string, string>;
    departureOn: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    fullName: string;
    origin: {
        kind: "village";
        villageId: number;
    } | {
        kind: "country";
        countryCode: string;
    };
    phone: string;
    nationality: string;
    arrivalOn: string;
    departureOn: string;
    relationship: string;
    idNumber?: string | null | undefined;
    idKind?: "national_id" | "passport" | null | undefined;
    relationshipOther?: string | null | undefined;
}, {
    fullName: string;
    origin: {
        kind: "village";
        villageId: number;
    } | {
        kind: "country";
        countryCode: string;
    };
    phone: string;
    arrivalOn: string;
    departureOn: string;
    relationship: string;
    idNumber?: string | null | undefined;
    nationality?: string | undefined;
    idKind?: "national_id" | "passport" | null | undefined;
    relationshipOther?: string | null | undefined;
}>, {
    fullName: string;
    origin: {
        kind: "village";
        villageId: number;
    } | {
        kind: "country";
        countryCode: string;
    };
    phone: string;
    nationality: string;
    arrivalOn: string;
    departureOn: string;
    relationship: string;
    idNumber?: string | null | undefined;
    idKind?: "national_id" | "passport" | null | undefined;
    relationshipOther?: string | null | undefined;
}, {
    fullName: string;
    origin: {
        kind: "village";
        villageId: number;
    } | {
        kind: "country";
        countryCode: string;
    };
    phone: string;
    arrivalOn: string;
    departureOn: string;
    relationship: string;
    idNumber?: string | null | undefined;
    nationality?: string | undefined;
    idKind?: "national_id" | "passport" | null | undefined;
    relationshipOther?: string | null | undefined;
}>;
export type TenantGuestRequest = z.infer<typeof TenantGuestRequest>;
/** A landlord registers their own guest at one of their buildings: `POST /ops/guests`, and `PATCH …/:id`. */
export declare const LandlordGuestRequest: z.ZodEffects<z.ZodObject<{
    propertyId: z.ZodString;
    unitId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    fullName: z.ZodString;
    phone: z.ZodEffects<z.ZodString, string, string>;
    nationality: z.ZodDefault<z.ZodEffects<z.ZodString, string, string>>;
    idKind: z.ZodOptional<z.ZodNullable<z.ZodEnum<["national_id", "passport"]>>>;
    idNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    relationship: z.ZodString;
    relationshipOther: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    origin: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
        kind: z.ZodLiteral<"village">;
        villageId: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        kind: "village";
        villageId: number;
    }, {
        kind: "village";
        villageId: number;
    }>, z.ZodObject<{
        kind: z.ZodLiteral<"country">;
        countryCode: z.ZodEffects<z.ZodString, string, string>;
    }, "strip", z.ZodTypeAny, {
        kind: "country";
        countryCode: string;
    }, {
        kind: "country";
        countryCode: string;
    }>]>;
    arrivalOn: z.ZodEffects<z.ZodString, string, string>;
    departureOn: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    fullName: string;
    origin: {
        kind: "village";
        villageId: number;
    } | {
        kind: "country";
        countryCode: string;
    };
    phone: string;
    nationality: string;
    propertyId: string;
    arrivalOn: string;
    departureOn: string;
    relationship: string;
    idNumber?: string | null | undefined;
    unitId?: string | null | undefined;
    idKind?: "national_id" | "passport" | null | undefined;
    relationshipOther?: string | null | undefined;
}, {
    fullName: string;
    origin: {
        kind: "village";
        villageId: number;
    } | {
        kind: "country";
        countryCode: string;
    };
    phone: string;
    propertyId: string;
    arrivalOn: string;
    departureOn: string;
    relationship: string;
    idNumber?: string | null | undefined;
    nationality?: string | undefined;
    unitId?: string | null | undefined;
    idKind?: "national_id" | "passport" | null | undefined;
    relationshipOther?: string | null | undefined;
}>, {
    fullName: string;
    origin: {
        kind: "village";
        villageId: number;
    } | {
        kind: "country";
        countryCode: string;
    };
    phone: string;
    nationality: string;
    propertyId: string;
    arrivalOn: string;
    departureOn: string;
    relationship: string;
    idNumber?: string | null | undefined;
    unitId?: string | null | undefined;
    idKind?: "national_id" | "passport" | null | undefined;
    relationshipOther?: string | null | undefined;
}, {
    fullName: string;
    origin: {
        kind: "village";
        villageId: number;
    } | {
        kind: "country";
        countryCode: string;
    };
    phone: string;
    propertyId: string;
    arrivalOn: string;
    departureOn: string;
    relationship: string;
    idNumber?: string | null | undefined;
    nationality?: string | undefined;
    unitId?: string | null | undefined;
    idKind?: "national_id" | "passport" | null | undefined;
    relationshipOther?: string | null | undefined;
}>;
export type LandlordGuestRequest = z.infer<typeof LandlordGuestRequest>;
/** One step of the chain as the host reads it: who it went to and where it stands. Never a flag. */
export declare const HostChainStep: z.ZodObject<{
    role: z.ZodEnum<["village_leader", "cell_executive", "district_officer", "dgie_village", "dgie_cell", "district_immigration", "dasso", "sector_executive", "dgie_province", "dgie_national"]>;
    roleLabel: z.ZodString;
    step: z.ZodNumber;
    state: z.ZodEnum<["waiting", "delivered", "seen"]>;
}, "strip", z.ZodTypeAny, {
    state: "waiting" | "delivered" | "seen";
    role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
    step: number;
    roleLabel: string;
}, {
    state: "waiting" | "delivered" | "seen";
    role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
    step: number;
    roleLabel: string;
}>;
export type HostChainStep = z.infer<typeof HostChainStep>;
export declare const HostGuest: z.ZodObject<{
    id: z.ZodString;
    hostKind: z.ZodEnum<["tenant", "landlord", "hotel"]>;
    fullName: z.ZodString;
    phone: z.ZodString;
    nationality: z.ZodString;
    nationalityName: z.ZodString;
    fromAbroad: z.ZodBoolean;
    idKind: z.ZodNullable<z.ZodEnum<["national_id", "passport"]>>;
    idNumber: z.ZodNullable<z.ZodString>;
    relationship: z.ZodString;
    relationshipLabel: z.ZodString;
    relationshipOther: z.ZodNullable<z.ZodString>;
    origin: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
        kind: z.ZodLiteral<"village">;
        villageId: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        kind: "village";
        villageId: number;
    }, {
        kind: "village";
        villageId: number;
    }>, z.ZodObject<{
        kind: z.ZodLiteral<"country">;
        countryCode: z.ZodEffects<z.ZodString, string, string>;
    }, "strip", z.ZodTypeAny, {
        kind: "country";
        countryCode: string;
    }, {
        kind: "country";
        countryCode: string;
    }>]>;
    /** Where they come from, in words: the village path or the country. */
    originWords: z.ZodString;
    arrivalOn: z.ZodString;
    departureOn: z.ZodString;
    nights: z.ZodNumber;
    status: z.ZodEnum<["submitted", "cancelled"]>;
    /** Null once cancelled. */
    stay: z.ZodNullable<z.ZodEnum<["arriving", "staying", "left"]>>;
    /** Changes and cancelling are open until the arrival day has passed. */
    canChange: z.ZodBoolean;
    propertyId: z.ZodString;
    propertyName: z.ZodString;
    unitId: z.ZodNullable<z.ZodString>;
    unitLabel: z.ZodNullable<z.ZodString>;
    chain: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["village_leader", "cell_executive", "district_officer", "dgie_village", "dgie_cell", "district_immigration", "dasso", "sector_executive", "dgie_province", "dgie_national"]>;
        roleLabel: z.ZodString;
        step: z.ZodNumber;
        state: z.ZodEnum<["waiting", "delivered", "seen"]>;
    }, "strip", z.ZodTypeAny, {
        state: "waiting" | "delivered" | "seen";
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        step: number;
        roleLabel: string;
    }, {
        state: "waiting" | "delivered" | "seen";
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        step: number;
        roleLabel: string;
    }>, "many">;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "submitted" | "cancelled";
    id: string;
    nights: number;
    fullName: string;
    origin: {
        kind: "village";
        villageId: number;
    } | {
        kind: "country";
        countryCode: string;
    };
    phone: string;
    createdAt: string;
    propertyName: string;
    idNumber: string | null;
    nationality: string;
    stay: "arriving" | "staying" | "left" | null;
    unitLabel: string | null;
    propertyId: string;
    arrivalOn: string;
    departureOn: string;
    unitId: string | null;
    idKind: "national_id" | "passport" | null;
    relationshipOther: string | null;
    relationship: string;
    hostKind: "hotel" | "landlord" | "tenant";
    nationalityName: string;
    fromAbroad: boolean;
    relationshipLabel: string;
    originWords: string;
    canChange: boolean;
    chain: {
        state: "waiting" | "delivered" | "seen";
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        step: number;
        roleLabel: string;
    }[];
}, {
    status: "submitted" | "cancelled";
    id: string;
    nights: number;
    fullName: string;
    origin: {
        kind: "village";
        villageId: number;
    } | {
        kind: "country";
        countryCode: string;
    };
    phone: string;
    createdAt: string;
    propertyName: string;
    idNumber: string | null;
    nationality: string;
    stay: "arriving" | "staying" | "left" | null;
    unitLabel: string | null;
    propertyId: string;
    arrivalOn: string;
    departureOn: string;
    unitId: string | null;
    idKind: "national_id" | "passport" | null;
    relationshipOther: string | null;
    relationship: string;
    hostKind: "hotel" | "landlord" | "tenant";
    nationalityName: string;
    fromAbroad: boolean;
    relationshipLabel: string;
    originWords: string;
    canChange: boolean;
    chain: {
        state: "waiting" | "delivered" | "seen";
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        step: number;
        roleLabel: string;
    }[];
}>;
export type HostGuest = z.infer<typeof HostGuest>;
/** A building a landlord can register a guest at, and whether guests there reach a village leader yet. */
export declare const GuestBuilding: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    address: z.ZodNullable<z.ZodString>;
    /** False while the building has no village on record: its village and cell steps wait. */
    located: z.ZodBoolean;
    units: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        label: string;
    }, {
        id: string;
        label: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    address: string | null;
    located: boolean;
    units: {
        id: string;
        label: string;
    }[];
}, {
    name: string;
    id: string;
    address: string | null;
    located: boolean;
    units: {
        id: string;
        label: string;
    }[];
}>;
export type GuestBuilding = z.infer<typeof GuestBuilding>;
export declare const HostGuestTab: z.ZodEnum<["arriving", "staying", "left", "cancelled"]>;
export type HostGuestTab = z.infer<typeof HostGuestTab>;
export declare const HostGuestQuery: z.ZodObject<{
    tab: z.ZodOptional<z.ZodEnum<["arriving", "staying", "left", "cancelled"]>>;
}, "strip", z.ZodTypeAny, {
    tab?: "cancelled" | "arriving" | "staying" | "left" | undefined;
}, {
    tab?: "cancelled" | "arriving" | "staying" | "left" | undefined;
}>;
export type HostGuestQuery = z.infer<typeof HostGuestQuery>;
export declare const HostGuestList: z.ZodObject<{
    guests: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        hostKind: z.ZodEnum<["tenant", "landlord", "hotel"]>;
        fullName: z.ZodString;
        phone: z.ZodString;
        nationality: z.ZodString;
        nationalityName: z.ZodString;
        fromAbroad: z.ZodBoolean;
        idKind: z.ZodNullable<z.ZodEnum<["national_id", "passport"]>>;
        idNumber: z.ZodNullable<z.ZodString>;
        relationship: z.ZodString;
        relationshipLabel: z.ZodString;
        relationshipOther: z.ZodNullable<z.ZodString>;
        origin: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
            kind: z.ZodLiteral<"village">;
            villageId: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            kind: "village";
            villageId: number;
        }, {
            kind: "village";
            villageId: number;
        }>, z.ZodObject<{
            kind: z.ZodLiteral<"country">;
            countryCode: z.ZodEffects<z.ZodString, string, string>;
        }, "strip", z.ZodTypeAny, {
            kind: "country";
            countryCode: string;
        }, {
            kind: "country";
            countryCode: string;
        }>]>;
        /** Where they come from, in words: the village path or the country. */
        originWords: z.ZodString;
        arrivalOn: z.ZodString;
        departureOn: z.ZodString;
        nights: z.ZodNumber;
        status: z.ZodEnum<["submitted", "cancelled"]>;
        /** Null once cancelled. */
        stay: z.ZodNullable<z.ZodEnum<["arriving", "staying", "left"]>>;
        /** Changes and cancelling are open until the arrival day has passed. */
        canChange: z.ZodBoolean;
        propertyId: z.ZodString;
        propertyName: z.ZodString;
        unitId: z.ZodNullable<z.ZodString>;
        unitLabel: z.ZodNullable<z.ZodString>;
        chain: z.ZodArray<z.ZodObject<{
            role: z.ZodEnum<["village_leader", "cell_executive", "district_officer", "dgie_village", "dgie_cell", "district_immigration", "dasso", "sector_executive", "dgie_province", "dgie_national"]>;
            roleLabel: z.ZodString;
            step: z.ZodNumber;
            state: z.ZodEnum<["waiting", "delivered", "seen"]>;
        }, "strip", z.ZodTypeAny, {
            state: "waiting" | "delivered" | "seen";
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
            step: number;
            roleLabel: string;
        }, {
            state: "waiting" | "delivered" | "seen";
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
            step: number;
            roleLabel: string;
        }>, "many">;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "submitted" | "cancelled";
        id: string;
        nights: number;
        fullName: string;
        origin: {
            kind: "village";
            villageId: number;
        } | {
            kind: "country";
            countryCode: string;
        };
        phone: string;
        createdAt: string;
        propertyName: string;
        idNumber: string | null;
        nationality: string;
        stay: "arriving" | "staying" | "left" | null;
        unitLabel: string | null;
        propertyId: string;
        arrivalOn: string;
        departureOn: string;
        unitId: string | null;
        idKind: "national_id" | "passport" | null;
        relationshipOther: string | null;
        relationship: string;
        hostKind: "hotel" | "landlord" | "tenant";
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        canChange: boolean;
        chain: {
            state: "waiting" | "delivered" | "seen";
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
            step: number;
            roleLabel: string;
        }[];
    }, {
        status: "submitted" | "cancelled";
        id: string;
        nights: number;
        fullName: string;
        origin: {
            kind: "village";
            villageId: number;
        } | {
            kind: "country";
            countryCode: string;
        };
        phone: string;
        createdAt: string;
        propertyName: string;
        idNumber: string | null;
        nationality: string;
        stay: "arriving" | "staying" | "left" | null;
        unitLabel: string | null;
        propertyId: string;
        arrivalOn: string;
        departureOn: string;
        unitId: string | null;
        idKind: "national_id" | "passport" | null;
        relationshipOther: string | null;
        relationship: string;
        hostKind: "hotel" | "landlord" | "tenant";
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        canChange: boolean;
        chain: {
            state: "waiting" | "delivered" | "seen";
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
            step: number;
            roleLabel: string;
        }[];
    }>, "many">;
    counts: z.ZodRecord<z.ZodEnum<["arriving", "staying", "left", "cancelled"]>, z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    guests: {
        status: "submitted" | "cancelled";
        id: string;
        nights: number;
        fullName: string;
        origin: {
            kind: "village";
            villageId: number;
        } | {
            kind: "country";
            countryCode: string;
        };
        phone: string;
        createdAt: string;
        propertyName: string;
        idNumber: string | null;
        nationality: string;
        stay: "arriving" | "staying" | "left" | null;
        unitLabel: string | null;
        propertyId: string;
        arrivalOn: string;
        departureOn: string;
        unitId: string | null;
        idKind: "national_id" | "passport" | null;
        relationshipOther: string | null;
        relationship: string;
        hostKind: "hotel" | "landlord" | "tenant";
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        canChange: boolean;
        chain: {
            state: "waiting" | "delivered" | "seen";
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
            step: number;
            roleLabel: string;
        }[];
    }[];
    counts: Partial<Record<"cancelled" | "arriving" | "staying" | "left", number>>;
}, {
    guests: {
        status: "submitted" | "cancelled";
        id: string;
        nights: number;
        fullName: string;
        origin: {
            kind: "village";
            villageId: number;
        } | {
            kind: "country";
            countryCode: string;
        };
        phone: string;
        createdAt: string;
        propertyName: string;
        idNumber: string | null;
        nationality: string;
        stay: "arriving" | "staying" | "left" | null;
        unitLabel: string | null;
        propertyId: string;
        arrivalOn: string;
        departureOn: string;
        unitId: string | null;
        idKind: "national_id" | "passport" | null;
        relationshipOther: string | null;
        relationship: string;
        hostKind: "hotel" | "landlord" | "tenant";
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        canChange: boolean;
        chain: {
            state: "waiting" | "delivered" | "seen";
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
            step: number;
            roleLabel: string;
        }[];
    }[];
    counts: Partial<Record<"cancelled" | "arriving" | "staying" | "left", number>>;
}>;
export type HostGuestList = z.infer<typeof HostGuestList>;
/** A tenant's guests, with the days the lease lets a guest stay. */
export declare const TenantGuestList: z.ZodObject<{
    guests: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        hostKind: z.ZodEnum<["tenant", "landlord", "hotel"]>;
        fullName: z.ZodString;
        phone: z.ZodString;
        nationality: z.ZodString;
        nationalityName: z.ZodString;
        fromAbroad: z.ZodBoolean;
        idKind: z.ZodNullable<z.ZodEnum<["national_id", "passport"]>>;
        idNumber: z.ZodNullable<z.ZodString>;
        relationship: z.ZodString;
        relationshipLabel: z.ZodString;
        relationshipOther: z.ZodNullable<z.ZodString>;
        origin: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
            kind: z.ZodLiteral<"village">;
            villageId: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            kind: "village";
            villageId: number;
        }, {
            kind: "village";
            villageId: number;
        }>, z.ZodObject<{
            kind: z.ZodLiteral<"country">;
            countryCode: z.ZodEffects<z.ZodString, string, string>;
        }, "strip", z.ZodTypeAny, {
            kind: "country";
            countryCode: string;
        }, {
            kind: "country";
            countryCode: string;
        }>]>;
        /** Where they come from, in words: the village path or the country. */
        originWords: z.ZodString;
        arrivalOn: z.ZodString;
        departureOn: z.ZodString;
        nights: z.ZodNumber;
        status: z.ZodEnum<["submitted", "cancelled"]>;
        /** Null once cancelled. */
        stay: z.ZodNullable<z.ZodEnum<["arriving", "staying", "left"]>>;
        /** Changes and cancelling are open until the arrival day has passed. */
        canChange: z.ZodBoolean;
        propertyId: z.ZodString;
        propertyName: z.ZodString;
        unitId: z.ZodNullable<z.ZodString>;
        unitLabel: z.ZodNullable<z.ZodString>;
        chain: z.ZodArray<z.ZodObject<{
            role: z.ZodEnum<["village_leader", "cell_executive", "district_officer", "dgie_village", "dgie_cell", "district_immigration", "dasso", "sector_executive", "dgie_province", "dgie_national"]>;
            roleLabel: z.ZodString;
            step: z.ZodNumber;
            state: z.ZodEnum<["waiting", "delivered", "seen"]>;
        }, "strip", z.ZodTypeAny, {
            state: "waiting" | "delivered" | "seen";
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
            step: number;
            roleLabel: string;
        }, {
            state: "waiting" | "delivered" | "seen";
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
            step: number;
            roleLabel: string;
        }>, "many">;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "submitted" | "cancelled";
        id: string;
        nights: number;
        fullName: string;
        origin: {
            kind: "village";
            villageId: number;
        } | {
            kind: "country";
            countryCode: string;
        };
        phone: string;
        createdAt: string;
        propertyName: string;
        idNumber: string | null;
        nationality: string;
        stay: "arriving" | "staying" | "left" | null;
        unitLabel: string | null;
        propertyId: string;
        arrivalOn: string;
        departureOn: string;
        unitId: string | null;
        idKind: "national_id" | "passport" | null;
        relationshipOther: string | null;
        relationship: string;
        hostKind: "hotel" | "landlord" | "tenant";
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        canChange: boolean;
        chain: {
            state: "waiting" | "delivered" | "seen";
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
            step: number;
            roleLabel: string;
        }[];
    }, {
        status: "submitted" | "cancelled";
        id: string;
        nights: number;
        fullName: string;
        origin: {
            kind: "village";
            villageId: number;
        } | {
            kind: "country";
            countryCode: string;
        };
        phone: string;
        createdAt: string;
        propertyName: string;
        idNumber: string | null;
        nationality: string;
        stay: "arriving" | "staying" | "left" | null;
        unitLabel: string | null;
        propertyId: string;
        arrivalOn: string;
        departureOn: string;
        unitId: string | null;
        idKind: "national_id" | "passport" | null;
        relationshipOther: string | null;
        relationship: string;
        hostKind: "hotel" | "landlord" | "tenant";
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        canChange: boolean;
        chain: {
            state: "waiting" | "delivered" | "seen";
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
            step: number;
            roleLabel: string;
        }[];
    }>, "many">;
    counts: z.ZodRecord<z.ZodEnum<["arriving", "staying", "left", "cancelled"]>, z.ZodNumber>;
} & {
    window: z.ZodObject<{
        start: z.ZodString;
        end: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        start: string;
        end: string;
    }, {
        start: string;
        end: string;
    }>;
}, "strip", z.ZodTypeAny, {
    guests: {
        status: "submitted" | "cancelled";
        id: string;
        nights: number;
        fullName: string;
        origin: {
            kind: "village";
            villageId: number;
        } | {
            kind: "country";
            countryCode: string;
        };
        phone: string;
        createdAt: string;
        propertyName: string;
        idNumber: string | null;
        nationality: string;
        stay: "arriving" | "staying" | "left" | null;
        unitLabel: string | null;
        propertyId: string;
        arrivalOn: string;
        departureOn: string;
        unitId: string | null;
        idKind: "national_id" | "passport" | null;
        relationshipOther: string | null;
        relationship: string;
        hostKind: "hotel" | "landlord" | "tenant";
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        canChange: boolean;
        chain: {
            state: "waiting" | "delivered" | "seen";
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
            step: number;
            roleLabel: string;
        }[];
    }[];
    counts: Partial<Record<"cancelled" | "arriving" | "staying" | "left", number>>;
    window: {
        start: string;
        end: string;
    };
}, {
    guests: {
        status: "submitted" | "cancelled";
        id: string;
        nights: number;
        fullName: string;
        origin: {
            kind: "village";
            villageId: number;
        } | {
            kind: "country";
            countryCode: string;
        };
        phone: string;
        createdAt: string;
        propertyName: string;
        idNumber: string | null;
        nationality: string;
        stay: "arriving" | "staying" | "left" | null;
        unitLabel: string | null;
        propertyId: string;
        arrivalOn: string;
        departureOn: string;
        unitId: string | null;
        idKind: "national_id" | "passport" | null;
        relationshipOther: string | null;
        relationship: string;
        hostKind: "hotel" | "landlord" | "tenant";
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        canChange: boolean;
        chain: {
            state: "waiting" | "delivered" | "seen";
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
            step: number;
            roleLabel: string;
        }[];
    }[];
    counts: Partial<Record<"cancelled" | "arriving" | "staying" | "left", number>>;
    window: {
        start: string;
        end: string;
    };
}>;
export type TenantGuestList = z.infer<typeof TenantGuestList>;
/** A landlord's own guests, with the buildings the form offers. */
export declare const LandlordGuestList: z.ZodObject<{
    guests: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        hostKind: z.ZodEnum<["tenant", "landlord", "hotel"]>;
        fullName: z.ZodString;
        phone: z.ZodString;
        nationality: z.ZodString;
        nationalityName: z.ZodString;
        fromAbroad: z.ZodBoolean;
        idKind: z.ZodNullable<z.ZodEnum<["national_id", "passport"]>>;
        idNumber: z.ZodNullable<z.ZodString>;
        relationship: z.ZodString;
        relationshipLabel: z.ZodString;
        relationshipOther: z.ZodNullable<z.ZodString>;
        origin: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
            kind: z.ZodLiteral<"village">;
            villageId: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            kind: "village";
            villageId: number;
        }, {
            kind: "village";
            villageId: number;
        }>, z.ZodObject<{
            kind: z.ZodLiteral<"country">;
            countryCode: z.ZodEffects<z.ZodString, string, string>;
        }, "strip", z.ZodTypeAny, {
            kind: "country";
            countryCode: string;
        }, {
            kind: "country";
            countryCode: string;
        }>]>;
        /** Where they come from, in words: the village path or the country. */
        originWords: z.ZodString;
        arrivalOn: z.ZodString;
        departureOn: z.ZodString;
        nights: z.ZodNumber;
        status: z.ZodEnum<["submitted", "cancelled"]>;
        /** Null once cancelled. */
        stay: z.ZodNullable<z.ZodEnum<["arriving", "staying", "left"]>>;
        /** Changes and cancelling are open until the arrival day has passed. */
        canChange: z.ZodBoolean;
        propertyId: z.ZodString;
        propertyName: z.ZodString;
        unitId: z.ZodNullable<z.ZodString>;
        unitLabel: z.ZodNullable<z.ZodString>;
        chain: z.ZodArray<z.ZodObject<{
            role: z.ZodEnum<["village_leader", "cell_executive", "district_officer", "dgie_village", "dgie_cell", "district_immigration", "dasso", "sector_executive", "dgie_province", "dgie_national"]>;
            roleLabel: z.ZodString;
            step: z.ZodNumber;
            state: z.ZodEnum<["waiting", "delivered", "seen"]>;
        }, "strip", z.ZodTypeAny, {
            state: "waiting" | "delivered" | "seen";
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
            step: number;
            roleLabel: string;
        }, {
            state: "waiting" | "delivered" | "seen";
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
            step: number;
            roleLabel: string;
        }>, "many">;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "submitted" | "cancelled";
        id: string;
        nights: number;
        fullName: string;
        origin: {
            kind: "village";
            villageId: number;
        } | {
            kind: "country";
            countryCode: string;
        };
        phone: string;
        createdAt: string;
        propertyName: string;
        idNumber: string | null;
        nationality: string;
        stay: "arriving" | "staying" | "left" | null;
        unitLabel: string | null;
        propertyId: string;
        arrivalOn: string;
        departureOn: string;
        unitId: string | null;
        idKind: "national_id" | "passport" | null;
        relationshipOther: string | null;
        relationship: string;
        hostKind: "hotel" | "landlord" | "tenant";
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        canChange: boolean;
        chain: {
            state: "waiting" | "delivered" | "seen";
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
            step: number;
            roleLabel: string;
        }[];
    }, {
        status: "submitted" | "cancelled";
        id: string;
        nights: number;
        fullName: string;
        origin: {
            kind: "village";
            villageId: number;
        } | {
            kind: "country";
            countryCode: string;
        };
        phone: string;
        createdAt: string;
        propertyName: string;
        idNumber: string | null;
        nationality: string;
        stay: "arriving" | "staying" | "left" | null;
        unitLabel: string | null;
        propertyId: string;
        arrivalOn: string;
        departureOn: string;
        unitId: string | null;
        idKind: "national_id" | "passport" | null;
        relationshipOther: string | null;
        relationship: string;
        hostKind: "hotel" | "landlord" | "tenant";
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        canChange: boolean;
        chain: {
            state: "waiting" | "delivered" | "seen";
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
            step: number;
            roleLabel: string;
        }[];
    }>, "many">;
    counts: z.ZodRecord<z.ZodEnum<["arriving", "staying", "left", "cancelled"]>, z.ZodNumber>;
} & {
    buildings: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        address: z.ZodNullable<z.ZodString>;
        /** False while the building has no village on record: its village and cell steps wait. */
        located: z.ZodBoolean;
        units: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            label: string;
        }, {
            id: string;
            label: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        address: string | null;
        located: boolean;
        units: {
            id: string;
            label: string;
        }[];
    }, {
        name: string;
        id: string;
        address: string | null;
        located: boolean;
        units: {
            id: string;
            label: string;
        }[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    guests: {
        status: "submitted" | "cancelled";
        id: string;
        nights: number;
        fullName: string;
        origin: {
            kind: "village";
            villageId: number;
        } | {
            kind: "country";
            countryCode: string;
        };
        phone: string;
        createdAt: string;
        propertyName: string;
        idNumber: string | null;
        nationality: string;
        stay: "arriving" | "staying" | "left" | null;
        unitLabel: string | null;
        propertyId: string;
        arrivalOn: string;
        departureOn: string;
        unitId: string | null;
        idKind: "national_id" | "passport" | null;
        relationshipOther: string | null;
        relationship: string;
        hostKind: "hotel" | "landlord" | "tenant";
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        canChange: boolean;
        chain: {
            state: "waiting" | "delivered" | "seen";
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
            step: number;
            roleLabel: string;
        }[];
    }[];
    counts: Partial<Record<"cancelled" | "arriving" | "staying" | "left", number>>;
    buildings: {
        name: string;
        id: string;
        address: string | null;
        located: boolean;
        units: {
            id: string;
            label: string;
        }[];
    }[];
}, {
    guests: {
        status: "submitted" | "cancelled";
        id: string;
        nights: number;
        fullName: string;
        origin: {
            kind: "village";
            villageId: number;
        } | {
            kind: "country";
            countryCode: string;
        };
        phone: string;
        createdAt: string;
        propertyName: string;
        idNumber: string | null;
        nationality: string;
        stay: "arriving" | "staying" | "left" | null;
        unitLabel: string | null;
        propertyId: string;
        arrivalOn: string;
        departureOn: string;
        unitId: string | null;
        idKind: "national_id" | "passport" | null;
        relationshipOther: string | null;
        relationship: string;
        hostKind: "hotel" | "landlord" | "tenant";
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        canChange: boolean;
        chain: {
            state: "waiting" | "delivered" | "seen";
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
            step: number;
            roleLabel: string;
        }[];
    }[];
    counts: Partial<Record<"cancelled" | "arriving" | "staying" | "left", number>>;
    buildings: {
        name: string;
        id: string;
        address: string | null;
        located: boolean;
        units: {
            id: string;
            label: string;
        }[];
    }[];
}>;
export type LandlordGuestList = z.infer<typeof LandlordGuestList>;
export declare const GuestCountry: z.ZodObject<{
    code: z.ZodString;
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    name: string;
}, {
    code: string;
    name: string;
}>;
export type GuestCountry = z.infer<typeof GuestCountry>;
export declare const GuestRelationship: z.ZodObject<{
    code: z.ZodString;
    label: z.ZodString;
    needsDetail: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    code: string;
    label: string;
    needsDetail: boolean;
}, {
    code: string;
    label: string;
    needsDetail: boolean;
}>;
export type GuestRelationship = z.infer<typeof GuestRelationship>;
/** `all` (the default): every guest in the area, nothing chosen for the leader. */
export declare const LeaderGuestTab: z.ZodEnum<["all", "arriving", "staying", "left", "flagged"]>;
export type LeaderGuestTab = z.infer<typeof LeaderGuestTab>;
/** The Arriving tab's window: the next 7 days, or everyone arriving after that. */
export declare const LeaderArrivingWhen: z.ZodEnum<["soon", "later"]>;
export type LeaderArrivingWhen = z.infer<typeof LeaderArrivingWhen>;
/** A guest filter by nationality, in the leader's words: everyone, Rwandans, or guests from other countries. */
export declare const ReportOrigin: z.ZodEnum<["nationals", "international"]>;
export type ReportOrigin = z.infer<typeof ReportOrigin>;
export declare const LeaderGuestQuery: z.ZodEffects<z.ZodObject<{
    /** Arrived today, yesterday, in the last 7 days or this month (Kigali days). */
    arrived: z.ZodOptional<z.ZodEnum<["today", "yesterday", "last_7_days", "this_month"]>>;
    /** Arrived between two days, both included: a custom range, in place of `arrived`. */
    arrivedFrom: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    arrivedTo: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    /** In the area on this day: arrived on or before it, leaving on or after it. */
    presentOn: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    leaving: z.ZodOptional<z.ZodEnum<["today", "next_7_days"]>>;
    page: z.ZodDefault<z.ZodNumber>;
    /** Rwandan guests, or guests of another nationality. */
    origin: z.ZodOptional<z.ZodEnum<["nationals", "international"]>>;
    /** One nationality (ISO 3166-1 alpha-2). */
    nationality: z.ZodOptional<z.ZodString>;
    /** One relationship code (`guest_relationships`), or `hotel_guest`. */
    relationship: z.ZodOptional<z.ZodString>;
    placeType: z.ZodOptional<z.ZodEnum<["hotel", "lodge", "guest_house", "apartment", "residence", "other"]>>;
    length: z.ZodOptional<z.ZodEnum<["under_3", "week", "month"]>>;
    tab: z.ZodDefault<z.ZodEnum<["all", "arriving", "staying", "left", "flagged"]>>;
    when: z.ZodDefault<z.ZodEnum<["soon", "later"]>>;
    sectorId: z.ZodOptional<z.ZodNumber>;
    cellId: z.ZodOptional<z.ZodNumber>;
    villageId: z.ZodOptional<z.ZodNumber>;
    q: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page: number;
    tab: "all" | "arriving" | "staying" | "left" | "flagged";
    when: "soon" | "later";
    length?: "month" | "under_3" | "week" | undefined;
    sectorId?: number | undefined;
    cellId?: number | undefined;
    villageId?: number | undefined;
    origin?: "nationals" | "international" | undefined;
    q?: string | undefined;
    nationality?: string | undefined;
    relationship?: string | undefined;
    arrived?: "today" | "yesterday" | "last_7_days" | "this_month" | undefined;
    arrivedFrom?: string | undefined;
    arrivedTo?: string | undefined;
    presentOn?: string | undefined;
    leaving?: "today" | "next_7_days" | undefined;
    placeType?: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge" | undefined;
}, {
    length?: "month" | "under_3" | "week" | undefined;
    sectorId?: number | undefined;
    cellId?: number | undefined;
    villageId?: number | undefined;
    origin?: "nationals" | "international" | undefined;
    q?: string | undefined;
    page?: number | undefined;
    nationality?: string | undefined;
    relationship?: string | undefined;
    tab?: "all" | "arriving" | "staying" | "left" | "flagged" | undefined;
    when?: "soon" | "later" | undefined;
    arrived?: "today" | "yesterday" | "last_7_days" | "this_month" | undefined;
    arrivedFrom?: string | undefined;
    arrivedTo?: string | undefined;
    presentOn?: string | undefined;
    leaving?: "today" | "next_7_days" | undefined;
    placeType?: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge" | undefined;
}>, {
    page: number;
    tab: "all" | "arriving" | "staying" | "left" | "flagged";
    when: "soon" | "later";
    length?: "month" | "under_3" | "week" | undefined;
    sectorId?: number | undefined;
    cellId?: number | undefined;
    villageId?: number | undefined;
    origin?: "nationals" | "international" | undefined;
    q?: string | undefined;
    nationality?: string | undefined;
    relationship?: string | undefined;
    arrived?: "today" | "yesterday" | "last_7_days" | "this_month" | undefined;
    arrivedFrom?: string | undefined;
    arrivedTo?: string | undefined;
    presentOn?: string | undefined;
    leaving?: "today" | "next_7_days" | undefined;
    placeType?: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge" | undefined;
}, {
    length?: "month" | "under_3" | "week" | undefined;
    sectorId?: number | undefined;
    cellId?: number | undefined;
    villageId?: number | undefined;
    origin?: "nationals" | "international" | undefined;
    q?: string | undefined;
    page?: number | undefined;
    nationality?: string | undefined;
    relationship?: string | undefined;
    tab?: "all" | "arriving" | "staying" | "left" | "flagged" | undefined;
    when?: "soon" | "later" | undefined;
    arrived?: "today" | "yesterday" | "last_7_days" | "this_month" | undefined;
    arrivedFrom?: string | undefined;
    arrivedTo?: string | undefined;
    presentOn?: string | undefined;
    leaving?: "today" | "next_7_days" | undefined;
    placeType?: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge" | undefined;
}>;
export type LeaderGuestQuery = z.infer<typeof LeaderGuestQuery>;
/** The guest filters that narrow a list or report, as an address keeps them: the list's, then the report's. */
export declare const GUEST_LIST_FILTER_KEYS: readonly ["origin", "nationality", "relationship", "placeType", "length", "arrived", "arrivedFrom", "arrivedTo", "presentOn", "leaving"];
export declare const FlagGuestRequest: z.ZodObject<{
    note: z.ZodString;
}, "strip", z.ZodTypeAny, {
    note: string;
}, {
    note: string;
}>;
export type FlagGuestRequest = z.infer<typeof FlagGuestRequest>;
/** One step of the chain as a leader reads it: who holds it, who opened it, any flag. */
export declare const LeaderChainStep: z.ZodObject<{
    role: z.ZodEnum<["village_leader", "cell_executive", "district_officer", "dgie_village", "dgie_cell", "district_immigration", "dasso", "sector_executive", "dgie_province", "dgie_national"]>;
    roleLabel: z.ZodString;
    step: z.ZodNumber;
    state: z.ZodEnum<["waiting", "delivered", "seen"]>;
    deliveredAt: z.ZodNullable<z.ZodString>;
    seenAt: z.ZodNullable<z.ZodString>;
    seenBy: z.ZodNullable<z.ZodString>;
    flag: z.ZodNullable<z.ZodObject<{
        note: z.ZodString;
        at: z.ZodString;
        by: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        note: string;
        at: string;
        by: string | null;
    }, {
        note: string;
        at: string;
        by: string | null;
    }>>;
}, "strip", z.ZodTypeAny, {
    state: "waiting" | "delivered" | "seen";
    role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
    step: number;
    roleLabel: string;
    deliveredAt: string | null;
    seenAt: string | null;
    seenBy: string | null;
    flag: {
        note: string;
        at: string;
        by: string | null;
    } | null;
}, {
    state: "waiting" | "delivered" | "seen";
    role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
    step: number;
    roleLabel: string;
    deliveredAt: string | null;
    seenAt: string | null;
    seenBy: string | null;
    flag: {
        note: string;
        at: string;
        by: string | null;
    } | null;
}>;
export type LeaderChainStep = z.infer<typeof LeaderChainStep>;
export declare const LeaderGuest: z.ZodObject<{
    id: z.ZodString;
    fullName: z.ZodString;
    nationality: z.ZodString;
    nationalityName: z.ZodString;
    fromAbroad: z.ZodBoolean;
    idKind: z.ZodNullable<z.ZodEnum<["national_id", "passport"]>>;
    idNumber: z.ZodNullable<z.ZodString>;
    phone: z.ZodString;
    relationshipLabel: z.ZodString;
    originWords: z.ZodString;
    arrivalOn: z.ZodString;
    departureOn: z.ZodString;
    nights: z.ZodNumber;
    stay: z.ZodEnum<["arriving", "staying", "left"]>;
    host: z.ZodObject<{
        kind: z.ZodEnum<["tenant", "landlord", "hotel"]>;
        /** The tenant or the landlord who filed the guest; for a hotel, the business. */
        name: z.ZodString;
        phone: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        kind: "hotel" | "landlord" | "tenant";
        phone: string | null;
    }, {
        name: string;
        kind: "hotel" | "landlord" | "tenant";
        phone: string | null;
    }>;
    /** Where they stay: the type of place, its own kind in words, the business or building, the room or unit. */
    place: z.ZodObject<{
        type: z.ZodEnum<["hotel", "lodge", "guest_house", "apartment", "residence", "other"]>;
        kindLabel: z.ZodString;
        name: z.ZodString;
        room: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge";
        name: string;
        room: string | null;
        kindLabel: string;
    }, {
        type: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge";
        name: string;
        room: string | null;
        kindLabel: string;
    }>;
    /** When the desk checked the guest in (a hotel stay), or null. */
    checkedInAt: z.ZodNullable<z.ZodString>;
    home: z.ZodObject<{
        propertyName: z.ZodString;
        unitLabel: z.ZodNullable<z.ZodString>;
        /** Street, then village up to district, each place once. */
        address: z.ZodString;
        /** The village and cell by name, for a list that covers several. */
        villageName: z.ZodNullable<z.ZodString>;
        cellName: z.ZodNullable<z.ZodString>;
        villageId: z.ZodNullable<z.ZodNumber>;
        cellId: z.ZodNullable<z.ZodNumber>;
        sectorId: z.ZodNullable<z.ZodNumber>;
        districtId: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        address: string;
        propertyName: string;
        unitLabel: string | null;
        villageName: string | null;
        cellName: string | null;
    }, {
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        address: string;
        propertyName: string;
        unitLabel: string | null;
        villageName: string | null;
        cellName: string | null;
    }>;
    chain: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["village_leader", "cell_executive", "district_officer", "dgie_village", "dgie_cell", "district_immigration", "dasso", "sector_executive", "dgie_province", "dgie_national"]>;
        roleLabel: z.ZodString;
        step: z.ZodNumber;
        state: z.ZodEnum<["waiting", "delivered", "seen"]>;
        deliveredAt: z.ZodNullable<z.ZodString>;
        seenAt: z.ZodNullable<z.ZodString>;
        seenBy: z.ZodNullable<z.ZodString>;
        flag: z.ZodNullable<z.ZodObject<{
            note: z.ZodString;
            at: z.ZodString;
            by: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            note: string;
            at: string;
            by: string | null;
        }, {
            note: string;
            at: string;
            by: string | null;
        }>>;
    }, "strip", z.ZodTypeAny, {
        state: "waiting" | "delivered" | "seen";
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        step: number;
        roleLabel: string;
        deliveredAt: string | null;
        seenAt: string | null;
        seenBy: string | null;
        flag: {
            note: string;
            at: string;
            by: string | null;
        } | null;
    }, {
        state: "waiting" | "delivered" | "seen";
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        step: number;
        roleLabel: string;
        deliveredAt: string | null;
        seenAt: string | null;
        seenBy: string | null;
        flag: {
            note: string;
            at: string;
            by: string | null;
        } | null;
    }>, "many">;
    /** Opened by this leader (any of their posts covering it). */
    seenByMe: z.ZodBoolean;
    flagged: z.ZodBoolean;
    /** The host changed it after it was filed. */
    changedAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    nights: number;
    host: {
        name: string;
        kind: "hotel" | "landlord" | "tenant";
        phone: string | null;
    };
    fullName: string;
    phone: string;
    createdAt: string;
    idNumber: string | null;
    nationality: string;
    stay: "arriving" | "staying" | "left";
    arrivalOn: string;
    departureOn: string;
    home: {
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        address: string;
        propertyName: string;
        unitLabel: string | null;
        villageName: string | null;
        cellName: string | null;
    };
    idKind: "national_id" | "passport" | null;
    nationalityName: string;
    fromAbroad: boolean;
    relationshipLabel: string;
    originWords: string;
    chain: {
        state: "waiting" | "delivered" | "seen";
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        step: number;
        roleLabel: string;
        deliveredAt: string | null;
        seenAt: string | null;
        seenBy: string | null;
        flag: {
            note: string;
            at: string;
            by: string | null;
        } | null;
    }[];
    flagged: boolean;
    place: {
        type: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge";
        name: string;
        room: string | null;
        kindLabel: string;
    };
    checkedInAt: string | null;
    seenByMe: boolean;
    changedAt: string | null;
}, {
    id: string;
    nights: number;
    host: {
        name: string;
        kind: "hotel" | "landlord" | "tenant";
        phone: string | null;
    };
    fullName: string;
    phone: string;
    createdAt: string;
    idNumber: string | null;
    nationality: string;
    stay: "arriving" | "staying" | "left";
    arrivalOn: string;
    departureOn: string;
    home: {
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        address: string;
        propertyName: string;
        unitLabel: string | null;
        villageName: string | null;
        cellName: string | null;
    };
    idKind: "national_id" | "passport" | null;
    nationalityName: string;
    fromAbroad: boolean;
    relationshipLabel: string;
    originWords: string;
    chain: {
        state: "waiting" | "delivered" | "seen";
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        step: number;
        roleLabel: string;
        deliveredAt: string | null;
        seenAt: string | null;
        seenBy: string | null;
        flag: {
            note: string;
            at: string;
            by: string | null;
        } | null;
    }[];
    flagged: boolean;
    place: {
        type: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge";
        name: string;
        room: string | null;
        kindLabel: string;
    };
    checkedInAt: string | null;
    seenByMe: boolean;
    changedAt: string | null;
}>;
export type LeaderGuest = z.infer<typeof LeaderGuest>;
/** One post a leader holds, in words. */
export declare const LeaderScope: z.ZodObject<{
    assignmentId: z.ZodString;
    role: z.ZodEnum<["village_leader", "cell_executive", "district_officer", "dgie_village", "dgie_cell", "district_immigration", "dasso", "sector_executive", "dgie_province", "dgie_national"]>;
    roleLabel: z.ZodString;
    level: z.ZodEnum<["village", "cell", "sector", "district", "province", "country"]>;
    area: z.ZodString;
}, "strip", z.ZodTypeAny, {
    role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
    level: "country" | "province" | "district" | "sector" | "cell" | "village";
    area: string;
    assignmentId: string;
    roleLabel: string;
}, {
    role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
    level: "country" | "province" | "district" | "sector" | "cell" | "village";
    area: string;
    assignmentId: string;
    roleLabel: string;
}>;
export type LeaderScope = z.infer<typeof LeaderScope>;
/** The places a wider post can narrow to: only those inside it. */
export declare const LeaderFilters: z.ZodObject<{
    sectors: z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: number;
    }, {
        name: string;
        id: number;
    }>, "many">;
    cells: z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        name: z.ZodString;
        sectorId: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: number;
        sectorId: number;
    }, {
        name: string;
        id: number;
        sectorId: number;
    }>, "many">;
    villages: z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        name: z.ZodString;
        cellId: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: number;
        cellId: number;
    }, {
        name: string;
        id: number;
        cellId: number;
    }>, "many">;
    /** The nationalities among the guests in the leader's area (in the place chosen), most guests first. */
    nationalities: z.ZodDefault<z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        name: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        code: string;
        name: string;
        count: number;
    }, {
        code: string;
        name: string;
        count: number;
    }>, "many">>;
    /** The types of place among those guests, most first. */
    placeTypes: z.ZodDefault<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["hotel", "lodge", "guest_house", "apartment", "residence", "other"]>;
        label: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge";
        count: number;
        label: string;
    }, {
        type: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge";
        count: number;
        label: string;
    }>, "many">>;
    /** Who those guests are to their hosts, most first. */
    relationships: z.ZodDefault<z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        label: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        code: string;
        count: number;
        label: string;
    }, {
        code: string;
        count: number;
        label: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    sectors: {
        name: string;
        id: number;
    }[];
    cells: {
        name: string;
        id: number;
        sectorId: number;
    }[];
    villages: {
        name: string;
        id: number;
        cellId: number;
    }[];
    nationalities: {
        code: string;
        name: string;
        count: number;
    }[];
    placeTypes: {
        type: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge";
        count: number;
        label: string;
    }[];
    relationships: {
        code: string;
        count: number;
        label: string;
    }[];
}, {
    sectors: {
        name: string;
        id: number;
    }[];
    cells: {
        name: string;
        id: number;
        sectorId: number;
    }[];
    villages: {
        name: string;
        id: number;
        cellId: number;
    }[];
    nationalities?: {
        code: string;
        name: string;
        count: number;
    }[] | undefined;
    placeTypes?: {
        type: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge";
        count: number;
        label: string;
    }[] | undefined;
    relationships?: {
        code: string;
        count: number;
        label: string;
    }[] | undefined;
}>;
export type LeaderFilters = z.infer<typeof LeaderFilters>;
export declare const LeaderCounts: z.ZodObject<{
    /** Arriving in the next 7 days. */
    arriving: z.ZodNumber;
    /** Arriving after that. */
    later: z.ZodNumber;
    staying: z.ZodNumber;
    left: z.ZodNumber;
    flagged: z.ZodNumber;
    /** Guests in scope this leader has not opened yet. */
    unseen: z.ZodNumber;
    /** Of those staying now, how many are foreign (by nationality). */
    stayingForeign: z.ZodDefault<z.ZodNumber>;
    /** Current guests (staying or still to come) in scope, the base the unopened count is part of. */
    current: z.ZodDefault<z.ZodNumber>;
    /** Guests arriving on each of the next 7 days, tomorrow first. */
    arrivingByDay: z.ZodDefault<z.ZodArray<z.ZodNumber, "many">>;
    /** Guests staying on each of the last 14 days, today last. */
    stayingByDay: z.ZodDefault<z.ZodArray<z.ZodNumber, "many">>;
}, "strip", z.ZodTypeAny, {
    current: number;
    arriving: number;
    staying: number;
    left: number;
    flagged: number;
    later: number;
    unseen: number;
    stayingForeign: number;
    arrivingByDay: number[];
    stayingByDay: number[];
}, {
    arriving: number;
    staying: number;
    left: number;
    flagged: number;
    later: number;
    unseen: number;
    current?: number | undefined;
    stayingForeign?: number | undefined;
    arrivingByDay?: number[] | undefined;
    stayingByDay?: number[] | undefined;
}>;
export type LeaderCounts = z.infer<typeof LeaderCounts>;
export declare const LeaderSummary: z.ZodObject<{
    leader: z.ZodObject<{
        name: z.ZodNullable<z.ZodString>;
        email: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string | null;
        email: string;
    }, {
        name: string | null;
        email: string;
    }>;
    /** Local government (every guest) or DGIE (guests from abroad only): what the screens and files show. */
    audience: z.ZodDefault<z.ZodEnum<["local", "dgie"]>>;
    scopes: z.ZodArray<z.ZodObject<{
        assignmentId: z.ZodString;
        role: z.ZodEnum<["village_leader", "cell_executive", "district_officer", "dgie_village", "dgie_cell", "district_immigration", "dasso", "sector_executive", "dgie_province", "dgie_national"]>;
        roleLabel: z.ZodString;
        level: z.ZodEnum<["village", "cell", "sector", "district", "province", "country"]>;
        area: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        assignmentId: string;
        roleLabel: string;
    }, {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        assignmentId: string;
        roleLabel: string;
    }>, "many">;
    filters: z.ZodObject<{
        sectors: z.ZodArray<z.ZodObject<{
            id: z.ZodNumber;
            name: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: number;
        }, {
            name: string;
            id: number;
        }>, "many">;
        cells: z.ZodArray<z.ZodObject<{
            id: z.ZodNumber;
            name: z.ZodString;
            sectorId: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: number;
            sectorId: number;
        }, {
            name: string;
            id: number;
            sectorId: number;
        }>, "many">;
        villages: z.ZodArray<z.ZodObject<{
            id: z.ZodNumber;
            name: z.ZodString;
            cellId: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: number;
            cellId: number;
        }, {
            name: string;
            id: number;
            cellId: number;
        }>, "many">;
        /** The nationalities among the guests in the leader's area (in the place chosen), most guests first. */
        nationalities: z.ZodDefault<z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            name: z.ZodString;
            count: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            code: string;
            name: string;
            count: number;
        }, {
            code: string;
            name: string;
            count: number;
        }>, "many">>;
        /** The types of place among those guests, most first. */
        placeTypes: z.ZodDefault<z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<["hotel", "lodge", "guest_house", "apartment", "residence", "other"]>;
            label: z.ZodString;
            count: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            type: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge";
            count: number;
            label: string;
        }, {
            type: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge";
            count: number;
            label: string;
        }>, "many">>;
        /** Who those guests are to their hosts, most first. */
        relationships: z.ZodDefault<z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            label: z.ZodString;
            count: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            code: string;
            count: number;
            label: string;
        }, {
            code: string;
            count: number;
            label: string;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        sectors: {
            name: string;
            id: number;
        }[];
        cells: {
            name: string;
            id: number;
            sectorId: number;
        }[];
        villages: {
            name: string;
            id: number;
            cellId: number;
        }[];
        nationalities: {
            code: string;
            name: string;
            count: number;
        }[];
        placeTypes: {
            type: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge";
            count: number;
            label: string;
        }[];
        relationships: {
            code: string;
            count: number;
            label: string;
        }[];
    }, {
        sectors: {
            name: string;
            id: number;
        }[];
        cells: {
            name: string;
            id: number;
            sectorId: number;
        }[];
        villages: {
            name: string;
            id: number;
            cellId: number;
        }[];
        nationalities?: {
            code: string;
            name: string;
            count: number;
        }[] | undefined;
        placeTypes?: {
            type: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge";
            count: number;
            label: string;
        }[] | undefined;
        relationships?: {
            code: string;
            count: number;
            label: string;
        }[] | undefined;
    }>;
    counts: z.ZodObject<{
        /** Arriving in the next 7 days. */
        arriving: z.ZodNumber;
        /** Arriving after that. */
        later: z.ZodNumber;
        staying: z.ZodNumber;
        left: z.ZodNumber;
        flagged: z.ZodNumber;
        /** Guests in scope this leader has not opened yet. */
        unseen: z.ZodNumber;
        /** Of those staying now, how many are foreign (by nationality). */
        stayingForeign: z.ZodDefault<z.ZodNumber>;
        /** Current guests (staying or still to come) in scope, the base the unopened count is part of. */
        current: z.ZodDefault<z.ZodNumber>;
        /** Guests arriving on each of the next 7 days, tomorrow first. */
        arrivingByDay: z.ZodDefault<z.ZodArray<z.ZodNumber, "many">>;
        /** Guests staying on each of the last 14 days, today last. */
        stayingByDay: z.ZodDefault<z.ZodArray<z.ZodNumber, "many">>;
    }, "strip", z.ZodTypeAny, {
        current: number;
        arriving: number;
        staying: number;
        left: number;
        flagged: number;
        later: number;
        unseen: number;
        stayingForeign: number;
        arrivingByDay: number[];
        stayingByDay: number[];
    }, {
        arriving: number;
        staying: number;
        left: number;
        flagged: number;
        later: number;
        unseen: number;
        current?: number | undefined;
        stayingForeign?: number | undefined;
        arrivingByDay?: number[] | undefined;
        stayingByDay?: number[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    counts: {
        current: number;
        arriving: number;
        staying: number;
        left: number;
        flagged: number;
        later: number;
        unseen: number;
        stayingForeign: number;
        arrivingByDay: number[];
        stayingByDay: number[];
    };
    audience: "local" | "dgie";
    leader: {
        name: string | null;
        email: string;
    };
    scopes: {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        assignmentId: string;
        roleLabel: string;
    }[];
    filters: {
        sectors: {
            name: string;
            id: number;
        }[];
        cells: {
            name: string;
            id: number;
            sectorId: number;
        }[];
        villages: {
            name: string;
            id: number;
            cellId: number;
        }[];
        nationalities: {
            code: string;
            name: string;
            count: number;
        }[];
        placeTypes: {
            type: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge";
            count: number;
            label: string;
        }[];
        relationships: {
            code: string;
            count: number;
            label: string;
        }[];
    };
}, {
    counts: {
        arriving: number;
        staying: number;
        left: number;
        flagged: number;
        later: number;
        unseen: number;
        current?: number | undefined;
        stayingForeign?: number | undefined;
        arrivingByDay?: number[] | undefined;
        stayingByDay?: number[] | undefined;
    };
    leader: {
        name: string | null;
        email: string;
    };
    scopes: {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        assignmentId: string;
        roleLabel: string;
    }[];
    filters: {
        sectors: {
            name: string;
            id: number;
        }[];
        cells: {
            name: string;
            id: number;
            sectorId: number;
        }[];
        villages: {
            name: string;
            id: number;
            cellId: number;
        }[];
        nationalities?: {
            code: string;
            name: string;
            count: number;
        }[] | undefined;
        placeTypes?: {
            type: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge";
            count: number;
            label: string;
        }[] | undefined;
        relationships?: {
            code: string;
            count: number;
            label: string;
        }[] | undefined;
    };
    audience?: "local" | "dgie" | undefined;
}>;
export type LeaderSummary = z.infer<typeof LeaderSummary>;
export declare const LeaderGuestPage: z.ZodObject<{
    leader: z.ZodObject<{
        name: z.ZodNullable<z.ZodString>;
        email: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string | null;
        email: string;
    }, {
        name: string | null;
        email: string;
    }>;
    /** Local government (every guest) or DGIE (guests from abroad only): what the screens and files show. */
    audience: z.ZodDefault<z.ZodEnum<["local", "dgie"]>>;
    scopes: z.ZodArray<z.ZodObject<{
        assignmentId: z.ZodString;
        role: z.ZodEnum<["village_leader", "cell_executive", "district_officer", "dgie_village", "dgie_cell", "district_immigration", "dasso", "sector_executive", "dgie_province", "dgie_national"]>;
        roleLabel: z.ZodString;
        level: z.ZodEnum<["village", "cell", "sector", "district", "province", "country"]>;
        area: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        assignmentId: string;
        roleLabel: string;
    }, {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        assignmentId: string;
        roleLabel: string;
    }>, "many">;
    filters: z.ZodObject<{
        sectors: z.ZodArray<z.ZodObject<{
            id: z.ZodNumber;
            name: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: number;
        }, {
            name: string;
            id: number;
        }>, "many">;
        cells: z.ZodArray<z.ZodObject<{
            id: z.ZodNumber;
            name: z.ZodString;
            sectorId: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: number;
            sectorId: number;
        }, {
            name: string;
            id: number;
            sectorId: number;
        }>, "many">;
        villages: z.ZodArray<z.ZodObject<{
            id: z.ZodNumber;
            name: z.ZodString;
            cellId: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: number;
            cellId: number;
        }, {
            name: string;
            id: number;
            cellId: number;
        }>, "many">;
        /** The nationalities among the guests in the leader's area (in the place chosen), most guests first. */
        nationalities: z.ZodDefault<z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            name: z.ZodString;
            count: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            code: string;
            name: string;
            count: number;
        }, {
            code: string;
            name: string;
            count: number;
        }>, "many">>;
        /** The types of place among those guests, most first. */
        placeTypes: z.ZodDefault<z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<["hotel", "lodge", "guest_house", "apartment", "residence", "other"]>;
            label: z.ZodString;
            count: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            type: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge";
            count: number;
            label: string;
        }, {
            type: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge";
            count: number;
            label: string;
        }>, "many">>;
        /** Who those guests are to their hosts, most first. */
        relationships: z.ZodDefault<z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            label: z.ZodString;
            count: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            code: string;
            count: number;
            label: string;
        }, {
            code: string;
            count: number;
            label: string;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        sectors: {
            name: string;
            id: number;
        }[];
        cells: {
            name: string;
            id: number;
            sectorId: number;
        }[];
        villages: {
            name: string;
            id: number;
            cellId: number;
        }[];
        nationalities: {
            code: string;
            name: string;
            count: number;
        }[];
        placeTypes: {
            type: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge";
            count: number;
            label: string;
        }[];
        relationships: {
            code: string;
            count: number;
            label: string;
        }[];
    }, {
        sectors: {
            name: string;
            id: number;
        }[];
        cells: {
            name: string;
            id: number;
            sectorId: number;
        }[];
        villages: {
            name: string;
            id: number;
            cellId: number;
        }[];
        nationalities?: {
            code: string;
            name: string;
            count: number;
        }[] | undefined;
        placeTypes?: {
            type: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge";
            count: number;
            label: string;
        }[] | undefined;
        relationships?: {
            code: string;
            count: number;
            label: string;
        }[] | undefined;
    }>;
    counts: z.ZodObject<{
        /** Arriving in the next 7 days. */
        arriving: z.ZodNumber;
        /** Arriving after that. */
        later: z.ZodNumber;
        staying: z.ZodNumber;
        left: z.ZodNumber;
        flagged: z.ZodNumber;
        /** Guests in scope this leader has not opened yet. */
        unseen: z.ZodNumber;
        /** Of those staying now, how many are foreign (by nationality). */
        stayingForeign: z.ZodDefault<z.ZodNumber>;
        /** Current guests (staying or still to come) in scope, the base the unopened count is part of. */
        current: z.ZodDefault<z.ZodNumber>;
        /** Guests arriving on each of the next 7 days, tomorrow first. */
        arrivingByDay: z.ZodDefault<z.ZodArray<z.ZodNumber, "many">>;
        /** Guests staying on each of the last 14 days, today last. */
        stayingByDay: z.ZodDefault<z.ZodArray<z.ZodNumber, "many">>;
    }, "strip", z.ZodTypeAny, {
        current: number;
        arriving: number;
        staying: number;
        left: number;
        flagged: number;
        later: number;
        unseen: number;
        stayingForeign: number;
        arrivingByDay: number[];
        stayingByDay: number[];
    }, {
        arriving: number;
        staying: number;
        left: number;
        flagged: number;
        later: number;
        unseen: number;
        current?: number | undefined;
        stayingForeign?: number | undefined;
        arrivingByDay?: number[] | undefined;
        stayingByDay?: number[] | undefined;
    }>;
} & {
    tab: z.ZodEnum<["all", "arriving", "staying", "left", "flagged"]>;
    when: z.ZodEnum<["soon", "later"]>;
    guests: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        fullName: z.ZodString;
        nationality: z.ZodString;
        nationalityName: z.ZodString;
        fromAbroad: z.ZodBoolean;
        idKind: z.ZodNullable<z.ZodEnum<["national_id", "passport"]>>;
        idNumber: z.ZodNullable<z.ZodString>;
        phone: z.ZodString;
        relationshipLabel: z.ZodString;
        originWords: z.ZodString;
        arrivalOn: z.ZodString;
        departureOn: z.ZodString;
        nights: z.ZodNumber;
        stay: z.ZodEnum<["arriving", "staying", "left"]>;
        host: z.ZodObject<{
            kind: z.ZodEnum<["tenant", "landlord", "hotel"]>;
            /** The tenant or the landlord who filed the guest; for a hotel, the business. */
            name: z.ZodString;
            phone: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            kind: "hotel" | "landlord" | "tenant";
            phone: string | null;
        }, {
            name: string;
            kind: "hotel" | "landlord" | "tenant";
            phone: string | null;
        }>;
        /** Where they stay: the type of place, its own kind in words, the business or building, the room or unit. */
        place: z.ZodObject<{
            type: z.ZodEnum<["hotel", "lodge", "guest_house", "apartment", "residence", "other"]>;
            kindLabel: z.ZodString;
            name: z.ZodString;
            room: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge";
            name: string;
            room: string | null;
            kindLabel: string;
        }, {
            type: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge";
            name: string;
            room: string | null;
            kindLabel: string;
        }>;
        /** When the desk checked the guest in (a hotel stay), or null. */
        checkedInAt: z.ZodNullable<z.ZodString>;
        home: z.ZodObject<{
            propertyName: z.ZodString;
            unitLabel: z.ZodNullable<z.ZodString>;
            /** Street, then village up to district, each place once. */
            address: z.ZodString;
            /** The village and cell by name, for a list that covers several. */
            villageName: z.ZodNullable<z.ZodString>;
            cellName: z.ZodNullable<z.ZodString>;
            villageId: z.ZodNullable<z.ZodNumber>;
            cellId: z.ZodNullable<z.ZodNumber>;
            sectorId: z.ZodNullable<z.ZodNumber>;
            districtId: z.ZodNullable<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            districtId: number | null;
            sectorId: number | null;
            cellId: number | null;
            villageId: number | null;
            address: string;
            propertyName: string;
            unitLabel: string | null;
            villageName: string | null;
            cellName: string | null;
        }, {
            districtId: number | null;
            sectorId: number | null;
            cellId: number | null;
            villageId: number | null;
            address: string;
            propertyName: string;
            unitLabel: string | null;
            villageName: string | null;
            cellName: string | null;
        }>;
        chain: z.ZodArray<z.ZodObject<{
            role: z.ZodEnum<["village_leader", "cell_executive", "district_officer", "dgie_village", "dgie_cell", "district_immigration", "dasso", "sector_executive", "dgie_province", "dgie_national"]>;
            roleLabel: z.ZodString;
            step: z.ZodNumber;
            state: z.ZodEnum<["waiting", "delivered", "seen"]>;
            deliveredAt: z.ZodNullable<z.ZodString>;
            seenAt: z.ZodNullable<z.ZodString>;
            seenBy: z.ZodNullable<z.ZodString>;
            flag: z.ZodNullable<z.ZodObject<{
                note: z.ZodString;
                at: z.ZodString;
                by: z.ZodNullable<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                note: string;
                at: string;
                by: string | null;
            }, {
                note: string;
                at: string;
                by: string | null;
            }>>;
        }, "strip", z.ZodTypeAny, {
            state: "waiting" | "delivered" | "seen";
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
            step: number;
            roleLabel: string;
            deliveredAt: string | null;
            seenAt: string | null;
            seenBy: string | null;
            flag: {
                note: string;
                at: string;
                by: string | null;
            } | null;
        }, {
            state: "waiting" | "delivered" | "seen";
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
            step: number;
            roleLabel: string;
            deliveredAt: string | null;
            seenAt: string | null;
            seenBy: string | null;
            flag: {
                note: string;
                at: string;
                by: string | null;
            } | null;
        }>, "many">;
        /** Opened by this leader (any of their posts covering it). */
        seenByMe: z.ZodBoolean;
        flagged: z.ZodBoolean;
        /** The host changed it after it was filed. */
        changedAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        nights: number;
        host: {
            name: string;
            kind: "hotel" | "landlord" | "tenant";
            phone: string | null;
        };
        fullName: string;
        phone: string;
        createdAt: string;
        idNumber: string | null;
        nationality: string;
        stay: "arriving" | "staying" | "left";
        arrivalOn: string;
        departureOn: string;
        home: {
            districtId: number | null;
            sectorId: number | null;
            cellId: number | null;
            villageId: number | null;
            address: string;
            propertyName: string;
            unitLabel: string | null;
            villageName: string | null;
            cellName: string | null;
        };
        idKind: "national_id" | "passport" | null;
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        chain: {
            state: "waiting" | "delivered" | "seen";
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
            step: number;
            roleLabel: string;
            deliveredAt: string | null;
            seenAt: string | null;
            seenBy: string | null;
            flag: {
                note: string;
                at: string;
                by: string | null;
            } | null;
        }[];
        flagged: boolean;
        place: {
            type: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge";
            name: string;
            room: string | null;
            kindLabel: string;
        };
        checkedInAt: string | null;
        seenByMe: boolean;
        changedAt: string | null;
    }, {
        id: string;
        nights: number;
        host: {
            name: string;
            kind: "hotel" | "landlord" | "tenant";
            phone: string | null;
        };
        fullName: string;
        phone: string;
        createdAt: string;
        idNumber: string | null;
        nationality: string;
        stay: "arriving" | "staying" | "left";
        arrivalOn: string;
        departureOn: string;
        home: {
            districtId: number | null;
            sectorId: number | null;
            cellId: number | null;
            villageId: number | null;
            address: string;
            propertyName: string;
            unitLabel: string | null;
            villageName: string | null;
            cellName: string | null;
        };
        idKind: "national_id" | "passport" | null;
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        chain: {
            state: "waiting" | "delivered" | "seen";
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
            step: number;
            roleLabel: string;
            deliveredAt: string | null;
            seenAt: string | null;
            seenBy: string | null;
            flag: {
                note: string;
                at: string;
                by: string | null;
            } | null;
        }[];
        flagged: boolean;
        place: {
            type: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge";
            name: string;
            room: string | null;
            kindLabel: string;
        };
        checkedInAt: string | null;
        seenByMe: boolean;
        changedAt: string | null;
    }>, "many">;
    page: z.ZodNumber;
    pageSize: z.ZodNumber;
    total: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    guests: {
        id: string;
        nights: number;
        host: {
            name: string;
            kind: "hotel" | "landlord" | "tenant";
            phone: string | null;
        };
        fullName: string;
        phone: string;
        createdAt: string;
        idNumber: string | null;
        nationality: string;
        stay: "arriving" | "staying" | "left";
        arrivalOn: string;
        departureOn: string;
        home: {
            districtId: number | null;
            sectorId: number | null;
            cellId: number | null;
            villageId: number | null;
            address: string;
            propertyName: string;
            unitLabel: string | null;
            villageName: string | null;
            cellName: string | null;
        };
        idKind: "national_id" | "passport" | null;
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        chain: {
            state: "waiting" | "delivered" | "seen";
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
            step: number;
            roleLabel: string;
            deliveredAt: string | null;
            seenAt: string | null;
            seenBy: string | null;
            flag: {
                note: string;
                at: string;
                by: string | null;
            } | null;
        }[];
        flagged: boolean;
        place: {
            type: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge";
            name: string;
            room: string | null;
            kindLabel: string;
        };
        checkedInAt: string | null;
        seenByMe: boolean;
        changedAt: string | null;
    }[];
    total: number;
    counts: {
        current: number;
        arriving: number;
        staying: number;
        left: number;
        flagged: number;
        later: number;
        unseen: number;
        stayingForeign: number;
        arrivingByDay: number[];
        stayingByDay: number[];
    };
    page: number;
    pageSize: number;
    audience: "local" | "dgie";
    tab: "all" | "arriving" | "staying" | "left" | "flagged";
    when: "soon" | "later";
    leader: {
        name: string | null;
        email: string;
    };
    scopes: {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        assignmentId: string;
        roleLabel: string;
    }[];
    filters: {
        sectors: {
            name: string;
            id: number;
        }[];
        cells: {
            name: string;
            id: number;
            sectorId: number;
        }[];
        villages: {
            name: string;
            id: number;
            cellId: number;
        }[];
        nationalities: {
            code: string;
            name: string;
            count: number;
        }[];
        placeTypes: {
            type: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge";
            count: number;
            label: string;
        }[];
        relationships: {
            code: string;
            count: number;
            label: string;
        }[];
    };
}, {
    guests: {
        id: string;
        nights: number;
        host: {
            name: string;
            kind: "hotel" | "landlord" | "tenant";
            phone: string | null;
        };
        fullName: string;
        phone: string;
        createdAt: string;
        idNumber: string | null;
        nationality: string;
        stay: "arriving" | "staying" | "left";
        arrivalOn: string;
        departureOn: string;
        home: {
            districtId: number | null;
            sectorId: number | null;
            cellId: number | null;
            villageId: number | null;
            address: string;
            propertyName: string;
            unitLabel: string | null;
            villageName: string | null;
            cellName: string | null;
        };
        idKind: "national_id" | "passport" | null;
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        chain: {
            state: "waiting" | "delivered" | "seen";
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
            step: number;
            roleLabel: string;
            deliveredAt: string | null;
            seenAt: string | null;
            seenBy: string | null;
            flag: {
                note: string;
                at: string;
                by: string | null;
            } | null;
        }[];
        flagged: boolean;
        place: {
            type: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge";
            name: string;
            room: string | null;
            kindLabel: string;
        };
        checkedInAt: string | null;
        seenByMe: boolean;
        changedAt: string | null;
    }[];
    total: number;
    counts: {
        arriving: number;
        staying: number;
        left: number;
        flagged: number;
        later: number;
        unseen: number;
        current?: number | undefined;
        stayingForeign?: number | undefined;
        arrivingByDay?: number[] | undefined;
        stayingByDay?: number[] | undefined;
    };
    page: number;
    pageSize: number;
    tab: "all" | "arriving" | "staying" | "left" | "flagged";
    when: "soon" | "later";
    leader: {
        name: string | null;
        email: string;
    };
    scopes: {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        assignmentId: string;
        roleLabel: string;
    }[];
    filters: {
        sectors: {
            name: string;
            id: number;
        }[];
        cells: {
            name: string;
            id: number;
            sectorId: number;
        }[];
        villages: {
            name: string;
            id: number;
            cellId: number;
        }[];
        nationalities?: {
            code: string;
            name: string;
            count: number;
        }[] | undefined;
        placeTypes?: {
            type: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge";
            count: number;
            label: string;
        }[] | undefined;
        relationships?: {
            code: string;
            count: number;
            label: string;
        }[] | undefined;
    };
    audience?: "local" | "dgie" | undefined;
}>;
export type LeaderGuestPage = z.infer<typeof LeaderGuestPage>;
/** The longest period one report covers. */
export declare const GUEST_REPORT_MAX_DAYS = 731;
export declare const GuestReportQuery: z.ZodEffects<z.ZodObject<{
    /** Only guests a leader flagged. */
    flagged: z.ZodOptional<z.ZodEnum<["only"]>>;
    /** Rwandan guests, or guests of another nationality. */
    origin: z.ZodOptional<z.ZodEnum<["nationals", "international"]>>;
    /** One nationality (ISO 3166-1 alpha-2). */
    nationality: z.ZodOptional<z.ZodString>;
    /** One relationship code (`guest_relationships`), or `hotel_guest`. */
    relationship: z.ZodOptional<z.ZodString>;
    placeType: z.ZodOptional<z.ZodEnum<["hotel", "lodge", "guest_house", "apartment", "residence", "other"]>>;
    length: z.ZodOptional<z.ZodEnum<["under_3", "week", "month"]>>;
    from: z.ZodEffects<z.ZodString, string, string>;
    to: z.ZodEffects<z.ZodString, string, string>;
    sectorId: z.ZodOptional<z.ZodNumber>;
    cellId: z.ZodOptional<z.ZodNumber>;
    villageId: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    from: string;
    to: string;
    length?: "month" | "under_3" | "week" | undefined;
    sectorId?: number | undefined;
    cellId?: number | undefined;
    villageId?: number | undefined;
    origin?: "nationals" | "international" | undefined;
    nationality?: string | undefined;
    relationship?: string | undefined;
    flagged?: "only" | undefined;
    placeType?: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge" | undefined;
}, {
    from: string;
    to: string;
    length?: "month" | "under_3" | "week" | undefined;
    sectorId?: number | undefined;
    cellId?: number | undefined;
    villageId?: number | undefined;
    origin?: "nationals" | "international" | undefined;
    nationality?: string | undefined;
    relationship?: string | undefined;
    flagged?: "only" | undefined;
    placeType?: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge" | undefined;
}>, {
    from: string;
    to: string;
    length?: "month" | "under_3" | "week" | undefined;
    sectorId?: number | undefined;
    cellId?: number | undefined;
    villageId?: number | undefined;
    origin?: "nationals" | "international" | undefined;
    nationality?: string | undefined;
    relationship?: string | undefined;
    flagged?: "only" | undefined;
    placeType?: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge" | undefined;
}, {
    from: string;
    to: string;
    length?: "month" | "under_3" | "week" | undefined;
    sectorId?: number | undefined;
    cellId?: number | undefined;
    villageId?: number | undefined;
    origin?: "nationals" | "international" | undefined;
    nationality?: string | undefined;
    relationship?: string | undefined;
    flagged?: "only" | undefined;
    placeType?: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge" | undefined;
}>;
export type GuestReportQuery = z.infer<typeof GuestReportQuery>;
export declare const ReportBucket: z.ZodEnum<["day", "week", "month"]>;
export type ReportBucket = z.infer<typeof ReportBucket>;
/** How long stays are, in bands a chart reads at a glance. */
export declare const STAY_BANDS: readonly ["same_day", "short", "days", "weeks", "month"];
export declare const StayBand: z.ZodEnum<["same_day", "short", "days", "weeks", "month"]>;
export type StayBand = z.infer<typeof StayBand>;
export declare const STAY_BAND_LABEL: Readonly<Record<StayBand, string>>;
export declare function stayBandOf(nights: number): StayBand;
/** When a guest was reported, against their arrival day (Kigali): ahead, on the day, or late. */
export declare const ReportTiming: z.ZodEnum<["before", "same_day", "after"]>;
export type ReportTiming = z.infer<typeof ReportTiming>;
export declare const REPORT_TIMING_LABEL: Readonly<Record<ReportTiming, string>>;
export declare function reportTimingOf(reportedOn: string, arrivalOn: string): ReportTiming;
export declare const GuestReport: z.ZodObject<{
    period: z.ZodObject<{
        from: z.ZodString;
        to: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        from: string;
        to: string;
    }, {
        from: string;
        to: string;
    }>;
    generatedAt: z.ZodString;
    /** Local government (every guest) or DGIE (guests from abroad only): which charts and columns it has. */
    audience: z.ZodDefault<z.ZodEnum<["local", "dgie"]>>;
    leader: z.ZodObject<{
        name: z.ZodNullable<z.ZodString>;
        email: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string | null;
        email: string;
    }, {
        name: string | null;
        email: string;
    }>;
    scopes: z.ZodArray<z.ZodObject<{
        assignmentId: z.ZodString;
        role: z.ZodEnum<["village_leader", "cell_executive", "district_officer", "dgie_village", "dgie_cell", "district_immigration", "dasso", "sector_executive", "dgie_province", "dgie_national"]>;
        roleLabel: z.ZodString;
        level: z.ZodEnum<["village", "cell", "sector", "district", "province", "country"]>;
        area: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        assignmentId: string;
        roleLabel: string;
    }, {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        assignmentId: string;
        roleLabel: string;
    }>, "many">;
    /** The narrowing applied inside the leader's area, in words, or null. */
    narrowedTo: z.ZodNullable<z.ZodString>;
    /** The guest filters applied (nationality, relationship, flagged), in words; empty with none. */
    filteredBy: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Every nationality and relationship in the period with no guest filter applied: the filters' choices. */
    choices: z.ZodDefault<z.ZodObject<{
        nationalities: z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            name: z.ZodString;
            count: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            code: string;
            name: string;
            count: number;
        }, {
            code: string;
            name: string;
            count: number;
        }>, "many">;
        relationships: z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            label: z.ZodString;
            count: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            code: string;
            count: number;
            label: string;
        }, {
            code: string;
            count: number;
            label: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        nationalities: {
            code: string;
            name: string;
            count: number;
        }[];
        relationships: {
            code: string;
            count: number;
            label: string;
        }[];
    }, {
        nationalities: {
            code: string;
            name: string;
            count: number;
        }[];
        relationships: {
            code: string;
            count: number;
            label: string;
        }[];
    }>>;
    totals: z.ZodObject<{
        /** Guests whose arrival falls in the period. */
        registered: z.ZodNumber;
        /** Guests staying today, whatever the period. */
        stayingNow: z.ZodNumber;
        fromAbroad: z.ZodNumber;
        /** Rwandan guests: registered less those from abroad. */
        nationals: z.ZodDefault<z.ZodNumber>;
        /** How many nationalities the period's guests hold. */
        nationalities: z.ZodDefault<z.ZodNumber>;
        flagged: z.ZodNumber;
        /** Mean nights per stay, one decimal; null with no guests. */
        averageNights: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        fromAbroad: number;
        flagged: number;
        nationals: number;
        nationalities: number;
        registered: number;
        stayingNow: number;
        averageNights: number | null;
    }, {
        fromAbroad: number;
        flagged: number;
        registered: number;
        stayingNow: number;
        averageNights: number | null;
        nationals?: number | undefined;
        nationalities?: number | undefined;
    }>;
    /**
     * Guests in the area on each day of the period (arrived on or before it, not yet gone), and how many of
     * them are from abroad: who was here, not only who arrived.
     */
    presentByDay: z.ZodDefault<z.ZodArray<z.ZodObject<{
        day: z.ZodString;
        label: z.ZodString;
        total: z.ZodNumber;
        fromAbroad: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        label: string;
        fromAbroad: number;
        day: string;
    }, {
        total: number;
        label: string;
        fromAbroad: number;
        day: string;
    }>, "many">>;
    /** Arrivals by type of place, with those from abroad and the mean stay there. */
    byPlaceType: z.ZodDefault<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["hotel", "lodge", "guest_house", "apartment", "residence", "other"]>;
        label: z.ZodString;
        count: z.ZodNumber;
        fromAbroad: z.ZodNumber;
        averageNights: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        type: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge";
        count: number;
        label: string;
        fromAbroad: number;
        averageNights: number | null;
    }, {
        type: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge";
        count: number;
        label: string;
        fromAbroad: number;
        averageNights: number | null;
    }>, "many">>;
    /** How long the stays are, in bands. */
    stayBands: z.ZodDefault<z.ZodArray<z.ZodObject<{
        band: z.ZodEnum<["same_day", "short", "days", "weeks", "month"]>;
        label: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        count: number;
        label: string;
        band: "month" | "days" | "same_day" | "short" | "weeks";
    }, {
        count: number;
        label: string;
        band: "month" | "days" | "same_day" | "short" | "weeks";
    }>, "many">>;
    /** When the guests were reported against their arrival day. */
    timing: z.ZodDefault<z.ZodArray<z.ZodObject<{
        timing: z.ZodEnum<["before", "same_day", "after"]>;
        label: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        count: number;
        label: string;
        timing: "same_day" | "before" | "after";
    }, {
        count: number;
        label: string;
        timing: "same_day" | "before" | "after";
    }>, "many">>;
    /** The level the area table breaks down by: one below the widest post. */
    areaLevel: z.ZodEnum<["sector", "cell", "village"]>;
    byArea: z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        name: z.ZodString;
        registered: z.ZodNumber;
        fromAbroad: z.ZodNumber;
        flagged: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: number;
        fromAbroad: number;
        flagged: number;
        registered: number;
    }, {
        name: string;
        id: number;
        fromAbroad: number;
        flagged: number;
        registered: number;
    }>, "many">;
    byNationality: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        name: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        code: string;
        name: string;
        count: number;
    }, {
        code: string;
        name: string;
        count: number;
    }>, "many">;
    byRelationship: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        label: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        code: string;
        count: number;
        label: string;
    }, {
        code: string;
        count: number;
        label: string;
    }>, "many">;
    arrivals: z.ZodObject<{
        bucket: z.ZodEnum<["day", "week", "month"]>;
        points: z.ZodArray<z.ZodObject<{
            start: z.ZodString;
            label: z.ZodString;
            count: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            count: number;
            label: string;
            start: string;
        }, {
            count: number;
            label: string;
            start: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        points: {
            count: number;
            label: string;
            start: string;
        }[];
        bucket: "month" | "week" | "day";
    }, {
        points: {
            count: number;
            label: string;
            start: string;
        }[];
        bucket: "month" | "week" | "day";
    }>;
    /**
     * How the period's guests went along the chain, one row per leader post in its order: how many it
     * received, how many reached a leader (delivered), were opened and flagged, and how many still wait
     * because nobody holds that post yet.
     */
    chain: z.ZodDefault<z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["village_leader", "cell_executive", "district_officer", "dgie_village", "dgie_cell", "district_immigration", "dasso", "sector_executive", "dgie_province", "dgie_national"]>;
        label: z.ZodString;
        step: z.ZodNumber;
        guests: z.ZodNumber;
        delivered: z.ZodNumber;
        opened: z.ZodNumber;
        flagged: z.ZodNumber;
        waiting: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        guests: number;
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        label: string;
        waiting: number;
        delivered: number;
        step: number;
        flagged: number;
        opened: number;
    }, {
        guests: number;
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        label: string;
        waiting: number;
        delivered: number;
        step: number;
        flagged: number;
        opened: number;
    }>, "many">>;
    /**
     * Homes and places with the most guests: the business or building by name and type, its address and the
     * unit, never a person's name.
     */
    topHomes: z.ZodArray<z.ZodObject<{
        name: z.ZodDefault<z.ZodString>;
        placeLabel: z.ZodDefault<z.ZodString>;
        address: z.ZodString;
        unitLabel: z.ZodNullable<z.ZodString>;
        guests: z.ZodNumber;
        fromAbroad: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        guests: number;
        address: string;
        unitLabel: string | null;
        fromAbroad: number;
        placeLabel: string;
    }, {
        guests: number;
        address: string;
        unitLabel: string | null;
        name?: string | undefined;
        fromAbroad?: number | undefined;
        placeLabel?: string | undefined;
    }>, "many">;
    /** Records older than the retention period are purged; their counts are folded into the totals. */
    purged: z.ZodNullable<z.ZodObject<{
        before: z.ZodString;
        registered: z.ZodNumber;
        fromAbroad: z.ZodNumber;
        flagged: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        fromAbroad: number;
        flagged: number;
        before: string;
        registered: number;
    }, {
        fromAbroad: number;
        flagged: number;
        before: string;
        registered: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    audience: "local" | "dgie";
    totals: {
        fromAbroad: number;
        flagged: number;
        nationals: number;
        nationalities: number;
        registered: number;
        stayingNow: number;
        averageNights: number | null;
    };
    choices: {
        nationalities: {
            code: string;
            name: string;
            count: number;
        }[];
        relationships: {
            code: string;
            count: number;
            label: string;
        }[];
    };
    chain: {
        guests: number;
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        label: string;
        waiting: number;
        delivered: number;
        step: number;
        flagged: number;
        opened: number;
    }[];
    leader: {
        name: string | null;
        email: string;
    };
    scopes: {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        assignmentId: string;
        roleLabel: string;
    }[];
    period: {
        from: string;
        to: string;
    };
    generatedAt: string;
    narrowedTo: string | null;
    filteredBy: string[];
    presentByDay: {
        total: number;
        label: string;
        fromAbroad: number;
        day: string;
    }[];
    byPlaceType: {
        type: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge";
        count: number;
        label: string;
        fromAbroad: number;
        averageNights: number | null;
    }[];
    stayBands: {
        count: number;
        label: string;
        band: "month" | "days" | "same_day" | "short" | "weeks";
    }[];
    timing: {
        count: number;
        label: string;
        timing: "same_day" | "before" | "after";
    }[];
    areaLevel: "sector" | "cell" | "village";
    byArea: {
        name: string;
        id: number;
        fromAbroad: number;
        flagged: number;
        registered: number;
    }[];
    byNationality: {
        code: string;
        name: string;
        count: number;
    }[];
    byRelationship: {
        code: string;
        count: number;
        label: string;
    }[];
    arrivals: {
        points: {
            count: number;
            label: string;
            start: string;
        }[];
        bucket: "month" | "week" | "day";
    };
    topHomes: {
        name: string;
        guests: number;
        address: string;
        unitLabel: string | null;
        fromAbroad: number;
        placeLabel: string;
    }[];
    purged: {
        fromAbroad: number;
        flagged: number;
        before: string;
        registered: number;
    } | null;
}, {
    totals: {
        fromAbroad: number;
        flagged: number;
        registered: number;
        stayingNow: number;
        averageNights: number | null;
        nationals?: number | undefined;
        nationalities?: number | undefined;
    };
    leader: {
        name: string | null;
        email: string;
    };
    scopes: {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        assignmentId: string;
        roleLabel: string;
    }[];
    period: {
        from: string;
        to: string;
    };
    generatedAt: string;
    narrowedTo: string | null;
    areaLevel: "sector" | "cell" | "village";
    byArea: {
        name: string;
        id: number;
        fromAbroad: number;
        flagged: number;
        registered: number;
    }[];
    byNationality: {
        code: string;
        name: string;
        count: number;
    }[];
    byRelationship: {
        code: string;
        count: number;
        label: string;
    }[];
    arrivals: {
        points: {
            count: number;
            label: string;
            start: string;
        }[];
        bucket: "month" | "week" | "day";
    };
    topHomes: {
        guests: number;
        address: string;
        unitLabel: string | null;
        name?: string | undefined;
        fromAbroad?: number | undefined;
        placeLabel?: string | undefined;
    }[];
    purged: {
        fromAbroad: number;
        flagged: number;
        before: string;
        registered: number;
    } | null;
    audience?: "local" | "dgie" | undefined;
    choices?: {
        nationalities: {
            code: string;
            name: string;
            count: number;
        }[];
        relationships: {
            code: string;
            count: number;
            label: string;
        }[];
    } | undefined;
    chain?: {
        guests: number;
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        label: string;
        waiting: number;
        delivered: number;
        step: number;
        flagged: number;
        opened: number;
    }[] | undefined;
    filteredBy?: string[] | undefined;
    presentByDay?: {
        total: number;
        label: string;
        fromAbroad: number;
        day: string;
    }[] | undefined;
    byPlaceType?: {
        type: "residence" | "other" | "hotel" | "guest_house" | "apartment" | "lodge";
        count: number;
        label: string;
        fromAbroad: number;
        averageNights: number | null;
    }[] | undefined;
    stayBands?: {
        count: number;
        label: string;
        band: "month" | "days" | "same_day" | "short" | "weeks";
    }[] | undefined;
    timing?: {
        count: number;
        label: string;
        timing: "same_day" | "before" | "after";
    }[] | undefined;
}>;
export type GuestReport = z.infer<typeof GuestReport>;
/** How an appointment is grouped on the admin screen. */
export declare const AppointmentKind: z.ZodEnum<["leader", "reviewer", "officer"]>;
export type AppointmentKind = z.infer<typeof AppointmentKind>;
export declare function appointmentKindOf(role: OversightRole): AppointmentKind;
export declare const OversightAppointment: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    name: z.ZodNullable<z.ZodString>;
    email: z.ZodString;
    role: z.ZodEnum<["tax_compliance_officer", "business_field_verifier", "business_approver", "psf_membership_officer", "village_leader", "dasso", "cell_executive", "district_officer", "district_immigration", "sector_executive", "dgie_province", "dgie_national", "dgie_village", "dgie_cell", "psf_business_officer"]>;
    roleLabel: z.ZodString;
    kind: z.ZodEnum<["leader", "reviewer", "officer"]>;
    bodyCode: z.ZodString;
    bodyName: z.ZodNullable<z.ZodString>;
    title: z.ZodNullable<z.ZodString>;
    scopeLevel: z.ZodEnum<["country", "province", "district", "sector", "cell", "village"]>;
    /** The area in words, village up to district; "Rwanda" for the whole country. */
    area: z.ZodString;
    provinceId: z.ZodNullable<z.ZodNumber>;
    districtId: z.ZodNullable<z.ZodNumber>;
    sectorId: z.ZodNullable<z.ZodNumber>;
    cellId: z.ZodNullable<z.ZodNumber>;
    villageId: z.ZodNullable<z.ZodNumber>;
    grantedAt: z.ZodString;
    grantedBy: z.ZodNullable<z.ZodString>;
    /** For a leader: guest registrations delivered to this post, and how many were opened. */
    delivered: z.ZodNumber;
    seen: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string | null;
    id: string;
    kind: "officer" | "leader" | "reviewer";
    provinceId: number | null;
    districtId: number | null;
    sectorId: number | null;
    cellId: number | null;
    villageId: number | null;
    email: string;
    role: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell" | "psf_business_officer";
    title: string | null;
    userId: string;
    scopeLevel: "country" | "province" | "district" | "sector" | "cell" | "village";
    grantedAt: string;
    delivered: number;
    area: string;
    bodyCode: string;
    bodyName: string | null;
    seen: number;
    roleLabel: string;
    grantedBy: string | null;
}, {
    name: string | null;
    id: string;
    kind: "officer" | "leader" | "reviewer";
    provinceId: number | null;
    districtId: number | null;
    sectorId: number | null;
    cellId: number | null;
    villageId: number | null;
    email: string;
    role: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell" | "psf_business_officer";
    title: string | null;
    userId: string;
    scopeLevel: "country" | "province" | "district" | "sector" | "cell" | "village";
    grantedAt: string;
    delivered: number;
    area: string;
    bodyCode: string;
    bodyName: string | null;
    seen: number;
    roleLabel: string;
    grantedBy: string | null;
}>;
export type OversightAppointment = z.infer<typeof OversightAppointment>;
export declare const OversightAppointmentQuery: z.ZodObject<{
    role: z.ZodOptional<z.ZodEnum<["tax_compliance_officer", "business_field_verifier", "business_approver", "psf_membership_officer", "village_leader", "dasso", "cell_executive", "district_officer", "district_immigration", "sector_executive", "dgie_province", "dgie_national", "dgie_village", "dgie_cell", "psf_business_officer"]>>;
    kind: z.ZodOptional<z.ZodEnum<["leader", "reviewer", "officer"]>>;
    provinceId: z.ZodOptional<z.ZodNumber>;
    districtId: z.ZodOptional<z.ZodNumber>;
    sectorId: z.ZodOptional<z.ZodNumber>;
    cellId: z.ZodOptional<z.ZodNumber>;
    villageId: z.ZodOptional<z.ZodNumber>;
    q: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    kind?: "officer" | "leader" | "reviewer" | undefined;
    provinceId?: number | undefined;
    districtId?: number | undefined;
    sectorId?: number | undefined;
    cellId?: number | undefined;
    villageId?: number | undefined;
    role?: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell" | "psf_business_officer" | undefined;
    q?: string | undefined;
}, {
    kind?: "officer" | "leader" | "reviewer" | undefined;
    provinceId?: number | undefined;
    districtId?: number | undefined;
    sectorId?: number | undefined;
    cellId?: number | undefined;
    villageId?: number | undefined;
    role?: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell" | "psf_business_officer" | undefined;
    q?: string | undefined;
}>;
export type OversightAppointmentQuery = z.infer<typeof OversightAppointmentQuery>;
/** A place's names from the province down, as far as it is known: a form prefills the place picker with it. */
export declare const PlaceNames: z.ZodObject<{
    province: z.ZodNullable<z.ZodString>;
    district: z.ZodNullable<z.ZodString>;
    sector: z.ZodNullable<z.ZodString>;
    cell: z.ZodNullable<z.ZodString>;
    village: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    province: string | null;
    district: string | null;
    sector: string | null;
    cell: string | null;
    village: string | null;
}, {
    province: string | null;
    district: string | null;
    sector: string | null;
    cell: string | null;
    village: string | null;
}>;
export type PlaceNames = z.infer<typeof PlaceNames>;
/** Guests waiting because nobody holds a post in an area. */
export declare const WaitingArea: z.ZodObject<{
    role: z.ZodEnum<["village_leader", "cell_executive", "district_officer", "dgie_village", "dgie_cell", "district_immigration", "dasso", "sector_executive", "dgie_province", "dgie_national"]>;
    roleLabel: z.ZodString;
    level: z.ZodEnum<["village", "cell", "sector", "district", "province", "country"]>;
    /** In words; "No village on record" when the home has none yet. */
    area: z.ZodString;
    located: z.ZodBoolean;
    provinceId: z.ZodNullable<z.ZodNumber>;
    districtId: z.ZodNullable<z.ZodNumber>;
    sectorId: z.ZodNullable<z.ZodNumber>;
    cellId: z.ZodNullable<z.ZodNumber>;
    villageId: z.ZodNullable<z.ZodNumber>;
    names: z.ZodObject<{
        province: z.ZodNullable<z.ZodString>;
        district: z.ZodNullable<z.ZodString>;
        sector: z.ZodNullable<z.ZodString>;
        cell: z.ZodNullable<z.ZodString>;
        village: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        province: string | null;
        district: string | null;
        sector: string | null;
        cell: string | null;
        village: string | null;
    }, {
        province: string | null;
        district: string | null;
        sector: string | null;
        cell: string | null;
        village: string | null;
    }>;
    reports: z.ZodNumber;
    oldestArrival: z.ZodString;
}, "strip", z.ZodTypeAny, {
    provinceId: number | null;
    districtId: number | null;
    sectorId: number | null;
    cellId: number | null;
    villageId: number | null;
    role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
    level: "country" | "province" | "district" | "sector" | "cell" | "village";
    area: string;
    roleLabel: string;
    located: boolean;
    names: {
        province: string | null;
        district: string | null;
        sector: string | null;
        cell: string | null;
        village: string | null;
    };
    reports: number;
    oldestArrival: string;
}, {
    provinceId: number | null;
    districtId: number | null;
    sectorId: number | null;
    cellId: number | null;
    villageId: number | null;
    role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
    level: "country" | "province" | "district" | "sector" | "cell" | "village";
    area: string;
    roleLabel: string;
    located: boolean;
    names: {
        province: string | null;
        district: string | null;
        sector: string | null;
        cell: string | null;
        village: string | null;
    };
    reports: number;
    oldestArrival: string;
}>;
export type WaitingArea = z.infer<typeof WaitingArea>;
export declare const OversightAppointmentList: z.ZodObject<{
    appointments: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        userId: z.ZodString;
        name: z.ZodNullable<z.ZodString>;
        email: z.ZodString;
        role: z.ZodEnum<["tax_compliance_officer", "business_field_verifier", "business_approver", "psf_membership_officer", "village_leader", "dasso", "cell_executive", "district_officer", "district_immigration", "sector_executive", "dgie_province", "dgie_national", "dgie_village", "dgie_cell", "psf_business_officer"]>;
        roleLabel: z.ZodString;
        kind: z.ZodEnum<["leader", "reviewer", "officer"]>;
        bodyCode: z.ZodString;
        bodyName: z.ZodNullable<z.ZodString>;
        title: z.ZodNullable<z.ZodString>;
        scopeLevel: z.ZodEnum<["country", "province", "district", "sector", "cell", "village"]>;
        /** The area in words, village up to district; "Rwanda" for the whole country. */
        area: z.ZodString;
        provinceId: z.ZodNullable<z.ZodNumber>;
        districtId: z.ZodNullable<z.ZodNumber>;
        sectorId: z.ZodNullable<z.ZodNumber>;
        cellId: z.ZodNullable<z.ZodNumber>;
        villageId: z.ZodNullable<z.ZodNumber>;
        grantedAt: z.ZodString;
        grantedBy: z.ZodNullable<z.ZodString>;
        /** For a leader: guest registrations delivered to this post, and how many were opened. */
        delivered: z.ZodNumber;
        seen: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string | null;
        id: string;
        kind: "officer" | "leader" | "reviewer";
        provinceId: number | null;
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        email: string;
        role: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell" | "psf_business_officer";
        title: string | null;
        userId: string;
        scopeLevel: "country" | "province" | "district" | "sector" | "cell" | "village";
        grantedAt: string;
        delivered: number;
        area: string;
        bodyCode: string;
        bodyName: string | null;
        seen: number;
        roleLabel: string;
        grantedBy: string | null;
    }, {
        name: string | null;
        id: string;
        kind: "officer" | "leader" | "reviewer";
        provinceId: number | null;
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        email: string;
        role: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell" | "psf_business_officer";
        title: string | null;
        userId: string;
        scopeLevel: "country" | "province" | "district" | "sector" | "cell" | "village";
        grantedAt: string;
        delivered: number;
        area: string;
        bodyCode: string;
        bodyName: string | null;
        seen: number;
        roleLabel: string;
        grantedBy: string | null;
    }>, "many">;
    counts: z.ZodObject<{
        leader: z.ZodNumber;
        reviewer: z.ZodNumber;
        officer: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        officer: number;
        leader: number;
        reviewer: number;
    }, {
        officer: number;
        leader: number;
        reviewer: number;
    }>;
    waiting: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["village_leader", "cell_executive", "district_officer", "dgie_village", "dgie_cell", "district_immigration", "dasso", "sector_executive", "dgie_province", "dgie_national"]>;
        roleLabel: z.ZodString;
        level: z.ZodEnum<["village", "cell", "sector", "district", "province", "country"]>;
        /** In words; "No village on record" when the home has none yet. */
        area: z.ZodString;
        located: z.ZodBoolean;
        provinceId: z.ZodNullable<z.ZodNumber>;
        districtId: z.ZodNullable<z.ZodNumber>;
        sectorId: z.ZodNullable<z.ZodNumber>;
        cellId: z.ZodNullable<z.ZodNumber>;
        villageId: z.ZodNullable<z.ZodNumber>;
        names: z.ZodObject<{
            province: z.ZodNullable<z.ZodString>;
            district: z.ZodNullable<z.ZodString>;
            sector: z.ZodNullable<z.ZodString>;
            cell: z.ZodNullable<z.ZodString>;
            village: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            province: string | null;
            district: string | null;
            sector: string | null;
            cell: string | null;
            village: string | null;
        }, {
            province: string | null;
            district: string | null;
            sector: string | null;
            cell: string | null;
            village: string | null;
        }>;
        reports: z.ZodNumber;
        oldestArrival: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        provinceId: number | null;
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        roleLabel: string;
        located: boolean;
        names: {
            province: string | null;
            district: string | null;
            sector: string | null;
            cell: string | null;
            village: string | null;
        };
        reports: number;
        oldestArrival: string;
    }, {
        provinceId: number | null;
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        roleLabel: string;
        located: boolean;
        names: {
            province: string | null;
            district: string | null;
            sector: string | null;
            cell: string | null;
            village: string | null;
        };
        reports: number;
        oldestArrival: string;
    }>, "many">;
    waitingReports: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    waiting: {
        provinceId: number | null;
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        roleLabel: string;
        located: boolean;
        names: {
            province: string | null;
            district: string | null;
            sector: string | null;
            cell: string | null;
            village: string | null;
        };
        reports: number;
        oldestArrival: string;
    }[];
    counts: {
        officer: number;
        leader: number;
        reviewer: number;
    };
    appointments: {
        name: string | null;
        id: string;
        kind: "officer" | "leader" | "reviewer";
        provinceId: number | null;
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        email: string;
        role: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell" | "psf_business_officer";
        title: string | null;
        userId: string;
        scopeLevel: "country" | "province" | "district" | "sector" | "cell" | "village";
        grantedAt: string;
        delivered: number;
        area: string;
        bodyCode: string;
        bodyName: string | null;
        seen: number;
        roleLabel: string;
        grantedBy: string | null;
    }[];
    waitingReports: number;
}, {
    waiting: {
        provinceId: number | null;
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        roleLabel: string;
        located: boolean;
        names: {
            province: string | null;
            district: string | null;
            sector: string | null;
            cell: string | null;
            village: string | null;
        };
        reports: number;
        oldestArrival: string;
    }[];
    counts: {
        officer: number;
        leader: number;
        reviewer: number;
    };
    appointments: {
        name: string | null;
        id: string;
        kind: "officer" | "leader" | "reviewer";
        provinceId: number | null;
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        email: string;
        role: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell" | "psf_business_officer";
        title: string | null;
        userId: string;
        scopeLevel: "country" | "province" | "district" | "sector" | "cell" | "village";
        grantedAt: string;
        delivered: number;
        area: string;
        bodyCode: string;
        bodyName: string | null;
        seen: number;
        roleLabel: string;
        grantedBy: string | null;
    }[];
    waitingReports: number;
}>;
export type OversightAppointmentList = z.infer<typeof OversightAppointmentList>;
/**
 * Appoint a person to a post by email (`POST /admin/local-leaders`). The person
 * is found by email or created with it and signs in with an emailed code. The
 * area names exactly the level the role covers: a village for a village
 * leader, a sector for a DASSO, a cell for a cell executive secretary, a
 * district for the two district roles; a business reviewer the country, a
 * province or a district.
 */
export declare const AppointOfficerRequest: z.ZodEffects<z.ZodObject<{
    email: z.ZodString;
    name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    role: z.ZodEnum<["tax_compliance_officer", "business_field_verifier", "business_approver", "psf_membership_officer", "village_leader", "dasso", "cell_executive", "district_officer", "district_immigration", "sector_executive", "dgie_province", "dgie_national", "dgie_village", "dgie_cell", "psf_business_officer"]>;
    governmentBodyCode: z.ZodString;
    governmentTitle: z.ZodString;
    scopeLevel: z.ZodEnum<["country", "province", "district", "sector", "cell", "village"]>;
    provinceId: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    districtId: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    sectorId: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    cellId: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    villageId: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    role: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell" | "psf_business_officer";
    governmentBodyCode: string;
    governmentTitle: string;
    reason: string;
    scopeLevel: "country" | "province" | "district" | "sector" | "cell" | "village";
    name?: string | null | undefined;
    provinceId?: number | null | undefined;
    districtId?: number | null | undefined;
    sectorId?: number | null | undefined;
    cellId?: number | null | undefined;
    villageId?: number | null | undefined;
}, {
    email: string;
    role: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell" | "psf_business_officer";
    governmentBodyCode: string;
    governmentTitle: string;
    reason: string;
    scopeLevel: "country" | "province" | "district" | "sector" | "cell" | "village";
    name?: string | null | undefined;
    provinceId?: number | null | undefined;
    districtId?: number | null | undefined;
    sectorId?: number | null | undefined;
    cellId?: number | null | undefined;
    villageId?: number | null | undefined;
}>, {
    email: string;
    role: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell" | "psf_business_officer";
    governmentBodyCode: string;
    governmentTitle: string;
    reason: string;
    scopeLevel: "country" | "province" | "district" | "sector" | "cell" | "village";
    name?: string | null | undefined;
    provinceId?: number | null | undefined;
    districtId?: number | null | undefined;
    sectorId?: number | null | undefined;
    cellId?: number | null | undefined;
    villageId?: number | null | undefined;
}, {
    email: string;
    role: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell" | "psf_business_officer";
    governmentBodyCode: string;
    governmentTitle: string;
    reason: string;
    scopeLevel: "country" | "province" | "district" | "sector" | "cell" | "village";
    name?: string | null | undefined;
    provinceId?: number | null | undefined;
    districtId?: number | null | undefined;
    sectorId?: number | null | undefined;
    cellId?: number | null | undefined;
    villageId?: number | null | undefined;
}>;
export type AppointOfficerRequest = z.infer<typeof AppointOfficerRequest>;
/** Ending an appointment says why (`DELETE /admin/local-leaders/:id?reason=`). */
export declare const EndAppointmentQuery: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export type EndAppointmentQuery = z.infer<typeof EndAppointmentQuery>;
export declare const LeaderCoverage: z.ZodObject<{
    generatedAt: z.ZodString;
    roles: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["village_leader", "cell_executive", "district_officer", "dgie_village", "dgie_cell", "district_immigration", "dasso", "sector_executive", "dgie_province", "dgie_national"]>;
        roleLabel: z.ZodString;
        level: z.ZodEnum<["village", "cell", "sector", "district", "province", "country"]>;
        /** Every area of this level in Rwanda, and how many have someone in the post. */
        nationwide: z.ZodObject<{
            areas: z.ZodNumber;
            covered: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            covered: number;
            areas: number;
        }, {
            covered: number;
            areas: number;
        }>;
        /** Areas with rented homes on Injishi, and how many have someone in the post. */
        withHomes: z.ZodObject<{
            areas: z.ZodNumber;
            covered: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            covered: number;
            areas: number;
        }, {
            covered: number;
            areas: number;
        }>;
    }, "strip", z.ZodTypeAny, {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        roleLabel: string;
        nationwide: {
            covered: number;
            areas: number;
        };
        withHomes: {
            covered: number;
            areas: number;
        };
    }, {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        roleLabel: string;
        nationwide: {
            covered: number;
            areas: number;
        };
        withHomes: {
            covered: number;
            areas: number;
        };
    }>, "many">;
    /** Areas with rented homes and nobody in the post, most waiting guests first. */
    uncovered: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["village_leader", "cell_executive", "district_officer", "dgie_village", "dgie_cell", "district_immigration", "dasso", "sector_executive", "dgie_province", "dgie_national"]>;
        roleLabel: z.ZodString;
        level: z.ZodEnum<["village", "cell", "sector", "district", "province", "country"]>;
        area: z.ZodString;
        provinceId: z.ZodNullable<z.ZodNumber>;
        districtId: z.ZodNullable<z.ZodNumber>;
        sectorId: z.ZodNullable<z.ZodNumber>;
        cellId: z.ZodNullable<z.ZodNumber>;
        villageId: z.ZodNullable<z.ZodNumber>;
        names: z.ZodObject<{
            province: z.ZodNullable<z.ZodString>;
            district: z.ZodNullable<z.ZodString>;
            sector: z.ZodNullable<z.ZodString>;
            cell: z.ZodNullable<z.ZodString>;
            village: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            province: string | null;
            district: string | null;
            sector: string | null;
            cell: string | null;
            village: string | null;
        }, {
            province: string | null;
            district: string | null;
            sector: string | null;
            cell: string | null;
            village: string | null;
        }>;
        homes: z.ZodNumber;
        waitingReports: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        provinceId: number | null;
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        homes: number;
        roleLabel: string;
        names: {
            province: string | null;
            district: string | null;
            sector: string | null;
            cell: string | null;
            village: string | null;
        };
        waitingReports: number;
    }, {
        provinceId: number | null;
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        homes: number;
        roleLabel: string;
        names: {
            province: string | null;
            district: string | null;
            sector: string | null;
            cell: string | null;
            village: string | null;
        };
        waitingReports: number;
    }>, "many">;
    waiting: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["village_leader", "cell_executive", "district_officer", "dgie_village", "dgie_cell", "district_immigration", "dasso", "sector_executive", "dgie_province", "dgie_national"]>;
        roleLabel: z.ZodString;
        level: z.ZodEnum<["village", "cell", "sector", "district", "province", "country"]>;
        /** In words; "No village on record" when the home has none yet. */
        area: z.ZodString;
        located: z.ZodBoolean;
        provinceId: z.ZodNullable<z.ZodNumber>;
        districtId: z.ZodNullable<z.ZodNumber>;
        sectorId: z.ZodNullable<z.ZodNumber>;
        cellId: z.ZodNullable<z.ZodNumber>;
        villageId: z.ZodNullable<z.ZodNumber>;
        names: z.ZodObject<{
            province: z.ZodNullable<z.ZodString>;
            district: z.ZodNullable<z.ZodString>;
            sector: z.ZodNullable<z.ZodString>;
            cell: z.ZodNullable<z.ZodString>;
            village: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            province: string | null;
            district: string | null;
            sector: string | null;
            cell: string | null;
            village: string | null;
        }, {
            province: string | null;
            district: string | null;
            sector: string | null;
            cell: string | null;
            village: string | null;
        }>;
        reports: z.ZodNumber;
        oldestArrival: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        provinceId: number | null;
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        roleLabel: string;
        located: boolean;
        names: {
            province: string | null;
            district: string | null;
            sector: string | null;
            cell: string | null;
            village: string | null;
        };
        reports: number;
        oldestArrival: string;
    }, {
        provinceId: number | null;
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        roleLabel: string;
        located: boolean;
        names: {
            province: string | null;
            district: string | null;
            sector: string | null;
            cell: string | null;
            village: string | null;
        };
        reports: number;
        oldestArrival: string;
    }>, "many">;
    /** Leaders with guests delivered who never opened one. */
    neverOpened: z.ZodArray<z.ZodObject<{
        assignmentId: z.ZodString;
        name: z.ZodNullable<z.ZodString>;
        email: z.ZodString;
        role: z.ZodEnum<["village_leader", "cell_executive", "district_officer", "dgie_village", "dgie_cell", "district_immigration", "dasso", "sector_executive", "dgie_province", "dgie_national"]>;
        roleLabel: z.ZodString;
        area: z.ZodString;
        delivered: z.ZodNumber;
        firstDeliveredAt: z.ZodString;
        grantedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string | null;
        email: string;
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        grantedAt: string;
        delivered: number;
        area: string;
        assignmentId: string;
        roleLabel: string;
        firstDeliveredAt: string;
    }, {
        name: string | null;
        email: string;
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        grantedAt: string;
        delivered: number;
        area: string;
        assignmentId: string;
        roleLabel: string;
        firstDeliveredAt: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    waiting: {
        provinceId: number | null;
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        roleLabel: string;
        located: boolean;
        names: {
            province: string | null;
            district: string | null;
            sector: string | null;
            cell: string | null;
            village: string | null;
        };
        reports: number;
        oldestArrival: string;
    }[];
    roles: {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        roleLabel: string;
        nationwide: {
            covered: number;
            areas: number;
        };
        withHomes: {
            covered: number;
            areas: number;
        };
    }[];
    uncovered: {
        provinceId: number | null;
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        homes: number;
        roleLabel: string;
        names: {
            province: string | null;
            district: string | null;
            sector: string | null;
            cell: string | null;
            village: string | null;
        };
        waitingReports: number;
    }[];
    generatedAt: string;
    neverOpened: {
        name: string | null;
        email: string;
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        grantedAt: string;
        delivered: number;
        area: string;
        assignmentId: string;
        roleLabel: string;
        firstDeliveredAt: string;
    }[];
}, {
    waiting: {
        provinceId: number | null;
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        roleLabel: string;
        located: boolean;
        names: {
            province: string | null;
            district: string | null;
            sector: string | null;
            cell: string | null;
            village: string | null;
        };
        reports: number;
        oldestArrival: string;
    }[];
    roles: {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        roleLabel: string;
        nationwide: {
            covered: number;
            areas: number;
        };
        withHomes: {
            covered: number;
            areas: number;
        };
    }[];
    uncovered: {
        provinceId: number | null;
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        homes: number;
        roleLabel: string;
        names: {
            province: string | null;
            district: string | null;
            sector: string | null;
            cell: string | null;
            village: string | null;
        };
        waitingReports: number;
    }[];
    generatedAt: string;
    neverOpened: {
        name: string | null;
        email: string;
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | "dgie_village" | "dgie_cell";
        grantedAt: string;
        delivered: number;
        area: string;
        assignmentId: string;
        roleLabel: string;
        firstDeliveredAt: string;
    }[];
}>;
export type LeaderCoverage = z.infer<typeof LeaderCoverage>;
//# sourceMappingURL=guests.d.ts.map