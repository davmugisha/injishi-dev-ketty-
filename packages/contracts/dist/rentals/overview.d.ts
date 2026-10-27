import { z } from "zod";
/** `yyyy-mm`, a Kigali calendar month. */
export declare const MonthKey: z.ZodString;
export type MonthKey = z.infer<typeof MonthKey>;
/** The things a landlord is asked to look at, in the order the home lists them. */
export declare const RentalsAttentionKind: z.ZodEnum<["setup_incomplete", "no_payout_account", "overdue_rent", "leases_to_sign", "ready_to_start", "notices_to_acknowledge", "filings_due", "waiting_for_tenant"]>;
export type RentalsAttentionKind = z.infer<typeof RentalsAttentionKind>;
/** One line of "Needs attention". Only kinds with something to do are listed. */
export declare const RentalsAttentionItem: z.ZodObject<{
    kind: z.ZodEnum<["setup_incomplete", "no_payout_account", "overdue_rent", "leases_to_sign", "ready_to_start", "notices_to_acknowledge", "filings_due", "waiting_for_tenant"]>;
    count: z.ZodNumber;
    /** The money involved, where there is some (the overdue amount). */
    amountRwf: z.ZodNullable<z.ZodNumber>;
    /** "2 leases wait for your signature". */
    title: z.ZodString;
    /** One more short line, or null. */
    detail: z.ZodNullable<z.ZodString>;
    /** danger: money or a legal deadline is late; warning: needs doing soon; info: waiting on someone else. */
    tone: z.ZodEnum<["danger", "warning", "info"]>;
}, "strip", z.ZodTypeAny, {
    kind: "waiting_for_tenant" | "ready_to_start" | "setup_incomplete" | "no_payout_account" | "overdue_rent" | "leases_to_sign" | "notices_to_acknowledge" | "filings_due";
    amountRwf: number | null;
    count: number;
    title: string;
    detail: string | null;
    tone: "info" | "warning" | "danger";
}, {
    kind: "waiting_for_tenant" | "ready_to_start" | "setup_incomplete" | "no_payout_account" | "overdue_rent" | "leases_to_sign" | "notices_to_acknowledge" | "filings_due";
    amountRwf: number | null;
    count: number;
    title: string;
    detail: string | null;
    tone: "info" | "warning" | "danger";
}>;
export type RentalsAttentionItem = z.infer<typeof RentalsAttentionItem>;
/** `GET /ops/rentals/summary`: the counts the navigation shows and the "Needs attention" list. */
export declare const RentalsSummary: z.ZodObject<{
    counts: z.ZodObject<{
        /** Units not retired. */
        units: z.ZodNumber;
        /** Units that can be let and have no tenant or signed lease. */
        vacantUnits: z.ZodNumber;
        /** Drafts the landlord still has to sign. */
        leasesToSign: z.ZodNumber;
        /** Signed by the landlord, waiting for the tenant. */
        waitingForTenant: z.ZodNumber;
        /** Signed by both, not started yet. */
        readyToStart: z.ZodNumber;
        /** Active or ending tenancies. */
        liveLeases: z.ZodNumber;
        /** Open rent past its due day plus the lease's grace days. */
        overdueCharges: z.ZodNumber;
        overdueRwf: z.ZodNumber;
        /** Tenants' move out notices nobody acknowledged yet. */
        noticesToAcknowledge: z.ZodNumber;
        /** RRA lease filings not marked filed, and those already past their due day. */
        filingsDue: z.ZodNumber;
        filingsLate: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        units: number;
        overdueRwf: number;
        vacantUnits: number;
        leasesToSign: number;
        waitingForTenant: number;
        readyToStart: number;
        liveLeases: number;
        overdueCharges: number;
        noticesToAcknowledge: number;
        filingsDue: number;
        filingsLate: number;
    }, {
        units: number;
        overdueRwf: number;
        vacantUnits: number;
        leasesToSign: number;
        waitingForTenant: number;
        readyToStart: number;
        liveLeases: number;
        overdueCharges: number;
        noticesToAcknowledge: number;
        filingsDue: number;
        filingsLate: number;
    }>;
    setup: z.ZodObject<{
        complete: z.ZodBoolean;
        done: z.ZodNumber;
        total: z.ZodNumber;
        next: z.ZodNullable<z.ZodEnum<["location", "units", "getting_paid", "lease_defaults", "signatory"]>>;
    }, "strip", z.ZodTypeAny, {
        complete: boolean;
        total: number;
        done: number;
        next: "units" | "location" | "signatory" | "getting_paid" | "lease_defaults" | null;
    }, {
        complete: boolean;
        total: number;
        done: number;
        next: "units" | "location" | "signatory" | "getting_paid" | "lease_defaults" | null;
    }>;
    hasPayoutAccount: z.ZodBoolean;
    attention: z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<["setup_incomplete", "no_payout_account", "overdue_rent", "leases_to_sign", "ready_to_start", "notices_to_acknowledge", "filings_due", "waiting_for_tenant"]>;
        count: z.ZodNumber;
        /** The money involved, where there is some (the overdue amount). */
        amountRwf: z.ZodNullable<z.ZodNumber>;
        /** "2 leases wait for your signature". */
        title: z.ZodString;
        /** One more short line, or null. */
        detail: z.ZodNullable<z.ZodString>;
        /** danger: money or a legal deadline is late; warning: needs doing soon; info: waiting on someone else. */
        tone: z.ZodEnum<["danger", "warning", "info"]>;
    }, "strip", z.ZodTypeAny, {
        kind: "waiting_for_tenant" | "ready_to_start" | "setup_incomplete" | "no_payout_account" | "overdue_rent" | "leases_to_sign" | "notices_to_acknowledge" | "filings_due";
        amountRwf: number | null;
        count: number;
        title: string;
        detail: string | null;
        tone: "info" | "warning" | "danger";
    }, {
        kind: "waiting_for_tenant" | "ready_to_start" | "setup_incomplete" | "no_payout_account" | "overdue_rent" | "leases_to_sign" | "notices_to_acknowledge" | "filings_due";
        amountRwf: number | null;
        count: number;
        title: string;
        detail: string | null;
        tone: "info" | "warning" | "danger";
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    counts: {
        units: number;
        overdueRwf: number;
        vacantUnits: number;
        leasesToSign: number;
        waitingForTenant: number;
        readyToStart: number;
        liveLeases: number;
        overdueCharges: number;
        noticesToAcknowledge: number;
        filingsDue: number;
        filingsLate: number;
    };
    setup: {
        complete: boolean;
        total: number;
        done: number;
        next: "units" | "location" | "signatory" | "getting_paid" | "lease_defaults" | null;
    };
    hasPayoutAccount: boolean;
    attention: {
        kind: "waiting_for_tenant" | "ready_to_start" | "setup_incomplete" | "no_payout_account" | "overdue_rent" | "leases_to_sign" | "notices_to_acknowledge" | "filings_due";
        amountRwf: number | null;
        count: number;
        title: string;
        detail: string | null;
        tone: "info" | "warning" | "danger";
    }[];
}, {
    counts: {
        units: number;
        overdueRwf: number;
        vacantUnits: number;
        leasesToSign: number;
        waitingForTenant: number;
        readyToStart: number;
        liveLeases: number;
        overdueCharges: number;
        noticesToAcknowledge: number;
        filingsDue: number;
        filingsLate: number;
    };
    setup: {
        complete: boolean;
        total: number;
        done: number;
        next: "units" | "location" | "signatory" | "getting_paid" | "lease_defaults" | null;
    };
    hasPayoutAccount: boolean;
    attention: {
        kind: "waiting_for_tenant" | "ready_to_start" | "setup_incomplete" | "no_payout_account" | "overdue_rent" | "leases_to_sign" | "notices_to_acknowledge" | "filings_due";
        amountRwf: number | null;
        count: number;
        title: string;
        detail: string | null;
        tone: "info" | "warning" | "danger";
    }[];
}>;
export type RentalsSummary = z.infer<typeof RentalsSummary>;
/** Rent expected and collected in one Kigali month. */
export declare const RentalsMonthFigure: z.ZodObject<{
    month: z.ZodString;
    /** Rent charges due in the month, not waived. */
    expectedRwf: z.ZodNumber;
    /** Rent paid in the month: allocations of payments that succeeded (or were received) then. */
    collectedRwf: z.ZodNumber;
    /** What the landlord spent in the month: expenses paid then, not voided (the cash flow's money out). */
    spentRwf: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    month: string;
    expectedRwf: number;
    collectedRwf: number;
    spentRwf: number;
}, {
    month: string;
    expectedRwf: number;
    collectedRwf: number;
    spentRwf: number;
}>;
export type RentalsMonthFigure = z.infer<typeof RentalsMonthFigure>;
/** How many months the rent trend covers, this month included. */
export declare const OVERVIEW_MONTHS = 12;
/** `GET /ops/rentals/overview`: the home's figures, for the current Kigali month. */
export declare const RentalsOverview: z.ZodObject<{
    today: z.ZodEffects<z.ZodString, string, string>;
    month: z.ZodString;
    /** Buildings of the business. */
    properties: z.ZodNumber;
    /** Units not retired. */
    units: z.ZodNumber;
    /** Units with a tenancy running (active or ending). */
    occupiedUnits: z.ZodNumber;
    /** Units that can be let and have no tenancy, signed lease or lease out for signing. */
    vacantUnits: z.ZodNumber;
    /** Units signed or out for signing, not lived in yet. */
    reservedUnits: z.ZodNumber;
    offMarketUnits: z.ZodNumber;
    /** People with a tenancy running. */
    tenants: z.ZodNumber;
    /** Occupied units over the units that are let or can be let, 0 to 100 with one decimal; null with none. */
    occupancyPercent: z.ZodNullable<z.ZodNumber>;
    rent: z.ZodObject<{
        expectedThisMonthRwf: z.ZodNumber;
        collectedThisMonthRwf: z.ZodNumber;
        expectedLastMonthRwf: z.ZodNumber;
        collectedLastMonthRwf: z.ZodNumber;
        /** Collected this month against last month, in percent; null when last month had nothing. */
        collectedChangePercent: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        expectedThisMonthRwf: number;
        collectedThisMonthRwf: number;
        expectedLastMonthRwf: number;
        collectedLastMonthRwf: number;
        collectedChangePercent: number | null;
    }, {
        expectedThisMonthRwf: number;
        collectedThisMonthRwf: number;
        expectedLastMonthRwf: number;
        collectedLastMonthRwf: number;
        collectedChangePercent: number | null;
    }>;
    overdue: z.ZodObject<{
        amountRwf: z.ZodNumber;
        /** Overdue rent charges. */
        charges: z.ZodNumber;
        /** Leases with overdue rent. */
        leases: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        amountRwf: number;
        leases: number;
        charges: number;
    }, {
        amountRwf: number;
        leases: number;
        charges: number;
    }>;
    /** The last `OVERVIEW_MONTHS` months, oldest first, ending with this month. */
    months: z.ZodArray<z.ZodObject<{
        month: z.ZodString;
        /** Rent charges due in the month, not waived. */
        expectedRwf: z.ZodNumber;
        /** Rent paid in the month: allocations of payments that succeeded (or were received) then. */
        collectedRwf: z.ZodNumber;
        /** What the landlord spent in the month: expenses paid then, not voided (the cash flow's money out). */
        spentRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        month: string;
        expectedRwf: number;
        collectedRwf: number;
        spentRwf: number;
    }, {
        month: string;
        expectedRwf: number;
        collectedRwf: number;
        spentRwf: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    month: string;
    overdue: {
        amountRwf: number;
        leases: number;
        charges: number;
    };
    rent: {
        expectedThisMonthRwf: number;
        collectedThisMonthRwf: number;
        expectedLastMonthRwf: number;
        collectedLastMonthRwf: number;
        collectedChangePercent: number | null;
    };
    today: string;
    units: number;
    months: {
        month: string;
        expectedRwf: number;
        collectedRwf: number;
        spentRwf: number;
    }[];
    properties: number;
    tenants: number;
    vacantUnits: number;
    occupiedUnits: number;
    reservedUnits: number;
    offMarketUnits: number;
    occupancyPercent: number | null;
}, {
    month: string;
    overdue: {
        amountRwf: number;
        leases: number;
        charges: number;
    };
    rent: {
        expectedThisMonthRwf: number;
        collectedThisMonthRwf: number;
        expectedLastMonthRwf: number;
        collectedLastMonthRwf: number;
        collectedChangePercent: number | null;
    };
    today: string;
    units: number;
    months: {
        month: string;
        expectedRwf: number;
        collectedRwf: number;
        spentRwf: number;
    }[];
    properties: number;
    tenants: number;
    vacantUnits: number;
    occupiedUnits: number;
    reservedUnits: number;
    offMarketUnits: number;
    occupancyPercent: number | null;
}>;
export type RentalsOverview = z.infer<typeof RentalsOverview>;
/** The months of the rent trend: `count` Kigali months ending with the one `today` is in, oldest first. */
export declare function overviewMonths(today: string, count?: number): string[];
/** The change from `before` to `now` in percent, one decimal; null when there was nothing before. */
export declare function percentChange(now: number, before: number): number | null;
/** One place of the Province > District > Sector > Cell > Village chain. */
export declare const PlaceRef: z.ZodObject<{
    id: z.ZodNumber;
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: number;
}, {
    name: string;
    id: number;
}>;
export type PlaceRef = z.infer<typeof PlaceRef>;
/** A building of the business with where it is, as far as it is known. */
export declare const RentalPropertyView: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    /** The street line: "KG 9 Ave, house 14". */
    street: z.ZodNullable<z.ZodString>;
    place: z.ZodObject<{
        province: z.ZodNullable<z.ZodObject<{
            id: z.ZodNumber;
            name: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: number;
        }, {
            name: string;
            id: number;
        }>>;
        district: z.ZodNullable<z.ZodObject<{
            id: z.ZodNumber;
            name: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: number;
        }, {
            name: string;
            id: number;
        }>>;
        sector: z.ZodNullable<z.ZodObject<{
            id: z.ZodNumber;
            name: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: number;
        }, {
            name: string;
            id: number;
        }>>;
        cell: z.ZodNullable<z.ZodObject<{
            id: z.ZodNumber;
            name: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: number;
        }, {
            name: string;
            id: number;
        }>>;
        village: z.ZodNullable<z.ZodObject<{
            id: z.ZodNumber;
            name: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: number;
        }, {
            name: string;
            id: number;
        }>>;
    }, "strip", z.ZodTypeAny, {
        province: {
            name: string;
            id: number;
        } | null;
        district: {
            name: string;
            id: number;
        } | null;
        sector: {
            name: string;
            id: number;
        } | null;
        cell: {
            name: string;
            id: number;
        } | null;
        village: {
            name: string;
            id: number;
        } | null;
    }, {
        province: {
            name: string;
            id: number;
        } | null;
        district: {
            name: string;
            id: number;
        } | null;
        sector: {
            name: string;
            id: number;
        } | null;
        cell: {
            name: string;
            id: number;
        } | null;
        village: {
            name: string;
            id: number;
        } | null;
    }>;
    /** The village is known: setup's location step is done for it. */
    located: z.ZodBoolean;
    /** Units in it that are not retired. */
    units: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    street: string | null;
    place: {
        province: {
            name: string;
            id: number;
        } | null;
        district: {
            name: string;
            id: number;
        } | null;
        sector: {
            name: string;
            id: number;
        } | null;
        cell: {
            name: string;
            id: number;
        } | null;
        village: {
            name: string;
            id: number;
        } | null;
    };
    located: boolean;
    units: number;
}, {
    name: string;
    id: string;
    street: string | null;
    place: {
        province: {
            name: string;
            id: number;
        } | null;
        district: {
            name: string;
            id: number;
        } | null;
        sector: {
            name: string;
            id: number;
        } | null;
        cell: {
            name: string;
            id: number;
        } | null;
        village: {
            name: string;
            id: number;
        } | null;
    };
    located: boolean;
    units: number;
}>;
export type RentalPropertyView = z.infer<typeof RentalPropertyView>;
/** `GET /ops/properties`: the business's buildings, the first made from the registration when there is none. */
export declare const RentalPropertyList: z.ZodObject<{
    properties: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        /** The street line: "KG 9 Ave, house 14". */
        street: z.ZodNullable<z.ZodString>;
        place: z.ZodObject<{
            province: z.ZodNullable<z.ZodObject<{
                id: z.ZodNumber;
                name: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                name: string;
                id: number;
            }, {
                name: string;
                id: number;
            }>>;
            district: z.ZodNullable<z.ZodObject<{
                id: z.ZodNumber;
                name: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                name: string;
                id: number;
            }, {
                name: string;
                id: number;
            }>>;
            sector: z.ZodNullable<z.ZodObject<{
                id: z.ZodNumber;
                name: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                name: string;
                id: number;
            }, {
                name: string;
                id: number;
            }>>;
            cell: z.ZodNullable<z.ZodObject<{
                id: z.ZodNumber;
                name: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                name: string;
                id: number;
            }, {
                name: string;
                id: number;
            }>>;
            village: z.ZodNullable<z.ZodObject<{
                id: z.ZodNumber;
                name: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                name: string;
                id: number;
            }, {
                name: string;
                id: number;
            }>>;
        }, "strip", z.ZodTypeAny, {
            province: {
                name: string;
                id: number;
            } | null;
            district: {
                name: string;
                id: number;
            } | null;
            sector: {
                name: string;
                id: number;
            } | null;
            cell: {
                name: string;
                id: number;
            } | null;
            village: {
                name: string;
                id: number;
            } | null;
        }, {
            province: {
                name: string;
                id: number;
            } | null;
            district: {
                name: string;
                id: number;
            } | null;
            sector: {
                name: string;
                id: number;
            } | null;
            cell: {
                name: string;
                id: number;
            } | null;
            village: {
                name: string;
                id: number;
            } | null;
        }>;
        /** The village is known: setup's location step is done for it. */
        located: z.ZodBoolean;
        /** Units in it that are not retired. */
        units: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        street: string | null;
        place: {
            province: {
                name: string;
                id: number;
            } | null;
            district: {
                name: string;
                id: number;
            } | null;
            sector: {
                name: string;
                id: number;
            } | null;
            cell: {
                name: string;
                id: number;
            } | null;
            village: {
                name: string;
                id: number;
            } | null;
        };
        located: boolean;
        units: number;
    }, {
        name: string;
        id: string;
        street: string | null;
        place: {
            province: {
                name: string;
                id: number;
            } | null;
            district: {
                name: string;
                id: number;
            } | null;
            sector: {
                name: string;
                id: number;
            } | null;
            cell: {
                name: string;
                id: number;
            } | null;
            village: {
                name: string;
                id: number;
            } | null;
        };
        located: boolean;
        units: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    properties: {
        name: string;
        id: string;
        street: string | null;
        place: {
            province: {
                name: string;
                id: number;
            } | null;
            district: {
                name: string;
                id: number;
            } | null;
            sector: {
                name: string;
                id: number;
            } | null;
            cell: {
                name: string;
                id: number;
            } | null;
            village: {
                name: string;
                id: number;
            } | null;
        };
        located: boolean;
        units: number;
    }[];
}, {
    properties: {
        name: string;
        id: string;
        street: string | null;
        place: {
            province: {
                name: string;
                id: number;
            } | null;
            district: {
                name: string;
                id: number;
            } | null;
            sector: {
                name: string;
                id: number;
            } | null;
            cell: {
                name: string;
                id: number;
            } | null;
            village: {
                name: string;
                id: number;
            } | null;
        };
        located: boolean;
        units: number;
    }[];
}>;
export type RentalPropertyList = z.infer<typeof RentalPropertyList>;
/**
 * `PUT /ops/properties/:id/location`: the whole chain down to the village, and the street. The API checks
 * every level sits under the one above it.
 */
