import { z } from "zod";
/** `HH:MM` or `HH:MM:SS`, as a bare `time` column stores it. */
export declare const ClockTime: z.ZodString;
export type ClockTime = z.infer<typeof ClockTime>;
/** Open around the clock, for set hours, or no desk at all (Expedia's front desk attribute). */
export declare const FrontDesk: z.ZodEnum<["24h", "limited", "none"]>;
export type FrontDesk = z.infer<typeof FrontDesk>;
export declare const FRONT_DESK_LABEL: Readonly<Record<FrontDesk, string>>;
/** Rwanda's four official languages (Organic Law 02/2017 added Swahili). */
export declare const StaffLanguage: z.ZodEnum<["rw", "en", "fr", "sw"]>;
export type StaffLanguage = z.infer<typeof StaffLanguage>;
export declare const STAFF_LANGUAGE_LABEL: Readonly<Record<StaffLanguage, string>>;
export declare const ChildrenPolicy: z.ZodEnum<["welcome", "adults_only"]>;
export type ChildrenPolicy = z.infer<typeof ChildrenPolicy>;
export declare const CHILDREN_POLICY_LABEL: Readonly<Record<ChildrenPolicy, string>>;
/** Yes, on request, no: Booking.com's three answers, no by default. */
export declare const PetsPolicy: z.ZodEnum<["no", "on_request", "yes"]>;
export type PetsPolicy = z.infer<typeof PetsPolicy>;
export declare const PETS_POLICY_LABEL: Readonly<Record<PetsPolicy, string>>;
export declare const SmokingPolicy: z.ZodEnum<["no", "designated", "allowed"]>;
export type SmokingPolicy = z.infer<typeof SmokingPolicy>;
export declare const SMOKING_POLICY_LABEL: Readonly<Record<SmokingPolicy, string>>;
export declare const PartiesPolicy: z.ZodEnum<["no", "on_request"]>;
export type PartiesPolicy = z.infer<typeof PartiesPolicy>;
export declare const PARTIES_POLICY_LABEL: Readonly<Record<PartiesPolicy, string>>;
export declare const InternetAccess: z.ZodEnum<["free_everywhere", "rooms_only", "public_only", "paid", "none"]>;
export type InternetAccess = z.infer<typeof InternetAccess>;
export declare const INTERNET_LABEL: Readonly<Record<InternetAccess, string>>;
/** 0118: a crib for a baby is free, charged by the night, or not offered. */
export declare const CribPolicy: z.ZodEnum<["free", "charged", "none"]>;
export type CribPolicy = z.infer<typeof CribPolicy>;
export declare const CRIB_POLICY_LABEL: Readonly<Record<CribPolicy, string>>;
export declare const ParkingOption: z.ZodEnum<["free_on_site", "paid_on_site", "street", "none"]>;
export type ParkingOption = z.infer<typeof ParkingOption>;
export declare const PARKING_LABEL: Readonly<Record<ParkingOption, string>>;
/**
 * The policy fields a property edit may send, each `null` to clear. Shared by
 * the edit request and the owner's read, so the two say the same thing.
 */
