"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantPaymentList = exports.TenantPaymentView = exports.TenantChargeList = exports.PayoutList = exports.PayoutView = exports.RemindersSent = exports.LeaseReminderList = exports.LeaseReminderView = exports.RentSummary = exports.RentRoll = exports.RentRollRow = exports.RENT_ROLL_STATUS_LABEL = exports.RentRollStatus = exports.LeaseChargeList = exports.LeasePaymentList = exports.LeasePaymentView = exports.PaymentPayoutView = exports.PaymentAllocationView = exports.LeaseChargeView = exports.TenantPayRequest = exports.TenantPaymentMethod = exports.PayoutsQuery = exports.PAYOUT_STATUS_LABEL = exports.PayoutStatus = exports.RentRemindersQuery = exports.RentPaymentsQuery = exports.RentChargesQuery = exports.ChargeFilterStatus = exports.RentMonthQuery = exports.RemindRentRequest = exports.WaiveChargeRequest = exports.MAX_PAYMENT_CHARGE_IDS = exports.GATEWAY_PROMPT_MINUTES = exports.MANUAL_REMINDERS_PER_DAY = exports.REMINDER_HOURS = exports.OVERDUE_REMINDER_DAYS = exports.RENT_REMINDER_DAYS_BEFORE = void 0;
exports.kigaliHour = kigaliHour;
exports.withinReminderHours = withinReminderHours;
exports.reminderStageFor = reminderStageFor;
exports.chargeWords = chargeWords;
exports.reminderSentence = reminderSentence;
exports.maxGatewayPaymentRwf = maxGatewayPaymentRwf;
exports.nationalMsisdn = nationalMsisdn;
exports.paymentStatusWords = paymentStatusWords;
exports.receiptNumber = receiptNumber;
exports.nextReceiptNumber = nextReceiptNumber;
exports.currentMonthKey = currentMonthKey;
const zod_1 = require("zod");
const primitives_1 = require("../primitives");
const dates_1 = require("./dates");
const money_1 = require("./money");
const overview_1 = require("./overview");
const vocab_1 = require("./vocab");
const schedule_1 = require("./schedule");
// ===========================================================================
// The rent cycle: reminders, payments (recorded and through the gateway),
// payouts, and what the rent screens read (blueprint 2.3 "Rent", 2.4, WP 1.6)
// ===========================================================================
//
// Money is whole francs; days are Kigali days; moments are ISO timestamps.
// The rules here are pure so the job, the API and the screens agree on when a
// reminder goes, what a payment status says, and how far a tenant may overpay.
const IsoMoment = zod_1.z.string();
// --- Reminders -------------------------------------------------------------------
/** A tenant is told this many days before rent falls due. */
exports.RENT_REMINDER_DAYS_BEFORE = 3;
/**
 * The overdue reminders: on the first overdue day, then 7 and 14 days after
 * it. Each is one `stage` of the `overdue` kind, sent at most once per charge.
 */
exports.OVERDUE_REMINDER_DAYS = [0, 7, 14];
/** The hours in Kigali between which automatic reminders go out (from 08:00, before 18:00). */
exports.REMINDER_HOURS = { from: 8, to: 18 };
/** A landlord may send one manual reminder per charge per Kigali day. */
exports.MANUAL_REMINDERS_PER_DAY = 1;
/** The hour of the day in Kigali (0 to 23) an instant falls in. */
function kigaliHour(now = new Date()) {
    return (now.getUTCHours() + 2) % 24;
}
/** May an automatic reminder go out now? Only during the day in Kigali. */
function withinReminderHours(now = new Date()) {
    const hour = kigaliHour(now);
    return hour >= exports.REMINDER_HOURS.from && hour < exports.REMINDER_HOURS.to;
}
/**
 * The reminder an open charge is at on `today`, or null when none applies:
 * `upcoming` in the last `RENT_REMINDER_DAYS_BEFORE` days before it falls due,
 * `due` on the day, and `overdue` once it is past its due day plus the grace
 * days, then again 7 and 14 days later. Only the latest stage applies, so a
 * charge raised on its due day gets "due today" and never a late "coming up",
 * and a job that missed a week sends the stage the tenant is at, not the ones
 * it missed.
 */
