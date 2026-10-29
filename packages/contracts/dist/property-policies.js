"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarGradeStatus = exports.SetStarGradeRequest = exports.StarGrade = exports.RoomTypeDetailEdit = exports.roomTypeDetailFields = exports.Bathroom = exports.RoomBeds = exports.RoomBed = exports.BED_SLEEPS = exports.BED_TYPE_LABEL = exports.BedType = exports.ROOM_CATEGORY_LABEL = exports.RoomCategory = exports.PropertyPolicies = exports.PropertyPolicyEdit = exports.propertyPolicyFields = exports.PARKING_LABEL = exports.ParkingOption = exports.CRIB_POLICY_LABEL = exports.CribPolicy = exports.INTERNET_LABEL = exports.InternetAccess = exports.PARTIES_POLICY_LABEL = exports.PartiesPolicy = exports.SMOKING_POLICY_LABEL = exports.SmokingPolicy = exports.PETS_POLICY_LABEL = exports.PetsPolicy = exports.CHILDREN_POLICY_LABEL = exports.ChildrenPolicy = exports.STAFF_LANGUAGE_LABEL = exports.StaffLanguage = exports.FRONT_DESK_LABEL = exports.FrontDesk = exports.ClockTime = void 0;
exports.policiesFromRow = policiesFromRow;
exports.bedsSleep = bedsSleep;
exports.bedsLine = bedsLine;
exports.nightlyRateFor = nightlyRateFor;
const zod_1 = require("zod");
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
exports.ClockTime = zod_1.z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use a time like 14:00.");
/** Open around the clock, for set hours, or no desk at all (Expedia's front desk attribute). */
exports.FrontDesk = zod_1.z.enum(["24h", "limited", "none"]);
exports.FRONT_DESK_LABEL = {
    "24h": "Open 24 hours",
    limited: "Open set hours",
    none: "No front desk",
};
/** Rwanda's four official languages (Organic Law 02/2017 added Swahili). */
exports.StaffLanguage = zod_1.z.enum(["rw", "en", "fr", "sw"]);
exports.STAFF_LANGUAGE_LABEL = {
    rw: "Kinyarwanda",
    en: "English",
    fr: "French",
    sw: "Swahili",
};
exports.ChildrenPolicy = zod_1.z.enum(["welcome", "adults_only"]);
exports.CHILDREN_POLICY_LABEL = {
    welcome: "Children welcome",
    adults_only: "Adults only",
};
/** Yes, on request, no: Booking.com's three answers, no by default. */
exports.PetsPolicy = zod_1.z.enum(["no", "on_request", "yes"]);
exports.PETS_POLICY_LABEL = {
    no: "No pets",
    on_request: "Pets on request",
    yes: "Pets welcome",
};
exports.SmokingPolicy = zod_1.z.enum(["no", "designated", "allowed"]);
exports.SMOKING_POLICY_LABEL = {
    no: "No smoking",
    designated: "Smoking in designated areas",
    allowed: "Smoking allowed",
};
exports.PartiesPolicy = zod_1.z.enum(["no", "on_request"]);
exports.PARTIES_POLICY_LABEL = {
    no: "No parties or events",
    on_request: "Parties and events on request",
};
exports.InternetAccess = zod_1.z.enum(["free_everywhere", "rooms_only", "public_only", "paid", "none"]);
exports.INTERNET_LABEL = {
    free_everywhere: "Free Wi-Fi everywhere",
    rooms_only: "Free Wi-Fi in rooms",
    public_only: "Free Wi-Fi in public areas",
    paid: "Wi-Fi at a charge",
    none: "No internet",
};
/** 0118: a crib for a baby is free, charged by the night, or not offered. */
exports.CribPolicy = zod_1.z.enum(["free", "charged", "none"]);
exports.CRIB_POLICY_LABEL = {
    free: "Cribs free on request",
    charged: "Cribs on request, at a charge",
    none: "No cribs",
};
exports.ParkingOption = zod_1.z.enum(["free_on_site", "paid_on_site", "street", "none"]);
exports.PARKING_LABEL = {
    free_on_site: "Free parking on site",
    paid_on_site: "Paid parking on site",
    street: "Street parking",
    none: "No parking",
};
/**
 * The policy fields a property edit may send, each `null` to clear. Shared by
 * the edit request and the owner's read, so the two say the same thing.
 */