export declare const propertyPolicyFields: {
    checkInUntil: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    frontDesk: z.ZodOptional<z.ZodNullable<z.ZodEnum<["24h", "limited", "none"]>>>;
    frontDeskOpens: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    frontDeskCloses: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    languages: z.ZodOptional<z.ZodArray<z.ZodEnum<["rw", "en", "fr", "sw"]>, "many">>;
    whatsapp: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    directions: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    minCheckInAge: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    childrenPolicy: z.ZodOptional<z.ZodNullable<z.ZodEnum<["welcome", "adults_only"]>>>;
    petsPolicy: z.ZodOptional<z.ZodNullable<z.ZodEnum<["no", "on_request", "yes"]>>>;
    smokingPolicy: z.ZodOptional<z.ZodNullable<z.ZodEnum<["no", "designated", "allowed"]>>>;
    partiesPolicy: z.ZodOptional<z.ZodNullable<z.ZodEnum<["no", "on_request"]>>>;
    quietFrom: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    quietUntil: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    internet: z.ZodOptional<z.ZodNullable<z.ZodEnum<["free_everywhere", "rooms_only", "public_only", "paid", "none"]>>>;
    parking: z.ZodOptional<z.ZodNullable<z.ZodEnum<["free_on_site", "paid_on_site", "street", "none"]>>>;
    /** 0118. A charged crib names its price a night; a free one or none names none. */
    cribs: z.ZodOptional<z.ZodNullable<z.ZodEnum<["free", "charged", "none"]>>>;
    cribPriceRwf: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
};
/** The policy fields on their own, for a screen that checks an edit before sending it. */
export declare const PropertyPolicyEdit: z.ZodObject<{
    checkInUntil: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    frontDesk: z.ZodOptional<z.ZodNullable<z.ZodEnum<["24h", "limited", "none"]>>>;
    frontDeskOpens: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    frontDeskCloses: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    languages: z.ZodOptional<z.ZodArray<z.ZodEnum<["rw", "en", "fr", "sw"]>, "many">>;
    whatsapp: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    directions: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    minCheckInAge: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    childrenPolicy: z.ZodOptional<z.ZodNullable<z.ZodEnum<["welcome", "adults_only"]>>>;
    petsPolicy: z.ZodOptional<z.ZodNullable<z.ZodEnum<["no", "on_request", "yes"]>>>;
    smokingPolicy: z.ZodOptional<z.ZodNullable<z.ZodEnum<["no", "designated", "allowed"]>>>;
    partiesPolicy: z.ZodOptional<z.ZodNullable<z.ZodEnum<["no", "on_request"]>>>;
    quietFrom: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    quietUntil: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    internet: z.ZodOptional<z.ZodNullable<z.ZodEnum<["free_everywhere", "rooms_only", "public_only", "paid", "none"]>>>;
    parking: z.ZodOptional<z.ZodNullable<z.ZodEnum<["free_on_site", "paid_on_site", "street", "none"]>>>;
    /** 0118. A charged crib names its price a night; a free one or none names none. */
    cribs: z.ZodOptional<z.ZodNullable<z.ZodEnum<["free", "charged", "none"]>>>;
    cribPriceRwf: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    checkInUntil?: string | null | undefined;
    frontDesk?: "limited" | "none" | "24h" | null | undefined;
    frontDeskOpens?: string | null | undefined;
    frontDeskCloses?: string | null | undefined;
    languages?: ("en" | "rw" | "fr" | "sw")[] | undefined;
    whatsapp?: string | null | undefined;
    directions?: string | null | undefined;
    minCheckInAge?: number | null | undefined;
    childrenPolicy?: "welcome" | "adults_only" | null | undefined;
    petsPolicy?: "no" | "on_request" | "yes" | null | undefined;
    smokingPolicy?: "no" | "designated" | "allowed" | null | undefined;
    partiesPolicy?: "no" | "on_request" | null | undefined;
    quietFrom?: string | null | undefined;
    quietUntil?: string | null | undefined;
    internet?: "none" | "paid" | "free_everywhere" | "rooms_only" | "public_only" | null | undefined;
    parking?: "street" | "none" | "free_on_site" | "paid_on_site" | null | undefined;
    cribs?: "none" | "free" | "charged" | null | undefined;
    cribPriceRwf?: number | null | undefined;
}, {
    checkInUntil?: string | null | undefined;
    frontDesk?: "limited" | "none" | "24h" | null | undefined;
    frontDeskOpens?: string | null | undefined;
    frontDeskCloses?: string | null | undefined;
    languages?: ("en" | "rw" | "fr" | "sw")[] | undefined;
    whatsapp?: string | null | undefined;
    directions?: string | null | undefined;
    minCheckInAge?: number | null | undefined;
    childrenPolicy?: "welcome" | "adults_only" | null | undefined;
    petsPolicy?: "no" | "on_request" | "yes" | null | undefined;
    smokingPolicy?: "no" | "designated" | "allowed" | null | undefined;
    partiesPolicy?: "no" | "on_request" | null | undefined;
    quietFrom?: string | null | undefined;
    quietUntil?: string | null | undefined;
    internet?: "none" | "paid" | "free_everywhere" | "rooms_only" | "public_only" | null | undefined;
    parking?: "street" | "none" | "free_on_site" | "paid_on_site" | null | undefined;
    cribs?: "none" | "free" | "charged" | null | undefined;
    cribPriceRwf?: number | null | undefined;
}>;
export type PropertyPolicyEdit = z.infer<typeof PropertyPolicyEdit>;
/** What a stay has told its guests, as the owner and the guest page read it. Null is "not said yet". */
export declare const PropertyPolicies: z.ZodObject<{
    checkInUntil: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    frontDesk: z.ZodDefault<z.ZodNullable<z.ZodEnum<["24h", "limited", "none"]>>>;
    frontDeskOpens: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    frontDeskCloses: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    languages: z.ZodDefault<z.ZodArray<z.ZodEnum<["rw", "en", "fr", "sw"]>, "many">>;
    whatsapp: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    directions: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    minCheckInAge: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    childrenPolicy: z.ZodDefault<z.ZodNullable<z.ZodEnum<["welcome", "adults_only"]>>>;
    petsPolicy: z.ZodDefault<z.ZodNullable<z.ZodEnum<["no", "on_request", "yes"]>>>;
    smokingPolicy: z.ZodDefault<z.ZodNullable<z.ZodEnum<["no", "designated", "allowed"]>>>;
    partiesPolicy: z.ZodDefault<z.ZodNullable<z.ZodEnum<["no", "on_request"]>>>;
    quietFrom: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    quietUntil: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    internet: z.ZodDefault<z.ZodNullable<z.ZodEnum<["free_everywhere", "rooms_only", "public_only", "paid", "none"]>>>;
    parking: z.ZodDefault<z.ZodNullable<z.ZodEnum<["free_on_site", "paid_on_site", "street", "none"]>>>;
    cribs: z.ZodDefault<z.ZodNullable<z.ZodEnum<["free", "charged", "none"]>>>;
    cribPriceRwf: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    checkInUntil: string | null;
    frontDesk: "limited" | "none" | "24h" | null;
    frontDeskOpens: string | null;
    frontDeskCloses: string | null;
    languages: ("en" | "rw" | "fr" | "sw")[];
    whatsapp: string | null;
    directions: string | null;
    minCheckInAge: number | null;
    childrenPolicy: "welcome" | "adults_only" | null;
    petsPolicy: "no" | "on_request" | "yes" | null;
    smokingPolicy: "no" | "designated" | "allowed" | null;
    partiesPolicy: "no" | "on_request" | null;
    quietFrom: string | null;
    quietUntil: string | null;
    internet: "none" | "paid" | "free_everywhere" | "rooms_only" | "public_only" | null;
    parking: "street" | "none" | "free_on_site" | "paid_on_site" | null;
    cribs: "none" | "free" | "charged" | null;
    cribPriceRwf: number | null;
}, {
    checkInUntil?: string | null | undefined;
    frontDesk?: "limited" | "none" | "24h" | null | undefined;
    frontDeskOpens?: string | null | undefined;
    frontDeskCloses?: string | null | undefined;
    languages?: ("en" | "rw" | "fr" | "sw")[] | undefined;
    whatsapp?: string | null | undefined;
    directions?: string | null | undefined;
    minCheckInAge?: number | null | undefined;
    childrenPolicy?: "welcome" | "adults_only" | null | undefined;
    petsPolicy?: "no" | "on_request" | "yes" | null | undefined;
    smokingPolicy?: "no" | "designated" | "allowed" | null | undefined;
    partiesPolicy?: "no" | "on_request" | null | undefined;
    quietFrom?: string | null | undefined;
    quietUntil?: string | null | undefined;
    internet?: "none" | "paid" | "free_everywhere" | "rooms_only" | "public_only" | null | undefined;
    parking?: "street" | "none" | "free_on_site" | "paid_on_site" | null | undefined;
    cribs?: "none" | "free" | "charged" | null | undefined;
    cribPriceRwf?: number | null | undefined;
}>;
export type PropertyPolicies = z.infer<typeof PropertyPolicies>;
/**
 * A stored row's policies as the contract reads them: times leave as `HH:MM`, and a value no list holds
 * (the CHECK constraints make that impossible) fails loudly rather than reaching a guest.
 */
