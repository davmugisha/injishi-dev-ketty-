import { z } from "zod";
/**
 * The broker's own surface (`/api/v1/ops/broker/*`).
 *
 * A broker sees only the units a landlord switched on for brokers, inside the
 * area their plan covers (District, Province or Country). A unit outside that
 * is not there at all: every read and command answers 404. Revealing a
 * landlord's contact is free and logged; a placement says "I have a tenant for
 * this unit" and becomes the lease's broker record when the landlord names the
 * broker on the lease. Fees are recorded, never collected by Injishi.
 */
/** The landlord contact a broker revealed, as it stood when they revealed it. */
export declare const BrokerContact: z.ZodObject<{
    name: z.ZodNullable<z.ZodString>;
    phone: z.ZodNullable<z.ZodString>;
    email: z.ZodNullable<z.ZodString>;
    revealedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string | null;
    email: string | null;
    revealedAt: string;
    phone: string | null;
}, {
    name: string | null;
    email: string | null;
    revealedAt: string;
    phone: string | null;
}>;
export type BrokerContact = z.infer<typeof BrokerContact>;
/** The broker's placement on a unit, when they started one. */
export declare const BrokerHomePlacement: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodEnum<["initiated", "converted", "abandoned", "unavailable"]>;
}, "strip", z.ZodTypeAny, {
    status: "initiated" | "converted" | "abandoned" | "unavailable";
    id: string;
}, {
    status: "initiated" | "converted" | "abandoned" | "unavailable";
    id: string;
}>;
export type BrokerHomePlacement = z.infer<typeof BrokerHomePlacement>;
/** One opted-in vacant unit a broker may offer. */
export declare const BrokerHome: z.ZodObject<{
    unitId: z.ZodString;
    unitLabel: z.ZodString;
    propertyName: z.ZodString;
    landlordName: z.ZodString;
    districtId: z.ZodNullable<z.ZodNumber>;
    district: z.ZodNullable<z.ZodString>;
    sector: z.ZodNullable<z.ZodString>;
    bedrooms: z.ZodNullable<z.ZodNumber>;
    bathrooms: z.ZodNullable<z.ZodNumber>;
    kitchen: z.ZodNullable<z.ZodEnum<["own", "shared", "none"]>>;
    furnished: z.ZodBoolean;
    sizeSqm: z.ZodNullable<z.ZodNumber>;
    rentRwf: z.ZodNumber;
    depositRwf: z.ZodNullable<z.ZodNumber>;
    /** What the landlord pays the broker who brings the tenant. */
    fee: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
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
    /** The fee in francs on this unit's asking rent. */
    feeRwf: z.ZodNumber;
    /** Signed, short-lived photo URLs, cover first. */
    photos: z.ZodArray<z.ZodString, "many">;
    video: z.ZodNullable<z.ZodObject<{
        url: z.ZodString;
        posterUrl: z.ZodNullable<z.ZodString>;
        durationS: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        url: string;
        posterUrl: string | null;
        durationS: number;
    }, {
        url: string;
        posterUrl: string | null;
        durationS: number;
    }>>;
    /** Null when it is free now. */
    availableFrom: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
    latitude: z.ZodNullable<z.ZodNumber>;
    longitude: z.ZodNullable<z.ZodNumber>;
    /** Null until this broker reveals the landlord. */
    contact: z.ZodNullable<z.ZodObject<{
        name: z.ZodNullable<z.ZodString>;
        phone: z.ZodNullable<z.ZodString>;
        email: z.ZodNullable<z.ZodString>;
        revealedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string | null;
        email: string | null;
        revealedAt: string;
        phone: string | null;
    }, {
        name: string | null;
        email: string | null;
        revealedAt: string;
        phone: string | null;
    }>>;
    placement: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        status: z.ZodEnum<["initiated", "converted", "abandoned", "unavailable"]>;
    }, "strip", z.ZodTypeAny, {
        status: "initiated" | "converted" | "abandoned" | "unavailable";
        id: string;
    }, {
        status: "initiated" | "converted" | "abandoned" | "unavailable";
        id: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    district: string | null;
    sector: string | null;
    districtId: number | null;
    contact: {
        name: string | null;
        email: string | null;
        revealedAt: string;
        phone: string | null;
    } | null;
    propertyName: string;
    unitLabel: string;
    fee: {
        kind: "percent";
        percent: number;
    } | {
        kind: "fixed";
        amountRwf: number;
    };
    unitId: string;
    landlordName: string;
    bedrooms: number | null;
    bathrooms: number | null;
    kitchen: "none" | "own" | "shared" | null;
    furnished: boolean;
    sizeSqm: number | null;
    rentRwf: number;
    depositRwf: number | null;
    feeRwf: number;
    photos: string[];
    video: {
        url: string;
        posterUrl: string | null;
        durationS: number;
    } | null;
    availableFrom: string | null;
    latitude: number | null;
    longitude: number | null;
    placement: {
        status: "initiated" | "converted" | "abandoned" | "unavailable";
        id: string;
    } | null;
}, {
    district: string | null;
    sector: string | null;
    districtId: number | null;
    contact: {
        name: string | null;
        email: string | null;
        revealedAt: string;
        phone: string | null;
    } | null;
    propertyName: string;
    unitLabel: string;
    fee: {
        kind: "percent";
        percent: number;
    } | {
        kind: "fixed";
        amountRwf: number;
    };
    unitId: string;
    landlordName: string;
    bedrooms: number | null;
    bathrooms: number | null;
    kitchen: "none" | "own" | "shared" | null;
    furnished: boolean;
    sizeSqm: number | null;
    rentRwf: number;
    depositRwf: number | null;
    feeRwf: number;
    photos: string[];
    video: {
        url: string;
        posterUrl: string | null;
        durationS: number;
    } | null;
    availableFrom: string | null;
    latitude: number | null;
    longitude: number | null;
    placement: {
        status: "initiated" | "converted" | "abandoned" | "unavailable";
        id: string;
    } | null;
}>;
export type BrokerHome = z.infer<typeof BrokerHome>;
export declare const BrokerHomesSort: z.ZodEnum<["newest", "price_asc", "price_desc", "fee_desc"]>;
export type BrokerHomesSort = z.infer<typeof BrokerHomesSort>;
/** `GET /ops/broker/homes`. A district outside the plan shows nothing. */
export declare const BrokerHomesQuery: z.ZodObject<{
    district: z.ZodOptional<z.ZodNumber>;
    minRent: z.ZodOptional<z.ZodNumber>;
    maxRent: z.ZodOptional<z.ZodNumber>;
    /** At least this many bedrooms. */
    bedrooms: z.ZodOptional<z.ZodNumber>;
    q: z.ZodOptional<z.ZodString>;
    sort: z.ZodOptional<z.ZodEnum<["newest", "price_asc", "price_desc", "fee_desc"]>>;
}, "strip", z.ZodTypeAny, {
    sort?: "newest" | "price_asc" | "price_desc" | "fee_desc" | undefined;
    district?: number | undefined;
    q?: string | undefined;
    bedrooms?: number | undefined;
    minRent?: number | undefined;
    maxRent?: number | undefined;
}, {
    sort?: "newest" | "price_asc" | "price_desc" | "fee_desc" | undefined;
    district?: number | undefined;
    q?: string | undefined;
    bedrooms?: number | undefined;
    minRent?: number | undefined;
    maxRent?: number | undefined;
}>;
export type BrokerHomesQuery = z.infer<typeof BrokerHomesQuery>;
export declare const BrokerHomes: z.ZodObject<{
    brokerStatus: z.ZodEnum<["active", "suspended"]>;
    /** The district filter applied, or null for the whole plan area. */
    districtId: z.ZodNullable<z.ZodNumber>;
    /** Every district inside the plan with a home on offer, with how many. */
    districts: z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        name: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: number;
        count: number;
    }, {
        name: string;
        id: number;
        count: number;
    }>, "many">;
    homes: z.ZodArray<z.ZodObject<{
        unitId: z.ZodString;
        unitLabel: z.ZodString;
        propertyName: z.ZodString;
        landlordName: z.ZodString;
        districtId: z.ZodNullable<z.ZodNumber>;
        district: z.ZodNullable<z.ZodString>;
        sector: z.ZodNullable<z.ZodString>;
        bedrooms: z.ZodNullable<z.ZodNumber>;
        bathrooms: z.ZodNullable<z.ZodNumber>;
        kitchen: z.ZodNullable<z.ZodEnum<["own", "shared", "none"]>>;
        furnished: z.ZodBoolean;
        sizeSqm: z.ZodNullable<z.ZodNumber>;
        rentRwf: z.ZodNumber;
        depositRwf: z.ZodNullable<z.ZodNumber>;
        /** What the landlord pays the broker who brings the tenant. */
        fee: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
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
        /** The fee in francs on this unit's asking rent. */
        feeRwf: z.ZodNumber;
        /** Signed, short-lived photo URLs, cover first. */
        photos: z.ZodArray<z.ZodString, "many">;
        video: z.ZodNullable<z.ZodObject<{
            url: z.ZodString;
            posterUrl: z.ZodNullable<z.ZodString>;
            durationS: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            url: string;
            posterUrl: string | null;
            durationS: number;
        }, {
            url: string;
            posterUrl: string | null;
            durationS: number;
        }>>;
        /** Null when it is free now. */
        availableFrom: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
        latitude: z.ZodNullable<z.ZodNumber>;
        longitude: z.ZodNullable<z.ZodNumber>;
        /** Null until this broker reveals the landlord. */
        contact: z.ZodNullable<z.ZodObject<{
            name: z.ZodNullable<z.ZodString>;
            phone: z.ZodNullable<z.ZodString>;
            email: z.ZodNullable<z.ZodString>;
            revealedAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string | null;
            email: string | null;
            revealedAt: string;
            phone: string | null;
        }, {
            name: string | null;
            email: string | null;
            revealedAt: string;
            phone: string | null;
        }>>;
        placement: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            status: z.ZodEnum<["initiated", "converted", "abandoned", "unavailable"]>;
        }, "strip", z.ZodTypeAny, {
            status: "initiated" | "converted" | "abandoned" | "unavailable";
            id: string;
        }, {
            status: "initiated" | "converted" | "abandoned" | "unavailable";
            id: string;
        }>>;
    }, "strip", z.ZodTypeAny, {
        district: string | null;
        sector: string | null;
        districtId: number | null;
        contact: {
            name: string | null;
            email: string | null;
            revealedAt: string;
            phone: string | null;
        } | null;
        propertyName: string;
        unitLabel: string;
        fee: {
            kind: "percent";
            percent: number;
        } | {
            kind: "fixed";
            amountRwf: number;
        };
        unitId: string;
        landlordName: string;
        bedrooms: number | null;
        bathrooms: number | null;
        kitchen: "none" | "own" | "shared" | null;
        furnished: boolean;
        sizeSqm: number | null;
        rentRwf: number;
        depositRwf: number | null;
        feeRwf: number;
        photos: string[];
        video: {
            url: string;
            posterUrl: string | null;
            durationS: number;
        } | null;
        availableFrom: string | null;
        latitude: number | null;
        longitude: number | null;
        placement: {
            status: "initiated" | "converted" | "abandoned" | "unavailable";
            id: string;
        } | null;
    }, {
        district: string | null;
        sector: string | null;
        districtId: number | null;
        contact: {
            name: string | null;
            email: string | null;
            revealedAt: string;
            phone: string | null;
        } | null;
        propertyName: string;
        unitLabel: string;
        fee: {
            kind: "percent";
            percent: number;
        } | {
            kind: "fixed";
            amountRwf: number;
        };
        unitId: string;
        landlordName: string;
        bedrooms: number | null;
        bathrooms: number | null;
        kitchen: "none" | "own" | "shared" | null;
        furnished: boolean;
        sizeSqm: number | null;
        rentRwf: number;
        depositRwf: number | null;
        feeRwf: number;
        photos: string[];
        video: {
            url: string;
            posterUrl: string | null;
            durationS: number;
        } | null;
        availableFrom: string | null;
        latitude: number | null;
        longitude: number | null;
        placement: {
            status: "initiated" | "converted" | "abandoned" | "unavailable";
            id: string;
        } | null;
    }>, "many">;
    scope: z.ZodObject<{
        plan: z.ZodEnum<["district", "province", "country"]>;
        area: z.ZodString;
        districtId: z.ZodNullable<z.ZodNumber>;
        provinceId: z.ZodNullable<z.ZodNumber>;
        needsDistrict: z.ZodBoolean;
        upgrade: z.ZodNullable<z.ZodObject<{
            plan: z.ZodEnum<["district", "province", "country"]>;
            area: z.ZodString;
            priceRwf: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            priceRwf: number;
            area: string;
            plan: "country" | "province" | "district";
        }, {
            priceRwf: number;
            area: string;
            plan: "country" | "province" | "district";
        }>>;
    }, "strip", z.ZodTypeAny, {
        provinceId: number | null;
        districtId: number | null;
        area: string;
        plan: "country" | "province" | "district";
        needsDistrict: boolean;
        upgrade: {
            priceRwf: number;
            area: string;
            plan: "country" | "province" | "district";
        } | null;
    }, {
        provinceId: number | null;
        districtId: number | null;
        area: string;
        plan: "country" | "province" | "district";
        needsDistrict: boolean;
        upgrade: {
            priceRwf: number;
            area: string;
            plan: "country" | "province" | "district";
        } | null;
    }>;
}, "strip", z.ZodTypeAny, {
    districtId: number | null;
    scope: {
        provinceId: number | null;
        districtId: number | null;
        area: string;
        plan: "country" | "province" | "district";
        needsDistrict: boolean;
        upgrade: {
            priceRwf: number;
            area: string;
            plan: "country" | "province" | "district";
        } | null;
    };
    brokerStatus: "active" | "suspended";
    districts: {
        name: string;
        id: number;
        count: number;
    }[];
    homes: {
        district: string | null;
        sector: string | null;
        districtId: number | null;
        contact: {
            name: string | null;
            email: string | null;
            revealedAt: string;
            phone: string | null;
        } | null;
        propertyName: string;
        unitLabel: string;
        fee: {
            kind: "percent";
            percent: number;
        } | {
            kind: "fixed";
            amountRwf: number;
        };
        unitId: string;
        landlordName: string;
        bedrooms: number | null;
        bathrooms: number | null;
        kitchen: "none" | "own" | "shared" | null;
        furnished: boolean;
        sizeSqm: number | null;
        rentRwf: number;
        depositRwf: number | null;
        feeRwf: number;
        photos: string[];
        video: {
            url: string;
            posterUrl: string | null;
            durationS: number;
        } | null;
        availableFrom: string | null;
        latitude: number | null;
        longitude: number | null;
        placement: {
            status: "initiated" | "converted" | "abandoned" | "unavailable";
            id: string;
        } | null;
    }[];
}, {
    districtId: number | null;
    scope: {
        provinceId: number | null;
        districtId: number | null;
        area: string;
        plan: "country" | "province" | "district";
        needsDistrict: boolean;
        upgrade: {
            priceRwf: number;
            area: string;
            plan: "country" | "province" | "district";
        } | null;
    };
    brokerStatus: "active" | "suspended";
    districts: {
        name: string;
        id: number;
        count: number;
    }[];
    homes: {
        district: string | null;
        sector: string | null;
        districtId: number | null;
        contact: {
            name: string | null;
            email: string | null;
            revealedAt: string;
            phone: string | null;
        } | null;
        propertyName: string;
        unitLabel: string;
        fee: {
            kind: "percent";
            percent: number;
        } | {
            kind: "fixed";
            amountRwf: number;
        };
        unitId: string;
        landlordName: string;
        bedrooms: number | null;
        bathrooms: number | null;
        kitchen: "none" | "own" | "shared" | null;
        furnished: boolean;
        sizeSqm: number | null;
        rentRwf: number;
        depositRwf: number | null;
        feeRwf: number;
        photos: string[];
        video: {
            url: string;
            posterUrl: string | null;
            durationS: number;
        } | null;
        availableFrom: string | null;
        latitude: number | null;
        longitude: number | null;
        placement: {
            status: "initiated" | "converted" | "abandoned" | "unavailable";
            id: string;
        } | null;
    }[];
}>;
export type BrokerHomes = z.infer<typeof BrokerHomes>;
/** `POST /ops/broker/homes/:unitId/reveal`. `first` is false when it was revealed before. */
export declare const BrokerReveal: z.ZodObject<{
    unitId: z.ZodString;
    contact: z.ZodObject<{
        name: z.ZodNullable<z.ZodString>;
        phone: z.ZodNullable<z.ZodString>;
        email: z.ZodNullable<z.ZodString>;
        revealedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string | null;
        email: string | null;
        revealedAt: string;
        phone: string | null;
    }, {
        name: string | null;
        email: string | null;
        revealedAt: string;
        phone: string | null;
    }>;
    first: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    contact: {
        name: string | null;
        email: string | null;
        revealedAt: string;
        phone: string | null;
    };
    unitId: string;
    first: boolean;
}, {
    contact: {
        name: string | null;
        email: string | null;
        revealedAt: string;
        phone: string | null;
    };
    unitId: string;
    first: boolean;
}>;
export type BrokerReveal = z.infer<typeof BrokerReveal>;
/** `POST /ops/broker/homes/:unitId/placements`: "I have a tenant for this unit". */
export declare const StartPlacementRequest: z.ZodObject<{
    tenantName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    note?: string | null | undefined;
    tenantName?: string | null | undefined;
}, {
    note?: string | null | undefined;
    tenantName?: string | null | undefined;
}>;
export type StartPlacementRequest = z.infer<typeof StartPlacementRequest>;
export declare const BrokerPlacement: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodEnum<["initiated", "converted", "abandoned", "unavailable"]>;
    startedAt: z.ZodString;
    unit: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        propertyName: z.ZodString;
        district: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        district: string | null;
        id: string;
        label: string;
        propertyName: string;
    }, {
        district: string | null;
        id: string;
        label: string;
        propertyName: string;
    }>>;
    landlordName: z.ZodNullable<z.ZodString>;
    tenantName: z.ZodNullable<z.ZodString>;
    note: z.ZodNullable<z.ZodString>;
    /** The unit's fee when the placement started. */
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
    /** The lease the landlord wrote naming this broker. */
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
}, "strip", z.ZodTypeAny, {
    status: "initiated" | "converted" | "abandoned" | "unavailable";
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
        district: string | null;
        id: string;
        label: string;
        propertyName: string;
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
    landlordName: string | null;
}, {
    status: "initiated" | "converted" | "abandoned" | "unavailable";
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
        district: string | null;
        id: string;
        label: string;
        propertyName: string;
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
    landlordName: string | null;
}>;
export type BrokerPlacement = z.infer<typeof BrokerPlacement>;
export declare const BrokerPlacementList: z.ZodObject<{
    placements: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        status: z.ZodEnum<["initiated", "converted", "abandoned", "unavailable"]>;
        startedAt: z.ZodString;
        unit: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            propertyName: z.ZodString;
            district: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            district: string | null;
            id: string;
            label: string;
            propertyName: string;
        }, {
            district: string | null;
            id: string;
            label: string;
            propertyName: string;
        }>>;
        landlordName: z.ZodNullable<z.ZodString>;
        tenantName: z.ZodNullable<z.ZodString>;
        note: z.ZodNullable<z.ZodString>;
        /** The unit's fee when the placement started. */
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
        /** The lease the landlord wrote naming this broker. */
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
    }, "strip", z.ZodTypeAny, {
        status: "initiated" | "converted" | "abandoned" | "unavailable";
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
            district: string | null;
            id: string;
            label: string;
            propertyName: string;
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
        landlordName: string | null;
    }, {
        status: "initiated" | "converted" | "abandoned" | "unavailable";
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
            district: string | null;
            id: string;
            label: string;
            propertyName: string;
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
        landlordName: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    placements: {
        status: "initiated" | "converted" | "abandoned" | "unavailable";
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
            district: string | null;
            id: string;
            label: string;
            propertyName: string;
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
        landlordName: string | null;
    }[];
}, {
    placements: {
        status: "initiated" | "converted" | "abandoned" | "unavailable";
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
            district: string | null;
            id: string;
            label: string;
            propertyName: string;
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
        landlordName: string | null;
    }[];
}>;
export type BrokerPlacementList = z.infer<typeof BrokerPlacementList>;
/** One fee a lease records for this broker. */
export declare const BrokerFeeLine: z.ZodObject<{
    leaseId: z.ZodString;
    reference: z.ZodString;
    tenantName: z.ZodString;
    unitLabel: z.ZodString;
    propertyName: z.ZodString;
    landlordName: z.ZodString;
    startDate: z.ZodEffects<z.ZodString, string, string>;
    fee: z.ZodObject<{
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
}, "strip", z.ZodTypeAny, {
    reference: string;
    propertyName: string;
    leaseId: string;
    unitLabel: string;
    tenantName: string;
    startDate: string;
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
    };
    landlordName: string;
}, {
    reference: string;
    propertyName: string;
    leaseId: string;
    unitLabel: string;
    tenantName: string;
    startDate: string;
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
    };
    landlordName: string;
}>;
export type BrokerFeeLine = z.infer<typeof BrokerFeeLine>;
/** `GET /ops/broker/earnings`: what landlords recorded as owed and paid. Injishi moves none of it. */
export declare const BrokerEarnings: z.ZodObject<{
    owedRwf: z.ZodNumber;
    paidRwf: z.ZodNumber;
    paidThisYearRwf: z.ZodNumber;
    /** Recorded by the month the lease starts, the last 12 months, oldest first (`yyyy-mm`). */
    byMonth: z.ZodArray<z.ZodObject<{
        month: z.ZodString;
        paidRwf: z.ZodNumber;
        owedRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        paidRwf: number;
        month: string;
        owedRwf: number;
    }, {
        paidRwf: number;
        month: string;
        owedRwf: number;
    }>, "many">;
    fees: z.ZodArray<z.ZodObject<{
        leaseId: z.ZodString;
        reference: z.ZodString;
        tenantName: z.ZodString;
        unitLabel: z.ZodString;
        propertyName: z.ZodString;
        landlordName: z.ZodString;
        startDate: z.ZodEffects<z.ZodString, string, string>;
        fee: z.ZodObject<{
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
    }, "strip", z.ZodTypeAny, {
        reference: string;
        propertyName: string;
        leaseId: string;
        unitLabel: string;
        tenantName: string;
        startDate: string;
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
        };
        landlordName: string;
    }, {
        reference: string;
        propertyName: string;
        leaseId: string;
        unitLabel: string;
        tenantName: string;
        startDate: string;
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
        };
        landlordName: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    paidRwf: number;
    owedRwf: number;
    paidThisYearRwf: number;
    byMonth: {
        paidRwf: number;
        month: string;
        owedRwf: number;
    }[];
    fees: {
        reference: string;
        propertyName: string;
        leaseId: string;
        unitLabel: string;
        tenantName: string;
        startDate: string;
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
        };
        landlordName: string;
    }[];
}, {
    paidRwf: number;
    owedRwf: number;
    paidThisYearRwf: number;
    byMonth: {
        paidRwf: number;
        month: string;
        owedRwf: number;
    }[];
    fees: {
        reference: string;
        propertyName: string;
        leaseId: string;
        unitLabel: string;
        tenantName: string;
        startDate: string;
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
        };
        landlordName: string;
    }[];
}>;
export type BrokerEarnings = z.infer<typeof BrokerEarnings>;
export declare const BrokerReview: z.ZodObject<{
    stars: z.ZodNumber;
    comment: z.ZodNullable<z.ZodString>;
    from: z.ZodEnum<["tenant", "landlord"]>;
    /** A tenant by first name; a landlord by their business. */
    raterName: z.ZodNullable<z.ZodString>;
    propertyName: z.ZodNullable<z.ZodString>;
    ratedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    propertyName: string | null;
    from: "landlord" | "tenant";
    stars: number;
    comment: string | null;
    ratedAt: string;
    raterName: string | null;
}, {
    propertyName: string | null;
    from: "landlord" | "tenant";
    stars: number;
    comment: string | null;
    ratedAt: string;
    raterName: string | null;
}>;
export type BrokerReview = z.infer<typeof BrokerReview>;
/** `GET /ops/broker/reviews`. */
export declare const BrokerReviews: z.ZodObject<{
    average: z.ZodNullable<z.ZodNumber>;
    count: z.ZodNumber;
    /** How many ratings gave 5, 4, 3, 2 and 1 stars, in that order. */
    breakdown: z.ZodArray<z.ZodNumber, "many">;
    /** Leases they brought a tenant to that started. */
    placedCount: z.ZodNumber;
    reviews: z.ZodArray<z.ZodObject<{
        stars: z.ZodNumber;
        comment: z.ZodNullable<z.ZodString>;
        from: z.ZodEnum<["tenant", "landlord"]>;
        /** A tenant by first name; a landlord by their business. */
        raterName: z.ZodNullable<z.ZodString>;
        propertyName: z.ZodNullable<z.ZodString>;
        ratedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        propertyName: string | null;
        from: "landlord" | "tenant";
        stars: number;
        comment: string | null;
        ratedAt: string;
        raterName: string | null;
    }, {
        propertyName: string | null;
        from: "landlord" | "tenant";
        stars: number;
        comment: string | null;
        ratedAt: string;
        raterName: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    count: number;
    reviews: {
        propertyName: string | null;
        from: "landlord" | "tenant";
        stars: number;
        comment: string | null;
        ratedAt: string;
        raterName: string | null;
    }[];
    breakdown: number[];
    average: number | null;
    placedCount: number;
}, {
    count: number;
    reviews: {
        propertyName: string | null;
        from: "landlord" | "tenant";
        stars: number;
        comment: string | null;
        ratedAt: string;
        raterName: string | null;
    }[];
    breakdown: number[];
    average: number | null;
    placedCount: number;
}>;
export type BrokerReviews = z.infer<typeof BrokerReviews>;
/** `GET /ops/broker/summary`: the figures the broker home opens on. */
export declare const BrokerSummary: z.ZodObject<{
    name: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["active", "suspended"]>;
    scope: z.ZodObject<{
        plan: z.ZodEnum<["district", "province", "country"]>;
        area: z.ZodString;
        districtId: z.ZodNullable<z.ZodNumber>;
        provinceId: z.ZodNullable<z.ZodNumber>;
        needsDistrict: z.ZodBoolean;
        upgrade: z.ZodNullable<z.ZodObject<{
            plan: z.ZodEnum<["district", "province", "country"]>;
            area: z.ZodString;
            priceRwf: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            priceRwf: number;
            area: string;
            plan: "country" | "province" | "district";
        }, {
            priceRwf: number;
            area: string;
            plan: "country" | "province" | "district";
        }>>;
    }, "strip", z.ZodTypeAny, {
        provinceId: number | null;
        districtId: number | null;
        area: string;
        plan: "country" | "province" | "district";
        needsDistrict: boolean;
        upgrade: {
            priceRwf: number;
            area: string;
            plan: "country" | "province" | "district";
        } | null;
    }, {
        provinceId: number | null;
        districtId: number | null;
        area: string;
        plan: "country" | "province" | "district";
        needsDistrict: boolean;
        upgrade: {
            priceRwf: number;
            area: string;
            plan: "country" | "province" | "district";
        } | null;
    }>;
    homesInScope: z.ZodNumber;
    openPlacements: z.ZodNumber;
    owedRwf: z.ZodNumber;
    paidRwf: z.ZodNumber;
    ratingAverage: z.ZodNullable<z.ZodNumber>;
    ratingCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "active" | "suspended";
    name: string | null;
    scope: {
        provinceId: number | null;
        districtId: number | null;
        area: string;
        plan: "country" | "province" | "district";
        needsDistrict: boolean;
        upgrade: {
            priceRwf: number;
            area: string;
            plan: "country" | "province" | "district";
        } | null;
    };
    paidRwf: number;
    ratingAverage: number | null;
    ratingCount: number;
    owedRwf: number;
    homesInScope: number;
    openPlacements: number;
}, {
    status: "active" | "suspended";
    name: string | null;
    scope: {
        provinceId: number | null;
        districtId: number | null;
        area: string;
        plan: "country" | "province" | "district";
        needsDistrict: boolean;
        upgrade: {
            priceRwf: number;
            area: string;
            plan: "country" | "province" | "district";
        } | null;
    };
    paidRwf: number;
    ratingAverage: number | null;
    ratingCount: number;
    owedRwf: number;
    homesInScope: number;
    openPlacements: number;
}>;
export type BrokerSummary = z.infer<typeof BrokerSummary>;
//# sourceMappingURL=broker.d.ts.map