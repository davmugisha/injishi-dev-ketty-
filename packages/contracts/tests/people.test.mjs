/**
 * The HR permissions and the two file shapes, pinned (ADR-058 AC-U6, AC-P2).
 *
 * Cross child contract 4 fixes seven permissions in the `people` area with a
 * default per role. This file holds the model to that table, holds ADR-055's
 * overrides to it (each of the seven moves; `team.manage` still does not), and
 * holds the basic file shape to having no field for a sensitive value.
 *
 *   pnpm --filter @injishi/contracts test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const c = require("../dist/index.js");

const HR = [
  "people.view",
  "people.manage",
  "roster.manage",
  "attendance.record",
  "attendance.approve",
  "leave.approve",
  "payroll.run",
];

/** Contract 4's table, row by row. */
const DEFAULTS = {
  owner: HR,
  manager: ["people.view", "roster.manage", "attendance.record", "attendance.approve", "leave.approve"],
  receptionist: ["attendance.record"],
  housekeeper: [],
};

describe("the seven HR permissions (AC-U6)", () => {
  test("all seven exist, each labelled, each in the people area", () => {
    for (const p of HR) {
      assert.ok(c.Permission.options.includes(p), `${p} is a permission`);
      assert.ok(c.PERMISSION_LABEL[p].length > 0, `${p} has a label`);
      assert.equal(c.PERMISSION_AREA_OF[p], "people", `${p} sits in people`);
    }
  });

  for (const [role, expected] of Object.entries(DEFAULTS)) {
    test(`${role} holds exactly its row of contract 4`, () => {
      const held = c.permissionsForRole(role).filter((p) => HR.includes(p));
      assert.deepEqual(held, expected);
    });
  }

  test("an owner may grant every HR permission to a manager, one by one", () => {
    for (const p of ["people.manage", "payroll.run"]) {
      const held = c.effectivePermissionsForRole("manager", [
        { orgRole: "manager", permission: p, granted: true },
      ]);
      assert.ok(held.includes(p), `${p} was granted`);
    }
  });

  test("an owner may withdraw one from the desk", () => {
    const held = c.effectivePermissionsForRole("receptionist", [
      { orgRole: "receptionist", permission: "attendance.record", granted: false },
    ]);
    assert.equal(held.includes("attendance.record"), false);
  });

  test("none of the seven is locked; team.manage stays the only one", () => {
    for (const p of HR) assert.equal(c.isLockedPermission(p), false, p);
    assert.deepEqual(c.LOCKED_PERMISSIONS, ["team.manage"]);
  });
});

describe("the two file shapes (AC-P2)", () => {
  const base = {
    id: "0f9a1b00-0000-4000-8000-000000000001",
    employeeNumber: "0001",
    legalName: "Uwase Aline",
    preferredName: null,
    displayName: "Uwase Aline",
    phone: "+250788123456",
    email: null,
    sex: "female",
    workPropertyId: null,
    workPropertyName: null,
    jobPositionId: null,
    jobPositionTitle: null,
    reportingManagerId: null,
    reportingManagerName: null,
    hiredOn: "2026-01-05",
    status: "active",
    offboardedOn: null,
    offboardReason: null,
    hasAccount: false,
    orgRole: null,
    detailsMissing: [],
    currentContract: null,
  };
  const sensitive = {
    dateOfBirth: "1994-03-02",
    idDocumentType: "national_id",
    idDocumentNumber: "1199480000000000",
    rssbNumber: "RS-1",
  };

  test("the basic shape strips every sensitive field", () => {
    const parsed = c.EmployeeBasic.parse({ ...base, ...sensitive, view: "basic" });
    for (const key of Object.keys(sensitive)) {
      assert.equal(key in parsed, false, `${key} does not survive the basic shape`);
    }
  });

  test("a basic contract carries no wage", () => {
    const parsed = c.EmploymentContractBasic.parse({
      view: "basic",
      id: base.id,
      employeeId: base.id,
      contractType: "permanent",
      startsOn: "2026-01-05",
      endsOn: null,
      wageBasis: "monthly",
      status: "active",
      endReason: null,
      wageRwf: 250000,
    });
    assert.equal("wageRwf" in parsed, false);
  });

  test("the full shape carries them", () => {
    const parsed = c.EmployeeFull.parse({ ...base, ...sensitive, view: "full" });
    assert.equal(parsed.idDocumentNumber, sensitive.idDocumentNumber);
  });
});

describe("requests", () => {
  test("a create normalises a Rwandan phone to E.164", () => {
    const parsed = c.CreateEmployeeRequest.parse({
      legalName: "Habimana Eric",
      phone: "0788 123 456",
      dateOfBirth: "1990-06-01",
      sex: "male",
      idDocumentType: "national_id",
      idDocumentNumber: "1199080000000000",
      hiredOn: "2026-02-01",
      workPropertyId: "0f9a1b00-0000-4000-8000-000000000002",
    });
    assert.equal(parsed.phone, "+250788123456");
  });

  test("an edit carries the ID type and number together or not at all", () => {
    assert.equal(c.UpdateEmployeeRequest.safeParse({ idDocumentNumber: "X123" }).success, false);
    assert.equal(
      c.UpdateEmployeeRequest.safeParse({ idDocumentType: "passport", idDocumentNumber: "PC123456" }).success,
      true,
    );
  });

  test("a pay period is YYYY-MM", () => {
    assert.equal(c.CreatePayRunRequest.safeParse({ period: "2026-09" }).success, true);
    assert.equal(c.CreatePayRunRequest.safeParse({ period: "2026-13" }).success, false);
  });
});
