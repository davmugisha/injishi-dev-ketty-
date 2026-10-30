"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportBucket = exports.GuestReportQuery = exports.GUEST_REPORT_MAX_DAYS = exports.LeaderGuestPage = exports.LeaderSummary = exports.LeaderCounts = exports.LeaderFilters = exports.LeaderScope = exports.LeaderGuest = exports.LeaderChainStep = exports.FlagGuestRequest = exports.LeaderGuestQuery = exports.ReportOrigin = exports.LeaderArrivingWhen = exports.LeaderGuestTab = exports.GuestRelationship = exports.GuestCountry = exports.LandlordGuestList = exports.TenantGuestList = exports.HostGuestList = exports.HostGuestQuery = exports.HostGuestTab = exports.GuestBuilding = exports.HostGuest = exports.HostChainStep = exports.LandlordGuestRequest = exports.TenantGuestRequest = exports.GuestOrigin = exports.GuestCountryCode = exports.GuestPhone = exports.OTHER_RELATIONSHIP = exports.GUEST_RELATIONSHIPS = exports.GuestRouteState = exports.GuestStay = exports.GuestRegistrationStatus = exports.GuestHostKind = exports.OVERSIGHT_ROLE_SCOPES = exports.LEADER_ROLE_BODY = exports.LEADER_ROLE_SCOPE = exports.LEADER_ROLE_CHAIN = exports.LEADER_ROLE_STEP = exports.LEADER_ROLE_SHORT = exports.LEADER_ROLE_LABEL = exports.REVIEWER_ROLES = exports.CHAIN_ROLES = exports.LeaderRole = exports.LEADER_ROLES = exports.LEADER_ARRIVING_DAYS = exports.GUEST_RETENTION_MONTHS = exports.RWANDA_CODE = void 0;
exports.LeaderCoverage = exports.EndAppointmentQuery = exports.AppointOfficerRequest = exports.OversightAppointmentList = exports.WaitingArea = exports.PlaceNames = exports.OversightAppointmentQuery = exports.OversightAppointment = exports.AppointmentKind = exports.GuestReport = void 0;
exports.isLeaderRole = isLeaderRole;
exports.isChainRole = isChainRole;
exports.guestChainFor = guestChainFor;
exports.isFromAbroad = isFromAbroad;
exports.guestStayOn = guestStayOn;
exports.guestNights = guestNights;
exports.normaliseGuestPhone = normaliseGuestPhone;
exports.guestIdProblem = guestIdProblem;
exports.guestIdOf = guestIdOf;
exports.appointmentKindOf = appointmentKindOf;
const zod_1 = require("zod");
const countries_1 = require("./countries");
const phone_1 = require("./phone");
const primitives_1 = require("./primitives");
const dates_1 = require("./rentals/dates");
const identity_1 = require("./rentals/identity");
const vocab_1 = require("./rentals/vocab");
// ===========================================================================
// Guests and local leaders (P5)
// ===========================================================================
//
// A guest staying overnight in a rented home is registered on Injishi by the
// tenant (for their lease) or by the landlord (their own guests at a property).
// The landlord never approves or sees a tenant's guests. Every registration is
// delivered, at filing, along a chain read from the home's village:
//
//   1 the village leader (Umudugudu)        the village
//   2 the sector DASSO officer              the sector
//   3 the cell executive secretary          the cell
//   4 the district officer                  the district, for a Rwandan guest
//     or the district immigration officer   the district, for a guest from abroad
//
// A step whose post nobody holds waits, and is handed over when a leader is
// appointed for that area or the home's village is set. Each leader reads only
// their own area and role (immigration: only guests from abroad); anything
// else answers 404. Records are kept 12 months after departure.
/** Rwanda's ISO code: the nationality a guest has unless the form says otherwise. */
exports.RWANDA_CODE = "RW";
/** How long a guest record is kept after the guest leaves, then purged (counts are kept). */
exports.GUEST_RETENTION_MONTHS = 12;
/** How far ahead the leader's Arriving tab looks. */
exports.LEADER_ARRIVING_DAYS = 7;
// --- The leader roles -----------------------------------------------------------
/**
 * Every leader post the database knows. Two chains are in use, each village, cell, district
 * (`CHAIN_ROLES`): local government reads every guest, Rwandan or foreign; the immigration directorate
 * (DGIE) reads guests from abroad only. The DASSO, sector executive and DGIE province and headquarters
 * posts are retired: kept so older records still read, never routed to or appointed again.
 */
