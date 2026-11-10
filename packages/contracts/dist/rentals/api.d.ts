import { z } from "zod";
/** Who signs leases for the business, as their ID document names them, and how tenants reach the landlord. */
export declare const LandlordSignatory: z.ZodObject<{
    name: z.ZodNullable<z.ZodString>;
    idKind: z.ZodNullable<z.ZodEnum<["national_id", "passport"]>>;
    idNumber: z.ZodNullable<z.ZodString>;
    contactPhone: z.ZodNullable<z.ZodString>;
    contactEmail: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    idNumber: string | null;
    idKind: "national_id" | "passport" | null;
}, {
    name: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    idNumber: string | null;
    idKind: "national_id" | "passport" | null;
}>;
export type LandlordSignatory = z.infer<typeof LandlordSignatory>;
/** What a new lease starts from. Each lease keeps its own copy. */
export declare const LeaseDefaults: z.ZodObject<{
    graceDays: z.ZodNumber;
    noticeDays: z.ZodNumber;
    /** Null: rent falls due on the day of the month the lease starts. */
    rentDueDay: z.ZodNullable<z.ZodNumber>;
    autoStartLeases: z.ZodBoolean;
    /** When the landlord last saved them; null while they are the starting values. */
    setAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    noticeDays: number;
    setAt: string | null;
    rentDueDay: number | null;
    graceDays: number;
    autoStartLeases: boolean;
}, {
    noticeDays: number;
    setAt: string | null;
    rentDueDay: number | null;
    graceDays: number;
    autoStartLeases: boolean;
}>;
export type LeaseDefaults = z.infer<typeof LeaseDefaults>;
/** `GET /ops/rentals/profile`. */
export declare const LandlordProfileView: z.ZodObject<{
    orgId: z.ZodString;
    workspaceId: z.ZodString;
    legalName: z.ZodString;
    tin: z.ZodNullable<z.ZodString>;
    taxpayerKind: z.ZodNullable<z.ZodEnum<["individual", "company"]>>;
    signatory: z.ZodObject<{
        name: z.ZodNullable<z.ZodString>;
        idKind: z.ZodNullable<z.ZodEnum<["national_id", "passport"]>>;
        idNumber: z.ZodNullable<z.ZodString>;
        contactPhone: z.ZodNullable<z.ZodString>;
        contactEmail: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string | null;
        contactEmail: string | null;
        contactPhone: string | null;
        idNumber: string | null;
        idKind: "national_id" | "passport" | null;
    }, {
        name: string | null;
        contactEmail: string | null;
        contactPhone: string | null;
        idNumber: string | null;
        idKind: "national_id" | "passport" | null;
    }>;
    leaseDefaults: z.ZodObject<{
        graceDays: z.ZodNumber;
        noticeDays: z.ZodNumber;
        /** Null: rent falls due on the day of the month the lease starts. */
        rentDueDay: z.ZodNullable<z.ZodNumber>;
        autoStartLeases: z.ZodBoolean;
        /** When the landlord last saved them; null while they are the starting values. */
        setAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        noticeDays: number;
        setAt: string | null;
        rentDueDay: number | null;
        graceDays: number;
        autoStartLeases: boolean;
    }, {
        noticeDays: number;
        setAt: string | null;
        rentDueDay: number | null;
        graceDays: number;
        autoStartLeases: boolean;
    }>;
    brokerFeePercent: z.ZodNullable<z.ZodNumber>;
    /** The fee a unit starts with when the landlord lets brokers offer it; null when not set. */
    brokerFee: z.ZodNullable<z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
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
    setupCompletedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    tin: string | null;
    legalName: string;
    orgId: string;
    workspaceId: string;
    brokerFee: {
        kind: "percent";
        percent: number;
    } | {
        kind: "fixed";
        amountRwf: number;
    } | null;
    taxpayerKind: "individual" | "company" | null;
    signatory: {
        name: string | null;
        contactEmail: string | null;
        contactPhone: string | null;
        idNumber: string | null;
        idKind: "national_id" | "passport" | null;
    };
    leaseDefaults: {
        noticeDays: number;
        setAt: string | null;
        rentDueDay: number | null;
        graceDays: number;
        autoStartLeases: boolean;
    };
    brokerFeePercent: number | null;
    setupCompletedAt: string | null;
}, {
    tin: string | null;
    legalName: string;
    orgId: string;
    workspaceId: string;
    brokerFee: {
        kind: "percent";
        percent: number;
    } | {
        kind: "fixed";
        amountRwf: number;
    } | null;
    taxpayerKind: "individual" | "company" | null;
    signatory: {
        name: string | null;
        contactEmail: string | null;
        contactPhone: string | null;
        idNumber: string | null;
        idKind: "national_id" | "passport" | null;
    };
    leaseDefaults: {
        noticeDays: number;
        setAt: string | null;
        rentDueDay: number | null;
        graceDays: number;
        autoStartLeases: boolean;
    };
    brokerFeePercent: number | null;
    setupCompletedAt: string | null;
}>;
export type LandlordProfileView = z.infer<typeof LandlordProfileView>;
/** `PUT /ops/rentals/profile/lease-defaults`: the whole set, so the form and the row never half agree. */
export declare const LeaseDefaultsRequest: z.ZodObject<{
    graceDays: z.ZodNumber;
    noticeDays: z.ZodNumber;
    /** Null: the day of the month each lease starts. */
    rentDueDay: z.ZodNullable<z.ZodNumber>;
    autoStartLeases: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    noticeDays: number;
    rentDueDay: number | null;
    graceDays: number;
    autoStartLeases: boolean;
}, {
    noticeDays: number;
    rentDueDay: number | null;
    graceDays: number;
    autoStartLeases: boolean;
}>;
export type LeaseDefaultsRequest = z.infer<typeof LeaseDefaultsRequest>;
/**
 * `PUT /ops/rentals/profile/signatory`: who signs leases for the business and
 * the contact a tenant sees. The contract names the signatory as typed here,
 * and the signatory types the same name to sign.
 */
export declare const SignatoryRequest: z.ZodEffects<z.ZodObject<{
    name: z.ZodString;
    idKind: z.ZodEnum<["national_id", "passport"]>;
    idNumber: z.ZodEffects<z.ZodString, string, string>;
    contactPhone: z.ZodPipeline<z.ZodEffects<z.ZodString, string | null, string>, z.ZodString>;
    contactEmail: z.ZodString;
    /** The email is right as typed, though it looks like a typo. */
    confirmEmail: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    contactEmail: string;
    contactPhone: string;
    idNumber: string;
    idKind: "national_id" | "passport";
    confirmEmail?: boolean | undefined;
}, {
    name: string;
    contactEmail: string;
    contactPhone: string;
    idNumber: string;
    idKind: "national_id" | "passport";
    confirmEmail?: boolean | undefined;
}>, {
    name: string;
    contactEmail: string;
    contactPhone: string;
    idNumber: string;
    idKind: "national_id" | "passport";
    confirmEmail?: boolean | undefined;
}, {
    name: string;
    contactEmail: string;
    contactPhone: string;
    idNumber: string;
    idKind: "national_id" | "passport";
    confirmEmail?: boolean | undefined;
}>;
export type SignatoryRequest = z.infer<typeof SignatoryRequest>;
/** The steps a new landlord goes through, in order. */
export declare const RentalsSetupStep: z.ZodEnum<["location", "units", "getting_paid", "lease_defaults", "signatory"]>;
export type RentalsSetupStep = z.infer<typeof RentalsSetupStep>;
export declare const RENTALS_SETUP_STEP_LABEL: Readonly<Record<RentalsSetupStep, string>>;
/** `GET /ops/rentals/setup`: what is done, and what is next. */
export declare const RentalsSetupView: z.ZodObject<{
    steps: z.ZodArray<z.ZodObject<{
        step: z.ZodEnum<["location", "units", "getting_paid", "lease_defaults", "signatory"]>;
        done: z.ZodBoolean;
        /** One plain line: "3 units", "MTN MoMo 078•••••456", "Add the village". */
        detail: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        detail: string;
        done: boolean;
        step: "location" | "units" | "signatory" | "getting_paid" | "lease_defaults";
    }, {
        detail: string;
        done: boolean;
        step: "location" | "units" | "signatory" | "getting_paid" | "lease_defaults";
    }>, "many">;
    /** The first step not done, or null when all are. */
    next: z.ZodNullable<z.ZodEnum<["location", "units", "getting_paid", "lease_defaults", "signatory"]>>;
    complete: z.ZodBoolean;
    setupCompletedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    complete: boolean;
    steps: {
        detail: string;
        done: boolean;
        step: "location" | "units" | "signatory" | "getting_paid" | "lease_defaults";
    }[];
    setupCompletedAt: string | null;
    next: "location" | "units" | "signatory" | "getting_paid" | "lease_defaults" | null;
}, {
    complete: boolean;
    steps: {
        detail: string;
        done: boolean;
        step: "location" | "units" | "signatory" | "getting_paid" | "lease_defaults";
    }[];
    setupCompletedAt: string | null;
    next: "location" | "units" | "signatory" | "getting_paid" | "lease_defaults" | null;
}>;
export type RentalsSetupView = z.infer<typeof RentalsSetupView>;
/**
 * One payout account, as the landlord's screen shows it. A bank account
 * number is kept encrypted and only its last four digits ever leave the API;
 * an edit sends the whole number again.
 */
