import { z } from "zod";
import { type LeaseFilingKind, type LoanPurpose, MomoNetwork, type PayoutAccountKind } from "./vocab";
/** The flat deduction for upkeep, as a percentage of the rent received. */
export declare const RENTAL_TAX_FLAT_DEDUCTION_PERCENT = 50;
/** The bands, on the year's taxable rental income. Each rate applies only to the part inside its band. */
export declare const RENTAL_TAX_BANDS: readonly {
    fromRwf: number;
    toRwf: number | null;
    ratePercent: number;
}[];
/** Corporate income tax on a company's profit (Law No. 027/2022 as amended in 2023). */
export declare const CORPORATE_INCOME_TAX_PERCENT = 28;
/**
 * Days after signing a lease to give the tax administration a copy (Art. 41),
 * and after a change or an early end.
 */
export declare const LEASE_TAX_FILING_DAYS = 15;
export declare const LEASE_CHANGE_FILING_DAYS = 30;
/** The loan purposes whose interest reduces rental income tax. */
export declare const DEDUCTIBLE_LOAN_PURPOSES: readonly LoanPurpose[];
export interface RentalTaxBand {
    fromRwf: number;
    toRwf: number | null;
    ratePercent: number;
    /** How much of the taxable income falls inside this band. */
    incomeRwf: number;
    taxRwf: number;
}
export interface RentalTaxBreakdown {
    grossRentRwf: number;
    flatDeductionRwf: number;
    /** Deductible loan interest paid in the year, as recorded. */
    loanInterestRwf: number;
    /** The part of it taken off: never more than what is left after the 50%. */
    interestDeductedRwf: number;
    taxableIncomeRwf: number;
    bands: RentalTaxBand[];
    taxRwf: number;
}
/**
 * The interest that counts: loans to build or buy the rented property only.
 * Entries with any other purpose, or none, are left out.
 */
export declare function deductibleLoanInterestRwf(entries: readonly {
    amountRwf: number;
    purpose: string | null;
}[]): number;
/**
 * The rental income tax on one person's year: rent received, less 50%, less
 * deductible loan interest, then the bands. Whole francs; the taxable income
 * never goes below 0. Each band's tax is rounded to the nearest franc.
 */
export declare function computeRentalIncomeTax(input: {
    grossRentRwf: number;
    loanInterestRwf: number;
}): RentalTaxBreakdown;
/**
 * A company's year: rent less every recorded cost, and the corporate income
 * tax that profit implies at 28%. An estimate for the company's own return.
 */
export declare function companyProfit(input: {
    rentRwf: number;
    expensesRwf: number;
}): {
    rentRwf: number;
    expensesRwf: number;
    profitRwf: number;
    corporateTaxRwf: number;
};
/** The last day to declare and pay the tax on `year`'s rent: 31 January of the next year. */
export declare function rentalTaxDueOn(year: number): string;
/** The last day to give the tax administration a copy of a lease, or tell it of a change. */
export declare function leaseFilingDueOn(kind: LeaseFilingKind, eventOn: string): string;
/**
 * What paying late adds (Law No. 048/2023, Art. 51): 40% of the tax when it
 * was not declared on time, a 10% surcharge capped at 100,000 francs, and
 * 1.5% interest for every month or part of a month after the due date.
 */
export declare const LATE_DECLARATION_PENALTY_PERCENT = 40;
export declare const LATE_SURCHARGE_PERCENT = 10;
export declare const LATE_SURCHARGE_MAX_RWF = 100000;
export declare const LATE_INTEREST_PERCENT_PER_MONTH = 1.5;
/** Months started after `dueOn` up to and including `on`; 0 when not late. */
export declare function monthsLate(dueOn: string, on: string): number;
/**
 * An estimate of what the district adds when the tax is late, as of `on`.
 * `declaredOn` null means not declared yet. Zero tax owes nothing extra.
 */
