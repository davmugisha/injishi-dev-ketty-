/**
 * Rentals (WP 1.6): when a reminder goes, what a tenant may pay, receipt
 * numbers, and the words of a charge.
 *
 *   pnpm --filter @injishi/contracts test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const c = require("../dist/index.js");

describe("reminder stages", () => {
  const due = "2026-11-05";
  const grace = 5;
  test("nothing more than three days before the due day", () => {
    assert.equal(c.reminderStageFor("2026-11-01", due, grace), null);
  });
  test("upcoming in the last three days", () => {
    assert.deepEqual(c.reminderStageFor("2026-11-02", due, grace), { kind: "upcoming", stage: 0 });
    assert.deepEqual(c.reminderStageFor("2026-11-04", due, grace), { kind: "upcoming", stage: 0 });
  });
  test("due on the day", () => {
    assert.deepEqual(c.reminderStageFor(due, due, grace), { kind: "due", stage: 0 });
  });
  test("nothing between the due day and the end of the grace days", () => {
    assert.equal(c.reminderStageFor("2026-11-06", due, grace), null);
    assert.equal(c.reminderStageFor("2026-11-10", due, grace), null);
  });
  test("overdue the day after the grace days, then 7 and 14 days later", () => {
    assert.deepEqual(c.reminderStageFor("2026-11-11", due, grace), { kind: "overdue", stage: 0 });
    assert.deepEqual(c.reminderStageFor("2026-11-17", due, grace), { kind: "overdue", stage: 0 });
    assert.deepEqual(c.reminderStageFor("2026-11-18", due, grace), { kind: "overdue", stage: 1 });
    assert.deepEqual(c.reminderStageFor("2026-11-25", due, grace), { kind: "overdue", stage: 2 });
    assert.deepEqual(c.reminderStageFor("2027-01-25", due, grace), { kind: "overdue", stage: 2 });
  });
  test("no grace days: overdue the day after the due day", () => {
    assert.deepEqual(c.reminderStageFor("2026-11-06", due, 0), { kind: "overdue", stage: 0 });
  });
});

describe("reminder hours", () => {
  test("Kigali is two hours ahead of UTC", () => {
    assert.equal(c.kigaliHour(new Date("2026-11-05T06:00:00Z")), 8);
    assert.equal(c.kigaliHour(new Date("2026-11-05T22:30:00Z")), 0);
  });
  test("sends from 08:00 and stops at 18:00", () => {
    assert.equal(c.withinReminderHours(new Date("2026-11-05T05:59:00Z")), false);
    assert.equal(c.withinReminderHours(new Date("2026-11-05T06:00:00Z")), true);
    assert.equal(c.withinReminderHours(new Date("2026-11-05T15:59:00Z")), true);
    assert.equal(c.withinReminderHours(new Date("2026-11-05T16:00:00Z")), false);
  });
});

describe("the words", () => {
  test("a charge in words", () => {
    assert.equal(c.chargeWords({ kind: "rent", periodStart: "2026-11-01", dueOn: "2026-11-05" }), "Rent for November 2026");
    assert.equal(c.chargeWords({ kind: "deposit", periodStart: null, dueOn: "2026-11-01" }), "Deposit");
  });
  test("one sentence per stage, no dashes", () => {
    const charge = { kind: "rent", periodStart: "2026-11-01", dueOn: "2026-11-05" };
    const base = { charge, owedRwf: 350_000, landlordName: "Amani Residences" };
    assert.equal(c.reminderSentence({ ...base, stage: "upcoming" }), "Your rent for November 2026 is RWF 350,000, due on 5 November 2026.");
    assert.equal(c.reminderSentence({ ...base, stage: "due" }), "Your rent for November 2026 is RWF 350,000 and is due today.");
    assert.equal(c.reminderSentence({ ...base, stage: "overdue" }), "Your rent for November 2026 of RWF 350,000 was due on 5 November 2026 and is now overdue.");
    assert.equal(c.reminderSentence({ ...base, stage: "manual" }), "A reminder from Amani Residences: RWF 350,000 for your rent for November 2026 is due on 5 November 2026.");
    for (const stage of ["upcoming", "due", "overdue", "manual"]) assert.equal(/[–—]/.test(c.reminderSentence({ ...base, stage })), false);
  });
  test("where a payment stands", () => {
    assert.equal(c.paymentStatusWords("pending"), "Waiting for you to approve the prompt on your phone.");
    assert.equal(c.paymentStatusWords("succeeded", { channel: "recorded" }), "Recorded by your landlord.");
    assert.equal(c.paymentStatusWords("failed", { failureReason: "The payment was declined." }), "The payment was declined.");
    assert.equal(c.paymentStatusWords("expired"), "The prompt on your phone expired before it was approved. Nothing was taken.");
  });
});

describe("paying through the gateway", () => {
  test("up to one month over what is owed, nothing when nothing is owed", () => {
    assert.equal(c.maxGatewayPaymentRwf(90_323, 350_000), 440_323);
    assert.equal(c.maxGatewayPaymentRwf(0, 350_000), 0);
  });
  test("the nine national digits", () => {
    assert.equal(c.nationalMsisdn("+250788123456"), "788123456");
  });
  test("the request normalises the number", () => {
    const parsed = c.TenantPayRequest.parse({ method: "mtn_momo", msisdn: "0788 123 456" });
    assert.equal(parsed.msisdn, "+250788123456");
    assert.equal(c.TenantPayRequest.safeParse({ method: "mtn_momo", msisdn: "12" }).success, false);
  });
});

describe("receipt numbers", () => {
  test("per year, padded, after the highest taken", () => {
    assert.equal(c.receiptNumber(2026, 1), "R-2026-0001");
    assert.equal(c.nextReceiptNumber(2026, []), "R-2026-0001");
    assert.equal(c.nextReceiptNumber(2026, ["R-2026-0007", "R-2025-0100", "R-2026-0003"]), "R-2026-0008");
  });
});

describe("the requests", () => {
  test("there is no request to record or reverse rent paid outside Injishi", () => {
    assert.equal(c.RecordLeasePaymentRequest, undefined);
    assert.equal(c.ReverseRentPaymentRequest, undefined);
  });
  test("a waiver says why", () => {
    assert.equal(c.WaiveChargeRequest.safeParse({ reason: "no" }).success, false);
    assert.equal(c.WaiveChargeRequest.safeParse({ reason: "Roof repairs" }).success, true);
  });
  test("a manual reminder names charges once each", () => {
    const id = "c0057a6c-6b10-4e75-a353-8ade84226697";
    assert.equal(c.RemindRentRequest.safeParse({ chargeIds: [id, id] }).success, false);
    assert.equal(c.RemindRentRequest.safeParse({ chargeIds: [] }).success, false);
    assert.equal(c.RemindRentRequest.safeParse({ chargeIds: [id], note: "Please pay by Friday." }).success, true);
  });
});
