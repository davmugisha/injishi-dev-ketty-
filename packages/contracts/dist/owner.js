"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperatorCertificateList = exports.OperatorCertificate = exports.OrgCertificateStatus = exports.OperatorPerformance = exports.OperatorPerformanceWindow = exports.OperatorPerformanceBranch = exports.OperatorPerformanceQuery = exports.REVENUE_DAY_GROUP = exports.OperatorRevenueDaily = exports.OperatorRevenueDay = exports.OperatorRevenueDailyQuery = exports.OwnerDashboard = exports.OwnerBranchHealth = exports.OwnerNight = exports.OwnerDashboardQuery = exports.IsoDay = void 0;
const zod_1 = require("zod");
const primitives_1 = require("./primitives");
const registration_1 = require("./registration");
/**
 * The owner's reads (`/api/v1/ops/dashboard/owner`, `/ops/revenue/daily`,
 * `/ops/reports/performance`, `/ops/certificates`): how the business is doing,
 * read off the records it already keeps.
 *
 * EVERY FIGURE HERE IS A SUM OF ROWS, never a stored number. Occupancy counts
 * the rooms a confirmed booking or an open stay holds; revenue sums the posted
 * charges, net of voids; a licence is expiring because of its `expires_on`. A
 * total kept in a column would be a second truth that drifts from the first.
 *
 * Money is whole francs, tax exclusive, as the folio posts it. There is no
 * expense ledger, so nothing here carries a cost, a margin or a profit.
 */
/** A Kigali calendar day, `YYYY-MM-DD`. */
exports.IsoDay = zod_1.z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "A day is YYYY-MM-DD.");
// ---------------------------------------------------------------------------
// The owner's dashboard
// ---------------------------------------------------------------------------
exports.OwnerDashboardQuery = zod_1.z.object({
    /** The night the figures are for. Absent means tonight in Kigali. */
    date: exports.IsoDay.optional(),
});
/** One night of rooms: what could be sold, what is held, and at what locked rate. */
exports.OwnerNight = zod_1.z.object({
    /** Rooms the branch can sell: every room not out of service or in maintenance. */
    availableRooms: zod_1.z.number().int().nonnegative(),
    /** Rooms a confirmed booking or an open walk in stay holds that night. */
    soldRooms: zod_1.z.number().int().nonnegative(),
    /** The nightly rates locked on the bookings that hold them, tax exclusive. */
    roomRevenueRwf: zod_1.z.number().int().nonnegative(),
});
/** One branch, as the owner's Properties table reads it. */
exports.OwnerBranchHealth = zod_1.z.object({
    propertyId: primitives_1.Uuid,
    name: zod_1.z.string(),
    branchCode: zod_1.z.string().nullable(),
    district: zod_1.z.string().nullable(),
    /** Every room or unit of the branch, sellable or not. */
    roomCount: zod_1.z.number().int().nonnegative(),
    tonight: exports.OwnerNight,
    /** Rooms out of order or in maintenance, plus housekeeping tasks marked blocked. */
    openExceptions: zod_1.z.number().int().nonnegative(),
    /** Fiscal receipts of this branch still held or failed two hours after they were raised. */
    fiscalPendingOver2h: zod_1.z.number().int().nonnegative(),
    /** Residence only: units under an active lease. Null for a hotel branch. */
    leasedUnits: zod_1.z.number().int().nonnegative().nullable(),
    /** Residence only: leases with rent overdue. Null for a hotel branch. */
    leasesInArrears: zod_1.z.number().int().nonnegative().nullable(),
});
/**
 * `GET /api/v1/ops/dashboard/owner` (`money.view`): the business tonight.
 *
 * `paymentsMode` is the stack's payment adapter, read from the adapter itself:
 * `mock` means no bank or mobile money provider is connected for production,
 * whatever any screen says, and the owner's compliance panel must say so.
 */
exports.OwnerDashboard = zod_1.z.object({
    date: exports.IsoDay,
    domain: primitives_1.Domain,
    legalName: zod_1.z.string(),
    tin: zod_1.z.string().nullable(),
    tonight: exports.OwnerNight,
    /** The same night one week earlier, for the trend. */
    sameNightLastWeek: exports.OwnerNight,
    /** Mobile money and card payments the provider confirmed today. */
    collectionsTodayRwf: zod_1.z.number().int().nonnegative(),
    collectionsTodayCount: zod_1.z.number().int().nonnegative(),
    /** What open bills still owe. */
    openFolioBalanceRwf: zod_1.z.number().int(),
    openFoliosOwing: zod_1.z.number().int().nonnegative(),
    /** Payment prompts sent and not yet answered by the provider. */
    unverifiedPaymentsRwf: zod_1.z.number().int().nonnegative(),
    unverifiedPaymentsCount: zod_1.z.number().int().nonnegative(),
    /** Fiscal receipts of the business held or failed for over two hours. */
    fiscalPendingOver2h: zod_1.z.number().int().nonnegative(),
    paymentsMode: zod_1.z.union([primitives_1.AdapterMode, zod_1.z.literal("off")]),
    branches: zod_1.z.array(exports.OwnerBranchHealth),
});
// ---------------------------------------------------------------------------
// Revenue by day
// ---------------------------------------------------------------------------
/** `from` inclusive, `to` exclusive, at most 92 days. */
exports.OperatorRevenueDailyQuery = zod_1.z
    .object({ from: exports.IsoDay, to: exports.IsoDay })
    .refine((q) => q.from < q.to, { message: "`from` must be before `to`." })
    .refine((q) => (Date.parse(q.to) - Date.parse(q.from)) / 86400000 <= 92, {
    message: "Ask for 92 days or fewer.",
});
/** One day's takings by USALI group, net of voids, tax exclusive. */
exports.OperatorRevenueDay = zod_1.z.object({
    date: exports.IsoDay,
    /** Departments of category `rooms`. */
    roomsRwf: zod_1.z.number().int(),
    /** Departments of category `fnb`. */
    foodBeverageRwf: zod_1.z.number().int(),
    /** Every other revenue centre. */
    otherRwf: zod_1.z.number().int(),
});
/**
 * `GET /api/v1/ops/revenue/daily` (`money.view`). Every day of the range is
 * listed, at zero when nothing was earned: a quiet day is a fact, not a gap.
 */
