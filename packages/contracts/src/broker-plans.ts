import { z } from "zod";
import { AdminListMeta } from "./admin";
import { Uuid } from "./primitives";
import { CalendarDay } from "./rentals/dates";
import { MomoNumber, momoNetworkOf } from "./rentals/money";

/**
 * Broker plans: how much of Rwanda a broker sees.
 *
 * District is free and shows the opted-in homes in the broker's own district.
 * Province and Country are monthly plans paid through the gateway (MTN MoMo,
 * Airtel Money or a card on the gateway's own page). Prices live in the
 * `broker_plans` table, never here; the codes are fixed because what each one
 * covers is code, not data.
 */
export const BrokerPlanCode = z.enum(["district", "province", "country"]);
export type BrokerPlanCode = z.infer<typeof BrokerPlanCode>;
export const BrokerPlanStatus = z.enum(["active", "pending_payment", "past_due", "cancelled", "expired"]);
export type BrokerPlanStatus = z.infer<typeof BrokerPlanStatus>;
export const BrokerPayMethod = z.enum(["mtn_momo", "airtel_money", "card"]);
export type BrokerPayMethod = z.infer<typeof BrokerPayMethod>;
export const BROKER_PAY_METHOD_LABEL: Readonly<Record<BrokerPayMethod, string>> = {
  mtn_momo: "MTN MoMo",
  airtel_money: "Airtel Money",
  card: "Card",
};
export const BrokerPaymentStatus = z.enum(["pending", "paid", "failed"]);
export type BrokerPaymentStatus = z.infer<typeof BrokerPaymentStatus>;
export const BrokerPaymentKind = z.enum(["start", "renewal"]);
export type BrokerPaymentKind = z.infer<typeof BrokerPaymentKind>;

/** Days a paid plan keeps working after a renewal fails, before it drops to District. */
export const BROKER_PLAN_GRACE_DAYS = 3;
/** How often a broker on the free plan may move their home district. */
export const BROKER_DISTRICT_CHANGE_DAYS = 30;

/** A province's everyday name. The table holds "KIGALI", "NORTH" and so on. */
export function provinceLabel(name: string): string {
  const key = name.trim().toUpperCase();
  const known: Record<string, string> = {
    KIGALI: "Kigali City",
    NORTH: "Northern Province",
    SOUTH: "Southern Province",
    EAST: "Eastern Province",
    WEST: "Western Province",
  };
  if (known[key]) return known[key];
  return name.trim().charAt(0).toUpperCase() + name.trim().slice(1).toLowerCase();
}

/** What a plan covers, in words: "Gasabo", "All of Kigali City", "All of Rwanda". */
export function brokerAreaLabel(plan: BrokerPlanCode, place: { district?: string | null; province?: string | null }): string {
  if (plan === "country") return "All of Rwanda";
  if (plan === "province") return place.province ? `All of ${provinceLabel(place.province)}` : "One province";
  return place.district ?? "Your district";
}

/** One plan as the catalogue offers it. */
export const BrokerPlan = z.object({
  code: BrokerPlanCode,
  name: z.string(),
  /** Per month, in whole francs. 0 for District. */
  priceRwf: z.number().int().nonnegative(),
  active: z.boolean(),
  sort: z.number().int(),
});
export type BrokerPlan = z.infer<typeof BrokerPlan>;

/** One payment for a plan, as the broker's history shows it. */
export const BrokerPlanPayment = z.object({
  id: Uuid,
  planCode: BrokerPlanCode,
  kind: BrokerPaymentKind,
  periodStart: CalendarDay,
  periodEnd: CalendarDay,
  amountRwf: z.number().int(),
  method: BrokerPayMethod,
  /** "MTN MoMo 078•••456" or "Card". */
  methodWords: z.string(),
  status: BrokerPaymentStatus,
  failureReason: z.string().nullable(),
  /** Where to send the broker to pay by card; only while a card payment waits. */
  checkoutUrl: z.string().nullable(),
  paidAt: z.string().nullable(),
  createdAt: z.string(),
});
export type BrokerPlanPayment = z.infer<typeof BrokerPlanPayment>;

