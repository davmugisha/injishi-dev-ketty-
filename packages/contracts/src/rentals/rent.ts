import { z } from "zod";
import { Uuid } from "../primitives";
import { CalendarDay, addDays, daysBetween, kigaliToday, longDate } from "./dates";
import { MomoNumber } from "./money";
import { MonthKey } from "./overview";
import {
  LeaseChargeKind,
  LeaseChargeStatus,
  LeasePaymentChannel,
  LeasePaymentMethod,
  LeasePaymentStatus,
  LeaseReminderChannel,
  LeaseReminderKind,
  LeaseStatus,
  PayoutAccountKind,
  PositiveRwf,
  formatRwf,
} from "./vocab";
import { overdueFrom } from "./schedule";

// ===========================================================================
// The rent cycle: reminders, payments (recorded and through the gateway),
// payouts, and what the rent screens read (blueprint 2.3 "Rent", 2.4, WP 1.6)
// ===========================================================================
//
// Money is whole francs; days are Kigali days; moments are ISO timestamps.
// The rules here are pure so the job, the API and the screens agree on when a
// reminder goes, what a payment status says, and how far a tenant may overpay.

const IsoMoment = z.string();

// --- Reminders -------------------------------------------------------------------

/** A tenant is told this many days before rent falls due. */
export const RENT_REMINDER_DAYS_BEFORE = 3;

/**
 * The overdue reminders: on the first overdue day, then 7 and 14 days after
 * it. Each is one `stage` of the `overdue` kind, sent at most once per charge.
 */
export const OVERDUE_REMINDER_DAYS: readonly number[] = [0, 7, 14];

/** The hours in Kigali between which automatic reminders go out (from 08:00, before 18:00). */
export const REMINDER_HOURS = { from: 8, to: 18 } as const;

/** A landlord may send one manual reminder per charge per Kigali day. */
export const MANUAL_REMINDERS_PER_DAY = 1;

/** The hour of the day in Kigali (0 to 23) an instant falls in. */
export function kigaliHour(now: Date = new Date()): number {
  return (now.getUTCHours() + 2) % 24;
}

/** May an automatic reminder go out now? Only during the day in Kigali. */
export function withinReminderHours(now: Date = new Date()): boolean {
  const hour = kigaliHour(now);
  return hour >= REMINDER_HOURS.from && hour < REMINDER_HOURS.to;
}

