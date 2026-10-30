import { z } from "zod";
export declare const BrokerFeeKind: z.ZodEnum<["percent", "fixed"]>;
export type BrokerFeeKind = z.infer<typeof BrokerFeeKind>;
/** The highest percent of the first month a fee may be: two months' rent. */
export declare const BROKER_FEE_PERCENT_MAX = 200;
/** What a landlord pays a broker who brings the tenant. */
export declare const BrokerFeeTerms: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
    kind: z.ZodLiteral<"percent">;
    percent: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    kind: "percent";
    percent: number;
}, {
    kind: "percent";
    percent: number;
}>, z.ZodObject<{
    kind: z.ZodLiteral<"fixed">;
    amountRwf: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    kind: "fixed";
    amountRwf: number;
}, {
    kind: "fixed";
    amountRwf: number;
}>]>;
export type BrokerFeeTerms = z.infer<typeof BrokerFeeTerms>;
/** The fee in francs for a first month's rent: a percent rounds down to the franc. */
export declare function brokerFeeAmount(terms: BrokerFeeTerms, monthlyRentRwf: number): number;
/** "50% of the first month" or "RWF 100,000". */
export declare function brokerFeeWords(terms: BrokerFeeTerms): string;
/** The terms from the columns that hold them; null when they do not make a whole fee. */
export declare function brokerFeeFrom(kind: BrokerFeeKind | null, percent: number | null, amountRwf: number | null): BrokerFeeTerms | null;
/** `PUT /ops/rentals/profile/brokers`: the fee a new unit starts with when brokers may offer it. */
export declare const BrokerDefaultsRequest: z.ZodObject<{
    fee: z.ZodNullable<z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
        kind: z.ZodLiteral<"percent">;
        percent: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        kind: "percent";
        percent: number;
    }, {
        kind: "percent";
        percent: number;
    }>, z.ZodObject<{
        kind: z.ZodLiteral<"fixed">;
        amountRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        kind: "fixed";
        amountRwf: number;
    }, {
        kind: "fixed";
        amountRwf: number;
    }>]>>;
}, "strip", z.ZodTypeAny, {
    fee: {
        kind: "percent";
        percent: number;
    } | {
        kind: "fixed";
        amountRwf: number;
    } | null;
}, {
    fee: {
        kind: "percent";
        percent: number;
    } | {
        kind: "fixed";
        amountRwf: number;
    } | null;
}>;
export type BrokerDefaultsRequest = z.infer<typeof BrokerDefaultsRequest>;
/** Owed until the landlord marks it paid; void when the lease was cancelled before it started. */
export declare const BrokerFeeRecordStatus: z.ZodEnum<["owed", "paid", "void"]>;
export type BrokerFeeRecordStatus = z.infer<typeof BrokerFeeRecordStatus>;
/** The fee as the lease records it. */
export declare const BrokerFeeRecord: z.ZodObject<{
    terms: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
        kind: z.ZodLiteral<"percent">;
        percent: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        kind: "percent";
        percent: number;
    }, {
        kind: "percent";
        percent: number;
    }>, z.ZodObject<{
        kind: z.ZodLiteral<"fixed">;
        amountRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        kind: "fixed";
        amountRwf: number;
    }, {
        kind: "fixed";
        amountRwf: number;
    }>]>;
    amountRwf: z.ZodNumber;
    status: z.ZodEnum<["owed", "paid", "void"]>;
    paidAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "void" | "paid" | "owed";
    amountRwf: number;
    paidAt: string | null;
    terms: {
        kind: "percent";
        percent: number;
    } | {
        kind: "fixed";
        amountRwf: number;
    };
}, {
    status: "void" | "paid" | "owed";
    amountRwf: number;
    paidAt: string | null;
    terms: {
        kind: "percent";
        percent: number;
    } | {
        kind: "fixed";
        amountRwf: number;
    };
}>;
export type BrokerFeeRecord = z.infer<typeof BrokerFeeRecord>;
/** A star rating with an optional comment. */
export declare const BrokerStars: z.ZodNumber;
/** `POST /ops/leases/:id/broker-rating` and `POST /me/tenancies/:leaseId/broker-rating`. */
export declare const BrokerRatingRequest: z.ZodObject<{
    stars: z.ZodNumber;
    comment: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    stars: number;
    comment?: string | null | undefined;
}, {
    stars: number;
    comment?: string | null | undefined;
}>;
export type BrokerRatingRequest = z.infer<typeof BrokerRatingRequest>;
export declare const BrokerRatingView: z.ZodObject<{
    stars: z.ZodNumber;
    comment: z.ZodNullable<z.ZodString>;
    ratedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    stars: number;
    comment: string | null;
    ratedAt: string;
}, {
    stars: number;
    comment: string | null;
    ratedAt: string;
}>;
export type BrokerRatingView = z.infer<typeof BrokerRatingView>;
/** `PUT /ops/leases/:id/broker-fee`: the landlord marks the fee paid, or owed again. */
export declare const BrokerFeeStatusRequest: z.ZodObject<{
    paid: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    paid: boolean;
}, {
    paid: boolean;
}>;
export type BrokerFeeStatusRequest = z.infer<typeof BrokerFeeStatusRequest>;
/** The broker on a lease, as the landlord sees it. */
export declare const LeaseBrokerView: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodNullable<z.ZodString>;
    phone: z.ZodNullable<z.ZodString>;
    placementId: z.ZodNullable<z.ZodString>;
    fee: z.ZodNullable<z.ZodObject<{
        terms: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
            kind: z.ZodLiteral<"percent">;
            percent: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            kind: "percent";
            percent: number;
        }, {
            kind: "percent";
            percent: number;
        }>, z.ZodObject<{
            kind: z.ZodLiteral<"fixed">;
            amountRwf: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            kind: "fixed";
            amountRwf: number;
        }, {
            kind: "fixed";
            amountRwf: number;
        }>]>;
        amountRwf: z.ZodNumber;
        status: z.ZodEnum<["owed", "paid", "void"]>;
        paidAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "void" | "paid" | "owed";
        amountRwf: number;
        paidAt: string | null;
        terms: {
            kind: "percent";
            percent: number;
        } | {
            kind: "fixed";
            amountRwf: number;
        };
    }, {
        status: "void" | "paid" | "owed";
        amountRwf: number;
        paidAt: string | null;
        terms: {
            kind: "percent";
            percent: number;
        } | {
            kind: "fixed";
            amountRwf: number;
        };
    }>>;
    /** The landlord's own rating of the broker on this lease. */
    rating: z.ZodNullable<z.ZodObject<{
        stars: z.ZodNumber;
        comment: z.ZodNullable<z.ZodString>;
        ratedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        stars: number;
        comment: string | null;
        ratedAt: string;
    }, {
        stars: number;
        comment: string | null;
        ratedAt: string;
    }>>;
    /** The tenancy has started, so the broker can be rated. */
    canRate: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    name: string | null;
    id: string;
    rating: {
        stars: number;
        comment: string | null;
        ratedAt: string;
    } | null;
    phone: string | null;
    fee: {
        status: "void" | "paid" | "owed";
        amountRwf: number;
        paidAt: string | null;
        terms: {
            kind: "percent";
            percent: number;
        } | {
            kind: "fixed";
            amountRwf: number;
        };
    } | null;
    placementId: string | null;
    canRate: boolean;
}, {
    name: string | null;
    id: string;
    rating: {
        stars: number;
        comment: string | null;
        ratedAt: string;
    } | null;
    phone: string | null;
    fee: {
        status: "void" | "paid" | "owed";
        amountRwf: number;
        paidAt: string | null;
        terms: {
            kind: "percent";
            percent: number;
        } | {
            kind: "fixed";
            amountRwf: number;
        };
    } | null;
    placementId: string | null;
    canRate: boolean;
}>;
export type LeaseBrokerView = z.infer<typeof LeaseBrokerView>;
/** The broker on a tenant's lease: rated once the tenancy starts. */
export declare const TenancyBrokerView: z.ZodObject<{
    name: z.ZodNullable<z.ZodString>;
    rating: z.ZodNullable<z.ZodObject<{
        stars: z.ZodNumber;
        comment: z.ZodNullable<z.ZodString>;
        ratedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        stars: number;
        comment: string | null;
        ratedAt: string;
    }, {
        stars: number;
        comment: string | null;
        ratedAt: string;
    }>>;
    canRate: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    name: string | null;
    rating: {
        stars: number;
        comment: string | null;
        ratedAt: string;
    } | null;
    canRate: boolean;
}, {
    name: string | null;
    rating: {
        stars: number;
        comment: string | null;
        ratedAt: string;
    } | null;
    canRate: boolean;
}>;
export type TenancyBrokerView = z.infer<typeof TenancyBrokerView>;
export declare const PlacementStatus: z.ZodEnum<["initiated", "converted", "abandoned", "unavailable"]>;
export type PlacementStatus = z.infer<typeof PlacementStatus>;
/** One placement as the landlord sees it: a broker says they have a tenant for a unit. */
export declare const LandlordPlacementView: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodEnum<["initiated", "converted", "abandoned", "unavailable"]>;
    startedAt: z.ZodString;
    broker: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodNullable<z.ZodString>;
        phone: z.ZodNullable<z.ZodString>;
        ratingAverage: z.ZodNullable<z.ZodNumber>;
        ratingCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string | null;
        id: string;
        phone: string | null;
        ratingAverage: number | null;
        ratingCount: number;
    }, {
        name: string | null;
        id: string;
        phone: string | null;
        ratingAverage: number | null;
        ratingCount: number;
    }>;
    unit: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        propertyName: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        label: string;
        propertyName: string;
    }, {
        id: string;
        label: string;
        propertyName: string;
    }>>;
    /** Who the broker says they bring, when they said. */
    tenantName: z.ZodNullable<z.ZodString>;
    note: z.ZodNullable<z.ZodString>;
    /** The unit's fee when the broker started. */
    terms: z.ZodNullable<z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
        kind: z.ZodLiteral<"percent">;
        percent: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        kind: "percent";
        percent: number;
    }, {
        kind: "percent";
        percent: number;
    }>, z.ZodObject<{
        kind: z.ZodLiteral<"fixed">;
        amountRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        kind: "fixed";
        amountRwf: number;
    }, {
        kind: "fixed";
        amountRwf: number;
    }>]>>;
    lease: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        reference: z.ZodString;
        tenantName: z.ZodString;
        status: z.ZodString;
        startDate: z.ZodEffects<z.ZodString, string, string>;
    }, "strip", z.ZodTypeAny, {
        status: string;
        id: string;
        reference: string;
        tenantName: string;
        startDate: string;
    }, {
        status: string;
        id: string;
        reference: string;
        tenantName: string;
        startDate: string;
    }>>;
    fee: z.ZodNullable<z.ZodObject<{
        terms: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
            kind: z.ZodLiteral<"percent">;
            percent: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            kind: "percent";
            percent: number;
        }, {
            kind: "percent";
            percent: number;
        }>, z.ZodObject<{
            kind: z.ZodLiteral<"fixed">;
            amountRwf: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            kind: "fixed";
            amountRwf: number;
        }, {
            kind: "fixed";
            amountRwf: number;
        }>]>;
        amountRwf: z.ZodNumber;
        status: z.ZodEnum<["owed", "paid", "void"]>;
        paidAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "void" | "paid" | "owed";
        amountRwf: number;
        paidAt: string | null;
        terms: {
            kind: "percent";
            percent: number;
        } | {
            kind: "fixed";
            amountRwf: number;
        };
    }, {
        status: "void" | "paid" | "owed";
        amountRwf: number;
        paidAt: string | null;
        terms: {
            kind: "percent";
            percent: number;
        } | {
            kind: "fixed";
            amountRwf: number;
        };
    }>>;
    rating: z.ZodNullable<z.ZodObject<{
        stars: z.ZodNumber;
        comment: z.ZodNullable<z.ZodString>;
        ratedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        stars: number;
        comment: string | null;
        ratedAt: string;
    }, {
        stars: number;
        comment: string | null;
        ratedAt: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "initiated" | "converted" | "abandoned" | "unavailable";
    broker: {
        name: string | null;
        id: string;
        phone: string | null;
        ratingAverage: number | null;
        ratingCount: number;
    };
    id: string;
    note: string | null;
    lease: {
        status: string;
        id: string;
        reference: string;
        tenantName: string;
        startDate: string;
    } | null;
    unit: {
        id: string;
        label: string;
        propertyName: string;
    } | null;
    rating: {
        stars: number;
        comment: string | null;
        ratedAt: string;
    } | null;
    tenantName: string | null;
    startedAt: string;
    terms: {
        kind: "percent";
        percent: number;
    } | {
        kind: "fixed";
        amountRwf: number;
    } | null;
    fee: {
        status: "void" | "paid" | "owed";
        amountRwf: number;
        paidAt: string | null;
        terms: {
            kind: "percent";
            percent: number;
        } | {
            kind: "fixed";
            amountRwf: number;
        };
    } | null;
}, {
    status: "initiated" | "converted" | "abandoned" | "unavailable";
    broker: {
        name: string | null;
        id: string;
        phone: string | null;
        ratingAverage: number | null;
        ratingCount: number;
    };
    id: string;
    note: string | null;
    lease: {
        status: string;
        id: string;
        reference: string;
        tenantName: string;
        startDate: string;
    } | null;
    unit: {
        id: string;
        label: string;
        propertyName: string;
    } | null;
    rating: {
        stars: number;
        comment: string | null;
        ratedAt: string;
    } | null;
    tenantName: string | null;
    startedAt: string;
    terms: {
        kind: "percent";
        percent: number;
    } | {
        kind: "fixed";
        amountRwf: number;
    } | null;
    fee: {
        status: "void" | "paid" | "owed";
        amountRwf: number;
        paidAt: string | null;
        terms: {
            kind: "percent";
            percent: number;
        } | {
            kind: "fixed";
            amountRwf: number;
        };
    } | null;
}>;
export type LandlordPlacementView = z.infer<typeof LandlordPlacementView>;
/** `GET /ops/rentals/placements`. */
export declare const LandlordPlacementList: z.ZodObject<{
    placements: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        status: z.ZodEnum<["initiated", "converted", "abandoned", "unavailable"]>;
        startedAt: z.ZodString;
        broker: z.ZodObject<{
            id: z.ZodString;
            name: z.ZodNullable<z.ZodString>;
            phone: z.ZodNullable<z.ZodString>;
            ratingAverage: z.ZodNullable<z.ZodNumber>;
            ratingCount: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            name: string | null;
            id: string;
            phone: string | null;
            ratingAverage: number | null;
            ratingCount: number;
        }, {
            name: string | null;
            id: string;
            phone: string | null;
            ratingAverage: number | null;
            ratingCount: number;
        }>;
        unit: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            propertyName: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            label: string;
            propertyName: string;
        }, {
            id: string;
            label: string;
            propertyName: string;
        }>>;
        /** Who the broker says they bring, when they said. */
        tenantName: z.ZodNullable<z.ZodString>;
        note: z.ZodNullable<z.ZodString>;
        /** The unit's fee when the broker started. */
        terms: z.ZodNullable<z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
            kind: z.ZodLiteral<"percent">;
            percent: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            kind: "percent";
            percent: number;
        }, {
            kind: "percent";
            percent: number;
        }>, z.ZodObject<{
            kind: z.ZodLiteral<"fixed">;
            amountRwf: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            kind: "fixed";
            amountRwf: number;
        }, {
            kind: "fixed";
            amountRwf: number;
        }>]>>;
        lease: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            reference: z.ZodString;
            tenantName: z.ZodString;
            status: z.ZodString;
            startDate: z.ZodEffects<z.ZodString, string, string>;
        }, "strip", z.ZodTypeAny, {
            status: string;
            id: string;
            reference: string;
            tenantName: string;
            startDate: string;
        }, {
            status: string;
            id: string;
            reference: string;
            tenantName: string;
            startDate: string;
        }>>;
        fee: z.ZodNullable<z.ZodObject<{
            terms: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
                kind: z.ZodLiteral<"percent">;
                percent: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                kind: "percent";
                percent: number;
            }, {
                kind: "percent";
                percent: number;
            }>, z.ZodObject<{
                kind: z.ZodLiteral<"fixed">;
                amountRwf: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                kind: "fixed";
                amountRwf: number;
            }, {
                kind: "fixed";
                amountRwf: number;
            }>]>;
            amountRwf: z.ZodNumber;
            status: z.ZodEnum<["owed", "paid", "void"]>;
            paidAt: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "void" | "paid" | "owed";
            amountRwf: number;
            paidAt: string | null;
            terms: {
                kind: "percent";
                percent: number;
            } | {
                kind: "fixed";
                amountRwf: number;
            };
        }, {
            status: "void" | "paid" | "owed";
            amountRwf: number;
            paidAt: string | null;
            terms: {
                kind: "percent";
                percent: number;
            } | {
                kind: "fixed";
                amountRwf: number;
            };
        }>>;
        rating: z.ZodNullable<z.ZodObject<{
            stars: z.ZodNumber;
            comment: z.ZodNullable<z.ZodString>;
            ratedAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            stars: number;
            comment: string | null;
            ratedAt: string;
        }, {
            stars: number;
            comment: string | null;
            ratedAt: string;
        }>>;
    }, "strip", z.ZodTypeAny, {
        status: "initiated" | "converted" | "abandoned" | "unavailable";
        broker: {
            name: string | null;
            id: string;
            phone: string | null;
            ratingAverage: number | null;
            ratingCount: number;
        };
        id: string;
        note: string | null;
        lease: {
            status: string;
            id: string;
            reference: string;
            tenantName: string;
            startDate: string;
        } | null;
        unit: {
            id: string;
            label: string;
            propertyName: string;
        } | null;
        rating: {
            stars: number;
            comment: string | null;
            ratedAt: string;
        } | null;
        tenantName: string | null;
        startedAt: string;
        terms: {
            kind: "percent";
            percent: number;
        } | {
            kind: "fixed";
            amountRwf: number;
        } | null;
        fee: {
            status: "void" | "paid" | "owed";
            amountRwf: number;
            paidAt: string | null;
            terms: {
                kind: "percent";
                percent: number;
            } | {
                kind: "fixed";
                amountRwf: number;
            };
        } | null;
    }, {
        status: "initiated" | "converted" | "abandoned" | "unavailable";
        broker: {
            name: string | null;
            id: string;
            phone: string | null;
            ratingAverage: number | null;
            ratingCount: number;
        };
        id: string;
        note: string | null;
        lease: {
            status: string;
            id: string;
            reference: string;
            tenantName: string;
            startDate: string;
        } | null;
        unit: {
            id: string;
            label: string;
            propertyName: string;
        } | null;
        rating: {
            stars: number;
            comment: string | null;
            ratedAt: string;
        } | null;
        tenantName: string | null;
        startedAt: string;
        terms: {
            kind: "percent";
            percent: number;
        } | {
            kind: "fixed";
            amountRwf: number;
        } | null;
        fee: {
            status: "void" | "paid" | "owed";
            amountRwf: number;
            paidAt: string | null;
            terms: {
                kind: "percent";
                percent: number;
            } | {
                kind: "fixed";
                amountRwf: number;
            };
        } | null;
    }>, "many">;
    /** Fees owed and paid, over every lease that names a broker. */
    owedRwf: z.ZodNumber;
    paidRwf: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    paidRwf: number;
    placements: {
        status: "initiated" | "converted" | "abandoned" | "unavailable";
        broker: {
            name: string | null;
            id: string;
            phone: string | null;
            ratingAverage: number | null;
            ratingCount: number;
        };
        id: string;
        note: string | null;
        lease: {
            status: string;
            id: string;
            reference: string;
            tenantName: string;
            startDate: string;
        } | null;
        unit: {
            id: string;
            label: string;
            propertyName: string;
        } | null;
        rating: {
            stars: number;
            comment: string | null;
            ratedAt: string;
        } | null;
        tenantName: string | null;
        startedAt: string;
        terms: {
            kind: "percent";
            percent: number;
        } | {
            kind: "fixed";
            amountRwf: number;
        } | null;
        fee: {
            status: "void" | "paid" | "owed";
            amountRwf: number;
            paidAt: string | null;
            terms: {
                kind: "percent";
                percent: number;
            } | {
                kind: "fixed";
                amountRwf: number;
            };
        } | null;
    }[];
    owedRwf: number;
}, {
    paidRwf: number;
    placements: {
        status: "initiated" | "converted" | "abandoned" | "unavailable";
        broker: {
            name: string | null;
            id: string;
            phone: string | null;
            ratingAverage: number | null;
            ratingCount: number;
        };
        id: string;
        note: string | null;
        lease: {
            status: string;
            id: string;
            reference: string;
            tenantName: string;
            startDate: string;
        } | null;
        unit: {
            id: string;
            label: string;
            propertyName: string;
        } | null;
        rating: {
            stars: number;
            comment: string | null;
            ratedAt: string;
        } | null;
        tenantName: string | null;
        startedAt: string;
        terms: {
            kind: "percent";
            percent: number;
        } | {
            kind: "fixed";
            amountRwf: number;
        } | null;
        fee: {
            status: "void" | "paid" | "owed";
            amountRwf: number;
            paidAt: string | null;
            terms: {
                kind: "percent";
                percent: number;
            } | {
                kind: "fixed";
                amountRwf: number;
            };
        } | null;
    }[];
    owedRwf: number;
}>;
export type LandlordPlacementList = z.infer<typeof LandlordPlacementList>;
/** A broker the landlord can name on a lease (`GET /ops/rentals/brokers?q=`). */
export declare const BrokerPick: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodNullable<z.ZodString>;
    phone: z.ZodNullable<z.ZodString>;
    ratingAverage: z.ZodNullable<z.ZodNumber>;
    ratingCount: z.ZodNumber;
    /** An open placement this broker started on this landlord's units, newest first. */
    placements: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        unitId: z.ZodNullable<z.ZodString>;
        unitLabel: z.ZodNullable<z.ZodString>;
        tenantName: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        unitLabel: string | null;
        tenantName: string | null;
        unitId: string | null;
    }, {
        id: string;
        unitLabel: string | null;
        tenantName: string | null;
        unitId: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string | null;
    id: string;
    phone: string | null;
    ratingAverage: number | null;
    ratingCount: number;
    placements: {
        id: string;
        unitLabel: string | null;
        tenantName: string | null;
        unitId: string | null;
    }[];
}, {
    name: string | null;
    id: string;
    phone: string | null;
    ratingAverage: number | null;
    ratingCount: number;
    placements: {
        id: string;
        unitLabel: string | null;
        tenantName: string | null;
        unitId: string | null;
    }[];
}>;
export type BrokerPick = z.infer<typeof BrokerPick>;
export declare const BrokerPickList: z.ZodObject<{
    brokers: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodNullable<z.ZodString>;
        phone: z.ZodNullable<z.ZodString>;
        ratingAverage: z.ZodNullable<z.ZodNumber>;
        ratingCount: z.ZodNumber;
        /** An open placement this broker started on this landlord's units, newest first. */
        placements: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            unitId: z.ZodNullable<z.ZodString>;
            unitLabel: z.ZodNullable<z.ZodString>;
            tenantName: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            unitLabel: string | null;
            tenantName: string | null;
            unitId: string | null;
        }, {
            id: string;
            unitLabel: string | null;
            tenantName: string | null;
            unitId: string | null;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        name: string | null;
        id: string;
        phone: string | null;
        ratingAverage: number | null;
        ratingCount: number;
        placements: {
            id: string;
            unitLabel: string | null;
            tenantName: string | null;
            unitId: string | null;
        }[];
    }, {
        name: string | null;
        id: string;
        phone: string | null;
        ratingAverage: number | null;
        ratingCount: number;
        placements: {
            id: string;
            unitLabel: string | null;
            tenantName: string | null;
            unitId: string | null;
        }[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    brokers: {
        name: string | null;
        id: string;
        phone: string | null;
        ratingAverage: number | null;
        ratingCount: number;
        placements: {
            id: string;
            unitLabel: string | null;
            tenantName: string | null;
            unitId: string | null;
        }[];
    }[];
}, {
    brokers: {
        name: string | null;
        id: string;
        phone: string | null;
        ratingAverage: number | null;
        ratingCount: number;
        placements: {
            id: string;
            unitLabel: string | null;
            tenantName: string | null;
            unitId: string | null;
        }[];
    }[];
}>;
export type BrokerPickList = z.infer<typeof BrokerPickList>;
export declare const BrokerPickQuery: z.ZodObject<{
    q: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    q?: string | undefined;
}, {
    q?: string | undefined;
}>;
export type BrokerPickQuery = z.infer<typeof BrokerPickQuery>;
//# sourceMappingURL=brokers.d.ts.map