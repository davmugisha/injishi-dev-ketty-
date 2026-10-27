/**
 * Rentals (blueprint WP 1.1): rental income tax (Law No. 048/2023 Art. 42 to
 * 46 and 51, as feat/rentals verified it) and payout accounts.
 *
 *   pnpm --filter @injishi/contracts test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const c = require("../dist/index.js");

/** The tax on a taxable income, with no rent maths in the way. */
const onTaxable = (taxable) => c.computeRentalIncomeTax({ grossRentRwf: taxable * 2, loanInterestRwf: 0 });

describe("the RRA leaflet's example", () => {
  test("4,800,000 rent and 500,000 interest owe 434,000", () => {
    const t = c.computeRentalIncomeTax({ grossRentRwf: 4_800_000, loanInterestRwf: 500_000 });
    assert.equal(t.flatDeductionRwf, 2_400_000);
    assert.equal(t.interestDeductedRwf, 500_000);
    assert.equal(t.taxableIncomeRwf, 1_900_000);
    assert.deepEqual(t.bands.map((b) => b.incomeRwf), [180_000, 820_000, 900_000]);
    assert.deepEqual(t.bands.map((b) => b.taxRwf), [0, 164_000, 270_000]);
    assert.equal(t.taxRwf, 434_000);
  });
});

describe("band edges", () => {
  test("180,000 taxable is all in the 0% band", () => {
    const t = onTaxable(180_000);
    assert.deepEqual(t.bands.map((b) => b.incomeRwf), [180_000, 0, 0]);
    assert.equal(t.taxRwf, 0);
  });
  test("180,001: one franc at 20%, which rounds to 0", () => {
    const t = onTaxable(180_001);
    assert.deepEqual(t.bands.map((b) => b.incomeRwf), [180_000, 1, 0]);
    assert.equal(t.taxRwf, 0);
  });
  test("180,005: five francs at 20% is 1", () => {
    assert.equal(onTaxable(180_005).taxRwf, 1);
  });
  test("1,000,000: the 20% band is full, 164,000", () => {
    const t = onTaxable(1_000_000);
    assert.deepEqual(t.bands.map((b) => b.incomeRwf), [180_000, 820_000, 0]);
    assert.equal(t.taxRwf, 164_000);
  });
  test("1,000,001: one franc at 30%", () => {
    const t = onTaxable(1_000_001);
    assert.deepEqual(t.bands.map((b) => b.incomeRwf), [180_000, 820_000, 1]);
    assert.equal(t.taxRwf, 164_000);
  });
  test("1,000,010: ten francs at 30% is 3", () => {
    assert.equal(onTaxable(1_000_010).taxRwf, 164_003);
  });
});

describe("rent and interest", () => {
  test("no rent owes nothing", () => {
    assert.equal(c.computeRentalIncomeTax({ grossRentRwf: 0, loanInterestRwf: 0 }).taxRwf, 0);
  });
  test("interest larger than half the rent floors the taxable income at 0", () => {
    const t = c.computeRentalIncomeTax({ grossRentRwf: 1_000_000, loanInterestRwf: 800_000 });
    assert.equal(t.flatDeductionRwf, 500_000);
    assert.equal(t.loanInterestRwf, 800_000);
    assert.equal(t.interestDeductedRwf, 500_000);
    assert.equal(t.taxableIncomeRwf, 0);
    assert.equal(t.taxRwf, 0);
  });
  test("an odd franc of rent stays taxable", () => {
    const t = c.computeRentalIncomeTax({ grossRentRwf: 360_001, loanInterestRwf: 0 });
    assert.equal(t.flatDeductionRwf, 180_000);
    assert.equal(t.taxableIncomeRwf, 180_001);
  });
  test("negative or broken inputs count as 0", () => {
    const t = c.computeRentalIncomeTax({ grossRentRwf: -5, loanInterestRwf: Number.NaN });
    assert.equal(t.grossRentRwf, 0);
    assert.equal(t.taxRwf, 0);
  });
  test("only interest on a loan to build or buy counts", () => {
    assert.equal(
      c.deductibleLoanInterestRwf([
        { amountRwf: 300_000, purpose: "build" },
        { amountRwf: 200_000, purpose: "buy" },
        { amountRwf: 150_000, purpose: "improve" },
        { amountRwf: 99_000, purpose: null },
      ]),
      500_000,
    );
    assert.deepEqual([...c.DEDUCTIBLE_LOAN_PURPOSES], c.LoanPurpose.options);
  });
});