/** Which automatic reminder a charge is at. `stage` counts the overdue reminders from 0. */
export interface ReminderStage {
  kind: "upcoming" | "due" | "overdue";
  stage: number;
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
export function reminderStageFor(today: string, dueOn: string, graceDays: number): ReminderStage | null {
  const overdueStart = overdueFrom(dueOn, graceDays);
  if (today >= overdueStart) {
    const days = daysBetween(overdueStart, today);
    let stage = 0;
    OVERDUE_REMINDER_DAYS.forEach((offset, i) => {
      if (days >= offset) stage = i;
    });
    return { kind: "overdue", stage };
  }
  if (today === dueOn) return { kind: "due", stage: 0 };
  if (today > dueOn) return null;
  if (addDays(today, RENT_REMINDER_DAYS_BEFORE) >= dueOn) return { kind: "upcoming", stage: 0 };
  return null;
}

/** `Rent for November 2026`, `Deposit`: a charge in words. */
export function chargeWords(charge: { kind: LeaseChargeKind; periodStart?: string | null; dueOn: string }): string {
  if (charge.kind === "deposit") return "Deposit";
  const day = charge.periodStart ?? charge.dueOn;
  return `Rent for ${longDate(day).split(" ").slice(1).join(" ")}`;
}

/**
 * The one sentence a reminder says about a charge, by stage. Plain words, the
 * amount in francs, no dashes.
 */
export function reminderSentence(input: {
  stage: ReminderStage["kind"] | "manual";
  charge: { kind: LeaseChargeKind; periodStart?: string | null; dueOn: string };
  owedRwf: number;
  landlordName: string;
}): string {
  const what = chargeWords(input.charge);
  const amount = formatRwf(input.owedRwf);
  const due = longDate(input.charge.dueOn);
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
export const GATEWAY_PROMPT_MINUTES = 10;

/** The most charges one payment names. */
export const MAX_PAYMENT_CHARGE_IDS = 24;

/**
 * The most a tenant may pay through the gateway: everything owed, plus up to
 * one month's rent kept as credit for the next charge. Nothing when nothing
 * is owed: there is no next charge to hold credit for until one is raised.
 */
export function maxGatewayPaymentRwf(outstandingRwf: number, monthlyRentRwf: number): number {
  if (outstandingRwf <= 0) return 0;
  return outstandingRwf + monthlyRentRwf;
}

/** `+250788123456` as the nine national digits a mobile money rail takes: `788123456`. */
export function nationalMsisdn(e164: string): string {
  return e164.replace(/^\+250/, "");
}

/** Where a payment stands, in the tenant's words. */
export function paymentStatusWords(status: LeasePaymentStatus, opts: { channel?: LeasePaymentChannel; failureReason?: string | null } = {}): string {
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
export function receiptNumber(year: number, n: number): string {
  return `R-${year}-${String(n).padStart(4, "0")}`;
}

/** The number after the highest `R-<year>-<n>` in `taken`, for that year. */
export function nextReceiptNumber(year: number, taken: readonly string[]): string {
  let highest = 0;
  const re = new RegExp(`^R-${year}-(\\d+)$`);
  for (const ref of taken) {
    const m = re.exec(ref.trim());
    if (m) highest = Math.max(highest, Number(m[1]));
  }
  return receiptNumber(year, highest + 1);
}

// --- Requests ------------------------------------------------------------------------

const Reason = z
  .string({ required_error: "Say why." })
  .trim()
  .min(3, "Say why, in a few words.")
  .max(500, "Keep it under 500 characters.");

const ChargeIds = z
  .array(Uuid)
  .max(MAX_PAYMENT_CHARGE_IDS, `Pick at most ${MAX_PAYMENT_CHARGE_IDS} charges.`)
  .refine((ids) => new Set(ids).size === ids.length, "A charge is named twice.");

// Rent is paid only through the payment integration (2026-10-25): there is no
// request to record, reverse or slip a payment made outside Injishi. Payments
// recorded before (channel `recorded`) are still read and shown as "Recorded".

/** `POST /ops/rent/charges/:id/waive`: the landlord forgives an open charge. */
export const WaiveChargeRequest = z.object({ reason: Reason });
export type WaiveChargeRequest = z.infer<typeof WaiveChargeRequest>;

/** `POST /ops/rent/reminders`: remind the tenants of these open charges now, by email. */
export const RemindRentRequest = z.object({
  chargeIds: z
    .array(Uuid)
    .min(1, "Pick at least one charge.")
    .max(50, "Pick at most 50 charges at once.")
    .refine((ids) => new Set(ids).size === ids.length, "A charge is named twice."),
  /** A line of the landlord's own, added under the reminder. */
  note: z.string().trim().max(300, "Keep the note under 300 characters.").optional(),
});
export type RemindRentRequest = z.infer<typeof RemindRentRequest>;

/** `GET /ops/rent/roll?month`, `GET /ops/rent/summary?month`: a Kigali month, this one by default. */
export const RentMonthQuery = z.object({ month: MonthKey.optional() });
export type RentMonthQuery = z.infer<typeof RentMonthQuery>;

/** A charge list filter: `overdue` is open and past the grace days today. */
export const ChargeFilterStatus = z.enum(["open", "paid", "waived", "overdue"]);
export type ChargeFilterStatus = z.infer<typeof ChargeFilterStatus>;

/** `GET /ops/rent/charges?leaseId|month&status`. */
export const RentChargesQuery = z.object({
  leaseId: Uuid.optional(),
  month: MonthKey.optional(),
  status: ChargeFilterStatus.optional(),
});
export type RentChargesQuery = z.infer<typeof RentChargesQuery>;

/** `GET /ops/rent/payments?leaseId|month&status`. */
export const RentPaymentsQuery = z.object({
  leaseId: Uuid.optional(),
  /** The month the money arrived (received on, or succeeded at, in Kigali). */
  month: MonthKey.optional(),
  status: LeasePaymentStatus.optional(),
});
export type RentPaymentsQuery = z.infer<typeof RentPaymentsQuery>;

/** `GET /ops/rent/reminders?leaseId|month`. */
export const RentRemindersQuery = z.object({
  leaseId: Uuid.optional(),
  month: MonthKey.optional(),
});
export type RentRemindersQuery = z.infer<typeof RentRemindersQuery>;

export const PayoutStatus = z.enum(["scheduled", "queued", "paid", "held", "failed"]);
export type PayoutStatus = z.infer<typeof PayoutStatus>;
export const PAYOUT_STATUS_LABEL: Readonly<Record<PayoutStatus, string>> = {
  scheduled: "Scheduled",
  queued: "On its way",
  paid: "Paid",
  held: "Held",
  failed: "Failed",
};

/** `GET /ops/payouts?month&status`: the month the payout was made (the payment's month). */
export const PayoutsQuery = z.object({
  month: MonthKey.optional(),
  status: PayoutStatus.optional(),
});
export type PayoutsQuery = z.infer<typeof PayoutsQuery>;

/** The methods a tenant pays with on Injishi today. Card follows when a gateway is chosen. */
export const TenantPaymentMethod = z.enum(["mtn_momo", "airtel_money"]);
export type TenantPaymentMethod = z.infer<typeof TenantPaymentMethod>;

/**
 * `POST /me/tenancies/:leaseId/payments` (Idempotency-Key): pay by mobile
 * money. Without an amount, everything owed; a smaller amount pays the oldest
 * charges first; a larger one, up to one month's rent over, is kept as credit.
 */
export const TenantPayRequest = z.object({
  method: TenantPaymentMethod,
  /** The number the prompt goes to, any way it is typed; stored masked. */
  msisdn: MomoNumber,
  amountRwf: PositiveRwf.optional(),
  /** The charges to pay. Absent: the open ones, oldest due first. */
  chargeIds: ChargeIds.optional(),
});
export type TenantPayRequest = z.infer<typeof TenantPayRequest>;

// --- Views -------------------------------------------------------------------------------

/** One charge, with what it still owes and whether it is late today. */
export const LeaseChargeView = z.object({
  id: Uuid,
  leaseId: Uuid,
  kind: LeaseChargeKind,
  /** "Rent for November 2026", "Deposit". */
  label: z.string(),
  periodStart: CalendarDay.nullable(),
  periodEnd: CalendarDay.nullable(),
  dueOn: CalendarDay,
  amountRwf: z.number().int(),
  paidRwf: z.number().int(),
  outstandingRwf: z.number().int(),
  status: LeaseChargeStatus,
  /** Open and past the due day plus the grace days, as of today. */
  overdue: z.boolean(),
  /** Days past the due day when overdue; 0 otherwise. */
  daysOverdue: z.number().int(),
  waivedReason: z.string().nullable(),
  paidAt: IsoMoment.nullable(),
  createdAt: IsoMoment,
});
export type LeaseChargeView = z.infer<typeof LeaseChargeView>;

/** What part of a payment went to which charge. */
export const PaymentAllocationView = z.object({
  chargeId: Uuid,
  kind: LeaseChargeKind,
  label: z.string(),
  periodStart: CalendarDay.nullable(),
  dueOn: CalendarDay,
  amountRwf: z.number().int(),
});
export type PaymentAllocationView = z.infer<typeof PaymentAllocationView>;

/** The payout a gateway payment went on to the landlord with. */
export const PaymentPayoutView = z.object({
  id: Uuid,
  status: PayoutStatus,
  /** "MTN MoMo 078•••••456", or null while held with no account. */
  destination: z.string().nullable(),
  settledAt: IsoMoment.nullable(),
  failureReason: z.string().nullable(),
});
export type PaymentPayoutView = z.infer<typeof PaymentPayoutView>;

/** One payment as the landlord's screens show it. */
export const LeasePaymentView = z.object({
  id: Uuid,
  leaseId: Uuid,
  leaseReference: z.string(),
  tenant: z.object({ id: Uuid, fullName: z.string() }),
  unit: z.object({ id: Uuid, label: z.string(), propertyName: z.string() }),
  channel: LeasePaymentChannel,
  method: LeasePaymentMethod,
  amountRwf: z.number().int(),
  /** What went to charges; the rest is the tenant's credit. */
  allocatedRwf: z.number().int(),
  creditRwf: z.number().int(),
  status: LeasePaymentStatus,
  statusWords: z.string(),
  /** The day the money arrived: received on, or the day it succeeded in Kigali. */
  paidOn: CalendarDay.nullable(),
  succeededAt: IsoMoment.nullable(),
  reference: z.string().nullable(),
  payerMasked: z.string().nullable(),
  receiptNumber: z.string().nullable(),
  /** The landlord attached a photo or scan of the slip. */
  hasSlip: z.boolean(),
  note: z.string().nullable(),
  recordedBy: z.string().nullable(),
  reversedAt: IsoMoment.nullable(),
  reverseReason: z.string().nullable(),
  failureReason: z.string().nullable(),
  expiresAt: IsoMoment.nullable(),
  allocations: z.array(PaymentAllocationView),
  payout: PaymentPayoutView.nullable(),
  createdAt: IsoMoment,
});
export type LeasePaymentView = z.infer<typeof LeasePaymentView>;

export const LeasePaymentList = z.object({ payments: z.array(LeasePaymentView) });
export type LeasePaymentList = z.infer<typeof LeasePaymentList>;

export const LeaseChargeList = z.object({ charges: z.array(LeaseChargeView) });
export type LeaseChargeList = z.infer<typeof LeaseChargeList>;

/** Where a month's rent stands on one lease. */
export const RentRollStatus = z.enum(["not_raised", "open", "partly_paid", "overdue", "paid", "waived"]);
export type RentRollStatus = z.infer<typeof RentRollStatus>;
export const RENT_ROLL_STATUS_LABEL: Readonly<Record<RentRollStatus, string>> = {
  not_raised: "Not raised yet",
  open: "Due",
  partly_paid: "Partly paid",
  overdue: "Overdue",
  paid: "Paid",
  waived: "Waived",
};

/** One lease on the rent roll of a month. */
export const RentRollRow = z.object({
  lease: z.object({ id: Uuid, reference: z.string(), status: LeaseStatus, graceDays: z.number().int(), monthlyRentRwf: z.number().int() }),
  tenant: z.object({ id: Uuid, fullName: z.string(), email: z.string().nullable(), phone: z.string().nullable() }),
  unit: z.object({ id: Uuid, label: z.string(), blockCode: z.string().nullable(), propertyName: z.string() }),
  /** The month's rent charge, once raised. */
  charge: LeaseChargeView.nullable(),
  /** What the month will charge when it is raised, or what it charged. */
  expectedRwf: z.number().int(),
  paidRwf: z.number().int(),
  outstandingRwf: z.number().int(),
  rollStatus: RentRollStatus,
  daysOverdue: z.number().int(),
  lastPayment: z.object({ id: Uuid, amountRwf: z.number().int(), paidOn: CalendarDay, channel: LeasePaymentChannel }).nullable(),
  lastReminder: z.object({ kind: LeaseReminderKind, sentAt: IsoMoment }).nullable(),
});
export type RentRollRow = z.infer<typeof RentRollRow>;

/** `GET /ops/rent/roll?month`: every live lease, with where the month's rent stands. */
export const RentRoll = z.object({
  month: MonthKey,
  today: CalendarDay,
  rows: z.array(RentRollRow),
  totals: z.object({
    leases: z.number().int(),
    expectedRwf: z.number().int(),
    collectedRwf: z.number().int(),
    outstandingRwf: z.number().int(),
    overdueRwf: z.number().int(),
    overdueLeases: z.number().int(),
  }),
});
export type RentRoll = z.infer<typeof RentRoll>;

/** `GET /ops/rent/summary?month`: the month's figures the Rent screen and the home read. */
export const RentSummary = z.object({
  month: MonthKey,
  today: CalendarDay,
  /** Rent charges due in the month, not waived. */
  expectedRwf: z.number().int(),
  /** Rent paid in the month: allocations of payments that arrived in it. */
  collectedRwf: z.number().int(),
  /** What the month's rent charges still owe. */
  outstandingRwf: z.number().int(),
  /** Open rent (any month) past its due day plus the grace days today. */
  overdueRwf: z.number().int(),
  overdueCharges: z.number().int(),
  /** Deposits paid in the month. */
  depositsCollectedRwf: z.number().int(),
  /** Gateway payments waiting on a phone right now. */
  pendingRwf: z.number().int(),
  /** Payouts settled in the month, and those still held for want of an account. */
  paidOutRwf: z.number().int(),
  heldRwf: z.number().int(),
  /** Tenants' credit: paid and not yet applied to a charge. */
  creditHeldRwf: z.number().int(),
});
export type RentSummary = z.infer<typeof RentSummary>;

/** One reminder, as sent. */
export const LeaseReminderView = z.object({
  id: Uuid,
  leaseId: Uuid,
  leaseReference: z.string(),
  tenantName: z.string(),
  chargeId: Uuid.nullable(),
  chargeLabel: z.string().nullable(),
  kind: LeaseReminderKind,
  stage: z.number().int(),
  channel: LeaseReminderChannel,
  note: z.string(),
  sentBy: z.string().nullable(),
  sentAt: IsoMoment,
});
export type LeaseReminderView = z.infer<typeof LeaseReminderView>;

export const LeaseReminderList = z.object({ reminders: z.array(LeaseReminderView) });
export type LeaseReminderList = z.infer<typeof LeaseReminderList>;

/** What `POST /ops/rent/reminders` did with each charge. */
export const RemindersSent = z.object({
  sent: z.array(z.object({ chargeId: Uuid, reminderId: Uuid, emailedTo: z.string().nullable() })),
  skipped: z.array(z.object({ chargeId: Uuid, reason: z.string() })),
});
export type RemindersSent = z.infer<typeof RemindersSent>;

/** One payout to the landlord. */
export const PayoutView = z.object({
  id: Uuid,
  status: PayoutStatus,
  statusLabel: z.string(),
  amountRwf: z.number().int(),
  /** "MTN MoMo 078•••••456"; null while held with no account. */
  destination: z.string().nullable(),
  accountKind: PayoutAccountKind.nullable(),
  payeeName: z.string().nullable(),
  payment: z.object({ id: Uuid, leaseId: Uuid, leaseReference: z.string(), tenantName: z.string(), receiptNumber: z.string().nullable() }).nullable(),
  failureReason: z.string().nullable(),
  createdAt: IsoMoment,
  settledAt: IsoMoment.nullable(),
});
export type PayoutView = z.infer<typeof PayoutView>;

export const PayoutList = z.object({
  payouts: z.array(PayoutView),
  totals: z.object({
    queuedRwf: z.number().int(),
    heldRwf: z.number().int(),
    paidRwf: z.number().int(),
    failedRwf: z.number().int(),
  }),
});
export type PayoutList = z.infer<typeof PayoutList>;

/** `GET /me/tenancies/:leaseId/charges`: what the tenant owes. */
export const TenantChargeList = z.object({
  charges: z.array(LeaseChargeView),
  outstandingRwf: z.number().int(),
  overdueRwf: z.number().int(),
  /** Paid ahead and not yet used on a charge. */
  creditRwf: z.number().int(),
  /** A gateway payment still waiting on the phone, if any. */
  pendingPaymentId: Uuid.nullable(),
  /** The most the tenant may pay now (everything owed plus one month as credit); 0 when nothing is owed. */
  maxPaymentRwf: z.number().int(),
});
export type TenantChargeList = z.infer<typeof TenantChargeList>;

/** One payment as the tenant sees it; `POST .../payments` and the poll answer this. */
export const TenantPaymentView = z.object({
  id: Uuid,
  leaseId: Uuid,
  channel: LeasePaymentChannel,
  method: LeasePaymentMethod,
  amountRwf: z.number().int(),
  status: LeasePaymentStatus,
  statusWords: z.string(),
  payerMasked: z.string().nullable(),
  reference: z.string().nullable(),
  receiptNumber: z.string().nullable(),
  /** A receipt PDF can be downloaded. */
  receiptReady: z.boolean(),
  failureReason: z.string().nullable(),
  allocations: z.array(PaymentAllocationView),
  creditRwf: z.number().int(),
  paidOn: CalendarDay.nullable(),
  expiresAt: IsoMoment.nullable(),
  succeededAt: IsoMoment.nullable(),
  createdAt: IsoMoment,
});
export type TenantPaymentView = z.infer<typeof TenantPaymentView>;

export const TenantPaymentList = z.object({ payments: z.array(TenantPaymentView) });
export type TenantPaymentList = z.infer<typeof TenantPaymentList>;

/** The month `today` falls in, for the queries that default to it. */
export function currentMonthKey(today: string = kigaliToday()): string {
  return today.slice(0, 7);
}
