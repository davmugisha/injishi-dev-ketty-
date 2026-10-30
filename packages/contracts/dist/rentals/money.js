"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayoutAccountInput = exports.MomoPayMerchantCode = exports.BankAccountNumber = exports.MomoNumber = exports.RwandaBank = exports.RWANDA_BANKS = exports.MOMO_NETWORK_PREFIXES = exports.LATE_INTEREST_PERCENT_PER_MONTH = exports.LATE_SURCHARGE_MAX_RWF = exports.LATE_SURCHARGE_PERCENT = exports.LATE_DECLARATION_PENALTY_PERCENT = exports.DEDUCTIBLE_LOAN_PURPOSES = exports.LEASE_CHANGE_FILING_DAYS = exports.LEASE_TAX_FILING_DAYS = exports.CORPORATE_INCOME_TAX_PERCENT = exports.RENTAL_TAX_BANDS = exports.RENTAL_TAX_FLAT_DEDUCTION_PERCENT = void 0;
exports.deductibleLoanInterestRwf = deductibleLoanInterestRwf;
exports.computeRentalIncomeTax = computeRentalIncomeTax;
exports.companyProfit = companyProfit;
exports.rentalTaxDueOn = rentalTaxDueOn;
exports.leaseFilingDueOn = leaseFilingDueOn;
exports.monthsLate = monthsLate;
exports.lateCharges = lateCharges;
exports.momoNetworkOf = momoNetworkOf;
exports.normalizeMomoNumber = normalizeMomoNumber;
exports.maskPayoutRef = maskPayoutRef;
exports.nationalPhone = nationalPhone;
exports.payoutDestinationWords = payoutDestinationWords;
const zod_1 = require("zod");
const phone_1 = require("../phone");
const dates_1 = require("./dates");
const vocab_1 = require("./vocab");
// ===========================================================================
// Rental income tax (Law No. 048/2023), and where a landlord's rent is paid out
// ===========================================================================
// --- Rental income tax ------------------------------------------------------------
//
// An individual who rents out a building in Rwanda pays rental income tax to
// the district, declared and paid through RRA by 31 January of the year after
// the rent came in (Law No. 048/2023 of 05/09/2023 on the sources of revenue
// and property of decentralised entities). The taxable income is the year's
// rent received, less a flat 50% for upkeep (which is why repair bills do not
// reduce it), less the bank interest actually paid that year on a loan to
// build or buy the rented property, with proof from the bank (Art. 43; a loan
// to improve it is not named, and there is no cap). All of a person's rented
// property is declared together for the year (Art. 45). Verified against the
// law and RRA's pages on 2026-10-23 (feat/rentals).
//
// A company pays corporate income tax on its profit instead, where its real
// costs count: `companyProfit` shows rent less costs and the 28% it implies.
//
// One function computes the estimate so the screen and the API can never
// disagree. Nothing it returns is stored.
/** The flat deduction for upkeep, as a percentage of the rent received. */
exports.RENTAL_TAX_FLAT_DEDUCTION_PERCENT = 50;
/** The bands, on the year's taxable rental income. Each rate applies only to the part inside its band. */
exports.RENTAL_TAX_BANDS = [
    { fromRwf: 0, toRwf: 180000, ratePercent: 0 },
    { fromRwf: 180000, toRwf: 1000000, ratePercent: 20 },
    { fromRwf: 1000000, toRwf: null, ratePercent: 30 },
];
/** Corporate income tax on a company's profit (Law No. 027/2022 as amended in 2023). */
exports.CORPORATE_INCOME_TAX_PERCENT = 28;
/**
 * Days after signing a lease to give the tax administration a copy (Art. 41),
 * and after a change or an early end.
 */