export declare const PayoutAccountView: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<["bank", "momo", "momo_pay"]>;
    accountName: z.ZodString;
    bankName: z.ZodNullable<z.ZodString>;
    accountLast4: z.ZodNullable<z.ZodString>;
    momoNetwork: z.ZodNullable<z.ZodEnum<["mtn", "airtel"]>>;
    /** `+2507…`; the landlord's own number. */
    momoPhone: z.ZodNullable<z.ZodString>;
    merchantCode: z.ZodNullable<z.ZodString>;
    /** "Bank of Kigali ••••5678", "MTN MoMo 078•••••456", "MoMo Pay 12••56". */
    destination: z.ZodString;
    isPrimary: z.ZodBoolean;
    status: z.ZodEnum<["active", "retired"]>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "active" | "retired";
    id: string;
    kind: "momo" | "bank" | "momo_pay";
    createdAt: string;
    updatedAt: string;
    isPrimary: boolean;
    accountName: string;
    bankName: string | null;
    momoNetwork: "mtn" | "airtel" | null;
    momoPhone: string | null;
    merchantCode: string | null;
    destination: string;
    accountLast4: string | null;
}, {
    status: "active" | "retired";
    id: string;
    kind: "momo" | "bank" | "momo_pay";
    createdAt: string;
    updatedAt: string;
    isPrimary: boolean;
    accountName: string;
    bankName: string | null;
    momoNetwork: "mtn" | "airtel" | null;
    momoPhone: string | null;
    merchantCode: string | null;
    destination: string;
    accountLast4: string | null;
}>;
export type PayoutAccountView = z.infer<typeof PayoutAccountView>;
/** Every write answers with the whole list, so the screen redraws from one response. */
export declare const PayoutAccountList: z.ZodObject<{
    accounts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<["bank", "momo", "momo_pay"]>;
        accountName: z.ZodString;
        bankName: z.ZodNullable<z.ZodString>;
        accountLast4: z.ZodNullable<z.ZodString>;
        momoNetwork: z.ZodNullable<z.ZodEnum<["mtn", "airtel"]>>;
        /** `+2507…`; the landlord's own number. */
        momoPhone: z.ZodNullable<z.ZodString>;
        merchantCode: z.ZodNullable<z.ZodString>;
        /** "Bank of Kigali ••••5678", "MTN MoMo 078•••••456", "MoMo Pay 12••56". */
        destination: z.ZodString;
        isPrimary: z.ZodBoolean;
        status: z.ZodEnum<["active", "retired"]>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "retired";
        id: string;
        kind: "momo" | "bank" | "momo_pay";
        createdAt: string;
        updatedAt: string;
        isPrimary: boolean;
        accountName: string;
        bankName: string | null;
        momoNetwork: "mtn" | "airtel" | null;
        momoPhone: string | null;
        merchantCode: string | null;
        destination: string;
        accountLast4: string | null;
    }, {
        status: "active" | "retired";
        id: string;
        kind: "momo" | "bank" | "momo_pay";
        createdAt: string;
        updatedAt: string;
        isPrimary: boolean;
        accountName: string;
        bankName: string | null;
        momoNetwork: "mtn" | "airtel" | null;
        momoPhone: string | null;
        merchantCode: string | null;
        destination: string;
        accountLast4: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    accounts: {
        status: "active" | "retired";
        id: string;
        kind: "momo" | "bank" | "momo_pay";
        createdAt: string;
        updatedAt: string;
        isPrimary: boolean;
        accountName: string;
        bankName: string | null;
        momoNetwork: "mtn" | "airtel" | null;
        momoPhone: string | null;
        merchantCode: string | null;
        destination: string;
        accountLast4: string | null;
    }[];
}, {
    accounts: {
        status: "active" | "retired";
        id: string;
        kind: "momo" | "bank" | "momo_pay";
        createdAt: string;
        updatedAt: string;
        isPrimary: boolean;
        accountName: string;
        bankName: string | null;
        momoNetwork: "mtn" | "airtel" | null;
        momoPhone: string | null;
        merchantCode: string | null;
        destination: string;
        accountLast4: string | null;
    }[];
}>;
export type PayoutAccountList = z.infer<typeof PayoutAccountList>;
/** Whether a unit is lived in, promised, or free: worked out from its leases, never stored. */
export declare const UnitOccupancy: z.ZodEnum<["occupied", "reserved", "vacant"]>;
export type UnitOccupancy = z.infer<typeof UnitOccupancy>;
export declare const UNIT_OCCUPANCY_LABEL: Readonly<Record<UnitOccupancy, string>>;
/** The tabs of the units list. */
export declare const UnitTab: z.ZodEnum<["all", "occupied", "vacant", "off_market", "retired"]>;
export type UnitTab = z.infer<typeof UnitTab>;
export declare const UnitLeaseSummary: z.ZodObject<{
    id: z.ZodString;
    reference: z.ZodString;
    status: z.ZodEnum<["draft", "pending_signature", "signed", "active", "ending", "ended", "cancelled"]>;
    tenantName: z.ZodString;
    startDate: z.ZodEffects<z.ZodString, string, string>;
    endDate: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
    id: string;
    reference: string;
    tenantName: string;
    startDate: string;
    endDate: string;
}, {
    status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
    id: string;
    reference: string;
    tenantName: string;
    startDate: string;
    endDate: string;
}>;
export type UnitLeaseSummary = z.infer<typeof UnitLeaseSummary>;
export declare const RentalUnitView: z.ZodObject<{
    id: z.ZodString;
    propertyId: z.ZodString;
    propertyName: z.ZodString;
    blockId: z.ZodNullable<z.ZodString>;
    blockCode: z.ZodNullable<z.ZodString>;
    blockName: z.ZodNullable<z.ZodString>;
    label: z.ZodString;
    bedrooms: z.ZodNullable<z.ZodNumber>;
    bathrooms: z.ZodNullable<z.ZodNumber>;
    kitchen: z.ZodNullable<z.ZodEnum<["own", "shared", "none"]>>;
    furnished: z.ZodBoolean;
    floor: z.ZodNullable<z.ZodNumber>;
    sizeSqm: z.ZodNullable<z.ZodNumber>;
    askingRentRwf: z.ZodNullable<z.ZodNumber>;
    askingDepositRwf: z.ZodNullable<z.ZodNumber>;
    state: z.ZodEnum<["active", "off_market", "retired"]>;
    listed: z.ZodBoolean;
    /** Brokers may offer this unit, for `brokerFee`. */
    brokerOffer: z.ZodBoolean;
    brokerFee: z.ZodNullable<z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
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
    availableFrom: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
    note: z.ZodNullable<z.ZodString>;
    occupancy: z.ZodEnum<["occupied", "reserved", "vacant"]>;
    /** The lease living in it now, or the next one signed or out for signing. */
    currentLease: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        reference: z.ZodString;
        status: z.ZodEnum<["draft", "pending_signature", "signed", "active", "ending", "ended", "cancelled"]>;
        tenantName: z.ZodString;
        startDate: z.ZodEffects<z.ZodString, string, string>;
        endDate: z.ZodEffects<z.ZodString, string, string>;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
        id: string;
        reference: string;
        tenantName: string;
        startDate: string;
        endDate: string;
    }, {
        status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
        id: string;
        reference: string;
        tenantName: string;
        startDate: string;
        endDate: string;
    }>>;
    /** The day after the last lease on it ended; null while let or never let. */
    vacantSince: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
    retiredAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kitchen: "shared" | "none" | "own" | null;
    id: string;
    state: "active" | "off_market" | "retired";
    note: string | null;
    label: string;
    listed: boolean;
    createdAt: string;
    propertyName: string;
    updatedAt: string;
    propertyId: string;
    bedrooms: number | null;
    bathrooms: number | null;
    furnished: boolean;
    sizeSqm: number | null;
    availableFrom: string | null;
    floor: number | null;
    occupancy: "occupied" | "reserved" | "vacant";
    retiredAt: string | null;
    askingRentRwf: number | null;
    vacantSince: string | null;
    brokerFee: {
        kind: "percent";
        percent: number;
    } | {
        kind: "fixed";
        amountRwf: number;
    } | null;
    blockId: string | null;
    blockCode: string | null;
    blockName: string | null;
    askingDepositRwf: number | null;
    brokerOffer: boolean;
    currentLease: {
        status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
        id: string;
        reference: string;
        tenantName: string;
        startDate: string;
        endDate: string;
    } | null;
}, {
    kitchen: "shared" | "none" | "own" | null;
    id: string;
    state: "active" | "off_market" | "retired";
    note: string | null;
    label: string;
    listed: boolean;
    createdAt: string;
    propertyName: string;
    updatedAt: string;
    propertyId: string;
    bedrooms: number | null;
    bathrooms: number | null;
    furnished: boolean;
    sizeSqm: number | null;
    availableFrom: string | null;
    floor: number | null;
    occupancy: "occupied" | "reserved" | "vacant";
    retiredAt: string | null;
    askingRentRwf: number | null;
    vacantSince: string | null;
    brokerFee: {
        kind: "percent";
        percent: number;
    } | {
        kind: "fixed";
        amountRwf: number;
    } | null;
    blockId: string | null;
    blockCode: string | null;
    blockName: string | null;
    askingDepositRwf: number | null;
    brokerOffer: boolean;
    currentLease: {
        status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
        id: string;
        reference: string;
        tenantName: string;
        startDate: string;
        endDate: string;
    } | null;
}>;
export type RentalUnitView = z.infer<typeof RentalUnitView>;
/** `GET /ops/units?tab&blockId&q`. No tab: every unit not retired. */
export declare const UnitListQuery: z.ZodObject<{
    tab: z.ZodOptional<z.ZodEnum<["all", "occupied", "vacant", "off_market", "retired"]>>;
    blockId: z.ZodOptional<z.ZodString>;
    q: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    q?: string | undefined;
    tab?: "all" | "off_market" | "retired" | "occupied" | "vacant" | undefined;
    blockId?: string | undefined;
}, {
    q?: string | undefined;
    tab?: "all" | "off_market" | "retired" | "occupied" | "vacant" | undefined;
    blockId?: string | undefined;
}>;
export type UnitListQuery = z.infer<typeof UnitListQuery>;
/** `GET /ops/tenants?q`: at most this many, the most recently changed first. */
export declare const TENANT_SEARCH_LIMIT = 50;
export declare const TenantSearchQuery: z.ZodObject<{
    q: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    q?: string | undefined;
}, {
    q?: string | undefined;
}>;
export type TenantSearchQuery = z.infer<typeof TenantSearchQuery>;
export declare const RentalUnitList: z.ZodObject<{
    units: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        propertyId: z.ZodString;
        propertyName: z.ZodString;
        blockId: z.ZodNullable<z.ZodString>;
        blockCode: z.ZodNullable<z.ZodString>;
        blockName: z.ZodNullable<z.ZodString>;
        label: z.ZodString;
        bedrooms: z.ZodNullable<z.ZodNumber>;
        bathrooms: z.ZodNullable<z.ZodNumber>;
        kitchen: z.ZodNullable<z.ZodEnum<["own", "shared", "none"]>>;
        furnished: z.ZodBoolean;
        floor: z.ZodNullable<z.ZodNumber>;
        sizeSqm: z.ZodNullable<z.ZodNumber>;
        askingRentRwf: z.ZodNullable<z.ZodNumber>;
        askingDepositRwf: z.ZodNullable<z.ZodNumber>;
        state: z.ZodEnum<["active", "off_market", "retired"]>;
        listed: z.ZodBoolean;
        /** Brokers may offer this unit, for `brokerFee`. */
        brokerOffer: z.ZodBoolean;
        brokerFee: z.ZodNullable<z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
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
        availableFrom: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
        note: z.ZodNullable<z.ZodString>;
        occupancy: z.ZodEnum<["occupied", "reserved", "vacant"]>;
        /** The lease living in it now, or the next one signed or out for signing. */
        currentLease: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            reference: z.ZodString;
            status: z.ZodEnum<["draft", "pending_signature", "signed", "active", "ending", "ended", "cancelled"]>;
            tenantName: z.ZodString;
            startDate: z.ZodEffects<z.ZodString, string, string>;
            endDate: z.ZodEffects<z.ZodString, string, string>;
        }, "strip", z.ZodTypeAny, {
            status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
            id: string;
            reference: string;
            tenantName: string;
            startDate: string;
            endDate: string;
        }, {
            status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
            id: string;
            reference: string;
            tenantName: string;
            startDate: string;
            endDate: string;
        }>>;
        /** The day after the last lease on it ended; null while let or never let. */
        vacantSince: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
        retiredAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        kitchen: "shared" | "none" | "own" | null;
        id: string;
        state: "active" | "off_market" | "retired";
        note: string | null;
        label: string;
        listed: boolean;
        createdAt: string;
        propertyName: string;
        updatedAt: string;
        propertyId: string;
        bedrooms: number | null;
        bathrooms: number | null;
        furnished: boolean;
        sizeSqm: number | null;
        availableFrom: string | null;
        floor: number | null;
        occupancy: "occupied" | "reserved" | "vacant";
        retiredAt: string | null;
        askingRentRwf: number | null;
        vacantSince: string | null;
        brokerFee: {
            kind: "percent";
            percent: number;
        } | {
            kind: "fixed";
            amountRwf: number;
        } | null;
        blockId: string | null;
        blockCode: string | null;
        blockName: string | null;
        askingDepositRwf: number | null;
        brokerOffer: boolean;
        currentLease: {
            status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
            id: string;
            reference: string;
            tenantName: string;
            startDate: string;
            endDate: string;
        } | null;
    }, {
        kitchen: "shared" | "none" | "own" | null;
        id: string;
        state: "active" | "off_market" | "retired";
        note: string | null;
        label: string;
        listed: boolean;
        createdAt: string;
        propertyName: string;
        updatedAt: string;
        propertyId: string;
        bedrooms: number | null;
        bathrooms: number | null;
        furnished: boolean;
        sizeSqm: number | null;
        availableFrom: string | null;
        floor: number | null;
        occupancy: "occupied" | "reserved" | "vacant";
        retiredAt: string | null;
        askingRentRwf: number | null;
        vacantSince: string | null;
        brokerFee: {
            kind: "percent";
            percent: number;
        } | {
            kind: "fixed";
            amountRwf: number;
        } | null;
        blockId: string | null;
        blockCode: string | null;
        blockName: string | null;
        askingDepositRwf: number | null;
        brokerOffer: boolean;
        currentLease: {
            status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
            id: string;
            reference: string;
            tenantName: string;
            startDate: string;
            endDate: string;
        } | null;
    }>, "many">;
    /** How many units each tab holds, over the whole business (the search and block filter aside). */
    counts: z.ZodRecord<z.ZodEnum<["all", "occupied", "vacant", "off_market", "retired"]>, z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    counts: Partial<Record<"all" | "off_market" | "retired" | "occupied" | "vacant", number>>;
    units: {
        kitchen: "shared" | "none" | "own" | null;
        id: string;
        state: "active" | "off_market" | "retired";
        note: string | null;
        label: string;
        listed: boolean;
        createdAt: string;
        propertyName: string;
        updatedAt: string;
        propertyId: string;
        bedrooms: number | null;
        bathrooms: number | null;
        furnished: boolean;
        sizeSqm: number | null;
        availableFrom: string | null;
        floor: number | null;
        occupancy: "occupied" | "reserved" | "vacant";
        retiredAt: string | null;
        askingRentRwf: number | null;
        vacantSince: string | null;
        brokerFee: {
            kind: "percent";
            percent: number;
        } | {
            kind: "fixed";
            amountRwf: number;
        } | null;
        blockId: string | null;
        blockCode: string | null;
        blockName: string | null;
        askingDepositRwf: number | null;
        brokerOffer: boolean;
        currentLease: {
            status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
            id: string;
            reference: string;
            tenantName: string;
            startDate: string;
            endDate: string;
        } | null;
    }[];
}, {
    counts: Partial<Record<"all" | "off_market" | "retired" | "occupied" | "vacant", number>>;
    units: {
        kitchen: "shared" | "none" | "own" | null;
        id: string;
        state: "active" | "off_market" | "retired";
        note: string | null;
        label: string;
        listed: boolean;
        createdAt: string;
        propertyName: string;
        updatedAt: string;
        propertyId: string;
        bedrooms: number | null;
        bathrooms: number | null;
        furnished: boolean;
        sizeSqm: number | null;
        availableFrom: string | null;
        floor: number | null;
        occupancy: "occupied" | "reserved" | "vacant";
        retiredAt: string | null;
        askingRentRwf: number | null;
        vacantSince: string | null;
        brokerFee: {
            kind: "percent";
            percent: number;
        } | {
            kind: "fixed";
            amountRwf: number;
        } | null;
        blockId: string | null;
        blockCode: string | null;
        blockName: string | null;
        askingDepositRwf: number | null;
        brokerOffer: boolean;
        currentLease: {
            status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
            id: string;
            reference: string;
            tenantName: string;
            startDate: string;
            endDate: string;
        } | null;
    }[];
}>;
export type RentalUnitList = z.infer<typeof RentalUnitList>;
/** `POST /ops/units`. */
export declare const CreateUnitRequest: z.ZodObject<{
    propertyId: z.ZodOptional<z.ZodString>;
    blockId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    label: z.ZodString;
    bedrooms: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    bathrooms: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    kitchen: z.ZodOptional<z.ZodNullable<z.ZodEnum<["own", "shared", "none"]>>>;
    furnished: z.ZodOptional<z.ZodBoolean>;
    floor: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    sizeSqm: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    /** What the landlord asks while it is vacant. Optional, but a unit can't be listed without it. */
    askingRentRwf: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    askingDepositRwf: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    availableFrom: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    /** `retired` is its own command (`POST /ops/units/:id/retire`). */
    state: z.ZodOptional<z.ZodEnum<["active", "off_market"]>>;
    /** Brokers may offer it: needs an asking rent and a fee. */
    brokerOffer: z.ZodOptional<z.ZodBoolean>;
    /** What the landlord pays a broker who brings the tenant. Kept when brokers are switched off. */
    brokerFee: z.ZodOptional<z.ZodNullable<z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
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
    }>]>>>;
}, "strip", z.ZodTypeAny, {
    label: string;
    kitchen?: "shared" | "none" | "own" | null | undefined;
    state?: "active" | "off_market" | undefined;
    note?: string | null | undefined;
    propertyId?: string | undefined;
    bedrooms?: number | null | undefined;
    bathrooms?: number | null | undefined;
    furnished?: boolean | undefined;
    sizeSqm?: number | null | undefined;
    availableFrom?: string | null | undefined;
    floor?: number | null | undefined;
    askingRentRwf?: number | null | undefined;
    brokerFee?: {
        kind: "percent";
        percent: number;
    } | {
        kind: "fixed";
        amountRwf: number;
    } | null | undefined;
    blockId?: string | null | undefined;
    askingDepositRwf?: number | null | undefined;
    brokerOffer?: boolean | undefined;
}, {
    label: string;
    kitchen?: "shared" | "none" | "own" | null | undefined;
    state?: "active" | "off_market" | undefined;
    note?: string | null | undefined;
    propertyId?: string | undefined;
    bedrooms?: number | null | undefined;
    bathrooms?: number | null | undefined;
    furnished?: boolean | undefined;
    sizeSqm?: number | null | undefined;
    availableFrom?: string | null | undefined;
    floor?: number | null | undefined;
    askingRentRwf?: number | null | undefined;
    brokerFee?: {
        kind: "percent";
        percent: number;
    } | {
        kind: "fixed";
        amountRwf: number;
    } | null | undefined;
    blockId?: string | null | undefined;
    askingDepositRwf?: number | null | undefined;
    brokerOffer?: boolean | undefined;
}>;
export type CreateUnitRequest = z.infer<typeof CreateUnitRequest>;
/** `PATCH /ops/units/:id`: only what is sent changes. */
export declare const UpdateUnitRequest: z.ZodEffects<z.ZodObject<{
    kitchen: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodEnum<["own", "shared", "none"]>>>>;
    state: z.ZodOptional<z.ZodOptional<z.ZodEnum<["active", "off_market"]>>>;
    note: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    label: z.ZodOptional<z.ZodString>;
    bedrooms: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    bathrooms: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    furnished: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    sizeSqm: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    availableFrom: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>>>;
    floor: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    askingRentRwf: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    brokerFee: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
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
    }>]>>>>;
    blockId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    askingDepositRwf: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    brokerOffer: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    kitchen?: "shared" | "none" | "own" | null | undefined;
    state?: "active" | "off_market" | undefined;
    note?: string | null | undefined;
    label?: string | undefined;
    bedrooms?: number | null | undefined;
    bathrooms?: number | null | undefined;
    furnished?: boolean | undefined;
    sizeSqm?: number | null | undefined;
    availableFrom?: string | null | undefined;
    floor?: number | null | undefined;
    askingRentRwf?: number | null | undefined;
    brokerFee?: {
        kind: "percent";
        percent: number;
    } | {
        kind: "fixed";
        amountRwf: number;
    } | null | undefined;
    blockId?: string | null | undefined;
    askingDepositRwf?: number | null | undefined;
    brokerOffer?: boolean | undefined;
}, {
    kitchen?: "shared" | "none" | "own" | null | undefined;
    state?: "active" | "off_market" | undefined;
    note?: string | null | undefined;
    label?: string | undefined;
    bedrooms?: number | null | undefined;
    bathrooms?: number | null | undefined;
    furnished?: boolean | undefined;
    sizeSqm?: number | null | undefined;
    availableFrom?: string | null | undefined;
    floor?: number | null | undefined;
    askingRentRwf?: number | null | undefined;
    brokerFee?: {
        kind: "percent";
        percent: number;
    } | {
        kind: "fixed";
        amountRwf: number;
    } | null | undefined;
    blockId?: string | null | undefined;
    askingDepositRwf?: number | null | undefined;
    brokerOffer?: boolean | undefined;
}>, {
    kitchen?: "shared" | "none" | "own" | null | undefined;
    state?: "active" | "off_market" | undefined;
    note?: string | null | undefined;
    label?: string | undefined;
    bedrooms?: number | null | undefined;
    bathrooms?: number | null | undefined;
    furnished?: boolean | undefined;
    sizeSqm?: number | null | undefined;
    availableFrom?: string | null | undefined;
    floor?: number | null | undefined;
    askingRentRwf?: number | null | undefined;
    brokerFee?: {
        kind: "percent";
        percent: number;
    } | {
        kind: "fixed";
        amountRwf: number;
    } | null | undefined;
    blockId?: string | null | undefined;
    askingDepositRwf?: number | null | undefined;
    brokerOffer?: boolean | undefined;
}, {
    kitchen?: "shared" | "none" | "own" | null | undefined;
    state?: "active" | "off_market" | undefined;
    note?: string | null | undefined;
    label?: string | undefined;
    bedrooms?: number | null | undefined;
    bathrooms?: number | null | undefined;
    furnished?: boolean | undefined;
    sizeSqm?: number | null | undefined;
    availableFrom?: string | null | undefined;
    floor?: number | null | undefined;
    askingRentRwf?: number | null | undefined;
    brokerFee?: {
        kind: "percent";
        percent: number;
    } | {
        kind: "fixed";
        amountRwf: number;
    } | null | undefined;
    blockId?: string | null | undefined;
    askingDepositRwf?: number | null | undefined;
    brokerOffer?: boolean | undefined;
}>;
export type UpdateUnitRequest = z.infer<typeof UpdateUnitRequest>;
/** The most units one bulk add makes. */
export declare const MAX_BULK_UNITS = 200;
/**
 * `POST /ops/units/bulk`: several units with the same facts, named one by one
 * (the form makes the names from a pattern, like A-01 to A-12).
 */