exports.LEADER_ROLES = [
    "village_leader",
    "cell_executive",
    "district_officer",
    "dgie_village",
    "dgie_cell",
    "district_immigration",
    "dasso",
    "sector_executive",
    "dgie_province",
    "dgie_national",
];
exports.LeaderRole = zod_1.z.enum(exports.LEADER_ROLES);
/** Is this oversight role one of the local leaders? */
function isLeaderRole(role) {
    return exports.LEADER_ROLES.includes(role);
}
/** The posts guests are routed to and admins appoint, in the order of the chains. */
exports.CHAIN_ROLES = [
    "village_leader",
    "cell_executive",
    "district_officer",
    "dgie_village",
    "dgie_cell",
    "district_immigration",
];
/** Is this post one guests go to now (not a retired one)? */
function isChainRole(role) {
    return exports.CHAIN_ROLES.includes(role);
}
/** The roles that review businesses (field verification and approval). */
exports.REVIEWER_ROLES = ["business_field_verifier", "business_approver"];
/** What each leader is called, in full. */
exports.LEADER_ROLE_LABEL = {
    village_leader: "Village leader (Umudugudu)",
    dasso: "Sector DASSO",
    cell_executive: "Cell executive secretary",
    sector_executive: "Sector executive secretary",
    district_officer: "District officer",
    district_immigration: "DGIE district officer",
    dgie_province: "DGIE province officer",
    dgie_national: "DGIE headquarters",
    dgie_village: "DGIE village officer",
    dgie_cell: "DGIE cell officer",
};
/** The short words a chip or a column uses. */
exports.LEADER_ROLE_SHORT = {
    village_leader: "Village leader",
    dasso: "DASSO",
    cell_executive: "Cell executive",
    sector_executive: "Sector executive",
    district_officer: "District officer",
    district_immigration: "DGIE district",
    dgie_province: "DGIE province",
    dgie_national: "DGIE headquarters",
    dgie_village: "DGIE village",
    dgie_cell: "DGIE cell",
};
/** Where each post sits in a registration's chain, from 1: local government 1 to 3, DGIE 4 to 6. */
exports.LEADER_ROLE_STEP = {
    village_leader: 1,
    cell_executive: 2,
    district_officer: 3,
    dgie_village: 4,
    dgie_cell: 5,
    district_immigration: 6,
    // Retired posts keep a place for older records.
    dasso: 7,
    sector_executive: 7,
    dgie_province: 8,
    dgie_national: 8,
};
/** Which body's chain a post is in: local government sees every guest, DGIE guests from abroad. */
exports.LEADER_ROLE_CHAIN = {
    village_leader: "local",
    dasso: "local",
    cell_executive: "local",
    sector_executive: "local",
    district_officer: "local",
    district_immigration: "dgie",
    dgie_province: "dgie",
    dgie_national: "dgie",
    dgie_village: "dgie",
    dgie_cell: "dgie",
};
exports.LEADER_ROLE_SCOPE = {
    village_leader: "village",
    dasso: "sector",
    cell_executive: "cell",
    sector_executive: "sector",
    district_officer: "district",
    district_immigration: "district",
    dgie_province: "province",
    dgie_national: "country",
    dgie_village: "village",
    dgie_cell: "cell",
};
/** The government body a leader is appointed under unless the admin picks another. */
exports.LEADER_ROLE_BODY = {
    village_leader: "MINALOC",
    dasso: "MINALOC",
    cell_executive: "MINALOC",
    sector_executive: "MINALOC",
    district_officer: "MINALOC",
    district_immigration: "DGIE",
    dgie_province: "DGIE",
    dgie_national: "DGIE",
    dgie_village: "DGIE",
    dgie_cell: "DGIE",
};
/**
 * The scope levels each oversight role may be appointed at. A leader covers one
 * level; a business reviewer or tax officer the country, a province or a
 * district; a PSF membership officer the country only.
 */
exports.OVERSIGHT_ROLE_SCOPES = {
    village_leader: ["village"],
    dasso: ["sector"],
    cell_executive: ["cell"],
    sector_executive: ["sector"],
    district_officer: ["district"],
    district_immigration: ["district"],
    dgie_province: ["province"],
    dgie_national: ["country"],
    dgie_village: ["village"],
    dgie_cell: ["cell"],
    business_field_verifier: ["country", "province", "district"],
    business_approver: ["country", "province", "district"],
    tax_compliance_officer: ["country", "province", "district"],
    psf_membership_officer: ["country"],
};
/**
 * The chain a registration goes along, in order: local government's village leader, cell executive
 * secretary and district officer for every guest; DGIE's village, cell and district officers too for a
 * guest from abroad.
 */
function guestChainFor(fromAbroad) {
    const local = ["village_leader", "cell_executive", "district_officer"];
    return fromAbroad ? [...local, "dgie_village", "dgie_cell", "district_immigration"] : local;
}
/** A guest is "from abroad" when their nationality is not Rwandan. */
function isFromAbroad(nationality) {
    return nationality.toUpperCase() !== exports.RWANDA_CODE;
}
// --- Guest vocabulary -------------------------------------------------------------
/** Who filed a guest: a tenant, a landlord, or a hotel, lodge, guest house or apartment block at check in. */
exports.GuestHostKind = zod_1.z.enum(["tenant", "landlord", "hotel"]);
exports.GuestRegistrationStatus = zod_1.z.enum(["submitted", "cancelled"]);
/** Where a stay is on a given day. */
exports.GuestStay = zod_1.z.enum(["arriving", "staying", "left"]);
/** Where one step of the chain stands: nobody holds the post yet, delivered, or opened. */
exports.GuestRouteState = zod_1.z.enum(["waiting", "delivered", "seen"]);
/** Where a stay is on `today`: still to come, under way, or over. */
function guestStayOn(today, arrivalOn, departureOn) {
    if (today < arrivalOn)
        return "arriving";
    if (today > departureOn)
        return "left";
    return "staying";
}
/** Nights a stay covers: arriving and leaving the same day is 0. */
function guestNights(arrivalOn, departureOn) {
    return Math.max(0, (0, dates_1.daysBetween)(arrivalOn, departureOn));
}
/**
 * Who a guest is to the host: the `guest_relationships` reference table's rows,
 * in the order a form offers them. `other` asks for a few words.
 */