function reminderStageFor(today, dueOn, graceDays) {
    const overdueStart = (0, schedule_1.overdueFrom)(dueOn, graceDays);
    if (today >= overdueStart) {
        const days = (0, dates_1.daysBetween)(overdueStart, today);
        let stage = 0;
        exports.OVERDUE_REMINDER_DAYS.forEach((offset, i) => {
            if (days >= offset)
                stage = i;
        });
        return { kind: "overdue", stage };
    }
    if (today === dueOn)
        return { kind: "due", stage: 0 };
    if (today > dueOn)
        return null;
    if ((0, dates_1.addDays)(today, exports.RENT_REMINDER_DAYS_BEFORE) >= dueOn)
        return { kind: "upcoming", stage: 0 };
    return null;
}
/** `Rent for November 2026`, `Deposit`: a charge in words. */
function chargeWords(charge) {
    if (charge.kind === "deposit")
        return "Deposit";
    const day = charge.periodStart ?? charge.dueOn;
    return `Rent for ${(0, dates_1.longDate)(day).split(" ").slice(1).join(" ")}`;
}
/**
 * The one sentence a reminder says about a charge, by stage. Plain words, the
 * amount in francs, no dashes.
 */
function reminderSentence(input) {
    const what = chargeWords(input.charge);
    const amount = (0, vocab_1.formatRwf)(input.owedRwf);
    const due = (0, dates_1.longDate)(input.charge.dueOn);
    const lower = what.charAt(0).toLowerCase() + what.slice(1);
    switch (input.stage) {
        case "upcoming":
            return `Your ${lower} is ${amount}, due on ${due}.`;
        case "due":
            return `Your ${lower} is ${amount} and is due today.`;
        case "overdue":
            return `Your ${lower} of ${amount} was due on ${due} and is now overdue.`;
        default:
            return `A reminder from ${input.landlordName}: ${amount} for your ${lower} is due on ${due}.`;
    }
}
// --- Gateway payments ------------------------------------------------------------
/** A MoMo prompt the tenant has not answered stops being waited for after this long. */
exports.GATEWAY_PROMPT_MINUTES = 10;
/** The most charges one payment names. */
exports.MAX_PAYMENT_CHARGE_IDS = 24;
/**
 * The most a tenant may pay through the gateway: everything owed, plus up to
 * one month's rent kept as credit for the next charge. Nothing when nothing
 * is owed: there is no next charge to hold credit for until one is raised.
 */
function maxGatewayPaymentRwf(outstandingRwf, monthlyRentRwf) {
    if (outstandingRwf <= 0)
        return 0;
    return outstandingRwf + monthlyRentRwf;
}
/** `+250788123456` as the nine national digits a mobile money rail takes: `788123456`. */
function nationalMsisdn(e164) {
    return e164.replace(/^\+250/, "");
}
/** Where a payment stands, in the tenant's words. */
function paymentStatusWords(status, opts = {}) {
    switch (status) {
        case "pending":
            return "Waiting for you to approve the prompt on your phone.";
        case "succeeded":
            return opts.channel === "recorded" ? "Recorded by your landlord." : "Received. Thank you.";
        case "failed":
            return opts.failureReason ?? "The payment did not go through. Nothing was taken.";
        case "expired":
            return "The prompt on your phone expired before it was approved. Nothing was taken.";
        case "reversed":
            return "Reversed by your landlord.";
    }
}
/** `R-2026-0042`: a receipt number, per business and year. */
function receiptNumber(year, n) {
    return `R-${year}-${String(n).padStart(4, "0")}`;
}
/** The number after the highest `R-<year>-<n>` in `taken`, for that year. */
function nextReceiptNumber(year, taken) {
    let highest = 0;
    const re = new RegExp(`^R-${year}-(\\d+)$`);
    for (const ref of taken) {
        const m = re.exec(ref.trim());
        if (m)
            highest = Math.max(highest, Number(m[1]));
    }
    return receiptNumber(year, highest + 1);
}
// --- Requests ------------------------------------------------------------------------
const Reason = zod_1.z
    .string({ required_error: "Say why." })
    .trim()
    .min(3, "Say why, in a few words.")
    .max(500, "Keep it under 500 characters.");
