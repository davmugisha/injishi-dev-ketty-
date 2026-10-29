import { z } from "zod";
import { Uuid } from "../primitives";
import { CalendarDay, isIsoDate, kigaliToday } from "./dates";
import { ExpenseCategory } from "./expenses";
import { LeaseFilingKind, LeaseFilingStatus, LoanPurpose, TaxpayerKind } from "./vocab";

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

const IsoMoment = z.string();

/** The first year the tax page can show. */
export const TAX_YEAR_MIN = 2020;

/** Why `year` is not a tax year the page can show, or null: 2020 to this year. */
export function taxYearProblem(year: number, today: string = kigaliToday()): string | null {
  if (!Number.isInteger(year)) return "Pick a year.";
  if (year < TAX_YEAR_MIN) return `Pick a year from ${TAX_YEAR_MIN} on.`;
  if (year > Number(today.slice(0, 4))) return "That year hasn't started yet.";
  return null;
}

/** The years a landlord can pick, newest first. */
export function taxYears(today: string = kigaliToday()): number[] {
  const last = Number(today.slice(0, 4));
  return Array.from({ length: last - TAX_YEAR_MIN + 1 }, (_, i) => last - i);
}

/** Has `year` ended, so it can be declared? */
export function taxYearEnded(year: number, today: string = kigaliToday()): boolean {
  return year < Number(today.slice(0, 4));
}

/** `GET /ops/taxes/:year`. */
export const TaxYearParam = z.coerce.number({ invalid_type_error: "Pick a year." }).int("Pick a year.");

/** Where a year's declaration stands. Late is worked out, never stored. */
export const TaxDeclarationStatus = z.enum(["not_started", "declared", "paid"]);
export type TaxDeclarationStatus = z.infer<typeof TaxDeclarationStatus>;
export const TAX_DECLARATION_STATUS_LABEL: Readonly<Record<TaxDeclarationStatus, string>> = {
  not_started: "Not declared",
  declared: "Declared",
  paid: "Paid",
};

/** The most a tax payment can be recorded as. */
export const MAX_TAX_PAID_RWF = 2_000_000_000;
/** RRA's receipt: a PDF or a photo, at most 10 MB. */
export const TAX_RECEIPT_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Why a declaration or payment day is not acceptable, or null: a real day,
 * not after today in Kigali, not before the year it is for has ended, and
 * (for a payment) not before the declaration.
 */
export function declarationDateProblem(v: string, year: number, opts: { today?: string; notBefore?: string | null } = {}): string | null {
  if (!isIsoDate(v)) return "Pick a date.";
  const today = opts.today ?? kigaliToday();
  if (v > today) return "That date hasn't happened yet.";
  if (v < `${year + 1}-01-01`) return `A ${year} declaration is made from 1 January ${year + 1}.`;
  if (opts.notBefore && v < opts.notBefore) return "The payment can't be before the declaration.";
  return null;
}

const OptionalReference = z
  .string()
  .trim()
  .max(80, "Keep the reference under 80 characters.")
  .optional()
  .transform((v) => (v ? v : undefined));

/** `PUT /ops/taxes/taxpayer`: does the landlord let as a person or a company? */
export const SetTaxpayerRequest = z.object({ kind: TaxpayerKind });
export type SetTaxpayerRequest = z.infer<typeof SetTaxpayerRequest>;

export const TaxpayerView = z.object({ kind: TaxpayerKind.nullable() });
export type TaxpayerView = z.infer<typeof TaxpayerView>;

/**
 * `PUT /ops/taxes/:year/declaration`: where the declaration stands, as the
 * landlord tells it (they declare and pay on RRA's own portal). The receipt
 * comes as a file (`receipt`) beside these fields.
 */
