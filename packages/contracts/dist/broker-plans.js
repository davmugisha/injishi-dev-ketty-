"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrokerFeeQuote = exports.BrokerFeePayment = exports.BrokerFeeCheckoutRequest = exports.BrokerFeeMethod = exports.AdminBrokerSubscriptionList = exports.AdminBrokerSubscription = exports.AdminBrokerPlanList = exports.AdminBrokerPlanUpdate = exports.BrokerScope = exports.BrokerHomeDistrictRequest = exports.BrokerPlanChangeRequest = exports.BrokerPlanCheckoutRequest = exports.BrokerPlanOverview = exports.BrokerPlanPayment = exports.BrokerPlan = exports.BROKER_DISTRICT_CHANGE_DAYS = exports.BROKER_PLAN_GRACE_DAYS = exports.BrokerPaymentKind = exports.BrokerPaymentStatus = exports.BROKER_PAY_METHOD_LABEL = exports.BrokerPayMethod = exports.BrokerPlanStatus = exports.BrokerPlanCode = void 0;
exports.provinceLabel = provinceLabel;
exports.brokerAreaLabel = brokerAreaLabel;
const zod_1 = require("zod");
const admin_1 = require("./admin");
const primitives_1 = require("./primitives");
const dates_1 = require("./rentals/dates");
const money_1 = require("./rentals/money");
/**
 * Broker plans: how much of Rwanda a broker sees.
 *
 * District is free and shows the opted-in homes in the broker's own district.
 * Province and Country are monthly plans paid through the gateway (MTN MoMo,
 * Airtel Money or a card on the gateway's own page). Prices live in the
 * `broker_plans` table, never here; the codes are fixed because what each one
 * covers is code, not data.
 */
