import { z } from "zod";
// ---------------------------------------------------------------------------
// What a stay tells its guests before they book (0117, 2026-10-29).
//
// The choices Booking.com, Expedia and Airbnb ask a hotel for, in the words a
// Rwandan host uses: a front desk answer, the languages its staff speak, the
// check-in window, and children, pets, smoking, parties and quiet hours as
// choices rather than prose. The same lists are CHECK constraints on
// `properties` and `room_types`, so a row can never hold what no screen offers.
// ---------------------------------------------------------------------------
/** `HH:MM` or `HH:MM:SS`, as a bare `time` column stores it. */
export const ClockTime = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use a time like 14:00.");
export type ClockTime = z.infer<typeof ClockTime>;
/** Open around the clock, for set hours, or no desk at all (Expedia's front desk attribute). */
export const FrontDesk = z.enum(["24h", "limited", "none"]);
export type FrontDesk = z.infer<typeof FrontDesk>;
export const FRONT_DESK_LABEL: Readonly<Record<FrontDesk, string>> = {
    "24h": "Open 24 hours",
    limited: "Open set hours",
    none: "No front desk",
};
/** Rwanda's four official languages (Organic Law 02/2017 added Swahili). */
export const StaffLanguage = z.enum(["rw", "en", "fr", "sw"]);
export type StaffLanguage = z.infer<typeof StaffLanguage>;
export const STAFF_LANGUAGE_LABEL: Readonly<Record<StaffLanguage, string>> = {
    rw: "Kinyarwanda",
    en: "English",
    fr: "French",
    sw: "Swahili",
};
export const ChildrenPolicy = z.enum(["welcome", "adults_only"]);
export type ChildrenPolicy = z.infer<typeof ChildrenPolicy>;
export const CHILDREN_POLICY_LABEL: Readonly<Record<ChildrenPolicy, string>> = {
    welcome: "Children welcome",
    adults_only: "Adults only",
};
/** Yes, on request, no: Booking.com's three answers, no by default. */
export const PetsPolicy = z.enum(["no", "on_request", "yes"]);
export type PetsPolicy = z.infer<typeof PetsPolicy>;
export const PETS_POLICY_LABEL: Readonly<Record<PetsPolicy, string>> = {
    no: "No pets",
    on_request: "Pets on request",
    yes: "Pets welcome",
};
export const SmokingPolicy = z.enum(["no", "designated", "allowed"]);
export type SmokingPolicy = z.infer<typeof SmokingPolicy>;
export const SMOKING_POLICY_LABEL: Readonly<Record<SmokingPolicy, string>> = {
    no: "No smoking",
    designated: "Smoking in designated areas",
    allowed: "Smoking allowed",
};
export const PartiesPolicy = z.enum(["no", "on_request"]);
export type PartiesPolicy = z.infer<typeof PartiesPolicy>;
export const PARTIES_POLICY_LABEL: Readonly<Record<PartiesPolicy, string>> = {
    no: "No parties or events",
    on_request: "Parties and events on request",
};
export const InternetAccess = z.enum(["free_everywhere", "rooms_only", "public_only", "paid", "none"]);
export type InternetAccess = z.infer<typeof InternetAccess>;
export const INTERNET_LABEL: Readonly<Record<InternetAccess, string>> = {
    free_everywhere: "Free Wi-Fi everywhere",
    rooms_only: "Free Wi-Fi in rooms",
    public_only: "Free Wi-Fi in public areas",
    paid: "Wi-Fi at a charge",
    none: "No internet",
};
/** 0118: a crib for a baby is free, charged by the night, or not offered. */
export const CribPolicy = z.enum(["free", "charged", "none"]);
export type CribPolicy = z.infer<typeof CribPolicy>;
export const CRIB_POLICY_LABEL: Readonly<Record<CribPolicy, string>> = {
    free: "Cribs free on request",
    charged: "Cribs on request, at a charge",
    none: "No cribs",
};
export const ParkingOption = z.enum(["free_on_site", "paid_on_site", "street", "none"]);
export type ParkingOption = z.infer<typeof ParkingOption>;
export const PARKING_LABEL: Readonly<Record<ParkingOption, string>> = {
    free_on_site: "Free parking on site",
    paid_on_site: "Paid parking on site",
    street: "Street parking",
    none: "No parking",
};
/**
 * The policy fields a property edit may send, each `null` to clear. Shared by
 * the edit request and the owner's read, so the two say the same thing.
 */