exports.GUEST_RELATIONSHIPS = [
    { code: "father", label: "Father", needsDetail: false },
    { code: "mother", label: "Mother", needsDetail: false },
    { code: "sibling", label: "Brother or sister", needsDetail: false },
    { code: "spouse", label: "Husband or wife", needsDetail: false },
    { code: "partner", label: "Partner", needsDetail: false },
    { code: "child", label: "Son or daughter", needsDetail: false },
    { code: "grandparent", label: "Grandparent", needsDetail: false },
    { code: "grandchild", label: "Grandchild", needsDetail: false },
    { code: "uncle", label: "Uncle", needsDetail: false },
    { code: "aunt", label: "Aunt", needsDetail: false },
    { code: "cousin", label: "Cousin", needsDetail: false },
    { code: "nephew_niece", label: "Nephew or niece", needsDetail: false },
    { code: "in_law", label: "In-law", needsDetail: false },
    { code: "guardian", label: "Guardian", needsDetail: false },
    { code: "friend", label: "Friend", needsDetail: false },
    { code: "colleague", label: "Colleague", needsDetail: false },
    { code: "other", label: "Other", needsDetail: true },
];
/** The relationship that asks for its own words. */
exports.OTHER_RELATIONSHIP = "other";
// --- Field rules ------------------------------------------------------------------
/**
 * A guest's phone in E.164: a Rwandan mobile however it is spaced
 * (`0788 123 456`), or a number from another country with its + code. The
 * same rule as the kit's `PhoneInput` with `allowInternational`.
 */
function normaliseGuestPhone(raw) {
    const text = raw.trim().replace(/[\s\-().]/g, "");
    if (text.startsWith("00"))
        return normaliseGuestPhone(`+${text.slice(2)}`);
    if (text.startsWith("+") && !text.startsWith("+250"))
        return /^\+[1-9]\d{7,14}$/.test(text) ? text : null;
    return (0, phone_1.normalizeRwPhone)(text);
}
exports.GuestPhone = zod_1.z
    .string({ required_error: "Enter their phone number.", invalid_type_error: "Enter their phone number." })
    .trim()
    .min(1, "Enter their phone number.")
    .transform((raw, ctx) => {
    const phone = normaliseGuestPhone(raw);
    if (!phone) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Enter a Rwandan mobile like 0788 123 456, or a number with its country code.",
        });
        return zod_1.z.NEVER;
    }
    return phone;
});
/** An ISO 3166-1 alpha-2 code from the list the country picker offers. */
exports.GuestCountryCode = zod_1.z
    .string({ required_error: "Pick a country.", invalid_type_error: "Pick a country." })
    .trim()
    .toUpperCase()
    .refine((code) => (0, countries_1.isKnownCountry)(code), "Pick a country.");
/**
 * Where the guest is coming from: a village in Rwanda, picked down the place
 * cascade, or another country.
 */
exports.GuestOrigin = zod_1.z.discriminatedUnion("kind", [
    zod_1.z.object({ kind: zod_1.z.literal("village"), villageId: zod_1.z.number({ invalid_type_error: "Pick the village they come from." }).int().positive("Pick the village they come from.") }),
    zod_1.z.object({ kind: zod_1.z.literal("country"), countryCode: exports.GuestCountryCode }),
]);
/**
 * Why an ID is not acceptable for this nationality, or null. Optional: an empty
 * number is fine. A national ID is Rwandan only; a number given with no kind is
 * read as a national ID for a Rwandan and a passport otherwise.
 */
function guestIdProblem(input) {
    const number = input.idNumber?.trim() ?? "";
    if (!number)
        return null;
    const kind = input.idKind ?? (0, identity_1.defaultIdKind)(input.nationality);
    if (kind === "national_id" && input.nationality !== exports.RWANDA_CODE) {
        return { path: "idKind", message: "A national ID is for Rwandans. Use their passport number." };
    }
    const problem = (0, identity_1.idNumberProblem)(kind, number);
    return problem ? { path: "idNumber", message: problem } : null;
}
/** The ID as stored: both null when none was given, else the kind and the normalised number. */
function guestIdOf(input) {
    const number = input.idNumber?.trim() ?? "";
    if (!number)
        return { idKind: null, idNumber: null };
    return { idKind: input.idKind ?? (0, identity_1.defaultIdKind)(input.nationality), idNumber: (0, identity_1.normaliseIdNumber)(number) };
}
// --- Registering a guest (tenant and landlord) -----------------------------------------
const guestFields = {
    fullName: identity_1.PersonName,
    phone: exports.GuestPhone,
    nationality: exports.GuestCountryCode.default(exports.RWANDA_CODE),
    idKind: vocab_1.IdKind.nullable().optional(),
    idNumber: zod_1.z.string().trim().max(40, "That number is too long.").nullable().optional(),
    relationship: zod_1.z.string({ required_error: "Pick who they are to you." }).trim().min(1, "Pick who they are to you."),
    relationshipOther: zod_1.z.string().trim().max(80, "Keep it under 80 characters.").nullable().optional(),
    origin: exports.GuestOrigin,
    arrivalOn: dates_1.CalendarDay,
    departureOn: dates_1.CalendarDay,
};
/**
 * The checks one form and the API share. The lease window (a tenant's guest
 * stays inside the lease) is the server's to add: it knows the lease.
 */
