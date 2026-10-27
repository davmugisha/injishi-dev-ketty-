import { z } from "zod";
import { DepartmentCategory } from "./ops";
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
export declare const IsoDay: z.ZodString;
export type IsoDay = z.infer<typeof IsoDay>;
export declare const OwnerDashboardQuery: z.ZodObject<{
    /** The night the figures are for. Absent means tonight in Kigali. */
    date: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    date?: string | undefined;
}, {
    date?: string | undefined;
}>;
export type OwnerDashboardQuery = z.infer<typeof OwnerDashboardQuery>;
/** One night of rooms: what could be sold, what is held, and at what locked rate. */
export declare const OwnerNight: z.ZodObject<{
    /** Rooms the branch can sell: every room not out of service or in maintenance. */
    availableRooms: z.ZodNumber;
    /** Rooms a confirmed booking or an open walk in stay holds that night. */
    soldRooms: z.ZodNumber;
    /** The nightly rates locked on the bookings that hold them, tax exclusive. */
    roomRevenueRwf: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    availableRooms: number;
    soldRooms: number;
    roomRevenueRwf: number;
}, {
    availableRooms: number;
    soldRooms: number;
    roomRevenueRwf: number;
}>;
export type OwnerNight = z.infer<typeof OwnerNight>;
/** One branch, as the owner's Properties table reads it. */
export declare const OwnerBranchHealth: z.ZodObject<{
    propertyId: z.ZodString;
    name: z.ZodString;
    branchCode: z.ZodNullable<z.ZodString>;
    district: z.ZodNullable<z.ZodString>;
    /** Every room or unit of the branch, sellable or not. */
    roomCount: z.ZodNumber;
    tonight: z.ZodObject<{
        /** Rooms the branch can sell: every room not out of service or in maintenance. */
        availableRooms: z.ZodNumber;
        /** Rooms a confirmed booking or an open walk in stay holds that night. */
        soldRooms: z.ZodNumber;
        /** The nightly rates locked on the bookings that hold them, tax exclusive. */
        roomRevenueRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        availableRooms: number;
        soldRooms: number;
        roomRevenueRwf: number;
    }, {
        availableRooms: number;
        soldRooms: number;
        roomRevenueRwf: number;
    }>;
    /** Rooms out of order or in maintenance, plus housekeeping tasks marked blocked. */
    openExceptions: z.ZodNumber;
    /** Fiscal receipts of this branch still held or failed two hours after they were raised. */
    fiscalPendingOver2h: z.ZodNumber;
    /** Residence only: units under an active lease. Null for a hotel branch. */
    leasedUnits: z.ZodNullable<z.ZodNumber>;
    /** Residence only: leases with rent overdue. Null for a hotel branch. */
    leasesInArrears: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    district: string | null;
    name: string;
    roomCount: number;
    propertyId: string;
    branchCode: string | null;
    tonight: {
        availableRooms: number;
        soldRooms: number;
        roomRevenueRwf: number;
    };
    openExceptions: number;
    fiscalPendingOver2h: number;
    leasedUnits: number | null;
    leasesInArrears: number | null;
}, {
    district: string | null;
    name: string;
    roomCount: number;
    propertyId: string;
    branchCode: string | null;
    tonight: {
        availableRooms: number;
        soldRooms: number;
        roomRevenueRwf: number;
    };
    openExceptions: number;
    fiscalPendingOver2h: number;
    leasedUnits: number | null;
    leasesInArrears: number | null;
}>;
export type OwnerBranchHealth = z.infer<typeof OwnerBranchHealth>;
/**
 * `GET /api/v1/ops/dashboard/owner` (`money.view`): the business tonight.
 *
 * `paymentsMode` is the stack's payment adapter, read from the adapter itself:
 * `mock` means no bank or mobile money provider is connected for production,
 * whatever any screen says, and the owner's compliance panel must say so.
 */
