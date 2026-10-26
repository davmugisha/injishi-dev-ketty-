import { z } from "zod";
/**
 * The broker's own surface (ADR-038 child 6, `/api/v1/ops/broker/*`).
 *
 * A broker workspace belongs to one person and runs no departments, so none of
 * these shapes carries a permission. What they carry instead is the answer to
 * the three questions the broker screens ask: which residence units can I place
 * a tenant in, what did revealing a landlord cost me, and what has the work
 * earned.
 *
 * Two departures from the child 6 spec, both the schema's call:
 *
 *   - A placement is `initiated | converted | abandoned | unavailable`
 *     (`placement_status`), not the spec's `viewing -> offer -> placed`. A
 *     placement converts when the landlord records the broker on a lease
 *     (FL19); the broker has no step to advance in between.
 *   - A reveal buys a LISTING's contact, not a unit's. `contact_reveals` keys on
 *     `listing_id`, and a property has one contact however many unit types it
 *     lets, so every unit card on that listing opens together.
 */
/**
 * The landlord contact a broker paid for, as it stood when they paid.
 *
 * A snapshot, never a join: a landlord who changes their number later has not
 * changed what the broker was sold. Absent entirely until revealed; the server
 * sends no masked string for a client to unmask.
 */
export declare const BrokerContact: z.ZodObject<{
    phone: z.ZodNullable<z.ZodString>;
    email: z.ZodNullable<z.ZodString>;
    revealedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string | null;
    revealedAt: string;
    phone: string | null;
}, {
    email: string | null;
    revealedAt: string;
    phone: string | null;
}>;
export type BrokerContact = z.infer<typeof BrokerContact>;
/** One unit type on a listing, and how many of its rooms have no active lease. */
export declare const BrokerDirectoryUnit: z.ZodObject<{
    roomTypeId: z.ZodString;
    name: z.ZodString;
    monthlyRentRwf: z.ZodNullable<z.ZodNumber>;
    cautionRwf: z.ZodNullable<z.ZodNumber>;
    vacantUnits: z.ZodNumber;
    totalUnits: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    roomTypeId: string;
    monthlyRentRwf: number | null;
    cautionRwf: number | null;
    vacantUnits: number;
    totalUnits: number;
}, {
    name: string;
    roomTypeId: string;
    monthlyRentRwf: number | null;
    cautionRwf: number | null;
    vacantUnits: number;
    totalUnits: number;
}>;
export type BrokerDirectoryUnit = z.infer<typeof BrokerDirectoryUnit>;
export declare const BrokerDirectoryListing: z.ZodObject<{
    listingId: z.ZodString;
    propertyName: z.ZodString;
    landlordName: z.ZodString;
    district: z.ZodNullable<z.ZodString>;
    units: z.ZodArray<z.ZodObject<{
        roomTypeId: z.ZodString;
        name: z.ZodString;
        monthlyRentRwf: z.ZodNullable<z.ZodNumber>;
        cautionRwf: z.ZodNullable<z.ZodNumber>;
        vacantUnits: z.ZodNumber;
        totalUnits: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        roomTypeId: string;
        monthlyRentRwf: number | null;
        cautionRwf: number | null;
        vacantUnits: number;
        totalUnits: number;
    }, {
        name: string;
        roomTypeId: string;
        monthlyRentRwf: number | null;
        cautionRwf: number | null;
        vacantUnits: number;
        totalUnits: number;
    }>, "many">;
    /** Null until this broker reveals the listing. */
    contact: z.ZodNullable<z.ZodObject<{
        phone: z.ZodNullable<z.ZodString>;
        email: z.ZodNullable<z.ZodString>;
        revealedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        email: string | null;
        revealedAt: string;
        phone: string | null;
    }, {
        email: string | null;
        revealedAt: string;
        phone: string | null;
    }>>;
    /** The broker's open (`initiated`) placement on this listing, if any. */
    openPlacementId: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    district: string | null;
    contact: {
        email: string | null;
        revealedAt: string;
        phone: string | null;
    } | null;
    propertyName: string;
    listingId: string;
    landlordName: string;
    units: {
        name: string;
        roomTypeId: string;
        monthlyRentRwf: number | null;
        cautionRwf: number | null;
        vacantUnits: number;
        totalUnits: number;
    }[];
    openPlacementId: string | null;
}, {
    district: string | null;
    contact: {
        email: string | null;
        revealedAt: string;
        phone: string | null;
    } | null;
    propertyName: string;
    listingId: string;
    landlordName: string;
    units: {
        name: string;
        roomTypeId: string;
        monthlyRentRwf: number | null;
        cautionRwf: number | null;
        vacantUnits: number;
        totalUnits: number;
    }[];
    openPlacementId: string | null;
}>;
export type BrokerDirectoryListing = z.infer<typeof BrokerDirectoryListing>;
export declare const BrokerDirectory: z.ZodObject<{
    brokerStatus: z.ZodEnum<["active", "suspended"]>;
    /** `sum(delta)` over the credit ledger. Never stored. */
    balance: z.ZodNumber;
    /** What one reveal spends. The product's number, sent so a screen can say it. */
    revealCost: z.ZodNumber;
    listings: z.ZodArray<z.ZodObject<{
        listingId: z.ZodString;
        propertyName: z.ZodString;
        landlordName: z.ZodString;
        district: z.ZodNullable<z.ZodString>;
        units: z.ZodArray<z.ZodObject<{
            roomTypeId: z.ZodString;
            name: z.ZodString;
            monthlyRentRwf: z.ZodNullable<z.ZodNumber>;
            cautionRwf: z.ZodNullable<z.ZodNumber>;
            vacantUnits: z.ZodNumber;
            totalUnits: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            name: string;
            roomTypeId: string;
            monthlyRentRwf: number | null;
            cautionRwf: number | null;
            vacantUnits: number;
            totalUnits: number;
        }, {
            name: string;
            roomTypeId: string;
            monthlyRentRwf: number | null;
            cautionRwf: number | null;
            vacantUnits: number;
            totalUnits: number;
        }>, "many">;
        /** Null until this broker reveals the listing. */
        contact: z.ZodNullable<z.ZodObject<{
            phone: z.ZodNullable<z.ZodString>;
            email: z.ZodNullable<z.ZodString>;
            revealedAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            email: string | null;
            revealedAt: string;
            phone: string | null;
        }, {
            email: string | null;
            revealedAt: string;
            phone: string | null;
        }>>;
        /** The broker's open (`initiated`) placement on this listing, if any. */
        openPlacementId: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        district: string | null;
        contact: {
            email: string | null;
            revealedAt: string;
            phone: string | null;
        } | null;
        propertyName: string;
        listingId: string;
        landlordName: string;
        units: {
            name: string;
            roomTypeId: string;
            monthlyRentRwf: number | null;
            cautionRwf: number | null;
            vacantUnits: number;
            totalUnits: number;
        }[];
        openPlacementId: string | null;
    }, {
        district: string | null;
        contact: {
            email: string | null;
            revealedAt: string;
            phone: string | null;
        } | null;
        propertyName: string;
        listingId: string;
        landlordName: string;
        units: {
            name: string;
            roomTypeId: string;
            monthlyRentRwf: number | null;
            cautionRwf: number | null;
            vacantUnits: number;
            totalUnits: number;
        }[];
        openPlacementId: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    brokerStatus: "active" | "suspended";
    balance: number;
    revealCost: number;
    listings: {
        district: string | null;
        contact: {
            email: string | null;
            revealedAt: string;
            phone: string | null;
        } | null;
        propertyName: string;
        listingId: string;
        landlordName: string;
        units: {
            name: string;
            roomTypeId: string;
            monthlyRentRwf: number | null;
            cautionRwf: number | null;
            vacantUnits: number;
            totalUnits: number;
        }[];
        openPlacementId: string | null;
    }[];
}, {
    brokerStatus: "active" | "suspended";
    balance: number;
    revealCost: number;
    listings: {
        district: string | null;
        contact: {
            email: string | null;
            revealedAt: string;
            phone: string | null;
        } | null;
        propertyName: string;
        listingId: string;
        landlordName: string;
        units: {
            name: string;
            roomTypeId: string;
            monthlyRentRwf: number | null;
            cautionRwf: number | null;
            vacantUnits: number;
            totalUnits: number;
        }[];
        openPlacementId: string | null;
    }[];
}>;
export type BrokerDirectory = z.infer<typeof BrokerDirectory>;
/** The answer to a reveal. `charged` is false when the listing was already revealed. */
export declare const BrokerReveal: z.ZodObject<{
    listingId: z.ZodString;
    contact: z.ZodObject<{
        phone: z.ZodNullable<z.ZodString>;
        email: z.ZodNullable<z.ZodString>;
        revealedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        email: string | null;
        revealedAt: string;
        phone: string | null;
    }, {
        email: string | null;
        revealedAt: string;
        phone: string | null;
    }>;
    balance: z.ZodNumber;
    charged: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    contact: {
        email: string | null;
        revealedAt: string;
        phone: string | null;
    };
    listingId: string;
    balance: number;
    charged: boolean;
}, {
    contact: {
        email: string | null;
        revealedAt: string;
        phone: string | null;
    };
    listingId: string;
    balance: number;
    charged: boolean;
}>;
export type BrokerReveal = z.infer<typeof BrokerReveal>;
export declare const BrokerCreditEntry: z.ZodObject<{
    id: z.ZodString;
    /** Positive grants, negative spends. Credits, not money. */
    delta: z.ZodNumber;
    /** `plan_grant | reveal | refund | correction`. */
    reason: z.ZodString;
    note: z.ZodNullable<z.ZodString>;
    /** The listing a spend revealed, resolved through `reveal_id`. */
    propertyName: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    reason: string;
    note: string | null;
    createdAt: string;
    propertyName: string | null;
    delta: number;
}, {
    id: string;
    reason: string;
    note: string | null;
    createdAt: string;
    propertyName: string | null;
    delta: number;
}>;
export type BrokerCreditEntry = z.infer<typeof BrokerCreditEntry>;
export declare const BrokerCredits: z.ZodObject<{
    balance: z.ZodNumber;
    entries: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        /** Positive grants, negative spends. Credits, not money. */
        delta: z.ZodNumber;
        /** `plan_grant | reveal | refund | correction`. */
        reason: z.ZodString;
        note: z.ZodNullable<z.ZodString>;
        /** The listing a spend revealed, resolved through `reveal_id`. */
        propertyName: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        reason: string;
        note: string | null;
        createdAt: string;
        propertyName: string | null;
        delta: number;
    }, {
        id: string;
        reason: string;
        note: string | null;
        createdAt: string;
        propertyName: string | null;
        delta: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    entries: {
        id: string;
        reason: string;
        note: string | null;
        createdAt: string;
        propertyName: string | null;
        delta: number;
    }[];
    balance: number;
}, {
    entries: {
        id: string;
        reason: string;
        note: string | null;
        createdAt: string;
        propertyName: string | null;
        delta: number;
    }[];
    balance: number;
}>;
export type BrokerCredits = z.infer<typeof BrokerCredits>;
export declare const BrokerPlacementFeeStatus: z.ZodEnum<["pending", "disbursed"]>;
export type BrokerPlacementFeeStatus = z.infer<typeof BrokerPlacementFeeStatus>;
export declare const BrokerPlacement: z.ZodObject<{
    id: z.ZodString;
    listingId: z.ZodNullable<z.ZodString>;
    propertyName: z.ZodNullable<z.ZodString>;
    landlordName: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["initiated", "converted", "abandoned", "unavailable"]>;
    initiatedAt: z.ZodString;
    /** The lease the placement became. Null until the landlord records one. */
    lease: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        unitLabel: z.ZodNullable<z.ZodString>;
        tenantName: z.ZodNullable<z.ZodString>;
        status: z.ZodString;
        startDate: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: string;
        id: string;
        unitLabel: string | null;
        tenantName: string | null;
        startDate: string | null;
    }, {
        status: string;
        id: string;
        unitLabel: string | null;
        tenantName: string | null;
        startDate: string | null;
    }>>;
    /** The fee that lease raised. Earned when the lease activates (F-R08). */
    fee: z.ZodNullable<z.ZodObject<{
        amountRwf: z.ZodNullable<z.ZodNumber>;
        status: z.ZodEnum<["pending", "disbursed"]>;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "disbursed";
        amountRwf: number | null;
    }, {
        status: "pending" | "disbursed";
        amountRwf: number | null;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "initiated" | "converted" | "abandoned" | "unavailable";
    id: string;
    lease: {
        status: string;
        id: string;
        unitLabel: string | null;
        tenantName: string | null;
        startDate: string | null;
    } | null;
    propertyName: string | null;
    listingId: string | null;
    landlordName: string | null;
    initiatedAt: string;
    fee: {
        status: "pending" | "disbursed";
        amountRwf: number | null;
    } | null;
}, {
    status: "initiated" | "converted" | "abandoned" | "unavailable";
    id: string;
    lease: {
        status: string;
        id: string;
        unitLabel: string | null;
        tenantName: string | null;
        startDate: string | null;
    } | null;
    propertyName: string | null;
    listingId: string | null;
    landlordName: string | null;
    initiatedAt: string;
    fee: {
        status: "pending" | "disbursed";
        amountRwf: number | null;
    } | null;
}>;
export type BrokerPlacement = z.infer<typeof BrokerPlacement>;
export declare const BrokerPlacementList: z.ZodObject<{
    placements: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        listingId: z.ZodNullable<z.ZodString>;
        propertyName: z.ZodNullable<z.ZodString>;
        landlordName: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["initiated", "converted", "abandoned", "unavailable"]>;
        initiatedAt: z.ZodString;
        /** The lease the placement became. Null until the landlord records one. */
        lease: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            unitLabel: z.ZodNullable<z.ZodString>;
            tenantName: z.ZodNullable<z.ZodString>;
            status: z.ZodString;
            startDate: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: string;
            id: string;
            unitLabel: string | null;
            tenantName: string | null;
            startDate: string | null;
        }, {
            status: string;
            id: string;
            unitLabel: string | null;
            tenantName: string | null;
            startDate: string | null;
        }>>;
        /** The fee that lease raised. Earned when the lease activates (F-R08). */
        fee: z.ZodNullable<z.ZodObject<{
            amountRwf: z.ZodNullable<z.ZodNumber>;
            status: z.ZodEnum<["pending", "disbursed"]>;
        }, "strip", z.ZodTypeAny, {
            status: "pending" | "disbursed";
            amountRwf: number | null;
        }, {
            status: "pending" | "disbursed";
            amountRwf: number | null;
        }>>;
    }, "strip", z.ZodTypeAny, {
        status: "initiated" | "converted" | "abandoned" | "unavailable";
        id: string;
        lease: {
            status: string;
            id: string;
            unitLabel: string | null;
            tenantName: string | null;
            startDate: string | null;
        } | null;
        propertyName: string | null;
        listingId: string | null;
        landlordName: string | null;
        initiatedAt: string;
        fee: {
            status: "pending" | "disbursed";
            amountRwf: number | null;
        } | null;
    }, {
        status: "initiated" | "converted" | "abandoned" | "unavailable";
        id: string;
        lease: {
            status: string;
            id: string;
            unitLabel: string | null;
            tenantName: string | null;
            startDate: string | null;
        } | null;
        propertyName: string | null;
        listingId: string | null;
        landlordName: string | null;
        initiatedAt: string;
        fee: {
            status: "pending" | "disbursed";
            amountRwf: number | null;
        } | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    placements: {
        status: "initiated" | "converted" | "abandoned" | "unavailable";
        id: string;
        lease: {
            status: string;
            id: string;
            unitLabel: string | null;
            tenantName: string | null;
            startDate: string | null;
        } | null;
        propertyName: string | null;
        listingId: string | null;
        landlordName: string | null;
        initiatedAt: string;
        fee: {
            status: "pending" | "disbursed";
            amountRwf: number | null;
        } | null;
    }[];
}, {
    placements: {
        status: "initiated" | "converted" | "abandoned" | "unavailable";
        id: string;
        lease: {
            status: string;
            id: string;
            unitLabel: string | null;
            tenantName: string | null;
            startDate: string | null;
        } | null;
        propertyName: string | null;
        listingId: string | null;
        landlordName: string | null;
        initiatedAt: string;
        fee: {
            status: "pending" | "disbursed";
            amountRwf: number | null;
        } | null;
    }[];
}>;
export type BrokerPlacementList = z.infer<typeof BrokerPlacementList>;
export declare const BrokerFee: z.ZodObject<{
    id: z.ZodString;
    leaseId: z.ZodString;
    tenantName: z.ZodNullable<z.ZodString>;
    unitLabel: z.ZodNullable<z.ZodString>;
    landlordName: z.ZodNullable<z.ZodString>;
    amountRwf: z.ZodNullable<z.ZodNumber>;
    status: z.ZodEnum<["pending", "disbursed"]>;
    /** When the fee last moved: raised, or disbursed. */
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "disbursed";
    id: string;
    amountRwf: number | null;
    leaseId: string;
    unitLabel: string | null;
    tenantName: string | null;
    landlordName: string | null;
    updatedAt: string;
}, {
    status: "pending" | "disbursed";
    id: string;
    amountRwf: number | null;
    leaseId: string;
    unitLabel: string | null;
    tenantName: string | null;
    landlordName: string | null;
    updatedAt: string;
}>;
export type BrokerFee = z.infer<typeof BrokerFee>;
export declare const BrokerEarnings: z.ZodObject<{
    /** Disbursed since 1 January, in the server's clock. */
    disbursedThisYearRwf: z.ZodNumber;
    pendingRwf: z.ZodNumber;
    balance: z.ZodNumber;
    fees: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        leaseId: z.ZodString;
        tenantName: z.ZodNullable<z.ZodString>;
        unitLabel: z.ZodNullable<z.ZodString>;
        landlordName: z.ZodNullable<z.ZodString>;
        amountRwf: z.ZodNullable<z.ZodNumber>;
        status: z.ZodEnum<["pending", "disbursed"]>;
        /** When the fee last moved: raised, or disbursed. */
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "disbursed";
        id: string;
        amountRwf: number | null;
        leaseId: string;
        unitLabel: string | null;
        tenantName: string | null;
        landlordName: string | null;
        updatedAt: string;
    }, {
        status: "pending" | "disbursed";
        id: string;
        amountRwf: number | null;
        leaseId: string;
        unitLabel: string | null;
        tenantName: string | null;
        landlordName: string | null;
        updatedAt: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    pendingRwf: number;
    balance: number;
    disbursedThisYearRwf: number;
    fees: {
        status: "pending" | "disbursed";
        id: string;
        amountRwf: number | null;
        leaseId: string;
        unitLabel: string | null;
        tenantName: string | null;
        landlordName: string | null;
        updatedAt: string;
    }[];
}, {
    pendingRwf: number;
    balance: number;
    disbursedThisYearRwf: number;
    fees: {
        status: "pending" | "disbursed";
        id: string;
        amountRwf: number | null;
        leaseId: string;
        unitLabel: string | null;
        tenantName: string | null;
        landlordName: string | null;
        updatedAt: string;
    }[];
}>;
export type BrokerEarnings = z.infer<typeof BrokerEarnings>;
//# sourceMappingURL=broker.d.ts.map