import { z } from "zod";
/** The largest amount any rentals figure may hold: ten billion francs. */
export declare const RWF_MAX = 10000000000;
/** Whole Rwandan francs, 0 to ten billion. */
export declare const Rwf: z.ZodNumber;
export type Rwf = z.infer<typeof Rwf>;
/** Whole Rwandan francs above zero: every amount that moves money. */
export declare const PositiveRwf: z.ZodNumber;
export type PositiveRwf = z.infer<typeof PositiveRwf>;
/** Is `v` a whole number of francs from 0 to `RWF_MAX`? */
export declare function isRwf(v: unknown): v is number;
/** The sum of whole-franc amounts. */
export declare function sumRwf(values: readonly number[]): number;
/**
 * `part / whole` of `amount`, rounded to the nearest franc (halves up).
 * The one rounding rule for prorated rent.
 */
export declare function prorateRwf(amount: number, part: number, whole: number): number;
/** `400000` as `400,000`, the same on every runtime (no locale tables). */
export declare function groupThousands(n: number): string;
/** `400000` as `RWF 400,000`. */
export declare function formatRwf(n: number): string;
/**
 * Where a lease stands. `signed` means both sides have signed and the tenancy
 * has not started yet. `ended` and `cancelled` are final. The moves between
 * them are `LEASE_TRANSITIONS` in `lease.ts`.
 */
export declare const LeaseStatus: z.ZodEnum<["draft", "pending_signature", "signed", "active", "ending", "ended", "cancelled"]>;
export type LeaseStatus = z.infer<typeof LeaseStatus>;
export declare const LEASE_STATUS_LABEL: Readonly<Record<LeaseStatus, string>>;
/** The two sides of a lease: who signs, who files a notice. */
export declare const LeaseSignerRole: z.ZodEnum<["landlord", "tenant"]>;
export type LeaseSignerRole = z.infer<typeof LeaseSignerRole>;
/**
 * How a signer proved it was them. `legacy` marks a signature carried over
 * from before e-signatures were recorded (a backfill), never a new one.
 */
