/**
 * Rentals P4 (WP 4.4): the tax page's rules and requests. The tax itself is
 * pinned in rentals-money.test.mjs (the 434,000 example).
 *
 *   pnpm --filter @injishi/contracts test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const c = require("../dist/index.js");

describe("tax years", () => {
  test("2020 to this year; declared once the year is over", () => {
    assert.equal(c.taxYearProblem(2025, "2026-10-25"), null);
    assert.equal(c.taxYearProblem(2026, "2026-10-25"), null);
    assert.match(c.taxYearProblem(2019, "2026-10-25"), /2020/);
    assert.match(c.taxYearProblem(2027, "2026-10-25"), /hasn't started/);
    assert.equal(c.taxYearEnded(2025, "2026-01-01"), true);
    assert.equal(c.taxYearEnded(2026, "2026-12-31"), false);
    assert.deepEqual(c.taxYears("2022-05-01"), [2022, 2021, 2020]);
    assert.equal(c.rentalTaxDueOn(2025), "2026-01-31");
  });
});

describe("the declaration", () => {
  test("its days: after the year ended, not to come, paid on or after declared", () => {
    assert.equal(c.declarationDateProblem("2026-01-20", 2025, { today: "2026-10-25" }), null);
    assert.match(c.declarationDateProblem("2025-12-31", 2025, { today: "2026-10-25" }), /from 1 January 2026/);
    assert.match(c.declarationDateProblem("2026-10-26", 2025, { today: "2026-10-25" }), /hasn't happened/);
    assert.match(c.declarationDateProblem("2026-01-19", 2025, { today: "2026-10-25", notBefore: "2026-01-20" }), /before the declaration/);
  });

  test("declared needs the day; paid needs the day and the amount; not started needs nothing", () => {
    assert.equal(c.UpdateTaxDeclarationRequest.safeParse({ status: "not_started" }).success, true);
    assert.equal(c.UpdateTaxDeclarationRequest.safeParse({ status: "declared" }).success, false);
    assert.equal(c.UpdateTaxDeclarationRequest.safeParse({ status: "declared", declaredOn: "2026-01-20" }).success, true);
    assert.equal(c.UpdateTaxDeclarationRequest.safeParse({ status: "paid", declaredOn: "2026-01-20", paidOn: "2026-01-25" }).success, false);
    assert.equal(c.UpdateTaxDeclarationRequest.safeParse({ status: "paid", declaredOn: "2026-01-20", paidOn: "2026-01-25", amountPaidRwf: 434000 }).success, true);
    for (const s of c.TaxDeclarationStatus.options) assert.ok(c.TAX_DECLARATION_STATUS_LABEL[s]);
  });

  test("the taxpayer is a person or a company", () => {
    assert.equal(c.SetTaxpayerRequest.safeParse({ kind: "individual" }).success, true);
    assert.equal(c.SetTaxpayerRequest.safeParse({ kind: "trust" }).success, false);
  });
});

describe("lease filings", () => {
  test("filed from the day it was signed to today", () => {
    assert.equal(c.leaseFilingDateProblem("2026-10-25", "2026-10-24", "2026-10-25"), null);
    assert.match(c.leaseFilingDateProblem("2026-10-23", "2026-10-24", "2026-10-25"), /before the lease was signed/);
    assert.match(c.leaseFilingDateProblem("2026-10-26", "2026-10-24", "2026-10-25"), /hasn't happened/);
    assert.equal(c.leaseFilingDueOn("new_lease", "2026-10-24"), "2026-11-08");
    assert.equal(c.MarkFilingFiledRequest.safeParse({ filedOn: "2026-10-25", reference: "RRA-1" }).success, true);
    assert.equal(c.MarkFilingFiledRequest.safeParse({ filedOn: "25/10/2026" }).success, false);
  });
});