export const propertyPolicyFields = {
    checkInUntil: ClockTime.nullable().optional(),
    frontDesk: FrontDesk.nullable().optional(),
    frontDeskOpens: ClockTime.nullable().optional(),
    frontDeskCloses: ClockTime.nullable().optional(),
    languages: z.array(StaffLanguage).max(4).optional(),
    whatsapp: z.string().trim().min(6, "Use a full phone number.").max(32).nullable().optional(),
    directions: z.string().trim().max(1000).nullable().optional(),
    minCheckInAge: z.number().int().min(16, "The youngest a guest may check in is 16.").max(25).nullable().optional(),
    childrenPolicy: ChildrenPolicy.nullable().optional(),
    petsPolicy: PetsPolicy.nullable().optional(),
    smokingPolicy: SmokingPolicy.nullable().optional(),
    partiesPolicy: PartiesPolicy.nullable().optional(),
    quietFrom: ClockTime.nullable().optional(),
    quietUntil: ClockTime.nullable().optional(),
    internet: InternetAccess.nullable().optional(),
    parking: ParkingOption.nullable().optional(),
    /** 0118. A charged crib names its price a night; a free one or none names none. */
    cribs: CribPolicy.nullable().optional(),
    cribPriceRwf: z.number().int().positive("A charged crib has a price.").max(1_000_000).nullable().optional(),
};
/** The policy fields on their own, for a screen that checks an edit before sending it. */
export const PropertyPolicyEdit = z.object(propertyPolicyFields);
export type PropertyPolicyEdit = z.infer<typeof PropertyPolicyEdit>;
/** What a stay has told its guests, as the owner and the guest page read it. Null is "not said yet". */
export const PropertyPolicies = z.object({
    checkInUntil: z.string().nullable().default(null),
    frontDesk: FrontDesk.nullable().default(null),
    frontDeskOpens: z.string().nullable().default(null),
    frontDeskCloses: z.string().nullable().default(null),
    languages: z.array(StaffLanguage).default([]),
    whatsapp: z.string().nullable().default(null),
    directions: z.string().nullable().default(null),
    minCheckInAge: z.number().int().nullable().default(null),
    childrenPolicy: ChildrenPolicy.nullable().default(null),
    petsPolicy: PetsPolicy.nullable().default(null),
    smokingPolicy: SmokingPolicy.nullable().default(null),
    partiesPolicy: PartiesPolicy.nullable().default(null),
    quietFrom: z.string().nullable().default(null),
    quietUntil: z.string().nullable().default(null),
    internet: InternetAccess.nullable().default(null),
    parking: ParkingOption.nullable().default(null),
    cribs: CribPolicy.nullable().default(null),
    cribPriceRwf: z.number().int().nullable().default(null),
});
export type PropertyPolicies = z.infer<typeof PropertyPolicies>;
/**
 * A stored row's policies as the contract reads them: times leave as `HH:MM`, and a value no list holds
 * (the CHECK constraints make that impossible) fails loudly rather than reaching a guest.
 */
export function policiesFromRow(row: { [K in keyof PropertyPolicies]: unknown }): PropertyPolicies {
    const clock = (t: unknown) => (typeof t === "string" ? t.slice(0, 5) : null);
    return PropertyPolicies.parse({
        ...row,
        checkInUntil: clock(row.checkInUntil),
        frontDeskOpens: clock(row.frontDeskOpens),
        frontDeskCloses: clock(row.frontDeskCloses),
        quietFrom: clock(row.quietFrom),
        quietUntil: clock(row.quietUntil),
    });
}
// ---------------------------------------------------------------------------
// A room type: what kind of room, its beds, size and bathroom
// ---------------------------------------------------------------------------
/** A Double has one bed for two, a Twin two beds (Booking.com's room type codes). */
export const RoomCategory = z.enum(["single", "double", "twin", "triple", "family", "suite", "studio", "tent", "dorm_bed"]);
export type RoomCategory = z.infer<typeof RoomCategory>;
export const ROOM_CATEGORY_LABEL: Readonly<Record<RoomCategory, string>> = {
    single: "Single room",
    double: "Double room",
    twin: "Twin room",
    triple: "Triple room",
    family: "Family room",
    suite: "Suite",
    studio: "Studio",
    tent: "Tent",
    dorm_bed: "Bed in a dormitory",
};
/** Bed types by width, as the platforms band them. */
export const BedType = z.enum(["single", "double", "queen", "king", "bunk", "sofa_bed"]);
export type BedType = z.infer<typeof BedType>;
export const BED_TYPE_LABEL: Readonly<Record<BedType, string>> = {
    single: "Single bed (90–130 cm)",
    double: "Double bed (131–150 cm)",
    queen: "Queen bed (151–180 cm)",
    king: "King bed (181–210 cm)",
    bunk: "Bunk bed",
    sofa_bed: "Sofa bed",
};
/** How many people a bed sleeps, which caps a room's adults: a bunk is two beds of one. */
export const BED_SLEEPS: Readonly<Record<BedType, number>> = {
    single: 1,
    double: 2,
    queen: 2,
    king: 2,
    bunk: 2,
    sofa_bed: 1,
};
export const RoomBed = z.object({
    type: BedType,
    count: z.number().int().positive("Add at least one.").max(20),
});
export type RoomBed = z.infer<typeof RoomBed>;
/** The beds in one room, each type once. */
export const RoomBeds = z
    .array(RoomBed)
    .max(6)
    .refine((beds) => new Set(beds.map((b) => b.type)).size === beds.length, "List each bed type once.");
