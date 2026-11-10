import { z } from "zod";
import { LoanPurpose } from "./vocab";
export declare const ExpenseCategory: z.ZodEnum<["repairs", "utilities", "security", "cleaning", "insurance", "loan_interest", "other"]>;
export type ExpenseCategory = z.infer<typeof ExpenseCategory>;
export declare const EXPENSE_CATEGORY_LABEL: Readonly<Record<ExpenseCategory, string>>;
/** How it was paid. A payment through Injishi reads `momo` or `bank`, by where it went. */
export declare const ExpenseMethod: z.ZodEnum<["cash", "momo", "bank", "other"]>;
export type ExpenseMethod = z.infer<typeof ExpenseMethod>;
export declare const EXPENSE_METHOD_LABEL: Readonly<Record<ExpenseMethod, string>>;
/** `gateway`: paid through Injishi. `recorded`: paid outside and written down here. */
export declare const ExpenseSource: z.ZodEnum<["gateway", "recorded"]>;
export type ExpenseSource = z.infer<typeof ExpenseSource>;
export declare const EXPENSE_SOURCE_LABEL: Readonly<Record<ExpenseSource, string>>;
export declare const LOAN_PURPOSE_LABEL: Readonly<Record<LoanPurpose, string>>;
/** A receipt, a scan of a bank statement: a PDF or a photo, at most 10 MB. */
export declare const EXPENSE_RECEIPT_MAX_BYTES: number;
/** Is `year` one an expense or a tax year can be about: 2000 to this year? */
export declare function expenseYearProblem(year: number, today?: string): string | null;
/**
 * Write down an expense paid outside Injishi. Loan interest names the lender
 * and what the loan was for (only a loan to build or buy the rented property
 * lowers rental income tax); no other category has a loan purpose.
 */