function checkGuest(v, ctx) {
    const id = guestIdProblem(v);
    if (id)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: [id.path], message: id.message });
    if (v.relationship === exports.OTHER_RELATIONSHIP && (v.relationshipOther?.trim().length ?? 0) < 2) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["relationshipOther"], message: "Say who they are to you, in a few words." });
    }
    if (v.origin.kind === "country" && v.origin.countryCode === exports.RWANDA_CODE) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["origin"], message: "For somewhere in Rwanda, pick the village." });
    }
    if ((0, dates_1.isIsoDate)(v.arrivalOn) && (0, dates_1.isIsoDate)(v.departureOn)) {
        const stay = (0, dates_1.guestStayProblem)({ arrivalOn: v.arrivalOn, departureOn: v.departureOn });
        if (stay)
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: [stay.path], message: stay.message });
    }
}
/** A tenant registers a guest for their lease: `POST /me/tenancies/:leaseId/guests`, and `PATCH …/:id`. */
exports.TenantGuestRequest = zod_1.z.object(guestFields).superRefine(checkGuest);
/** A landlord registers their own guest at one of their buildings: `POST /ops/guests`, and `PATCH …/:id`. */
exports.LandlordGuestRequest = zod_1.z
    .object({ ...guestFields, propertyId: primitives_1.Uuid, unitId: primitives_1.Uuid.nullable().optional() })
    .superRefine(checkGuest);