export declare const OwnerDashboard: z.ZodObject<{
    date: z.ZodString;
    domain: z.ZodEnum<["hospitality", "residence"]>;
    legalName: z.ZodString;
    tin: z.ZodNullable<z.ZodString>;
    tonight: z.ZodObject<{
        /** Rooms the branch can sell: every room not out of service or in maintenance. */
        availableRooms: z.ZodNumber;
        /** Rooms a confirmed booking or an open walk in stay holds that night. */
        soldRooms: z.ZodNumber;
        /** The nightly rates locked on the bookings that hold them, tax exclusive. */
        roomRevenueRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        availableRooms: number;
        soldRooms: number;
        roomRevenueRwf: number;
    }, {
        availableRooms: number;
        soldRooms: number;
        roomRevenueRwf: number;
    }>;
    /** The same night one week earlier, for the trend. */
    sameNightLastWeek: z.ZodObject<{
        /** Rooms the branch can sell: every room not out of service or in maintenance. */
        availableRooms: z.ZodNumber;
        /** Rooms a confirmed booking or an open walk in stay holds that night. */
        soldRooms: z.ZodNumber;
        /** The nightly rates locked on the bookings that hold them, tax exclusive. */
        roomRevenueRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        availableRooms: number;
        soldRooms: number;
        roomRevenueRwf: number;
    }, {
        availableRooms: number;
        soldRooms: number;
        roomRevenueRwf: number;
    }>;
    /** Mobile money and card payments the provider confirmed today. */
    collectionsTodayRwf: z.ZodNumber;
    collectionsTodayCount: z.ZodNumber;
    /** What open bills still owe. */
    openFolioBalanceRwf: z.ZodNumber;
    openFoliosOwing: z.ZodNumber;
    /** Payment prompts sent and not yet answered by the provider. */
    unverifiedPaymentsRwf: z.ZodNumber;
    unverifiedPaymentsCount: z.ZodNumber;
    /** Fiscal receipts of the business held or failed for over two hours. */
    fiscalPendingOver2h: z.ZodNumber;
    paymentsMode: z.ZodUnion<[z.ZodEnum<["mock", "live"]>, z.ZodLiteral<"off">]>;
    branches: z.ZodArray<z.ZodObject<{
        propertyId: z.ZodString;
        name: z.ZodString;
        branchCode: z.ZodNullable<z.ZodString>;
        district: z.ZodNullable<z.ZodString>;
        /** Every room or unit of the branch, sellable or not. */
        roomCount: z.ZodNumber;
        tonight: z.ZodObject<{
            /** Rooms the branch can sell: every room not out of service or in maintenance. */
            availableRooms: z.ZodNumber;
            /** Rooms a confirmed booking or an open walk in stay holds that night. */
            soldRooms: z.ZodNumber;
            /** The nightly rates locked on the bookings that hold them, tax exclusive. */
            roomRevenueRwf: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            availableRooms: number;
            soldRooms: number;
            roomRevenueRwf: number;
        }, {
            availableRooms: number;
            soldRooms: number;
            roomRevenueRwf: number;
        }>;
        /** Rooms out of order or in maintenance, plus housekeeping tasks marked blocked. */
        openExceptions: z.ZodNumber;
        /** Fiscal receipts of this branch still held or failed two hours after they were raised. */
        fiscalPendingOver2h: z.ZodNumber;
        /** Residence only: units under an active lease. Null for a hotel branch. */
        leasedUnits: z.ZodNullable<z.ZodNumber>;
        /** Residence only: leases with rent overdue. Null for a hotel branch. */
        leasesInArrears: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        district: string | null;
        name: string;
        roomCount: number;
        propertyId: string;
        branchCode: string | null;
        tonight: {
            availableRooms: number;
            soldRooms: number;
            roomRevenueRwf: number;
        };
        openExceptions: number;
        fiscalPendingOver2h: number;
        leasedUnits: number | null;
        leasesInArrears: number | null;
    }, {
        district: string | null;
        name: string;
        roomCount: number;
        propertyId: string;
        branchCode: string | null;
        tonight: {
            availableRooms: number;
            soldRooms: number;
            roomRevenueRwf: number;
        };
        openExceptions: number;
        fiscalPendingOver2h: number;
        leasedUnits: number | null;
        leasesInArrears: number | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    date: string;
    legalName: string;
    domain: "hospitality" | "residence";
    tin: string | null;
    branches: {
        district: string | null;
        name: string;
        roomCount: number;
        propertyId: string;
        branchCode: string | null;
        tonight: {
            availableRooms: number;
            soldRooms: number;
            roomRevenueRwf: number;
        };
        openExceptions: number;
        fiscalPendingOver2h: number;
        leasedUnits: number | null;
        leasesInArrears: number | null;
    }[];
    tonight: {
        availableRooms: number;
        soldRooms: number;
        roomRevenueRwf: number;
    };
    fiscalPendingOver2h: number;
    sameNightLastWeek: {
        availableRooms: number;
        soldRooms: number;
        roomRevenueRwf: number;
    };
    collectionsTodayRwf: number;
    collectionsTodayCount: number;
    openFolioBalanceRwf: number;
    openFoliosOwing: number;
    unverifiedPaymentsRwf: number;
    unverifiedPaymentsCount: number;
    paymentsMode: "mock" | "live" | "off";
}, {
    date: string;
    legalName: string;
    domain: "hospitality" | "residence";
    tin: string | null;
    branches: {
        district: string | null;
        name: string;
        roomCount: number;
        propertyId: string;
        branchCode: string | null;
        tonight: {
            availableRooms: number;
            soldRooms: number;
            roomRevenueRwf: number;
        };
        openExceptions: number;
        fiscalPendingOver2h: number;
        leasedUnits: number | null;
        leasesInArrears: number | null;
    }[];
    tonight: {
        availableRooms: number;
        soldRooms: number;
        roomRevenueRwf: number;
    };
    fiscalPendingOver2h: number;
    sameNightLastWeek: {
        availableRooms: number;
        soldRooms: number;
        roomRevenueRwf: number;
    };
    collectionsTodayRwf: number;
    collectionsTodayCount: number;
    openFolioBalanceRwf: number;
    openFoliosOwing: number;
    unverifiedPaymentsRwf: number;
    unverifiedPaymentsCount: number;
    paymentsMode: "mock" | "live" | "off";
}>;
export type OwnerDashboard = z.infer<typeof OwnerDashboard>;
/** `from` inclusive, `to` exclusive, at most 92 days. */
export declare const OperatorRevenueDailyQuery: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
}, "strip", z.ZodTypeAny, {
    from: string;
    to: string;
}, {
    from: string;
    to: string;
}>, {
    from: string;
    to: string;
}, {
    from: string;
    to: string;
}>, {
    from: string;
    to: string;
}, {
    from: string;
    to: string;
}>;
export type OperatorRevenueDailyQuery = z.infer<typeof OperatorRevenueDailyQuery>;
/** One day's takings by USALI group, net of voids, tax exclusive. */
export declare const OperatorRevenueDay: z.ZodObject<{
    date: z.ZodString;
    /** Departments of category `rooms`. */
    roomsRwf: z.ZodNumber;
    /** Departments of category `fnb`. */
    foodBeverageRwf: z.ZodNumber;
    /** Every other revenue centre. */
    otherRwf: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    date: string;
    roomsRwf: number;
    foodBeverageRwf: number;
    otherRwf: number;
}, {
    date: string;
    roomsRwf: number;
    foodBeverageRwf: number;
    otherRwf: number;
}>;
export type OperatorRevenueDay = z.infer<typeof OperatorRevenueDay>;
/**
 * `GET /api/v1/ops/revenue/daily` (`money.view`). Every day of the range is
 * listed, at zero when nothing was earned: a quiet day is a fact, not a gap.
 */