exports.LEASE_TAX_FILING_DAYS = 15;
exports.LEASE_CHANGE_FILING_DAYS = 30;
/** The loan purposes whose interest reduces rental income tax. */
exports.DEDUCTIBLE_LOAN_PURPOSES = ["build", "buy"];
function wholeFrancs(v) {
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}
/**
 * The interest that counts: loans to build or buy the rented property only.
 * Entries with any other purpose, or none, are left out.
 */
function deductibleLoanInterestRwf(entries) {
    return entries
        .filter((e) => e.purpose !== null && exports.DEDUCTIBLE_LOAN_PURPOSES.includes(e.purpose))
        .reduce((s, e) => s + wholeFrancs(e.amountRwf), 0);
}
/**
 * The rental income tax on one person's year: rent received, less 50%, less
 * deductible loan interest, then the bands. Whole francs; the taxable income
 * never goes below 0. Each band's tax is rounded to the nearest franc.
 */
function computeRentalIncomeTax(input) {
    const grossRentRwf = wholeFrancs(input.grossRentRwf);
    const loanInterestRwf = wholeFrancs(input.loanInterestRwf);
    const flatDeductionRwf = Math.floor((grossRentRwf * exports.RENTAL_TAX_FLAT_DEDUCTION_PERCENT) / 100);
    const afterFlat = grossRentRwf - flatDeductionRwf;
    const interestDeductedRwf = Math.min(loanInterestRwf, afterFlat);
    const taxableIncomeRwf = afterFlat - interestDeductedRwf;
    const bands = exports.RENTAL_TAX_BANDS.map((b) => {
        const top = b.toRwf ?? Number.POSITIVE_INFINITY;
        const incomeRwf = Math.max(0, Math.min(taxableIncomeRwf, top) - b.fromRwf);
        return { ...b, incomeRwf, taxRwf: Math.round((incomeRwf * b.ratePercent) / 100) };
    });
    return {
        grossRentRwf,
        flatDeductionRwf,
        loanInterestRwf,
        interestDeductedRwf,
        taxableIncomeRwf,
        bands,
        taxRwf: bands.reduce((s, b) => s + b.taxRwf, 0),
    };
}
/**
 * A company's year: rent less every recorded cost, and the corporate income
 * tax that profit implies at 28%. An estimate for the company's own return.
 */
function companyProfit(input) {
    const rentRwf = wholeFrancs(input.rentRwf);
    const expensesRwf = wholeFrancs(input.expensesRwf);
    const profitRwf = rentRwf - expensesRwf;
    const corporateTaxRwf = profitRwf > 0 ? Math.round((profitRwf * exports.CORPORATE_INCOME_TAX_PERCENT) / 100) : 0;
    return { rentRwf, expensesRwf, profitRwf, corporateTaxRwf };
}
/** The last day to declare and pay the tax on `year`'s rent: 31 January of the next year. */
function rentalTaxDueOn(year) {
    return `${year + 1}-01-31`;
}
/** The last day to give the tax administration a copy of a lease, or tell it of a change. */
function leaseFilingDueOn(kind, eventOn) {
    return (0, dates_1.addDays)(eventOn, kind === "new_lease" ? exports.LEASE_TAX_FILING_DAYS : exports.LEASE_CHANGE_FILING_DAYS);
}
/**
 * What paying late adds (Law No. 048/2023, Art. 51): 40% of the tax when it
 * was not declared on time, a 10% surcharge capped at 100,000 francs, and
 * 1.5% interest for every month or part of a month after the due date.
 */
exports.LATE_DECLARATION_PENALTY_PERCENT = 40;
exports.LATE_SURCHARGE_PERCENT = 10;
exports.LATE_SURCHARGE_MAX_RWF = 100000;
exports.LATE_INTEREST_PERCENT_PER_MONTH = 1.5;
/** Months started after `dueOn` up to and including `on`; 0 when not late. */
function monthsLate(dueOn, on) {
    if (on <= dueOn)
        return 0;
    const [dy, dm, dd] = dueOn.split("-").map(Number);
    const [y, m, d] = on.split("-").map(Number);
    let months = (y - dy) * 12 + (m - dm);
    if (d > dd)
        months += 1;
    return Math.max(1, months);
}
/**
 * An estimate of what the district adds when the tax is late, as of `on`.
 * `declaredOn` null means not declared yet. Zero tax owes nothing extra.
 */