// --- What a host reads -------------------------------------------------------------
/** One step of the chain as the host reads it: who it went to and where it stands. Never a flag. */
exports.HostChainStep = zod_1.z.object({
    role: exports.LeaderRole,
    roleLabel: zod_1.z.string(),
    step: zod_1.z.number().int(),
    state: exports.GuestRouteState,
});
exports.HostGuest = zod_1.z.object({
    id: primitives_1.Uuid,
    hostKind: exports.GuestHostKind,
    fullName: zod_1.z.string(),
    phone: zod_1.z.string(),
    nationality: zod_1.z.string(),
    nationalityName: zod_1.z.string(),
    fromAbroad: zod_1.z.boolean(),
    idKind: vocab_1.IdKind.nullable(),
    idNumber: zod_1.z.string().nullable(),
    relationship: zod_1.z.string(),
    relationshipLabel: zod_1.z.string(),
    relationshipOther: zod_1.z.string().nullable(),
    origin: exports.GuestOrigin,
    /** Where they come from, in words: the village path or the country. */
    originWords: zod_1.z.string(),
    arrivalOn: zod_1.z.string(),
    departureOn: zod_1.z.string(),
    nights: zod_1.z.number().int(),
    status: exports.GuestRegistrationStatus,
    /** Null once cancelled. */
    stay: exports.GuestStay.nullable(),
    /** Changes and cancelling are open until the arrival day has passed. */
    canChange: zod_1.z.boolean(),
    propertyId: primitives_1.Uuid,
    propertyName: zod_1.z.string(),
    unitId: primitives_1.Uuid.nullable(),
    unitLabel: zod_1.z.string().nullable(),
    chain: zod_1.z.array(exports.HostChainStep),
    createdAt: zod_1.z.string(),
});
/** A building a landlord can register a guest at, and whether guests there reach a village leader yet. */
exports.GuestBuilding = zod_1.z.object({
    id: primitives_1.Uuid,
    name: zod_1.z.string(),
    address: zod_1.z.string().nullable(),
    /** False while the building has no village on record: its village and cell steps wait. */
    located: zod_1.z.boolean(),
    units: zod_1.z.array(zod_1.z.object({ id: primitives_1.Uuid, label: zod_1.z.string() })),
});
exports.HostGuestTab = zod_1.z.enum(["arriving", "staying", "left", "cancelled"]);
exports.HostGuestQuery = zod_1.z.object({ tab: exports.HostGuestTab.optional() });
exports.HostGuestList = zod_1.z.object({
    guests: zod_1.z.array(exports.HostGuest),
    counts: zod_1.z.record(exports.HostGuestTab, zod_1.z.number().int()),
});
/** A tenant's guests, with the days the lease lets a guest stay. */
exports.TenantGuestList = exports.HostGuestList.extend({
    window: zod_1.z.object({ start: zod_1.z.string(), end: zod_1.z.string() }),
});
/** A landlord's own guests, with the buildings the form offers. */
exports.LandlordGuestList = exports.HostGuestList.extend({
    buildings: zod_1.z.array(exports.GuestBuilding),
});
// --- The reference lists the form offers ------------------------------------------------
exports.GuestCountry = zod_1.z.object({ code: zod_1.z.string(), name: zod_1.z.string() });
exports.GuestRelationship = zod_1.z.object({ code: zod_1.z.string(), label: zod_1.z.string(), needsDetail: zod_1.z.boolean() });
// --- The leader's console ---------------------------------------------------------------
/** `all` (the default): every guest in the area, nothing chosen for the leader. */
exports.LeaderGuestTab = zod_1.z.enum(["all", "arriving", "staying", "left", "flagged"]);
const AreaId = zod_1.z.coerce.number().int().positive();
/** The Arriving tab's window: the next 7 days, or everyone arriving after that. */
exports.LeaderArrivingWhen = zod_1.z.enum(["soon", "later"]);
/** A guest filter by nationality, in the leader's words: everyone, Rwandans, or guests from other countries. */
exports.ReportOrigin = zod_1.z.enum(["nationals", "international"]);
exports.LeaderGuestQuery = zod_1.z.object({
    tab: exports.LeaderGuestTab.default("all"),
    when: exports.LeaderArrivingWhen.default("soon"),
    sectorId: AreaId.optional(),
    cellId: AreaId.optional(),
    villageId: AreaId.optional(),
    q: zod_1.z.string().trim().max(80).optional(),
    /** Rwandan guests, or guests of another nationality. */
    origin: exports.ReportOrigin.optional(),
    /** One nationality (ISO 3166-1 alpha-2). */
    nationality: zod_1.z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Pick a country.").optional(),
    page: zod_1.z.coerce.number().int().min(1).max(1000).default(1),
});
exports.FlagGuestRequest = zod_1.z.object({
    note: zod_1.z
        .string({ required_error: "Say what needs a closer look." })
        .trim()
        .min(3, "Say what needs a closer look.")
        .max(500, "Keep the note under 500 characters."),
});
/** One step of the chain as a leader reads it: who holds it, who opened it, any flag. */
exports.LeaderChainStep = zod_1.z.object({
    role: exports.LeaderRole,
    roleLabel: zod_1.z.string(),
    step: zod_1.z.number().int(),
    state: exports.GuestRouteState,
    deliveredAt: zod_1.z.string().nullable(),
    seenAt: zod_1.z.string().nullable(),
    seenBy: zod_1.z.string().nullable(),
    flag: zod_1.z.object({ note: zod_1.z.string(), at: zod_1.z.string(), by: zod_1.z.string().nullable() }).nullable(),
});
exports.LeaderGuest = zod_1.z.object({
    id: primitives_1.Uuid,
    fullName: zod_1.z.string(),
    nationality: zod_1.z.string(),
    nationalityName: zod_1.z.string(),
    fromAbroad: zod_1.z.boolean(),
    idKind: vocab_1.IdKind.nullable(),
    idNumber: zod_1.z.string().nullable(),
    phone: zod_1.z.string(),
    relationshipLabel: zod_1.z.string(),
    originWords: zod_1.z.string(),
    arrivalOn: zod_1.z.string(),
    departureOn: zod_1.z.string(),
    nights: zod_1.z.number().int(),
    stay: exports.GuestStay,
    host: zod_1.z.object({ kind: exports.GuestHostKind, name: zod_1.z.string(), phone: zod_1.z.string().nullable() }),
    home: zod_1.z.object({
        propertyName: zod_1.z.string(),
        unitLabel: zod_1.z.string().nullable(),
        /** Street, then village up to district, each place once. */
        address: zod_1.z.string(),
        /** The village and cell by name, for a list that covers several. */
        villageName: zod_1.z.string().nullable(),
        cellName: zod_1.z.string().nullable(),
        villageId: zod_1.z.number().int().nullable(),
        cellId: zod_1.z.number().int().nullable(),
        sectorId: zod_1.z.number().int().nullable(),
        districtId: zod_1.z.number().int().nullable(),
    }),
    chain: zod_1.z.array(exports.LeaderChainStep),
    /** Opened by this leader (any of their posts covering it). */
    seenByMe: zod_1.z.boolean(),
    flagged: zod_1.z.boolean(),
    /** The host changed it after it was filed. */
    changedAt: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
});
/** One post a leader holds, in words. */
exports.LeaderScope = zod_1.z.object({
    assignmentId: primitives_1.Uuid,
    role: exports.LeaderRole,
    roleLabel: zod_1.z.string(),
    level: zod_1.z.enum(["village", "cell", "sector", "district", "province", "country"]),
    area: zod_1.z.string(),
});
/** The places a wider post can narrow to: only those inside it. */
exports.LeaderFilters = zod_1.z.object({
    sectors: zod_1.z.array(zod_1.z.object({ id: zod_1.z.number().int(), name: zod_1.z.string() })),
    cells: zod_1.z.array(zod_1.z.object({ id: zod_1.z.number().int(), name: zod_1.z.string(), sectorId: zod_1.z.number().int() })),
    villages: zod_1.z.array(zod_1.z.object({ id: zod_1.z.number().int(), name: zod_1.z.string(), cellId: zod_1.z.number().int() })),
    /** The nationalities among the guests in the leader's area (in the place chosen), most guests first. */
    nationalities: zod_1.z.array(zod_1.z.object({ code: zod_1.z.string(), name: zod_1.z.string(), count: zod_1.z.number().int() })).default([]),
});
exports.LeaderCounts = zod_1.z.object({
    /** Arriving in the next 7 days. */
    arriving: zod_1.z.number().int(),
    /** Arriving after that. */
    later: zod_1.z.number().int(),
    staying: zod_1.z.number().int(),
    left: zod_1.z.number().int(),
    flagged: zod_1.z.number().int(),
    /** Guests in scope this leader has not opened yet. */
    unseen: zod_1.z.number().int(),
    /** Of those staying now, how many are foreign (by nationality). */
    stayingForeign: zod_1.z.number().int().default(0),
    /** Current guests (staying or still to come) in scope, the base the unopened count is part of. */
    current: zod_1.z.number().int().default(0),
    /** Guests arriving on each of the next 7 days, tomorrow first. */
    arrivingByDay: zod_1.z.array(zod_1.z.number().int()).default([]),
    /** Guests staying on each of the last 14 days, today last. */
    stayingByDay: zod_1.z.array(zod_1.z.number().int()).default([]),
});
exports.LeaderSummary = zod_1.z.object({
    leader: zod_1.z.object({ name: zod_1.z.string().nullable(), email: zod_1.z.string() }),
    scopes: zod_1.z.array(exports.LeaderScope),
    filters: exports.LeaderFilters,
    counts: exports.LeaderCounts,
});
exports.LeaderGuestPage = exports.LeaderSummary.extend({
    tab: exports.LeaderGuestTab,
    when: exports.LeaderArrivingWhen,
    guests: zod_1.z.array(exports.LeaderGuest),
    page: zod_1.z.number().int(),
    pageSize: zod_1.z.number().int(),
    total: zod_1.z.number().int(),
});
// --- The leader's reports ----------------------------------------------------------------
/** The longest period one report covers. */
exports.GUEST_REPORT_MAX_DAYS = 731;
exports.GuestReportQuery = zod_1.z
    .object({
    from: dates_1.CalendarDay,
    to: dates_1.CalendarDay,
    sectorId: AreaId.optional(),
    cellId: AreaId.optional(),
    villageId: AreaId.optional(),
    /** By nationality: Rwandan guests, or guests of any other nationality. */
    origin: exports.ReportOrigin.optional(),
    /** One nationality (ISO 3166-1 alpha-2). */
    nationality: zod_1.z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Pick a country.").optional(),
    /** One relationship code (`guest_relationships`). */
    relationship: zod_1.z.string().trim().min(1).max(40).optional(),
    /** Only guests a leader flagged. */
    flagged: zod_1.z.enum(["only"]).optional(),
})
    .superRefine((v, ctx) => {
    if (!(0, dates_1.isIsoDate)(v.from) || !(0, dates_1.isIsoDate)(v.to))
        return;
    if (v.to < v.from)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["to"], message: "The end can't be before the start." });
    else if ((0, dates_1.daysBetween)(v.from, v.to) > exports.GUEST_REPORT_MAX_DAYS) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["to"], message: "A report covers at most two years." });
    }
});
exports.ReportBucket = zod_1.z.enum(["day", "week", "month"]);
exports.GuestReport = zod_1.z.object({
    period: zod_1.z.object({ from: zod_1.z.string(), to: zod_1.z.string() }),
    generatedAt: zod_1.z.string(),
    leader: zod_1.z.object({ name: zod_1.z.string().nullable(), email: zod_1.z.string() }),
    scopes: zod_1.z.array(exports.LeaderScope),
    /** The narrowing applied inside the leader's area, in words, or null. */
    narrowedTo: zod_1.z.string().nullable(),
    /** The guest filters applied (nationality, relationship, flagged), in words; empty with none. */
    filteredBy: zod_1.z.array(zod_1.z.string()).default([]),
    /** Every nationality and relationship in the period with no guest filter applied: the filters' choices. */
    choices: zod_1.z
        .object({
        nationalities: zod_1.z.array(zod_1.z.object({ code: zod_1.z.string(), name: zod_1.z.string(), count: zod_1.z.number().int() })),
        relationships: zod_1.z.array(zod_1.z.object({ code: zod_1.z.string(), label: zod_1.z.string(), count: zod_1.z.number().int() })),
    })
        .default({ nationalities: [], relationships: [] }),
    totals: zod_1.z.object({
        /** Guests whose arrival falls in the period. */
        registered: zod_1.z.number().int(),
        /** Guests staying today, whatever the period. */
        stayingNow: zod_1.z.number().int(),
        fromAbroad: zod_1.z.number().int(),
        flagged: zod_1.z.number().int(),
        /** Mean nights per stay, one decimal; null with no guests. */
        averageNights: zod_1.z.number().nullable(),
    }),
    /** The level the area table breaks down by: one below the widest post. */
    areaLevel: zod_1.z.enum(["sector", "cell", "village"]),
    byArea: zod_1.z.array(zod_1.z.object({ id: zod_1.z.number().int(), name: zod_1.z.string(), registered: zod_1.z.number().int(), fromAbroad: zod_1.z.number().int(), flagged: zod_1.z.number().int() })),
    byNationality: zod_1.z.array(zod_1.z.object({ code: zod_1.z.string(), name: zod_1.z.string(), count: zod_1.z.number().int() })),
    byRelationship: zod_1.z.array(zod_1.z.object({ code: zod_1.z.string(), label: zod_1.z.string(), count: zod_1.z.number().int() })),
    arrivals: zod_1.z.object({
        bucket: exports.ReportBucket,
        points: zod_1.z.array(zod_1.z.object({ start: zod_1.z.string(), label: zod_1.z.string(), count: zod_1.z.number().int() })),
    }),
    /**
     * How the period's guests went along the chain, one row per leader post in its order: how many it
     * received, how many reached a leader (delivered), were opened and flagged, and how many still wait
     * because nobody holds that post yet.
     */
    chain: zod_1.z
        .array(zod_1.z.object({
        role: exports.LeaderRole,
        label: zod_1.z.string(),
        step: zod_1.z.number().int(),
        guests: zod_1.z.number().int(),
        delivered: zod_1.z.number().int(),
        opened: zod_1.z.number().int(),
        flagged: zod_1.z.number().int(),
        waiting: zod_1.z.number().int(),
    }))
        .default([]),
    /** Homes with the most guests, by address: never a person's name. */
    topHomes: zod_1.z.array(zod_1.z.object({ address: zod_1.z.string(), unitLabel: zod_1.z.string().nullable(), guests: zod_1.z.number().int() })),
    /** Records older than the retention period are purged; their counts are folded into the totals. */
    purged: zod_1.z.object({ before: zod_1.z.string(), registered: zod_1.z.number().int(), fromAbroad: zod_1.z.number().int(), flagged: zod_1.z.number().int() }).nullable(),
});
// --- Admin: local leaders and officers -------------------------------------------------------
/** How an appointment is grouped on the admin screen. */
exports.AppointmentKind = zod_1.z.enum(["leader", "reviewer", "officer"]);
function appointmentKindOf(role) {
    if (isLeaderRole(role))
        return "leader";
    if (exports.REVIEWER_ROLES.includes(role))
        return "reviewer";
    return "officer";
}
exports.OversightAppointment = zod_1.z.object({
    id: primitives_1.Uuid,
    userId: primitives_1.Uuid,
    name: zod_1.z.string().nullable(),
    email: zod_1.z.string(),
    role: primitives_1.OversightRole,
    roleLabel: zod_1.z.string(),
    kind: exports.AppointmentKind,
    bodyCode: zod_1.z.string(),
    bodyName: zod_1.z.string().nullable(),
    title: zod_1.z.string().nullable(),
    scopeLevel: primitives_1.OversightScopeLevel,
    /** The area in words, village up to district; "Rwanda" for the whole country. */
    area: zod_1.z.string(),
    provinceId: zod_1.z.number().int().nullable(),
    districtId: zod_1.z.number().int().nullable(),
    sectorId: zod_1.z.number().int().nullable(),
    cellId: zod_1.z.number().int().nullable(),
    villageId: zod_1.z.number().int().nullable(),
    grantedAt: zod_1.z.string(),
    grantedBy: zod_1.z.string().nullable(),
    /** For a leader: guest registrations delivered to this post, and how many were opened. */
    delivered: zod_1.z.number().int(),
    seen: zod_1.z.number().int(),
});
exports.OversightAppointmentQuery = zod_1.z.object({
    role: primitives_1.OversightRole.optional(),
    kind: exports.AppointmentKind.optional(),
    provinceId: AreaId.optional(),
    districtId: AreaId.optional(),
    sectorId: AreaId.optional(),
    cellId: AreaId.optional(),
    villageId: AreaId.optional(),
    q: zod_1.z.string().trim().max(120).optional(),
});
/** A place's names from the province down, as far as it is known: a form prefills the place picker with it. */
exports.PlaceNames = zod_1.z.object({
    province: zod_1.z.string().nullable(),
    district: zod_1.z.string().nullable(),
    sector: zod_1.z.string().nullable(),
    cell: zod_1.z.string().nullable(),
    village: zod_1.z.string().nullable(),
});
/** Guests waiting because nobody holds a post in an area. */
exports.WaitingArea = zod_1.z.object({
    role: exports.LeaderRole,
    roleLabel: zod_1.z.string(),
    level: zod_1.z.enum(["village", "cell", "sector", "district", "province", "country"]),
    /** In words; "No village on record" when the home has none yet. */
    area: zod_1.z.string(),
    located: zod_1.z.boolean(),
    provinceId: zod_1.z.number().int().nullable(),
    districtId: zod_1.z.number().int().nullable(),
    sectorId: zod_1.z.number().int().nullable(),
    cellId: zod_1.z.number().int().nullable(),
    villageId: zod_1.z.number().int().nullable(),
    names: exports.PlaceNames,
    reports: zod_1.z.number().int(),
    oldestArrival: zod_1.z.string(),
});
exports.OversightAppointmentList = zod_1.z.object({
    appointments: zod_1.z.array(exports.OversightAppointment),
    counts: zod_1.z.object({ leader: zod_1.z.number().int(), reviewer: zod_1.z.number().int(), officer: zod_1.z.number().int() }),
    waiting: zod_1.z.array(exports.WaitingArea),
    waitingReports: zod_1.z.number().int(),
});
const reason = zod_1.z
    .string({ required_error: "Say why, in a few words." })
    .trim()
    .min(4, "Say why, in a few words.")
    .max(500, "Keep the reason under 500 characters.");
