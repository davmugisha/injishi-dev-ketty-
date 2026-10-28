/**
 * Rentals P4 (WP 4.3): expenses and paying a fault's fixer.
 *
 *   pnpm --filter @injishi/contracts test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const c = require("../dist/index.js");

const today = c.kigaliToday();

describe("recording an expense", () => {
  const base = { category: "security", amountRwf: 80_000, paidOn: today, method: "cash" };

  test("a plain expense needs a day that happened, from 2000 on, and an amount above 0", () => {
    assert.equal(c.RecordExpenseRequest.safeParse(base).success, true);
    assert.equal(c.RecordExpenseRequest.safeParse({ ...base, paidOn: c.addDays(today, 1) }).success, false);
    assert.equal(c.RecordExpenseRequest.safeParse({ ...base, paidOn: "1999-12-31" }).success, false);
    assert.equal(c.RecordExpenseRequest.safeParse({ ...base, amountRwf: 0 }).success, false);
    assert.equal(c.RecordExpenseRequest.safeParse({ ...base, amountRwf: 1.5 }).success, false);
  });

  test("loan interest names the lender and what the loan was for; nothing else has a loan purpose", () => {
    const loan = { ...base, category: "loan_interest", payeeName: "Bank of Kigali" };
    assert.equal(c.RecordExpenseRequest.safeParse(loan).success, false);
    assert.equal(c.RecordExpenseRequest.safeParse({ ...loan, loanPurpose: "build" }).success, true);
    assert.equal(c.RecordExpenseRequest.safeParse({ ...loan, loanPurpose: "buy" }).success, true);
    assert.equal(c.RecordExpenseRequest.safeParse({ ...loan, payeeName: undefined, loanPurpose: "build" }).success, false);
    assert.equal(c.RecordExpenseRequest.safeParse({ ...base, loanPurpose: "build" }).success, false);
  });

  test("a payee phone is a Rwandan mobile number", () => {
    assert.equal(c.RecordExpenseRequest.parse({ ...base, payeePhone: "0788 000 111" }).payeePhone, "+250788000111");
    assert.equal(c.RecordExpenseRequest.safeParse({ ...base, payeePhone: "12345" }).success, false);
  });

  test("a void needs its reason", () => {
    assert.equal(c.VoidExpenseRequest.safeParse({ reason: "" }).success, false);
    assert.equal(c.VoidExpenseRequest.safeParse({ reason: "Recorded twice" }).success, true);
  });

  test("every category, method and source has a label", () => {
    for (const k of c.ExpenseCategory.options) assert.ok(c.EXPENSE_CATEGORY_LABEL[k], k);
    for (const k of c.ExpenseMethod.options) assert.ok(c.EXPENSE_METHOD_LABEL[k], k);
    for (const k of c.ExpenseSource.options) assert.ok(c.EXPENSE_SOURCE_LABEL[k], k);
    for (const k of c.LoanPurpose.options) assert.ok(c.LOAN_PURPOSE_LABEL[k], k);
  });
});

describe("paying the fixer", () => {
  test("through Injishi: an amount from 100 to 10 million, a payee on MoMo or a bank, the landlord's phone", () => {
    const ok = { amountRwf: 25_000, payeeName: "Eric", payee: { kind: "momo", phone: "0788 000 111" }, payerPhone: "0788 301 122" };
    const parsed = c.PayFixerRequest.parse(ok);
    assert.equal(parsed.payee.phone, "+250788000111");
    assert.equal(parsed.payerPhone, "+250788301122");
    assert.equal(c.PayFixerRequest.safeParse({ ...ok, amountRwf: 99 }).success, false);
    assert.equal(c.PayFixerRequest.safeParse({ ...ok, amountRwf: 10_000_001 }).success, false);
    assert.equal(c.PayFixerRequest.safeParse({ ...ok, payee: { kind: "bank", bankName: "Bank of Kigali", accountNumber: "0004-0012 3456" } }).success, true);
    assert.equal(c.PayFixerRequest.safeParse({ ...ok, payee: { kind: "bank", bankName: "Bank of Kigali", accountNumber: "12" } }).success, false);
    assert.equal(c.PayFixerRequest.safeParse({ ...ok, payerPhone: "0712 000 000" }).success, false);
  });

  test("recorded: from the day the fault was reported to today", () => {
    assert.equal(c.faultPaymentDateProblem(today, c.addDays(today, -5), today), null);
    assert.equal(c.faultPaymentDateProblem(c.addDays(today, -5), c.addDays(today, -5), today), null);
    assert.match(c.faultPaymentDateProblem(c.addDays(today, -6), c.addDays(today, -5), today), /reported/);
    assert.match(c.faultPaymentDateProblem(c.addDays(today, 1), c.addDays(today, -5), today), /hasn't happened/);
    assert.equal(c.RecordFaultPaymentRequest.safeParse({ amountRwf: 5_000, paidOn: today, method: "cash", payeeName: "E" }).success, false);
  });

  test("the year an expense list can be about", () => {
    assert.equal(c.expenseYearProblem(2026, "2026-10-25"), null);
    assert.match(c.expenseYearProblem(2027, "2026-10-25"), /hasn't started/);
    assert.match(c.expenseYearProblem(1999, "2026-10-25"), /2000/);
  });
});
