import { z } from "zod";

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
export const RWF_MAX = 10_000_000_000;

/** Whole Rwandan francs, 0 to ten billion. */
export const Rwf = z
  .number({ invalid_type_error: "Enter an amount in francs.", required_error: "Enter an amount in francs." })
  .int("Whole francs only.")
  .min(0, "The amount can't be negative.")
  .max(RWF_MAX, "That amount is too large.");
export type Rwf = z.infer<typeof Rwf>;

/** Whole Rwandan francs above zero: every amount that moves money. */
export const PositiveRwf = z
  .number({ invalid_type_error: "Enter an amount in francs.", required_error: "Enter an amount in francs." })
  .int("Whole francs only.")
  .min(1, "Enter an amount above 0.")
  .max(RWF_MAX, "That amount is too large.");
export type PositiveRwf = z.infer<typeof PositiveRwf>;

/** Is `v` a whole number of francs from 0 to `RWF_MAX`? */
export function isRwf(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= RWF_MAX;
}

/** The sum of whole-franc amounts. */
export function sumRwf(values: readonly number[]): number {
  return values.reduce((s, v) => s + v, 0);
}

/**
 * `part / whole` of `amount`, rounded to the nearest franc (halves up).
 * The one rounding rule for prorated rent.
 */
export function prorateRwf(amount: number, part: number, whole: number): number {
  if (whole <= 0) throw new RangeError("prorateRwf: whole must be above 0");
  return Math.round((amount * part) / whole);
}

