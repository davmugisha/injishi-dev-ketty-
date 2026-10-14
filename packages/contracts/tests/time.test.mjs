/**
 * Time's request shapes, pinned (ADR-058, 058-time).
 *
 * The rules a form leans on before the API sees it: a publish or a request
 * spans at most a month, a rotation's rule value fits its rule, a PIN is 4 to
 * 6 digits, a kiosk code 8, and an attendance request ends after it starts.
 * The monthly summary has no employee on a person's own month, and nothing
 * about a person's location is more than a distance.
 *
 *   pnpm --filter @injishi/contracts test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const c = require("../dist/index.js");

const BRANCH = "de300000-0000-4000-8000-000000000401";
const PERSON = "11111111-1111-4111-8111-111111111111";
const COLLEAGUE = "22222222-2222-4222-8222-222222222222";
const SHIFT = "33333333-3333-4333-8333-333333333333";

describe("publishing and requests span at most a month (AC-TM1, AC-TM5)", () => {
  test("a week publishes; 31 days is the most", () => {
    assert.equal(c.PublishRosterRequest.safeParse({ propertyId: BRANCH, from: "2026-10-12", to: "2026-10-18" }).success, true);
    assert.equal(c.PublishRosterRequest.safeParse({ propertyId: BRANCH, from: "2026-10-01", to: "2026-10-31" }).success, true);
    assert.equal(c.PublishRosterRequest.safeParse({ propertyId: BRANCH, from: "2026-10-01", to: "2026-11-01" }).success, false);
    assert.equal(c.PublishRosterRequest.safeParse({ propertyId: BRANCH, from: "2026-10-18", to: "2026-10-12" }).success, false);
  });

  test("a change names a shift and a swap a colleague, never both", () => {
    const range = { from: "2026-10-12", to: "2026-10-12", reason: "School run" };
    assert.equal(c.CreateMyShiftRequestRequest.safeParse({ ...range, kind: "change", shiftTemplateId: SHIFT }).success, true);
    assert.equal(c.CreateMyShiftRequestRequest.safeParse({ ...range, kind: "swap", swapEmployeeId: COLLEAGUE }).success, true);
    assert.equal(c.CreateMyShiftRequestRequest.safeParse({ ...range, kind: "swap", shiftTemplateId: SHIFT }).success, false);
    assert.equal(
      c.CreateShiftRequestRequest.safeParse({ ...range, kind: "change", shiftTemplateId: SHIFT }).success,
      false,
      "on someone's behalf, the person is named",
    );
    assert.equal(c.CreateShiftRequestRequest.safeParse({ ...range, kind: "change", employeeId: PERSON, shiftTemplateId: SHIFT }).success, true);
  });

  test("a request says why, in more than two letters", () => {
    assert.equal(
      c.CreateMyShiftRequestRequest.safeParse({ from: "2026-10-12", to: "2026-10-12", kind: "change", shiftTemplateId: SHIFT, reason: "no" }).success,
      false,
    );
  });
});

describe("rotations (AC-TM3)", () => {
  const base = { propertyId: BRANCH, name: "Two by two", steps: [SHIFT, "off"] };
  test("every few days is 1 to 28; a weekday 0 to 6; a day of the month 1 to 28", () => {
    assert.equal(c.CreateRotationPatternRequest.safeParse({ ...base, rule: "every_n_days", ruleValue: 2 }).success, true);
    assert.equal(c.CreateRotationPatternRequest.safeParse({ ...base, rule: "every_n_days", ruleValue: 0 }).success, false);
    assert.equal(c.CreateRotationPatternRequest.safeParse({ ...base, rule: "weekly", ruleValue: 0 }).success, true);
    assert.equal(c.CreateRotationPatternRequest.safeParse({ ...base, rule: "weekly", ruleValue: 7 }).success, false);
    assert.equal(c.CreateRotationPatternRequest.safeParse({ ...base, rule: "monthly", ruleValue: 28 }).success, true);
    assert.equal(c.CreateRotationPatternRequest.safeParse({ ...base, rule: "monthly", ruleValue: 29 }).success, false);
  });

  test("a rotation has two to 28 steps, each a shift or a day off", () => {
    assert.equal(c.CreateRotationPatternRequest.safeParse({ ...base, steps: [SHIFT], rule: "weekly", ruleValue: 1 }).success, false);
    assert.equal(c.CreateRotationPatternRequest.safeParse({ ...base, steps: [SHIFT, "rest"], rule: "weekly", ruleValue: 1 }).success, false);
  });

  test("a pattern's steps never change once written: only its name and status", () => {
    assert.equal(c.UpdateRotationPatternRequest.safeParse({ status: "archived" }).success, true);
    assert.equal("steps" in c.UpdateRotationPatternRequest.parse({ name: "New", steps: [SHIFT, "off"] }), false);
    assert.equal(c.UpdateRotationPatternRequest.safeParse({}).success, false);
  });
});

describe("attendance requests (AC-TM6)", () => {
  test("the clock out comes after the clock in", () => {
    const ask = { workDate: "2026-10-03", clockInAt: "2026-10-03T05:00:00.000Z", clockOutAt: "2026-10-03T13:00:00.000Z", reason: "The tablet was down" };
    assert.equal(c.CreateMyAttendanceRequestRequest.safeParse(ask).success, true);
    assert.equal(c.CreateMyAttendanceRequestRequest.safeParse({ ...ask, clockOutAt: ask.clockInAt }).success, false);
    assert.equal(c.CreateAttendanceRequestRequest.safeParse(ask).success, false, "on someone's behalf, the person is named");
    assert.equal(c.CreateAttendanceRequestRequest.safeParse({ ...ask, employeeId: PERSON }).success, true);
  });
});

describe("kiosks and PINs (AC-TM10, AC-TM11)", () => {
  test("a PIN is 4 to 6 digits, a pairing code 8", () => {
    for (const pin of ["1234", "123456"]) assert.equal(c.SetKioskPinRequest.safeParse({ pin }).success, true, pin);
    for (const pin of ["123", "1234567", "12a4"]) assert.equal(c.SetKioskPinRequest.safeParse({ pin }).success, false, pin);
    assert.equal(c.KioskPairRequest.safeParse({ code: "01234567" }).success, true);
    assert.equal(c.KioskPairRequest.safeParse({ code: "1234567" }).success, false);
  });

  test("the kiosk's session names a kiosk and a branch, and nothing else", () => {
    assert.deepEqual(Object.keys(c.KioskSession.shape).sort(), ["branchName", "kioskName"]);
    assert.deepEqual(Object.keys(c.KioskPunchResult.shape).sort(), ["at", "direction", "displayName"]);
  });
});

describe("what a reader sees (AC-TM9, AC-TM13)", () => {
  test("a record's location is distances and accuracy, never a point", () => {
    const keys = Object.keys(c.AttendanceLocation.shape).sort();
    assert.deepEqual(keys, ["inAccuracyM", "inDistanceM", "outAccuracyM", "outDistanceM"]);
  });

  test("a person's own month carries no employee: it is theirs", () => {
    assert.equal("employee" in c.MyMonthlySummary.shape.summary.shape, false);
  });

  test("a geofence radius is 25 m to 2 km, and a centre a real point", () => {
    assert.equal(c.PutBranchClockSettingsRequest.safeParse({ geofenceRadiusM: 150 }).success, true);
    assert.equal(c.PutBranchClockSettingsRequest.safeParse({ geofenceRadiusM: 10 }).success, false);
    assert.equal(c.PutBranchClockSettingsRequest.safeParse({ geofenceRadiusM: 150, centre: { lat: -1.94, lng: 30.06 } }).success, true);
    assert.equal(c.PutBranchClockSettingsRequest.safeParse({ geofenceRadiusM: 150, centre: { lat: -91, lng: 30.06 } }).success, false);
    assert.equal(c.PutBranchClockSettingsRequest.safeParse({ geofenceRadiusM: 150, centre: null }).success, true);
  });
});
