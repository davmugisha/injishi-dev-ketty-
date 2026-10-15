import { z } from "zod";
import { DepartmentCategory } from "./ops";
import { AdapterMode, Domain, Uuid } from "./primitives";
import { OrgCertificateKind } from "./registration";

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
export const IsoDay = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "A day is YYYY-MM-DD.");
export type IsoDay = z.infer<typeof IsoDay>;

// ---------------------------------------------------------------------------
// The owner's dashboard
// ---------------------------------------------------------------------------

export const OwnerDashboardQuery = z.object({
    /** The night the figures are for. Absent means tonight in Kigali. */
    date: IsoDay.optional(),
});
export type OwnerDashboardQuery = z.infer<typeof OwnerDashboardQuery>;

/** One night of rooms: what could be sold, what is held, and at what locked rate. */
export const OwnerNight = z.object({
    /** Rooms the branch can sell: every room not out of service or in maintenance. */
    availableRooms: z.number().int().nonnegative(),
    /** Rooms a confirmed booking or an open walk in stay holds that night. */
    soldRooms: z.number().int().nonnegative(),
    /** The nightly rates locked on the bookings that hold them, tax exclusive. */
    roomRevenueRwf: z.number().int().nonnegative(),
});
export type OwnerNight = z.infer<typeof OwnerNight>;

/** One branch, as the owner's Properties table reads it. */
export const OwnerBranchHealth = z.object({
    propertyId: Uuid,
    name: z.string(),
    branchCode: z.string().nullable(),
    district: z.string().nullable(),
    /** Every room or unit of the branch, sellable or not. */
    roomCount: z.number().int().nonnegative(),
    tonight: OwnerNight,
    /** Rooms out of order or in maintenance, plus housekeeping tasks marked blocked. */
    openExceptions: z.number().int().nonnegative(),
    /** Fiscal receipts of this branch still held or failed two hours after they were raised. */
    fiscalPendingOver2h: z.number().int().nonnegative(),
    /** Residence only: units under an active lease. Null for a hotel branch. */
    leasedUnits: z.number().int().nonnegative().nullable(),
    /** Residence only: leases with rent overdue. Null for a hotel branch. */
    leasesInArrears: z.number().int().nonnegative().nullable(),
});
export type OwnerBranchHealth = z.infer<typeof OwnerBranchHealth>;

/**
 * `GET /api/v1/ops/dashboard/owner` (`money.view`): the business tonight.
 *
 * `paymentsMode` is the stack's payment adapter, read from the adapter itself:
 * `mock` means no bank or mobile money provider is connected for production,
 * whatever any screen says, and the owner's compliance panel must say so.
 */
export const OwnerDashboard = z.object({
    date: IsoDay,
    domain: Domain,
    legalName: z.string(),
    tin: z.string().nullable(),
    tonight: OwnerNight,
    /** The same night one week earlier, for the trend. */
    sameNightLastWeek: OwnerNight,
    /** Mobile money and card payments the provider confirmed today. */
    collectionsTodayRwf: z.number().int().nonnegative(),
    collectionsTodayCount: z.number().int().nonnegative(),
    /** What open bills still owe. */
    openFolioBalanceRwf: z.number().int(),
    openFoliosOwing: z.number().int().nonnegative(),
    /** Payment prompts sent and not yet answered by the provider. */
    unverifiedPaymentsRwf: z.number().int().nonnegative(),
    unverifiedPaymentsCount: z.number().int().nonnegative(),
    /** Fiscal receipts of the business held or failed for over two hours. */
    fiscalPendingOver2h: z.number().int().nonnegative(),
    paymentsMode: z.union([AdapterMode, z.literal("off")]),
    branches: z.array(OwnerBranchHealth),
});
export type OwnerDashboard = z.infer<typeof OwnerDashboard>;

// ---------------------------------------------------------------------------
// Revenue by day
// ---------------------------------------------------------------------------

/** `from` inclusive, `to` exclusive, at most 92 days. */
export const OperatorRevenueDailyQuery = z
    .object({ from: IsoDay, to: IsoDay })
    .refine((q) => q.from < q.to, { message: "`from` must be before `to`." })
    .refine((q) => (Date.parse(q.to) - Date.parse(q.from)) / 86_400_000 <= 92, {
        message: "Ask for 92 days or fewer.",
    });
export type OperatorRevenueDailyQuery = z.infer<typeof OperatorRevenueDailyQuery>;

