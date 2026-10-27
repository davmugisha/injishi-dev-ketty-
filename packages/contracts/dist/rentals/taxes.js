"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TAX_APP_PATHS = exports.TaxYearView = exports.LeaseFilingList = exports.LeaseFilingsQuery = exports.LeaseFilingView = exports.FILING_PROOF_MAX_BYTES = exports.MarkFilingFiledRequest = exports.TaxDeclarationView = exports.UpdateTaxDeclarationRequest = exports.TaxpayerView = exports.SetTaxpayerRequest = exports.TAX_RECEIPT_MAX_BYTES = exports.MAX_TAX_PAID_RWF = exports.TAX_DECLARATION_STATUS_LABEL = exports.TaxDeclarationStatus = exports.TaxYearParam = exports.TAX_YEAR_MIN = void 0;
exports.taxYearProblem = taxYearProblem;
exports.taxYears = taxYears;
exports.taxYearEnded = taxYearEnded;
exports.declarationDateProblem = declarationDateProblem;
exports.leaseFilingDateProblem = leaseFilingDateProblem;
const zod_1 = require("zod");
const primitives_1 = require("../primitives");
const dates_1 = require("./dates");
const expenses_1 = require("./expenses");
const vocab_1 = require("./vocab");
// ===========================================================================
// Rental income tax and lease filings with RRA (blueprint 1.2, 2.3, WP 4.4)
// ===========================================================================
//
// The rules are in `money.ts` (Law No. 048/2023 as feat/rentals verified it):
// rent received in the calendar year, less 50%, less the bank interest paid
// on a loan to build or buy the rented property, then 0%, 20% and 30% bands
// at 180,000 and 1,000,000, declared and paid by 31 January of the next year,
// with Art. 51's late charges. A company pays corporate income tax on its
// profit instead. Here: what the tax page and its routes take and answer, the
// declaration's states and dates, and a lease copy filed with RRA within 15
// days of signing.
const IsoMoment = zod_1.z.string();
/** The first year the tax page can show. */
exports.TAX_YEAR_MIN = 2020;
/** Why `year` is not a tax year the page can show, or null: 2020 to this year. */
function taxYearProblem(year, today = (0, dates_1.kigaliToday)()) {
    if (!Number.isInteger(year))
        return "Pick a year.";
    if (year < exports.TAX_YEAR_MIN)
        return `Pick a year from ${exports.TAX_YEAR_MIN} on.`;
    if (year > Number(today.slice(0, 4)))
        return "That year hasn't started yet.";
    return null;
}
/** The years a landlord can pick, newest first. */
function taxYears(today = (0, dates_1.kigaliToday)()) {
    const last = Number(today.slice(0, 4));
    return Array.from({ length: last - exports.TAX_YEAR_MIN + 1 }, (_, i) => last - i);
}
/** Has `year` ended, so it can be declared? */
function taxYearEnded(year, today = (0, dates_1.kigaliToday)()) {
    return year < Number(today.slice(0, 4));
}
/** `GET /ops/taxes/:year`. */
exports.TaxYearParam = zod_1.z.coerce.number({ invalid_type_error: "Pick a year." }).int("Pick a year.");
/** Where a year's declaration stands. Late is worked out, never stored. */
exports.TaxDeclarationStatus = zod_1.z.enum(["not_started", "declared", "paid"]);
exports.TAX_DECLARATION_STATUS_LABEL = {
    not_started: "Not declared",
    declared: "Declared",
    paid: "Paid",
};
/** The most a tax payment can be recorded as. */
exports.MAX_TAX_PAID_RWF = 2000000000;
/** RRA's receipt: a PDF or a photo, at most 10 MB. */
exports.TAX_RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
/**
 * Why a declaration or payment day is not acceptable, or null: a real day,
 * not after today in Kigali, not before the year it is for has ended, and
 * (for a payment) not before the declaration.
 */
function declarationDateProblem(v, year, opts = {}) {
    if (!(0, dates_1.isIsoDate)(v))
        return "Pick a date.";
    const today = opts.today ?? (0, dates_1.kigaliToday)();
    if (v > today)
        return "That date hasn't happened yet.";
    if (v < `${year + 1}-01-01`)
        return `A ${year} declaration is made from 1 January ${year + 1}.`;
    if (opts.notBefore && v < opts.notBefore)
        return "The payment can't be before the declaration.";
    return null;
}
const OptionalReference = zod_1.z
    .string()
    .trim()
    .max(80, "Keep the reference under 80 characters.")
    .optional()
    .transform((v) => (v ? v : undefined));