exports.OperatorRevenueDaily = zod_1.z.object({
    from: exports.IsoDay,
    to: exports.IsoDay,
    days: zod_1.z.array(exports.OperatorRevenueDay),
});
/** Which categories the daily read groups as rooms and as food and beverage. */
exports.REVENUE_DAY_GROUP = {
    rooms: "rooms",
    fnb: "fnb",
    spa_recreation: "other",
    other_operated: "other",
    misc_income: "other",
    admin_general: "other",
    sales_marketing: "other",
    it: "other",
    engineering: "other",
    utilities: "other",
    hr: "other",
};
// ---------------------------------------------------------------------------
// Performance (occupancy, ADR, RevPAR) per branch
// ---------------------------------------------------------------------------
/** `from` inclusive, `to` exclusive, at most 366 nights. */
exports.OperatorPerformanceQuery = zod_1.z
    .object({ from: exports.IsoDay, to: exports.IsoDay })
    .refine((q) => q.from < q.to, { message: "`from` must be before `to`." })
    .refine((q) => (Date.parse(q.to) - Date.parse(q.from)) / 86400000 <= 366, {
    message: "Ask for 366 nights or fewer.",
});
/** One branch over a window of nights. The rates are the screen's to divide. */
exports.OperatorPerformanceBranch = zod_1.z.object({
    propertyId: primitives_1.Uuid,
    name: zod_1.z.string(),
    branchCode: zod_1.z.string().nullable(),
    /**
     * Sellable rooms times nights. Rooms are counted as they stand today: a
     * room's out of service history is not kept, so a past night counts it as
     * the room rack shows it now.
     */
    availableNights: zod_1.z.number().int().nonnegative(),
    /** Nights a confirmed booking or an open walk in stay held a room. */
    soldNights: zod_1.z.number().int().nonnegative(),
    /** Posted room charges by business date, net of voids, tax exclusive. */
    roomRevenueRwf: zod_1.z.number().int(),
});
exports.OperatorPerformanceWindow = zod_1.z.object({
    from: exports.IsoDay,
    to: exports.IsoDay,
    branches: zod_1.z.array(exports.OperatorPerformanceBranch),
});
/**
 * `GET /api/v1/ops/reports/performance` (`money.view`): the window asked for,
 * and the same dates one year earlier. Hospitality branches only: a residence
 * is measured by leases, not nights.
 */
exports.OperatorPerformance = exports.OperatorPerformanceWindow.extend({
    lastYear: exports.OperatorPerformanceWindow,
});
// ---------------------------------------------------------------------------
// Licences and registrations on file
// ---------------------------------------------------------------------------
exports.OrgCertificateStatus = zod_1.z.enum(["requested", "on_file"]);
/** One document the business keeps about itself or one of its branches. */
exports.OperatorCertificate = zod_1.z.object({
    id: primitives_1.Uuid,
    kind: registration_1.OrgCertificateKind,
    /** What an `other` document is ("EAC grade"); null for the named kinds. */
    kindOther: zod_1.z.string().nullable(),
    /** The branch it is about, or null when it is about the business. */
    propertyId: primitives_1.Uuid.nullable(),
    propertyName: zod_1.z.string().nullable(),
    certificateNumber: zod_1.z.string().nullable(),
    issuedBy: zod_1.z.string().nullable(),
    issuedOn: exports.IsoDay.nullable(),
    expiresOn: exports.IsoDay.nullable(),
    status: exports.OrgCertificateStatus,
    followUp: zod_1.z.string().nullable(),
    /** The stored copy's file name, or null when no copy is on file. */
    fileName: zod_1.z.string().nullable(),
    verifiedAt: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
});
/** `GET /api/v1/ops/certificates`: the business's documents, soonest expiry first. */
exports.OperatorCertificateList = zod_1.z.object({
    legalName: zod_1.z.string(),
    tin: zod_1.z.string().nullable(),
    /**
     * What the business declared at registration about the Rwanda Chamber of
     * Tourism. A declaration, not a verified membership: no application or
     * certificate row exists for it.
     */
    chamberOfTourismMember: zod_1.z.boolean(),
    certificates: zod_1.z.array(exports.OperatorCertificate),
});
//# sourceMappingURL=owner.js.map