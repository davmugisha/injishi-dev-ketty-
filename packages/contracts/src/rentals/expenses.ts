import { z } from "zod";
import { RwPhoneNumber } from "../phone";
import { Uuid } from "../primitives";
import { CalendarDay, PastCalendarDay, kigaliToday, pastDateProblem } from "./dates";
import { BankAccountNumber, RwandaBank } from "./money";
import { LoanPurpose, PositiveRwf } from "./vocab";

// ===========================================================================
// Expenses: what a landlord spent on the property, and paying a fault's fixer
// (blueprint 1.2 "Expenses and tax", 2.3, WP 4.3)
// ===========================================================================
//
// One record of money out per business, by calendar year. A fixer paid for a
// fault lands here (category repairs, the fault named), and so do the costs
// that have nothing to do with a fault: the guard, water and power, the
// interest on the bank loan that built or bought the building. The tax page
// reads it: proven loan interest lowers an individual's rental income tax,
// and for a company every cost counts against profit. A row is never
// deleted; a recorded one is voided with a reason. One paid through Injishi
// cannot be voided: the money moved.

const IsoMoment = z.string();

export const ExpenseCategory = z.enum(["repairs", "utilities", "security", "cleaning", "insurance", "loan_interest", "other"]);
export type ExpenseCategory = z.infer<typeof ExpenseCategory>;
export const EXPENSE_CATEGORY_LABEL: Readonly<Record<ExpenseCategory, string>> = {
  repairs: "Repairs",
  utilities: "Water and power",
  security: "Security",
  cleaning: "Cleaning",
  insurance: "Insurance",
  loan_interest: "Loan interest",
  other: "Other",
};

/** How it was paid. A payment through Injishi reads `momo` or `bank`, by where it went. */
export const ExpenseMethod = z.enum(["cash", "momo", "bank", "other"]);
export type ExpenseMethod = z.infer<typeof ExpenseMethod>;
export const EXPENSE_METHOD_LABEL: Readonly<Record<ExpenseMethod, string>> = {
  cash: "Cash",
  momo: "Mobile money",
  bank: "Bank transfer",
  other: "Other",
};

/** `gateway`: paid through Injishi. `recorded`: paid outside and written down here. */
export const ExpenseSource = z.enum(["gateway", "recorded"]);
export type ExpenseSource = z.infer<typeof ExpenseSource>;
export const EXPENSE_SOURCE_LABEL: Readonly<Record<ExpenseSource, string>> = {
  gateway: "Paid on Injishi",
  recorded: "Recorded",
};

export const LOAN_PURPOSE_LABEL: Readonly<Record<LoanPurpose, string>> = {
  build: "To build it",
  buy: "To buy it",
};

/** A receipt, a scan of a bank statement: a PDF or a photo, at most 10 MB. */
export const EXPENSE_RECEIPT_MAX_BYTES = 10 * 1024 * 1024;

/** Is `year` one an expense or a tax year can be about: 2000 to this year? */
export function expenseYearProblem(year: number, today: string = kigaliToday()): string | null {
  const now = Number(today.slice(0, 4));
  if (!Number.isInteger(year) || year < 2000) return "Pick a year from 2000 on.";
  if (year > now) return `${year} hasn't started yet.`;
  return null;
}

const OptionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters.`)
    .optional()
    .transform((v) => (v ? v : undefined));

const PayeeName = z
  .string()
  .trim()
  .max(120, "Keep the name under 120 characters.")
  .optional()
  .transform((v) => (v ? v : undefined));

/**
 * Write down an expense paid outside Injishi. Loan interest names the lender
 * and what the loan was for (only a loan to build or buy the rented property
 * lowers rental income tax); no other category has a loan purpose.
 */
export const RecordExpenseRequest = z
  .object({
    category: ExpenseCategory,
    amountRwf: PositiveRwf,
    paidOn: PastCalendarDay,
    method: ExpenseMethod,
    payeeName: PayeeName,
    payeePhone: RwPhoneNumber.optional(),
    note: OptionalText(500),
    /** The building it was for; left out, the business's only building, or the whole business. */
    propertyId: Uuid.optional(),
    /** The unit it was for, when it was for one. */
    unitId: Uuid.optional(),
    loanPurpose: LoanPurpose.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.category === "loan_interest") {
      if (!v.loanPurpose) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["loanPurpose"], message: "Say what the loan was for." });
      if (!v.payeeName || v.payeeName.length < 2) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["payeeName"], message: "Name the bank or lender." });
    } else if (v.loanPurpose) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["loanPurpose"], message: "Only loan interest has a loan purpose." });
    }
  });
export type RecordExpenseRequest = z.infer<typeof RecordExpenseRequest>;

export const VoidExpenseRequest = z.object({
  reason: z
    .string({ required_error: "Say why it is voided." })
    .trim()
    .min(3, "Say why it is voided.")
    .max(500, "Keep it under 500 characters."),
});
export type VoidExpenseRequest = z.infer<typeof VoidExpenseRequest>;

/** `GET /ops/expenses?year&propertyId&category`. The year is this one when left out. */
export const ExpenseListQuery = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  propertyId: Uuid.optional(),
  category: ExpenseCategory.optional(),
});
export type ExpenseListQuery = z.infer<typeof ExpenseListQuery>;

export const ExpenseView = z.object({
  id: Uuid,
  category: ExpenseCategory,
  amountRwf: z.number().int(),
  paidOn: CalendarDay,
  method: ExpenseMethod,
  payeeName: z.string().nullable(),
  payeePhone: z.string().nullable(),
  note: z.string().nullable(),
  propertyId: Uuid.nullable(),
  propertyName: z.string().nullable(),
  unitId: Uuid.nullable(),
  unitLabel: z.string().nullable(),
  ticketId: Uuid.nullable(),
  ticketTitle: z.string().nullable(),
  source: ExpenseSource,
  loanPurpose: LoanPurpose.nullable(),
  hasReceipt: z.boolean(),
  receiptUrl: z.string().nullable(),
  /** Paid through Injishi: it cannot be voided. */
  canVoid: z.boolean(),
  voided: z
    .object({ at: IsoMoment, byName: z.string().nullable(), reason: z.string() })
    .nullable(),
  createdByName: z.string().nullable(),
  createdAt: IsoMoment,
});
export type ExpenseView = z.infer<typeof ExpenseView>;

export const ExpenseTotals = z.object({
  /** Voided rows are listed, never counted. */
  totalRwf: z.number().int(),
  count: z.number().int(),
  byCategory: z.array(z.object({ category: ExpenseCategory, amountRwf: z.number().int(), count: z.number().int() })),
});
export type ExpenseTotals = z.infer<typeof ExpenseTotals>;

export const ExpenseList = z.object({
  year: z.number().int(),
  items: z.array(ExpenseView),
  totals: ExpenseTotals,
});
export type ExpenseList = z.infer<typeof ExpenseList>;

// --- Paying a fault's fixer ------------------------------------------------------------

/** The smallest and largest one payment to a fixer through Injishi may be. */
export const FIXER_PAYMENT_MIN_RWF = 100;
export const FIXER_PAYMENT_MAX_RWF = 10_000_000;

/**
 * Pay the fixer through Injishi. The gateway sends a prompt to the
 * landlord's own phone; once they approve it, the money goes to the fixer's
 * MoMo, Airtel Money or bank account, and the payment becomes a repairs
 * expense. Sent with an `Idempotency-Key`: a second press is the same payment.
 */
export const PayFixerRequest = z.object({
  amountRwf: z
    .number({ invalid_type_error: "Enter the amount.", required_error: "Enter the amount." })
    .int("Whole francs only.")
    .min(FIXER_PAYMENT_MIN_RWF, "Pay at least RWF 100.")
    .max(FIXER_PAYMENT_MAX_RWF, "Pay up to RWF 10,000,000 at a time."),
  payeeName: z
    .string({ required_error: "Enter who you are paying." })
    .trim()
    .min(2, "Enter who you are paying.")
    .max(120, "Keep the name under 120 characters."),
  payee: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("momo"), phone: RwPhoneNumber }),
    z.object({ kind: z.literal("bank"), bankName: RwandaBank, accountNumber: BankAccountNumber }),
  ]),
  /** The landlord's own MTN or Airtel number, which the prompt goes to. */
  payerPhone: RwPhoneNumber,
  note: OptionalText(500),
});
export type PayFixerRequest = z.infer<typeof PayFixerRequest>;

/**
 * Write down that the fixer was paid outside Injishi (cash, a transfer). It
 * becomes a repairs expense. The day is from the day the fault was reported
 * to today in Kigali; the service checks the first, the schema the second.
 */
export const RecordFaultPaymentRequest = z.object({
  amountRwf: PositiveRwf,
  paidOn: PastCalendarDay,
  method: ExpenseMethod,
  payeeName: z
    .string({ required_error: "Enter who was paid." })
    .trim()
    .min(2, "Enter who was paid.")
    .max(120, "Keep the name under 120 characters."),
  payeePhone: RwPhoneNumber.optional(),
  note: OptionalText(500),
});
export type RecordFaultPaymentRequest = z.infer<typeof RecordFaultPaymentRequest>;

/** Why a fault payment's day is not acceptable, or null: from the report day to today. */
export function faultPaymentDateProblem(paidOn: string, reportedOn: string, today: string = kigaliToday()): string | null {
  return pastDateProblem(paidOn, { today, notBefore: reportedOn, notBeforeLabel: "Pick a day from when the fault was reported." });
}

/**
 * `waiting`: the prompt is on the landlord's phone. `paid`: the fixer has it.
 * `failed`: nothing moved. `voided`: a recorded payment struck out.
 */
export const FaultPaymentStatus = z.enum(["waiting", "paid", "failed", "voided"]);
export type FaultPaymentStatus = z.infer<typeof FaultPaymentStatus>;
export const FAULT_PAYMENT_STATUS_LABEL: Readonly<Record<FaultPaymentStatus, string>> = {
  waiting: "Waiting for you to approve",
  paid: "Paid",
  failed: "Failed",
  voided: "Voided",
};

/** A payment for a fault's fix, as the landlord's panel shows it. */
export const FaultPaymentView = z.object({
  id: Uuid,
  source: ExpenseSource,
  status: FaultPaymentStatus,
  amountRwf: z.number().int(),
  payeeName: z.string().nullable(),
  /** Where it went, masked, for a payment through Injishi. */
  destination: z.string().nullable(),
  method: ExpenseMethod.nullable(),
  paidOn: CalendarDay.nullable(),
  failureReason: z.string().nullable(),
  expenseId: Uuid.nullable(),
  receiptUrl: z.string().nullable(),
  createdAt: IsoMoment,
});
export type FaultPaymentView = z.infer<typeof FaultPaymentView>;
