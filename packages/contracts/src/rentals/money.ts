import { z } from "zod";
import { normalizeRwPhone } from "../phone";
import { addDays } from "./dates";
import { type LeaseFilingKind, type LoanPurpose, MomoNetwork, type PayoutAccountKind, MOMO_NETWORK_LABEL } from "./vocab";

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
export const RENTAL_TAX_FLAT_DEDUCTION_PERCENT = 50;

/** The bands, on the year's taxable rental income. Each rate applies only to the part inside its band. */
export const RENTAL_TAX_BANDS: readonly { fromRwf: number; toRwf: number | null; ratePercent: number }[] = [
  { fromRwf: 0, toRwf: 180_000, ratePercent: 0 },
  { fromRwf: 180_000, toRwf: 1_000_000, ratePercent: 20 },
  { fromRwf: 1_000_000, toRwf: null, ratePercent: 30 },
];

/** Corporate income tax on a company's profit (Law No. 027/2022 as amended in 2023). */
export const CORPORATE_INCOME_TAX_PERCENT = 28;

/**
 * Days after signing a lease to give the tax administration a copy (Art. 41),
 * and after a change or an early end.
 */
export const LEASE_TAX_FILING_DAYS = 15;
export const LEASE_CHANGE_FILING_DAYS = 30;

/** The loan purposes whose interest reduces rental income tax. */
export const DEDUCTIBLE_LOAN_PURPOSES: readonly LoanPurpose[] = ["build", "buy"];

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

