import { z } from "zod";
/**
 * Broker plans: how much of Rwanda a broker sees.
 *
 * District is free and shows the opted-in homes in the broker's own district.
 * Province and Country are monthly plans paid through the gateway (MTN MoMo,
 * Airtel Money or a card on the gateway's own page). Prices live in the
 * `broker_plans` table, never here; the codes are fixed because what each one
 * covers is code, not data.
 */
export declare const BrokerPlanCode: z.ZodEnum<["district", "province", "country"]>;
export type BrokerPlanCode = z.infer<typeof BrokerPlanCode>;
export declare const BrokerPlanStatus: z.ZodEnum<["active", "pending_payment", "past_due", "cancelled", "expired"]>;
export type BrokerPlanStatus = z.infer<typeof BrokerPlanStatus>;
export declare const BrokerPayMethod: z.ZodEnum<["mtn_momo", "airtel_money", "card"]>;
export type BrokerPayMethod = z.infer<typeof BrokerPayMethod>;
export declare const BROKER_PAY_METHOD_LABEL: Readonly<Record<BrokerPayMethod, string>>;
export declare const BrokerPaymentStatus: z.ZodEnum<["pending", "paid", "failed"]>;
export type BrokerPaymentStatus = z.infer<typeof BrokerPaymentStatus>;
export declare const BrokerPaymentKind: z.ZodEnum<["start", "renewal"]>;
export type BrokerPaymentKind = z.infer<typeof BrokerPaymentKind>;
/** Days a paid plan keeps working after a renewal fails, before it drops to District. */
export declare const BROKER_PLAN_GRACE_DAYS = 3;
/** How often a broker on the free plan may move their home district. */
export declare const BROKER_DISTRICT_CHANGE_DAYS = 30;
/** A province's everyday name. The table holds "KIGALI", "NORTH" and so on. */
export declare function provinceLabel(name: string): string;
/** What a plan covers, in words: "Gasabo", "All of Kigali City", "All of Rwanda". */
export declare function brokerAreaLabel(plan: BrokerPlanCode, place: {
    district?: string | null;
    province?: string | null;
}): string;
/** One plan as the catalogue offers it. */
export declare const BrokerPlan: z.ZodObject<{
    code: z.ZodEnum<["district", "province", "country"]>;
    name: z.ZodString;
    /** Per month, in whole francs. 0 for District. */
    priceRwf: z.ZodNumber;
    active: z.ZodBoolean;
    sort: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    sort: number;
    code: "country" | "province" | "district";
    active: boolean;
    name: string;
    priceRwf: number;
}, {
    sort: number;
    code: "country" | "province" | "district";
    active: boolean;
    name: string;
    priceRwf: number;
}>;
export type BrokerPlan = z.infer<typeof BrokerPlan>;
/** One payment for a plan, as the broker's history shows it. */
export declare const BrokerPlanPayment: z.ZodObject<{
    id: z.ZodString;
    planCode: z.ZodEnum<["district", "province", "country"]>;
    kind: z.ZodEnum<["start", "renewal"]>;
    periodStart: z.ZodEffects<z.ZodString, string, string>;
    periodEnd: z.ZodEffects<z.ZodString, string, string>;
    amountRwf: z.ZodNumber;
    method: z.ZodEnum<["mtn_momo", "airtel_money", "card"]>;
    /** "MTN MoMo 078•••456" or "Card". */
    methodWords: z.ZodString;
    status: z.ZodEnum<["pending", "paid", "failed"]>;
    failureReason: z.ZodNullable<z.ZodString>;
    /** Where to send the broker to pay by card; only while a card payment waits. */
    checkoutUrl: z.ZodNullable<z.ZodString>;
    paidAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "failed" | "paid";
    id: string;
    kind: "renewal" | "start";
    amountRwf: number;
    failureReason: string | null;
    paidAt: string | null;
    createdAt: string;
    periodStart: string;
    periodEnd: string;
    method: "mtn_momo" | "airtel_money" | "card";
    planCode: "country" | "province" | "district";
    methodWords: string;
    checkoutUrl: string | null;
}, {
    status: "pending" | "failed" | "paid";
    id: string;
    kind: "renewal" | "start";
    amountRwf: number;
    failureReason: string | null;
    paidAt: string | null;
    createdAt: string;
    periodStart: string;
    periodEnd: string;
    method: "mtn_momo" | "airtel_money" | "card";
    planCode: "country" | "province" | "district";
    methodWords: string;
    checkoutUrl: string | null;
}>;
export type BrokerPlanPayment = z.infer<typeof BrokerPlanPayment>;
/** Where the broker stands. `GET /ops/broker/plan`. */
export declare const BrokerPlanOverview: z.ZodObject<{
    plans: z.ZodArray<z.ZodObject<{
        code: z.ZodEnum<["district", "province", "country"]>;
        name: z.ZodString;
        /** Per month, in whole francs. 0 for District. */
        priceRwf: z.ZodNumber;
        active: z.ZodBoolean;
        sort: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        sort: number;
        code: "country" | "province" | "district";
        active: boolean;
        name: string;
        priceRwf: number;
    }, {
        sort: number;
        code: "country" | "province" | "district";
        active: boolean;
        name: string;
        priceRwf: number;
    }>, "many">;
    home: z.ZodObject<{
        districtId: z.ZodNullable<z.ZodNumber>;
        districtName: z.ZodNullable<z.ZodString>;
        provinceId: z.ZodNullable<z.ZodNumber>;
        provinceName: z.ZodNullable<z.ZodString>;
        /** On the free plan, the first day the home district may change again; null when it may now. */
        changeFrom: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
    }, "strip", z.ZodTypeAny, {
        districtName: string | null;
        provinceId: number | null;
        districtId: number | null;
        provinceName: string | null;
        changeFrom: string | null;
    }, {
        districtName: string | null;
        provinceId: number | null;
        districtId: number | null;
        provinceName: string | null;
        changeFrom: string | null;
    }>;
    /** The plan in force now. District when nothing paid is. */
    current: z.ZodObject<{
        plan: z.ZodEnum<["district", "province", "country"]>;
        status: z.ZodEnum<["active", "pending_payment", "past_due", "cancelled", "expired"]>;
        area: z.ZodString;
        provinceId: z.ZodNullable<z.ZodNumber>;
        periodStart: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
        periodEnd: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
        /** The day the next payment is due; null on District or when it ends. */
        nextPaymentOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
        nextAmountRwf: z.ZodNullable<z.ZodNumber>;
        /** What it becomes at the period end, when the broker chose a cheaper plan. */
        endsInto: z.ZodNullable<z.ZodEnum<["district", "province", "country"]>>;
        /** A failed renewal: the plan works until this day, then drops to District. */
        graceUntil: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
        method: z.ZodNullable<z.ZodEnum<["mtn_momo", "airtel_money", "card"]>>;
    }, "strip", z.ZodTypeAny, {
        status: "pending_payment" | "active" | "cancelled" | "expired" | "past_due";
        provinceId: number | null;
        periodStart: string | null;
        periodEnd: string | null;
        method: "mtn_momo" | "airtel_money" | "card" | null;
        area: string;
        plan: "country" | "province" | "district";
        nextPaymentOn: string | null;
        nextAmountRwf: number | null;
        endsInto: "country" | "province" | "district" | null;
        graceUntil: string | null;
    }, {
        status: "pending_payment" | "active" | "cancelled" | "expired" | "past_due";
        provinceId: number | null;
        periodStart: string | null;
        periodEnd: string | null;
        method: "mtn_momo" | "airtel_money" | "card" | null;
        area: string;
        plan: "country" | "province" | "district";
        nextPaymentOn: string | null;
        nextAmountRwf: number | null;
        endsInto: "country" | "province" | "district" | null;
        graceUntil: string | null;
    }>;
    /** What paying for each plan would charge today: an upgrade less what is left of this month. */
    quotes: z.ZodArray<z.ZodObject<{
        plan: z.ZodEnum<["district", "province", "country"]>;
        amountRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        amountRwf: number;
        plan: "country" | "province" | "district";
    }, {
        amountRwf: number;
        plan: "country" | "province" | "district";
    }>, "many">;
    /** A payment still waiting on a phone or a card page. */
    pending: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        planCode: z.ZodEnum<["district", "province", "country"]>;
        kind: z.ZodEnum<["start", "renewal"]>;
        periodStart: z.ZodEffects<z.ZodString, string, string>;
        periodEnd: z.ZodEffects<z.ZodString, string, string>;
        amountRwf: z.ZodNumber;
        method: z.ZodEnum<["mtn_momo", "airtel_money", "card"]>;
        /** "MTN MoMo 078•••456" or "Card". */
        methodWords: z.ZodString;
        status: z.ZodEnum<["pending", "paid", "failed"]>;
        failureReason: z.ZodNullable<z.ZodString>;
        /** Where to send the broker to pay by card; only while a card payment waits. */
        checkoutUrl: z.ZodNullable<z.ZodString>;
        paidAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "failed" | "paid";
        id: string;
        kind: "renewal" | "start";
        amountRwf: number;
        failureReason: string | null;
        paidAt: string | null;
        createdAt: string;
        periodStart: string;
        periodEnd: string;
        method: "mtn_momo" | "airtel_money" | "card";
        planCode: "country" | "province" | "district";
        methodWords: string;
        checkoutUrl: string | null;
    }, {
        status: "pending" | "failed" | "paid";
        id: string;
        kind: "renewal" | "start";
        amountRwf: number;
        failureReason: string | null;
        paidAt: string | null;
        createdAt: string;
        periodStart: string;
        periodEnd: string;
        method: "mtn_momo" | "airtel_money" | "card";
        planCode: "country" | "province" | "district";
        methodWords: string;
        checkoutUrl: string | null;
    }>>;
    payments: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        planCode: z.ZodEnum<["district", "province", "country"]>;
        kind: z.ZodEnum<["start", "renewal"]>;
        periodStart: z.ZodEffects<z.ZodString, string, string>;
        periodEnd: z.ZodEffects<z.ZodString, string, string>;
        amountRwf: z.ZodNumber;
        method: z.ZodEnum<["mtn_momo", "airtel_money", "card"]>;
        /** "MTN MoMo 078•••456" or "Card". */
        methodWords: z.ZodString;
        status: z.ZodEnum<["pending", "paid", "failed"]>;
        failureReason: z.ZodNullable<z.ZodString>;
        /** Where to send the broker to pay by card; only while a card payment waits. */
        checkoutUrl: z.ZodNullable<z.ZodString>;
        paidAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "failed" | "paid";
        id: string;
        kind: "renewal" | "start";
        amountRwf: number;
        failureReason: string | null;
        paidAt: string | null;
        createdAt: string;
        periodStart: string;
        periodEnd: string;
        method: "mtn_momo" | "airtel_money" | "card";
        planCode: "country" | "province" | "district";
        methodWords: string;
        checkoutUrl: string | null;
    }, {
        status: "pending" | "failed" | "paid";
        id: string;
        kind: "renewal" | "start";
        amountRwf: number;
        failureReason: string | null;
        paidAt: string | null;
        createdAt: string;
        periodStart: string;
        periodEnd: string;
        method: "mtn_momo" | "airtel_money" | "card";
        planCode: "country" | "province" | "district";
        methodWords: string;
        checkoutUrl: string | null;
    }>, "many">;
    /** Every province, for the Province plan's picker. */
    provinces: z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        name: z.ZodString;
        label: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: number;
        label: string;
    }, {
        name: string;
        id: number;
        label: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    pending: {
        status: "pending" | "failed" | "paid";
        id: string;
        kind: "renewal" | "start";
        amountRwf: number;
        failureReason: string | null;
        paidAt: string | null;
        createdAt: string;
        periodStart: string;
        periodEnd: string;
        method: "mtn_momo" | "airtel_money" | "card";
        planCode: "country" | "province" | "district";
        methodWords: string;
        checkoutUrl: string | null;
    } | null;
    current: {
        status: "pending_payment" | "active" | "cancelled" | "expired" | "past_due";
        provinceId: number | null;
        periodStart: string | null;
        periodEnd: string | null;
        method: "mtn_momo" | "airtel_money" | "card" | null;
        area: string;
        plan: "country" | "province" | "district";
        nextPaymentOn: string | null;
        nextAmountRwf: number | null;
        endsInto: "country" | "province" | "district" | null;
        graceUntil: string | null;
    };
    payments: {
        status: "pending" | "failed" | "paid";
        id: string;
        kind: "renewal" | "start";
        amountRwf: number;
        failureReason: string | null;
        paidAt: string | null;
        createdAt: string;
        periodStart: string;
        periodEnd: string;
        method: "mtn_momo" | "airtel_money" | "card";
        planCode: "country" | "province" | "district";
        methodWords: string;
        checkoutUrl: string | null;
    }[];
    plans: {
        sort: number;
        code: "country" | "province" | "district";
        active: boolean;
        name: string;
        priceRwf: number;
    }[];
    home: {
        districtName: string | null;
        provinceId: number | null;
        districtId: number | null;
        provinceName: string | null;
        changeFrom: string | null;
    };
    quotes: {
        amountRwf: number;
        plan: "country" | "province" | "district";
    }[];
    provinces: {
        name: string;
        id: number;
        label: string;
    }[];
}, {
    pending: {
        status: "pending" | "failed" | "paid";
        id: string;
        kind: "renewal" | "start";
        amountRwf: number;
        failureReason: string | null;
        paidAt: string | null;
        createdAt: string;
        periodStart: string;
        periodEnd: string;
        method: "mtn_momo" | "airtel_money" | "card";
        planCode: "country" | "province" | "district";
        methodWords: string;
        checkoutUrl: string | null;
    } | null;
    current: {
        status: "pending_payment" | "active" | "cancelled" | "expired" | "past_due";
        provinceId: number | null;
        periodStart: string | null;
        periodEnd: string | null;
        method: "mtn_momo" | "airtel_money" | "card" | null;
        area: string;
        plan: "country" | "province" | "district";
        nextPaymentOn: string | null;
        nextAmountRwf: number | null;
        endsInto: "country" | "province" | "district" | null;
        graceUntil: string | null;
    };
    payments: {
        status: "pending" | "failed" | "paid";
        id: string;
        kind: "renewal" | "start";
        amountRwf: number;
        failureReason: string | null;
        paidAt: string | null;
        createdAt: string;
        periodStart: string;
        periodEnd: string;
        method: "mtn_momo" | "airtel_money" | "card";
        planCode: "country" | "province" | "district";
        methodWords: string;
        checkoutUrl: string | null;
    }[];
    plans: {
        sort: number;
        code: "country" | "province" | "district";
        active: boolean;
        name: string;
        priceRwf: number;
    }[];
    home: {
        districtName: string | null;
        provinceId: number | null;
        districtId: number | null;
        provinceName: string | null;
        changeFrom: string | null;
    };
    quotes: {
        amountRwf: number;
        plan: "country" | "province" | "district";
    }[];
    provinces: {
        name: string;
        id: number;
        label: string;
    }[];
}>;
export type BrokerPlanOverview = z.infer<typeof BrokerPlanOverview>;
/**
 * Pay for a plan: an upgrade, or a past-due month. `POST /ops/broker/plan/checkout`
 * with an `Idempotency-Key`. The plan changes only once the money lands.
 */
