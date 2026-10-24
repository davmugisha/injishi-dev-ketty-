/**
 * Rentals (blueprint WP 1.1): the vocabulary, the lease state machine, the
 * tabs, and the shapes that draft and edit a lease.
 *
 *   pnpm --filter @injishi/contracts test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const c = require("../dist/index.js");

const STATUSES = ["draft", "pending_signature", "signed", "active", "ending", "ended", "cancelled"];

describe("the vocabulary", () => {
  test("lease statuses, in the order a lease lives them", () => {
    assert.deepEqual(c.LeaseStatus.options, STATUSES);
    for (const s of STATUSES) assert.equal(typeof c.LEASE_STATUS_LABEL[s], "string");
  });

  test("the payment and charge lists the database enums are built from", () => {
    assert.deepEqual(c.LeaseChargeKind.options, ["rent", "deposit"]);
    assert.deepEqual(c.LeaseChargeStatus.options, ["open", "paid", "waived"]);
    assert.deepEqual(c.LeasePaymentChannel.options, ["gateway", "recorded"]);
    assert.deepEqual(c.LeasePaymentMethod.options, ["mtn_momo", "airtel_money", "card", "bank_transfer", "cash", "other"]);
    assert.deepEqual(c.LeasePaymentStatus.options, ["pending", "succeeded", "failed", "expired", "reversed"]);
    assert.deepEqual(c.LeaseDepositStatus.options, ["awaiting", "held", "settled"]);
    assert.deepEqual(c.MoveOutNoticeStatus.options, ["submitted", "acknowledged", "withdrawn"]);
    assert.deepEqual(c.LeaseFilingKind.options, ["new_lease", "change", "termination"]);
    assert.deepEqual(c.RentalUnitState.options, ["active", "off_market", "retired"]);
    assert.deepEqual(c.TaxpayerKind.options, ["individual", "company"]);
    assert.deepEqual(c.PayoutAccountKind.options, ["bank", "momo", "momo_pay"]);
    assert.deepEqual(c.LeaseReminderKind.options, ["upcoming", "due", "overdue", "manual"]);
    assert.deepEqual(c.LeaseSignerRole.options, ["landlord", "tenant"]);
    assert.deepEqual(c.LeaseSigningMethod.options, ["email_code", "password", "legacy"]);
    assert.deepEqual(c.IdKind.options, ["national_id", "passport"]);
  });

  test("only MoMo, Airtel and card go through the gateway", () => {
    assert.deepEqual(
      c.LeasePaymentMethod.options.filter((m) => c.isGatewayMethod(m)),
      ["mtn_momo", "airtel_money", "card"],
    );
  });

  test("Rwf is whole francs from 0 to ten billion", () => {
    assert.equal(c.Rwf.safeParse(0).success, true);
    assert.equal(c.Rwf.safeParse(10_000_000_000).success, true);
    assert.equal(c.Rwf.safeParse(10_000_000_001).success, false);
    assert.equal(c.Rwf.safeParse(-1).success, false);
    assert.equal(c.Rwf.safeParse(1.5).success, false);
    assert.equal(c.Rwf.safeParse("100").success, false);
    assert.equal(c.PositiveRwf.safeParse(0).success, false);
    assert.equal(c.PositiveRwf.safeParse(1).success, true);
    assert.equal(c.isRwf(5), true);
    assert.equal(c.isRwf(5.5), false);
  });

  test("money reads the same on every runtime", () => {
    assert.equal(c.formatRwf(400_000), "RWF 400,000");
    assert.equal(c.formatRwf(0), "RWF 0");
    assert.equal(c.formatRwf(1_234_567), "RWF 1,234,567");
    assert.equal(c.formatRwf(999), "RWF 999");
    assert.equal(c.prorateRwf(300_000, 16, 30), 160_000);
    assert.equal(c.prorateRwf(1, 1, 2), 1);
    assert.throws(() => c.prorateRwf(1, 1, 0), RangeError);
  });
});

describe("the lease state machine", () => {
  const ALLOWED = new Set([
    "draft>pending_signature",
    "draft>cancelled",
    "pending_signature>signed",
    "pending_signature>draft",
    "pending_signature>cancelled",
    "signed>active",
    "signed>cancelled",
    "active>ending",
    "ending>ended",
    "ending>active",
  ]);

  test("every move between two statuses is allowed or refused exactly as the blueprint says", () => {
    for (const from of STATUSES) {
      for (const to of STATUSES) {
        assert.equal(c.canTransition(from, to), ALLOWED.has(`${from}>${to}`), `${from} -> ${to}`);
      }
    }
  });

  test("each action takes each status where it should, and nowhere else", () => {
    const expected = {
      draft: { landlord_sign: "pending_signature", edit_terms: "draft", cancel: "cancelled" },
      pending_signature: { tenant_sign: "signed", edit_terms: "draft", cancel: "cancelled" },
      signed: { start: "active", cancel: "cancelled" },
      active: { acknowledge_notice: "ending", near_end: "ending" },
      ending: { record_move_out: "ended", withdraw_notice: "active" },
      ended: {},
      cancelled: {},
    };
    for (const from of STATUSES) {
      for (const action of c.LeaseAction.options) {
        assert.equal(c.nextLeaseStatus(from, action), expected[from][action] ?? null, `${from} + ${action}`);
      }
      assert.deepEqual(c.leaseActionsFrom(from).sort(), Object.keys(expected[from]).sort());
    }
  });

  test("editing voids the landlord's signature and returns the lease to draft", () => {
    assert.equal(c.nextLeaseStatus("pending_signature", "edit_terms"), "draft");
    assert.equal(c.editVoidsLandlordSignature("pending_signature"), true);
    assert.equal(c.nextLeaseStatus("draft", "edit_terms"), "draft");
    assert.equal(c.editVoidsLandlordSignature("draft"), false);
    for (const s of ["signed", "active", "ending", "ended", "cancelled"]) {
      assert.equal(c.canEditLease(s), false, s);
    }
    assert.equal(c.canEditLease("draft"), true);
    assert.equal(c.canEditLease("pending_signature"), true);
  });

  test("ended and cancelled are final", () => {
    for (const s of ["ended", "cancelled"]) {
      assert.equal(c.isFinalLease(s), true);
      assert.deepEqual(c.leaseActionsFrom(s), []);
      for (const to of STATUSES) assert.equal(c.canTransition(s, to), false);
    }
    assert.equal(c.isFinalLease("active"), false);
  });

  test("a lease that never started can be cancelled; one that started cannot", () => {
    assert.deepEqual(STATUSES.filter((s) => c.canTransition(s, "cancelled")), ["draft", "pending_signature", "signed"]);
  });

  test("the live statuses are the ones that hold the unit", () => {
    assert.deepEqual([...c.LIVE_LEASE_STATUSES], ["pending_signature", "signed", "active", "ending"]);
    assert.equal(c.isLiveLease("draft"), false);
    assert.equal(c.isLiveLease("ending"), true);
  });

  test("the daily job starts a signed lease on its start day and marks a near end", () => {
    const signed = { status: "signed", startDate: "2026-11-01", endDate: "2027-10-31" };
    assert.equal(c.scheduledLeaseAction(signed, { today: "2026-10-31" }), null);
    assert.equal(c.scheduledLeaseAction(signed, { today: "2026-11-01" }), "start");
    assert.equal(c.scheduledLeaseAction(signed, { today: "2026-11-01", autoStart: false }), null);
    const active = { status: "active", startDate: "2026-11-01", endDate: "2027-10-31" };
    assert.equal(c.scheduledLeaseAction(active, { today: "2027-09-30" }), null);
    assert.equal(c.scheduledLeaseAction(active, { today: "2027-10-01" }), "near_end");
    assert.equal(c.LEASE_ENDING_WINDOW_DAYS, 30);
    assert.equal(c.scheduledLeaseAction({ ...active, status: "ending" }, { today: "2027-10-30" }), null);
  });
});

describe("the tabs", () => {
  test("each status has its tab", () => {
    assert.deepEqual(
      STATUSES.map((s) => c.leaseTab(s)),
      ["to_sign", "waiting_for_tenant", "ready_to_start", "active", "ending", "ended", "cancelled"],
    );
  });

  test("the tabs read as the landlord sees them", () => {
    assert.deepEqual(
      c.LeaseTab.options.map((t) => c.LEASE_TAB_LABEL[t]),
      ["To sign", "Waiting for tenant", "Ready to start", "Active", "Ending", "Ended", "Cancelled"],
    );
  });

  test("a tab lists exactly its statuses", () => {
    assert.deepEqual(c.leaseStatusesForTab("to_sign"), ["draft"]);
    assert.deepEqual(c.leaseStatusesForTab("waiting_for_tenant"), ["pending_signature"]);
    assert.deepEqual(c.leaseStatusesForTab("ready_to_start"), ["signed"]);
    assert.deepEqual(c.leaseStatusesForTab("cancelled"), ["cancelled"]);
  });
});

describe("ID numbers", () => {
  test("a Rwandan national ID is 16 digits, spaces and dashes allowed", () => {
    assert.equal(c.idNumberProblem("national_id", "1199080012345012"), null);
    assert.equal(c.idNumberProblem("national_id", "1 1990 8 0012345 0 12"), null);
    assert.equal(c.idNumberProblem("national_id", "1199-0800-1234-5012"), null);
    assert.equal(c.idNumberProblem("national_id", "119908001234501"), "A Rwandan ID number has 16 digits.");
    assert.equal(c.idNumberProblem("national_id", "11990800123450123"), "A Rwandan ID number has 16 digits.");
    assert.equal(c.idNumberProblem("national_id", "11990800123450AB"), "A Rwandan ID number has 16 digits.");
  });

  test("a passport number is 5 to 20 letters or digits", () => {
    assert.equal(c.idNumberProblem("passport", "A1234"), null);
    assert.equal(c.idNumberProblem("passport", "pa 123-456"), null);
    assert.equal(c.normaliseIdNumber("pa 123-456"), "PA123456");
    assert.equal(c.idNumberProblem("passport", "A".repeat(20)), null);
    assert.equal(c.idNumberProblem("passport", "A123"), "A passport number is 5 to 20 letters or digits.");
    assert.equal(c.idNumberProblem("passport", "A".repeat(21)), "A passport number is 5 to 20 letters or digits.");
    assert.equal(c.idNumberProblem("passport", "AB12#45"), "A passport number is 5 to 20 letters or digits.");
  });

  test("an ID is read as a national ID for a Rwandan and a passport otherwise", () => {
    assert.equal(c.defaultIdKind("RW"), "national_id");
    assert.equal(c.defaultIdKind("KE"), "passport");
  });
});

describe("the email typo guard", () => {
  const cases = [
    ["alice@demo.injishi.con", "alice@demo.injishi.com"],
    ["aline@gmial.com", "aline@gmail.com"],
    ["aline@gmail.co", "aline@gmail.com"],
    ["aline@yaho.com", "aline@yahoo.com"],
    ["aline@hotmial.cm", "aline@hotmail.com"],
    ["aline@outlok.comm", "aline@outlook.com"],
    ["aline@icloud.ocm", "aline@icloud.com"],
    ["  Aline@GMIAL.com ", "aline@gmail.com"],
  ];
  for (const [typed, meant] of cases) {
    test(`suggests ${typed.trim()} -> ${meant}`, () => assert.equal(c.suggestEmailFix(typed), meant));
  }
  for (const fine of ["aline@example.rw", "aline@gmail.com", "aline@company.co", "aline@mtn.co.rw", "not-an-email", "a@b"]) {
    test(`leaves ${fine} alone`, () => assert.equal(c.suggestEmailFix(fine), null));
  }
  test("words the suggestion the same everywhere", () => {
    assert.equal(c.emailTypoMessage("a@gmail.com"), "Check the email. Did you mean a@gmail.com?");
  });
});

describe("drafting a lease", () => {
  const today = c.kigaliToday();
  const tenant = {
    fullName: "Aline Uwera",
    email: "aline@example.rw",
    phone: "0788 123 456",
    idKind: "national_id",
    idNumber: "1 1990 8 0012345 0 12",
    nationality: "RW",
  };
  const terms = {
    startDate: c.addDays(today, 7),
    endDate: c.addDays(c.addMonths(c.addDays(today, 7), 12), -1),
    monthlyRentRwf: 400_000,
    depositRwf: 800_000,
    rentDueDay: 5,
  };
  const base = { unitId: "44444444-4444-4444-4444-444444444444", tenant, terms };

  const issues = (r) => r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);

  test("a full draft parses, with the tenant normalised and the defaults filled", () => {
    const r = c.CreateLeaseRequest.safeParse(base);
    assert.equal(r.success, true, r.success ? "" : issues(r).join("; "));
    assert.equal(r.data.tenant.phone, "+250788123456");
    assert.equal(r.data.tenant.idNumber, "1199080012345012");
    assert.equal(r.data.terms.graceDays, 5);
    assert.equal(r.data.terms.noticeDays, 15);
    assert.deepEqual(r.data.terms.occupants, []);
  });

  test("an existing tenant is named by id instead", () => {
    const r = c.CreateLeaseRequest.safeParse({ ...base, tenant: undefined, tenantId: "55555555-5555-4555-8555-555555555555" });
    assert.equal(r.success, true);
  });

  test("a tenant is picked or added, not both and not neither", () => {
    assert.equal(c.CreateLeaseRequest.safeParse({ ...base, tenantId: "55555555-5555-4555-8555-555555555555" }).success, false);
    assert.equal(c.CreateLeaseRequest.safeParse({ ...base, tenant: undefined }).success, false);
  });

  test("a mistyped email is refused unless the landlord confirms it", () => {
    const typo = c.CreateLeaseRequest.safeParse({ ...base, tenant: { ...tenant, email: "aline@gmial.com" } });
    assert.equal(typo.success, false);
    assert.deepEqual(issues(typo), ["tenant.email: Check the email. Did you mean aline@gmail.com?"]);
    const confirmed = c.CreateLeaseRequest.safeParse({ ...base, tenant: { ...tenant, email: "aline@gmial.com" }, confirmEmail: true });
    assert.equal(confirmed.success, true);
  });

  test("the phone is a Rwandan mobile number", () => {
    assert.equal(c.CreateLeaseRequest.safeParse({ ...base, tenant: { ...tenant, phone: "+250 72 123 4567" } }).success, true);
    assert.equal(c.CreateLeaseRequest.safeParse({ ...base, tenant: { ...tenant, phone: "0252 123 456" } }).success, false);
    assert.equal(c.CreateLeaseRequest.safeParse({ ...base, tenant: { ...tenant, phone: "+254 712 345 678" } }).success, false);
  });

  test("the ID number is checked against its kind", () => {
    const short = c.CreateLeaseRequest.safeParse({ ...base, tenant: { ...tenant, idNumber: "123" } });
    assert.deepEqual(issues(short), ["tenant.idNumber: A Rwandan ID number has 16 digits."]);
    const passport = c.CreateLeaseRequest.safeParse({ ...base, tenant: { ...tenant, idKind: "passport", idNumber: "pa1234567", nationality: "KE" } });
    assert.equal(passport.success, true);
    assert.equal(passport.data.tenant.idNumber, "PA1234567");
    assert.equal(c.CreateLeaseRequest.safeParse({ ...base, tenant: { ...tenant, nationality: "ZZ" } }).success, false);
  });

  test("the terms: rent above 0, deposit 0 or more, due day 1 to 28, grace 0 to 31, notice at least 15", () => {
    const withTerms = (t) => c.CreateLeaseRequest.safeParse({ ...base, terms: { ...terms, ...t } }).success;
    assert.equal(withTerms({ monthlyRentRwf: 0 }), false);
    assert.equal(withTerms({ monthlyRentRwf: 1.5 }), false);
    assert.equal(withTerms({ depositRwf: 0 }), true);
    assert.equal(withTerms({ depositRwf: -1 }), false);
    assert.equal(withTerms({ rentDueDay: 0 }), false);
    assert.equal(withTerms({ rentDueDay: 1 }), true);
    assert.equal(withTerms({ rentDueDay: 28 }), true);
    assert.equal(withTerms({ rentDueDay: 29 }), false);
    assert.equal(withTerms({ graceDays: 0 }), true);
    assert.equal(withTerms({ graceDays: 31 }), true);
    assert.equal(withTerms({ graceDays: 32 }), false);
    assert.equal(withTerms({ noticeDays: 14 }), false);
    assert.equal(withTerms({ noticeDays: 15 }), true);
    assert.equal(withTerms({ noticeDays: 180 }), true);
    assert.equal(withTerms({ noticeDays: 181 }), false);
    assert.equal(withTerms({ occupants: ["Eric Mugisha", "Grace Uwase"] }), true);
    assert.equal(withTerms({ occupants: ["Eric Mugisha", "eric mugisha"] }), false);
    assert.equal(withTerms({ otherTerms: "No pets." }), true);
  });

  test("the dates are checked against Kigali today", () => {
    const old = c.CreateLeaseRequest.safeParse({
      ...base,
      terms: { ...terms, startDate: c.addDays(today, -31), endDate: c.addDays(today, 300) },
    });
    assert.deepEqual(issues(old), ["terms.startDate: Pick a start date no more than 30 days ago."]);
    const short = c.CreateLeaseRequest.safeParse({ ...base, terms: { ...terms, endDate: c.addDays(terms.startDate, 10) } });
    assert.deepEqual(issues(short), ["terms.endDate: A lease runs for at least one month."]);
    const brought = c.CreateLeaseRequest.safeParse({
      ...base,
      terms: { ...terms, startDate: c.addDays(today, -400), endDate: c.addDays(today, 300), billingStartsOn: today },
    });
    assert.equal(brought.success, true);
  });
});

describe("editing a lease", () => {
  test("only what is sent changes, and no default sneaks in", () => {
    const r = c.EditLeaseRequest.safeParse({ terms: { monthlyRentRwf: 350_000 } });
    assert.equal(r.success, true);
    assert.deepEqual(r.data.terms, { monthlyRentRwf: 350_000 });
  });

  test("an edit changes something", () => {
    assert.equal(c.EditLeaseRequest.safeParse({}).success, false);
    assert.equal(c.EditLeaseRequest.safeParse({ terms: {} }).success, false);
  });

  test("the tenant's new email and ID are checked like a draft's", () => {
    assert.equal(c.EditLeaseRequest.safeParse({ tenant: { email: "a@gmial.com" } }).success, false);
    assert.equal(c.EditLeaseRequest.safeParse({ tenant: { email: "a@gmial.com" }, confirmEmail: true }).success, true);
    assert.equal(c.EditLeaseRequest.safeParse({ tenant: { idKind: "national_id", idNumber: "12" } }).success, false);
  });

  test("an end before the start is refused when both are sent", () => {
    assert.equal(c.EditLeaseRequest.safeParse({ terms: { startDate: "2026-12-01", endDate: "2026-11-01" } }).success, false);
  });

  test("cancelling needs a reason", () => {
    assert.equal(c.CancelLeaseRequest.safeParse({ reason: "" }).success, false);
    assert.equal(c.CancelLeaseRequest.safeParse({ reason: "The tenant found another home." }).success, true);
  });
});