exports.BrokerPlanCode = zod_1.z.enum(["district", "province", "country"]);
exports.BrokerPlanStatus = zod_1.z.enum(["active", "pending_payment", "past_due", "cancelled", "expired"]);
exports.BrokerPayMethod = zod_1.z.enum(["mtn_momo", "airtel_money", "card"]);
exports.BROKER_PAY_METHOD_LABEL = {
    mtn_momo: "MTN MoMo",
    airtel_money: "Airtel Money",
    card: "Card",
};
exports.BrokerPaymentStatus = zod_1.z.enum(["pending", "paid", "failed"]);
exports.BrokerPaymentKind = zod_1.z.enum(["start", "renewal"]);
/** Days a paid plan keeps working after a renewal fails, before it drops to District. */
exports.BROKER_PLAN_GRACE_DAYS = 3;
/** How often a broker on the free plan may move their home district. */
exports.BROKER_DISTRICT_CHANGE_DAYS = 30;
/** A province's everyday name. The table holds "KIGALI", "NORTH" and so on. */
function provinceLabel(name) {
    const key = name.trim().toUpperCase();
    const known = {
        KIGALI: "Kigali City",
        NORTH: "Northern Province",
        SOUTH: "Southern Province",
        EAST: "Eastern Province",
        WEST: "Western Province",
    };
    if (known[key])
        return known[key];
    return name.trim().charAt(0).toUpperCase() + name.trim().slice(1).toLowerCase();
}
/** What a plan covers, in words: "Gasabo", "All of Kigali City", "All of Rwanda". */
function brokerAreaLabel(plan, place) {
    if (plan === "country")
        return "All of Rwanda";
    if (plan === "province")
        return place.province ? `All of ${provinceLabel(place.province)}` : "One province";
    return place.district ?? "Your district";
}
/** One plan as the catalogue offers it. */
exports.BrokerPlan = zod_1.z.object({
    code: exports.BrokerPlanCode,
    name: zod_1.z.string(),
    /** Per month, in whole francs. 0 for District. */
    priceRwf: zod_1.z.number().int().nonnegative(),
    active: zod_1.z.boolean(),
    sort: zod_1.z.number().int(),
});
/** One payment for a plan, as the broker's history shows it. */
exports.BrokerPlanPayment = zod_1.z.object({
    id: primitives_1.Uuid,
    planCode: exports.BrokerPlanCode,
    kind: exports.BrokerPaymentKind,
    periodStart: dates_1.CalendarDay,
    periodEnd: dates_1.CalendarDay,
    amountRwf: zod_1.z.number().int(),
    method: exports.BrokerPayMethod,
    /** "MTN MoMo 078•••456" or "Card". */
    methodWords: zod_1.z.string(),
    status: exports.BrokerPaymentStatus,
    failureReason: zod_1.z.string().nullable(),
    /** Where to send the broker to pay by card; only while a card payment waits. */
    checkoutUrl: zod_1.z.string().nullable(),
    paidAt: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
});
/** Where the broker stands. `GET /ops/broker/plan`. */
exports.BrokerPlanOverview = zod_1.z.object({
    plans: zod_1.z.array(exports.BrokerPlan),
    home: zod_1.z.object({
        districtId: zod_1.z.number().int().nullable(),
        districtName: zod_1.z.string().nullable(),
        provinceId: zod_1.z.number().int().nullable(),
        provinceName: zod_1.z.string().nullable(),
        /** On the free plan, the first day the home district may change again; null when it may now. */
        changeFrom: dates_1.CalendarDay.nullable(),
    }),
    /** The plan in force now. District when nothing paid is. */
    current: zod_1.z.object({
        plan: exports.BrokerPlanCode,
        status: exports.BrokerPlanStatus,
        area: zod_1.z.string(),
        provinceId: zod_1.z.number().int().nullable(),
        periodStart: dates_1.CalendarDay.nullable(),
        periodEnd: dates_1.CalendarDay.nullable(),
        /** The day the next payment is due; null on District or when it ends. */
        nextPaymentOn: dates_1.CalendarDay.nullable(),
        nextAmountRwf: zod_1.z.number().int().nullable(),
        /** What it becomes at the period end, when the broker chose a cheaper plan. */
        endsInto: exports.BrokerPlanCode.nullable(),
        /** A failed renewal: the plan works until this day, then drops to District. */
        graceUntil: dates_1.CalendarDay.nullable(),
        method: exports.BrokerPayMethod.nullable(),
    }),
    /** What paying for each plan would charge today: an upgrade less what is left of this month. */
    quotes: zod_1.z.array(zod_1.z.object({ plan: exports.BrokerPlanCode, amountRwf: zod_1.z.number().int() })),
    /** A payment still waiting on a phone or a card page. */
    pending: exports.BrokerPlanPayment.nullable(),
    payments: zod_1.z.array(exports.BrokerPlanPayment),
    /** Every province, for the Province plan's picker. */
    provinces: zod_1.z.array(zod_1.z.object({ id: zod_1.z.number().int(), name: zod_1.z.string(), label: zod_1.z.string() })),
});
/**
 * Pay for a plan: an upgrade, or a past-due month. `POST /ops/broker/plan/checkout`
 * with an `Idempotency-Key`. The plan changes only once the money lands.
 */
exports.BrokerPlanCheckoutRequest = zod_1.z
    .object({
    plan: zod_1.z.enum(["province", "country"]),
    /** The province, for the Province plan. Left out: the home district's. */
    provinceId: zod_1.z.number().int().positive().optional(),
    method: exports.BrokerPayMethod,
    /** The number the prompt goes to, for MoMo and Airtel. */
    phone: money_1.MomoNumber.optional(),
})
    .superRefine((v, ctx) => {
    if (v.method === "card")
        return;
    if (!v.phone) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["phone"], message: "Enter the number the prompt goes to." });
        return;
    }
    const network = (0, money_1.momoNetworkOf)(v.phone);
    if (v.method === "mtn_momo" && network !== "mtn") {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["phone"], message: "MTN numbers start 078 or 079." });
    }
    if (v.method === "airtel_money" && network !== "airtel") {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["phone"], message: "Airtel numbers start 072 or 073." });
    }
});
/**
 * Move to a cheaper plan at the end of the month, keep the current one
 * (undoing that), or switch the Province plan's province.
 * `POST /ops/broker/plan/change`. Never takes money.
 */