function wholeFrancs(v: number): number {
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

/**
 * The interest that counts: loans to build or buy the rented property only.
 * Entries with any other purpose, or none, are left out.
 */
export function deductibleLoanInterestRwf(entries: readonly { amountRwf: number; purpose: string | null }[]): number {
  return entries
    .filter((e) => e.purpose !== null && (DEDUCTIBLE_LOAN_PURPOSES as readonly string[]).includes(e.purpose))
    .reduce((s, e) => s + wholeFrancs(e.amountRwf), 0);
}

/**
 * The rental income tax on one person's year: rent received, less 50%, less
 * deductible loan interest, then the bands. Whole francs; the taxable income
 * never goes below 0. Each band's tax is rounded to the nearest franc.
 */
export function computeRentalIncomeTax(input: { grossRentRwf: number; loanInterestRwf: number }): RentalTaxBreakdown {
  const grossRentRwf = wholeFrancs(input.grossRentRwf);
  const loanInterestRwf = wholeFrancs(input.loanInterestRwf);
  const flatDeductionRwf = Math.floor((grossRentRwf * RENTAL_TAX_FLAT_DEDUCTION_PERCENT) / 100);
  const afterFlat = grossRentRwf - flatDeductionRwf;
  const interestDeductedRwf = Math.min(loanInterestRwf, afterFlat);
  const taxableIncomeRwf = afterFlat - interestDeductedRwf;
  const bands = RENTAL_TAX_BANDS.map((b) => {
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
export function companyProfit(input: { rentRwf: number; expensesRwf: number }): {
  rentRwf: number;
  expensesRwf: number;
  profitRwf: number;
  corporateTaxRwf: number;
} {
  const rentRwf = wholeFrancs(input.rentRwf);
  const expensesRwf = wholeFrancs(input.expensesRwf);
  const profitRwf = rentRwf - expensesRwf;
  const corporateTaxRwf = profitRwf > 0 ? Math.round((profitRwf * CORPORATE_INCOME_TAX_PERCENT) / 100) : 0;
  return { rentRwf, expensesRwf, profitRwf, corporateTaxRwf };
}

/** The last day to declare and pay the tax on `year`'s rent: 31 January of the next year. */
export function rentalTaxDueOn(year: number): string {
  return `${year + 1}-01-31`;
}

/** The last day to give the tax administration a copy of a lease, or tell it of a change. */
export function leaseFilingDueOn(kind: LeaseFilingKind, eventOn: string): string {
  return addDays(eventOn, kind === "new_lease" ? LEASE_TAX_FILING_DAYS : LEASE_CHANGE_FILING_DAYS);
}

/**
 * What paying late adds (Law No. 048/2023, Art. 51): 40% of the tax when it
 * was not declared on time, a 10% surcharge capped at 100,000 francs, and
 * 1.5% interest for every month or part of a month after the due date.
 */
export const LATE_DECLARATION_PENALTY_PERCENT = 40;
export const LATE_SURCHARGE_PERCENT = 10;
export const LATE_SURCHARGE_MAX_RWF = 100_000;
export const LATE_INTEREST_PERCENT_PER_MONTH = 1.5;

/** Months started after `dueOn` up to and including `on`; 0 when not late. */
export function monthsLate(dueOn: string, on: string): number {
  if (on <= dueOn) return 0;
  const [dy, dm, dd] = dueOn.split("-").map(Number) as [number, number, number];
  const [y, m, d] = on.split("-").map(Number) as [number, number, number];
  let months = (y - dy) * 12 + (m - dm);
  if (d > dd) months += 1;
  return Math.max(1, months);
}

/**
 * An estimate of what the district adds when the tax is late, as of `on`.
 * `declaredOn` null means not declared yet. Zero tax owes nothing extra.
 */
export function lateCharges(input: { taxRwf: number; dueOn: string; on: string; declaredOn: string | null }): {
  monthsLate: number;
  penaltyRwf: number;
  surchargeRwf: number;
  interestRwf: number;
  totalRwf: number;
} {
  const tax = wholeFrancs(input.taxRwf);
  const months = monthsLate(input.dueOn, input.on);
  if (months === 0 || tax === 0) return { monthsLate: months, penaltyRwf: 0, surchargeRwf: 0, interestRwf: 0, totalRwf: 0 };
  const declaredLate = input.declaredOn === null || input.declaredOn > input.dueOn;
  const penaltyRwf = declaredLate ? Math.round((tax * LATE_DECLARATION_PENALTY_PERCENT) / 100) : 0;
  const surchargeRwf = Math.min(LATE_SURCHARGE_MAX_RWF, Math.round((tax * LATE_SURCHARGE_PERCENT) / 100));
  const interestRwf = Math.round((tax * LATE_INTEREST_PERCENT_PER_MONTH * months) / 100);
  return { monthsLate: months, penaltyRwf, surchargeRwf, interestRwf, totalRwf: penaltyRwf + surchargeRwf + interestRwf };
}

// --- Payout accounts ------------------------------------------------------------------
//
// A tenant pays through the gateway, and the gateway pays the money out to the
// landlord's primary account: a bank account, a mobile money number, or a MoMo
// Pay merchant code. Without one, a payout is held until one is added.

/** The prefixes each network issues, after `+250`. */
export const MOMO_NETWORK_PREFIXES: Readonly<Record<MomoNetwork, readonly string[]>> = {
  mtn: ["78", "79"],
  airtel: ["72", "73"],
};

/** Which network a `+250…` number is on, or null. */
export function momoNetworkOf(e164: string): MomoNetwork | null {
  const prefix = e164.replace(/^\+250/, "").slice(0, 2);
  for (const network of MomoNetwork.options) {
    if (MOMO_NETWORK_PREFIXES[network].includes(prefix)) return network;
  }
  return null;
}

/**
 * A typed MoMo number in the one stored form, `+2507xxxxxxxx`, or null when
 * it is not a Rwandan MTN or Airtel mobile number.
 */
export function normalizeMomoNumber(raw: string): string | null {
  return normalizeRwPhone(raw);
}

/** The banks licensed in Rwanda a landlord is likely to bank with. "Other" names one not listed. */
export const RWANDA_BANKS = [
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
] as const;
export const RwandaBank = z.enum(RWANDA_BANKS);
export type RwandaBank = z.infer<typeof RwandaBank>;

/** A bank account number, a phone or a code with the middle hidden: `078•••••456`, `••••1234`. */
export function maskPayoutRef(ref: string): string {
  const bare = ref.replace(/\s+/g, "");
  if (bare.length <= 4) return bare;
  if (bare.length <= 7) return `${"•".repeat(bare.length - 3)}${bare.slice(-3)}`;
  return `${bare.slice(0, 3)}${"•".repeat(bare.length - 6)}${bare.slice(-3)}`;
}

/** `+250788123456` → `0788123456`, the way people in Rwanda read their own number. */
export function nationalPhone(e164: string): string {
  return e164.startsWith("+250") ? `0${e164.slice(4)}` : e164;
}

/** One masked line saying where money goes: "MTN MoMo 078•••••456", "Bank of Kigali ••••5678", "MoMo Pay 12••56". */
export function payoutDestinationWords(account: {
  kind: PayoutAccountKind;
  bankName?: string | null;
  accountNumber?: string | null;
  momoNetwork?: MomoNetwork | null;
  momoPhone?: string | null;
  merchantCode?: string | null;
}): string {
  if (account.kind === "bank") return `${account.bankName ?? "Bank"} ${maskPayoutRef(account.accountNumber ?? "")}`.trim();
  if (account.kind === "momo") {
    const network = account.momoNetwork ? MOMO_NETWORK_LABEL[account.momoNetwork] : "MoMo";
    return `${network} ${maskPayoutRef(nationalPhone(account.momoPhone ?? ""))}`.trim();
  }
  return `MoMo Pay ${maskPayoutRef(account.merchantCode ?? "")}`.trim();
}

const AccountName = z
  .string({ required_error: "Enter the name the account is in." })
  .trim()
  .min(2, "Enter the name the account is in.")
  .max(120, "That name is too long.");

const MOMO_NUMBER_MESSAGE = "Enter a Rwandan mobile number, like 0788 123 456.";

/** A MoMo number, normalised to `+2507xxxxxxxx`. */
export const MomoNumber = z
  .string({ required_error: MOMO_NUMBER_MESSAGE })
  .trim()
  .transform((raw) => normalizeMomoNumber(raw))
  .pipe(z.string({ invalid_type_error: MOMO_NUMBER_MESSAGE }));

/** A bank account number: 6 to 20 digits, spaces and dashes dropped. */
export const BankAccountNumber = z
  .string({ required_error: "Enter the account number." })
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^\d{6,20}$/, "An account number is 6 to 20 digits."));

/** A MoMo Pay merchant code: 4 to 10 digits. */
export const MomoPayMerchantCode = z
  .string({ required_error: "Enter the MoMo Pay code." })
  .trim()
  .transform((v) => v.replace(/\s+/g, ""))
  .pipe(z.string().regex(/^\d{4,10}$/, "A MoMo Pay code is 4 to 10 digits."));

/**
 * Add or change a payout account. An edit sends the whole account again, so
 * the same form and the same checks serve both. A MoMo number must be on the
 * network picked: MTN numbers start 078 or 079, Airtel 072 or 073.
 */
export const PayoutAccountInput = z
  .discriminatedUnion("kind", [
    z.object({
      kind: z.literal("bank"),
      accountName: AccountName,
      bankName: RwandaBank,
      /** For "Other": the bank's own name. */
      otherBankName: z.string().trim().max(80).optional(),
      accountNumber: BankAccountNumber,
      makePrimary: z.boolean().optional(),
    }),
    z.object({
      kind: z.literal("momo"),
      accountName: AccountName,
      momoNetwork: MomoNetwork,
      momoPhone: MomoNumber,
      makePrimary: z.boolean().optional(),
    }),
    z.object({
      kind: z.literal("momo_pay"),
      accountName: AccountName,
      merchantCode: MomoPayMerchantCode,
      makePrimary: z.boolean().optional(),
    }),
  ])
  .superRefine((v, ctx) => {
    if (v.kind === "bank" && v.bankName === "Other" && !v.otherBankName?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["otherBankName"], message: "Name the bank." });
    }
    if (v.kind === "momo") {
      const actual = momoNetworkOf(v.momoPhone);
      if (actual === null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["momoPhone"], message: MOMO_NUMBER_MESSAGE });
      } else if (actual !== v.momoNetwork) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["momoPhone"],
          message: v.momoNetwork === "mtn" ? "MTN numbers start 078 or 079." : "Airtel numbers start 072 or 073.",
        });
      }
    }
  });
export type PayoutAccountInput = z.infer<typeof PayoutAccountInput>;