const PlaceId = zod_1.z.number().int().positive().nullable().optional();
/**
 * Appoint a person to a post by email (`POST /admin/local-leaders`). The person
 * is found by email or created with it and signs in with an emailed code. The
 * area names exactly the level the role covers: a village for a village
 * leader, a sector for a DASSO, a cell for a cell executive secretary, a
 * district for the two district roles; a business reviewer the country, a
 * province or a district.
 */
exports.AppointOfficerRequest = zod_1.z
    .object({
    email: zod_1.z.string({ required_error: "Enter their email address." }).trim().toLowerCase().email("Enter their email address."),
    name: zod_1.z.string().trim().min(2, "Enter their full name.").max(120, "That name is too long.").nullable().optional(),
    role: primitives_1.OversightRole,
    governmentBodyCode: zod_1.z.string({ required_error: "Pick the government body." }).trim().min(1, "Pick the government body."),
    governmentTitle: zod_1.z
        .string({ required_error: "Give the title their institution uses." })
        .trim()
        .min(2, "Give the title their institution uses.")
        .max(200, "That title is too long."),
    scopeLevel: primitives_1.OversightScopeLevel,
    provinceId: PlaceId,
    districtId: PlaceId,
    sectorId: PlaceId,
    cellId: PlaceId,
    villageId: PlaceId,
    reason,
})
    .superRefine((v, ctx) => {
    const allowed = exports.OVERSIGHT_ROLE_SCOPES[v.role];
    if (!allowed.includes(v.scopeLevel)) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["scopeLevel"], message: "Pick an area at the level this role covers." });
        return;
    }
    const need = {
        country: null,
        province: ["provinceId", "Pick the province."],
        district: ["districtId", "Pick the district."],
        sector: ["sectorId", "Pick the sector."],
        cell: ["cellId", "Pick the cell."],
        village: ["villageId", "Pick the village."],
    };
    const required = need[v.scopeLevel];
    if (required && !v[required[0]])
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: [required[0]], message: required[1] });
});
/** Ending an appointment says why (`DELETE /admin/local-leaders/:id?reason=`). */
exports.EndAppointmentQuery = zod_1.z.object({ reason });
// --- Admin: coverage ----------------------------------------------------------------------
exports.LeaderCoverage = zod_1.z.object({
    generatedAt: zod_1.z.string(),
    roles: zod_1.z.array(zod_1.z.object({
        role: exports.LeaderRole,
        roleLabel: zod_1.z.string(),
        level: zod_1.z.enum(["village", "cell", "sector", "district", "province", "country"]),
        /** Every area of this level in Rwanda, and how many have someone in the post. */
        nationwide: zod_1.z.object({ areas: zod_1.z.number().int(), covered: zod_1.z.number().int() }),
        /** Areas with rented homes on Injishi, and how many have someone in the post. */
        withHomes: zod_1.z.object({ areas: zod_1.z.number().int(), covered: zod_1.z.number().int() }),
    })),
    /** Areas with rented homes and nobody in the post, most waiting guests first. */
    uncovered: zod_1.z.array(zod_1.z.object({
        role: exports.LeaderRole,
        roleLabel: zod_1.z.string(),
        level: zod_1.z.enum(["village", "cell", "sector", "district", "province", "country"]),
        area: zod_1.z.string(),
        provinceId: zod_1.z.number().int().nullable(),
        districtId: zod_1.z.number().int().nullable(),
        sectorId: zod_1.z.number().int().nullable(),
        cellId: zod_1.z.number().int().nullable(),
        villageId: zod_1.z.number().int().nullable(),
        names: exports.PlaceNames,
        homes: zod_1.z.number().int(),
        waitingReports: zod_1.z.number().int(),
    })),
    waiting: zod_1.z.array(exports.WaitingArea),
    /** Leaders with guests delivered who never opened one. */
    neverOpened: zod_1.z.array(zod_1.z.object({
        assignmentId: primitives_1.Uuid,
        name: zod_1.z.string().nullable(),
        email: zod_1.z.string(),
        role: exports.LeaderRole,
        roleLabel: zod_1.z.string(),
        area: zod_1.z.string(),
        delivered: zod_1.z.number().int(),
        firstDeliveredAt: zod_1.z.string(),
        grantedAt: zod_1.z.string(),
    })),
});
//# sourceMappingURL=guests.js.map