export declare function lateCharges(input: {
    taxRwf: number;
    dueOn: string;
    on: string;
    declaredOn: string | null;
}): {
    monthsLate: number;
    penaltyRwf: number;
    surchargeRwf: number;
    interestRwf: number;
    totalRwf: number;
};
/** The prefixes each network issues, after `+250`. */
export declare const MOMO_NETWORK_PREFIXES: Readonly<Record<MomoNetwork, readonly string[]>>;
/** Which network a `+250…` number is on, or null. */
export declare function momoNetworkOf(e164: string): MomoNetwork | null;
/**
 * A typed MoMo number in the one stored form, `+2507xxxxxxxx`, or null when
 * it is not a Rwandan MTN or Airtel mobile number.
 */
export declare function normalizeMomoNumber(raw: string): string | null;
/** The banks licensed in Rwanda a landlord is likely to bank with. "Other" names one not listed. */
export declare const RWANDA_BANKS: readonly ["Bank of Kigali", "BPR Bank Rwanda", "I&M Bank Rwanda", "Equity Bank Rwanda", "Access Bank Rwanda", "Ecobank Rwanda", "NCBA Bank Rwanda", "Guaranty Trust Bank Rwanda", "Cogebanque", "Urwego Bank", "Development Bank of Rwanda", "Zigama CSS", "Other"];
export declare const RwandaBank: z.ZodEnum<["Bank of Kigali", "BPR Bank Rwanda", "I&M Bank Rwanda", "Equity Bank Rwanda", "Access Bank Rwanda", "Ecobank Rwanda", "NCBA Bank Rwanda", "Guaranty Trust Bank Rwanda", "Cogebanque", "Urwego Bank", "Development Bank of Rwanda", "Zigama CSS", "Other"]>;
export type RwandaBank = z.infer<typeof RwandaBank>;
/** A bank account number, a phone or a code with the middle hidden: `078•••••456`, `••••1234`. */
export declare function maskPayoutRef(ref: string): string;
/** `+250788123456` → `0788123456`, the way people in Rwanda read their own number. */
export declare function nationalPhone(e164: string): string;
/** One masked line saying where money goes: "MTN MoMo 078•••••456", "Bank of Kigali ••••5678", "MoMo Pay 12••56". */
export declare function payoutDestinationWords(account: {
    kind: PayoutAccountKind;
    bankName?: string | null;
    accountNumber?: string | null;
    momoNetwork?: MomoNetwork | null;
    momoPhone?: string | null;
    merchantCode?: string | null;
}): string;
/** A MoMo number, normalised to `+2507xxxxxxxx`. */
export declare const MomoNumber: z.ZodPipeline<z.ZodEffects<z.ZodString, string | null, string>, z.ZodString>;
/** A bank account number: 6 to 20 digits, spaces and dashes dropped. */
export declare const BankAccountNumber: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
/** A MoMo Pay merchant code: 4 to 10 digits. */
export declare const MomoPayMerchantCode: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
/**
 * Add or change a payout account. An edit sends the whole account again, so
 * the same form and the same checks serve both. A MoMo number must be on the
 * network picked: MTN numbers start 078 or 079, Airtel 072 or 073.
 */
