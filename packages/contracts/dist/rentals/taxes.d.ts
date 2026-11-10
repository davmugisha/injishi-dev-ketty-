import { z } from "zod";
/** The first year the tax page can show. */
export declare const TAX_YEAR_MIN = 2020;
/** Why `year` is not a tax year the page can show, or null: 2020 to this year. */
export declare function taxYearProblem(year: number, today?: string): string | null;
/** The years a landlord can pick, newest first. */
export declare function taxYears(today?: string): number[];
/** Has `year` ended, so it can be declared? */
export declare function taxYearEnded(year: number, today?: string): boolean;
/** `GET /ops/taxes/:year`. */
export declare const TaxYearParam: z.ZodNumber;
/** Where a year's declaration stands. Late is worked out, never stored. */
export declare const TaxDeclarationStatus: z.ZodEnum<["not_started", "declared", "paid"]>;
export type TaxDeclarationStatus = z.infer<typeof TaxDeclarationStatus>;
export declare const TAX_DECLARATION_STATUS_LABEL: Readonly<Record<TaxDeclarationStatus, string>>;
/** The most a tax payment can be recorded as. */
export declare const MAX_TAX_PAID_RWF = 2000000000;
/** RRA's receipt: a PDF or a photo, at most 10 MB. */
export declare const TAX_RECEIPT_MAX_BYTES: number;
/**
 * Why a declaration or payment day is not acceptable, or null: a real day,
 * not after today in Kigali, not before the year it is for has ended, and
 * (for a payment) not before the declaration.
 */
export declare function declarationDateProblem(v: string, year: number, opts?: {
    today?: string;
    notBefore?: string | null;
}): string | null;
/** `PUT /ops/taxes/taxpayer`: does the landlord let as a person or a company? */
export declare const SetTaxpayerRequest: z.ZodObject<{
    kind: z.ZodEnum<["individual", "company"]>;
}, "strip", z.ZodTypeAny, {
    kind: "individual" | "company";
}, {
    kind: "individual" | "company";
}>;
export type SetTaxpayerRequest = z.infer<typeof SetTaxpayerRequest>;
export declare const TaxpayerView: z.ZodObject<{
    kind: z.ZodNullable<z.ZodEnum<["individual", "company"]>>;
}, "strip", z.ZodTypeAny, {
    kind: "individual" | "company" | null;
}, {
    kind: "individual" | "company" | null;
}>;
export type TaxpayerView = z.infer<typeof TaxpayerView>;
/**
 * `PUT /ops/taxes/:year/declaration`: where the declaration stands, as the
 * landlord tells it (they declare and pay on RRA's own portal). The receipt
 * comes as a file (`receipt`) beside these fields.
 */