/** One day's takings by USALI group, net of voids, tax exclusive. */
export const OperatorRevenueDay = z.object({
    date: IsoDay,
    /** Departments of category `rooms`. */
    roomsRwf: z.number().int(),
    /** Departments of category `fnb`. */
    foodBeverageRwf: z.number().int(),
    /** Every other revenue centre. */
    otherRwf: z.number().int(),
});
export type OperatorRevenueDay = z.infer<typeof OperatorRevenueDay>;

/**
 * `GET /api/v1/ops/revenue/daily` (`money.view`). Every day of the range is
 * listed, at zero when nothing was earned: a quiet day is a fact, not a gap.
 */
export const OperatorRevenueDaily = z.object({
    from: IsoDay,
    to: IsoDay,
    days: z.array(OperatorRevenueDay),
});
export type OperatorRevenueDaily = z.infer<typeof OperatorRevenueDaily>;

/** Which categories the daily read groups as rooms and as food and beverage. */
export const REVENUE_DAY_GROUP: Readonly<Record<DepartmentCategory, "rooms" | "fnb" | "other">> = {
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
export const OperatorPerformanceQuery = z
    .object({ from: IsoDay, to: IsoDay })
    .refine((q) => q.from < q.to, { message: "`from` must be before `to`." })
    .refine((q) => (Date.parse(q.to) - Date.parse(q.from)) / 86_400_000 <= 366, {
        message: "Ask for 366 nights or fewer.",
    });
export type OperatorPerformanceQuery = z.infer<typeof OperatorPerformanceQuery>;

/** One branch over a window of nights. The rates are the screen's to divide. */
export const OperatorPerformanceBranch = z.object({
    propertyId: Uuid,
    name: z.string(),
    branchCode: z.string().nullable(),
    /**
     * Sellable rooms times nights. Rooms are counted as they stand today: a
     * room's out of service history is not kept, so a past night counts it as
     * the room rack shows it now.
     */
    availableNights: z.number().int().nonnegative(),
    /** Nights a confirmed booking or an open walk in stay held a room. */
    soldNights: z.number().int().nonnegative(),
    /** Posted room charges by business date, net of voids, tax exclusive. */
    roomRevenueRwf: z.number().int(),
});
export type OperatorPerformanceBranch = z.infer<typeof OperatorPerformanceBranch>;

export const OperatorPerformanceWindow = z.object({
    from: IsoDay,
    to: IsoDay,
    branches: z.array(OperatorPerformanceBranch),
});
export type OperatorPerformanceWindow = z.infer<typeof OperatorPerformanceWindow>;

/**
 * `GET /api/v1/ops/reports/performance` (`money.view`): the window asked for,
 * and the same dates one year earlier. Hospitality branches only: a residence
 * is measured by leases, not nights.
 */
export const OperatorPerformance = OperatorPerformanceWindow.extend({
    lastYear: OperatorPerformanceWindow,
});
export type OperatorPerformance = z.infer<typeof OperatorPerformance>;

// ---------------------------------------------------------------------------
// Licences and registrations on file
// ---------------------------------------------------------------------------

export const OrgCertificateStatus = z.enum(["requested", "on_file"]);
export type OrgCertificateStatus = z.infer<typeof OrgCertificateStatus>;

/** One document the business keeps about itself or one of its branches. */
export const OperatorCertificate = z.object({
    id: Uuid,
    kind: OrgCertificateKind,
    /** What an `other` document is ("EAC grade"); null for the named kinds. */
    kindOther: z.string().nullable(),
    /** The branch it is about, or null when it is about the business. */
    propertyId: Uuid.nullable(),
    propertyName: z.string().nullable(),
    certificateNumber: z.string().nullable(),
    issuedBy: z.string().nullable(),
    issuedOn: IsoDay.nullable(),
    expiresOn: IsoDay.nullable(),
    status: OrgCertificateStatus,
    followUp: z.string().nullable(),
    /** The stored copy's file name, or null when no copy is on file. */
    fileName: z.string().nullable(),
    verifiedAt: z.string().nullable(),
    createdAt: z.string(),
});
export type OperatorCertificate = z.infer<typeof OperatorCertificate>;

/** `GET /api/v1/ops/certificates`: the business's documents, soonest expiry first. */
export const OperatorCertificateList = z.object({
    legalName: z.string(),
    tin: z.string().nullable(),
    /**
     * What the business declared at registration about the Rwanda Chamber of
     * Tourism. A declaration, not a verified membership: no application or
     * certificate row exists for it.
     */
    chamberOfTourismMember: z.boolean(),
    certificates: z.array(OperatorCertificate),
});
export type OperatorCertificateList = z.infer<typeof OperatorCertificateList>;