/** `400000` as `400,000`, the same on every runtime (no locale tables). */
export function groupThousands(n: number): string {
  const sign = n < 0 ? "-" : "";
  const digits = String(Math.trunc(Math.abs(n)));
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** `400000` as `RWF 400,000`. */
export function formatRwf(n: number): string {
  return `RWF ${groupThousands(n)}`;
}

// --- Leases -------------------------------------------------------------------

/**
 * Where a lease stands. `signed` means both sides have signed and the tenancy
 * has not started yet. `ended` and `cancelled` are final. The moves between
 * them are `LEASE_TRANSITIONS` in `lease.ts`.
 */
export const LeaseStatus = z.enum(["draft", "pending_signature", "signed", "active", "ending", "ended", "cancelled"]);
export type LeaseStatus = z.infer<typeof LeaseStatus>;
export const LEASE_STATUS_LABEL: Readonly<Record<LeaseStatus, string>> = {
  draft: "Draft",
  pending_signature: "Waiting for tenant",
  signed: "Signed",
  active: "Active",
  ending: "Ending",
  ended: "Ended",
  cancelled: "Cancelled",
};

/** The two sides of a lease: who signs, who files a notice. */
export const LeaseSignerRole = z.enum(["landlord", "tenant"]);
export type LeaseSignerRole = z.infer<typeof LeaseSignerRole>;

/**
 * How a signer proved it was them. `legacy` marks a signature carried over
 * from before e-signatures were recorded (a backfill), never a new one.
 */
export const LeaseSigningMethod = z.enum(["email_code", "password", "legacy"]);
export type LeaseSigningMethod = z.infer<typeof LeaseSigningMethod>;

/** Who did something on a lease's timeline. */
export const LeaseActorRole = z.enum(["landlord", "tenant", "system", "broker"]);
export type LeaseActorRole = z.infer<typeof LeaseActorRole>;

/** What happened on a lease: the rows of `lease_events`, its timeline. */
export const LeaseEventKind = z.enum([
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
export type LeaseEventKind = z.infer<typeof LeaseEventKind>;

/** Where the invitation to the tenant stands. One `sent` invitation per lease. */
export const LeaseInvitationStatus = z.enum(["sent", "accepted", "expired", "revoked"]);
export type LeaseInvitationStatus = z.infer<typeof LeaseInvitationStatus>;

// --- Charges, payments, deposits ----------------------------------------------

/** What a charge is for: a month's rent, or the deposit. */
export const LeaseChargeKind = z.enum(["rent", "deposit"]);
export type LeaseChargeKind = z.infer<typeof LeaseChargeKind>;

/** Where a charge stands. Overdue is worked out (`isChargeOverdue`), never stored. */
export const LeaseChargeStatus = z.enum(["open", "paid", "waived"]);
export type LeaseChargeStatus = z.infer<typeof LeaseChargeStatus>;
export const LEASE_CHARGE_STATUS_LABEL: Readonly<Record<LeaseChargeStatus, string>> = {
  open: "Open",
  paid: "Paid",
  waived: "Waived",
};

/** How a payment reached the landlord: through Injishi's gateway, or recorded by the landlord. */
export const LeasePaymentChannel = z.enum(["gateway", "recorded"]);
export type LeasePaymentChannel = z.infer<typeof LeasePaymentChannel>;
export const LEASE_PAYMENT_CHANNEL_LABEL: Readonly<Record<LeasePaymentChannel, string>> = {
  gateway: "Paid on Injishi",
  recorded: "Recorded",
};

export const LeasePaymentMethod = z.enum(["mtn_momo", "airtel_money", "card", "bank_transfer", "cash", "other"]);
export type LeasePaymentMethod = z.infer<typeof LeasePaymentMethod>;
export const LEASE_PAYMENT_METHOD_LABEL: Readonly<Record<LeasePaymentMethod, string>> = {
  mtn_momo: "MTN MoMo",
  airtel_money: "Airtel Money",
  card: "Card",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  other: "Other",
};

/** The methods a gateway payment can use. A recorded payment may use any. */
export const GATEWAY_PAYMENT_METHODS: readonly LeasePaymentMethod[] = ["mtn_momo", "airtel_money", "card"];

/** Whether `method` can be paid through the gateway. */
export function isGatewayMethod(method: LeasePaymentMethod): boolean {
  return GATEWAY_PAYMENT_METHODS.includes(method);
}

/** Where a payment stands. Only `succeeded` counts as money received. */
export const LeasePaymentStatus = z.enum(["pending", "succeeded", "failed", "expired", "reversed"]);
export type LeasePaymentStatus = z.infer<typeof LeasePaymentStatus>;
export const LEASE_PAYMENT_STATUS_LABEL: Readonly<Record<LeasePaymentStatus, string>> = {
  pending: "Waiting",
  succeeded: "Received",
  failed: "Failed",
  expired: "Expired",
  reversed: "Reversed",
};

/** Where the deposit stands: not paid yet, held by the landlord, or settled at move out. */
export const LeaseDepositStatus = z.enum(["awaiting", "held", "settled"]);
export type LeaseDepositStatus = z.infer<typeof LeaseDepositStatus>;
export const LEASE_DEPOSIT_STATUS_LABEL: Readonly<Record<LeaseDepositStatus, string>> = {
  awaiting: "Not paid yet",
  held: "Held",
  settled: "Settled",
};

/** How a deposit refund went back to the tenant. `none` when nothing was refunded. */
export const DepositRefundMethod = z.enum(["gateway", "recorded", "none"]);
export type DepositRefundMethod = z.infer<typeof DepositRefundMethod>;

/** Why a reminder went out. The automatic kinds are sent at most once per charge. */
export const LeaseReminderKind = z.enum(["upcoming", "due", "overdue", "manual"]);
export type LeaseReminderKind = z.infer<typeof LeaseReminderKind>;

/** How a reminder reached the tenant. `call` and `letter` are recorded by the landlord. */
export const LeaseReminderChannel = z.enum(["in_app", "email", "in_app_email", "sms", "call", "letter"]);
export type LeaseReminderChannel = z.infer<typeof LeaseReminderChannel>;

// --- Notices and filings --------------------------------------------------------

/** Where a move out notice stands. One live (not withdrawn) notice per lease. */
export const MoveOutNoticeStatus = z.enum(["submitted", "acknowledged", "withdrawn"]);
export type MoveOutNoticeStatus = z.infer<typeof MoveOutNoticeStatus>;
export const MOVE_OUT_NOTICE_STATUS_LABEL: Readonly<Record<MoveOutNoticeStatus, string>> = {
  submitted: "To acknowledge",
  acknowledged: "Acknowledged",
  withdrawn: "Withdrawn",
};

/** How a notice reached the other side. A notice filed on Injishi counts as written notice. */
export const MoveOutNoticeChannel = z.enum(["app", "letter", "email", "in_person"]);
export type MoveOutNoticeChannel = z.infer<typeof MoveOutNoticeChannel>;

/** Why the lease is ending early. The first five are the tenant's; the next two the landlord's. */
export const MoveOutReasonCode = z.enum([
  "moving_in_kigali",
  "leaving_kigali",
  "own_home",
  "cost",
  "terms",
  "landlord_use",
  "tenant_breach",
  "other",
]);
export type MoveOutReasonCode = z.infer<typeof MoveOutReasonCode>;
export const MOVE_OUT_REASON_LABEL: Readonly<Record<MoveOutReasonCode, string>> = {
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
export const LeaseFilingKind = z.enum(["new_lease", "change", "termination"]);
export type LeaseFilingKind = z.infer<typeof LeaseFilingKind>;
export const LEASE_FILING_KIND_LABEL: Readonly<Record<LeaseFilingKind, string>> = {
  new_lease: "New lease",
  change: "Change to a lease",
  termination: "Lease ended early",
};

/**
 * Where a filing stands: `pending` is due (by `due_on`), `filed` once the
 * landlord records the reference. Late is worked out (pending past its due
 * day), never stored. The database type keeps its old name, `filing_status`.
 */
export const LeaseFilingStatus = z.enum(["pending", "filed"]);
export type LeaseFilingStatus = z.infer<typeof LeaseFilingStatus>;
export const LEASE_FILING_STATUS_LABEL: Readonly<Record<LeaseFilingStatus, string>> = {
  pending: "Due",
  filed: "Filed",
};

// --- Units -----------------------------------------------------------------------

/** Whether a unit can be let. Occupied or vacant is worked out from leases, never stored. */
export const RentalUnitState = z.enum(["active", "off_market", "retired"]);
export type RentalUnitState = z.infer<typeof RentalUnitState>;
export const RENTAL_UNIT_STATE_LABEL: Readonly<Record<RentalUnitState, string>> = {
  active: "Available to let",
  off_market: "Off market",
  retired: "Retired",
};

/** The kitchen a unit has. */
export const UnitKitchen = z.enum(["own", "shared", "none"]);
export type UnitKitchen = z.infer<typeof UnitKitchen>;

// --- People ------------------------------------------------------------------------

/** The document a person's number comes from: a Rwandan national ID or a passport. */
export const IdKind = z.enum(["national_id", "passport"]);
export type IdKind = z.infer<typeof IdKind>;
export const ID_KIND_LABEL: Readonly<Record<IdKind, string>> = {
  national_id: "National ID",
  passport: "Passport",
};

// --- Getting paid and taxes ------------------------------------------------------

/** `individual`: rental income tax. `company`: corporate income tax on profit. */
export const TaxpayerKind = z.enum(["individual", "company"]);
export type TaxpayerKind = z.infer<typeof TaxpayerKind>;
export const TAXPAYER_KIND_LABEL: Readonly<Record<TaxpayerKind, string>> = {
  individual: "A person",
  company: "A company",
};

/** What a bank loan was for. Only interest on a loan to build or buy the rented property is deducted. */
export const LoanPurpose = z.enum(["build", "buy"]);
export type LoanPurpose = z.infer<typeof LoanPurpose>;

/** Where a landlord's rent is paid out: a bank account, a MoMo number, or a MoMo Pay merchant code. */
export const PayoutAccountKind = z.enum(["bank", "momo", "momo_pay"]);
export type PayoutAccountKind = z.infer<typeof PayoutAccountKind>;
export const PAYOUT_ACCOUNT_KIND_LABEL: Readonly<Record<PayoutAccountKind, string>> = {
  bank: "Bank account",
  momo: "MoMo number",
  momo_pay: "MoMo Pay code",
};

export const PayoutAccountStatus = z.enum(["active", "retired"]);
export type PayoutAccountStatus = z.infer<typeof PayoutAccountStatus>;

/** The mobile money networks a payout can go to. */
export const MomoNetwork = z.enum(["mtn", "airtel"]);
export type MomoNetwork = z.infer<typeof MomoNetwork>;
export const MOMO_NETWORK_LABEL: Readonly<Record<MomoNetwork, string>> = {
  mtn: "MTN MoMo",
  airtel: "Airtel Money",
};