export declare const UpdateTaxDeclarationRequest: z.ZodEffects<z.ZodObject<{
    status: z.ZodEnum<["not_started", "declared", "paid"]>;
    declaredOn: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    paidOn: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    amountPaidRwf: z.ZodOptional<z.ZodNumber>;
    rraReference: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
}, "strip", z.ZodTypeAny, {
    status: "paid" | "not_started" | "declared";
    paidOn?: string | undefined;
    declaredOn?: string | undefined;
    amountPaidRwf?: number | undefined;
    rraReference?: string | undefined;
}, {
    status: "paid" | "not_started" | "declared";
    paidOn?: string | undefined;
    declaredOn?: string | undefined;
    amountPaidRwf?: number | undefined;
    rraReference?: string | undefined;
}>, {
    status: "paid" | "not_started" | "declared";
    paidOn?: string | undefined;
    declaredOn?: string | undefined;
    amountPaidRwf?: number | undefined;
    rraReference?: string | undefined;
}, {
    status: "paid" | "not_started" | "declared";
    paidOn?: string | undefined;
    declaredOn?: string | undefined;
    amountPaidRwf?: number | undefined;
    rraReference?: string | undefined;
}>;
export type UpdateTaxDeclarationRequest = z.infer<typeof UpdateTaxDeclarationRequest>;
export declare const TaxDeclarationView: z.ZodObject<{
    status: z.ZodEnum<["not_started", "declared", "paid"]>;
    declaredOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
    paidOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
    amountPaidRwf: z.ZodNullable<z.ZodNumber>;
    rraReference: z.ZodNullable<z.ZodString>;
    /** A short-lived link to RRA's receipt, when one was attached. */
    receiptUrl: z.ZodNullable<z.ZodString>;
    updatedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "paid" | "not_started" | "declared";
    updatedAt: string | null;
    paidOn: string | null;
    receiptUrl: string | null;
    declaredOn: string | null;
    amountPaidRwf: number | null;
    rraReference: string | null;
}, {
    status: "paid" | "not_started" | "declared";
    updatedAt: string | null;
    paidOn: string | null;
    receiptUrl: string | null;
    declaredOn: string | null;
    amountPaidRwf: number | null;
    rraReference: string | null;
}>;
export type TaxDeclarationView = z.infer<typeof TaxDeclarationView>;
/** Why a filing day is not acceptable, or null: from the day it could be filed (signing) to today. */
export declare function leaseFilingDateProblem(v: string, notBefore: string, today?: string): string | null;
/** `POST /ops/filings/:id/filed`: the landlord gave RRA the copy. The proof comes as a file (`proof`). */
export declare const MarkFilingFiledRequest: z.ZodObject<{
    filedOn: z.ZodEffects<z.ZodString, string, string>;
    reference: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
}, "strip", z.ZodTypeAny, {
    filedOn: string;
    reference?: string | undefined;
}, {
    filedOn: string;
    reference?: string | undefined;
}>;
export type MarkFilingFiledRequest = z.infer<typeof MarkFilingFiledRequest>;
/** The proof RRA gives: a PDF or a photo, at most 10 MB. */
export declare const FILING_PROOF_MAX_BYTES: number;
export declare const LeaseFilingView: z.ZodObject<{
    id: z.ZodString;
    leaseId: z.ZodString;
    leaseReference: z.ZodString;
    tenantName: z.ZodString;
    unitLabel: z.ZodString;
    propertyName: z.ZodString;
    kind: z.ZodEnum<["new_lease", "change", "termination"]>;
    /** The Kigali day the lease was signed by both, for a new lease. */
    signedOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
    dueOn: z.ZodEffects<z.ZodString, string, string>;
    status: z.ZodEnum<["pending", "filed"]>;
    /** Due and not filed by its day. Worked out, never stored. */
    late: z.ZodBoolean;
    /** Days left to file it, while it is due; negative once late. */
    daysLeft: z.ZodNullable<z.ZodNumber>;
    filedOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
    reference: z.ZodNullable<z.ZodString>;
    proofUrl: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "filed";
    id: string;
    kind: "new_lease" | "change" | "termination";
    reference: string | null;
    propertyName: string;
    leaseId: string;
    unitLabel: string;
    tenantName: string;
    dueOn: string;
    late: boolean;
    filedOn: string | null;
    daysLeft: number | null;
    leaseReference: string;
    signedOn: string | null;
    proofUrl: string | null;
}, {
    status: "pending" | "filed";
    id: string;
    kind: "new_lease" | "change" | "termination";
    reference: string | null;
    propertyName: string;
    leaseId: string;
    unitLabel: string;
    tenantName: string;
    dueOn: string;
    late: boolean;
    filedOn: string | null;
    daysLeft: number | null;
    leaseReference: string;
    signedOn: string | null;
    proofUrl: string | null;
}>;
export type LeaseFilingView = z.infer<typeof LeaseFilingView>;
/** `GET /ops/filings?year&status`. No year: every filing still due, and this year's. */
export declare const LeaseFilingsQuery: z.ZodObject<{
    year: z.ZodOptional<z.ZodNumber>;
    status: z.ZodOptional<z.ZodEnum<["pending", "filed"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "pending" | "filed" | undefined;
    year?: number | undefined;
}, {
    status?: "pending" | "filed" | undefined;
    year?: number | undefined;
}>;
export type LeaseFilingsQuery = z.infer<typeof LeaseFilingsQuery>;
export declare const LeaseFilingList: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        leaseId: z.ZodString;
        leaseReference: z.ZodString;
        tenantName: z.ZodString;
        unitLabel: z.ZodString;
        propertyName: z.ZodString;
        kind: z.ZodEnum<["new_lease", "change", "termination"]>;
        /** The Kigali day the lease was signed by both, for a new lease. */
        signedOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
        dueOn: z.ZodEffects<z.ZodString, string, string>;
        status: z.ZodEnum<["pending", "filed"]>;
        /** Due and not filed by its day. Worked out, never stored. */
        late: z.ZodBoolean;
        /** Days left to file it, while it is due; negative once late. */
        daysLeft: z.ZodNullable<z.ZodNumber>;
        filedOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
        reference: z.ZodNullable<z.ZodString>;
        proofUrl: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "filed";
        id: string;
        kind: "new_lease" | "change" | "termination";
        reference: string | null;
        propertyName: string;
        leaseId: string;
        unitLabel: string;
        tenantName: string;
        dueOn: string;
        late: boolean;
        filedOn: string | null;
        daysLeft: number | null;
        leaseReference: string;
        signedOn: string | null;
        proofUrl: string | null;
    }, {
        status: "pending" | "filed";
        id: string;
        kind: "new_lease" | "change" | "termination";
        reference: string | null;
        propertyName: string;
        leaseId: string;
        unitLabel: string;
        tenantName: string;
        dueOn: string;
        late: boolean;
        filedOn: string | null;
        daysLeft: number | null;
        leaseReference: string;
        signedOn: string | null;
        proofUrl: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    items: {
        status: "pending" | "filed";
        id: string;
        kind: "new_lease" | "change" | "termination";
        reference: string | null;
        propertyName: string;
        leaseId: string;
        unitLabel: string;
        tenantName: string;
        dueOn: string;
        late: boolean;
        filedOn: string | null;
        daysLeft: number | null;
        leaseReference: string;
        signedOn: string | null;
        proofUrl: string | null;
    }[];
}, {
    items: {
        status: "pending" | "filed";
        id: string;
        kind: "new_lease" | "change" | "termination";
        reference: string | null;
        propertyName: string;
        leaseId: string;
        unitLabel: string;
        tenantName: string;
        dueOn: string;
        late: boolean;
        filedOn: string | null;
        daysLeft: number | null;
        leaseReference: string;
        signedOn: string | null;
        proofUrl: string | null;
    }[];
}>;
export type LeaseFilingList = z.infer<typeof LeaseFilingList>;
export declare const TaxYearView: z.ZodObject<{
    year: z.ZodNumber;
    /** Today in Kigali. When `year` is this year, every figure is "so far". */
    asOf: z.ZodEffects<z.ZodString, string, string>;
    running: z.ZodBoolean;
    /** Null until the landlord says whether they let as a person or a company. */
    taxpayer: z.ZodNullable<z.ZodEnum<["individual", "company"]>>;
    /** 31 January of the next year. */
    dueOn: z.ZodEffects<z.ZodString, string, string>;
    /** The year has ended, the landlord is not a company: the declaration can be marked. */
    canDeclare: z.ZodBoolean;
    rent: z.ZodObject<{
        /** Rent received: succeeded payments, by the day they were received, less any part that paid a deposit. */
        totalRwf: z.ZodNumber;
        gatewayRwf: z.ZodNumber;
        recordedRwf: z.ZodNumber;
        paymentCount: z.ZodNumber;
        /** What came in for deposits that year: held for the tenant, never rent, left out above. */
        depositsExcludedRwf: z.ZodNumber;
        /** Twelve months, January first, `yyyy-mm`. */
        months: z.ZodArray<z.ZodObject<{
            month: z.ZodString;
            amountRwf: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            amountRwf: number;
            month: string;
        }, {
            amountRwf: number;
            month: string;
        }>, "many">;
        properties: z.ZodArray<z.ZodObject<{
            propertyId: z.ZodString;
            name: z.ZodString;
            amountRwf: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            name: string;
            amountRwf: number;
            propertyId: string;
        }, {
            name: string;
            amountRwf: number;
            propertyId: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        totalRwf: number;
        months: {
            amountRwf: number;
            month: string;
        }[];
        properties: {
            name: string;
            amountRwf: number;
            propertyId: string;
        }[];
        gatewayRwf: number;
        recordedRwf: number;
        paymentCount: number;
        depositsExcludedRwf: number;
    }, {
        totalRwf: number;
        months: {
            amountRwf: number;
            month: string;
        }[];
        properties: {
            name: string;
            amountRwf: number;
            propertyId: string;
        }[];
        gatewayRwf: number;
        recordedRwf: number;
        paymentCount: number;
        depositsExcludedRwf: number;
    }>;
    interest: z.ZodObject<{
        /** Interest on loans to build or buy the rented property, not voided: what lowers the tax. */
        deductibleRwf: z.ZodNumber;
        entries: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            paidOn: z.ZodEffects<z.ZodString, string, string>;
            lender: z.ZodNullable<z.ZodString>;
            amountRwf: z.ZodNumber;
            loanPurpose: z.ZodNullable<z.ZodEnum<["build", "buy"]>>;
            propertyName: z.ZodNullable<z.ZodString>;
            hasReceipt: z.ZodBoolean;
            /** No bank statement or receipt attached: RRA asks for proof from the bank. Still counted. */
            needsBankProof: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            id: string;
            amountRwf: number;
            propertyName: string | null;
            hasReceipt: boolean;
            paidOn: string;
            loanPurpose: "build" | "buy" | null;
            lender: string | null;
            needsBankProof: boolean;
        }, {
            id: string;
            amountRwf: number;
            propertyName: string | null;
            hasReceipt: boolean;
            paidOn: string;
            loanPurpose: "build" | "buy" | null;
            lender: string | null;
            needsBankProof: boolean;
        }>, "many">;
        needsProofCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        entries: {
            id: string;
            amountRwf: number;
            propertyName: string | null;
            hasReceipt: boolean;
            paidOn: string;
            loanPurpose: "build" | "buy" | null;
            lender: string | null;
            needsBankProof: boolean;
        }[];
        deductibleRwf: number;
        needsProofCount: number;
    }, {
        entries: {
            id: string;
            amountRwf: number;
            propertyName: string | null;
            hasReceipt: boolean;
            paidOn: string;
            loanPurpose: "build" | "buy" | null;
            lender: string | null;
            needsBankProof: boolean;
        }[];
        deductibleRwf: number;
        needsProofCount: number;
    }>;
    /** Every other cost of the year. For a person they are for the records: the 50% covers upkeep. */
    otherExpenses: z.ZodObject<{
        totalRwf: z.ZodNumber;
        byCategory: z.ZodArray<z.ZodObject<{
            category: z.ZodEnum<["repairs", "utilities", "security", "cleaning", "insurance", "loan_interest", "other"]>;
            amountRwf: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            amountRwf: number;
            category: "other" | "utilities" | "cleaning" | "repairs" | "security" | "insurance" | "loan_interest";
        }, {
            amountRwf: number;
            category: "other" | "utilities" | "cleaning" | "repairs" | "security" | "insurance" | "loan_interest";
        }>, "many">;
        entries: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            paidOn: z.ZodEffects<z.ZodString, string, string>;
            category: z.ZodEnum<["repairs", "utilities", "security", "cleaning", "insurance", "loan_interest", "other"]>;
            amountRwf: z.ZodNumber;
            payeeName: z.ZodNullable<z.ZodString>;
            propertyName: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            amountRwf: number;
            propertyName: string | null;
            category: "other" | "utilities" | "cleaning" | "repairs" | "security" | "insurance" | "loan_interest";
            paidOn: string;
            payeeName: string | null;
        }, {
            id: string;
            amountRwf: number;
            propertyName: string | null;
            category: "other" | "utilities" | "cleaning" | "repairs" | "security" | "insurance" | "loan_interest";
            paidOn: string;
            payeeName: string | null;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        entries: {
            id: string;
            amountRwf: number;
            propertyName: string | null;
            category: "other" | "utilities" | "cleaning" | "repairs" | "security" | "insurance" | "loan_interest";
            paidOn: string;
            payeeName: string | null;
        }[];
        totalRwf: number;
        byCategory: {
            amountRwf: number;
            category: "other" | "utilities" | "cleaning" | "repairs" | "security" | "insurance" | "loan_interest";
        }[];
    }, {
        entries: {
            id: string;
            amountRwf: number;
            propertyName: string | null;
            category: "other" | "utilities" | "cleaning" | "repairs" | "security" | "insurance" | "loan_interest";
            paidOn: string;
            payeeName: string | null;
        }[];
        totalRwf: number;
        byCategory: {
            amountRwf: number;
            category: "other" | "utilities" | "cleaning" | "repairs" | "security" | "insurance" | "loan_interest";
        }[];
    }>;
    /** The person's estimate (null for a company). */
    rentalTax: z.ZodNullable<z.ZodObject<{
        grossRentRwf: z.ZodNumber;
        flatDeductionRwf: z.ZodNumber;
        loanInterestRwf: z.ZodNumber;
        interestDeductedRwf: z.ZodNumber;
        taxableIncomeRwf: z.ZodNumber;
        bands: z.ZodArray<z.ZodObject<{
            fromRwf: z.ZodNumber;
            toRwf: z.ZodNullable<z.ZodNumber>;
            ratePercent: z.ZodNumber;
            incomeRwf: z.ZodNumber;
            taxRwf: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            taxRwf: number;
            fromRwf: number;
            ratePercent: number;
            toRwf: number | null;
            incomeRwf: number;
        }, {
            taxRwf: number;
            fromRwf: number;
            ratePercent: number;
            toRwf: number | null;
            incomeRwf: number;
        }>, "many">;
        taxRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        taxRwf: number;
        grossRentRwf: number;
        flatDeductionRwf: number;
        loanInterestRwf: number;
        interestDeductedRwf: number;
        taxableIncomeRwf: number;
        bands: {
            taxRwf: number;
            fromRwf: number;
            ratePercent: number;
            toRwf: number | null;
            incomeRwf: number;
        }[];
    }, {
        taxRwf: number;
        grossRentRwf: number;
        flatDeductionRwf: number;
        loanInterestRwf: number;
        interestDeductedRwf: number;
        taxableIncomeRwf: number;
        bands: {
            taxRwf: number;
            fromRwf: number;
            ratePercent: number;
            toRwf: number | null;
            incomeRwf: number;
        }[];
    }>>;
    /** The company's view: rent less every cost, and the 28% it implies (null for a person). */
    profit: z.ZodNullable<z.ZodObject<{
        rentRwf: z.ZodNumber;
        expensesRwf: z.ZodNumber;
        profitRwf: z.ZodNumber;
        corporateTaxRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        rentRwf: number;
        expensesRwf: number;
        profitRwf: number;
        corporateTaxRwf: number;
    }, {
        rentRwf: number;
        expensesRwf: number;
        profitRwf: number;
        corporateTaxRwf: number;
    }>>;
    /** What paying late adds, while it is past due and not declared (Art. 51). */
    lateCharges: z.ZodNullable<z.ZodObject<{
        monthsLate: z.ZodNumber;
        penaltyRwf: z.ZodNumber;
        surchargeRwf: z.ZodNumber;
        interestRwf: z.ZodNumber;
        totalRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        totalRwf: number;
        monthsLate: number;
        penaltyRwf: number;
        surchargeRwf: number;
        interestRwf: number;
    }, {
        totalRwf: number;
        monthsLate: number;
        penaltyRwf: number;
        surchargeRwf: number;
        interestRwf: number;
    }>>;
    declaration: z.ZodObject<{
        status: z.ZodEnum<["not_started", "declared", "paid"]>;
        declaredOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
        paidOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
        amountPaidRwf: z.ZodNullable<z.ZodNumber>;
        rraReference: z.ZodNullable<z.ZodString>;
        /** A short-lived link to RRA's receipt, when one was attached. */
        receiptUrl: z.ZodNullable<z.ZodString>;
        updatedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "paid" | "not_started" | "declared";
        updatedAt: string | null;
        paidOn: string | null;
        receiptUrl: string | null;
        declaredOn: string | null;
        amountPaidRwf: number | null;
        rraReference: string | null;
    }, {
        status: "paid" | "not_started" | "declared";
        updatedAt: string | null;
        paidOn: string | null;
        receiptUrl: string | null;
        declaredOn: string | null;
        amountPaidRwf: number | null;
        rraReference: string | null;
    }>;
    /** The lease copies owed to RRA whose day falls in the year. */
    filings: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        leaseId: z.ZodString;
        leaseReference: z.ZodString;
        tenantName: z.ZodString;
        unitLabel: z.ZodString;
        propertyName: z.ZodString;
        kind: z.ZodEnum<["new_lease", "change", "termination"]>;
        /** The Kigali day the lease was signed by both, for a new lease. */
        signedOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
        dueOn: z.ZodEffects<z.ZodString, string, string>;
        status: z.ZodEnum<["pending", "filed"]>;
        /** Due and not filed by its day. Worked out, never stored. */
        late: z.ZodBoolean;
        /** Days left to file it, while it is due; negative once late. */
        daysLeft: z.ZodNullable<z.ZodNumber>;
        filedOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
        reference: z.ZodNullable<z.ZodString>;
        proofUrl: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "filed";
        id: string;
        kind: "new_lease" | "change" | "termination";
        reference: string | null;
        propertyName: string;
        leaseId: string;
        unitLabel: string;
        tenantName: string;
        dueOn: string;
        late: boolean;
        filedOn: string | null;
        daysLeft: number | null;
        leaseReference: string;
        signedOn: string | null;
        proofUrl: string | null;
    }, {
        status: "pending" | "filed";
        id: string;
        kind: "new_lease" | "change" | "termination";
        reference: string | null;
        propertyName: string;
        leaseId: string;
        unitLabel: string;
        tenantName: string;
        dueOn: string;
        late: boolean;
        filedOn: string | null;
        daysLeft: number | null;
        leaseReference: string;
        signedOn: string | null;
        proofUrl: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    filings: {
        status: "pending" | "filed";
        id: string;
        kind: "new_lease" | "change" | "termination";
        reference: string | null;
        propertyName: string;
        leaseId: string;
        unitLabel: string;
        tenantName: string;
        dueOn: string;
        late: boolean;
        filedOn: string | null;
        daysLeft: number | null;
        leaseReference: string;
        signedOn: string | null;
        proofUrl: string | null;
    }[];
    declaration: {
        status: "paid" | "not_started" | "declared";
        updatedAt: string | null;
        paidOn: string | null;
        receiptUrl: string | null;
        declaredOn: string | null;
        amountPaidRwf: number | null;
        rraReference: string | null;
    };
    rent: {
        totalRwf: number;
        months: {
            amountRwf: number;
            month: string;
        }[];
        properties: {
            name: string;
            amountRwf: number;
            propertyId: string;
        }[];
        gatewayRwf: number;
        recordedRwf: number;
        paymentCount: number;
        depositsExcludedRwf: number;
    };
    dueOn: string;
    running: boolean;
    year: number;
    asOf: string;
    taxpayer: "individual" | "company" | null;
    canDeclare: boolean;
    interest: {
        entries: {
            id: string;
            amountRwf: number;
            propertyName: string | null;
            hasReceipt: boolean;
            paidOn: string;
            loanPurpose: "build" | "buy" | null;
            lender: string | null;
            needsBankProof: boolean;
        }[];
        deductibleRwf: number;
        needsProofCount: number;
    };
    otherExpenses: {
        entries: {
            id: string;
            amountRwf: number;
            propertyName: string | null;
            category: "other" | "utilities" | "cleaning" | "repairs" | "security" | "insurance" | "loan_interest";
            paidOn: string;
            payeeName: string | null;
        }[];
        totalRwf: number;
        byCategory: {
            amountRwf: number;
            category: "other" | "utilities" | "cleaning" | "repairs" | "security" | "insurance" | "loan_interest";
        }[];
    };
    rentalTax: {
        taxRwf: number;
        grossRentRwf: number;
        flatDeductionRwf: number;
        loanInterestRwf: number;
        interestDeductedRwf: number;
        taxableIncomeRwf: number;
        bands: {
            taxRwf: number;
            fromRwf: number;
            ratePercent: number;
            toRwf: number | null;
            incomeRwf: number;
        }[];
    } | null;
    profit: {
        rentRwf: number;
        expensesRwf: number;
        profitRwf: number;
        corporateTaxRwf: number;
    } | null;
    lateCharges: {
        totalRwf: number;
        monthsLate: number;
        penaltyRwf: number;
        surchargeRwf: number;
        interestRwf: number;
    } | null;
}, {
    filings: {
        status: "pending" | "filed";
        id: string;
        kind: "new_lease" | "change" | "termination";
        reference: string | null;
        propertyName: string;
        leaseId: string;
        unitLabel: string;
        tenantName: string;
        dueOn: string;
        late: boolean;
        filedOn: string | null;
        daysLeft: number | null;
        leaseReference: string;
        signedOn: string | null;
        proofUrl: string | null;
    }[];
    declaration: {
        status: "paid" | "not_started" | "declared";
        updatedAt: string | null;
        paidOn: string | null;
        receiptUrl: string | null;
        declaredOn: string | null;
        amountPaidRwf: number | null;
        rraReference: string | null;
    };
    rent: {
        totalRwf: number;
        months: {
            amountRwf: number;
            month: string;
        }[];
        properties: {
            name: string;
            amountRwf: number;
            propertyId: string;
        }[];
        gatewayRwf: number;
        recordedRwf: number;
        paymentCount: number;
        depositsExcludedRwf: number;
    };
    dueOn: string;
    running: boolean;
    year: number;
    asOf: string;
    taxpayer: "individual" | "company" | null;
    canDeclare: boolean;
    interest: {
        entries: {
            id: string;
            amountRwf: number;
            propertyName: string | null;
            hasReceipt: boolean;
            paidOn: string;
            loanPurpose: "build" | "buy" | null;
            lender: string | null;
            needsBankProof: boolean;
        }[];
        deductibleRwf: number;
        needsProofCount: number;
    };
    otherExpenses: {
        entries: {
            id: string;
            amountRwf: number;
            propertyName: string | null;
            category: "other" | "utilities" | "cleaning" | "repairs" | "security" | "insurance" | "loan_interest";
            paidOn: string;
            payeeName: string | null;
        }[];
        totalRwf: number;
        byCategory: {
            amountRwf: number;
            category: "other" | "utilities" | "cleaning" | "repairs" | "security" | "insurance" | "loan_interest";
        }[];
    };
    rentalTax: {
        taxRwf: number;
        grossRentRwf: number;
        flatDeductionRwf: number;
        loanInterestRwf: number;
        interestDeductedRwf: number;
        taxableIncomeRwf: number;
        bands: {
            taxRwf: number;
            fromRwf: number;
            ratePercent: number;
            toRwf: number | null;
            incomeRwf: number;
        }[];
    } | null;
    profit: {
        rentRwf: number;
        expensesRwf: number;
        profitRwf: number;
        corporateTaxRwf: number;
    } | null;
    lateCharges: {
        totalRwf: number;
        monthsLate: number;
        penaltyRwf: number;
        surchargeRwf: number;
        interestRwf: number;
    } | null;
}>;
export type TaxYearView = z.infer<typeof TaxYearView>;
/** The app's tax page a mail opens. */
export declare const TAX_APP_PATHS: {
    readonly taxes: (year: number) => string;
    readonly filing: (leaseId: string) => string;
};
//# sourceMappingURL=taxes.d.ts.map