export declare function policiesFromRow(row: {
    [K in keyof PropertyPolicies]: unknown;
}): PropertyPolicies;
/** A Double has one bed for two, a Twin two beds (Booking.com's room type codes). */
export declare const RoomCategory: z.ZodEnum<["single", "double", "twin", "triple", "family", "suite", "studio", "tent", "dorm_bed"]>;
export type RoomCategory = z.infer<typeof RoomCategory>;
export declare const ROOM_CATEGORY_LABEL: Readonly<Record<RoomCategory, string>>;
/** Bed types by width, as the platforms band them. */
export declare const BedType: z.ZodEnum<["single", "double", "queen", "king", "bunk", "sofa_bed"]>;
export type BedType = z.infer<typeof BedType>;
export declare const BED_TYPE_LABEL: Readonly<Record<BedType, string>>;
/** How many people a bed sleeps, which caps a room's adults: a bunk is two beds of one. */
export declare const BED_SLEEPS: Readonly<Record<BedType, number>>;
export declare const RoomBed: z.ZodObject<{
    type: z.ZodEnum<["single", "double", "queen", "king", "bunk", "sofa_bed"]>;
    count: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "single" | "double" | "queen" | "king" | "bunk" | "sofa_bed";
    count: number;
}, {
    type: "single" | "double" | "queen" | "king" | "bunk" | "sofa_bed";
    count: number;
}>;
export type RoomBed = z.infer<typeof RoomBed>;
/** The beds in one room, each type once. */
export declare const RoomBeds: z.ZodEffects<z.ZodArray<z.ZodObject<{
    type: z.ZodEnum<["single", "double", "queen", "king", "bunk", "sofa_bed"]>;
    count: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "single" | "double" | "queen" | "king" | "bunk" | "sofa_bed";
    count: number;
}, {
    type: "single" | "double" | "queen" | "king" | "bunk" | "sofa_bed";
    count: number;
}>, "many">, {
    type: "single" | "double" | "queen" | "king" | "bunk" | "sofa_bed";
    count: number;
}[], {
    type: "single" | "double" | "queen" | "king" | "bunk" | "sofa_bed";
    count: number;
}[]>;
export declare const Bathroom: z.ZodEnum<["private", "shared"]>;
export type Bathroom = z.infer<typeof Bathroom>;
/** How many the beds sleep, the ceiling for a room's adults. */
export declare function bedsSleep(beds: readonly RoomBed[]): number;
/** "1 king bed", "2 single beds and 1 sofa bed": the line a guest reads under a room. */
export declare function bedsLine(beds: readonly RoomBed[]): string;
/** The room facts a room type edit may send, each `null` to clear. */
export declare const roomTypeDetailFields: {
    roomCategory: z.ZodOptional<z.ZodNullable<z.ZodEnum<["single", "double", "twin", "triple", "family", "suite", "studio", "tent", "dorm_bed"]>>>;
    beds: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["single", "double", "queen", "king", "bunk", "sofa_bed"]>;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: "single" | "double" | "queen" | "king" | "bunk" | "sofa_bed";
        count: number;
    }, {
        type: "single" | "double" | "queen" | "king" | "bunk" | "sofa_bed";
        count: number;
    }>, "many">, {
        type: "single" | "double" | "queen" | "king" | "bunk" | "sofa_bed";
        count: number;
    }[], {
        type: "single" | "double" | "queen" | "king" | "bunk" | "sofa_bed";
        count: number;
    }[]>>>;
    maxAdults: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    maxChildren: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    sizeM2: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    bathroom: z.ZodOptional<z.ZodNullable<z.ZodEnum<["private", "shared"]>>>;
    /**
     * What one guest pays for a room priced per room (owner decision, 2026-10-29). Less than the room
     * price, or absent: one guest then pays the room price. Only a room priced per room has one.
     */
    singleGuestPriceRwf: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    /** 0118: how many extra beds the room takes, and what one costs a night, settled at the property. */
    extraBedsMax: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    extraBedPriceRwf: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
};
/** The room facts on their own, for a screen that checks an edit before sending it. */
export declare const RoomTypeDetailEdit: z.ZodObject<{
    roomCategory: z.ZodOptional<z.ZodNullable<z.ZodEnum<["single", "double", "twin", "triple", "family", "suite", "studio", "tent", "dorm_bed"]>>>;
    beds: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["single", "double", "queen", "king", "bunk", "sofa_bed"]>;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        type: "single" | "double" | "queen" | "king" | "bunk" | "sofa_bed";
        count: number;
    }, {
        type: "single" | "double" | "queen" | "king" | "bunk" | "sofa_bed";
        count: number;
    }>, "many">, {
        type: "single" | "double" | "queen" | "king" | "bunk" | "sofa_bed";
        count: number;
    }[], {
        type: "single" | "double" | "queen" | "king" | "bunk" | "sofa_bed";
        count: number;
    }[]>>>;
    maxAdults: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    maxChildren: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    sizeM2: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    bathroom: z.ZodOptional<z.ZodNullable<z.ZodEnum<["private", "shared"]>>>;
    /**
     * What one guest pays for a room priced per room (owner decision, 2026-10-29). Less than the room
     * price, or absent: one guest then pays the room price. Only a room priced per room has one.
     */
    singleGuestPriceRwf: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    /** 0118: how many extra beds the room takes, and what one costs a night, settled at the property. */
    extraBedsMax: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    extraBedPriceRwf: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    singleGuestPriceRwf?: number | null | undefined;
    roomCategory?: "family" | "single" | "double" | "twin" | "triple" | "suite" | "studio" | "tent" | "dorm_bed" | null | undefined;
    beds?: {
        type: "single" | "double" | "queen" | "king" | "bunk" | "sofa_bed";
        count: number;
    }[] | null | undefined;
    maxAdults?: number | null | undefined;
    maxChildren?: number | null | undefined;
    sizeM2?: number | null | undefined;
    bathroom?: "private" | "shared" | null | undefined;
    extraBedsMax?: number | null | undefined;
    extraBedPriceRwf?: number | null | undefined;
}, {
    singleGuestPriceRwf?: number | null | undefined;
    roomCategory?: "family" | "single" | "double" | "twin" | "triple" | "suite" | "studio" | "tent" | "dorm_bed" | null | undefined;
    beds?: {
        type: "single" | "double" | "queen" | "king" | "bunk" | "sofa_bed";
        count: number;
    }[] | null | undefined;
    maxAdults?: number | null | undefined;
    maxChildren?: number | null | undefined;
    sizeM2?: number | null | undefined;
    bathroom?: "private" | "shared" | null | undefined;
    extraBedsMax?: number | null | undefined;
    extraBedPriceRwf?: number | null | undefined;
}>;
export type RoomTypeDetailEdit = z.infer<typeof RoomTypeDetailEdit>;
/**
 * The nightly rate a party pays, before it is multiplied by the guests a per person price counts
 * (`computeBreakdown`). A room priced per room with a one guest price charges that to one guest. The
 * one rule the booking, the checkout preview and the receipt all read.
 */
export declare function nightlyRateFor(roomType: {
    nightlyRateRwf: number;
    singleGuestPriceRwf?: number | null;
    priceBasis?: string | null;
}, guests: number): number;
/** RDB grades stays from one to five stars under the EAC criteria. Null is "not graded". */
export declare const StarGrade: z.ZodNumber;
/** The owner says what grade RDB gave; saying it again withdraws any confirmation. */
export declare const SetStarGradeRequest: z.ZodObject<{
    workspaceId: z.ZodString;
    grade: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    workspaceId: string;
    grade: number | null;
}, {
    workspaceId: string;
    grade: number | null;
}>;
export type SetStarGradeRequest = z.infer<typeof SetStarGradeRequest>;
/** Where a business's star grade stands, as its owner and Injishi staff read it. */
export declare const StarGradeStatus: z.ZodObject<{
    grade: z.ZodNullable<z.ZodNumber>;
    verifiedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    verifiedAt: string | null;
    grade: number | null;
}, {
    verifiedAt: string | null;
    grade: number | null;
}>;
export type StarGradeStatus = z.infer<typeof StarGradeStatus>;
//# sourceMappingURL=property-policies.d.ts.map