/** Where the broker stands. `GET /ops/broker/plan`. */
export const BrokerPlanOverview = z.object({
  plans: z.array(BrokerPlan),
  home: z.object({
    districtId: z.number().int().nullable(),
    districtName: z.string().nullable(),
    provinceId: z.number().int().nullable(),
    provinceName: z.string().nullable(),
    /** On the free plan, the first day the home district may change again; null when it may now. */
    changeFrom: CalendarDay.nullable(),
  }),
  /** The plan in force now. District when nothing paid is. */
  current: z.object({
    plan: BrokerPlanCode,
    status: BrokerPlanStatus,
    area: z.string(),
    provinceId: z.number().int().nullable(),
    periodStart: CalendarDay.nullable(),
    periodEnd: CalendarDay.nullable(),
    /** The day the next payment is due; null on District or when it ends. */
    nextPaymentOn: CalendarDay.nullable(),
    nextAmountRwf: z.number().int().nullable(),
    /** What it becomes at the period end, when the broker chose a cheaper plan. */
    endsInto: BrokerPlanCode.nullable(),
    /** A failed renewal: the plan works until this day, then drops to District. */
    graceUntil: CalendarDay.nullable(),
    method: BrokerPayMethod.nullable(),
  }),
  /** What paying for each plan would charge today: an upgrade less what is left of this month. */
  quotes: z.array(z.object({ plan: BrokerPlanCode, amountRwf: z.number().int() })),
  /** A payment still waiting on a phone or a card page. */
  pending: BrokerPlanPayment.nullable(),
  payments: z.array(BrokerPlanPayment),
  /** Every province, for the Province plan's picker. */
  provinces: z.array(z.object({ id: z.number().int(), name: z.string(), label: z.string() })),
});
export type BrokerPlanOverview = z.infer<typeof BrokerPlanOverview>;

/**
 * Pay for a plan: an upgrade, or a past-due month. `POST /ops/broker/plan/checkout`
 * with an `Idempotency-Key`. The plan changes only once the money lands.
 */
export const BrokerPlanCheckoutRequest = z
  .object({
    plan: z.enum(["province", "country"]),
    /** The province, for the Province plan. Left out: the home district's. */
    provinceId: z.number().int().positive().optional(),
    method: BrokerPayMethod,
    /** The number the prompt goes to, for MoMo and Airtel. */
    phone: MomoNumber.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.method === "card") return;
    if (!v.phone) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["phone"], message: "Enter the number the prompt goes to." });
      return;
    }
    const network = momoNetworkOf(v.phone);
    if (v.method === "mtn_momo" && network !== "mtn") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["phone"], message: "MTN numbers start 078 or 079." });
    }
    if (v.method === "airtel_money" && network !== "airtel") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["phone"], message: "Airtel numbers start 072 or 073." });
    }
  });
export type BrokerPlanCheckoutRequest = z.infer<typeof BrokerPlanCheckoutRequest>;

/**
 * Move to a cheaper plan at the end of the month, keep the current one
 * (undoing that), or switch the Province plan's province.
 * `POST /ops/broker/plan/change`. Never takes money.
 */
export const BrokerPlanChangeRequest = z.object({
  plan: BrokerPlanCode,
  provinceId: z.number().int().positive().optional(),
});
export type BrokerPlanChangeRequest = z.infer<typeof BrokerPlanChangeRequest>;

/** The district a broker works in. `PUT /ops/broker/home-district`. */
export const BrokerHomeDistrictRequest = z.object({
  districtId: z.number({ required_error: "Choose a district." }).int().positive("Choose a district."),
});
export type BrokerHomeDistrictRequest = z.infer<typeof BrokerHomeDistrictRequest>;