describe("a company landlord", () => {
  test("profit is rent less costs, and 28% of it is the corporate income tax", () => {
    assert.equal(c.CORPORATE_INCOME_TAX_PERCENT, 28);
    assert.deepEqual(c.companyProfit({ rentRwf: 10_000_000, expensesRwf: 4_000_000 }), {
      rentRwf: 10_000_000,
      expensesRwf: 4_000_000,
      profitRwf: 6_000_000,
      corporateTaxRwf: 1_680_000,
    });
  });
  test("a loss owes no corporate income tax", () => {
    const p = c.companyProfit({ rentRwf: 1_000_000, expensesRwf: 1_500_000 });
    assert.equal(p.profitRwf, -500_000);
    assert.equal(p.corporateTaxRwf, 0);
  });
});

describe("dates", () => {
  test("a year's tax is due 31 January of the next", () => {
    assert.equal(c.rentalTaxDueOn(2026), "2027-01-31");
  });
  test("a new lease is filed within 15 days; a change or an early end within 30", () => {
    assert.equal(c.leaseFilingDueOn("new_lease", "2026-10-20"), "2026-11-04");
    assert.equal(c.leaseFilingDueOn("change", "2026-10-20"), "2026-11-19");
    assert.equal(c.leaseFilingDueOn("termination", "2026-10-20"), "2026-11-19");
  });
});

describe("paying late (Art. 51)", () => {
  test("every month started counts", () => {
    assert.equal(c.monthsLate("2026-01-31", "2026-01-31"), 0);
    assert.equal(c.monthsLate("2026-01-31", "2026-02-01"), 1);
    assert.equal(c.monthsLate("2026-01-31", "2026-02-28"), 1);
    assert.equal(c.monthsLate("2026-01-31", "2026-03-01"), 2);
  });
  test("not declared: 40% penalty, 10% surcharge capped at 100,000, 1.5% a month", () => {
    const late = c.lateCharges({ taxRwf: 434_000, dueOn: "2026-01-31", on: "2026-03-15", declaredOn: null });
    assert.deepEqual(late, { monthsLate: 2, penaltyRwf: 173_600, surchargeRwf: 43_400, interestRwf: 13_020, totalRwf: 230_020 });
  });
  test("the surcharge stops at 100,000", () => {
    assert.equal(c.lateCharges({ taxRwf: 5_000_000, dueOn: "2026-01-31", on: "2026-02-02", declaredOn: "2026-01-20" }).surchargeRwf, 100_000);
  });
  test("declared on time but paid late: no 40% penalty", () => {
    assert.equal(c.lateCharges({ taxRwf: 434_000, dueOn: "2026-01-31", on: "2026-02-10", declaredOn: "2026-01-20" }).penaltyRwf, 0);
  });
  test("on time, or no tax, owes nothing extra", () => {
    assert.equal(c.lateCharges({ taxRwf: 434_000, dueOn: "2026-01-31", on: "2026-01-31", declaredOn: null }).totalRwf, 0);
    assert.equal(c.lateCharges({ taxRwf: 0, dueOn: "2026-01-31", on: "2026-05-31", declaredOn: null }).totalRwf, 0);
  });
});