const ChargeIds = zod_1.z
    .array(primitives_1.Uuid)
    .max(exports.MAX_PAYMENT_CHARGE_IDS, `Pick at most ${exports.MAX_PAYMENT_CHARGE_IDS} charges.`)
    .refine((ids) => new Set(ids).size === ids.length, "A charge is named twice.");
// Rent is paid only through the payment integration (2026-10-25): there is no
// request to record, reverse or slip a payment made outside Injishi. Payments
// recorded before (channel `recorded`) are still read and shown as "Recorded".
/** `POST /ops/rent/charges/:id/waive`: the landlord forgives an open charge. */
exports.WaiveChargeRequest = zod_1.z.object({ reason: Reason });
/** `POST /ops/rent/reminders`: remind the tenants of these open charges now, by email. */
exports.RemindRentRequest = zod_1.z.object({
    chargeIds: zod_1.z
        .array(primitives_1.Uuid)
        .min(1, "Pick at least one charge.")
        .max(50, "Pick at most 50 charges at once.")
        .refine((ids) => new Set(ids).size === ids.length, "A charge is named twice."),
    /** A line of the landlord's own, added under the reminder. */
    note: zod_1.z.string().trim().max(300, "Keep the note under 300 characters.").optional(),
});
/** `GET /ops/rent/roll?month`, `GET /ops/rent/summary?month`: a Kigali month, this one by default. */
exports.RentMonthQuery = zod_1.z.object({ month: overview_1.MonthKey.optional() });
/** A charge list filter: `overdue` is open and past the grace days today. */
exports.ChargeFilterStatus = zod_1.z.enum(["open", "paid", "waived", "overdue"]);
/** `GET /ops/rent/charges?leaseId|month&status`. */
exports.RentChargesQuery = zod_1.z.object({
    leaseId: primitives_1.Uuid.optional(),
    month: overview_1.MonthKey.optional(),
    status: exports.ChargeFilterStatus.optional(),
});
/** `GET /ops/rent/payments?leaseId|month&status`. */
exports.RentPaymentsQuery = zod_1.z.object({
    leaseId: primitives_1.Uuid.optional(),
    /** The month the money arrived (received on, or succeeded at, in Kigali). */
    month: overview_1.MonthKey.optional(),
    status: vocab_1.LeasePaymentStatus.optional(),
});
/** `GET /ops/rent/reminders?leaseId|month`. */
exports.RentRemindersQuery = zod_1.z.object({
    leaseId: primitives_1.Uuid.optional(),
    month: overview_1.MonthKey.optional(),
});
exports.PayoutStatus = zod_1.z.enum(["scheduled", "queued", "paid", "held", "failed"]);
exports.PAYOUT_STATUS_LABEL = {
    scheduled: "Scheduled",
    queued: "On its way",
    paid: "Paid",
    held: "Held",
    failed: "Failed",
};
/** `GET /ops/payouts?month&status`: the month the payout was made (the payment's month). */
exports.PayoutsQuery = zod_1.z.object({
    month: overview_1.MonthKey.optional(),
    status: exports.PayoutStatus.optional(),
});
/** The methods a tenant pays with on Injishi today. Card follows when a gateway is chosen. */
exports.TenantPaymentMethod = zod_1.z.enum(["mtn_momo", "airtel_money"]);
/**
 * `POST /me/tenancies/:leaseId/payments` (Idempotency-Key): pay by mobile
 * money. Without an amount, everything owed; a smaller amount pays the oldest
 * charges first; a larger one, up to one month's rent over, is kept as credit.
 */