export declare const PropertyLocationRequest: z.ZodObject<{
    provinceId: z.ZodNumber;
    districtId: z.ZodNumber;
    sectorId: z.ZodNumber;
    cellId: z.ZodNumber;
    villageId: z.ZodNumber;
    street: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodString, string | null, string>>>;
}, "strip", z.ZodTypeAny, {
    provinceId: number;
    districtId: number;
    sectorId: number;
    cellId: number;
    villageId: number;
    street?: string | null | undefined;
}, {
    provinceId: number;
    districtId: number;
    sectorId: number;
    cellId: number;
    villageId: number;
    street?: string | null | undefined;
}>;
export type PropertyLocationRequest = z.infer<typeof PropertyLocationRequest>;
/** The most photos one unit holds. */
export declare const UNIT_PHOTO_MAX = 20;
/** One photo's size limit as uploaded (it is stored re-encoded, at most 2048 px). */
export declare const UNIT_PHOTO_MAX_BYTES: number;
/** A video tour's size limit, on its own route. */
export declare const UNIT_VIDEO_MAX_BYTES: number;
export declare const UNIT_VIDEO_MIN_SECONDS = 1;
export declare const UNIT_VIDEO_MAX_SECONDS = 180;
/** The poster still sent with a video. */
export declare const UNIT_VIDEO_POSTER_MAX_BYTES: number;
export declare const UnitPhotoView: z.ZodObject<{
    id: z.ZodString;
    /** A short-lived read. */
    url: z.ZodString;
    /** 0 is the cover. */
    position: z.ZodNumber;
    caption: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    url: string;
    position: number;
    caption: string | null;
}, {
    id: string;
    url: string;
    position: number;
    caption: string | null;
}>;
export type UnitPhotoView = z.infer<typeof UnitPhotoView>;
export declare const UnitVideoView: z.ZodObject<{
    id: z.ZodString;
    url: z.ZodString;
    posterUrl: z.ZodNullable<z.ZodString>;
    durationS: z.ZodNumber;
    width: z.ZodNullable<z.ZodNumber>;
    height: z.ZodNullable<z.ZodNumber>;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    url: string;
    posterUrl: string | null;
    durationS: number;
    updatedAt: string;
    width: number | null;
    height: number | null;
}, {
    id: string;
    url: string;
    posterUrl: string | null;
    durationS: number;
    updatedAt: string;
    width: number | null;
    height: number | null;
}>;
export type UnitVideoView = z.infer<typeof UnitVideoView>;
/** `GET /ops/units/:id/media`, and the answer of every photo and video change. */
export declare const UnitMediaView: z.ZodObject<{
    unitId: z.ZodString;
    photos: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        /** A short-lived read. */
        url: z.ZodString;
        /** 0 is the cover. */
        position: z.ZodNumber;
        caption: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        url: string;
        position: number;
        caption: string | null;
    }, {
        id: string;
        url: string;
        position: number;
        caption: string | null;
    }>, "many">;
    video: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        url: z.ZodString;
        posterUrl: z.ZodNullable<z.ZodString>;
        durationS: z.ZodNumber;
        width: z.ZodNullable<z.ZodNumber>;
        height: z.ZodNullable<z.ZodNumber>;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        url: string;
        posterUrl: string | null;
        durationS: number;
        updatedAt: string;
        width: number | null;
        height: number | null;
    }, {
        id: string;
        url: string;
        posterUrl: string | null;
        durationS: number;
        updatedAt: string;
        width: number | null;
        height: number | null;
    }>>;
}, "strip", z.ZodTypeAny, {
    unitId: string;
    photos: {
        id: string;
        url: string;
        position: number;
        caption: string | null;
    }[];
    video: {
        id: string;
        url: string;
        posterUrl: string | null;
        durationS: number;
        updatedAt: string;
        width: number | null;
        height: number | null;
    } | null;
}, {
    unitId: string;
    photos: {
        id: string;
        url: string;
        position: number;
        caption: string | null;
    }[];
    video: {
        id: string;
        url: string;
        posterUrl: string | null;
        durationS: number;
        updatedAt: string;
        width: number | null;
        height: number | null;
    } | null;
}>;
export type UnitMediaView = z.infer<typeof UnitMediaView>;
/** `PATCH /ops/units/:id/photos/order`: every photo of the unit, in the new order (the first is the cover). */
export declare const ReorderUnitPhotosRequest: z.ZodEffects<z.ZodObject<{
    photoIds: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    photoIds: string[];
}, {
    photoIds: string[];
}>, {
    photoIds: string[];
}, {
    photoIds: string[];
}>;
export type ReorderUnitPhotosRequest = z.infer<typeof ReorderUnitPhotosRequest>;
/** The fields sent beside the video file of `PUT /ops/units/:id/video` (multipart). */
export declare const UnitVideoFields: z.ZodObject<{
    durationS: z.ZodNumber;
    width: z.ZodOptional<z.ZodNumber>;
    height: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    durationS: number;
    width?: number | undefined;
    height?: number | undefined;
}, {
    durationS: number;
    width?: number | undefined;
    height?: number | undefined;
}>;
export type UnitVideoFields = z.infer<typeof UnitVideoFields>;
//# sourceMappingURL=overview.d.ts.map