export declare const OperatorRevenueDaily: z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
    days: z.ZodArray<z.ZodObject<{
        date: z.ZodString;
        /** Departments of category `rooms`. */
        roomsRwf: z.ZodNumber;
        /** Departments of category `fnb`. */
        foodBeverageRwf: z.ZodNumber;
        /** Every other revenue centre. */
        otherRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        date: string;
        roomsRwf: number;
        foodBeverageRwf: number;
        otherRwf: number;
    }, {
        date: string;
        roomsRwf: number;
        foodBeverageRwf: number;
        otherRwf: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    from: string;
    to: string;
    days: {
        date: string;
        roomsRwf: number;
        foodBeverageRwf: number;
        otherRwf: number;
    }[];
}, {
    from: string;
    to: string;
    days: {
        date: string;
        roomsRwf: number;
        foodBeverageRwf: number;
        otherRwf: number;
    }[];
}>;
export type OperatorRevenueDaily = z.infer<typeof OperatorRevenueDaily>;
/** Which categories the daily read groups as rooms and as food and beverage. */
export declare const REVENUE_DAY_GROUP: Readonly<Record<DepartmentCategory, "rooms" | "fnb" | "other">>;
/** `from` inclusive, `to` exclusive, at most 366 nights. */
export declare const OperatorPerformanceQuery: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
}, "strip", z.ZodTypeAny, {
    from: string;
    to: string;
}, {
    from: string;
    to: string;
}>, {
    from: string;
    to: string;
}, {
    from: string;
    to: string;
}>, {
    from: string;
    to: string;
}, {
    from: string;
    to: string;
}>;
export type OperatorPerformanceQuery = z.infer<typeof OperatorPerformanceQuery>;
/** One branch over a window of nights. The rates are the screen's to divide. */
export declare const OperatorPerformanceBranch: z.ZodObject<{
    propertyId: z.ZodString;
    name: z.ZodString;
    branchCode: z.ZodNullable<z.ZodString>;
    /**
     * Sellable rooms times nights. Rooms are counted as they stand today: a
     * room's out of service history is not kept, so a past night counts it as
     * the room rack shows it now.
     */
    availableNights: z.ZodNumber;
    /** Nights a confirmed booking or an open walk in stay held a room. */
    soldNights: z.ZodNumber;
    /** Posted room charges by business date, net of voids, tax exclusive. */
    roomRevenueRwf: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    propertyId: string;
    branchCode: string | null;
    roomRevenueRwf: number;
    availableNights: number;
    soldNights: number;
}, {
    name: string;
    propertyId: string;
    branchCode: string | null;
    roomRevenueRwf: number;
    availableNights: number;
    soldNights: number;
}>;
export type OperatorPerformanceBranch = z.infer<typeof OperatorPerformanceBranch>;
export declare const OperatorPerformanceWindow: z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
    branches: z.ZodArray<z.ZodObject<{
        propertyId: z.ZodString;
        name: z.ZodString;
        branchCode: z.ZodNullable<z.ZodString>;
        /**
         * Sellable rooms times nights. Rooms are counted as they stand today: a
         * room's out of service history is not kept, so a past night counts it as
         * the room rack shows it now.
         */
        availableNights: z.ZodNumber;
        /** Nights a confirmed booking or an open walk in stay held a room. */
        soldNights: z.ZodNumber;
        /** Posted room charges by business date, net of voids, tax exclusive. */
        roomRevenueRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        propertyId: string;
        branchCode: string | null;
        roomRevenueRwf: number;
        availableNights: number;
        soldNights: number;
    }, {
        name: string;
        propertyId: string;
        branchCode: string | null;
        roomRevenueRwf: number;
        availableNights: number;
        soldNights: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    branches: {
        name: string;
        propertyId: string;
        branchCode: string | null;
        roomRevenueRwf: number;
        availableNights: number;
        soldNights: number;
    }[];
    from: string;
    to: string;
}, {
    branches: {
        name: string;
        propertyId: string;
        branchCode: string | null;
        roomRevenueRwf: number;
        availableNights: number;
        soldNights: number;
    }[];
    from: string;
    to: string;
}>;
export type OperatorPerformanceWindow = z.infer<typeof OperatorPerformanceWindow>;
/**
 * `GET /api/v1/ops/reports/performance` (`money.view`): the window asked for,
 * and the same dates one year earlier. Hospitality branches only: a residence
 * is measured by leases, not nights.
 */