/** What a broker sees and why, on every list. */
export const BrokerScope = z.object({
  plan: BrokerPlanCode,
  /** "Gasabo", "All of Kigali City", "All of Rwanda". */
  area: z.string(),
  districtId: z.number().int().nullable(),
  provinceId: z.number().int().nullable(),
  /** No home district yet, so the free plan shows nothing until one is chosen. */
  needsDistrict: z.boolean(),
  /** The next plan up and what it would show; null on Country. */
  upgrade: z.object({ plan: BrokerPlanCode, area: z.string(), priceRwf: z.number().int() }).nullable(),
});
export type BrokerScope = z.infer<typeof BrokerScope>;

// --- Admin ------------------------------------------------------------------

/** Change a plan's monthly price. `PATCH /admin/brokers/plans/:code`, `admin.fee.edit`. */
export const AdminBrokerPlanUpdate = z.object({
  priceRwf: z
    .number({ invalid_type_error: "Enter a price." })
    .int("Whole francs only.")
    .min(0)
    .max(10_000_000, "Up to RWF 10,000,000 a month."),
  reason: z.string().trim().min(5, "Say why, in a few words.").max(500),
});
export type AdminBrokerPlanUpdate = z.infer<typeof AdminBrokerPlanUpdate>;

export const AdminBrokerPlanList = z.object({ plans: z.array(BrokerPlan) });
export type AdminBrokerPlanList = z.infer<typeof AdminBrokerPlanList>;

export const AdminBrokerSubscription = z.object({
  id: Uuid,
  brokerId: Uuid,
  brokerName: z.string().nullable(),
  plan: BrokerPlanCode,
  area: z.string(),
  status: BrokerPlanStatus,
  periodStart: CalendarDay,
  periodEnd: CalendarDay,
  cancelAtPeriodEnd: z.boolean(),
  method: BrokerPayMethod.nullable(),
  paidRwf: z.number().int(),
  createdAt: z.string(),
});
export type AdminBrokerSubscription = z.infer<typeof AdminBrokerSubscription>;

export const AdminBrokerSubscriptionList = z.object({ items: z.array(AdminBrokerSubscription), meta: AdminListMeta });
export type AdminBrokerSubscriptionList = z.infer<typeof AdminBrokerSubscriptionList>;

// --- Registration fee -------------------------------------------------------

/** The two rails the registration fee is paid on. */
export const BrokerFeeMethod = z.enum(["mtn_momo", "airtel_money"]);
export type BrokerFeeMethod = z.infer<typeof BrokerFeeMethod>;

/** `POST /registrations/broker/fee` (Idempotency-Key): a prompt for the registration fee. */
export const BrokerFeeCheckoutRequest = z
  .object({ method: BrokerFeeMethod, phone: MomoNumber })
  .superRefine((v, ctx) => {
    const network = momoNetworkOf(v.phone);
    if (v.method === "mtn_momo" && network !== "mtn") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["phone"], message: "MTN numbers start 078 or 079." });
    }
    if (v.method === "airtel_money" && network !== "airtel") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["phone"], message: "Airtel numbers start 072 or 073." });
    }
  });
export type BrokerFeeCheckoutRequest = z.infer<typeof BrokerFeeCheckoutRequest>;

/** The registration fee payment, polled while the prompt waits. */
export const BrokerFeePayment = z.object({
  id: Uuid,
  amountRwf: z.number().int(),
  method: BrokerFeeMethod,
  methodWords: z.string(),
  status: BrokerPaymentStatus,
  failureReason: z.string().nullable(),
  paidAt: z.string().nullable(),
});
export type BrokerFeePayment = z.infer<typeof BrokerFeePayment>;

/** `GET /registrations/broker/fee`: what registering costs, and a payment already made. */
export const BrokerFeeQuote = z.object({ amountRwf: z.number().int(), paid: BrokerFeePayment.nullable() });
export type BrokerFeeQuote = z.infer<typeof BrokerFeeQuote>;