export const UpdateTaxDeclarationRequest = z
  .object({
    status: TaxDeclarationStatus,
    declaredOn: CalendarDay.optional(),
    paidOn: CalendarDay.optional(),
    amountPaidRwf: z
      .number({ invalid_type_error: "Enter the amount paid." })
      .int("Whole francs only.")
      .positive("Enter an amount above 0.")
      .max(MAX_TAX_PAID_RWF, "That amount is too large.")
      .optional(),
    rraReference: OptionalReference,
  })
  .superRefine((v, ctx) => {
    if (v.status === "not_started") return;
    if (!v.declaredOn) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["declaredOn"], message: "Pick the day you declared." });
    if (v.status === "paid") {
      if (!v.paidOn) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["paidOn"], message: "Pick the day you paid." });
      if (v.amountPaidRwf === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amountPaidRwf"], message: "Enter the amount paid." });
    }
  });
export type UpdateTaxDeclarationRequest = z.infer<typeof UpdateTaxDeclarationRequest>;

export const TaxDeclarationView = z.object({
  status: TaxDeclarationStatus,
  declaredOn: CalendarDay.nullable(),
  paidOn: CalendarDay.nullable(),
  amountPaidRwf: z.number().int().nullable(),
  rraReference: z.string().nullable(),
  /** A short-lived link to RRA's receipt, when one was attached. */
  receiptUrl: z.string().nullable(),
  updatedAt: IsoMoment.nullable(),
});
export type TaxDeclarationView = z.infer<typeof TaxDeclarationView>;

// --- Lease filings --------------------------------------------------------------------

/** Why a filing day is not acceptable, or null: from the day it could be filed (signing) to today. */
export function leaseFilingDateProblem(v: string, notBefore: string, today: string = kigaliToday()): string | null {
  if (!isIsoDate(v)) return "Pick a date.";
  if (v > today) return "That date hasn't happened yet.";
  if (v < notBefore) return "That's before the lease was signed.";
  return null;
}

/** `POST /ops/filings/:id/filed`: the landlord gave RRA the copy. The proof comes as a file (`proof`). */
export const MarkFilingFiledRequest = z.object({
  filedOn: CalendarDay,
  reference: OptionalReference,
});
export type MarkFilingFiledRequest = z.infer<typeof MarkFilingFiledRequest>;

/** The proof RRA gives: a PDF or a photo, at most 10 MB. */
export const FILING_PROOF_MAX_BYTES = 10 * 1024 * 1024;

export const LeaseFilingView = z.object({
  id: Uuid,
  leaseId: Uuid,
  leaseReference: z.string(),
  tenantName: z.string(),
  unitLabel: z.string(),
  propertyName: z.string(),
  kind: LeaseFilingKind,
  /** The Kigali day the lease was signed by both, for a new lease. */
  signedOn: CalendarDay.nullable(),
  dueOn: CalendarDay,
  status: LeaseFilingStatus,
  /** Due and not filed by its day. Worked out, never stored. */
  late: z.boolean(),
  /** Days left to file it, while it is due; negative once late. */
  daysLeft: z.number().int().nullable(),
  filedOn: CalendarDay.nullable(),
  reference: z.string().nullable(),
  proofUrl: z.string().nullable(),
});
export type LeaseFilingView = z.infer<typeof LeaseFilingView>;

/** `GET /ops/filings?year&status`. No year: every filing still due, and this year's. */
export const LeaseFilingsQuery = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  status: LeaseFilingStatus.optional(),
});
export type LeaseFilingsQuery = z.infer<typeof LeaseFilingsQuery>;

export const LeaseFilingList = z.object({ items: z.array(LeaseFilingView) });
export type LeaseFilingList = z.infer<typeof LeaseFilingList>;

// --- One year, in full ------------------------------------------------------------------

const RentalTaxBandView = z.object({
  fromRwf: z.number().int(),
  toRwf: z.number().int().nullable(),
  ratePercent: z.number(),
  incomeRwf: z.number().int(),
  taxRwf: z.number().int(),
});

