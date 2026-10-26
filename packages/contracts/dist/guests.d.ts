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
 * The posts a guest is reported to, in two chains. Local government (MINALOC) reads every guest, Rwandan
 * or foreign: village leader, sector DASSO, cell then sector executive secretary, district officer. The
 * immigration directorate (DGIE) reads guests from abroad only: district, province, headquarters.
 */
export declare const LEADER_ROLES: readonly ["village_leader", "dasso", "cell_executive", "sector_executive", "district_officer", "district_immigration", "dgie_province", "dgie_national"];
export declare const LeaderRole: z.ZodEnum<["village_leader", "dasso", "cell_executive", "sector_executive", "district_officer", "district_immigration", "dgie_province", "dgie_national"]>;
export type LeaderRole = z.infer<typeof LeaderRole>;
/** Is this oversight role one of the local leaders? */
export declare function isLeaderRole(role: OversightRole | string): role is LeaderRole;
/** The roles that review businesses (field verification and approval). */
export declare const REVIEWER_ROLES: readonly ["business_field_verifier", "business_approver"];
/** What each leader is called, in full. */
export declare const LEADER_ROLE_LABEL: Readonly<Record<LeaderRole, string>>;
/** The short words a chip or a column uses. */
export declare const LEADER_ROLE_SHORT: Readonly<Record<LeaderRole, string>>;
/** Where each post sits in a registration's chain, from 1: local government first, then DGIE. */
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
 * The chain a registration goes along, in order. Every guest goes up the local government chain: village
 * leader, sector DASSO, cell and sector executive secretaries, district officer. A guest from abroad also
 * goes up the DGIE chain: district, province, headquarters.
 */