exports.propertyPolicyFields = {
    checkInUntil: exports.ClockTime.nullable().optional(),
    frontDesk: exports.FrontDesk.nullable().optional(),
    frontDeskOpens: exports.ClockTime.nullable().optional(),
    frontDeskCloses: exports.ClockTime.nullable().optional(),
    languages: zod_1.z.array(exports.StaffLanguage).max(4).optional(),
    whatsapp: zod_1.z.string().trim().min(6, "Use a full phone number.").max(32).nullable().optional(),
    directions: zod_1.z.string().trim().max(1000).nullable().optional(),
    minCheckInAge: zod_1.z.number().int().min(16, "The youngest a guest may check in is 16.").max(25).nullable().optional(),
    childrenPolicy: exports.ChildrenPolicy.nullable().optional(),
    petsPolicy: exports.PetsPolicy.nullable().optional(),
    smokingPolicy: exports.SmokingPolicy.nullable().optional(),
    partiesPolicy: exports.PartiesPolicy.nullable().optional(),
    quietFrom: exports.ClockTime.nullable().optional(),
    quietUntil: exports.ClockTime.nullable().optional(),
    internet: exports.InternetAccess.nullable().optional(),
    parking: exports.ParkingOption.nullable().optional(),
    /** 0118. A charged crib names its price a night; a free one or none names none. */
    cribs: exports.CribPolicy.nullable().optional(),
    cribPriceRwf: zod_1.z.number().int().positive("A charged crib has a price.").max(1000000).nullable().optional(),
};
/** The policy fields on their own, for a screen that checks an edit before sending it. */
exports.PropertyPolicyEdit = zod_1.z.object(exports.propertyPolicyFields);
/** What a stay has told its guests, as the owner and the guest page read it. Null is "not said yet". */
exports.PropertyPolicies = zod_1.z.object({
    checkInUntil: zod_1.z.string().nullable().default(null),
    frontDesk: exports.FrontDesk.nullable().default(null),
    frontDeskOpens: zod_1.z.string().nullable().default(null),
    frontDeskCloses: zod_1.z.string().nullable().default(null),
    languages: zod_1.z.array(exports.StaffLanguage).default([]),
    whatsapp: zod_1.z.string().nullable().default(null),
    directions: zod_1.z.string().nullable().default(null),
    minCheckInAge: zod_1.z.number().int().nullable().default(null),
    childrenPolicy: exports.ChildrenPolicy.nullable().default(null),
    petsPolicy: exports.PetsPolicy.nullable().default(null),
    smokingPolicy: exports.SmokingPolicy.nullable().default(null),
    partiesPolicy: exports.PartiesPolicy.nullable().default(null),
    quietFrom: zod_1.z.string().nullable().default(null),
    quietUntil: zod_1.z.string().nullable().default(null),
    internet: exports.InternetAccess.nullable().default(null),
    parking: exports.ParkingOption.nullable().default(null),
    cribs: exports.CribPolicy.nullable().default(null),
    cribPriceRwf: zod_1.z.number().int().nullable().default(null),
});
/**
 * A stored row's policies as the contract reads them: times leave as `HH:MM`, and a value no list holds
 * (the CHECK constraints make that impossible) fails loudly rather than reaching a guest.
 */