exports.TenantPayRequest = zod_1.z.object({
    method: exports.TenantPaymentMethod,
    /** The number the prompt goes to, any way it is typed; stored masked. */
    msisdn: money_1.MomoNumber,
    amountRwf: vocab_1.PositiveRwf.optional(),
    /** The charges to pay. Absent: the open ones, oldest due first. */
    chargeIds: ChargeIds.optional(),
});
// --- Views -------------------------------------------------------------------------------
/** One charge, with what it still owes and whether it is late today. */
exports.LeaseChargeView = zod_1.z.object({
    id: primitives_1.Uuid,
    leaseId: primitives_1.Uuid,
    kind: vocab_1.LeaseChargeKind,
    /** "Rent for November 2026", "Deposit". */
    label: zod_1.z.string(),
    periodStart: dates_1.CalendarDay.nullable(),
    periodEnd: dates_1.CalendarDay.nullable(),
    dueOn: dates_1.CalendarDay,
    amountRwf: zod_1.z.number().int(),
    paidRwf: zod_1.z.number().int(),
    outstandingRwf: zod_1.z.number().int(),
    status: vocab_1.LeaseChargeStatus,
    /** Open and past the due day plus the grace days, as of today. */
    overdue: zod_1.z.boolean(),
    /** Days past the due day when overdue; 0 otherwise. */
    daysOverdue: zod_1.z.number().int(),
    waivedReason: zod_1.z.string().nullable(),
    paidAt: IsoMoment.nullable(),
    createdAt: IsoMoment,
});
/** What part of a payment went to which charge. */
exports.PaymentAllocationView = zod_1.z.object({
    chargeId: primitives_1.Uuid,
    kind: vocab_1.LeaseChargeKind,
    label: zod_1.z.string(),
    periodStart: dates_1.CalendarDay.nullable(),
    dueOn: dates_1.CalendarDay,
    amountRwf: zod_1.z.number().int(),
});
/** The payout a gateway payment went on to the landlord with. */
exports.PaymentPayoutView = zod_1.z.object({
    id: primitives_1.Uuid,
    status: exports.PayoutStatus,
    /** "MTN MoMo 078•••••456", or null while held with no account. */
    destination: zod_1.z.string().nullable(),
    settledAt: IsoMoment.nullable(),
    failureReason: zod_1.z.string().nullable(),
});
/** One payment as the landlord's screens show it. */
exports.LeasePaymentView = zod_1.z.object({
    id: primitives_1.Uuid,
    leaseId: primitives_1.Uuid,
    leaseReference: zod_1.z.string(),
    tenant: zod_1.z.object({ id: primitives_1.Uuid, fullName: zod_1.z.string() }),
    unit: zod_1.z.object({ id: primitives_1.Uuid, label: zod_1.z.string(), propertyName: zod_1.z.string() }),
    channel: vocab_1.LeasePaymentChannel,
    method: vocab_1.LeasePaymentMethod,
    amountRwf: zod_1.z.number().int(),
    /** What went to charges; the rest is the tenant's credit. */
    allocatedRwf: zod_1.z.number().int(),
    creditRwf: zod_1.z.number().int(),
    status: vocab_1.LeasePaymentStatus,
    statusWords: zod_1.z.string(),
    /** The day the money arrived: received on, or the day it succeeded in Kigali. */
    paidOn: dates_1.CalendarDay.nullable(),
    succeededAt: IsoMoment.nullable(),
    reference: zod_1.z.string().nullable(),
    payerMasked: zod_1.z.string().nullable(),
    receiptNumber: zod_1.z.string().nullable(),
    /** The landlord attached a photo or scan of the slip. */
    hasSlip: zod_1.z.boolean(),
    note: zod_1.z.string().nullable(),
    recordedBy: zod_1.z.string().nullable(),
    reversedAt: IsoMoment.nullable(),
    reverseReason: zod_1.z.string().nullable(),
    failureReason: zod_1.z.string().nullable(),
    expiresAt: IsoMoment.nullable(),
    allocations: zod_1.z.array(exports.PaymentAllocationView),
    payout: exports.PaymentPayoutView.nullable(),
    createdAt: IsoMoment,
});
exports.LeasePaymentList = zod_1.z.object({ payments: zod_1.z.array(exports.LeasePaymentView) });
exports.LeaseChargeList = zod_1.z.object({ charges: zod_1.z.array(exports.LeaseChargeView) });
/** Where a month's rent stands on one lease. */
exports.RentRollStatus = zod_1.z.enum(["not_raised", "open", "partly_paid", "overdue", "paid", "waived"]);
exports.RENT_ROLL_STATUS_LABEL = {
    not_raised: "Not raised yet",
    open: "Due",
    partly_paid: "Partly paid",
    overdue: "Overdue",
    paid: "Paid",
    waived: "Waived",
};
/** One lease on the rent roll of a month. */
exports.RentRollRow = zod_1.z.object({
    lease: zod_1.z.object({ id: primitives_1.Uuid, reference: zod_1.z.string(), status: vocab_1.LeaseStatus, graceDays: zod_1.z.number().int(), monthlyRentRwf: zod_1.z.number().int() }),
    tenant: zod_1.z.object({ id: primitives_1.Uuid, fullName: zod_1.z.string(), email: zod_1.z.string().nullable(), phone: zod_1.z.string().nullable() }),
    unit: zod_1.z.object({ id: primitives_1.Uuid, label: zod_1.z.string(), blockCode: zod_1.z.string().nullable(), propertyName: zod_1.z.string() }),
    /** The month's rent charge, once raised. */
    charge: exports.LeaseChargeView.nullable(),
    /** What the month will charge when it is raised, or what it charged. */
    expectedRwf: zod_1.z.number().int(),
    paidRwf: zod_1.z.number().int(),
    outstandingRwf: zod_1.z.number().int(),
    rollStatus: exports.RentRollStatus,
    daysOverdue: zod_1.z.number().int(),
    lastPayment: zod_1.z.object({ id: primitives_1.Uuid, amountRwf: zod_1.z.number().int(), paidOn: dates_1.CalendarDay, channel: vocab_1.LeasePaymentChannel }).nullable(),
    lastReminder: zod_1.z.object({ kind: vocab_1.LeaseReminderKind, sentAt: IsoMoment }).nullable(),
});
/** `GET /ops/rent/roll?month`: every live lease, with where the month's rent stands. */
exports.RentRoll = zod_1.z.object({
    month: overview_1.MonthKey,
    today: dates_1.CalendarDay,
    rows: zod_1.z.array(exports.RentRollRow),
    totals: zod_1.z.object({
        leases: zod_1.z.number().int(),
        expectedRwf: zod_1.z.number().int(),
        collectedRwf: zod_1.z.number().int(),
        outstandingRwf: zod_1.z.number().int(),
        overdueRwf: zod_1.z.number().int(),
        overdueLeases: zod_1.z.number().int(),
    }),
});
/** `GET /ops/rent/summary?month`: the month's figures the Rent screen and the home read. */
exports.RentSummary = zod_1.z.object({
    month: overview_1.MonthKey,
    today: dates_1.CalendarDay,
    /** Rent charges due in the month, not waived. */
    expectedRwf: zod_1.z.number().int(),
    /** Rent paid in the month: allocations of payments that arrived in it. */
    collectedRwf: zod_1.z.number().int(),
    /** What the month's rent charges still owe. */
    outstandingRwf: zod_1.z.number().int(),
    /** Open rent (any month) past its due day plus the grace days today. */
    overdueRwf: zod_1.z.number().int(),
    overdueCharges: zod_1.z.number().int(),
    /** Deposits paid in the month. */
    depositsCollectedRwf: zod_1.z.number().int(),
    /** Gateway payments waiting on a phone right now. */
    pendingRwf: zod_1.z.number().int(),
    /** Payouts settled in the month, and those still held for want of an account. */
    paidOutRwf: zod_1.z.number().int(),
    heldRwf: zod_1.z.number().int(),
    /** Tenants' credit: paid and not yet applied to a charge. */
    creditHeldRwf: zod_1.z.number().int(),
});
/** One reminder, as sent. */
exports.LeaseReminderView = zod_1.z.object({
    id: primitives_1.Uuid,
    leaseId: primitives_1.Uuid,
    leaseReference: zod_1.z.string(),
    tenantName: zod_1.z.string(),
    chargeId: primitives_1.Uuid.nullable(),
    chargeLabel: zod_1.z.string().nullable(),
    kind: vocab_1.LeaseReminderKind,
    stage: zod_1.z.number().int(),
    channel: vocab_1.LeaseReminderChannel,
    note: zod_1.z.string(),
    sentBy: zod_1.z.string().nullable(),
    sentAt: IsoMoment,
});
exports.LeaseReminderList = zod_1.z.object({ reminders: zod_1.z.array(exports.LeaseReminderView) });
/** What `POST /ops/rent/reminders` did with each charge. */
exports.RemindersSent = zod_1.z.object({
    sent: zod_1.z.array(zod_1.z.object({ chargeId: primitives_1.Uuid, reminderId: primitives_1.Uuid, emailedTo: zod_1.z.string().nullable() })),
    skipped: zod_1.z.array(zod_1.z.object({ chargeId: primitives_1.Uuid, reason: zod_1.z.string() })),
});
/** One payout to the landlord. */
exports.PayoutView = zod_1.z.object({
    id: primitives_1.Uuid,
    status: exports.PayoutStatus,
    statusLabel: zod_1.z.string(),
    amountRwf: zod_1.z.number().int(),
    /** "MTN MoMo 078•••••456"; null while held with no account. */
    destination: zod_1.z.string().nullable(),
    accountKind: vocab_1.PayoutAccountKind.nullable(),
    payeeName: zod_1.z.string().nullable(),
    payment: zod_1.z.object({ id: primitives_1.Uuid, leaseId: primitives_1.Uuid, leaseReference: zod_1.z.string(), tenantName: zod_1.z.string(), receiptNumber: zod_1.z.string().nullable() }).nullable(),
    /**
     * A host's payout for a stay (0116): the booking it pays, by reference.
     * Null on rent. Default null, so an older API's body still parses.
     */
    bookingReference: zod_1.z.string().nullable().default(null),
    failureReason: zod_1.z.string().nullable(),
    createdAt: IsoMoment,
    settledAt: IsoMoment.nullable(),
});
exports.PayoutList = zod_1.z.object({
    payouts: zod_1.z.array(exports.PayoutView),
    totals: zod_1.z.object({
        queuedRwf: zod_1.z.number().int(),
        heldRwf: zod_1.z.number().int(),
        paidRwf: zod_1.z.number().int(),
        failedRwf: zod_1.z.number().int(),
    }),
});
/** `GET /me/tenancies/:leaseId/charges`: what the tenant owes. */
exports.TenantChargeList = zod_1.z.object({
    charges: zod_1.z.array(exports.LeaseChargeView),
    outstandingRwf: zod_1.z.number().int(),
    overdueRwf: zod_1.z.number().int(),
    /** Paid ahead and not yet used on a charge. */
    creditRwf: zod_1.z.number().int(),
    /** A gateway payment still waiting on the phone, if any. */
    pendingPaymentId: primitives_1.Uuid.nullable(),
    /** The most the tenant may pay now (everything owed plus one month as credit); 0 when nothing is owed. */
    maxPaymentRwf: zod_1.z.number().int(),
});
/** One payment as the tenant sees it; `POST .../payments` and the poll answer this. */
exports.TenantPaymentView = zod_1.z.object({
    id: primitives_1.Uuid,
    leaseId: primitives_1.Uuid,
    channel: vocab_1.LeasePaymentChannel,
    method: vocab_1.LeasePaymentMethod,
    amountRwf: zod_1.z.number().int(),
    status: vocab_1.LeasePaymentStatus,
    statusWords: zod_1.z.string(),
    payerMasked: zod_1.z.string().nullable(),
    reference: zod_1.z.string().nullable(),
    receiptNumber: zod_1.z.string().nullable(),
    /** A receipt PDF can be downloaded. */
    receiptReady: zod_1.z.boolean(),
    failureReason: zod_1.z.string().nullable(),
    allocations: zod_1.z.array(exports.PaymentAllocationView),
    creditRwf: zod_1.z.number().int(),
    paidOn: dates_1.CalendarDay.nullable(),
    expiresAt: IsoMoment.nullable(),
    succeededAt: IsoMoment.nullable(),
    createdAt: IsoMoment,
});
exports.TenantPaymentList = zod_1.z.object({ payments: zod_1.z.array(exports.TenantPaymentView) });
/** The month `today` falls in, for the queries that default to it. */
function currentMonthKey(today = (0, dates_1.kigaliToday)()) {
    return today.slice(0, 7);
}
//# sourceMappingURL=rent.js.map