export declare const OperatorPerformance: z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
    branches: z.ZodArray<z.ZodObject<{
        propertyId: z.ZodString;
        name: z.ZodString;
        branchCode: z.ZodNullable<z.ZodString>;
        /**
         * Sellable rooms times nights. Rooms are counted as they stand today: a
         * room's out of service history is not kept, so a past night counts it as
         * the room rack shows it now.
         */
        availableNights: z.ZodNumber;
        /** Nights a confirmed booking or an open walk in stay held a room. */
        soldNights: z.ZodNumber;
        /** Posted room charges by business date, net of voids, tax exclusive. */
        roomRevenueRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        propertyId: string;
        branchCode: string | null;
        roomRevenueRwf: number;
        availableNights: number;
        soldNights: number;
    }, {
        name: string;
        propertyId: string;
        branchCode: string | null;
        roomRevenueRwf: number;
        availableNights: number;
        soldNights: number;
    }>, "many">;
} & {
    lastYear: z.ZodObject<{
        from: z.ZodString;
        to: z.ZodString;
        branches: z.ZodArray<z.ZodObject<{
            propertyId: z.ZodString;
            name: z.ZodString;
            branchCode: z.ZodNullable<z.ZodString>;
            /**
             * Sellable rooms times nights. Rooms are counted as they stand today: a
             * room's out of service history is not kept, so a past night counts it as
             * the room rack shows it now.
             */
            availableNights: z.ZodNumber;
            /** Nights a confirmed booking or an open walk in stay held a room. */
            soldNights: z.ZodNumber;
            /** Posted room charges by business date, net of voids, tax exclusive. */
            roomRevenueRwf: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            name: string;
            propertyId: string;
            branchCode: string | null;
            roomRevenueRwf: number;
            availableNights: number;
            soldNights: number;
        }, {
            name: string;
            propertyId: string;
            branchCode: string | null;
            roomRevenueRwf: number;
            availableNights: number;
            soldNights: number;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        branches: {
            name: string;
            propertyId: string;
            branchCode: string | null;
            roomRevenueRwf: number;
            availableNights: number;
            soldNights: number;
        }[];
        from: string;
        to: string;
    }, {
        branches: {
            name: string;
            propertyId: string;
            branchCode: string | null;
            roomRevenueRwf: number;
            availableNights: number;
            soldNights: number;
        }[];
        from: string;
        to: string;
    }>;
}, "strip", z.ZodTypeAny, {
    branches: {
        name: string;
        propertyId: string;
        branchCode: string | null;
        roomRevenueRwf: number;
        availableNights: number;
        soldNights: number;
    }[];
    from: string;
    to: string;
    lastYear: {
        branches: {
            name: string;
            propertyId: string;
            branchCode: string | null;
            roomRevenueRwf: number;
            availableNights: number;
            soldNights: number;
        }[];
        from: string;
        to: string;
    };
}, {
    branches: {
        name: string;
        propertyId: string;
        branchCode: string | null;
        roomRevenueRwf: number;
        availableNights: number;
        soldNights: number;
    }[];
    from: string;
    to: string;
    lastYear: {
        branches: {
            name: string;
            propertyId: string;
            branchCode: string | null;
            roomRevenueRwf: number;
            availableNights: number;
            soldNights: number;
        }[];
        from: string;
        to: string;
    };
}>;
export type OperatorPerformance = z.infer<typeof OperatorPerformance>;
export declare const OrgCertificateStatus: z.ZodEnum<["requested", "on_file"]>;
export type OrgCertificateStatus = z.infer<typeof OrgCertificateStatus>;
/** One document the business keeps about itself or one of its branches. */
export declare const OperatorCertificate: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<["rdb_grade", "tourism_license", "tax_clearance", "fire_safety", "health_inspection", "other", "rdb_certificate", "psf_certificate", "land_title", "franchise_agreement"]>;
    /** What an `other` document is ("EAC grade"); null for the named kinds. */
    kindOther: z.ZodNullable<z.ZodString>;
    /** The branch it is about, or null when it is about the business. */
    propertyId: z.ZodNullable<z.ZodString>;
    propertyName: z.ZodNullable<z.ZodString>;
    certificateNumber: z.ZodNullable<z.ZodString>;
    issuedBy: z.ZodNullable<z.ZodString>;
    issuedOn: z.ZodNullable<z.ZodString>;
    expiresOn: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["requested", "on_file"]>;
    followUp: z.ZodNullable<z.ZodString>;
    /** The stored copy's file name, or null when no copy is on file. */
    fileName: z.ZodNullable<z.ZodString>;
    verifiedAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "requested" | "on_file";
    kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
    kindOther: string | null;
    certificateNumber: string | null;
    issuedBy: string | null;
    issuedOn: string | null;
    expiresOn: string | null;
    id: string;
    createdAt: string;
    propertyName: string | null;
    propertyId: string | null;
    verifiedAt: string | null;
    followUp: string | null;
    fileName: string | null;
}, {
    status: "requested" | "on_file";
    kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
    kindOther: string | null;
    certificateNumber: string | null;
    issuedBy: string | null;
    issuedOn: string | null;
    expiresOn: string | null;
    id: string;
    createdAt: string;
    propertyName: string | null;
    propertyId: string | null;
    verifiedAt: string | null;
    followUp: string | null;
    fileName: string | null;
}>;
export type OperatorCertificate = z.infer<typeof OperatorCertificate>;
/** `GET /api/v1/ops/certificates`: the business's documents, soonest expiry first. */
export declare const OperatorCertificateList: z.ZodObject<{
    legalName: z.ZodString;
    tin: z.ZodNullable<z.ZodString>;
    /**
     * What the business declared at registration about the Rwanda Chamber of
     * Tourism. A declaration, not a verified membership: no application or
     * certificate row exists for it.
     */
    chamberOfTourismMember: z.ZodBoolean;
    certificates: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<["rdb_grade", "tourism_license", "tax_clearance", "fire_safety", "health_inspection", "other", "rdb_certificate", "psf_certificate", "land_title", "franchise_agreement"]>;
        /** What an `other` document is ("EAC grade"); null for the named kinds. */
        kindOther: z.ZodNullable<z.ZodString>;
        /** The branch it is about, or null when it is about the business. */
        propertyId: z.ZodNullable<z.ZodString>;
        propertyName: z.ZodNullable<z.ZodString>;
        certificateNumber: z.ZodNullable<z.ZodString>;
        issuedBy: z.ZodNullable<z.ZodString>;
        issuedOn: z.ZodNullable<z.ZodString>;
        expiresOn: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["requested", "on_file"]>;
        followUp: z.ZodNullable<z.ZodString>;
        /** The stored copy's file name, or null when no copy is on file. */
        fileName: z.ZodNullable<z.ZodString>;
        verifiedAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "requested" | "on_file";
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        kindOther: string | null;
        certificateNumber: string | null;
        issuedBy: string | null;
        issuedOn: string | null;
        expiresOn: string | null;
        id: string;
        createdAt: string;
        propertyName: string | null;
        propertyId: string | null;
        verifiedAt: string | null;
        followUp: string | null;
        fileName: string | null;
    }, {
        status: "requested" | "on_file";
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        kindOther: string | null;
        certificateNumber: string | null;
        issuedBy: string | null;
        issuedOn: string | null;
        expiresOn: string | null;
        id: string;
        createdAt: string;
        propertyName: string | null;
        propertyId: string | null;
        verifiedAt: string | null;
        followUp: string | null;
        fileName: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    legalName: string;
    certificates: {
        status: "requested" | "on_file";
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        kindOther: string | null;
        certificateNumber: string | null;
        issuedBy: string | null;
        issuedOn: string | null;
        expiresOn: string | null;
        id: string;
        createdAt: string;
        propertyName: string | null;
        propertyId: string | null;
        verifiedAt: string | null;
        followUp: string | null;
        fileName: string | null;
    }[];
    tin: string | null;
    chamberOfTourismMember: boolean;
}, {
    legalName: string;
    certificates: {
        status: "requested" | "on_file";
        kind: "other" | "rdb_grade" | "tourism_license" | "tax_clearance" | "fire_safety" | "health_inspection" | "rdb_certificate" | "psf_certificate" | "land_title" | "franchise_agreement";
        kindOther: string | null;
        certificateNumber: string | null;
        issuedBy: string | null;
        issuedOn: string | null;
        expiresOn: string | null;
        id: string;
        createdAt: string;
        propertyName: string | null;
        propertyId: string | null;
        verifiedAt: string | null;
        followUp: string | null;
        fileName: string | null;
    }[];
    tin: string | null;
    chamberOfTourismMember: boolean;
}>;
export type OperatorCertificateList = z.infer<typeof OperatorCertificateList>;
//# sourceMappingURL=owner.d.ts.map