export declare const RecordExpenseRequest: z.ZodEffects<z.ZodObject<{
    category: z.ZodEnum<["repairs", "utilities", "security", "cleaning", "insurance", "loan_interest", "other"]>;
    amountRwf: z.ZodNumber;
    paidOn: z.ZodEffects<z.ZodString, string, string>;
    method: z.ZodEnum<["cash", "momo", "bank", "other"]>;
    payeeName: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    payeePhone: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string | null, string>, z.ZodString>>;
    note: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    /** The building it was for; left out, the business's only building, or the whole business. */
    propertyId: z.ZodOptional<z.ZodString>;
    /** The unit it was for, when it was for one. */
    unitId: z.ZodOptional<z.ZodString>;
    loanPurpose: z.ZodOptional<z.ZodEnum<["build", "buy"]>>;
}, "strip", z.ZodTypeAny, {
    amountRwf: number;
    category: "other" | "utilities" | "cleaning" | "insurance" | "repairs" | "security" | "loan_interest";
    method: "other" | "cash" | "momo" | "bank";
    paidOn: string;
    note?: string | undefined;
    propertyId?: string | undefined;
    unitId?: string | undefined;
    payeeName?: string | undefined;
    payeePhone?: string | undefined;
    loanPurpose?: "build" | "buy" | undefined;
}, {
    amountRwf: number;
    category: "other" | "utilities" | "cleaning" | "insurance" | "repairs" | "security" | "loan_interest";
    method: "other" | "cash" | "momo" | "bank";
    paidOn: string;
    note?: string | undefined;
    propertyId?: string | undefined;
    unitId?: string | undefined;
    payeeName?: string | undefined;
    payeePhone?: string | undefined;
    loanPurpose?: "build" | "buy" | undefined;
}>, {
    amountRwf: number;
    category: "other" | "utilities" | "cleaning" | "insurance" | "repairs" | "security" | "loan_interest";
    method: "other" | "cash" | "momo" | "bank";
    paidOn: string;
    note?: string | undefined;
    propertyId?: string | undefined;
    unitId?: string | undefined;
    payeeName?: string | undefined;
    payeePhone?: string | undefined;
    loanPurpose?: "build" | "buy" | undefined;
}, {
    amountRwf: number;
    category: "other" | "utilities" | "cleaning" | "insurance" | "repairs" | "security" | "loan_interest";
    method: "other" | "cash" | "momo" | "bank";
    paidOn: string;
    note?: string | undefined;
    propertyId?: string | undefined;
    unitId?: string | undefined;
    payeeName?: string | undefined;
    payeePhone?: string | undefined;
    loanPurpose?: "build" | "buy" | undefined;
}>;
export type RecordExpenseRequest = z.infer<typeof RecordExpenseRequest>;
export declare const VoidExpenseRequest: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export type VoidExpenseRequest = z.infer<typeof VoidExpenseRequest>;
/** `GET /ops/expenses?year&propertyId&category`. The year is this one when left out. */
export declare const ExpenseListQuery: z.ZodObject<{
    year: z.ZodOptional<z.ZodNumber>;
    propertyId: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodEnum<["repairs", "utilities", "security", "cleaning", "insurance", "loan_interest", "other"]>>;
}, "strip", z.ZodTypeAny, {
    category?: "other" | "utilities" | "cleaning" | "insurance" | "repairs" | "security" | "loan_interest" | undefined;
    propertyId?: string | undefined;
    year?: number | undefined;
}, {
    category?: "other" | "utilities" | "cleaning" | "insurance" | "repairs" | "security" | "loan_interest" | undefined;
    propertyId?: string | undefined;
    year?: number | undefined;
}>;
export type ExpenseListQuery = z.infer<typeof ExpenseListQuery>;
export declare const ExpenseView: z.ZodObject<{
    id: z.ZodString;
    category: z.ZodEnum<["repairs", "utilities", "security", "cleaning", "insurance", "loan_interest", "other"]>;
    amountRwf: z.ZodNumber;
    paidOn: z.ZodEffects<z.ZodString, string, string>;
    method: z.ZodEnum<["cash", "momo", "bank", "other"]>;
    payeeName: z.ZodNullable<z.ZodString>;
    payeePhone: z.ZodNullable<z.ZodString>;
    note: z.ZodNullable<z.ZodString>;
    propertyId: z.ZodNullable<z.ZodString>;
    propertyName: z.ZodNullable<z.ZodString>;
    unitId: z.ZodNullable<z.ZodString>;
    unitLabel: z.ZodNullable<z.ZodString>;
    ticketId: z.ZodNullable<z.ZodString>;
    ticketTitle: z.ZodNullable<z.ZodString>;
    source: z.ZodEnum<["gateway", "recorded"]>;
    loanPurpose: z.ZodNullable<z.ZodEnum<["build", "buy"]>>;
    hasReceipt: z.ZodBoolean;
    receiptUrl: z.ZodNullable<z.ZodString>;
    /** Paid through Injishi: it cannot be voided. */
    canVoid: z.ZodBoolean;
    voided: z.ZodNullable<z.ZodObject<{
        at: z.ZodString;
        byName: z.ZodNullable<z.ZodString>;
        reason: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        reason: string;
        at: string;
        byName: string | null;
    }, {
        reason: string;
        at: string;
        byName: string | null;
    }>>;
    createdByName: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    amountRwf: number;
    source: "gateway" | "recorded";
    note: string | null;
    createdAt: string;
    propertyName: string | null;
    category: "other" | "utilities" | "cleaning" | "insurance" | "repairs" | "security" | "loan_interest";
    method: "other" | "cash" | "momo" | "bank";
    ticketId: string | null;
    unitLabel: string | null;
    propertyId: string | null;
    unitId: string | null;
    hasReceipt: boolean;
    paidOn: string;
    createdByName: string | null;
    payeeName: string | null;
    payeePhone: string | null;
    loanPurpose: "build" | "buy" | null;
    ticketTitle: string | null;
    receiptUrl: string | null;
    canVoid: boolean;
    voided: {
        reason: string;
        at: string;
        byName: string | null;
    } | null;
}, {
    id: string;
    amountRwf: number;
    source: "gateway" | "recorded";
    note: string | null;
    createdAt: string;
    propertyName: string | null;
    category: "other" | "utilities" | "cleaning" | "insurance" | "repairs" | "security" | "loan_interest";
    method: "other" | "cash" | "momo" | "bank";
    ticketId: string | null;
    unitLabel: string | null;
    propertyId: string | null;
    unitId: string | null;
    hasReceipt: boolean;
    paidOn: string;
    createdByName: string | null;
    payeeName: string | null;
    payeePhone: string | null;
    loanPurpose: "build" | "buy" | null;
    ticketTitle: string | null;
    receiptUrl: string | null;
    canVoid: boolean;
    voided: {
        reason: string;
        at: string;
        byName: string | null;
    } | null;
}>;
export type ExpenseView = z.infer<typeof ExpenseView>;
export declare const ExpenseTotals: z.ZodObject<{
    /** Voided rows are listed, never counted. */
    totalRwf: z.ZodNumber;
    count: z.ZodNumber;
    byCategory: z.ZodArray<z.ZodObject<{
        category: z.ZodEnum<["repairs", "utilities", "security", "cleaning", "insurance", "loan_interest", "other"]>;
        amountRwf: z.ZodNumber;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        count: number;
        amountRwf: number;
        category: "other" | "utilities" | "cleaning" | "insurance" | "repairs" | "security" | "loan_interest";
    }, {
        count: number;
        amountRwf: number;
        category: "other" | "utilities" | "cleaning" | "insurance" | "repairs" | "security" | "loan_interest";
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    count: number;
    totalRwf: number;
    byCategory: {
        count: number;
        amountRwf: number;
        category: "other" | "utilities" | "cleaning" | "insurance" | "repairs" | "security" | "loan_interest";
    }[];
}, {
    count: number;
    totalRwf: number;
    byCategory: {
        count: number;
        amountRwf: number;
        category: "other" | "utilities" | "cleaning" | "insurance" | "repairs" | "security" | "loan_interest";
    }[];
}>;
export type ExpenseTotals = z.infer<typeof ExpenseTotals>;
export declare const ExpenseList: z.ZodObject<{
    year: z.ZodNumber;
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        category: z.ZodEnum<["repairs", "utilities", "security", "cleaning", "insurance", "loan_interest", "other"]>;
        amountRwf: z.ZodNumber;
        paidOn: z.ZodEffects<z.ZodString, string, string>;
        method: z.ZodEnum<["cash", "momo", "bank", "other"]>;
        payeeName: z.ZodNullable<z.ZodString>;
        payeePhone: z.ZodNullable<z.ZodString>;
        note: z.ZodNullable<z.ZodString>;
        propertyId: z.ZodNullable<z.ZodString>;
        propertyName: z.ZodNullable<z.ZodString>;
        unitId: z.ZodNullable<z.ZodString>;
        unitLabel: z.ZodNullable<z.ZodString>;
        ticketId: z.ZodNullable<z.ZodString>;
        ticketTitle: z.ZodNullable<z.ZodString>;
        source: z.ZodEnum<["gateway", "recorded"]>;
        loanPurpose: z.ZodNullable<z.ZodEnum<["build", "buy"]>>;
        hasReceipt: z.ZodBoolean;
        receiptUrl: z.ZodNullable<z.ZodString>;
        /** Paid through Injishi: it cannot be voided. */
        canVoid: z.ZodBoolean;
        voided: z.ZodNullable<z.ZodObject<{
            at: z.ZodString;
            byName: z.ZodNullable<z.ZodString>;
            reason: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            reason: string;
            at: string;
            byName: string | null;
        }, {
            reason: string;
            at: string;
            byName: string | null;
        }>>;
        createdByName: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        amountRwf: number;
        source: "gateway" | "recorded";
        note: string | null;
        createdAt: string;
        propertyName: string | null;
        category: "other" | "utilities" | "cleaning" | "insurance" | "repairs" | "security" | "loan_interest";
        method: "other" | "cash" | "momo" | "bank";
        ticketId: string | null;
        unitLabel: string | null;
        propertyId: string | null;
        unitId: string | null;
        hasReceipt: boolean;
        paidOn: string;
        createdByName: string | null;
        payeeName: string | null;
        payeePhone: string | null;
        loanPurpose: "build" | "buy" | null;
        ticketTitle: string | null;
        receiptUrl: string | null;
        canVoid: boolean;
        voided: {
            reason: string;
            at: string;
            byName: string | null;
        } | null;
    }, {
        id: string;
        amountRwf: number;
        source: "gateway" | "recorded";
        note: string | null;
        createdAt: string;
        propertyName: string | null;
        category: "other" | "utilities" | "cleaning" | "insurance" | "repairs" | "security" | "loan_interest";
        method: "other" | "cash" | "momo" | "bank";
        ticketId: string | null;
        unitLabel: string | null;
        propertyId: string | null;
        unitId: string | null;
        hasReceipt: boolean;
        paidOn: string;
        createdByName: string | null;
        payeeName: string | null;
        payeePhone: string | null;
        loanPurpose: "build" | "buy" | null;
        ticketTitle: string | null;
        receiptUrl: string | null;
        canVoid: boolean;
        voided: {
            reason: string;
            at: string;
            byName: string | null;
        } | null;
    }>, "many">;
    totals: z.ZodObject<{
        /** Voided rows are listed, never counted. */
        totalRwf: z.ZodNumber;
        count: z.ZodNumber;
        byCategory: z.ZodArray<z.ZodObject<{
            category: z.ZodEnum<["repairs", "utilities", "security", "cleaning", "insurance", "loan_interest", "other"]>;
            amountRwf: z.ZodNumber;
            count: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            count: number;
            amountRwf: number;
            category: "other" | "utilities" | "cleaning" | "insurance" | "repairs" | "security" | "loan_interest";
        }, {
            count: number;
            amountRwf: number;
            category: "other" | "utilities" | "cleaning" | "insurance" | "repairs" | "security" | "loan_interest";
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        count: number;
        totalRwf: number;
        byCategory: {
            count: number;
            amountRwf: number;
            category: "other" | "utilities" | "cleaning" | "insurance" | "repairs" | "security" | "loan_interest";
        }[];
    }, {
        count: number;
        totalRwf: number;
        byCategory: {
            count: number;
            amountRwf: number;
            category: "other" | "utilities" | "cleaning" | "insurance" | "repairs" | "security" | "loan_interest";
        }[];
    }>;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        amountRwf: number;
        source: "gateway" | "recorded";
        note: string | null;
        createdAt: string;
        propertyName: string | null;
        category: "other" | "utilities" | "cleaning" | "insurance" | "repairs" | "security" | "loan_interest";
        method: "other" | "cash" | "momo" | "bank";
        ticketId: string | null;
        unitLabel: string | null;
        propertyId: string | null;
        unitId: string | null;
        hasReceipt: boolean;
        paidOn: string;
        createdByName: string | null;
        payeeName: string | null;
        payeePhone: string | null;
        loanPurpose: "build" | "buy" | null;
        ticketTitle: string | null;
        receiptUrl: string | null;
        canVoid: boolean;
        voided: {
            reason: string;
            at: string;
            byName: string | null;
        } | null;
    }[];
    totals: {
        count: number;
        totalRwf: number;
        byCategory: {
            count: number;
            amountRwf: number;
            category: "other" | "utilities" | "cleaning" | "insurance" | "repairs" | "security" | "loan_interest";
        }[];
    };
    year: number;
}, {
    items: {
        id: string;
        amountRwf: number;
        source: "gateway" | "recorded";
        note: string | null;
        createdAt: string;
        propertyName: string | null;
        category: "other" | "utilities" | "cleaning" | "insurance" | "repairs" | "security" | "loan_interest";
        method: "other" | "cash" | "momo" | "bank";
        ticketId: string | null;
        unitLabel: string | null;
        propertyId: string | null;
        unitId: string | null;
        hasReceipt: boolean;
        paidOn: string;
        createdByName: string | null;
        payeeName: string | null;
        payeePhone: string | null;
        loanPurpose: "build" | "buy" | null;
        ticketTitle: string | null;
        receiptUrl: string | null;
        canVoid: boolean;
        voided: {
            reason: string;
            at: string;
            byName: string | null;
        } | null;
    }[];
    totals: {
        count: number;
        totalRwf: number;
        byCategory: {
            count: number;
            amountRwf: number;
            category: "other" | "utilities" | "cleaning" | "insurance" | "repairs" | "security" | "loan_interest";
        }[];
    };
    year: number;
}>;
export type ExpenseList = z.infer<typeof ExpenseList>;
/** The smallest and largest one payment to a fixer through Injishi may be. */
export declare const FIXER_PAYMENT_MIN_RWF = 100;
export declare const FIXER_PAYMENT_MAX_RWF = 10000000;
/**
 * Pay the fixer through Injishi. The gateway sends a prompt to the
 * landlord's own phone; once they approve it, the money goes to the fixer's
 * MoMo, Airtel Money or bank account, and the payment becomes a repairs
 * expense. Sent with an `Idempotency-Key`: a second press is the same payment.
 */