exports.BrokerPlanChangeRequest = zod_1.z.object({
    plan: exports.BrokerPlanCode,
    provinceId: zod_1.z.number().int().positive().optional(),
});
/** The district a broker works in. `PUT /ops/broker/home-district`. */
exports.BrokerHomeDistrictRequest = zod_1.z.object({
    districtId: zod_1.z.number({ required_error: "Choose a district." }).int().positive("Choose a district."),
});
/** What a broker sees and why, on every list. */
exports.BrokerScope = zod_1.z.object({
    plan: exports.BrokerPlanCode,
    /** "Gasabo", "All of Kigali City", "All of Rwanda". */
    area: zod_1.z.string(),
    districtId: zod_1.z.number().int().nullable(),
    provinceId: zod_1.z.number().int().nullable(),
    /** No home district yet, so the free plan shows nothing until one is chosen. */
    needsDistrict: zod_1.z.boolean(),
    /** The next plan up and what it would show; null on Country. */
    upgrade: zod_1.z.object({ plan: exports.BrokerPlanCode, area: zod_1.z.string(), priceRwf: zod_1.z.number().int() }).nullable(),
});
// --- Admin ------------------------------------------------------------------
/** Change a plan's monthly price. `PATCH /admin/brokers/plans/:code`, `admin.fee.edit`. */
exports.AdminBrokerPlanUpdate = zod_1.z.object({
    priceRwf: zod_1.z
        .number({ invalid_type_error: "Enter a price." })
        .int("Whole francs only.")
        .min(0)
        .max(10000000, "Up to RWF 10,000,000 a month."),
    reason: zod_1.z.string().trim().min(5, "Say why, in a few words.").max(500),
});
exports.AdminBrokerPlanList = zod_1.z.object({ plans: zod_1.z.array(exports.BrokerPlan) });
exports.AdminBrokerSubscription = zod_1.z.object({
    id: primitives_1.Uuid,
    brokerId: primitives_1.Uuid,
    brokerName: zod_1.z.string().nullable(),
    plan: exports.BrokerPlanCode,
    area: zod_1.z.string(),
    status: exports.BrokerPlanStatus,
    periodStart: dates_1.CalendarDay,
    periodEnd: dates_1.CalendarDay,
    cancelAtPeriodEnd: zod_1.z.boolean(),
    method: exports.BrokerPayMethod.nullable(),
    paidRwf: zod_1.z.number().int(),
    createdAt: zod_1.z.string(),
});
exports.AdminBrokerSubscriptionList = zod_1.z.object({ items: zod_1.z.array(exports.AdminBrokerSubscription), meta: admin_1.AdminListMeta });
// --- Registration fee -------------------------------------------------------
/** The two rails the registration fee is paid on. */
exports.BrokerFeeMethod = zod_1.z.enum(["mtn_momo", "airtel_money"]);
/** `POST /registrations/broker/fee` (Idempotency-Key): a prompt for the registration fee. */
exports.BrokerFeeCheckoutRequest = zod_1.z
    .object({ method: exports.BrokerFeeMethod, phone: money_1.MomoNumber })
    .superRefine((v, ctx) => {
    const network = (0, money_1.momoNetworkOf)(v.phone);
    if (v.method === "mtn_momo" && network !== "mtn") {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["phone"], message: "MTN numbers start 078 or 079." });
    }
    if (v.method === "airtel_money" && network !== "airtel") {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["phone"], message: "Airtel numbers start 072 or 073." });
    }
});
/** The registration fee payment, polled while the prompt waits. */
exports.BrokerFeePayment = zod_1.z.object({
    id: primitives_1.Uuid,
    amountRwf: zod_1.z.number().int(),
    method: exports.BrokerFeeMethod,
    methodWords: zod_1.z.string(),
    status: exports.BrokerPaymentStatus,
    failureReason: zod_1.z.string().nullable(),
    paidAt: zod_1.z.string().nullable(),
});
/** `GET /registrations/broker/fee`: what registering costs, and a payment already made. */
exports.BrokerFeeQuote = zod_1.z.object({ amountRwf: zod_1.z.number().int(), paid: exports.BrokerFeePayment.nullable() });
//# sourceMappingURL=broker-plans.js.map