/** `PUT /ops/taxes/taxpayer`: does the landlord let as a person or a company? */
exports.SetTaxpayerRequest = zod_1.z.object({ kind: vocab_1.TaxpayerKind });
exports.TaxpayerView = zod_1.z.object({ kind: vocab_1.TaxpayerKind.nullable() });
/**
 * `PUT /ops/taxes/:year/declaration`: where the declaration stands, as the
 * landlord tells it (they declare and pay on RRA's own portal). The receipt
 * comes as a file (`receipt`) beside these fields.
 */
exports.UpdateTaxDeclarationRequest = zod_1.z
    .object({
    status: exports.TaxDeclarationStatus,
    declaredOn: dates_1.CalendarDay.optional(),
    paidOn: dates_1.CalendarDay.optional(),
    amountPaidRwf: zod_1.z
        .number({ invalid_type_error: "Enter the amount paid." })
        .int("Whole francs only.")
        .positive("Enter an amount above 0.")
        .max(exports.MAX_TAX_PAID_RWF, "That amount is too large.")
        .optional(),
    rraReference: OptionalReference,
})
    .superRefine((v, ctx) => {
    if (v.status === "not_started")
        return;
    if (!v.declaredOn)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["declaredOn"], message: "Pick the day you declared." });
    if (v.status === "paid") {
        if (!v.paidOn)
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["paidOn"], message: "Pick the day you paid." });
        if (v.amountPaidRwf === undefined)
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["amountPaidRwf"], message: "Enter the amount paid." });
    }
});
exports.TaxDeclarationView = zod_1.z.object({
    status: exports.TaxDeclarationStatus,
    declaredOn: dates_1.CalendarDay.nullable(),
    paidOn: dates_1.CalendarDay.nullable(),
    amountPaidRwf: zod_1.z.number().int().nullable(),
    rraReference: zod_1.z.string().nullable(),
    /** A short-lived link to RRA's receipt, when one was attached. */
    receiptUrl: zod_1.z.string().nullable(),
    updatedAt: IsoMoment.nullable(),
});
// --- Lease filings --------------------------------------------------------------------
/** Why a filing day is not acceptable, or null: from the day it could be filed (signing) to today. */
function leaseFilingDateProblem(v, notBefore, today = (0, dates_1.kigaliToday)()) {
    if (!(0, dates_1.isIsoDate)(v))
        return "Pick a date.";
    if (v > today)
        return "That date hasn't happened yet.";
    if (v < notBefore)
        return "That's before the lease was signed.";
    return null;
}
/** `POST /ops/filings/:id/filed`: the landlord gave RRA the copy. The proof comes as a file (`proof`). */
exports.MarkFilingFiledRequest = zod_1.z.object({
    filedOn: dates_1.CalendarDay,
    reference: OptionalReference,
});
/** The proof RRA gives: a PDF or a photo, at most 10 MB. */
exports.FILING_PROOF_MAX_BYTES = 10 * 1024 * 1024;
exports.LeaseFilingView = zod_1.z.object({
    id: primitives_1.Uuid,
    leaseId: primitives_1.Uuid,
    leaseReference: zod_1.z.string(),
    tenantName: zod_1.z.string(),
    unitLabel: zod_1.z.string(),
    propertyName: zod_1.z.string(),
    kind: vocab_1.LeaseFilingKind,
    /** The Kigali day the lease was signed by both, for a new lease. */
    signedOn: dates_1.CalendarDay.nullable(),
    dueOn: dates_1.CalendarDay,
    status: vocab_1.LeaseFilingStatus,
    /** Due and not filed by its day. Worked out, never stored. */
    late: zod_1.z.boolean(),
    /** Days left to file it, while it is due; negative once late. */
    daysLeft: zod_1.z.number().int().nullable(),
    filedOn: dates_1.CalendarDay.nullable(),
    reference: zod_1.z.string().nullable(),
    proofUrl: zod_1.z.string().nullable(),
});
/** `GET /ops/filings?year&status`. No year: every filing still due, and this year's. */
exports.LeaseFilingsQuery = zod_1.z.object({
    year: zod_1.z.coerce.number().int().min(2000).max(2100).optional(),
    status: vocab_1.LeaseFilingStatus.optional(),
});
exports.LeaseFilingList = zod_1.z.object({ items: zod_1.z.array(exports.LeaseFilingView) });
// --- One year, in full ------------------------------------------------------------------
const RentalTaxBandView = zod_1.z.object({
    fromRwf: zod_1.z.number().int(),
    toRwf: zod_1.z.number().int().nullable(),
    ratePercent: zod_1.z.number(),
    incomeRwf: zod_1.z.number().int(),
    taxRwf: zod_1.z.number().int(),
});
exports.TaxYearView = zod_1.z.object({
    year: zod_1.z.number().int(),
    /** Today in Kigali. When `year` is this year, every figure is "so far". */
    asOf: dates_1.CalendarDay,
    running: zod_1.z.boolean(),
    /** Null until the landlord says whether they let as a person or a company. */
    taxpayer: vocab_1.TaxpayerKind.nullable(),
    /** 31 January of the next year. */
    dueOn: dates_1.CalendarDay,
    /** The year has ended, the landlord is not a company: the declaration can be marked. */
    canDeclare: zod_1.z.boolean(),
    rent: zod_1.z.object({
        /** Rent received: succeeded payments, by the day they were received, less any part that paid a deposit. */
        totalRwf: zod_1.z.number().int(),
        gatewayRwf: zod_1.z.number().int(),
        recordedRwf: zod_1.z.number().int(),
        paymentCount: zod_1.z.number().int(),
        /** What came in for deposits that year: held for the tenant, never rent, left out above. */
        depositsExcludedRwf: zod_1.z.number().int(),
        /** Twelve months, January first, `yyyy-mm`. */
        months: zod_1.z.array(zod_1.z.object({ month: zod_1.z.string(), amountRwf: zod_1.z.number().int() })),
        properties: zod_1.z.array(zod_1.z.object({ propertyId: primitives_1.Uuid, name: zod_1.z.string(), amountRwf: zod_1.z.number().int() })),
    }),
    interest: zod_1.z.object({
        /** Interest on loans to build or buy the rented property, not voided: what lowers the tax. */
        deductibleRwf: zod_1.z.number().int(),
        entries: zod_1.z.array(zod_1.z.object({
            id: primitives_1.Uuid,
            paidOn: dates_1.CalendarDay,
            lender: zod_1.z.string().nullable(),
            amountRwf: zod_1.z.number().int(),
            loanPurpose: vocab_1.LoanPurpose.nullable(),
            propertyName: zod_1.z.string().nullable(),
            hasReceipt: zod_1.z.boolean(),
            /** No bank statement or receipt attached: RRA asks for proof from the bank. Still counted. */
            needsBankProof: zod_1.z.boolean(),
        })),
        needsProofCount: zod_1.z.number().int(),
    }),
    /** Every other cost of the year. For a person they are for the records: the 50% covers upkeep. */
    otherExpenses: zod_1.z.object({
        totalRwf: zod_1.z.number().int(),
        byCategory: zod_1.z.array(zod_1.z.object({ category: expenses_1.ExpenseCategory, amountRwf: zod_1.z.number().int() })),
        entries: zod_1.z.array(zod_1.z.object({
            id: primitives_1.Uuid,
            paidOn: dates_1.CalendarDay,
            category: expenses_1.ExpenseCategory,
            amountRwf: zod_1.z.number().int(),
            payeeName: zod_1.z.string().nullable(),
            propertyName: zod_1.z.string().nullable(),
        })),
    }),
    /** The person's estimate (null for a company). */
    rentalTax: zod_1.z
        .object({
        grossRentRwf: zod_1.z.number().int(),
        flatDeductionRwf: zod_1.z.number().int(),
        loanInterestRwf: zod_1.z.number().int(),
        interestDeductedRwf: zod_1.z.number().int(),
        taxableIncomeRwf: zod_1.z.number().int(),
        bands: zod_1.z.array(RentalTaxBandView),
        taxRwf: zod_1.z.number().int(),
    })
        .nullable(),
    /** The company's view: rent less every cost, and the 28% it implies (null for a person). */
    profit: zod_1.z
        .object({
        rentRwf: zod_1.z.number().int(),
        expensesRwf: zod_1.z.number().int(),
        profitRwf: zod_1.z.number().int(),
        corporateTaxRwf: zod_1.z.number().int(),
    })
        .nullable(),
    /** What paying late adds, while it is past due and not declared (Art. 51). */
    lateCharges: zod_1.z
        .object({
        monthsLate: zod_1.z.number().int(),
        penaltyRwf: zod_1.z.number().int(),
        surchargeRwf: zod_1.z.number().int(),
        interestRwf: zod_1.z.number().int(),
        totalRwf: zod_1.z.number().int(),
    })
        .nullable(),
    declaration: exports.TaxDeclarationView,
    /** The lease copies owed to RRA whose day falls in the year. */
    filings: zod_1.z.array(exports.LeaseFilingView),
});
/** The app's tax page a mail opens. */
exports.TAX_APP_PATHS = {
    taxes: (year) => `/taxes?year=${year}`,
    filing: (leaseId) => `/leases/${encodeURIComponent(leaseId)}?tab=filing`,
};
//# sourceMappingURL=taxes.js.map