export declare const PayFixerRequest: z.ZodObject<{
    amountRwf: z.ZodNumber;
    payeeName: z.ZodString;
    payee: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
        kind: z.ZodLiteral<"momo">;
        phone: z.ZodPipeline<z.ZodEffects<z.ZodString, string | null, string>, z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "momo";
        phone: string;
    }, {
        kind: "momo";
        phone: string;
    }>, z.ZodObject<{
        kind: z.ZodLiteral<"bank">;
        bankName: z.ZodEnum<["Bank of Kigali", "BPR Bank Rwanda", "I&M Bank Rwanda", "Equity Bank Rwanda", "Access Bank Rwanda", "Ecobank Rwanda", "NCBA Bank Rwanda", "Guaranty Trust Bank Rwanda", "Cogebanque", "Urwego Bank", "Development Bank of Rwanda", "Zigama CSS", "Other"]>;
        accountNumber: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "bank";
        bankName: "Other" | "Bank of Kigali" | "BPR Bank Rwanda" | "I&M Bank Rwanda" | "Equity Bank Rwanda" | "Access Bank Rwanda" | "Ecobank Rwanda" | "NCBA Bank Rwanda" | "Guaranty Trust Bank Rwanda" | "Cogebanque" | "Urwego Bank" | "Development Bank of Rwanda" | "Zigama CSS";
        accountNumber: string;
    }, {
        kind: "bank";
        bankName: "Other" | "Bank of Kigali" | "BPR Bank Rwanda" | "I&M Bank Rwanda" | "Equity Bank Rwanda" | "Access Bank Rwanda" | "Ecobank Rwanda" | "NCBA Bank Rwanda" | "Guaranty Trust Bank Rwanda" | "Cogebanque" | "Urwego Bank" | "Development Bank of Rwanda" | "Zigama CSS";
        accountNumber: string;
    }>]>;
    /** The landlord's own MTN or Airtel number, which the prompt goes to. */
    payerPhone: z.ZodPipeline<z.ZodEffects<z.ZodString, string | null, string>, z.ZodString>;
    note: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
}, "strip", z.ZodTypeAny, {
    amountRwf: number;
    payerPhone: string;
    payeeName: string;
    payee: {
        kind: "momo";
        phone: string;
    } | {
        kind: "bank";
        bankName: "Other" | "Bank of Kigali" | "BPR Bank Rwanda" | "I&M Bank Rwanda" | "Equity Bank Rwanda" | "Access Bank Rwanda" | "Ecobank Rwanda" | "NCBA Bank Rwanda" | "Guaranty Trust Bank Rwanda" | "Cogebanque" | "Urwego Bank" | "Development Bank of Rwanda" | "Zigama CSS";
        accountNumber: string;
    };
    note?: string | undefined;
}, {
    amountRwf: number;
    payerPhone: string;
    payeeName: string;
    payee: {
        kind: "momo";
        phone: string;
    } | {
        kind: "bank";
        bankName: "Other" | "Bank of Kigali" | "BPR Bank Rwanda" | "I&M Bank Rwanda" | "Equity Bank Rwanda" | "Access Bank Rwanda" | "Ecobank Rwanda" | "NCBA Bank Rwanda" | "Guaranty Trust Bank Rwanda" | "Cogebanque" | "Urwego Bank" | "Development Bank of Rwanda" | "Zigama CSS";
        accountNumber: string;
    };
    note?: string | undefined;
}>;
export type PayFixerRequest = z.infer<typeof PayFixerRequest>;
/**
 * Write down that the fixer was paid outside Injishi (cash, a transfer). It
 * becomes a repairs expense. The day is from the day the fault was reported
 * to today in Kigali; the service checks the first, the schema the second.
 */