describe("MoMo numbers", () => {
  test("every way a person writes a number becomes +2507xxxxxxxx", () => {
    for (const typed of ["0788123456", "788123456", "250788123456", "+250788123456", "0788 123 456", "+250 (788) 123-456"]) {
      assert.equal(c.normalizeMomoNumber(typed), "+250788123456", typed);
    }
  });
  test("only MTN and Airtel mobile numbers", () => {
    assert.equal(c.normalizeMomoNumber("0752123456"), null);
    assert.equal(c.normalizeMomoNumber("0252123456"), null);
    assert.equal(c.normalizeMomoNumber("+254712345678"), null);
    assert.equal(c.normalizeMomoNumber("07881234567"), null);
  });
  test("the network a number is on", () => {
    assert.equal(c.momoNetworkOf("+250788123456"), "mtn");
    assert.equal(c.momoNetworkOf("+250791234567"), "mtn");
    assert.equal(c.momoNetworkOf("+250721234567"), "airtel");
    assert.equal(c.momoNetworkOf("+250731234567"), "airtel");
    assert.equal(c.momoNetworkOf("+250751234567"), null);
  });
});

describe("payout accounts", () => {
  const momo = (momoNetwork, momoPhone) => c.PayoutAccountInput.safeParse({ kind: "momo", accountName: "Josephine Mukamana", momoNetwork, momoPhone });
  const firstMessage = (r) => r.error.issues[0].message;

  test("a MoMo number is stored normalised and must be on the network picked", () => {
    const ok = momo("mtn", "0788 123 456");
    assert.equal(ok.success, true);
    assert.equal(ok.data.momoPhone, "+250788123456");
    assert.equal(momo("airtel", "+250 73 123 4567").data.momoPhone, "+250731234567");
    assert.equal(firstMessage(momo("mtn", "0721234567")), "MTN numbers start 078 or 079.");
    assert.equal(firstMessage(momo("airtel", "0788123456")), "Airtel numbers start 072 or 073.");
    assert.equal(firstMessage(momo("mtn", "0751234567")), "Enter a Rwandan mobile number, like 0788 123 456.");
  });

  test("a bank account number is 6 to 20 digits, and Other names its bank", () => {
    const bank = (extra) => c.PayoutAccountInput.safeParse({ kind: "bank", accountName: "Green Hills Ltd", bankName: "Bank of Kigali", accountNumber: "0001-2345 678", ...extra });
    assert.equal(bank({}).data.accountNumber, "00012345678");
    assert.equal(bank({ accountNumber: "12345" }).success, false);
    assert.equal(bank({ accountNumber: "1".repeat(21) }).success, false);
    assert.equal(bank({ bankName: "Not a bank" }).success, false);
    assert.equal(firstMessage(bank({ bankName: "Other" })), "Name the bank.");
    assert.equal(bank({ bankName: "Other", otherBankName: "Kigali Savings" }).success, true);
  });

  test("a MoMo Pay code is 4 to 10 digits", () => {
    const pay = (merchantCode) => c.PayoutAccountInput.safeParse({ kind: "momo_pay", accountName: "Green Hills Ltd", merchantCode });
    assert.equal(pay("12 34 56").data.merchantCode, "123456");
    assert.equal(pay("123").success, false);
    assert.equal(pay("12345678901").success, false);
    assert.equal(pay("12a456").success, false);
  });

  test("the account holder's name is required", () => {
    assert.equal(c.PayoutAccountInput.safeParse({ kind: "momo_pay", accountName: " ", merchantCode: "123456" }).success, false);
  });

  test("where the money goes, masked", () => {
    assert.equal(c.maskPayoutRef("0788123456"), "078••••456");
    assert.equal(c.maskPayoutRef("123456"), "•••456");
    assert.equal(c.maskPayoutRef("1234"), "1234");
    assert.equal(c.nationalPhone("+250788123456"), "0788123456");
    assert.equal(c.payoutDestinationWords({ kind: "momo", momoNetwork: "mtn", momoPhone: "+250788123456" }), "MTN MoMo 078••••456");
    assert.equal(c.payoutDestinationWords({ kind: "bank", bankName: "Bank of Kigali", accountNumber: "00012345678" }), "Bank of Kigali 000•••••678");
    assert.equal(c.payoutDestinationWords({ kind: "momo_pay", merchantCode: "123456" }), "MoMo Pay •••456");
  });
});