export const TaxYearView = z.object({
  year: z.number().int(),
  /** Today in Kigali. When `year` is this year, every figure is "so far". */
  asOf: CalendarDay,
  running: z.boolean(),
  /** Null until the landlord says whether they let as a person or a company. */
  taxpayer: TaxpayerKind.nullable(),
  /** 31 January of the next year. */
  dueOn: CalendarDay,
  /** The year has ended, the landlord is not a company: the declaration can be marked. */
  canDeclare: z.boolean(),
  rent: z.object({
    /** Rent received: succeeded payments, by the day they were received, less any part that paid a deposit. */
    totalRwf: z.number().int(),
    gatewayRwf: z.number().int(),
    recordedRwf: z.number().int(),
    paymentCount: z.number().int(),
    /** What came in for deposits that year: held for the tenant, never rent, left out above. */
    depositsExcludedRwf: z.number().int(),
    /** Twelve months, January first, `yyyy-mm`. */
    months: z.array(z.object({ month: z.string(), amountRwf: z.number().int() })),
    properties: z.array(z.object({ propertyId: Uuid, name: z.string(), amountRwf: z.number().int() })),
  }),
  interest: z.object({
    /** Interest on loans to build or buy the rented property, not voided: what lowers the tax. */
    deductibleRwf: z.number().int(),
    entries: z.array(
      z.object({
        id: Uuid,
        paidOn: CalendarDay,
        lender: z.string().nullable(),
        amountRwf: z.number().int(),
        loanPurpose: LoanPurpose.nullable(),
        propertyName: z.string().nullable(),
        hasReceipt: z.boolean(),
        /** No bank statement or receipt attached: RRA asks for proof from the bank. Still counted. */
        needsBankProof: z.boolean(),
      }),
    ),
    needsProofCount: z.number().int(),
  }),
  /** Every other cost of the year. For a person they are for the records: the 50% covers upkeep. */
  otherExpenses: z.object({
    totalRwf: z.number().int(),
    byCategory: z.array(z.object({ category: ExpenseCategory, amountRwf: z.number().int() })),
    entries: z.array(
      z.object({
        id: Uuid,
        paidOn: CalendarDay,
        category: ExpenseCategory,
        amountRwf: z.number().int(),
        payeeName: z.string().nullable(),
        propertyName: z.string().nullable(),
      }),
    ),
  }),
  /** The person's estimate (null for a company). */
  rentalTax: z
    .object({
      grossRentRwf: z.number().int(),
      flatDeductionRwf: z.number().int(),
      loanInterestRwf: z.number().int(),
      interestDeductedRwf: z.number().int(),
      taxableIncomeRwf: z.number().int(),
      bands: z.array(RentalTaxBandView),
      taxRwf: z.number().int(),
    })
    .nullable(),
  /** The company's view: rent less every cost, and the 28% it implies (null for a person). */
  profit: z
    .object({
      rentRwf: z.number().int(),
      expensesRwf: z.number().int(),
      profitRwf: z.number().int(),
      corporateTaxRwf: z.number().int(),
    })
    .nullable(),
  /** What paying late adds, while it is past due and not declared (Art. 51). */
  lateCharges: z
    .object({
      monthsLate: z.number().int(),
      penaltyRwf: z.number().int(),
      surchargeRwf: z.number().int(),
      interestRwf: z.number().int(),
      totalRwf: z.number().int(),
    })
    .nullable(),
  declaration: TaxDeclarationView,
  /** The lease copies owed to RRA whose day falls in the year. */
  filings: z.array(LeaseFilingView),
});
export type TaxYearView = z.infer<typeof TaxYearView>;

/** The app's tax page a mail opens. */
export const TAX_APP_PATHS = {
  taxes: (year: number): string => `/taxes?year=${year}`,
  filing: (leaseId: string): string => `/leases/${encodeURIComponent(leaseId)}?tab=filing`,
} as const;