export declare const BulkUnitsRequest: z.ZodEffects<z.ZodObject<{
    label: z.ZodOptional<z.ZodUndefined>;
    labels: z.ZodArray<z.ZodString, "many">;
    propertyId: z.ZodOptional<z.ZodString>;
    blockId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    bedrooms: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    bathrooms: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    kitchen: z.ZodOptional<z.ZodNullable<z.ZodEnum<["own", "shared", "none"]>>>;
    furnished: z.ZodOptional<z.ZodBoolean>;
    floor: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    sizeSqm: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    /** What the landlord asks while it is vacant. Optional, but a unit can't be listed without it. */
    askingRentRwf: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    askingDepositRwf: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    availableFrom: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    /** `retired` is its own command (`POST /ops/units/:id/retire`). */
    state: z.ZodOptional<z.ZodEnum<["active", "off_market"]>>;
    /** Brokers may offer it: needs an asking rent and a fee. */
    brokerOffer: z.ZodOptional<z.ZodBoolean>;
    /** What the landlord pays a broker who brings the tenant. Kept when brokers are switched off. */
    brokerFee: z.ZodOptional<z.ZodNullable<z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
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
    }>]>>>;
}, "strip", z.ZodTypeAny, {
    labels: string[];
    kitchen?: "shared" | "none" | "own" | null | undefined;
    state?: "active" | "off_market" | undefined;
    note?: string | null | undefined;
    label?: undefined;
    propertyId?: string | undefined;
    bedrooms?: number | null | undefined;
    bathrooms?: number | null | undefined;
    furnished?: boolean | undefined;
    sizeSqm?: number | null | undefined;
    availableFrom?: string | null | undefined;
    floor?: number | null | undefined;
    askingRentRwf?: number | null | undefined;
    brokerFee?: {
        kind: "percent";
        percent: number;
    } | {
        kind: "fixed";
        amountRwf: number;
    } | null | undefined;
    blockId?: string | null | undefined;
    askingDepositRwf?: number | null | undefined;
    brokerOffer?: boolean | undefined;
}, {
    labels: string[];
    kitchen?: "shared" | "none" | "own" | null | undefined;
    state?: "active" | "off_market" | undefined;
    note?: string | null | undefined;
    label?: undefined;
    propertyId?: string | undefined;
    bedrooms?: number | null | undefined;
    bathrooms?: number | null | undefined;
    furnished?: boolean | undefined;
    sizeSqm?: number | null | undefined;
    availableFrom?: string | null | undefined;
    floor?: number | null | undefined;
    askingRentRwf?: number | null | undefined;
    brokerFee?: {
        kind: "percent";
        percent: number;
    } | {
        kind: "fixed";
        amountRwf: number;
    } | null | undefined;
    blockId?: string | null | undefined;
    askingDepositRwf?: number | null | undefined;
    brokerOffer?: boolean | undefined;
}>, {
    labels: string[];
    kitchen?: "shared" | "none" | "own" | null | undefined;
    state?: "active" | "off_market" | undefined;
    note?: string | null | undefined;
    label?: undefined;
    propertyId?: string | undefined;
    bedrooms?: number | null | undefined;
    bathrooms?: number | null | undefined;
    furnished?: boolean | undefined;
    sizeSqm?: number | null | undefined;
    availableFrom?: string | null | undefined;
    floor?: number | null | undefined;
    askingRentRwf?: number | null | undefined;
    brokerFee?: {
        kind: "percent";
        percent: number;
    } | {
        kind: "fixed";
        amountRwf: number;
    } | null | undefined;
    blockId?: string | null | undefined;
    askingDepositRwf?: number | null | undefined;
    brokerOffer?: boolean | undefined;
}, {
    labels: string[];
    kitchen?: "shared" | "none" | "own" | null | undefined;
    state?: "active" | "off_market" | undefined;
    note?: string | null | undefined;
    label?: undefined;
    propertyId?: string | undefined;
    bedrooms?: number | null | undefined;
    bathrooms?: number | null | undefined;
    furnished?: boolean | undefined;
    sizeSqm?: number | null | undefined;
    availableFrom?: string | null | undefined;
    floor?: number | null | undefined;
    askingRentRwf?: number | null | undefined;
    brokerFee?: {
        kind: "percent";
        percent: number;
    } | {
        kind: "fixed";
        amountRwf: number;
    } | null | undefined;
    blockId?: string | null | undefined;
    askingDepositRwf?: number | null | undefined;
    brokerOffer?: boolean | undefined;
}>;
export type BulkUnitsRequest = z.infer<typeof BulkUnitsRequest>;
export declare const BulkUnitsResult: z.ZodObject<{
    created: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        propertyId: z.ZodString;
        propertyName: z.ZodString;
        blockId: z.ZodNullable<z.ZodString>;
        blockCode: z.ZodNullable<z.ZodString>;
        blockName: z.ZodNullable<z.ZodString>;
        label: z.ZodString;
        bedrooms: z.ZodNullable<z.ZodNumber>;
        bathrooms: z.ZodNullable<z.ZodNumber>;
        kitchen: z.ZodNullable<z.ZodEnum<["own", "shared", "none"]>>;
        furnished: z.ZodBoolean;
        floor: z.ZodNullable<z.ZodNumber>;
        sizeSqm: z.ZodNullable<z.ZodNumber>;
        askingRentRwf: z.ZodNullable<z.ZodNumber>;
        askingDepositRwf: z.ZodNullable<z.ZodNumber>;
        state: z.ZodEnum<["active", "off_market", "retired"]>;
        listed: z.ZodBoolean;
        /** Brokers may offer this unit, for `brokerFee`. */
        brokerOffer: z.ZodBoolean;
        brokerFee: z.ZodNullable<z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
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
        availableFrom: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
        note: z.ZodNullable<z.ZodString>;
        occupancy: z.ZodEnum<["occupied", "reserved", "vacant"]>;
        /** The lease living in it now, or the next one signed or out for signing. */
        currentLease: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            reference: z.ZodString;
            status: z.ZodEnum<["draft", "pending_signature", "signed", "active", "ending", "ended", "cancelled"]>;
            tenantName: z.ZodString;
            startDate: z.ZodEffects<z.ZodString, string, string>;
            endDate: z.ZodEffects<z.ZodString, string, string>;
        }, "strip", z.ZodTypeAny, {
            status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
            id: string;
            reference: string;
            tenantName: string;
            startDate: string;
            endDate: string;
        }, {
            status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
            id: string;
            reference: string;
            tenantName: string;
            startDate: string;
            endDate: string;
        }>>;
        /** The day after the last lease on it ended; null while let or never let. */
        vacantSince: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
        retiredAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        kitchen: "shared" | "none" | "own" | null;
        id: string;
        state: "active" | "off_market" | "retired";
        note: string | null;
        label: string;
        listed: boolean;
        createdAt: string;
        propertyName: string;
        updatedAt: string;
        propertyId: string;
        bedrooms: number | null;
        bathrooms: number | null;
        furnished: boolean;
        sizeSqm: number | null;
        availableFrom: string | null;
        floor: number | null;
        occupancy: "occupied" | "reserved" | "vacant";
        retiredAt: string | null;
        askingRentRwf: number | null;
        vacantSince: string | null;
        brokerFee: {
            kind: "percent";
            percent: number;
        } | {
            kind: "fixed";
            amountRwf: number;
        } | null;
        blockId: string | null;
        blockCode: string | null;
        blockName: string | null;
        askingDepositRwf: number | null;
        brokerOffer: boolean;
        currentLease: {
            status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
            id: string;
            reference: string;
            tenantName: string;
            startDate: string;
            endDate: string;
        } | null;
    }, {
        kitchen: "shared" | "none" | "own" | null;
        id: string;
        state: "active" | "off_market" | "retired";
        note: string | null;
        label: string;
        listed: boolean;
        createdAt: string;
        propertyName: string;
        updatedAt: string;
        propertyId: string;
        bedrooms: number | null;
        bathrooms: number | null;
        furnished: boolean;
        sizeSqm: number | null;
        availableFrom: string | null;
        floor: number | null;
        occupancy: "occupied" | "reserved" | "vacant";
        retiredAt: string | null;
        askingRentRwf: number | null;
        vacantSince: string | null;
        brokerFee: {
            kind: "percent";
            percent: number;
        } | {
            kind: "fixed";
            amountRwf: number;
        } | null;
        blockId: string | null;
        blockCode: string | null;
        blockName: string | null;
        askingDepositRwf: number | null;
        brokerOffer: boolean;
        currentLease: {
            status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
            id: string;
            reference: string;
            tenantName: string;
            startDate: string;
            endDate: string;
        } | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    created: {
        kitchen: "shared" | "none" | "own" | null;
        id: string;
        state: "active" | "off_market" | "retired";
        note: string | null;
        label: string;
        listed: boolean;
        createdAt: string;
        propertyName: string;
        updatedAt: string;
        propertyId: string;
        bedrooms: number | null;
        bathrooms: number | null;
        furnished: boolean;
        sizeSqm: number | null;
        availableFrom: string | null;
        floor: number | null;
        occupancy: "occupied" | "reserved" | "vacant";
        retiredAt: string | null;
        askingRentRwf: number | null;
        vacantSince: string | null;
        brokerFee: {
            kind: "percent";
            percent: number;
        } | {
            kind: "fixed";
            amountRwf: number;
        } | null;
        blockId: string | null;
        blockCode: string | null;
        blockName: string | null;
        askingDepositRwf: number | null;
        brokerOffer: boolean;
        currentLease: {
            status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
            id: string;
            reference: string;
            tenantName: string;
            startDate: string;
            endDate: string;
        } | null;
    }[];
}, {
    created: {
        kitchen: "shared" | "none" | "own" | null;
        id: string;
        state: "active" | "off_market" | "retired";
        note: string | null;
        label: string;
        listed: boolean;
        createdAt: string;
        propertyName: string;
        updatedAt: string;
        propertyId: string;
        bedrooms: number | null;
        bathrooms: number | null;
        furnished: boolean;
        sizeSqm: number | null;
        availableFrom: string | null;
        floor: number | null;
        occupancy: "occupied" | "reserved" | "vacant";
        retiredAt: string | null;
        askingRentRwf: number | null;
        vacantSince: string | null;
        brokerFee: {
            kind: "percent";
            percent: number;
        } | {
            kind: "fixed";
            amountRwf: number;
        } | null;
        blockId: string | null;
        blockCode: string | null;
        blockName: string | null;
        askingDepositRwf: number | null;
        brokerOffer: boolean;
        currentLease: {
            status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
            id: string;
            reference: string;
            tenantName: string;
            startDate: string;
            endDate: string;
        } | null;
    }[];
}>;
export type BulkUnitsResult = z.infer<typeof BulkUnitsResult>;
export declare const BlockView: z.ZodObject<{
    id: z.ZodString;
    propertyId: z.ZodString;
    code: z.ZodString;
    name: z.ZodString;
    kind: z.ZodNullable<z.ZodString>;
    sortOrder: z.ZodNumber;
    /** Units in it that are not retired. */
    unitCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    code: string;
    name: string;
    id: string;
    kind: string | null;
    sortOrder: number;
    propertyId: string;
    unitCount: number;
}, {
    code: string;
    name: string;
    id: string;
    kind: string | null;
    sortOrder: number;
    propertyId: string;
    unitCount: number;
}>;
export type BlockView = z.infer<typeof BlockView>;
export declare const BlockList: z.ZodObject<{
    blocks: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        propertyId: z.ZodString;
        code: z.ZodString;
        name: z.ZodString;
        kind: z.ZodNullable<z.ZodString>;
        sortOrder: z.ZodNumber;
        /** Units in it that are not retired. */
        unitCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        code: string;
        name: string;
        id: string;
        kind: string | null;
        sortOrder: number;
        propertyId: string;
        unitCount: number;
    }, {
        code: string;
        name: string;
        id: string;
        kind: string | null;
        sortOrder: number;
        propertyId: string;
        unitCount: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    blocks: {
        code: string;
        name: string;
        id: string;
        kind: string | null;
        sortOrder: number;
        propertyId: string;
        unitCount: number;
    }[];
}, {
    blocks: {
        code: string;
        name: string;
        id: string;
        kind: string | null;
        sortOrder: number;
        propertyId: string;
        unitCount: number;
    }[];
}>;
export type BlockList = z.infer<typeof BlockList>;
/** `POST /ops/blocks`. */
export declare const CreateBlockRequest: z.ZodObject<{
    propertyId: z.ZodOptional<z.ZodString>;
    /** "A": what unit names in it start with. */
    code: z.ZodString;
    name: z.ZodString;
    kind: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sortOrder: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    code: string;
    name: string;
    kind?: string | null | undefined;
    sortOrder?: number | undefined;
    propertyId?: string | undefined;
}, {
    code: string;
    name: string;
    kind?: string | null | undefined;
    sortOrder?: number | undefined;
    propertyId?: string | undefined;
}>;
export type CreateBlockRequest = z.infer<typeof CreateBlockRequest>;
/** `PATCH /ops/blocks/:id`. */
export declare const UpdateBlockRequest: z.ZodEffects<z.ZodObject<{
    code: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    kind: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    sortOrder: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    code?: string | undefined;
    name?: string | undefined;
    kind?: string | null | undefined;
    sortOrder?: number | undefined;
}, {
    code?: string | undefined;
    name?: string | undefined;
    kind?: string | null | undefined;
    sortOrder?: number | undefined;
}>, {
    code?: string | undefined;
    name?: string | undefined;
    kind?: string | null | undefined;
    sortOrder?: number | undefined;
}, {
    code?: string | undefined;
    name?: string | undefined;
    kind?: string | null | undefined;
    sortOrder?: number | undefined;
}>;
export type UpdateBlockRequest = z.infer<typeof UpdateBlockRequest>;
export declare const TenantLeaseSummary: z.ZodObject<{
    id: z.ZodString;
    reference: z.ZodString;
    status: z.ZodEnum<["draft", "pending_signature", "signed", "active", "ending", "ended", "cancelled"]>;
    unitLabel: z.ZodString;
    startDate: z.ZodEffects<z.ZodString, string, string>;
    endDate: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
    id: string;
    reference: string;
    unitLabel: string;
    startDate: string;
    endDate: string;
}, {
    status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
    id: string;
    reference: string;
    unitLabel: string;
    startDate: string;
    endDate: string;
}>;
export type TenantLeaseSummary = z.infer<typeof TenantLeaseSummary>;
/** A tenant as one landlord business knows them. */
export declare const TenantView: z.ZodObject<{
    id: z.ZodString;
    fullName: z.ZodString;
    email: z.ZodNullable<z.ZodString>;
    phone: z.ZodNullable<z.ZodString>;
    idKind: z.ZodNullable<z.ZodEnum<["national_id", "passport"]>>;
    idNumber: z.ZodNullable<z.ZodString>;
    nationality: z.ZodNullable<z.ZodString>;
    /** They accepted an invitation and signed in. */
    hasAccount: z.ZodBoolean;
    /** False once they signed a contract: what they signed names them as they were. */
    editable: z.ZodBoolean;
    leases: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        reference: z.ZodString;
        status: z.ZodEnum<["draft", "pending_signature", "signed", "active", "ending", "ended", "cancelled"]>;
        unitLabel: z.ZodString;
        startDate: z.ZodEffects<z.ZodString, string, string>;
        endDate: z.ZodEffects<z.ZodString, string, string>;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
        id: string;
        reference: string;
        unitLabel: string;
        startDate: string;
        endDate: string;
    }, {
        status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
        id: string;
        reference: string;
        unitLabel: string;
        startDate: string;
        endDate: string;
    }>, "many">;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    createdAt: string;
    updatedAt: string;
    idNumber: string | null;
    nationality: string | null;
    leases: {
        status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
        id: string;
        reference: string;
        unitLabel: string;
        startDate: string;
        endDate: string;
    }[];
    hasAccount: boolean;
    idKind: "national_id" | "passport" | null;
    editable: boolean;
}, {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    createdAt: string;
    updatedAt: string;
    idNumber: string | null;
    nationality: string | null;
    leases: {
        status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
        id: string;
        reference: string;
        unitLabel: string;
        startDate: string;
        endDate: string;
    }[];
    hasAccount: boolean;
    idKind: "national_id" | "passport" | null;
    editable: boolean;
}>;
export type TenantView = z.infer<typeof TenantView>;
export declare const TenantList: z.ZodObject<{
    tenants: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        fullName: z.ZodString;
        email: z.ZodNullable<z.ZodString>;
        phone: z.ZodNullable<z.ZodString>;
        idKind: z.ZodNullable<z.ZodEnum<["national_id", "passport"]>>;
        idNumber: z.ZodNullable<z.ZodString>;
        nationality: z.ZodNullable<z.ZodString>;
        /** They accepted an invitation and signed in. */
        hasAccount: z.ZodBoolean;
        /** False once they signed a contract: what they signed names them as they were. */
        editable: z.ZodBoolean;
        leases: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            reference: z.ZodString;
            status: z.ZodEnum<["draft", "pending_signature", "signed", "active", "ending", "ended", "cancelled"]>;
            unitLabel: z.ZodString;
            startDate: z.ZodEffects<z.ZodString, string, string>;
            endDate: z.ZodEffects<z.ZodString, string, string>;
        }, "strip", z.ZodTypeAny, {
            status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
            id: string;
            reference: string;
            unitLabel: string;
            startDate: string;
            endDate: string;
        }, {
            status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
            id: string;
            reference: string;
            unitLabel: string;
            startDate: string;
            endDate: string;
        }>, "many">;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        fullName: string;
        email: string | null;
        phone: string | null;
        createdAt: string;
        updatedAt: string;
        idNumber: string | null;
        nationality: string | null;
        leases: {
            status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
            id: string;
            reference: string;
            unitLabel: string;
            startDate: string;
            endDate: string;
        }[];
        hasAccount: boolean;
        idKind: "national_id" | "passport" | null;
        editable: boolean;
    }, {
        id: string;
        fullName: string;
        email: string | null;
        phone: string | null;
        createdAt: string;
        updatedAt: string;
        idNumber: string | null;
        nationality: string | null;
        leases: {
            status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
            id: string;
            reference: string;
            unitLabel: string;
            startDate: string;
            endDate: string;
        }[];
        hasAccount: boolean;
        idKind: "national_id" | "passport" | null;
        editable: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    tenants: {
        id: string;
        fullName: string;
        email: string | null;
        phone: string | null;
        createdAt: string;
        updatedAt: string;
        idNumber: string | null;
        nationality: string | null;
        leases: {
            status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
            id: string;
            reference: string;
            unitLabel: string;
            startDate: string;
            endDate: string;
        }[];
        hasAccount: boolean;
        idKind: "national_id" | "passport" | null;
        editable: boolean;
    }[];
}, {
    tenants: {
        id: string;
        fullName: string;
        email: string | null;
        phone: string | null;
        createdAt: string;
        updatedAt: string;
        idNumber: string | null;
        nationality: string | null;
        leases: {
            status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
            id: string;
            reference: string;
            unitLabel: string;
            startDate: string;
            endDate: string;
        }[];
        hasAccount: boolean;
        idKind: "national_id" | "passport" | null;
        editable: boolean;
    }[];
}>;
export type TenantList = z.infer<typeof TenantList>;
/** One row of the lease list. */
export declare const LeaseListItem: z.ZodObject<{
    id: z.ZodString;
    reference: z.ZodString;
    status: z.ZodEnum<["draft", "pending_signature", "signed", "active", "ending", "ended", "cancelled"]>;
    tab: z.ZodEnum<["to_sign", "waiting_for_tenant", "ready_to_start", "active", "ending", "ended", "cancelled"]>;
    tenant: z.ZodObject<{
        id: z.ZodString;
        fullName: z.ZodString;
        email: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        fullName: string;
        email: string | null;
    }, {
        id: string;
        fullName: string;
        email: string | null;
    }>;
    unit: z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        blockCode: z.ZodNullable<z.ZodString>;
        propertyName: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        label: string;
        propertyName: string;
        blockCode: string | null;
    }, {
        id: string;
        label: string;
        propertyName: string;
        blockCode: string | null;
    }>;
    monthlyRentRwf: z.ZodNumber;
    startDate: z.ZodEffects<z.ZodString, string, string>;
    endDate: z.ZodEffects<z.ZodString, string, string>;
    /** What to do next, in words ("Review and sign", "Waiting for the tenant to sign"). */
    nextAction: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
    id: string;
    reference: string;
    tenant: {
        id: string;
        fullName: string;
        email: string | null;
    };
    unit: {
        id: string;
        label: string;
        propertyName: string;
        blockCode: string | null;
    };
    createdAt: string;
    updatedAt: string;
    monthlyRentRwf: number;
    startDate: string;
    endDate: string;
    tab: "active" | "cancelled" | "ending" | "ended" | "to_sign" | "waiting_for_tenant" | "ready_to_start";
    nextAction: string | null;
}, {
    status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
    id: string;
    reference: string;
    tenant: {
        id: string;
        fullName: string;
        email: string | null;
    };
    unit: {
        id: string;
        label: string;
        propertyName: string;
        blockCode: string | null;
    };
    createdAt: string;
    updatedAt: string;
    monthlyRentRwf: number;
    startDate: string;
    endDate: string;
    tab: "active" | "cancelled" | "ending" | "ended" | "to_sign" | "waiting_for_tenant" | "ready_to_start";
    nextAction: string | null;
}>;
export type LeaseListItem = z.infer<typeof LeaseListItem>;
/** The lease list's page size. */
export declare const LEASE_PAGE_SIZE = 25;
export declare const LeaseListPage: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        reference: z.ZodString;
        status: z.ZodEnum<["draft", "pending_signature", "signed", "active", "ending", "ended", "cancelled"]>;
        tab: z.ZodEnum<["to_sign", "waiting_for_tenant", "ready_to_start", "active", "ending", "ended", "cancelled"]>;
        tenant: z.ZodObject<{
            id: z.ZodString;
            fullName: z.ZodString;
            email: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            fullName: string;
            email: string | null;
        }, {
            id: string;
            fullName: string;
            email: string | null;
        }>;
        unit: z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            blockCode: z.ZodNullable<z.ZodString>;
            propertyName: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            label: string;
            propertyName: string;
            blockCode: string | null;
        }, {
            id: string;
            label: string;
            propertyName: string;
            blockCode: string | null;
        }>;
        monthlyRentRwf: z.ZodNumber;
        startDate: z.ZodEffects<z.ZodString, string, string>;
        endDate: z.ZodEffects<z.ZodString, string, string>;
        /** What to do next, in words ("Review and sign", "Waiting for the tenant to sign"). */
        nextAction: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
        id: string;
        reference: string;
        tenant: {
            id: string;
            fullName: string;
            email: string | null;
        };
        unit: {
            id: string;
            label: string;
            propertyName: string;
            blockCode: string | null;
        };
        createdAt: string;
        updatedAt: string;
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        tab: "active" | "cancelled" | "ending" | "ended" | "to_sign" | "waiting_for_tenant" | "ready_to_start";
        nextAction: string | null;
    }, {
        status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
        id: string;
        reference: string;
        tenant: {
            id: string;
            fullName: string;
            email: string | null;
        };
        unit: {
            id: string;
            label: string;
            propertyName: string;
            blockCode: string | null;
        };
        createdAt: string;
        updatedAt: string;
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        tab: "active" | "cancelled" | "ending" | "ended" | "to_sign" | "waiting_for_tenant" | "ready_to_start";
        nextAction: string | null;
    }>, "many">;
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodNumber;
    tab: z.ZodNullable<z.ZodEnum<["to_sign", "waiting_for_tenant", "ready_to_start", "active", "ending", "ended", "cancelled"]>>;
}, "strip", z.ZodTypeAny, {
    items: {
        status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
        id: string;
        reference: string;
        tenant: {
            id: string;
            fullName: string;
            email: string | null;
        };
        unit: {
            id: string;
            label: string;
            propertyName: string;
            blockCode: string | null;
        };
        createdAt: string;
        updatedAt: string;
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        tab: "active" | "cancelled" | "ending" | "ended" | "to_sign" | "waiting_for_tenant" | "ready_to_start";
        nextAction: string | null;
    }[];
    total: number;
    page: number;
    pageSize: number;
    tab: "active" | "cancelled" | "ending" | "ended" | "to_sign" | "waiting_for_tenant" | "ready_to_start" | null;
}, {
    items: {
        status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
        id: string;
        reference: string;
        tenant: {
            id: string;
            fullName: string;
            email: string | null;
        };
        unit: {
            id: string;
            label: string;
            propertyName: string;
            blockCode: string | null;
        };
        createdAt: string;
        updatedAt: string;
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        tab: "active" | "cancelled" | "ending" | "ended" | "to_sign" | "waiting_for_tenant" | "ready_to_start";
        nextAction: string | null;
    }[];
    total: number;
    page: number;
    pageSize: number;
    tab: "active" | "cancelled" | "ending" | "ended" | "to_sign" | "waiting_for_tenant" | "ready_to_start" | null;
}>;
export type LeaseListPage = z.infer<typeof LeaseListPage>;
/** `GET /ops/leases?tab&q&page`. No tab: every lease. */
export declare const LeaseListQuery: z.ZodObject<{
    tab: z.ZodOptional<z.ZodEnum<["to_sign", "waiting_for_tenant", "ready_to_start", "active", "ending", "ended", "cancelled"]>>;
    q: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    q?: string | undefined;
    tab?: "active" | "cancelled" | "ending" | "ended" | "to_sign" | "waiting_for_tenant" | "ready_to_start" | undefined;
}, {
    q?: string | undefined;
    page?: number | undefined;
    tab?: "active" | "cancelled" | "ending" | "ended" | "to_sign" | "waiting_for_tenant" | "ready_to_start" | undefined;
}>;
export type LeaseListQuery = z.infer<typeof LeaseListQuery>;
/** `GET /ops/leases/counts`: how many leases each tab holds. */
export declare const LeaseCounts: z.ZodObject<{
    counts: z.ZodRecord<z.ZodEnum<["to_sign", "waiting_for_tenant", "ready_to_start", "active", "ending", "ended", "cancelled"]>, z.ZodNumber>;
    total: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    total: number;
    counts: Partial<Record<"active" | "cancelled" | "ending" | "ended" | "to_sign" | "waiting_for_tenant" | "ready_to_start", number>>;
}, {
    total: number;
    counts: Partial<Record<"active" | "cancelled" | "ending" | "ended" | "to_sign" | "waiting_for_tenant" | "ready_to_start", number>>;
}>;
export type LeaseCounts = z.infer<typeof LeaseCounts>;
export declare const LeaseTermsView: z.ZodObject<{
    startDate: z.ZodEffects<z.ZodString, string, string>;
    endDate: z.ZodEffects<z.ZodString, string, string>;
    billingStartsOn: z.ZodEffects<z.ZodString, string, string>;
    monthlyRentRwf: z.ZodNumber;
    depositRwf: z.ZodNumber;
    rentDueDay: z.ZodNumber;
    graceDays: z.ZodNumber;
    noticeDays: z.ZodNumber;
    occupants: z.ZodArray<z.ZodString, "many">;
    otherTerms: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    monthlyRentRwf: number;
    startDate: string;
    endDate: string;
    billingStartsOn: string;
    noticeDays: number;
    depositRwf: number;
    rentDueDay: number;
    graceDays: number;
    occupants: string[];
    otherTerms: string | null;
}, {
    monthlyRentRwf: number;
    startDate: string;
    endDate: string;
    billingStartsOn: string;
    noticeDays: number;
    depositRwf: number;
    rentDueDay: number;
    graceDays: number;
    occupants: string[];
    otherTerms: string | null;
}>;
export type LeaseTermsView = z.infer<typeof LeaseTermsView>;
export declare const LeaseSignatureView: z.ZodObject<{
    id: z.ZodString;
    role: z.ZodEnum<["landlord", "tenant"]>;
    version: z.ZodNumber;
    typedName: z.ZodNullable<z.ZodString>;
    method: z.ZodEnum<["email_code", "password", "legacy"]>;
    signedAt: z.ZodString;
    voidedAt: z.ZodNullable<z.ZodString>;
    note: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    role: "landlord" | "tenant";
    note: string | null;
    version: number;
    method: "email_code" | "password" | "legacy";
    signedAt: string;
    typedName: string | null;
    voidedAt: string | null;
}, {
    id: string;
    role: "landlord" | "tenant";
    note: string | null;
    version: number;
    method: "email_code" | "password" | "legacy";
    signedAt: string;
    typedName: string | null;
    voidedAt: string | null;
}>;
export type LeaseSignatureView = z.infer<typeof LeaseSignatureView>;
export declare const LeaseVersionSummary: z.ZodObject<{
    id: z.ZodString;
    version: z.ZodNumber;
    templateVersion: z.ZodNumber;
    contentHash: z.ZodString;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    version: number;
    templateVersion: number;
    contentHash: string;
}, {
    id: string;
    createdAt: string;
    version: number;
    templateVersion: number;
    contentHash: string;
}>;
export type LeaseVersionSummary = z.infer<typeof LeaseVersionSummary>;
export declare const LeaseInvitationView: z.ZodObject<{
    status: z.ZodEnum<["sent", "accepted", "expired", "revoked"]>;
    email: z.ZodString;
    sentAt: z.ZodString;
    lastSentAt: z.ZodString;
    sendCount: z.ZodNumber;
    expiresAt: z.ZodString;
    acceptedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "expired" | "sent" | "accepted" | "revoked";
    expiresAt: string;
    email: string;
    sentAt: string;
    lastSentAt: string;
    sendCount: number;
    acceptedAt: string | null;
}, {
    status: "expired" | "sent" | "accepted" | "revoked";
    expiresAt: string;
    email: string;
    sentAt: string;
    lastSentAt: string;
    sendCount: number;
    acceptedAt: string | null;
}>;
export type LeaseInvitationView = z.infer<typeof LeaseInvitationView>;
/** What the lease has asked for and been paid so far. */
export declare const LeaseChargesSummary: z.ZodObject<{
    /** Rent charges raised so far. */
    rentChargedRwf: z.ZodNumber;
    rentPaidRwf: z.ZodNumber;
    /** Open rent past its due day plus grace. */
    overdueRwf: z.ZodNumber;
    /** What is owed now: open charges (rent and deposit) already due. One raised ahead is `nextDue`. */
    balanceRwf: z.ZodNumber;
    nextDue: z.ZodNullable<z.ZodObject<{
        dueOn: z.ZodEffects<z.ZodString, string, string>;
        amountRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        amountRwf: number;
        dueOn: string;
    }, {
        amountRwf: number;
        dueOn: string;
    }>>;
    depositAgreedRwf: z.ZodNumber;
    depositStatus: z.ZodNullable<z.ZodEnum<["awaiting", "held", "settled"]>>;
}, "strip", z.ZodTypeAny, {
    balanceRwf: number;
    rentChargedRwf: number;
    rentPaidRwf: number;
    overdueRwf: number;
    nextDue: {
        amountRwf: number;
        dueOn: string;
    } | null;
    depositAgreedRwf: number;
    depositStatus: "held" | "settled" | "awaiting" | null;
}, {
    balanceRwf: number;
    rentChargedRwf: number;
    rentPaidRwf: number;
    overdueRwf: number;
    nextDue: {
        amountRwf: number;
        dueOn: string;
    } | null;
    depositAgreedRwf: number;
    depositStatus: "held" | "settled" | "awaiting" | null;
}>;
export type LeaseChargesSummary = z.infer<typeof LeaseChargesSummary>;
/** `GET /ops/leases/:id`: the lease record. */
export declare const LeaseDetail: z.ZodObject<{
    id: z.ZodString;
    reference: z.ZodString;
    status: z.ZodEnum<["draft", "pending_signature", "signed", "active", "ending", "ended", "cancelled"]>;
    tab: z.ZodEnum<["to_sign", "waiting_for_tenant", "ready_to_start", "active", "ending", "ended", "cancelled"]>;
    /** The moves this lease allows now (`LEASE_TRANSITIONS`). */
    actions: z.ZodArray<z.ZodEnum<["landlord_sign", "edit_terms", "tenant_sign", "start", "cancel", "acknowledge_notice", "near_end", "withdraw_notice", "record_move_out"]>, "many">;
    nextAction: z.ZodNullable<z.ZodString>;
    property: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
    }, {
        name: string;
        id: string;
    }>;
    unit: z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        blockCode: z.ZodNullable<z.ZodString>;
        blockName: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        label: string;
        blockCode: string | null;
        blockName: string | null;
    }, {
        id: string;
        label: string;
        blockCode: string | null;
        blockName: string | null;
    }>;
    tenant: z.ZodObject<Omit<{
        id: z.ZodString;
        fullName: z.ZodString;
        email: z.ZodNullable<z.ZodString>;
        phone: z.ZodNullable<z.ZodString>;
        idKind: z.ZodNullable<z.ZodEnum<["national_id", "passport"]>>;
        idNumber: z.ZodNullable<z.ZodString>;
        nationality: z.ZodNullable<z.ZodString>;
        /** They accepted an invitation and signed in. */
        hasAccount: z.ZodBoolean;
        /** False once they signed a contract: what they signed names them as they were. */
        editable: z.ZodBoolean;
        leases: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            reference: z.ZodString;
            status: z.ZodEnum<["draft", "pending_signature", "signed", "active", "ending", "ended", "cancelled"]>;
            unitLabel: z.ZodString;
            startDate: z.ZodEffects<z.ZodString, string, string>;
            endDate: z.ZodEffects<z.ZodString, string, string>;
        }, "strip", z.ZodTypeAny, {
            status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
            id: string;
            reference: string;
            unitLabel: string;
            startDate: string;
            endDate: string;
        }, {
            status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
            id: string;
            reference: string;
            unitLabel: string;
            startDate: string;
            endDate: string;
        }>, "many">;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "leases">, "strip", z.ZodTypeAny, {
        id: string;
        fullName: string;
        email: string | null;
        phone: string | null;
        createdAt: string;
        updatedAt: string;
        idNumber: string | null;
        nationality: string | null;
        hasAccount: boolean;
        idKind: "national_id" | "passport" | null;
        editable: boolean;
    }, {
        id: string;
        fullName: string;
        email: string | null;
        phone: string | null;
        createdAt: string;
        updatedAt: string;
        idNumber: string | null;
        nationality: string | null;
        hasAccount: boolean;
        idKind: "national_id" | "passport" | null;
        editable: boolean;
    }>;
    terms: z.ZodObject<{
        startDate: z.ZodEffects<z.ZodString, string, string>;
        endDate: z.ZodEffects<z.ZodString, string, string>;
        billingStartsOn: z.ZodEffects<z.ZodString, string, string>;
        monthlyRentRwf: z.ZodNumber;
        depositRwf: z.ZodNumber;
        rentDueDay: z.ZodNumber;
        graceDays: z.ZodNumber;
        noticeDays: z.ZodNumber;
        occupants: z.ZodArray<z.ZodString, "many">;
        otherTerms: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        billingStartsOn: string;
        noticeDays: number;
        depositRwf: number;
        rentDueDay: number;
        graceDays: number;
        occupants: string[];
        otherTerms: string | null;
    }, {
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        billingStartsOn: string;
        noticeDays: number;
        depositRwf: number;
        rentDueDay: number;
        graceDays: number;
        occupants: string[];
        otherTerms: string | null;
    }>;
    currentVersion: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        version: z.ZodNumber;
        templateVersion: z.ZodNumber;
        contentHash: z.ZodString;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        createdAt: string;
        version: number;
        templateVersion: number;
        contentHash: string;
    }, {
        id: string;
        createdAt: string;
        version: number;
        templateVersion: number;
        contentHash: string;
    }>>;
    signatures: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        role: z.ZodEnum<["landlord", "tenant"]>;
        version: z.ZodNumber;
        typedName: z.ZodNullable<z.ZodString>;
        method: z.ZodEnum<["email_code", "password", "legacy"]>;
        signedAt: z.ZodString;
        voidedAt: z.ZodNullable<z.ZodString>;
        note: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        role: "landlord" | "tenant";
        note: string | null;
        version: number;
        method: "email_code" | "password" | "legacy";
        signedAt: string;
        typedName: string | null;
        voidedAt: string | null;
    }, {
        id: string;
        role: "landlord" | "tenant";
        note: string | null;
        version: number;
        method: "email_code" | "password" | "legacy";
        signedAt: string;
        typedName: string | null;
        voidedAt: string | null;
    }>, "many">;
    invitation: z.ZodNullable<z.ZodObject<{
        status: z.ZodEnum<["sent", "accepted", "expired", "revoked"]>;
        email: z.ZodString;
        sentAt: z.ZodString;
        lastSentAt: z.ZodString;
        sendCount: z.ZodNumber;
        expiresAt: z.ZodString;
        acceptedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "expired" | "sent" | "accepted" | "revoked";
        expiresAt: string;
        email: string;
        sentAt: string;
        lastSentAt: string;
        sendCount: number;
        acceptedAt: string | null;
    }, {
        status: "expired" | "sent" | "accepted" | "revoked";
        expiresAt: string;
        email: string;
        sentAt: string;
        lastSentAt: string;
        sendCount: number;
        acceptedAt: string | null;
    }>>;
    charges: z.ZodObject<{
        /** Rent charges raised so far. */
        rentChargedRwf: z.ZodNumber;
        rentPaidRwf: z.ZodNumber;
        /** Open rent past its due day plus grace. */
        overdueRwf: z.ZodNumber;
        /** What is owed now: open charges (rent and deposit) already due. One raised ahead is `nextDue`. */
        balanceRwf: z.ZodNumber;
        nextDue: z.ZodNullable<z.ZodObject<{
            dueOn: z.ZodEffects<z.ZodString, string, string>;
            amountRwf: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            amountRwf: number;
            dueOn: string;
        }, {
            amountRwf: number;
            dueOn: string;
        }>>;
        depositAgreedRwf: z.ZodNumber;
        depositStatus: z.ZodNullable<z.ZodEnum<["awaiting", "held", "settled"]>>;
    }, "strip", z.ZodTypeAny, {
        balanceRwf: number;
        rentChargedRwf: number;
        rentPaidRwf: number;
        overdueRwf: number;
        nextDue: {
            amountRwf: number;
            dueOn: string;
        } | null;
        depositAgreedRwf: number;
        depositStatus: "held" | "settled" | "awaiting" | null;
    }, {
        balanceRwf: number;
        rentChargedRwf: number;
        rentPaidRwf: number;
        overdueRwf: number;
        nextDue: {
            amountRwf: number;
            dueOn: string;
        } | null;
        depositAgreedRwf: number;
        depositStatus: "held" | "settled" | "awaiting" | null;
    }>;
    /** What still has to be filled in before the landlord can sign, in words. Empty when ready. */
    contractProblems: z.ZodArray<z.ZodString, "many">;
    broker: z.ZodNullable<z.ZodObject<{
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
        id: string;
        phone: string | null;
        rating: {
            stars: number;
            comment: string | null;
            ratedAt: string;
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
        placementId: string | null;
        canRate: boolean;
    }, {
        name: string | null;
        id: string;
        phone: string | null;
        rating: {
            stars: number;
            comment: string | null;
            ratedAt: string;
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
        placementId: string | null;
        canRate: boolean;
    }>>;
    /** The live move out notice (submitted or acknowledged), if any (WP 1.7). */
    notice: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        givenBy: z.ZodEnum<["landlord", "tenant"]>;
        channel: z.ZodEnum<["app", "letter", "email", "in_person"]>;
        filedOn: z.ZodEffects<z.ZodString, string, string>;
        moveOutOn: z.ZodEffects<z.ZodString, string, string>;
        reasonCode: z.ZodEnum<["moving_in_kigali", "leaving_kigali", "own_home", "cost", "terms", "landlord_use", "tenant_breach", "other"]>;
        message: z.ZodNullable<z.ZodString>;
        noticeDays: z.ZodNumber;
        isShortNotice: z.ZodBoolean;
        status: z.ZodEnum<["submitted", "acknowledged", "withdrawn"]>;
        acknowledgedAt: z.ZodNullable<z.ZodString>;
        withdrawnAt: z.ZodNullable<z.ZodString>;
        filedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        message: string | null;
        status: "submitted" | "withdrawn" | "acknowledged";
        id: string;
        reasonCode: "other" | "moving_in_kigali" | "leaving_kigali" | "own_home" | "cost" | "terms" | "landlord_use" | "tenant_breach";
        withdrawnAt: string | null;
        channel: "email" | "app" | "letter" | "in_person";
        noticeDays: number;
        filedAt: string;
        isShortNotice: boolean;
        moveOutOn: string;
        givenBy: "landlord" | "tenant";
        filedOn: string;
        acknowledgedAt: string | null;
    }, {
        message: string | null;
        status: "submitted" | "withdrawn" | "acknowledged";
        id: string;
        reasonCode: "other" | "moving_in_kigali" | "leaving_kigali" | "own_home" | "cost" | "terms" | "landlord_use" | "tenant_breach";
        withdrawnAt: string | null;
        channel: "email" | "app" | "letter" | "in_person";
        noticeDays: number;
        filedAt: string;
        isShortNotice: boolean;
        moveOutOn: string;
        givenBy: "landlord" | "tenant";
        filedOn: string;
        acknowledgedAt: string | null;
    }>>;
    /** The deposit record, once the tenant signed (WP 1.7). */
    deposit: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        leaseId: z.ZodString;
        agreedRwf: z.ZodNumber;
        paidRwf: z.ZodNumber;
        status: z.ZodEnum<["awaiting", "held", "settled"]>;
        keptRwf: z.ZodNullable<z.ZodNumber>;
        refundedRwf: z.ZodNullable<z.ZodNumber>;
        deductions: z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            amountRwf: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            amountRwf: number;
            label: string;
        }, {
            amountRwf: number;
            label: string;
        }>, "many">;
        refundMethod: z.ZodNullable<z.ZodEnum<["gateway", "recorded", "none"]>>;
        refundStatus: z.ZodNullable<z.ZodEnum<["waiting", "paid", "failed"]>>;
        refundDestination: z.ZodNullable<z.ZodString>;
        refundFailureReason: z.ZodNullable<z.ZodString>;
        refundReference: z.ZodNullable<z.ZodString>;
        settledAt: z.ZodNullable<z.ZodString>;
        tenantDisputedAt: z.ZodNullable<z.ZodString>;
        disputeNote: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "held" | "settled" | "awaiting";
        id: string;
        paidRwf: number;
        settledAt: string | null;
        leaseId: string;
        refundedRwf: number | null;
        keptRwf: number | null;
        deductions: {
            amountRwf: number;
            label: string;
        }[];
        agreedRwf: number;
        refundMethod: "none" | "gateway" | "recorded" | null;
        refundStatus: "failed" | "waiting" | "paid" | null;
        refundDestination: string | null;
        refundFailureReason: string | null;
        refundReference: string | null;
        tenantDisputedAt: string | null;
        disputeNote: string | null;
    }, {
        status: "held" | "settled" | "awaiting";
        id: string;
        paidRwf: number;
        settledAt: string | null;
        leaseId: string;
        refundedRwf: number | null;
        keptRwf: number | null;
        deductions: {
            amountRwf: number;
            label: string;
        }[];
        agreedRwf: number;
        refundMethod: "none" | "gateway" | "recorded" | null;
        refundStatus: "failed" | "waiting" | "paid" | null;
        refundDestination: string | null;
        refundFailureReason: string | null;
        refundReference: string | null;
        tenantDisputedAt: string | null;
        disputeNote: string | null;
    }>>;
    supersedesLeaseId: z.ZodNullable<z.ZodString>;
    signedAt: z.ZodNullable<z.ZodString>;
    activatedAt: z.ZodNullable<z.ZodString>;
    endingSince: z.ZodNullable<z.ZodString>;
    endedOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
    endReason: z.ZodNullable<z.ZodString>;
    cancelledAt: z.ZodNullable<z.ZodString>;
    cancelReason: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
    broker: {
        name: string | null;
        id: string;
        phone: string | null;
        rating: {
            stars: number;
            comment: string | null;
            ratedAt: string;
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
        placementId: string | null;
        canRate: boolean;
    } | null;
    id: string;
    property: {
        name: string;
        id: string;
    };
    reference: string;
    tenant: {
        id: string;
        fullName: string;
        email: string | null;
        phone: string | null;
        createdAt: string;
        updatedAt: string;
        idNumber: string | null;
        nationality: string | null;
        hasAccount: boolean;
        idKind: "national_id" | "passport" | null;
        editable: boolean;
    };
    deposit: {
        status: "held" | "settled" | "awaiting";
        id: string;
        paidRwf: number;
        settledAt: string | null;
        leaseId: string;
        refundedRwf: number | null;
        keptRwf: number | null;
        deductions: {
            amountRwf: number;
            label: string;
        }[];
        agreedRwf: number;
        refundMethod: "none" | "gateway" | "recorded" | null;
        refundStatus: "failed" | "waiting" | "paid" | null;
        refundDestination: string | null;
        refundFailureReason: string | null;
        refundReference: string | null;
        tenantDisputedAt: string | null;
        disputeNote: string | null;
    } | null;
    unit: {
        id: string;
        label: string;
        blockCode: string | null;
        blockName: string | null;
    };
    createdAt: string;
    updatedAt: string;
    charges: {
        balanceRwf: number;
        rentChargedRwf: number;
        rentPaidRwf: number;
        overdueRwf: number;
        nextDue: {
            amountRwf: number;
            dueOn: string;
        } | null;
        depositAgreedRwf: number;
        depositStatus: "held" | "settled" | "awaiting" | null;
    };
    signedAt: string | null;
    terms: {
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        billingStartsOn: string;
        noticeDays: number;
        depositRwf: number;
        rentDueDay: number;
        graceDays: number;
        occupants: string[];
        otherTerms: string | null;
    };
    endReason: string | null;
    cancelReason: string | null;
    tab: "active" | "cancelled" | "ending" | "ended" | "to_sign" | "waiting_for_tenant" | "ready_to_start";
    cancelledAt: string | null;
    actions: ("start" | "landlord_sign" | "edit_terms" | "tenant_sign" | "cancel" | "acknowledge_notice" | "near_end" | "withdraw_notice" | "record_move_out")[];
    notice: {
        message: string | null;
        status: "submitted" | "withdrawn" | "acknowledged";
        id: string;
        reasonCode: "other" | "moving_in_kigali" | "leaving_kigali" | "own_home" | "cost" | "terms" | "landlord_use" | "tenant_breach";
        withdrawnAt: string | null;
        channel: "email" | "app" | "letter" | "in_person";
        noticeDays: number;
        filedAt: string;
        isShortNotice: boolean;
        moveOutOn: string;
        givenBy: "landlord" | "tenant";
        filedOn: string;
        acknowledgedAt: string | null;
    } | null;
    endedOn: string | null;
    nextAction: string | null;
    currentVersion: {
        id: string;
        createdAt: string;
        version: number;
        templateVersion: number;
        contentHash: string;
    } | null;
    signatures: {
        id: string;
        role: "landlord" | "tenant";
        note: string | null;
        version: number;
        method: "email_code" | "password" | "legacy";
        signedAt: string;
        typedName: string | null;
        voidedAt: string | null;
    }[];
    invitation: {
        status: "expired" | "sent" | "accepted" | "revoked";
        expiresAt: string;
        email: string;
        sentAt: string;
        lastSentAt: string;
        sendCount: number;
        acceptedAt: string | null;
    } | null;
    contractProblems: string[];
    supersedesLeaseId: string | null;
    activatedAt: string | null;
    endingSince: string | null;
}, {
    status: "active" | "cancelled" | "draft" | "pending_signature" | "ending" | "ended" | "signed";
    broker: {
        name: string | null;
        id: string;
        phone: string | null;
        rating: {
            stars: number;
            comment: string | null;
            ratedAt: string;
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
        placementId: string | null;
        canRate: boolean;
    } | null;
    id: string;
    property: {
        name: string;
        id: string;
    };
    reference: string;
    tenant: {
        id: string;
        fullName: string;
        email: string | null;
        phone: string | null;
        createdAt: string;
        updatedAt: string;
        idNumber: string | null;
        nationality: string | null;
        hasAccount: boolean;
        idKind: "national_id" | "passport" | null;
        editable: boolean;
    };
    deposit: {
        status: "held" | "settled" | "awaiting";
        id: string;
        paidRwf: number;
        settledAt: string | null;
        leaseId: string;
        refundedRwf: number | null;
        keptRwf: number | null;
        deductions: {
            amountRwf: number;
            label: string;
        }[];
        agreedRwf: number;
        refundMethod: "none" | "gateway" | "recorded" | null;
        refundStatus: "failed" | "waiting" | "paid" | null;
        refundDestination: string | null;
        refundFailureReason: string | null;
        refundReference: string | null;
        tenantDisputedAt: string | null;
        disputeNote: string | null;
    } | null;
    unit: {
        id: string;
        label: string;
        blockCode: string | null;
        blockName: string | null;
    };
    createdAt: string;
    updatedAt: string;
    charges: {
        balanceRwf: number;
        rentChargedRwf: number;
        rentPaidRwf: number;
        overdueRwf: number;
        nextDue: {
            amountRwf: number;
            dueOn: string;
        } | null;
        depositAgreedRwf: number;
        depositStatus: "held" | "settled" | "awaiting" | null;
    };
    signedAt: string | null;
    terms: {
        monthlyRentRwf: number;
        startDate: string;
        endDate: string;
        billingStartsOn: string;
        noticeDays: number;
        depositRwf: number;
        rentDueDay: number;
        graceDays: number;
        occupants: string[];
        otherTerms: string | null;
    };
    endReason: string | null;
    cancelReason: string | null;
    tab: "active" | "cancelled" | "ending" | "ended" | "to_sign" | "waiting_for_tenant" | "ready_to_start";
    cancelledAt: string | null;
    actions: ("start" | "landlord_sign" | "edit_terms" | "tenant_sign" | "cancel" | "acknowledge_notice" | "near_end" | "withdraw_notice" | "record_move_out")[];
    notice: {
        message: string | null;
        status: "submitted" | "withdrawn" | "acknowledged";
        id: string;
        reasonCode: "other" | "moving_in_kigali" | "leaving_kigali" | "own_home" | "cost" | "terms" | "landlord_use" | "tenant_breach";
        withdrawnAt: string | null;
        channel: "email" | "app" | "letter" | "in_person";
        noticeDays: number;
        filedAt: string;
        isShortNotice: boolean;
        moveOutOn: string;
        givenBy: "landlord" | "tenant";
        filedOn: string;
        acknowledgedAt: string | null;
    } | null;
    endedOn: string | null;
    nextAction: string | null;
    currentVersion: {
        id: string;
        createdAt: string;
        version: number;
        templateVersion: number;
        contentHash: string;
    } | null;
    signatures: {
        id: string;
        role: "landlord" | "tenant";
        note: string | null;
        version: number;
        method: "email_code" | "password" | "legacy";
        signedAt: string;
        typedName: string | null;
        voidedAt: string | null;
    }[];
    invitation: {
        status: "expired" | "sent" | "accepted" | "revoked";
        expiresAt: string;
        email: string;
        sentAt: string;
        lastSentAt: string;
        sendCount: number;
        acceptedAt: string | null;
    } | null;
    contractProblems: string[];
    supersedesLeaseId: string | null;
    activatedAt: string | null;
    endingSince: string | null;
}>;
export type LeaseDetail = z.infer<typeof LeaseDetail>;
/** One row of a lease's timeline. */
export declare const LeaseEventView: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<["created", "terms_edited", "tenant_updated", "landlord_signed", "landlord_signature_voided", "invitation_sent", "invitation_resent", "invitation_accepted", "tenant_signed", "signed_copy_ready", "started", "cancelled", "charge_raised", "charge_waived", "payment_received", "payment_recorded", "payment_failed", "payment_reversed", "reminder_sent", "deposit_received", "deposit_settled", "deposit_disputed", "notice_filed", "notice_acknowledged", "notice_withdrawn", "ending", "moved_out", "filing_due", "filed", "renewed", "broker_rated"]>;
    actorRole: z.ZodEnum<["landlord", "tenant", "system", "broker"]>;
    /** Who did it, by name; null for the system. */
    actorName: z.ZodNullable<z.ZodString>;
    visibleToTenant: z.ZodBoolean;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    occurredAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    kind: "cancelled" | "created" | "ending" | "filed" | "payment_failed" | "terms_edited" | "tenant_updated" | "landlord_signed" | "landlord_signature_voided" | "invitation_sent" | "invitation_resent" | "invitation_accepted" | "tenant_signed" | "signed_copy_ready" | "started" | "charge_raised" | "charge_waived" | "payment_received" | "payment_recorded" | "payment_reversed" | "reminder_sent" | "deposit_received" | "deposit_settled" | "deposit_disputed" | "notice_filed" | "notice_acknowledged" | "notice_withdrawn" | "moved_out" | "filing_due" | "renewed" | "broker_rated";
    occurredAt: string;
    actorName: string | null;
    actorRole: "broker" | "landlord" | "tenant" | "system";
    visibleToTenant: boolean;
    payload: Record<string, unknown>;
}, {
    id: string;
    kind: "cancelled" | "created" | "ending" | "filed" | "payment_failed" | "terms_edited" | "tenant_updated" | "landlord_signed" | "landlord_signature_voided" | "invitation_sent" | "invitation_resent" | "invitation_accepted" | "tenant_signed" | "signed_copy_ready" | "started" | "charge_raised" | "charge_waived" | "payment_received" | "payment_recorded" | "payment_reversed" | "reminder_sent" | "deposit_received" | "deposit_settled" | "deposit_disputed" | "notice_filed" | "notice_acknowledged" | "notice_withdrawn" | "moved_out" | "filing_due" | "renewed" | "broker_rated";
    occurredAt: string;
    actorName: string | null;
    actorRole: "broker" | "landlord" | "tenant" | "system";
    visibleToTenant: boolean;
    payload: Record<string, unknown>;
}>;
export type LeaseEventView = z.infer<typeof LeaseEventView>;
export declare const LeaseEventList: z.ZodObject<{
    events: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<["created", "terms_edited", "tenant_updated", "landlord_signed", "landlord_signature_voided", "invitation_sent", "invitation_resent", "invitation_accepted", "tenant_signed", "signed_copy_ready", "started", "cancelled", "charge_raised", "charge_waived", "payment_received", "payment_recorded", "payment_failed", "payment_reversed", "reminder_sent", "deposit_received", "deposit_settled", "deposit_disputed", "notice_filed", "notice_acknowledged", "notice_withdrawn", "ending", "moved_out", "filing_due", "filed", "renewed", "broker_rated"]>;
        actorRole: z.ZodEnum<["landlord", "tenant", "system", "broker"]>;
        /** Who did it, by name; null for the system. */
        actorName: z.ZodNullable<z.ZodString>;
        visibleToTenant: z.ZodBoolean;
        payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        occurredAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        kind: "cancelled" | "created" | "ending" | "filed" | "payment_failed" | "terms_edited" | "tenant_updated" | "landlord_signed" | "landlord_signature_voided" | "invitation_sent" | "invitation_resent" | "invitation_accepted" | "tenant_signed" | "signed_copy_ready" | "started" | "charge_raised" | "charge_waived" | "payment_received" | "payment_recorded" | "payment_reversed" | "reminder_sent" | "deposit_received" | "deposit_settled" | "deposit_disputed" | "notice_filed" | "notice_acknowledged" | "notice_withdrawn" | "moved_out" | "filing_due" | "renewed" | "broker_rated";
        occurredAt: string;
        actorName: string | null;
        actorRole: "broker" | "landlord" | "tenant" | "system";
        visibleToTenant: boolean;
        payload: Record<string, unknown>;
    }, {
        id: string;
        kind: "cancelled" | "created" | "ending" | "filed" | "payment_failed" | "terms_edited" | "tenant_updated" | "landlord_signed" | "landlord_signature_voided" | "invitation_sent" | "invitation_resent" | "invitation_accepted" | "tenant_signed" | "signed_copy_ready" | "started" | "charge_raised" | "charge_waived" | "payment_received" | "payment_recorded" | "payment_reversed" | "reminder_sent" | "deposit_received" | "deposit_settled" | "deposit_disputed" | "notice_filed" | "notice_acknowledged" | "notice_withdrawn" | "moved_out" | "filing_due" | "renewed" | "broker_rated";
        occurredAt: string;
        actorName: string | null;
        actorRole: "broker" | "landlord" | "tenant" | "system";
        visibleToTenant: boolean;
        payload: Record<string, unknown>;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    events: {
        id: string;
        kind: "cancelled" | "created" | "ending" | "filed" | "payment_failed" | "terms_edited" | "tenant_updated" | "landlord_signed" | "landlord_signature_voided" | "invitation_sent" | "invitation_resent" | "invitation_accepted" | "tenant_signed" | "signed_copy_ready" | "started" | "charge_raised" | "charge_waived" | "payment_received" | "payment_recorded" | "payment_reversed" | "reminder_sent" | "deposit_received" | "deposit_settled" | "deposit_disputed" | "notice_filed" | "notice_acknowledged" | "notice_withdrawn" | "moved_out" | "filing_due" | "renewed" | "broker_rated";
        occurredAt: string;
        actorName: string | null;
        actorRole: "broker" | "landlord" | "tenant" | "system";
        visibleToTenant: boolean;
        payload: Record<string, unknown>;
    }[];
}, {
    events: {
        id: string;
        kind: "cancelled" | "created" | "ending" | "filed" | "payment_failed" | "terms_edited" | "tenant_updated" | "landlord_signed" | "landlord_signature_voided" | "invitation_sent" | "invitation_resent" | "invitation_accepted" | "tenant_signed" | "signed_copy_ready" | "started" | "charge_raised" | "charge_waived" | "payment_received" | "payment_recorded" | "payment_reversed" | "reminder_sent" | "deposit_received" | "deposit_settled" | "deposit_disputed" | "notice_filed" | "notice_acknowledged" | "notice_withdrawn" | "moved_out" | "filing_due" | "renewed" | "broker_rated";
        occurredAt: string;
        actorName: string | null;
        actorRole: "broker" | "landlord" | "tenant" | "system";
        visibleToTenant: boolean;
        payload: Record<string, unknown>;
    }[];
}>;
export type LeaseEventList = z.infer<typeof LeaseEventList>;
/** `GET /ops/leases/:id/contract`: the current version's text, and the versions before it. */
export declare const LeaseContractView: z.ZodObject<{
    leaseId: z.ZodString;
    version: z.ZodObject<{
        id: z.ZodString;
        version: z.ZodNumber;
        templateVersion: z.ZodNumber;
        contentHash: z.ZodString;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        createdAt: string;
        version: number;
        templateVersion: number;
        contentHash: string;
    }, {
        id: string;
        createdAt: string;
        version: number;
        templateVersion: number;
        contentHash: string;
    }>;
    /**
     * The text as frozen. Template 3 is `LeaseContract`; a version carried over
     * by migration 0077 (template 0) holds the old free-form JSON.
     */
    content: z.ZodUnion<[z.ZodObject<{
        version: z.ZodUnion<[z.ZodLiteral<3>, z.ZodLiteral<4>]>;
        title: z.ZodString;
        parties: z.ZodObject<{
            landlord: z.ZodObject<{
                legalName: z.ZodString;
                signatoryName: z.ZodString;
                idNumber: z.ZodString;
                phone: z.ZodString;
                email: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                email: string;
                legalName: string;
                phone: string;
                idNumber: string;
                signatoryName: string;
            }, {
                email: string;
                legalName: string;
                phone: string;
                idNumber: string;
                signatoryName: string;
            }>;
            tenant: z.ZodObject<{
                fullName: z.ZodString;
                idKind: z.ZodEnum<["national_id", "passport"]>;
                idNumber: z.ZodString;
                nationality: z.ZodString;
                phone: z.ZodString;
                email: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                fullName: string;
                email: string;
                phone: string;
                idNumber: string;
                nationality: string;
                idKind: "national_id" | "passport";
            }, {
                fullName: string;
                email: string;
                phone: string;
                idNumber: string;
                nationality: string;
                idKind: "national_id" | "passport";
            }>;
        }, "strip", z.ZodTypeAny, {
            landlord: {
                email: string;
                legalName: string;
                phone: string;
                idNumber: string;
                signatoryName: string;
            };
            tenant: {
                fullName: string;
                email: string;
                phone: string;
                idNumber: string;
                nationality: string;
                idKind: "national_id" | "passport";
            };
        }, {
            landlord: {
                email: string;
                legalName: string;
                phone: string;
                idNumber: string;
                signatoryName: string;
            };
            tenant: {
                fullName: string;
                email: string;
                phone: string;
                idNumber: string;
                nationality: string;
                idKind: "national_id" | "passport";
            };
        }>;
        premises: z.ZodObject<{
            property: z.ZodString;
            unit: z.ZodNullable<z.ZodString>;
            block: z.ZodNullable<z.ZodString>;
            street: z.ZodNullable<z.ZodString>;
            village: z.ZodNullable<z.ZodString>;
            cell: z.ZodNullable<z.ZodString>;
            sector: z.ZodNullable<z.ZodString>;
            district: z.ZodNullable<z.ZodString>;
            province: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            province: string | null;
            district: string | null;
            sector: string | null;
            cell: string | null;
            village: string | null;
            property: string;
            street: string | null;
            unit: string | null;
            block: string | null;
        }, {
            province: string | null;
            district: string | null;
            sector: string | null;
            cell: string | null;
            village: string | null;
            property: string;
            street: string | null;
            unit: string | null;
            block: string | null;
        }>;
        premisesLine: z.ZodString;
        terms: z.ZodObject<{
            startDate: z.ZodString;
            endDate: z.ZodString;
            billingStartsOn: z.ZodNullable<z.ZodString>;
            monthlyRentRwf: z.ZodNumber;
            depositRwf: z.ZodNumber;
            rentDueDay: z.ZodNumber;
            graceDays: z.ZodNumber;
            noticeDays: z.ZodNumber;
            occupants: z.ZodArray<z.ZodString, "many">;
            otherTerms: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            monthlyRentRwf: number;
            startDate: string;
            endDate: string;
            billingStartsOn: string | null;
            noticeDays: number;
            depositRwf: number;
            rentDueDay: number;
            graceDays: number;
            occupants: string[];
            otherTerms: string | null;
        }, {
            monthlyRentRwf: number;
            startDate: string;
            endDate: string;
            billingStartsOn: string | null;
            noticeDays: number;
            depositRwf: number;
            rentDueDay: number;
            graceDays: number;
            occupants: string[];
            otherTerms: string | null;
        }>;
        clauses: z.ZodArray<z.ZodObject<{
            heading: z.ZodString;
            body: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            body: string;
            heading: string;
        }, {
            body: string;
            heading: string;
        }>, "many">;
        issuedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        title: string;
        version: 3 | 4;
        terms: {
            monthlyRentRwf: number;
            startDate: string;
            endDate: string;
            billingStartsOn: string | null;
            noticeDays: number;
            depositRwf: number;
            rentDueDay: number;
            graceDays: number;
            occupants: string[];
            otherTerms: string | null;
        };
        parties: {
            landlord: {
                email: string;
                legalName: string;
                phone: string;
                idNumber: string;
                signatoryName: string;
            };
            tenant: {
                fullName: string;
                email: string;
                phone: string;
                idNumber: string;
                nationality: string;
                idKind: "national_id" | "passport";
            };
        };
        issuedAt: string;
        clauses: {
            body: string;
            heading: string;
        }[];
        premises: {
            province: string | null;
            district: string | null;
            sector: string | null;
            cell: string | null;
            village: string | null;
            property: string;
            street: string | null;
            unit: string | null;
            block: string | null;
        };
        premisesLine: string;
    }, {
        title: string;
        version: 3 | 4;
        terms: {
            monthlyRentRwf: number;
            startDate: string;
            endDate: string;
            billingStartsOn: string | null;
            noticeDays: number;
            depositRwf: number;
            rentDueDay: number;
            graceDays: number;
            occupants: string[];
            otherTerms: string | null;
        };
        parties: {
            landlord: {
                email: string;
                legalName: string;
                phone: string;
                idNumber: string;
                signatoryName: string;
            };
            tenant: {
                fullName: string;
                email: string;
                phone: string;
                idNumber: string;
                nationality: string;
                idKind: "national_id" | "passport";
            };
        };
        issuedAt: string;
        clauses: {
            body: string;
            heading: string;
        }[];
        premises: {
            province: string | null;
            district: string | null;
            sector: string | null;
            cell: string | null;
            village: string | null;
            property: string;
            street: string | null;
            unit: string | null;
            block: string | null;
        };
        premisesLine: string;
    }>, z.ZodRecord<z.ZodString, z.ZodUnknown>]>;
    /** Both sides have signed this version. */
    signed: z.ZodBoolean;
    versions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        version: z.ZodNumber;
        templateVersion: z.ZodNumber;
        contentHash: z.ZodString;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        createdAt: string;
        version: number;
        templateVersion: number;
        contentHash: string;
    }, {
        id: string;
        createdAt: string;
        version: number;
        templateVersion: number;
        contentHash: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    version: {
        id: string;
        createdAt: string;
        version: number;
        templateVersion: number;
        contentHash: string;
    };
    leaseId: string;
    signed: boolean;
    versions: {
        id: string;
        createdAt: string;
        version: number;
        templateVersion: number;
        contentHash: string;
    }[];
    content: Record<string, unknown> | {
        title: string;
        version: 3 | 4;
        terms: {
            monthlyRentRwf: number;
            startDate: string;
            endDate: string;
            billingStartsOn: string | null;
            noticeDays: number;
            depositRwf: number;
            rentDueDay: number;
            graceDays: number;
            occupants: string[];
            otherTerms: string | null;
        };
        parties: {
            landlord: {
                email: string;
                legalName: string;
                phone: string;
                idNumber: string;
                signatoryName: string;
            };
            tenant: {
                fullName: string;
                email: string;
                phone: string;
                idNumber: string;
                nationality: string;
                idKind: "national_id" | "passport";
            };
        };
        issuedAt: string;
        clauses: {
            body: string;
            heading: string;
        }[];
        premises: {
            province: string | null;
            district: string | null;
            sector: string | null;
            cell: string | null;
            village: string | null;
            property: string;
            street: string | null;
            unit: string | null;
            block: string | null;
        };
        premisesLine: string;
    };
}, {
    version: {
        id: string;
        createdAt: string;
        version: number;
        templateVersion: number;
        contentHash: string;
    };
    leaseId: string;
    signed: boolean;
    versions: {
        id: string;
        createdAt: string;
        version: number;
        templateVersion: number;
        contentHash: string;
    }[];
    content: Record<string, unknown> | {
        title: string;
        version: 3 | 4;
        terms: {
            monthlyRentRwf: number;
            startDate: string;
            endDate: string;
            billingStartsOn: string | null;
            noticeDays: number;
            depositRwf: number;
            rentDueDay: number;
            graceDays: number;
            occupants: string[];
            otherTerms: string | null;
        };
        parties: {
            landlord: {
                email: string;
                legalName: string;
                phone: string;
                idNumber: string;
                signatoryName: string;
            };
            tenant: {
                fullName: string;
                email: string;
                phone: string;
                idNumber: string;
                nationality: string;
                idKind: "national_id" | "passport";
            };
        };
        issuedAt: string;
        clauses: {
            body: string;
            heading: string;
        }[];
        premises: {
            province: string | null;
            district: string | null;
            sector: string | null;
            cell: string | null;
            village: string | null;
            property: string;
            street: string | null;
            unit: string | null;
            block: string | null;
        };
        premisesLine: string;
    };
}>;
export type LeaseContractView = z.infer<typeof LeaseContractView>;
//# sourceMappingURL=api.d.ts.map