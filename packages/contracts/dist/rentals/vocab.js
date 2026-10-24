"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOMO_NETWORK_LABEL = exports.MomoNetwork = exports.PayoutAccountStatus = exports.PAYOUT_ACCOUNT_KIND_LABEL = exports.PayoutAccountKind = exports.LoanPurpose = exports.TAXPAYER_KIND_LABEL = exports.TaxpayerKind = exports.ID_KIND_LABEL = exports.IdKind = exports.UnitKitchen = exports.RENTAL_UNIT_STATE_LABEL = exports.RentalUnitState = exports.LEASE_FILING_STATUS_LABEL = exports.LeaseFilingStatus = exports.LEASE_FILING_KIND_LABEL = exports.LeaseFilingKind = exports.MOVE_OUT_REASON_LABEL = exports.MoveOutReasonCode = exports.MoveOutNoticeChannel = exports.MOVE_OUT_NOTICE_STATUS_LABEL = exports.MoveOutNoticeStatus = exports.LeaseReminderChannel = exports.LeaseReminderKind = exports.DepositRefundMethod = exports.LEASE_DEPOSIT_STATUS_LABEL = exports.LeaseDepositStatus = exports.LEASE_PAYMENT_STATUS_LABEL = exports.LeasePaymentStatus = exports.GATEWAY_PAYMENT_METHODS = exports.LEASE_PAYMENT_METHOD_LABEL = exports.LeasePaymentMethod = exports.LEASE_PAYMENT_CHANNEL_LABEL = exports.LeasePaymentChannel = exports.LEASE_CHARGE_STATUS_LABEL = exports.LeaseChargeStatus = exports.LeaseChargeKind = exports.LeaseInvitationStatus = exports.LeaseEventKind = exports.LeaseActorRole = exports.LeaseSigningMethod = exports.LeaseSignerRole = exports.LEASE_STATUS_LABEL = exports.LeaseStatus = exports.PositiveRwf = exports.Rwf = exports.RWF_MAX = void 0;
exports.isRwf = isRwf;
exports.sumRwf = sumRwf;
exports.prorateRwf = prorateRwf;
exports.groupThousands = groupThousands;
exports.formatRwf = formatRwf;
exports.isGatewayMethod = isGatewayMethod;
const zod_1 = require("zod");
// ===========================================================================
// Rentals vocabulary: the one source of every rentals status and kind
// ===========================================================================
//
// Each list here is a zod enum, and the database enum is built from it
// (`pgEnum('lease_status', LeaseStatus.options)`), so the API, both apps and
// the schema can never disagree about what a lease or a payment can be. Add a
// value HERE first; a migration then adds it to the database type (swap the
// type when the same migration run needs the new value, see the blueprint).
//
// Money is whole Rwandan francs. Calendar facts are `yyyy-mm-dd` days in
// Kigali (see `dates.ts`).
// --- Money -------------------------------------------------------------------
/** The largest amount any rentals figure may hold: ten billion francs. */
exports.RWF_MAX = 10000000000;
/** Whole Rwandan francs, 0 to ten billion. */
exports.Rwf = zod_1.z
    .number({ invalid_type_error: "Enter an amount in francs.", required_error: "Enter an amount in francs." })
    .int("Whole francs only.")
    .min(0, "The amount can't be negative.")
    .max(exports.RWF_MAX, "That amount is too large.");
/** Whole Rwandan francs above zero: every amount that moves money. */
exports.PositiveRwf = zod_1.z
    .number({ invalid_type_error: "Enter an amount in francs.", required_error: "Enter an amount in francs." })
    .int("Whole francs only.")
    .min(1, "Enter an amount above 0.")
    .max(exports.RWF_MAX, "That amount is too large.");
/** Is `v` a whole number of francs from 0 to `RWF_MAX`? */
function isRwf(v) {
    return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= exports.RWF_MAX;
}
/** The sum of whole-franc amounts. */
function sumRwf(values) {
    return values.reduce((s, v) => s + v, 0);
}
/**
 * `part / whole` of `amount`, rounded to the nearest franc (halves up).
 * The one rounding rule for prorated rent.
 */