export declare const RecordFaultPaymentRequest: z.ZodObject<{
    amountRwf: z.ZodNumber;
    paidOn: z.ZodEffects<z.ZodString, string, string>;
    method: z.ZodEnum<["cash", "momo", "bank", "other"]>;
    payeeName: z.ZodString;
    payeePhone: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string | null, string>, z.ZodString>>;
    note: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
}, "strip", z.ZodTypeAny, {
    amountRwf: number;
    method: "other" | "cash" | "momo" | "bank";
    paidOn: string;
    payeeName: string;
    note?: string | undefined;
    payeePhone?: string | undefined;
}, {
    amountRwf: number;
    method: "other" | "cash" | "momo" | "bank";
    paidOn: string;
    payeeName: string;
    note?: string | undefined;
    payeePhone?: string | undefined;
}>;
export type RecordFaultPaymentRequest = z.infer<typeof RecordFaultPaymentRequest>;
/** Why a fault payment's day is not acceptable, or null: from the report day to today. */
export declare function faultPaymentDateProblem(paidOn: string, reportedOn: string, today?: string): string | null;
/**
 * `waiting`: the prompt is on the landlord's phone. `paid`: the fixer has it.
 * `failed`: nothing moved. `voided`: a recorded payment struck out.
 */
export declare const FaultPaymentStatus: z.ZodEnum<["waiting", "paid", "failed", "voided"]>;
export type FaultPaymentStatus = z.infer<typeof FaultPaymentStatus>;
export declare const FAULT_PAYMENT_STATUS_LABEL: Readonly<Record<FaultPaymentStatus, string>>;
/** A payment for a fault's fix, as the landlord's panel shows it. */
export declare const FaultPaymentView: z.ZodObject<{
    id: z.ZodString;
    source: z.ZodEnum<["gateway", "recorded"]>;
    status: z.ZodEnum<["waiting", "paid", "failed", "voided"]>;
    amountRwf: z.ZodNumber;
    payeeName: z.ZodNullable<z.ZodString>;
    /** Where it went, masked, for a payment through Injishi. */
    destination: z.ZodNullable<z.ZodString>;
    method: z.ZodNullable<z.ZodEnum<["cash", "momo", "bank", "other"]>>;
    paidOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
    failureReason: z.ZodNullable<z.ZodString>;
    expenseId: z.ZodNullable<z.ZodString>;
    receiptUrl: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "failed" | "waiting" | "paid" | "voided";
    id: string;
    amountRwf: number;
    failureReason: string | null;
    source: "gateway" | "recorded";
    createdAt: string;
    method: "other" | "cash" | "momo" | "bank" | null;
    paidOn: string | null;
    destination: string | null;
    payeeName: string | null;
    receiptUrl: string | null;
    expenseId: string | null;
}, {
    status: "failed" | "waiting" | "paid" | "voided";
    id: string;
    amountRwf: number;
    failureReason: string | null;
    source: "gateway" | "recorded";
    createdAt: string;
    method: "other" | "cash" | "momo" | "bank" | null;
    paidOn: string | null;
    destination: string | null;
    payeeName: string | null;
    receiptUrl: string | null;
    expenseId: string | null;
}>;
export type FaultPaymentView = z.infer<typeof FaultPaymentView>;
//# sourceMappingURL=expenses.d.ts.map