export const Bathroom = z.enum(["private", "shared"]);
export type Bathroom = z.infer<typeof Bathroom>;
/** How many the beds sleep, the ceiling for a room's adults. */
export function bedsSleep(beds: readonly RoomBed[]): number {
    return beds.reduce((sum, b) => sum + BED_SLEEPS[b.type] * b.count, 0);
}
/** "1 king bed", "2 single beds and 1 sofa bed": the line a guest reads under a room. */
export function bedsLine(beds: readonly RoomBed[]): string {
    const one: Readonly<Record<BedType, string>> = {
        single: "single bed",
        double: "double bed",
        queen: "queen bed",
        king: "king bed",
        bunk: "bunk bed",
        sofa_bed: "sofa bed",
    };
    const parts = beds.map((b) => `${b.count} ${one[b.type]}${b.count === 1 ? "" : "s"}`);
    return parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
/** The room facts a room type edit may send, each `null` to clear. */
export const roomTypeDetailFields = {
    roomCategory: RoomCategory.nullable().optional(),
    beds: RoomBeds.nullable().optional(),
    maxAdults: z.number().int().positive().max(50).nullable().optional(),
    maxChildren: z.number().int().nonnegative().max(20).nullable().optional(),
    sizeM2: z.number().int().min(4, "A room is at least 4 m².").max(2000).nullable().optional(),
    bathroom: Bathroom.nullable().optional(),
    /**
     * What one guest pays for a room priced per room (owner decision, 2026-10-29). Less than the room
     * price, or absent: one guest then pays the room price. Only a room priced per room has one.
     */
    singleGuestPriceRwf: z.number().int().positive("A price is more than nothing.").max(100_000_000).nullable().optional(),
    /** 0118: how many extra beds the room takes, and what one costs a night, settled at the property. */
    extraBedsMax: z.number().int().min(0).max(4).nullable().optional(),
    extraBedPriceRwf: z.number().int().nonnegative().max(10_000_000).nullable().optional(),
};
/** The room facts on their own, for a screen that checks an edit before sending it. */
export const RoomTypeDetailEdit = z.object(roomTypeDetailFields);
export type RoomTypeDetailEdit = z.infer<typeof RoomTypeDetailEdit>;
/**
 * The nightly rate a party pays, before it is multiplied by the guests a per person price counts
 * (`computeBreakdown`). A room priced per room with a one guest price charges that to one guest. The
 * one rule the booking, the checkout preview and the receipt all read.
 */
export function nightlyRateFor(
    roomType: { nightlyRateRwf: number; singleGuestPriceRwf?: number | null; priceBasis?: string | null },
    guests: number,
): number {
    if (roomType.priceBasis === "per_unit" && guests === 1 && roomType.singleGuestPriceRwf != null) {
        return Math.min(roomType.singleGuestPriceRwf, roomType.nightlyRateRwf);
    }
    return roomType.nightlyRateRwf;
}
// ---------------------------------------------------------------------------
// Star grade (0118): the business's word until an officer checks it
// ---------------------------------------------------------------------------
/** RDB grades stays from one to five stars under the EAC criteria. Null is "not graded". */
export const StarGrade = z.number().int().min(1, "A grade is one to five stars.").max(5, "A grade is one to five stars.");
/** The owner says what grade RDB gave; saying it again withdraws any confirmation. */
export const SetStarGradeRequest = z.object({
    workspaceId: z.string().uuid(),
    grade: StarGrade.nullable(),
});
export type SetStarGradeRequest = z.infer<typeof SetStarGradeRequest>;
/** Where a business's star grade stands, as its owner and Injishi staff read it. */
export const StarGradeStatus = z.object({
    grade: z.number().int().nullable(),
    verifiedAt: z.string().nullable(),
});
export type StarGradeStatus = z.infer<typeof StarGradeStatus>;