function lateCharges(input) {
    const tax = wholeFrancs(input.taxRwf);
    const months = monthsLate(input.dueOn, input.on);
    if (months === 0 || tax === 0)
        return { monthsLate: months, penaltyRwf: 0, surchargeRwf: 0, interestRwf: 0, totalRwf: 0 };
    const declaredLate = input.declaredOn === null || input.declaredOn > input.dueOn;
    const penaltyRwf = declaredLate ? Math.round((tax * exports.LATE_DECLARATION_PENALTY_PERCENT) / 100) : 0;
    const surchargeRwf = Math.min(exports.LATE_SURCHARGE_MAX_RWF, Math.round((tax * exports.LATE_SURCHARGE_PERCENT) / 100));
    const interestRwf = Math.round((tax * exports.LATE_INTEREST_PERCENT_PER_MONTH * months) / 100);
    return { monthsLate: months, penaltyRwf, surchargeRwf, interestRwf, totalRwf: penaltyRwf + surchargeRwf + interestRwf };
}
// --- Payout accounts ------------------------------------------------------------------
//
// A tenant pays through the gateway, and the gateway pays the money out to the
// landlord's primary account: a bank account, a mobile money number, or a MoMo
// Pay merchant code. Without one, a payout is held until one is added.
/** The prefixes each network issues, after `+250`. */
exports.MOMO_NETWORK_PREFIXES = {
    mtn: ["78", "79"],
    airtel: ["72", "73"],
};
/** Which network a `+250…` number is on, or null. */
function momoNetworkOf(e164) {
    const prefix = e164.replace(/^\+250/, "").slice(0, 2);
    for (const network of vocab_1.MomoNetwork.options) {
        if (exports.MOMO_NETWORK_PREFIXES[network].includes(prefix))
            return network;
    }
    return null;
}
/**
 * A typed MoMo number in the one stored form, `+2507xxxxxxxx`, or null when
 * it is not a Rwandan MTN or Airtel mobile number.
 */
function normalizeMomoNumber(raw) {
    return (0, phone_1.normalizeRwPhone)(raw);
}
/** The banks licensed in Rwanda a landlord is likely to bank with. "Other" names one not listed. */
exports.RWANDA_BANKS = [
    "Bank of Kigali",
    "BPR Bank Rwanda",
    "I&M Bank Rwanda",
    "Equity Bank Rwanda",
    "Access Bank Rwanda",
    "Ecobank Rwanda",
    "NCBA Bank Rwanda",
    "Guaranty Trust Bank Rwanda",
    "Cogebanque",
    "Urwego Bank",
    "Development Bank of Rwanda",
    "Zigama CSS",
    "Other",
];
exports.RwandaBank = zod_1.z.enum(exports.RWANDA_BANKS);
/** A bank account number, a phone or a code with the middle hidden: `078•••••456`, `••••1234`. */
function maskPayoutRef(ref) {
    const bare = ref.replace(/\s+/g, "");
    if (bare.length <= 4)
        return bare;
    if (bare.length <= 7)
        return `${"•".repeat(bare.length - 3)}${bare.slice(-3)}`;
    return `${bare.slice(0, 3)}${"•".repeat(bare.length - 6)}${bare.slice(-3)}`;
}
/** `+250788123456` → `0788123456`, the way people in Rwanda read their own number. */
function nationalPhone(e164) {
    return e164.startsWith("+250") ? `0${e164.slice(4)}` : e164;
}
/** One masked line saying where money goes: "MTN MoMo 078•••••456", "Bank of Kigali ••••5678", "MoMo Pay 12••56". */
function payoutDestinationWords(account) {
    if (account.kind === "bank")
        return `${account.bankName ?? "Bank"} ${maskPayoutRef(account.accountNumber ?? "")}`.trim();
    if (account.kind === "momo") {
        const network = account.momoNetwork ? vocab_1.MOMO_NETWORK_LABEL[account.momoNetwork] : "MoMo";
        return `${network} ${maskPayoutRef(nationalPhone(account.momoPhone ?? ""))}`.trim();
    }
    return `MoMo Pay ${maskPayoutRef(account.merchantCode ?? "")}`.trim();
}
const AccountName = zod_1.z
    .string({ required_error: "Enter the name the account is in." })
    .trim()
    .min(2, "Enter the name the account is in.")
    .max(120, "That name is too long.");