function prorateRwf(amount, part, whole) {
    if (whole <= 0)
        throw new RangeError("prorateRwf: whole must be above 0");
    return Math.round((amount * part) / whole);
}
/** `400000` as `400,000`, the same on every runtime (no locale tables). */
function groupThousands(n) {
    const sign = n < 0 ? "-" : "";
    const digits = String(Math.trunc(Math.abs(n)));
    return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
/** `400000` as `RWF 400,000`. */
function formatRwf(n) {
    return `RWF ${groupThousands(n)}`;
}
// --- Leases -------------------------------------------------------------------
/**
 * Where a lease stands. `signed` means both sides have signed and the tenancy
 * has not started yet. `ended` and `cancelled` are final. The moves between
 * them are `LEASE_TRANSITIONS` in `lease.ts`.
 */
exports.LeaseStatus = zod_1.z.enum(["draft", "pending_signature", "signed", "active", "ending", "ended", "cancelled"]);
exports.LEASE_STATUS_LABEL = {
    draft: "Draft",
    pending_signature: "Waiting for tenant",
    signed: "Signed",
    active: "Active",
    ending: "Ending",
    ended: "Ended",
    cancelled: "Cancelled",
};
/** The two sides of a lease: who signs, who files a notice. */
exports.LeaseSignerRole = zod_1.z.enum(["landlord", "tenant"]);
/**
 * How a signer proved it was them. `legacy` marks a signature carried over
 * from before e-signatures were recorded (a backfill), never a new one.
 */
exports.LeaseSigningMethod = zod_1.z.enum(["email_code", "password", "legacy"]);
/** Who did something on a lease's timeline. */
exports.LeaseActorRole = zod_1.z.enum(["landlord", "tenant", "system", "broker"]);
/** What happened on a lease: the rows of `lease_events`, its timeline. */
exports.LeaseEventKind = zod_1.z.enum([
    "created",
    "terms_edited",
    "tenant_updated",
    "landlord_signed",
    "landlord_signature_voided",
    "invitation_sent",
    "invitation_resent",
    "invitation_accepted",
    "tenant_signed",
    "signed_copy_ready",
    "started",
    "cancelled",
    "charge_raised",
    "charge_waived",
    "payment_received",
    "payment_recorded",
    "payment_failed",
    "payment_reversed",
    "reminder_sent",
    "deposit_received",
    "deposit_settled",
    "deposit_disputed",
    "notice_filed",
    "notice_acknowledged",
    "notice_withdrawn",
    "ending",
    "moved_out",
    "filing_due",
    "filed",
    "renewed",
    "broker_rated",
]);
/** Where the invitation to the tenant stands. One `sent` invitation per lease. */
exports.LeaseInvitationStatus = zod_1.z.enum(["sent", "accepted", "expired", "revoked"]);
// --- Charges, payments, deposits ----------------------------------------------
/** What a charge is for: a month's rent, or the deposit. */
exports.LeaseChargeKind = zod_1.z.enum(["rent", "deposit"]);
/** Where a charge stands. Overdue is worked out (`isChargeOverdue`), never stored. */
exports.LeaseChargeStatus = zod_1.z.enum(["open", "paid", "waived"]);
exports.LEASE_CHARGE_STATUS_LABEL = {
    open: "Open",
    paid: "Paid",
    waived: "Waived",
};
/** How a payment reached the landlord: through Injishi's gateway, or recorded by the landlord. */
exports.LeasePaymentChannel = zod_1.z.enum(["gateway", "recorded"]);
exports.LEASE_PAYMENT_CHANNEL_LABEL = {
    gateway: "Paid on Injishi",
    recorded: "Recorded",
};
exports.LeasePaymentMethod = zod_1.z.enum(["mtn_momo", "airtel_money", "card", "bank_transfer", "cash", "other"]);
exports.LEASE_PAYMENT_METHOD_LABEL = {
    mtn_momo: "MTN MoMo",
    airtel_money: "Airtel Money",
    card: "Card",
    bank_transfer: "Bank transfer",
    cash: "Cash",
    other: "Other",
};
/** The methods a gateway payment can use. A recorded payment may use any. */
exports.GATEWAY_PAYMENT_METHODS = ["mtn_momo", "airtel_money", "card"];
/** Whether `method` can be paid through the gateway. */
function isGatewayMethod(method) {
    return exports.GATEWAY_PAYMENT_METHODS.includes(method);
}
/** Where a payment stands. Only `succeeded` counts as money received. */
exports.LeasePaymentStatus = zod_1.z.enum(["pending", "succeeded", "failed", "expired", "reversed"]);
exports.LEASE_PAYMENT_STATUS_LABEL = {
    pending: "Waiting",
    succeeded: "Received",
    failed: "Failed",
    expired: "Expired",
    reversed: "Reversed",
};
/** Where the deposit stands: not paid yet, held by the landlord, or settled at move out. */
exports.LeaseDepositStatus = zod_1.z.enum(["awaiting", "held", "settled"]);
exports.LEASE_DEPOSIT_STATUS_LABEL = {
    awaiting: "Not paid yet",
    held: "Held",
    settled: "Settled",
};
/** How a deposit refund went back to the tenant. `none` when nothing was refunded. */
exports.DepositRefundMethod = zod_1.z.enum(["gateway", "recorded", "none"]);
/** Why a reminder went out. The automatic kinds are sent at most once per charge. */
exports.LeaseReminderKind = zod_1.z.enum(["upcoming", "due", "overdue", "manual"]);
/** How a reminder reached the tenant. `call` and `letter` are recorded by the landlord. */
exports.LeaseReminderChannel = zod_1.z.enum(["in_app", "email", "in_app_email", "sms", "call", "letter"]);
// --- Notices and filings --------------------------------------------------------
/** Where a move out notice stands. One live (not withdrawn) notice per lease. */
exports.MoveOutNoticeStatus = zod_1.z.enum(["submitted", "acknowledged", "withdrawn"]);
exports.MOVE_OUT_NOTICE_STATUS_LABEL = {
    submitted: "To acknowledge",
    acknowledged: "Acknowledged",
    withdrawn: "Withdrawn",
};
/** How a notice reached the other side. A notice filed on Injishi counts as written notice. */
exports.MoveOutNoticeChannel = zod_1.z.enum(["app", "letter", "email", "in_person"]);
/** Why the lease is ending early. The first five are the tenant's; the next two the landlord's. */
exports.MoveOutReasonCode = zod_1.z.enum([
    "moving_in_kigali",
    "leaving_kigali",
    "own_home",
    "cost",
    "terms",
    "landlord_use",
    "tenant_breach",
    "other",
]);
exports.MOVE_OUT_REASON_LABEL = {
    moving_in_kigali: "Moving elsewhere in Kigali",
    leaving_kigali: "Leaving Kigali",
    own_home: "Moving into my own home",
    cost: "The rent is too high",
    terms: "Unhappy with the terms",
    landlord_use: "The landlord needs the home",
    tenant_breach: "The tenant broke the lease",
    other: "Something else",
};
/** What a filing with the tax administration is about. */
exports.LeaseFilingKind = zod_1.z.enum(["new_lease", "change", "termination"]);
exports.LEASE_FILING_KIND_LABEL = {
    new_lease: "New lease",
    change: "Change to a lease",
    termination: "Lease ended early",
};
/**
 * Where a filing stands: `pending` is due (by `due_on`), `filed` once the
 * landlord records the reference. Late is worked out (pending past its due
 * day), never stored. The database type keeps its old name, `filing_status`.
 */
exports.LeaseFilingStatus = zod_1.z.enum(["pending", "filed"]);
exports.LEASE_FILING_STATUS_LABEL = {
    pending: "Due",
    filed: "Filed",
};
// --- Units -----------------------------------------------------------------------
/** Whether a unit can be let. Occupied or vacant is worked out from leases, never stored. */
exports.RentalUnitState = zod_1.z.enum(["active", "off_market", "retired"]);
exports.RENTAL_UNIT_STATE_LABEL = {
    active: "Available to let",
    off_market: "Off market",
    retired: "Retired",
};
/** The kitchen a unit has. */
exports.UnitKitchen = zod_1.z.enum(["own", "shared", "none"]);
// --- People ------------------------------------------------------------------------
/** The document a person's number comes from: a Rwandan national ID or a passport. */
exports.IdKind = zod_1.z.enum(["national_id", "passport"]);
exports.ID_KIND_LABEL = {
    national_id: "National ID",
    passport: "Passport",
};
// --- Getting paid and taxes ------------------------------------------------------
/** `individual`: rental income tax. `company`: corporate income tax on profit. */
exports.TaxpayerKind = zod_1.z.enum(["individual", "company"]);
exports.TAXPAYER_KIND_LABEL = {
    individual: "A person",
    company: "A company",
};
/** What a bank loan was for. Only interest on a loan to build or buy the rented property is deducted. */
exports.LoanPurpose = zod_1.z.enum(["build", "buy"]);
/** Where a landlord's rent is paid out: a bank account, a MoMo number, or a MoMo Pay merchant code. */
exports.PayoutAccountKind = zod_1.z.enum(["bank", "momo", "momo_pay"]);
exports.PAYOUT_ACCOUNT_KIND_LABEL = {
    bank: "Bank account",
    momo: "MoMo number",
    momo_pay: "MoMo Pay code",
};
exports.PayoutAccountStatus = zod_1.z.enum(["active", "retired"]);
/** The mobile money networks a payout can go to. */
exports.MomoNetwork = zod_1.z.enum(["mtn", "airtel"]);
exports.MOMO_NETWORK_LABEL = {
    mtn: "MTN MoMo",
    airtel: "Airtel Money",
};
//# sourceMappingURL=vocab.js.map