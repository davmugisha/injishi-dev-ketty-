"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FaultPaymentView = exports.FAULT_PAYMENT_STATUS_LABEL = exports.FaultPaymentStatus = exports.RecordFaultPaymentRequest = exports.PayFixerRequest = exports.FIXER_PAYMENT_MAX_RWF = exports.FIXER_PAYMENT_MIN_RWF = exports.ExpenseList = exports.ExpenseTotals = exports.ExpenseView = exports.ExpenseListQuery = exports.VoidExpenseRequest = exports.RecordExpenseRequest = exports.EXPENSE_RECEIPT_MAX_BYTES = exports.LOAN_PURPOSE_LABEL = exports.EXPENSE_SOURCE_LABEL = exports.ExpenseSource = exports.EXPENSE_METHOD_LABEL = exports.ExpenseMethod = exports.EXPENSE_CATEGORY_LABEL = exports.ExpenseCategory = void 0;
exports.expenseYearProblem = expenseYearProblem;
exports.faultPaymentDateProblem = faultPaymentDateProblem;
const zod_1 = require("zod");
const phone_1 = require("../phone");
const primitives_1 = require("../primitives");
const dates_1 = require("./dates");
const money_1 = require("./money");
const vocab_1 = require("./vocab");
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
const IsoMoment = zod_1.z.string();
exports.ExpenseCategory = zod_1.z.enum(["repairs", "utilities", "security", "cleaning", "insurance", "loan_interest", "other"]);
exports.EXPENSE_CATEGORY_LABEL = {
    repairs: "Repairs",
    utilities: "Water and power",
    security: "Security",
    cleaning: "Cleaning",
    insurance: "Insurance",
    loan_interest: "Loan interest",
    other: "Other",
};
/** How it was paid. A payment through Injishi reads `momo` or `bank`, by where it went. */
exports.ExpenseMethod = zod_1.z.enum(["cash", "momo", "bank", "other"]);
exports.EXPENSE_METHOD_LABEL = {
    cash: "Cash",
    momo: "Mobile money",
    bank: "Bank transfer",
    other: "Other",
};
/** `gateway`: paid through Injishi. `recorded`: paid outside and written down here. */
exports.ExpenseSource = zod_1.z.enum(["gateway", "recorded"]);
exports.EXPENSE_SOURCE_LABEL = {
    gateway: "Paid on Injishi",
    recorded: "Recorded",
};
exports.LOAN_PURPOSE_LABEL = {
    build: "To build it",
    buy: "To buy it",
};
/** A receipt, a scan of a bank statement: a PDF or a photo, at most 10 MB. */
exports.EXPENSE_RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
/** Is `year` one an expense or a tax year can be about: 2000 to this year? */
function expenseYearProblem(year, today = (0, dates_1.kigaliToday)()) {
    const now = Number(today.slice(0, 4));
    if (!Number.isInteger(year) || year < 2000)
        return "Pick a year from 2000 on.";
    if (year > now)
        return `${year} hasn't started yet.`;
    return null;
}
const OptionalText = (max) => zod_1.z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters.`)
    .optional()
    .transform((v) => (v ? v : undefined));
const PayeeName = zod_1.z
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
exports.RecordExpenseRequest = zod_1.z
    .object({
    category: exports.ExpenseCategory,
    amountRwf: vocab_1.PositiveRwf,
    paidOn: dates_1.PastCalendarDay,
    method: exports.ExpenseMethod,
    payeeName: PayeeName,
    payeePhone: phone_1.RwPhoneNumber.optional(),
    note: OptionalText(500),
    /** The building it was for; left out, the business's only building, or the whole business. */
    propertyId: primitives_1.Uuid.optional(),
    /** The unit it was for, when it was for one. */
    unitId: primitives_1.Uuid.optional(),
    loanPurpose: vocab_1.LoanPurpose.optional(),
})
    .superRefine((v, ctx) => {
    if (v.category === "loan_interest") {
        if (!v.loanPurpose)
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["loanPurpose"], message: "Say what the loan was for." });
        if (!v.payeeName || v.payeeName.length < 2)
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["payeeName"], message: "Name the bank or lender." });
    }
    else if (v.loanPurpose) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["loanPurpose"], message: "Only loan interest has a loan purpose." });
    }
});
exports.VoidExpenseRequest = zod_1.z.object({
    reason: zod_1.z
        .string({ required_error: "Say why it is voided." })
        .trim()
        .min(3, "Say why it is voided.")
        .max(500, "Keep it under 500 characters."),
});
/** `GET /ops/expenses?year&propertyId&category`. The year is this one when left out. */
exports.ExpenseListQuery = zod_1.z.object({
    year: zod_1.z.coerce.number().int().min(2000).max(2100).optional(),
    propertyId: primitives_1.Uuid.optional(),
    category: exports.ExpenseCategory.optional(),
});
exports.ExpenseView = zod_1.z.object({
    id: primitives_1.Uuid,
    category: exports.ExpenseCategory,
    amountRwf: zod_1.z.number().int(),
    paidOn: dates_1.CalendarDay,
    method: exports.ExpenseMethod,
    payeeName: zod_1.z.string().nullable(),
    payeePhone: zod_1.z.string().nullable(),
    note: zod_1.z.string().nullable(),
    propertyId: primitives_1.Uuid.nullable(),
    propertyName: zod_1.z.string().nullable(),
    unitId: primitives_1.Uuid.nullable(),
    unitLabel: zod_1.z.string().nullable(),
    ticketId: primitives_1.Uuid.nullable(),
    ticketTitle: zod_1.z.string().nullable(),
    source: exports.ExpenseSource,
    loanPurpose: vocab_1.LoanPurpose.nullable(),
    hasReceipt: zod_1.z.boolean(),
    receiptUrl: zod_1.z.string().nullable(),
    /** Paid through Injishi: it cannot be voided. */
    canVoid: zod_1.z.boolean(),
    voided: zod_1.z
        .object({ at: IsoMoment, byName: zod_1.z.string().nullable(), reason: zod_1.z.string() })
        .nullable(),
    createdByName: zod_1.z.string().nullable(),
    createdAt: IsoMoment,
});
exports.ExpenseTotals = zod_1.z.object({
    /** Voided rows are listed, never counted. */
    totalRwf: zod_1.z.number().int(),
    count: zod_1.z.number().int(),
    byCategory: zod_1.z.array(zod_1.z.object({ category: exports.ExpenseCategory, amountRwf: zod_1.z.number().int(), count: zod_1.z.number().int() })),
});
exports.ExpenseList = zod_1.z.object({
    year: zod_1.z.number().int(),
    items: zod_1.z.array(exports.ExpenseView),
    totals: exports.ExpenseTotals,
});
// --- Paying a fault's fixer ------------------------------------------------------------
/** The smallest and largest one payment to a fixer through Injishi may be. */
exports.FIXER_PAYMENT_MIN_RWF = 100;
exports.FIXER_PAYMENT_MAX_RWF = 10000000;
/**
 * Pay the fixer through Injishi. The gateway sends a prompt to the
 * landlord's own phone; once they approve it, the money goes to the fixer's
 * MoMo, Airtel Money or bank account, and the payment becomes a repairs
 * expense. Sent with an `Idempotency-Key`: a second press is the same payment.
 */
exports.PayFixerRequest = zod_1.z.object({
    amountRwf: zod_1.z
        .number({ invalid_type_error: "Enter the amount.", required_error: "Enter the amount." })
        .int("Whole francs only.")
        .min(exports.FIXER_PAYMENT_MIN_RWF, "Pay at least RWF 100.")
        .max(exports.FIXER_PAYMENT_MAX_RWF, "Pay up to RWF 10,000,000 at a time."),
    payeeName: zod_1.z
        .string({ required_error: "Enter who you are paying." })
        .trim()
        .min(2, "Enter who you are paying.")
        .max(120, "Keep the name under 120 characters."),
    payee: zod_1.z.discriminatedUnion("kind", [
        zod_1.z.object({ kind: zod_1.z.literal("momo"), phone: phone_1.RwPhoneNumber }),
        zod_1.z.object({ kind: zod_1.z.literal("bank"), bankName: money_1.RwandaBank, accountNumber: money_1.BankAccountNumber }),
    ]),
    /** The landlord's own MTN or Airtel number, which the prompt goes to. */
    payerPhone: phone_1.RwPhoneNumber,
    note: OptionalText(500),
});
/**
 * Write down that the fixer was paid outside Injishi (cash, a transfer). It
 * becomes a repairs expense. The day is from the day the fault was reported
 * to today in Kigali; the service checks the first, the schema the second.
 */
exports.RecordFaultPaymentRequest = zod_1.z.object({
    amountRwf: vocab_1.PositiveRwf,
    paidOn: dates_1.PastCalendarDay,
    method: exports.ExpenseMethod,
    payeeName: zod_1.z
        .string({ required_error: "Enter who was paid." })
        .trim()
        .min(2, "Enter who was paid.")
        .max(120, "Keep the name under 120 characters."),
    payeePhone: phone_1.RwPhoneNumber.optional(),
    note: OptionalText(500),
});
/** Why a fault payment's day is not acceptable, or null: from the report day to today. */
function faultPaymentDateProblem(paidOn, reportedOn, today = (0, dates_1.kigaliToday)()) {
    return (0, dates_1.pastDateProblem)(paidOn, { today, notBefore: reportedOn, notBeforeLabel: "Pick a day from when the fault was reported." });
}
/**
 * `waiting`: the prompt is on the landlord's phone. `paid`: the fixer has it.
 * `failed`: nothing moved. `voided`: a recorded payment struck out.
 */
exports.FaultPaymentStatus = zod_1.z.enum(["waiting", "paid", "failed", "voided"]);
exports.FAULT_PAYMENT_STATUS_LABEL = {
    waiting: "Waiting for you to approve",
    paid: "Paid",
    failed: "Failed",
    voided: "Voided",
};
/** A payment for a fault's fix, as the landlord's panel shows it. */
exports.FaultPaymentView = zod_1.z.object({
    id: primitives_1.Uuid,
    source: exports.ExpenseSource,
    status: exports.FaultPaymentStatus,
    amountRwf: zod_1.z.number().int(),
    payeeName: zod_1.z.string().nullable(),
    /** Where it went, masked, for a payment through Injishi. */
    destination: zod_1.z.string().nullable(),
    method: exports.ExpenseMethod.nullable(),
    paidOn: dates_1.CalendarDay.nullable(),
    failureReason: zod_1.z.string().nullable(),
    expenseId: primitives_1.Uuid.nullable(),
    receiptUrl: zod_1.z.string().nullable(),
    createdAt: IsoMoment,
});
//# sourceMappingURL=expenses.js.map