const MOMO_NUMBER_MESSAGE = "Enter a Rwandan mobile number, like 0788 123 456.";
/** A MoMo number, normalised to `+2507xxxxxxxx`. */
exports.MomoNumber = zod_1.z
    .string({ required_error: MOMO_NUMBER_MESSAGE })
    .trim()
    .transform((raw) => normalizeMomoNumber(raw))
    .pipe(zod_1.z.string({ invalid_type_error: MOMO_NUMBER_MESSAGE }));
/** A bank account number: 6 to 20 digits, spaces and dashes dropped. */
exports.BankAccountNumber = zod_1.z
    .string({ required_error: "Enter the account number." })
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .pipe(zod_1.z.string().regex(/^\d{6,20}$/, "An account number is 6 to 20 digits."));
/** A MoMo Pay merchant code: 4 to 10 digits. */
exports.MomoPayMerchantCode = zod_1.z
    .string({ required_error: "Enter the MoMo Pay code." })
    .trim()
    .transform((v) => v.replace(/\s+/g, ""))
    .pipe(zod_1.z.string().regex(/^\d{4,10}$/, "A MoMo Pay code is 4 to 10 digits."));
/**
 * Add or change a payout account. An edit sends the whole account again, so
 * the same form and the same checks serve both. A MoMo number must be on the
 * network picked: MTN numbers start 078 or 079, Airtel 072 or 073.
 */
exports.PayoutAccountInput = zod_1.z
    .discriminatedUnion("kind", [
    zod_1.z.object({
        kind: zod_1.z.literal("bank"),
        accountName: AccountName,
        bankName: exports.RwandaBank,
        /** For "Other": the bank's own name. */
        otherBankName: zod_1.z.string().trim().max(80).optional(),
        accountNumber: exports.BankAccountNumber,
        makePrimary: zod_1.z.boolean().optional(),
    }),
    zod_1.z.object({
        kind: zod_1.z.literal("momo"),
        accountName: AccountName,
        momoNetwork: vocab_1.MomoNetwork,
        momoPhone: exports.MomoNumber,
        makePrimary: zod_1.z.boolean().optional(),
    }),
    zod_1.z.object({
        kind: zod_1.z.literal("momo_pay"),
        accountName: AccountName,
        merchantCode: exports.MomoPayMerchantCode,
        makePrimary: zod_1.z.boolean().optional(),
    }),
])
    .superRefine((v, ctx) => {
    if (v.kind === "bank" && v.bankName === "Other" && !v.otherBankName?.trim()) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["otherBankName"], message: "Name the bank." });
    }
    if (v.kind === "momo") {
        const actual = momoNetworkOf(v.momoPhone);
        if (actual === null) {
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["momoPhone"], message: MOMO_NUMBER_MESSAGE });
        }
        else if (actual !== v.momoNetwork) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ["momoPhone"],
                message: v.momoNetwork === "mtn" ? "MTN numbers start 078 or 079." : "Airtel numbers start 072 or 073.",
            });
        }
    }
});
//# sourceMappingURL=money.js.map