export declare const LeaseSigningMethod: z.ZodEnum<["email_code", "password", "legacy"]>;
export type LeaseSigningMethod = z.infer<typeof LeaseSigningMethod>;
/** Who did something on a lease's timeline. */
export declare const LeaseActorRole: z.ZodEnum<["landlord", "tenant", "system", "broker"]>;
export type LeaseActorRole = z.infer<typeof LeaseActorRole>;
/** What happened on a lease: the rows of `lease_events`, its timeline. */
export declare const LeaseEventKind: z.ZodEnum<["created", "terms_edited", "tenant_updated", "landlord_signed", "landlord_signature_voided", "invitation_sent", "invitation_resent", "invitation_accepted", "tenant_signed", "signed_copy_ready", "started", "cancelled", "charge_raised", "charge_waived", "payment_received", "payment_recorded", "payment_failed", "payment_reversed", "reminder_sent", "deposit_received", "deposit_settled", "deposit_disputed", "notice_filed", "notice_acknowledged", "notice_withdrawn", "ending", "moved_out", "filing_due", "filed", "renewed", "broker_rated"]>;
export type LeaseEventKind = z.infer<typeof LeaseEventKind>;
/** Where the invitation to the tenant stands. One `sent` invitation per lease. */
export declare const LeaseInvitationStatus: z.ZodEnum<["sent", "accepted", "expired", "revoked"]>;
export type LeaseInvitationStatus = z.infer<typeof LeaseInvitationStatus>;
/** What a charge is for: a month's rent, or the deposit. */
export declare const LeaseChargeKind: z.ZodEnum<["rent", "deposit"]>;
export type LeaseChargeKind = z.infer<typeof LeaseChargeKind>;
/** Where a charge stands. Overdue is worked out (`isChargeOverdue`), never stored. */
export declare const LeaseChargeStatus: z.ZodEnum<["open", "paid", "waived"]>;
export type LeaseChargeStatus = z.infer<typeof LeaseChargeStatus>;
export declare const LEASE_CHARGE_STATUS_LABEL: Readonly<Record<LeaseChargeStatus, string>>;
/** How a payment reached the landlord: through Injishi's gateway, or recorded by the landlord. */
export declare const LeasePaymentChannel: z.ZodEnum<["gateway", "recorded"]>;
export type LeasePaymentChannel = z.infer<typeof LeasePaymentChannel>;
export declare const LEASE_PAYMENT_CHANNEL_LABEL: Readonly<Record<LeasePaymentChannel, string>>;
export declare const LeasePaymentMethod: z.ZodEnum<["mtn_momo", "airtel_money", "card", "bank_transfer", "cash", "other"]>;
export type LeasePaymentMethod = z.infer<typeof LeasePaymentMethod>;
export declare const LEASE_PAYMENT_METHOD_LABEL: Readonly<Record<LeasePaymentMethod, string>>;
/** The methods a gateway payment can use. A recorded payment may use any. */
export declare const GATEWAY_PAYMENT_METHODS: readonly LeasePaymentMethod[];
/** Whether `method` can be paid through the gateway. */
export declare function isGatewayMethod(method: LeasePaymentMethod): boolean;
/** Where a payment stands. Only `succeeded` counts as money received. */
export declare const LeasePaymentStatus: z.ZodEnum<["pending", "succeeded", "failed", "expired", "reversed"]>;
export type LeasePaymentStatus = z.infer<typeof LeasePaymentStatus>;
export declare const LEASE_PAYMENT_STATUS_LABEL: Readonly<Record<LeasePaymentStatus, string>>;
/** Where the deposit stands: not paid yet, held by the landlord, or settled at move out. */
export declare const LeaseDepositStatus: z.ZodEnum<["awaiting", "held", "settled"]>;
export type LeaseDepositStatus = z.infer<typeof LeaseDepositStatus>;
export declare const LEASE_DEPOSIT_STATUS_LABEL: Readonly<Record<LeaseDepositStatus, string>>;
/** How a deposit refund went back to the tenant. `none` when nothing was refunded. */
export declare const DepositRefundMethod: z.ZodEnum<["gateway", "recorded", "none"]>;
export type DepositRefundMethod = z.infer<typeof DepositRefundMethod>;
/** Why a reminder went out. The automatic kinds are sent at most once per charge. */
export declare const LeaseReminderKind: z.ZodEnum<["upcoming", "due", "overdue", "manual"]>;
export type LeaseReminderKind = z.infer<typeof LeaseReminderKind>;
/** How a reminder reached the tenant. `call` and `letter` are recorded by the landlord. */
export declare const LeaseReminderChannel: z.ZodEnum<["in_app", "email", "in_app_email", "sms", "call", "letter"]>;
export type LeaseReminderChannel = z.infer<typeof LeaseReminderChannel>;
/** Where a move out notice stands. One live (not withdrawn) notice per lease. */
export declare const MoveOutNoticeStatus: z.ZodEnum<["submitted", "acknowledged", "withdrawn"]>;
export type MoveOutNoticeStatus = z.infer<typeof MoveOutNoticeStatus>;
export declare const MOVE_OUT_NOTICE_STATUS_LABEL: Readonly<Record<MoveOutNoticeStatus, string>>;
/** How a notice reached the other side. A notice filed on Injishi counts as written notice. */
export declare const MoveOutNoticeChannel: z.ZodEnum<["app", "letter", "email", "in_person"]>;
export type MoveOutNoticeChannel = z.infer<typeof MoveOutNoticeChannel>;
/** Why the lease is ending early. The first five are the tenant's; the next two the landlord's. */
export declare const MoveOutReasonCode: z.ZodEnum<["moving_in_kigali", "leaving_kigali", "own_home", "cost", "terms", "landlord_use", "tenant_breach", "other"]>;
export type MoveOutReasonCode = z.infer<typeof MoveOutReasonCode>;
export declare const MOVE_OUT_REASON_LABEL: Readonly<Record<MoveOutReasonCode, string>>;
/** What a filing with the tax administration is about. */
export declare const LeaseFilingKind: z.ZodEnum<["new_lease", "change", "termination"]>;
export type LeaseFilingKind = z.infer<typeof LeaseFilingKind>;
/** Whether a unit can be let. Occupied or vacant is worked out from leases, never stored. */
export declare const RentalUnitState: z.ZodEnum<["active", "off_market", "retired"]>;
export type RentalUnitState = z.infer<typeof RentalUnitState>;
export declare const RENTAL_UNIT_STATE_LABEL: Readonly<Record<RentalUnitState, string>>;
/** The kitchen a unit has. */
export declare const UnitKitchen: z.ZodEnum<["own", "shared", "none"]>;
export type UnitKitchen = z.infer<typeof UnitKitchen>;
/** The document a person's number comes from: a Rwandan national ID or a passport. */
export declare const IdKind: z.ZodEnum<["national_id", "passport"]>;
export type IdKind = z.infer<typeof IdKind>;
export declare const ID_KIND_LABEL: Readonly<Record<IdKind, string>>;
/** `individual`: rental income tax. `company`: corporate income tax on profit. */
export declare const TaxpayerKind: z.ZodEnum<["individual", "company"]>;
export type TaxpayerKind = z.infer<typeof TaxpayerKind>;
export declare const TAXPAYER_KIND_LABEL: Readonly<Record<TaxpayerKind, string>>;
/** What a bank loan was for. Only interest on a loan to build or buy the rented property is deducted. */
export declare const LoanPurpose: z.ZodEnum<["build", "buy"]>;
export type LoanPurpose = z.infer<typeof LoanPurpose>;
/** Where a landlord's rent is paid out: a bank account, a MoMo number, or a MoMo Pay merchant code. */
export declare const PayoutAccountKind: z.ZodEnum<["bank", "momo", "momo_pay"]>;
export type PayoutAccountKind = z.infer<typeof PayoutAccountKind>;
export declare const PAYOUT_ACCOUNT_KIND_LABEL: Readonly<Record<PayoutAccountKind, string>>;
export declare const PayoutAccountStatus: z.ZodEnum<["active", "retired"]>;
export type PayoutAccountStatus = z.infer<typeof PayoutAccountStatus>;
/** The mobile money networks a payout can go to. */
export declare const MomoNetwork: z.ZodEnum<["mtn", "airtel"]>;
export type MomoNetwork = z.infer<typeof MomoNetwork>;
export declare const MOMO_NETWORK_LABEL: Readonly<Record<MomoNetwork, string>>;
//# sourceMappingURL=vocab.d.ts.map