export declare const PayoutAccountInput: z.ZodEffects<z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
    kind: z.ZodLiteral<"bank">;
    accountName: z.ZodString;
    bankName: z.ZodEnum<["Bank of Kigali", "BPR Bank Rwanda", "I&M Bank Rwanda", "Equity Bank Rwanda", "Access Bank Rwanda", "Ecobank Rwanda", "NCBA Bank Rwanda", "Guaranty Trust Bank Rwanda", "Cogebanque", "Urwego Bank", "Development Bank of Rwanda", "Zigama CSS", "Other"]>;
    /** For "Other": the bank's own name. */
    otherBankName: z.ZodOptional<z.ZodString>;
    accountNumber: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
    makePrimary: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    kind: "bank";
    accountName: string;
    bankName: "Other" | "Bank of Kigali" | "BPR Bank Rwanda" | "I&M Bank Rwanda" | "Equity Bank Rwanda" | "Access Bank Rwanda" | "Ecobank Rwanda" | "NCBA Bank Rwanda" | "Guaranty Trust Bank Rwanda" | "Cogebanque" | "Urwego Bank" | "Development Bank of Rwanda" | "Zigama CSS";
    accountNumber: string;
    otherBankName?: string | undefined;
    makePrimary?: boolean | undefined;
}, {
    kind: "bank";
    accountName: string;
    bankName: "Other" | "Bank of Kigali" | "BPR Bank Rwanda" | "I&M Bank Rwanda" | "Equity Bank Rwanda" | "Access Bank Rwanda" | "Ecobank Rwanda" | "NCBA Bank Rwanda" | "Guaranty Trust Bank Rwanda" | "Cogebanque" | "Urwego Bank" | "Development Bank of Rwanda" | "Zigama CSS";
    accountNumber: string;
    otherBankName?: string | undefined;
    makePrimary?: boolean | undefined;
}>, z.ZodObject<{
    kind: z.ZodLiteral<"momo">;
    accountName: z.ZodString;
    momoNetwork: z.ZodEnum<["mtn", "airtel"]>;
    momoPhone: z.ZodPipeline<z.ZodEffects<z.ZodString, string | null, string>, z.ZodString>;
    makePrimary: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    kind: "momo";
    accountName: string;
    momoNetwork: "mtn" | "airtel";
    momoPhone: string;
    makePrimary?: boolean | undefined;
}, {
    kind: "momo";
    accountName: string;
    momoNetwork: "mtn" | "airtel";
    momoPhone: string;
    makePrimary?: boolean | undefined;
}>, z.ZodObject<{
    kind: z.ZodLiteral<"momo_pay">;
    accountName: z.ZodString;
    merchantCode: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
    makePrimary: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    kind: "momo_pay";
    accountName: string;
    merchantCode: string;
    makePrimary?: boolean | undefined;
}, {
    kind: "momo_pay";
    accountName: string;
    merchantCode: string;
    makePrimary?: boolean | undefined;
}>]>, {
    kind: "bank";
    accountName: string;
    bankName: "Other" | "Bank of Kigali" | "BPR Bank Rwanda" | "I&M Bank Rwanda" | "Equity Bank Rwanda" | "Access Bank Rwanda" | "Ecobank Rwanda" | "NCBA Bank Rwanda" | "Guaranty Trust Bank Rwanda" | "Cogebanque" | "Urwego Bank" | "Development Bank of Rwanda" | "Zigama CSS";
    accountNumber: string;
    otherBankName?: string | undefined;
    makePrimary?: boolean | undefined;
} | {
    kind: "momo";
    accountName: string;
    momoNetwork: "mtn" | "airtel";
    momoPhone: string;
    makePrimary?: boolean | undefined;
} | {
    kind: "momo_pay";
    accountName: string;
    merchantCode: string;
    makePrimary?: boolean | undefined;
}, {
    kind: "bank";
    accountName: string;
    bankName: "Other" | "Bank of Kigali" | "BPR Bank Rwanda" | "I&M Bank Rwanda" | "Equity Bank Rwanda" | "Access Bank Rwanda" | "Ecobank Rwanda" | "NCBA Bank Rwanda" | "Guaranty Trust Bank Rwanda" | "Cogebanque" | "Urwego Bank" | "Development Bank of Rwanda" | "Zigama CSS";
    accountNumber: string;
    otherBankName?: string | undefined;
    makePrimary?: boolean | undefined;
} | {
    kind: "momo";
    accountName: string;
    momoNetwork: "mtn" | "airtel";
    momoPhone: string;
    makePrimary?: boolean | undefined;
} | {
    kind: "momo_pay";
    accountName: string;
    merchantCode: string;
    makePrimary?: boolean | undefined;
}>;
export type PayoutAccountInput = z.infer<typeof PayoutAccountInput>;
//# sourceMappingURL=money.d.ts.map