export declare function guestChainFor(fromAbroad: boolean): LeaderRole[];
/** A guest is "from abroad" when their nationality is not Rwandan. */
export declare function isFromAbroad(nationality: string): boolean;
export declare const GuestHostKind: z.ZodEnum<["tenant", "landlord"]>;
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
    villageId: number;
    kind: "village";
}, {
    villageId: number;
    kind: "village";
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
        villageId: number;
        kind: "village";
    }, {
        villageId: number;
        kind: "village";
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
    phone: string;
    arrivalOn: string;
    departureOn: string;
    origin: {
        villageId: number;
        kind: "village";
    } | {
        kind: "country";
        countryCode: string;
    };
    nationality: string;
    relationship: string;
    idNumber?: string | null | undefined;
    idKind?: "national_id" | "passport" | null | undefined;
    relationshipOther?: string | null | undefined;
}, {
    fullName: string;
    phone: string;
    arrivalOn: string;
    departureOn: string;
    origin: {
        villageId: number;
        kind: "village";
    } | {
        kind: "country";
        countryCode: string;
    };
    relationship: string;
    idNumber?: string | null | undefined;
    idKind?: "national_id" | "passport" | null | undefined;
    relationshipOther?: string | null | undefined;
    nationality?: string | undefined;
}>, {
    fullName: string;
    phone: string;
    arrivalOn: string;
    departureOn: string;
    origin: {
        villageId: number;
        kind: "village";
    } | {
        kind: "country";
        countryCode: string;
    };
    nationality: string;
    relationship: string;
    idNumber?: string | null | undefined;
    idKind?: "national_id" | "passport" | null | undefined;
    relationshipOther?: string | null | undefined;
}, {
    fullName: string;
    phone: string;
    arrivalOn: string;
    departureOn: string;
    origin: {
        villageId: number;
        kind: "village";
    } | {
        kind: "country";
        countryCode: string;
    };
    relationship: string;
    idNumber?: string | null | undefined;
    idKind?: "national_id" | "passport" | null | undefined;
    relationshipOther?: string | null | undefined;
    nationality?: string | undefined;
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
        villageId: number;
        kind: "village";
    }, {
        villageId: number;
        kind: "village";
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
    phone: string;
    propertyId: string;
    arrivalOn: string;
    departureOn: string;
    origin: {
        villageId: number;
        kind: "village";
    } | {
        kind: "country";
        countryCode: string;
    };
    nationality: string;
    relationship: string;
    idNumber?: string | null | undefined;
    unitId?: string | null | undefined;
    idKind?: "national_id" | "passport" | null | undefined;
    relationshipOther?: string | null | undefined;
}, {
    fullName: string;
    phone: string;
    propertyId: string;
    arrivalOn: string;
    departureOn: string;
    origin: {
        villageId: number;
        kind: "village";
    } | {
        kind: "country";
        countryCode: string;
    };
    relationship: string;
    idNumber?: string | null | undefined;
    unitId?: string | null | undefined;
    idKind?: "national_id" | "passport" | null | undefined;
    relationshipOther?: string | null | undefined;
    nationality?: string | undefined;
}>, {
    fullName: string;
    phone: string;
    propertyId: string;
    arrivalOn: string;
    departureOn: string;
    origin: {
        villageId: number;
        kind: "village";
    } | {
        kind: "country";
        countryCode: string;
    };
    nationality: string;
    relationship: string;
    idNumber?: string | null | undefined;
    unitId?: string | null | undefined;
    idKind?: "national_id" | "passport" | null | undefined;
    relationshipOther?: string | null | undefined;
}, {
    fullName: string;
    phone: string;
    propertyId: string;
    arrivalOn: string;
    departureOn: string;
    origin: {
        villageId: number;
        kind: "village";
    } | {
        kind: "country";
        countryCode: string;
    };
    relationship: string;
    idNumber?: string | null | undefined;
    unitId?: string | null | undefined;
    idKind?: "national_id" | "passport" | null | undefined;
    relationshipOther?: string | null | undefined;
    nationality?: string | undefined;
}>;
export type LandlordGuestRequest = z.infer<typeof LandlordGuestRequest>;
/** One step of the chain as the host reads it: who it went to and where it stands. Never a flag. */
export declare const HostChainStep: z.ZodObject<{
    role: z.ZodEnum<["village_leader", "dasso", "cell_executive", "sector_executive", "district_officer", "district_immigration", "dgie_province", "dgie_national"]>;
    roleLabel: z.ZodString;
    step: z.ZodNumber;
    state: z.ZodEnum<["waiting", "delivered", "seen"]>;
}, "strip", z.ZodTypeAny, {
    role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
    state: "delivered" | "waiting" | "seen";
    roleLabel: string;
    step: number;
}, {
    role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
    state: "delivered" | "waiting" | "seen";
    roleLabel: string;
    step: number;
}>;
export type HostChainStep = z.infer<typeof HostChainStep>;
export declare const HostGuest: z.ZodObject<{
    id: z.ZodString;
    hostKind: z.ZodEnum<["tenant", "landlord"]>;
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
        villageId: number;
        kind: "village";
    }, {
        villageId: number;
        kind: "village";
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
        role: z.ZodEnum<["village_leader", "dasso", "cell_executive", "sector_executive", "district_officer", "district_immigration", "dgie_province", "dgie_national"]>;
        roleLabel: z.ZodString;
        step: z.ZodNumber;
        state: z.ZodEnum<["waiting", "delivered", "seen"]>;
    }, "strip", z.ZodTypeAny, {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
        state: "delivered" | "waiting" | "seen";
        roleLabel: string;
        step: number;
    }, {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
        state: "delivered" | "waiting" | "seen";
        roleLabel: string;
        step: number;
    }>, "many">;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "submitted" | "cancelled";
    fullName: string;
    id: string;
    createdAt: string;
    propertyName: string;
    phone: string;
    nights: number;
    idNumber: string | null;
    stay: "arriving" | "staying" | "left" | null;
    unitLabel: string | null;
    propertyId: string;
    arrivalOn: string;
    departureOn: string;
    unitId: string | null;
    idKind: "national_id" | "passport" | null;
    relationshipOther: string | null;
    origin: {
        villageId: number;
        kind: "village";
    } | {
        kind: "country";
        countryCode: string;
    };
    nationality: string;
    relationship: string;
    hostKind: "landlord" | "tenant";
    nationalityName: string;
    fromAbroad: boolean;
    relationshipLabel: string;
    originWords: string;
    canChange: boolean;
    chain: {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
        state: "delivered" | "waiting" | "seen";
        roleLabel: string;
        step: number;
    }[];
}, {
    status: "submitted" | "cancelled";
    fullName: string;
    id: string;
    createdAt: string;
    propertyName: string;
    phone: string;
    nights: number;
    idNumber: string | null;
    stay: "arriving" | "staying" | "left" | null;
    unitLabel: string | null;
    propertyId: string;
    arrivalOn: string;
    departureOn: string;
    unitId: string | null;
    idKind: "national_id" | "passport" | null;
    relationshipOther: string | null;
    origin: {
        villageId: number;
        kind: "village";
    } | {
        kind: "country";
        countryCode: string;
    };
    nationality: string;
    relationship: string;
    hostKind: "landlord" | "tenant";
    nationalityName: string;
    fromAbroad: boolean;
    relationshipLabel: string;
    originWords: string;
    canChange: boolean;
    chain: {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
        state: "delivered" | "waiting" | "seen";
        roleLabel: string;
        step: number;
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
    address: string | null;
    id: string;
    located: boolean;
    units: {
        id: string;
        label: string;
    }[];
}, {
    name: string;
    address: string | null;
    id: string;
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
        hostKind: z.ZodEnum<["tenant", "landlord"]>;
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
            villageId: number;
            kind: "village";
        }, {
            villageId: number;
            kind: "village";
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
            role: z.ZodEnum<["village_leader", "dasso", "cell_executive", "sector_executive", "district_officer", "district_immigration", "dgie_province", "dgie_national"]>;
            roleLabel: z.ZodString;
            step: z.ZodNumber;
            state: z.ZodEnum<["waiting", "delivered", "seen"]>;
        }, "strip", z.ZodTypeAny, {
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
            state: "delivered" | "waiting" | "seen";
            roleLabel: string;
            step: number;
        }, {
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
            state: "delivered" | "waiting" | "seen";
            roleLabel: string;
            step: number;
        }>, "many">;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "submitted" | "cancelled";
        fullName: string;
        id: string;
        createdAt: string;
        propertyName: string;
        phone: string;
        nights: number;
        idNumber: string | null;
        stay: "arriving" | "staying" | "left" | null;
        unitLabel: string | null;
        propertyId: string;
        arrivalOn: string;
        departureOn: string;
        unitId: string | null;
        idKind: "national_id" | "passport" | null;
        relationshipOther: string | null;
        origin: {
            villageId: number;
            kind: "village";
        } | {
            kind: "country";
            countryCode: string;
        };
        nationality: string;
        relationship: string;
        hostKind: "landlord" | "tenant";
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        canChange: boolean;
        chain: {
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
            state: "delivered" | "waiting" | "seen";
            roleLabel: string;
            step: number;
        }[];
    }, {
        status: "submitted" | "cancelled";
        fullName: string;
        id: string;
        createdAt: string;
        propertyName: string;
        phone: string;
        nights: number;
        idNumber: string | null;
        stay: "arriving" | "staying" | "left" | null;
        unitLabel: string | null;
        propertyId: string;
        arrivalOn: string;
        departureOn: string;
        unitId: string | null;
        idKind: "national_id" | "passport" | null;
        relationshipOther: string | null;
        origin: {
            villageId: number;
            kind: "village";
        } | {
            kind: "country";
            countryCode: string;
        };
        nationality: string;
        relationship: string;
        hostKind: "landlord" | "tenant";
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        canChange: boolean;
        chain: {
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
            state: "delivered" | "waiting" | "seen";
            roleLabel: string;
            step: number;
        }[];
    }>, "many">;
    counts: z.ZodRecord<z.ZodEnum<["arriving", "staying", "left", "cancelled"]>, z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    guests: {
        status: "submitted" | "cancelled";
        fullName: string;
        id: string;
        createdAt: string;
        propertyName: string;
        phone: string;
        nights: number;
        idNumber: string | null;
        stay: "arriving" | "staying" | "left" | null;
        unitLabel: string | null;
        propertyId: string;
        arrivalOn: string;
        departureOn: string;
        unitId: string | null;
        idKind: "national_id" | "passport" | null;
        relationshipOther: string | null;
        origin: {
            villageId: number;
            kind: "village";
        } | {
            kind: "country";
            countryCode: string;
        };
        nationality: string;
        relationship: string;
        hostKind: "landlord" | "tenant";
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        canChange: boolean;
        chain: {
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
            state: "delivered" | "waiting" | "seen";
            roleLabel: string;
            step: number;
        }[];
    }[];
    counts: Partial<Record<"cancelled" | "arriving" | "staying" | "left", number>>;
}, {
    guests: {
        status: "submitted" | "cancelled";
        fullName: string;
        id: string;
        createdAt: string;
        propertyName: string;
        phone: string;
        nights: number;
        idNumber: string | null;
        stay: "arriving" | "staying" | "left" | null;
        unitLabel: string | null;
        propertyId: string;
        arrivalOn: string;
        departureOn: string;
        unitId: string | null;
        idKind: "national_id" | "passport" | null;
        relationshipOther: string | null;
        origin: {
            villageId: number;
            kind: "village";
        } | {
            kind: "country";
            countryCode: string;
        };
        nationality: string;
        relationship: string;
        hostKind: "landlord" | "tenant";
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        canChange: boolean;
        chain: {
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
            state: "delivered" | "waiting" | "seen";
            roleLabel: string;
            step: number;
        }[];
    }[];
    counts: Partial<Record<"cancelled" | "arriving" | "staying" | "left", number>>;
}>;
export type HostGuestList = z.infer<typeof HostGuestList>;
/** A tenant's guests, with the days the lease lets a guest stay. */
export declare const TenantGuestList: z.ZodObject<{
    guests: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        hostKind: z.ZodEnum<["tenant", "landlord"]>;
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
            villageId: number;
            kind: "village";
        }, {
            villageId: number;
            kind: "village";
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
            role: z.ZodEnum<["village_leader", "dasso", "cell_executive", "sector_executive", "district_officer", "district_immigration", "dgie_province", "dgie_national"]>;
            roleLabel: z.ZodString;
            step: z.ZodNumber;
            state: z.ZodEnum<["waiting", "delivered", "seen"]>;
        }, "strip", z.ZodTypeAny, {
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
            state: "delivered" | "waiting" | "seen";
            roleLabel: string;
            step: number;
        }, {
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
            state: "delivered" | "waiting" | "seen";
            roleLabel: string;
            step: number;
        }>, "many">;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "submitted" | "cancelled";
        fullName: string;
        id: string;
        createdAt: string;
        propertyName: string;
        phone: string;
        nights: number;
        idNumber: string | null;
        stay: "arriving" | "staying" | "left" | null;
        unitLabel: string | null;
        propertyId: string;
        arrivalOn: string;
        departureOn: string;
        unitId: string | null;
        idKind: "national_id" | "passport" | null;
        relationshipOther: string | null;
        origin: {
            villageId: number;
            kind: "village";
        } | {
            kind: "country";
            countryCode: string;
        };
        nationality: string;
        relationship: string;
        hostKind: "landlord" | "tenant";
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        canChange: boolean;
        chain: {
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
            state: "delivered" | "waiting" | "seen";
            roleLabel: string;
            step: number;
        }[];
    }, {
        status: "submitted" | "cancelled";
        fullName: string;
        id: string;
        createdAt: string;
        propertyName: string;
        phone: string;
        nights: number;
        idNumber: string | null;
        stay: "arriving" | "staying" | "left" | null;
        unitLabel: string | null;
        propertyId: string;
        arrivalOn: string;
        departureOn: string;
        unitId: string | null;
        idKind: "national_id" | "passport" | null;
        relationshipOther: string | null;
        origin: {
            villageId: number;
            kind: "village";
        } | {
            kind: "country";
            countryCode: string;
        };
        nationality: string;
        relationship: string;
        hostKind: "landlord" | "tenant";
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        canChange: boolean;
        chain: {
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
            state: "delivered" | "waiting" | "seen";
            roleLabel: string;
            step: number;
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
        fullName: string;
        id: string;
        createdAt: string;
        propertyName: string;
        phone: string;
        nights: number;
        idNumber: string | null;
        stay: "arriving" | "staying" | "left" | null;
        unitLabel: string | null;
        propertyId: string;
        arrivalOn: string;
        departureOn: string;
        unitId: string | null;
        idKind: "national_id" | "passport" | null;
        relationshipOther: string | null;
        origin: {
            villageId: number;
            kind: "village";
        } | {
            kind: "country";
            countryCode: string;
        };
        nationality: string;
        relationship: string;
        hostKind: "landlord" | "tenant";
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        canChange: boolean;
        chain: {
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
            state: "delivered" | "waiting" | "seen";
            roleLabel: string;
            step: number;
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
        fullName: string;
        id: string;
        createdAt: string;
        propertyName: string;
        phone: string;
        nights: number;
        idNumber: string | null;
        stay: "arriving" | "staying" | "left" | null;
        unitLabel: string | null;
        propertyId: string;
        arrivalOn: string;
        departureOn: string;
        unitId: string | null;
        idKind: "national_id" | "passport" | null;
        relationshipOther: string | null;
        origin: {
            villageId: number;
            kind: "village";
        } | {
            kind: "country";
            countryCode: string;
        };
        nationality: string;
        relationship: string;
        hostKind: "landlord" | "tenant";
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        canChange: boolean;
        chain: {
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
            state: "delivered" | "waiting" | "seen";
            roleLabel: string;
            step: number;
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
        hostKind: z.ZodEnum<["tenant", "landlord"]>;
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
            villageId: number;
            kind: "village";
        }, {
            villageId: number;
            kind: "village";
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
            role: z.ZodEnum<["village_leader", "dasso", "cell_executive", "sector_executive", "district_officer", "district_immigration", "dgie_province", "dgie_national"]>;
            roleLabel: z.ZodString;
            step: z.ZodNumber;
            state: z.ZodEnum<["waiting", "delivered", "seen"]>;
        }, "strip", z.ZodTypeAny, {
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
            state: "delivered" | "waiting" | "seen";
            roleLabel: string;
            step: number;
        }, {
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
            state: "delivered" | "waiting" | "seen";
            roleLabel: string;
            step: number;
        }>, "many">;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "submitted" | "cancelled";
        fullName: string;
        id: string;
        createdAt: string;
        propertyName: string;
        phone: string;
        nights: number;
        idNumber: string | null;
        stay: "arriving" | "staying" | "left" | null;
        unitLabel: string | null;
        propertyId: string;
        arrivalOn: string;
        departureOn: string;
        unitId: string | null;
        idKind: "national_id" | "passport" | null;
        relationshipOther: string | null;
        origin: {
            villageId: number;
            kind: "village";
        } | {
            kind: "country";
            countryCode: string;
        };
        nationality: string;
        relationship: string;
        hostKind: "landlord" | "tenant";
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        canChange: boolean;
        chain: {
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
            state: "delivered" | "waiting" | "seen";
            roleLabel: string;
            step: number;
        }[];
    }, {
        status: "submitted" | "cancelled";
        fullName: string;
        id: string;
        createdAt: string;
        propertyName: string;
        phone: string;
        nights: number;
        idNumber: string | null;
        stay: "arriving" | "staying" | "left" | null;
        unitLabel: string | null;
        propertyId: string;
        arrivalOn: string;
        departureOn: string;
        unitId: string | null;
        idKind: "national_id" | "passport" | null;
        relationshipOther: string | null;
        origin: {
            villageId: number;
            kind: "village";
        } | {
            kind: "country";
            countryCode: string;
        };
        nationality: string;
        relationship: string;
        hostKind: "landlord" | "tenant";
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        canChange: boolean;
        chain: {
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
            state: "delivered" | "waiting" | "seen";
            roleLabel: string;
            step: number;
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
        address: string | null;
        id: string;
        located: boolean;
        units: {
            id: string;
            label: string;
        }[];
    }, {
        name: string;
        address: string | null;
        id: string;
        located: boolean;
        units: {
            id: string;
            label: string;
        }[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    guests: {
        status: "submitted" | "cancelled";
        fullName: string;
        id: string;
        createdAt: string;
        propertyName: string;
        phone: string;
        nights: number;
        idNumber: string | null;
        stay: "arriving" | "staying" | "left" | null;
        unitLabel: string | null;
        propertyId: string;
        arrivalOn: string;
        departureOn: string;
        unitId: string | null;
        idKind: "national_id" | "passport" | null;
        relationshipOther: string | null;
        origin: {
            villageId: number;
            kind: "village";
        } | {
            kind: "country";
            countryCode: string;
        };
        nationality: string;
        relationship: string;
        hostKind: "landlord" | "tenant";
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        canChange: boolean;
        chain: {
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
            state: "delivered" | "waiting" | "seen";
            roleLabel: string;
            step: number;
        }[];
    }[];
    counts: Partial<Record<"cancelled" | "arriving" | "staying" | "left", number>>;
    buildings: {
        name: string;
        address: string | null;
        id: string;
        located: boolean;
        units: {
            id: string;
            label: string;
        }[];
    }[];
}, {
    guests: {
        status: "submitted" | "cancelled";
        fullName: string;
        id: string;
        createdAt: string;
        propertyName: string;
        phone: string;
        nights: number;
        idNumber: string | null;
        stay: "arriving" | "staying" | "left" | null;
        unitLabel: string | null;
        propertyId: string;
        arrivalOn: string;
        departureOn: string;
        unitId: string | null;
        idKind: "national_id" | "passport" | null;
        relationshipOther: string | null;
        origin: {
            villageId: number;
            kind: "village";
        } | {
            kind: "country";
            countryCode: string;
        };
        nationality: string;
        relationship: string;
        hostKind: "landlord" | "tenant";
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        canChange: boolean;
        chain: {
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
            state: "delivered" | "waiting" | "seen";
            roleLabel: string;
            step: number;
        }[];
    }[];
    counts: Partial<Record<"cancelled" | "arriving" | "staying" | "left", number>>;
    buildings: {
        name: string;
        address: string | null;
        id: string;
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
export declare const LeaderGuestTab: z.ZodEnum<["arriving", "staying", "left", "flagged"]>;
export type LeaderGuestTab = z.infer<typeof LeaderGuestTab>;
/** The Arriving tab's window: the next 7 days, or everyone arriving after that. */
export declare const LeaderArrivingWhen: z.ZodEnum<["soon", "later"]>;
export type LeaderArrivingWhen = z.infer<typeof LeaderArrivingWhen>;
/** A guest filter by nationality, in the leader's words: everyone, Rwandans, or guests from other countries. */
export declare const ReportOrigin: z.ZodEnum<["nationals", "international"]>;
export type ReportOrigin = z.infer<typeof ReportOrigin>;
export declare const LeaderGuestQuery: z.ZodObject<{
    tab: z.ZodDefault<z.ZodEnum<["arriving", "staying", "left", "flagged"]>>;
    when: z.ZodDefault<z.ZodEnum<["soon", "later"]>>;
    sectorId: z.ZodOptional<z.ZodNumber>;
    cellId: z.ZodOptional<z.ZodNumber>;
    villageId: z.ZodOptional<z.ZodNumber>;
    q: z.ZodOptional<z.ZodString>;
    /** Rwandan guests, or guests of another nationality. */
    origin: z.ZodOptional<z.ZodEnum<["nationals", "international"]>>;
    /** One nationality (ISO 3166-1 alpha-2). */
    nationality: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    tab: "arriving" | "staying" | "left" | "flagged";
    when: "soon" | "later";
    sectorId?: number | undefined;
    cellId?: number | undefined;
    villageId?: number | undefined;
    q?: string | undefined;
    origin?: "nationals" | "international" | undefined;
    nationality?: string | undefined;
}, {
    sectorId?: number | undefined;
    cellId?: number | undefined;
    villageId?: number | undefined;
    page?: number | undefined;
    q?: string | undefined;
    origin?: "nationals" | "international" | undefined;
    nationality?: string | undefined;
    tab?: "arriving" | "staying" | "left" | "flagged" | undefined;
    when?: "soon" | "later" | undefined;
}>;
export type LeaderGuestQuery = z.infer<typeof LeaderGuestQuery>;
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
    role: z.ZodEnum<["village_leader", "dasso", "cell_executive", "sector_executive", "district_officer", "district_immigration", "dgie_province", "dgie_national"]>;
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
    role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
    state: "delivered" | "waiting" | "seen";
    roleLabel: string;
    step: number;
    deliveredAt: string | null;
    seenAt: string | null;
    seenBy: string | null;
    flag: {
        note: string;
        at: string;
        by: string | null;
    } | null;
}, {
    role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
    state: "delivered" | "waiting" | "seen";
    roleLabel: string;
    step: number;
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
        kind: z.ZodEnum<["tenant", "landlord"]>;
        name: z.ZodString;
        phone: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        kind: "landlord" | "tenant";
        phone: string | null;
    }, {
        name: string;
        kind: "landlord" | "tenant";
        phone: string | null;
    }>;
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
        role: z.ZodEnum<["village_leader", "dasso", "cell_executive", "sector_executive", "district_officer", "district_immigration", "dgie_province", "dgie_national"]>;
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
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
        state: "delivered" | "waiting" | "seen";
        roleLabel: string;
        step: number;
        deliveredAt: string | null;
        seenAt: string | null;
        seenBy: string | null;
        flag: {
            note: string;
            at: string;
            by: string | null;
        } | null;
    }, {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
        state: "delivered" | "waiting" | "seen";
        roleLabel: string;
        step: number;
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
    host: {
        name: string;
        kind: "landlord" | "tenant";
        phone: string | null;
    };
    fullName: string;
    id: string;
    createdAt: string;
    phone: string;
    nights: number;
    idNumber: string | null;
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
    nationality: string;
    nationalityName: string;
    fromAbroad: boolean;
    relationshipLabel: string;
    originWords: string;
    chain: {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
        state: "delivered" | "waiting" | "seen";
        roleLabel: string;
        step: number;
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
    seenByMe: boolean;
    changedAt: string | null;
}, {
    host: {
        name: string;
        kind: "landlord" | "tenant";
        phone: string | null;
    };
    fullName: string;
    id: string;
    createdAt: string;
    phone: string;
    nights: number;
    idNumber: string | null;
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
    nationality: string;
    nationalityName: string;
    fromAbroad: boolean;
    relationshipLabel: string;
    originWords: string;
    chain: {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
        state: "delivered" | "waiting" | "seen";
        roleLabel: string;
        step: number;
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
    seenByMe: boolean;
    changedAt: string | null;
}>;
export type LeaderGuest = z.infer<typeof LeaderGuest>;
/** One post a leader holds, in words. */
export declare const LeaderScope: z.ZodObject<{
    assignmentId: z.ZodString;
    role: z.ZodEnum<["village_leader", "dasso", "cell_executive", "sector_executive", "district_officer", "district_immigration", "dgie_province", "dgie_national"]>;
    roleLabel: z.ZodString;
    level: z.ZodEnum<["village", "cell", "sector", "district", "province", "country"]>;
    area: z.ZodString;
}, "strip", z.ZodTypeAny, {
    role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
    level: "country" | "province" | "district" | "sector" | "cell" | "village";
    area: string;
    assignmentId: string;
    roleLabel: string;
}, {
    role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
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
        sectorId: number;
        id: number;
    }, {
        name: string;
        sectorId: number;
        id: number;
    }>, "many">;
    villages: z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        name: z.ZodString;
        cellId: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        cellId: number;
        id: number;
    }, {
        name: string;
        cellId: number;
        id: number;
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
}, "strip", z.ZodTypeAny, {
    sectors: {
        name: string;
        id: number;
    }[];
    cells: {
        name: string;
        sectorId: number;
        id: number;
    }[];
    villages: {
        name: string;
        cellId: number;
        id: number;
    }[];
    nationalities: {
        code: string;
        name: string;
        count: number;
    }[];
}, {
    sectors: {
        name: string;
        id: number;
    }[];
    cells: {
        name: string;
        sectorId: number;
        id: number;
    }[];
    villages: {
        name: string;
        cellId: number;
        id: number;
    }[];
    nationalities?: {
        code: string;
        name: string;
        count: number;
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
    scopes: z.ZodArray<z.ZodObject<{
        assignmentId: z.ZodString;
        role: z.ZodEnum<["village_leader", "dasso", "cell_executive", "sector_executive", "district_officer", "district_immigration", "dgie_province", "dgie_national"]>;
        roleLabel: z.ZodString;
        level: z.ZodEnum<["village", "cell", "sector", "district", "province", "country"]>;
        area: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        assignmentId: string;
        roleLabel: string;
    }, {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
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
            sectorId: number;
            id: number;
        }, {
            name: string;
            sectorId: number;
            id: number;
        }>, "many">;
        villages: z.ZodArray<z.ZodObject<{
            id: z.ZodNumber;
            name: z.ZodString;
            cellId: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            name: string;
            cellId: number;
            id: number;
        }, {
            name: string;
            cellId: number;
            id: number;
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
    }, "strip", z.ZodTypeAny, {
        sectors: {
            name: string;
            id: number;
        }[];
        cells: {
            name: string;
            sectorId: number;
            id: number;
        }[];
        villages: {
            name: string;
            cellId: number;
            id: number;
        }[];
        nationalities: {
            code: string;
            name: string;
            count: number;
        }[];
    }, {
        sectors: {
            name: string;
            id: number;
        }[];
        cells: {
            name: string;
            sectorId: number;
            id: number;
        }[];
        villages: {
            name: string;
            cellId: number;
            id: number;
        }[];
        nationalities?: {
            code: string;
            name: string;
            count: number;
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
    scopes: {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        assignmentId: string;
        roleLabel: string;
    }[];
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
    leader: {
        name: string | null;
        email: string;
    };
    filters: {
        sectors: {
            name: string;
            id: number;
        }[];
        cells: {
            name: string;
            sectorId: number;
            id: number;
        }[];
        villages: {
            name: string;
            cellId: number;
            id: number;
        }[];
        nationalities: {
            code: string;
            name: string;
            count: number;
        }[];
    };
}, {
    scopes: {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        assignmentId: string;
        roleLabel: string;
    }[];
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
    filters: {
        sectors: {
            name: string;
            id: number;
        }[];
        cells: {
            name: string;
            sectorId: number;
            id: number;
        }[];
        villages: {
            name: string;
            cellId: number;
            id: number;
        }[];
        nationalities?: {
            code: string;
            name: string;
            count: number;
        }[] | undefined;
    };
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
    scopes: z.ZodArray<z.ZodObject<{
        assignmentId: z.ZodString;
        role: z.ZodEnum<["village_leader", "dasso", "cell_executive", "sector_executive", "district_officer", "district_immigration", "dgie_province", "dgie_national"]>;
        roleLabel: z.ZodString;
        level: z.ZodEnum<["village", "cell", "sector", "district", "province", "country"]>;
        area: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        assignmentId: string;
        roleLabel: string;
    }, {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
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
            sectorId: number;
            id: number;
        }, {
            name: string;
            sectorId: number;
            id: number;
        }>, "many">;
        villages: z.ZodArray<z.ZodObject<{
            id: z.ZodNumber;
            name: z.ZodString;
            cellId: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            name: string;
            cellId: number;
            id: number;
        }, {
            name: string;
            cellId: number;
            id: number;
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
    }, "strip", z.ZodTypeAny, {
        sectors: {
            name: string;
            id: number;
        }[];
        cells: {
            name: string;
            sectorId: number;
            id: number;
        }[];
        villages: {
            name: string;
            cellId: number;
            id: number;
        }[];
        nationalities: {
            code: string;
            name: string;
            count: number;
        }[];
    }, {
        sectors: {
            name: string;
            id: number;
        }[];
        cells: {
            name: string;
            sectorId: number;
            id: number;
        }[];
        villages: {
            name: string;
            cellId: number;
            id: number;
        }[];
        nationalities?: {
            code: string;
            name: string;
            count: number;
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
    tab: z.ZodEnum<["arriving", "staying", "left", "flagged"]>;
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
            kind: z.ZodEnum<["tenant", "landlord"]>;
            name: z.ZodString;
            phone: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            kind: "landlord" | "tenant";
            phone: string | null;
        }, {
            name: string;
            kind: "landlord" | "tenant";
            phone: string | null;
        }>;
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
            role: z.ZodEnum<["village_leader", "dasso", "cell_executive", "sector_executive", "district_officer", "district_immigration", "dgie_province", "dgie_national"]>;
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
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
            state: "delivered" | "waiting" | "seen";
            roleLabel: string;
            step: number;
            deliveredAt: string | null;
            seenAt: string | null;
            seenBy: string | null;
            flag: {
                note: string;
                at: string;
                by: string | null;
            } | null;
        }, {
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
            state: "delivered" | "waiting" | "seen";
            roleLabel: string;
            step: number;
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
        host: {
            name: string;
            kind: "landlord" | "tenant";
            phone: string | null;
        };
        fullName: string;
        id: string;
        createdAt: string;
        phone: string;
        nights: number;
        idNumber: string | null;
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
        nationality: string;
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        chain: {
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
            state: "delivered" | "waiting" | "seen";
            roleLabel: string;
            step: number;
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
        seenByMe: boolean;
        changedAt: string | null;
    }, {
        host: {
            name: string;
            kind: "landlord" | "tenant";
            phone: string | null;
        };
        fullName: string;
        id: string;
        createdAt: string;
        phone: string;
        nights: number;
        idNumber: string | null;
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
        nationality: string;
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        chain: {
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
            state: "delivered" | "waiting" | "seen";
            roleLabel: string;
            step: number;
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
        seenByMe: boolean;
        changedAt: string | null;
    }>, "many">;
    page: z.ZodNumber;
    pageSize: z.ZodNumber;
    total: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    total: number;
    page: number;
    pageSize: number;
    guests: {
        host: {
            name: string;
            kind: "landlord" | "tenant";
            phone: string | null;
        };
        fullName: string;
        id: string;
        createdAt: string;
        phone: string;
        nights: number;
        idNumber: string | null;
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
        nationality: string;
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        chain: {
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
            state: "delivered" | "waiting" | "seen";
            roleLabel: string;
            step: number;
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
        seenByMe: boolean;
        changedAt: string | null;
    }[];
    scopes: {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        assignmentId: string;
        roleLabel: string;
    }[];
    tab: "arriving" | "staying" | "left" | "flagged";
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
    when: "soon" | "later";
    leader: {
        name: string | null;
        email: string;
    };
    filters: {
        sectors: {
            name: string;
            id: number;
        }[];
        cells: {
            name: string;
            sectorId: number;
            id: number;
        }[];
        villages: {
            name: string;
            cellId: number;
            id: number;
        }[];
        nationalities: {
            code: string;
            name: string;
            count: number;
        }[];
    };
}, {
    total: number;
    page: number;
    pageSize: number;
    guests: {
        host: {
            name: string;
            kind: "landlord" | "tenant";
            phone: string | null;
        };
        fullName: string;
        id: string;
        createdAt: string;
        phone: string;
        nights: number;
        idNumber: string | null;
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
        nationality: string;
        nationalityName: string;
        fromAbroad: boolean;
        relationshipLabel: string;
        originWords: string;
        chain: {
            role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
            state: "delivered" | "waiting" | "seen";
            roleLabel: string;
            step: number;
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
        seenByMe: boolean;
        changedAt: string | null;
    }[];
    scopes: {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        assignmentId: string;
        roleLabel: string;
    }[];
    tab: "arriving" | "staying" | "left" | "flagged";
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
    when: "soon" | "later";
    leader: {
        name: string | null;
        email: string;
    };
    filters: {
        sectors: {
            name: string;
            id: number;
        }[];
        cells: {
            name: string;
            sectorId: number;
            id: number;
        }[];
        villages: {
            name: string;
            cellId: number;
            id: number;
        }[];
        nationalities?: {
            code: string;
            name: string;
            count: number;
        }[] | undefined;
    };
}>;
export type LeaderGuestPage = z.infer<typeof LeaderGuestPage>;
/** The longest period one report covers. */
export declare const GUEST_REPORT_MAX_DAYS = 731;
export declare const GuestReportQuery: z.ZodEffects<z.ZodObject<{
    from: z.ZodEffects<z.ZodString, string, string>;
    to: z.ZodEffects<z.ZodString, string, string>;
    sectorId: z.ZodOptional<z.ZodNumber>;
    cellId: z.ZodOptional<z.ZodNumber>;
    villageId: z.ZodOptional<z.ZodNumber>;
    /** By nationality: Rwandan guests, or guests of any other nationality. */
    origin: z.ZodOptional<z.ZodEnum<["nationals", "international"]>>;
    /** One nationality (ISO 3166-1 alpha-2). */
    nationality: z.ZodOptional<z.ZodString>;
    /** One relationship code (`guest_relationships`). */
    relationship: z.ZodOptional<z.ZodString>;
    /** Only guests a leader flagged. */
    flagged: z.ZodOptional<z.ZodEnum<["only"]>>;
}, "strip", z.ZodTypeAny, {
    from: string;
    to: string;
    sectorId?: number | undefined;
    cellId?: number | undefined;
    villageId?: number | undefined;
    origin?: "nationals" | "international" | undefined;
    nationality?: string | undefined;
    relationship?: string | undefined;
    flagged?: "only" | undefined;
}, {
    from: string;
    to: string;
    sectorId?: number | undefined;
    cellId?: number | undefined;
    villageId?: number | undefined;
    origin?: "nationals" | "international" | undefined;
    nationality?: string | undefined;
    relationship?: string | undefined;
    flagged?: "only" | undefined;
}>, {
    from: string;
    to: string;
    sectorId?: number | undefined;
    cellId?: number | undefined;
    villageId?: number | undefined;
    origin?: "nationals" | "international" | undefined;
    nationality?: string | undefined;
    relationship?: string | undefined;
    flagged?: "only" | undefined;
}, {
    from: string;
    to: string;
    sectorId?: number | undefined;
    cellId?: number | undefined;
    villageId?: number | undefined;
    origin?: "nationals" | "international" | undefined;
    nationality?: string | undefined;
    relationship?: string | undefined;
    flagged?: "only" | undefined;
}>;
export type GuestReportQuery = z.infer<typeof GuestReportQuery>;
export declare const ReportBucket: z.ZodEnum<["day", "week", "month"]>;
export type ReportBucket = z.infer<typeof ReportBucket>;
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
        role: z.ZodEnum<["village_leader", "dasso", "cell_executive", "sector_executive", "district_officer", "district_immigration", "dgie_province", "dgie_national"]>;
        roleLabel: z.ZodString;
        level: z.ZodEnum<["village", "cell", "sector", "district", "province", "country"]>;
        area: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        assignmentId: string;
        roleLabel: string;
    }, {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
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
            label: string;
            count: number;
        }, {
            code: string;
            label: string;
            count: number;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        nationalities: {
            code: string;
            name: string;
            count: number;
        }[];
        relationships: {
            code: string;
            label: string;
            count: number;
        }[];
    }, {
        nationalities: {
            code: string;
            name: string;
            count: number;
        }[];
        relationships: {
            code: string;
            label: string;
            count: number;
        }[];
    }>>;
    totals: z.ZodObject<{
        /** Guests whose arrival falls in the period. */
        registered: z.ZodNumber;
        /** Guests staying today, whatever the period. */
        stayingNow: z.ZodNumber;
        fromAbroad: z.ZodNumber;
        flagged: z.ZodNumber;
        /** Mean nights per stay, one decimal; null with no guests. */
        averageNights: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        fromAbroad: number;
        flagged: number;
        registered: number;
        stayingNow: number;
        averageNights: number | null;
    }, {
        fromAbroad: number;
        flagged: number;
        registered: number;
        stayingNow: number;
        averageNights: number | null;
    }>;
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
        label: string;
        count: number;
    }, {
        code: string;
        label: string;
        count: number;
    }>, "many">;
    arrivals: z.ZodObject<{
        bucket: z.ZodEnum<["day", "week", "month"]>;
        points: z.ZodArray<z.ZodObject<{
            start: z.ZodString;
            label: z.ZodString;
            count: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            label: string;
            count: number;
            start: string;
        }, {
            label: string;
            count: number;
            start: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        points: {
            label: string;
            count: number;
            start: string;
        }[];
        bucket: "month" | "day" | "week";
    }, {
        points: {
            label: string;
            count: number;
            start: string;
        }[];
        bucket: "month" | "day" | "week";
    }>;
    /**
     * How the period's guests went along the chain, one row per leader post in its order: how many it
     * received, how many reached a leader (delivered), were opened and flagged, and how many still wait
     * because nobody holds that post yet.
     */
    chain: z.ZodDefault<z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["village_leader", "dasso", "cell_executive", "sector_executive", "district_officer", "district_immigration", "dgie_province", "dgie_national"]>;
        label: z.ZodString;
        step: z.ZodNumber;
        guests: z.ZodNumber;
        delivered: z.ZodNumber;
        opened: z.ZodNumber;
        flagged: z.ZodNumber;
        waiting: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
        label: string;
        guests: number;
        delivered: number;
        waiting: number;
        step: number;
        flagged: number;
        opened: number;
    }, {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
        label: string;
        guests: number;
        delivered: number;
        waiting: number;
        step: number;
        flagged: number;
        opened: number;
    }>, "many">>;
    /** Homes with the most guests, by address: never a person's name. */
    topHomes: z.ZodArray<z.ZodObject<{
        address: z.ZodString;
        unitLabel: z.ZodNullable<z.ZodString>;
        guests: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        address: string;
        guests: number;
        unitLabel: string | null;
    }, {
        address: string;
        guests: number;
        unitLabel: string | null;
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
        registered: number;
        before: string;
    }, {
        fromAbroad: number;
        flagged: number;
        registered: number;
        before: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    totals: {
        fromAbroad: number;
        flagged: number;
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
            label: string;
            count: number;
        }[];
    };
    scopes: {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        assignmentId: string;
        roleLabel: string;
    }[];
    generatedAt: string;
    chain: {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
        label: string;
        guests: number;
        delivered: number;
        waiting: number;
        step: number;
        flagged: number;
        opened: number;
    }[];
    leader: {
        name: string | null;
        email: string;
    };
    period: {
        from: string;
        to: string;
    };
    narrowedTo: string | null;
    filteredBy: string[];
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
        label: string;
        count: number;
    }[];
    arrivals: {
        points: {
            label: string;
            count: number;
            start: string;
        }[];
        bucket: "month" | "day" | "week";
    };
    topHomes: {
        address: string;
        guests: number;
        unitLabel: string | null;
    }[];
    purged: {
        fromAbroad: number;
        flagged: number;
        registered: number;
        before: string;
    } | null;
}, {
    totals: {
        fromAbroad: number;
        flagged: number;
        registered: number;
        stayingNow: number;
        averageNights: number | null;
    };
    scopes: {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
        level: "country" | "province" | "district" | "sector" | "cell" | "village";
        area: string;
        assignmentId: string;
        roleLabel: string;
    }[];
    generatedAt: string;
    leader: {
        name: string | null;
        email: string;
    };
    period: {
        from: string;
        to: string;
    };
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
        label: string;
        count: number;
    }[];
    arrivals: {
        points: {
            label: string;
            count: number;
            start: string;
        }[];
        bucket: "month" | "day" | "week";
    };
    topHomes: {
        address: string;
        guests: number;
        unitLabel: string | null;
    }[];
    purged: {
        fromAbroad: number;
        flagged: number;
        registered: number;
        before: string;
    } | null;
    choices?: {
        nationalities: {
            code: string;
            name: string;
            count: number;
        }[];
        relationships: {
            code: string;
            label: string;
            count: number;
        }[];
    } | undefined;
    chain?: {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
        label: string;
        guests: number;
        delivered: number;
        waiting: number;
        step: number;
        flagged: number;
        opened: number;
    }[] | undefined;
    filteredBy?: string[] | undefined;
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
    role: z.ZodEnum<["tax_compliance_officer", "business_field_verifier", "business_approver", "psf_membership_officer", "village_leader", "dasso", "cell_executive", "district_officer", "district_immigration", "sector_executive", "dgie_province", "dgie_national"]>;
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
    provinceId: number | null;
    districtId: number | null;
    sectorId: number | null;
    cellId: number | null;
    villageId: number | null;
    kind: "leader" | "reviewer" | "officer";
    email: string;
    role: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
    id: string;
    title: string | null;
    userId: string;
    scopeLevel: "country" | "province" | "district" | "sector" | "cell" | "village";
    delivered: number;
    area: string;
    bodyCode: string;
    bodyName: string | null;
    seen: number;
    roleLabel: string;
    grantedAt: string;
    grantedBy: string | null;
}, {
    name: string | null;
    provinceId: number | null;
    districtId: number | null;
    sectorId: number | null;
    cellId: number | null;
    villageId: number | null;
    kind: "leader" | "reviewer" | "officer";
    email: string;
    role: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
    id: string;
    title: string | null;
    userId: string;
    scopeLevel: "country" | "province" | "district" | "sector" | "cell" | "village";
    delivered: number;
    area: string;
    bodyCode: string;
    bodyName: string | null;
    seen: number;
    roleLabel: string;
    grantedAt: string;
    grantedBy: string | null;
}>;
export type OversightAppointment = z.infer<typeof OversightAppointment>;
export declare const OversightAppointmentQuery: z.ZodObject<{
    role: z.ZodOptional<z.ZodEnum<["tax_compliance_officer", "business_field_verifier", "business_approver", "psf_membership_officer", "village_leader", "dasso", "cell_executive", "district_officer", "district_immigration", "sector_executive", "dgie_province", "dgie_national"]>>;
    kind: z.ZodOptional<z.ZodEnum<["leader", "reviewer", "officer"]>>;
    provinceId: z.ZodOptional<z.ZodNumber>;
    districtId: z.ZodOptional<z.ZodNumber>;
    sectorId: z.ZodOptional<z.ZodNumber>;
    cellId: z.ZodOptional<z.ZodNumber>;
    villageId: z.ZodOptional<z.ZodNumber>;
    q: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    provinceId?: number | undefined;
    districtId?: number | undefined;
    sectorId?: number | undefined;
    cellId?: number | undefined;
    villageId?: number | undefined;
    kind?: "leader" | "reviewer" | "officer" | undefined;
    role?: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | undefined;
    q?: string | undefined;
}, {
    provinceId?: number | undefined;
    districtId?: number | undefined;
    sectorId?: number | undefined;
    cellId?: number | undefined;
    villageId?: number | undefined;
    kind?: "leader" | "reviewer" | "officer" | undefined;
    role?: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national" | undefined;
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
    role: z.ZodEnum<["village_leader", "dasso", "cell_executive", "sector_executive", "district_officer", "district_immigration", "dgie_province", "dgie_national"]>;
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
    role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
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
    role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
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
        role: z.ZodEnum<["tax_compliance_officer", "business_field_verifier", "business_approver", "psf_membership_officer", "village_leader", "dasso", "cell_executive", "district_officer", "district_immigration", "sector_executive", "dgie_province", "dgie_national"]>;
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
        provinceId: number | null;
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        kind: "leader" | "reviewer" | "officer";
        email: string;
        role: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
        id: string;
        title: string | null;
        userId: string;
        scopeLevel: "country" | "province" | "district" | "sector" | "cell" | "village";
        delivered: number;
        area: string;
        bodyCode: string;
        bodyName: string | null;
        seen: number;
        roleLabel: string;
        grantedAt: string;
        grantedBy: string | null;
    }, {
        name: string | null;
        provinceId: number | null;
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        kind: "leader" | "reviewer" | "officer";
        email: string;
        role: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
        id: string;
        title: string | null;
        userId: string;
        scopeLevel: "country" | "province" | "district" | "sector" | "cell" | "village";
        delivered: number;
        area: string;
        bodyCode: string;
        bodyName: string | null;
        seen: number;
        roleLabel: string;
        grantedAt: string;
        grantedBy: string | null;
    }>, "many">;
    counts: z.ZodObject<{
        leader: z.ZodNumber;
        reviewer: z.ZodNumber;
        officer: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        leader: number;
        reviewer: number;
        officer: number;
    }, {
        leader: number;
        reviewer: number;
        officer: number;
    }>;
    waiting: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["village_leader", "dasso", "cell_executive", "sector_executive", "district_officer", "district_immigration", "dgie_province", "dgie_national"]>;
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
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
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
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
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
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
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
        leader: number;
        reviewer: number;
        officer: number;
    };
    appointments: {
        name: string | null;
        provinceId: number | null;
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        kind: "leader" | "reviewer" | "officer";
        email: string;
        role: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
        id: string;
        title: string | null;
        userId: string;
        scopeLevel: "country" | "province" | "district" | "sector" | "cell" | "village";
        delivered: number;
        area: string;
        bodyCode: string;
        bodyName: string | null;
        seen: number;
        roleLabel: string;
        grantedAt: string;
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
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
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
        leader: number;
        reviewer: number;
        officer: number;
    };
    appointments: {
        name: string | null;
        provinceId: number | null;
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        kind: "leader" | "reviewer" | "officer";
        email: string;
        role: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
        id: string;
        title: string | null;
        userId: string;
        scopeLevel: "country" | "province" | "district" | "sector" | "cell" | "village";
        delivered: number;
        area: string;
        bodyCode: string;
        bodyName: string | null;
        seen: number;
        roleLabel: string;
        grantedAt: string;
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
    role: z.ZodEnum<["tax_compliance_officer", "business_field_verifier", "business_approver", "psf_membership_officer", "village_leader", "dasso", "cell_executive", "district_officer", "district_immigration", "sector_executive", "dgie_province", "dgie_national"]>;
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
    role: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
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
    role: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
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
    role: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
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
    role: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer" | "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
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
        role: z.ZodEnum<["village_leader", "dasso", "cell_executive", "sector_executive", "district_officer", "district_immigration", "dgie_province", "dgie_national"]>;
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
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
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
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
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
        role: z.ZodEnum<["village_leader", "dasso", "cell_executive", "sector_executive", "district_officer", "district_immigration", "dgie_province", "dgie_national"]>;
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
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
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
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
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
        role: z.ZodEnum<["village_leader", "dasso", "cell_executive", "sector_executive", "district_officer", "district_immigration", "dgie_province", "dgie_national"]>;
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
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
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
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
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
        role: z.ZodEnum<["village_leader", "dasso", "cell_executive", "sector_executive", "district_officer", "district_immigration", "dgie_province", "dgie_national"]>;
        roleLabel: z.ZodString;
        area: z.ZodString;
        delivered: z.ZodNumber;
        firstDeliveredAt: z.ZodString;
        grantedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string | null;
        email: string;
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
        delivered: number;
        area: string;
        assignmentId: string;
        roleLabel: string;
        grantedAt: string;
        firstDeliveredAt: string;
    }, {
        name: string | null;
        email: string;
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
        delivered: number;
        area: string;
        assignmentId: string;
        roleLabel: string;
        grantedAt: string;
        firstDeliveredAt: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    uncovered: {
        provinceId: number | null;
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
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
    roles: {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
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
    generatedAt: string;
    waiting: {
        provinceId: number | null;
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
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
    neverOpened: {
        name: string | null;
        email: string;
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
        delivered: number;
        area: string;
        assignmentId: string;
        roleLabel: string;
        grantedAt: string;
        firstDeliveredAt: string;
    }[];
}, {
    uncovered: {
        provinceId: number | null;
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
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
    roles: {
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
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
    generatedAt: string;
    waiting: {
        provinceId: number | null;
        districtId: number | null;
        sectorId: number | null;
        cellId: number | null;
        villageId: number | null;
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
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
    neverOpened: {
        name: string | null;
        email: string;
        role: "village_leader" | "dasso" | "cell_executive" | "district_officer" | "district_immigration" | "sector_executive" | "dgie_province" | "dgie_national";
        delivered: number;
        area: string;
        assignmentId: string;
        roleLabel: string;
        grantedAt: string;
        firstDeliveredAt: string;
    }[];
}>;
export type LeaderCoverage = z.infer<typeof LeaderCoverage>;
//# sourceMappingURL=guests.d.ts.map