function policiesFromRow(row) {
    const clock = (t) => (typeof t === "string" ? t.slice(0, 5) : null);
    return exports.PropertyPolicies.parse({
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
exports.RoomCategory = zod_1.z.enum(["single", "double", "twin", "triple", "family", "suite", "studio", "tent", "dorm_bed"]);
exports.ROOM_CATEGORY_LABEL = {
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
exports.BedType = zod_1.z.enum(["single", "double", "queen", "king", "bunk", "sofa_bed"]);
exports.BED_TYPE_LABEL = {
    single: "Single bed (90–130 cm)",
    double: "Double bed (131–150 cm)",
    queen: "Queen bed (151–180 cm)",
    king: "King bed (181–210 cm)",
    bunk: "Bunk bed",
    sofa_bed: "Sofa bed",
};
/** How many people a bed sleeps, which caps a room's adults: a bunk is two beds of one. */
exports.BED_SLEEPS = {
    single: 1,
    double: 2,
    queen: 2,
    king: 2,
    bunk: 2,
    sofa_bed: 1,
};
exports.RoomBed = zod_1.z.object({
    type: exports.BedType,
    count: zod_1.z.number().int().positive("Add at least one.").max(20),
});
/** The beds in one room, each type once. */
exports.RoomBeds = zod_1.z
    .array(exports.RoomBed)
    .max(6)
    .refine((beds) => new Set(beds.map((b) => b.type)).size === beds.length, "List each bed type once.");
exports.Bathroom = zod_1.z.enum(["private", "shared"]);
/** How many the beds sleep, the ceiling for a room's adults. */
function bedsSleep(beds) {
    return beds.reduce((sum, b) => sum + exports.BED_SLEEPS[b.type] * b.count, 0);
}
/** "1 king bed", "2 single beds and 1 sofa bed": the line a guest reads under a room. */
function bedsLine(beds) {
    const one = {
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
exports.roomTypeDetailFields = {
    roomCategory: exports.RoomCategory.nullable().optional(),
    beds: exports.RoomBeds.nullable().optional(),
    maxAdults: zod_1.z.number().int().positive().max(50).nullable().optional(),
    maxChildren: zod_1.z.number().int().nonnegative().max(20).nullable().optional(),
    sizeM2: zod_1.z.number().int().min(4, "A room is at least 4 m².").max(2000).nullable().optional(),
    bathroom: exports.Bathroom.nullable().optional(),
    /**
     * What one guest pays for a room priced per room (owner decision, 2026-10-29). Less than the room
     * price, or absent: one guest then pays the room price. Only a room priced per room has one.
     */
    singleGuestPriceRwf: zod_1.z.number().int().positive("A price is more than nothing.").max(100000000).nullable().optional(),
    /** 0118: how many extra beds the room takes, and what one costs a night, settled at the property. */
    extraBedsMax: zod_1.z.number().int().min(0).max(4).nullable().optional(),
    extraBedPriceRwf: zod_1.z.number().int().nonnegative().max(10000000).nullable().optional(),
};
/** The room facts on their own, for a screen that checks an edit before sending it. */
exports.RoomTypeDetailEdit = zod_1.z.object(exports.roomTypeDetailFields);
/**
 * The nightly rate a party pays, before it is multiplied by the guests a per person price counts
 * (`computeBreakdown`). A room priced per room with a one guest price charges that to one guest. The
 * one rule the booking, the checkout preview and the receipt all read.
 */
function nightlyRateFor(roomType, guests) {
    if (roomType.priceBasis === "per_unit" && guests === 1 && roomType.singleGuestPriceRwf != null) {
        return Math.min(roomType.singleGuestPriceRwf, roomType.nightlyRateRwf);
    }
    return roomType.nightlyRateRwf;
}
// ---------------------------------------------------------------------------
// Star grade (0118): the business's word until an officer checks it
// ---------------------------------------------------------------------------
/** RDB grades stays from one to five stars under the EAC criteria. Null is "not graded". */
exports.StarGrade = zod_1.z.number().int().min(1, "A grade is one to five stars.").max(5, "A grade is one to five stars.");
/** The owner says what grade RDB gave; saying it again withdraws any confirmation. */
exports.SetStarGradeRequest = zod_1.z.object({
    workspaceId: zod_1.z.string().uuid(),
    grade: exports.StarGrade.nullable(),
});
/** Where a business's star grade stands, as its owner and Injishi staff read it. */
exports.StarGradeStatus = zod_1.z.object({
    grade: zod_1.z.number().int().nullable(),
    verifiedAt: zod_1.z.string().nullable(),
});
//# sourceMappingURL=property-policies.js.map