export declare const BrokerPlanCheckoutRequest: z.ZodEffects<z.ZodObject<{
    plan: z.ZodEnum<["province", "country"]>;
    /** The province, for the Province plan. Left out: the home district's. */
    provinceId: z.ZodOptional<z.ZodNumber>;
    method: z.ZodEnum<["mtn_momo", "airtel_money", "card"]>;
    /** The number the prompt goes to, for MoMo and Airtel. */
    phone: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string | null, string>, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    method: "mtn_momo" | "airtel_money" | "card";
    plan: "country" | "province";
    provinceId?: number | undefined;
    phone?: string | undefined;
}, {
    method: "mtn_momo" | "airtel_money" | "card";
    plan: "country" | "province";
    provinceId?: number | undefined;
    phone?: string | undefined;
}>, {
    method: "mtn_momo" | "airtel_money" | "card";
    plan: "country" | "province";
    provinceId?: number | undefined;
    phone?: string | undefined;
}, {
    method: "mtn_momo" | "airtel_money" | "card";
    plan: "country" | "province";
    provinceId?: number | undefined;
    phone?: string | undefined;
}>;
export type BrokerPlanCheckoutRequest = z.infer<typeof BrokerPlanCheckoutRequest>;
/**
 * Move to a cheaper plan at the end of the month, keep the current one
 * (undoing that), or switch the Province plan's province.
 * `POST /ops/broker/plan/change`. Never takes money.
 */
export declare const BrokerPlanChangeRequest: z.ZodObject<{
    plan: z.ZodEnum<["district", "province", "country"]>;
    provinceId: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    plan: "country" | "province" | "district";
    provinceId?: number | undefined;
}, {
    plan: "country" | "province" | "district";
    provinceId?: number | undefined;
}>;
export type BrokerPlanChangeRequest = z.infer<typeof BrokerPlanChangeRequest>;
/** The district a broker works in. `PUT /ops/broker/home-district`. */
export declare const BrokerHomeDistrictRequest: z.ZodObject<{
    districtId: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    districtId: number;
}, {
    districtId: number;
}>;
export type BrokerHomeDistrictRequest = z.infer<typeof BrokerHomeDistrictRequest>;
/** What a broker sees and why, on every list. */
export declare const BrokerScope: z.ZodObject<{
    plan: z.ZodEnum<["district", "province", "country"]>;
    /** "Gasabo", "All of Kigali City", "All of Rwanda". */
    area: z.ZodString;
    districtId: z.ZodNullable<z.ZodNumber>;
    provinceId: z.ZodNullable<z.ZodNumber>;
    /** No home district yet, so the free plan shows nothing until one is chosen. */
    needsDistrict: z.ZodBoolean;
    /** The next plan up and what it would show; null on Country. */
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
export type BrokerScope = z.infer<typeof BrokerScope>;
/** Change a plan's monthly price. `PATCH /admin/brokers/plans/:code`, `admin.fee.edit`. */
export declare const AdminBrokerPlanUpdate: z.ZodObject<{
    priceRwf: z.ZodNumber;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    priceRwf: number;
}, {
    reason: string;
    priceRwf: number;
}>;
export type AdminBrokerPlanUpdate = z.infer<typeof AdminBrokerPlanUpdate>;
export declare const AdminBrokerPlanList: z.ZodObject<{
    plans: z.ZodArray<z.ZodObject<{
        code: z.ZodEnum<["district", "province", "country"]>;
        name: z.ZodString;
        /** Per month, in whole francs. 0 for District. */
        priceRwf: z.ZodNumber;
        active: z.ZodBoolean;
        sort: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        sort: number;
        code: "country" | "province" | "district";
        active: boolean;
        name: string;
        priceRwf: number;
    }, {
        sort: number;
        code: "country" | "province" | "district";
        active: boolean;
        name: string;
        priceRwf: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    plans: {
        sort: number;
        code: "country" | "province" | "district";
        active: boolean;
        name: string;
        priceRwf: number;
    }[];
}, {
    plans: {
        sort: number;
        code: "country" | "province" | "district";
        active: boolean;
        name: string;
        priceRwf: number;
    }[];
}>;
export type AdminBrokerPlanList = z.infer<typeof AdminBrokerPlanList>;
export declare const AdminBrokerSubscription: z.ZodObject<{
    id: z.ZodString;
    brokerId: z.ZodString;
    brokerName: z.ZodNullable<z.ZodString>;
    plan: z.ZodEnum<["district", "province", "country"]>;
    area: z.ZodString;
    status: z.ZodEnum<["active", "pending_payment", "past_due", "cancelled", "expired"]>;
    periodStart: z.ZodEffects<z.ZodString, string, string>;
    periodEnd: z.ZodEffects<z.ZodString, string, string>;
    cancelAtPeriodEnd: z.ZodBoolean;
    method: z.ZodNullable<z.ZodEnum<["mtn_momo", "airtel_money", "card"]>>;
    paidRwf: z.ZodNumber;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "pending_payment" | "active" | "cancelled" | "expired" | "past_due";
    id: string;
    brokerId: string;
    paidRwf: number;
    createdAt: string;
    periodStart: string;
    periodEnd: string;
    brokerName: string | null;
    method: "mtn_momo" | "airtel_money" | "card" | null;
    area: string;
    plan: "country" | "province" | "district";
    cancelAtPeriodEnd: boolean;
}, {
    status: "pending_payment" | "active" | "cancelled" | "expired" | "past_due";
    id: string;
    brokerId: string;
    paidRwf: number;
    createdAt: string;
    periodStart: string;
    periodEnd: string;
    brokerName: string | null;
    method: "mtn_momo" | "airtel_money" | "card" | null;
    area: string;
    plan: "country" | "province" | "district";
    cancelAtPeriodEnd: boolean;
}>;
export type AdminBrokerSubscription = z.infer<typeof AdminBrokerSubscription>;
export declare const AdminBrokerSubscriptionList: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        brokerId: z.ZodString;
        brokerName: z.ZodNullable<z.ZodString>;
        plan: z.ZodEnum<["district", "province", "country"]>;
        area: z.ZodString;
        status: z.ZodEnum<["active", "pending_payment", "past_due", "cancelled", "expired"]>;
        periodStart: z.ZodEffects<z.ZodString, string, string>;
        periodEnd: z.ZodEffects<z.ZodString, string, string>;
        cancelAtPeriodEnd: z.ZodBoolean;
        method: z.ZodNullable<z.ZodEnum<["mtn_momo", "airtel_money", "card"]>>;
        paidRwf: z.ZodNumber;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "pending_payment" | "active" | "cancelled" | "expired" | "past_due";
        id: string;
        brokerId: string;
        paidRwf: number;
        createdAt: string;
        periodStart: string;
        periodEnd: string;
        brokerName: string | null;
        method: "mtn_momo" | "airtel_money" | "card" | null;
        area: string;
        plan: "country" | "province" | "district";
        cancelAtPeriodEnd: boolean;
    }, {
        status: "pending_payment" | "active" | "cancelled" | "expired" | "past_due";
        id: string;
        brokerId: string;
        paidRwf: number;
        createdAt: string;
        periodStart: string;
        periodEnd: string;
        brokerName: string | null;
        method: "mtn_momo" | "airtel_money" | "card" | null;
        area: string;
        plan: "country" | "province" | "district";
        cancelAtPeriodEnd: boolean;
    }>, "many">;
    meta: z.ZodObject<{
        total: z.ZodNumber;
        page: z.ZodNumber;
        pageSize: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        page: number;
        pageSize: number;
    }, {
        total: number;
        page: number;
        pageSize: number;
    }>;
}, "strip", z.ZodTypeAny, {
    items: {
        status: "pending_payment" | "active" | "cancelled" | "expired" | "past_due";
        id: string;
        brokerId: string;
        paidRwf: number;
        createdAt: string;
        periodStart: string;
        periodEnd: string;
        brokerName: string | null;
        method: "mtn_momo" | "airtel_money" | "card" | null;
        area: string;
        plan: "country" | "province" | "district";
        cancelAtPeriodEnd: boolean;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}, {
    items: {
        status: "pending_payment" | "active" | "cancelled" | "expired" | "past_due";
        id: string;
        brokerId: string;
        paidRwf: number;
        createdAt: string;
        periodStart: string;
        periodEnd: string;
        brokerName: string | null;
        method: "mtn_momo" | "airtel_money" | "card" | null;
        area: string;
        plan: "country" | "province" | "district";
        cancelAtPeriodEnd: boolean;
    }[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
    };
}>;
export type AdminBrokerSubscriptionList = z.infer<typeof AdminBrokerSubscriptionList>;
/** The two rails the registration fee is paid on. */
export declare const BrokerFeeMethod: z.ZodEnum<["mtn_momo", "airtel_money"]>;
export type BrokerFeeMethod = z.infer<typeof BrokerFeeMethod>;
/** `POST /registrations/broker/fee` (Idempotency-Key): a prompt for the registration fee. */
export declare const BrokerFeeCheckoutRequest: z.ZodEffects<z.ZodObject<{
    method: z.ZodEnum<["mtn_momo", "airtel_money"]>;
    phone: z.ZodPipeline<z.ZodEffects<z.ZodString, string | null, string>, z.ZodString>;
}, "strip", z.ZodTypeAny, {
    phone: string;
    method: "mtn_momo" | "airtel_money";
}, {
    phone: string;
    method: "mtn_momo" | "airtel_money";
}>, {
    phone: string;
    method: "mtn_momo" | "airtel_money";
}, {
    phone: string;
    method: "mtn_momo" | "airtel_money";
}>;
export type BrokerFeeCheckoutRequest = z.infer<typeof BrokerFeeCheckoutRequest>;
/** The registration fee payment, polled while the prompt waits. */
export declare const BrokerFeePayment: z.ZodObject<{
    id: z.ZodString;
    amountRwf: z.ZodNumber;
    method: z.ZodEnum<["mtn_momo", "airtel_money"]>;
    methodWords: z.ZodString;
    status: z.ZodEnum<["pending", "paid", "failed"]>;
    failureReason: z.ZodNullable<z.ZodString>;
    paidAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "failed" | "paid";
    id: string;
    amountRwf: number;
    failureReason: string | null;
    paidAt: string | null;
    method: "mtn_momo" | "airtel_money";
    methodWords: string;
}, {
    status: "pending" | "failed" | "paid";
    id: string;
    amountRwf: number;
    failureReason: string | null;
    paidAt: string | null;
    method: "mtn_momo" | "airtel_money";
    methodWords: string;
}>;
export type BrokerFeePayment = z.infer<typeof BrokerFeePayment>;
/** `GET /registrations/broker/fee`: what registering costs, and a payment already made. */
export declare const BrokerFeeQuote: z.ZodObject<{
    amountRwf: z.ZodNumber;
    paid: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        amountRwf: z.ZodNumber;
        method: z.ZodEnum<["mtn_momo", "airtel_money"]>;
        methodWords: z.ZodString;
        status: z.ZodEnum<["pending", "paid", "failed"]>;
        failureReason: z.ZodNullable<z.ZodString>;
        paidAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "failed" | "paid";
        id: string;
        amountRwf: number;
        failureReason: string | null;
        paidAt: string | null;
        method: "mtn_momo" | "airtel_money";
        methodWords: string;
    }, {
        status: "pending" | "failed" | "paid";
        id: string;
        amountRwf: number;
        failureReason: string | null;
        paidAt: string | null;
        method: "mtn_momo" | "airtel_money";
        methodWords: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    amountRwf: number;
    paid: {
        status: "pending" | "failed" | "paid";
        id: string;
        amountRwf: number;
        failureReason: string | null;
        paidAt: string | null;
        method: "mtn_momo" | "airtel_money";
        methodWords: string;
    } | null;
}, {
    amountRwf: number;
    paid: {
        status: "pending" | "failed" | "paid";
        id: string;
        amountRwf: number;
        failureReason: string | null;
        paidAt: string | null;
        method: "mtn_momo" | "airtel_money";
        methodWords: string;
    } | null;
}>;
export type BrokerFeeQuote = z.infer<typeof BrokerFeeQuote>;
//# sourceMappingURL=broker-plans.d.ts.map