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

  test("HR_PERMISSIONS is the seven, the one list the nav and the routes share (058-people-file)", () => {
    assert.deepEqual([...c.HR_PERMISSIONS], HR);
    // The people area also holds the two that decide who works here; neither is an HR read.
    for (const p of ["team.manage", "department.manage"]) assert.equal(c.HR_PERMISSIONS.includes(p), false, p);
  });
});

describe("the two file shapes (AC-P2, 058-people-file AC-PF2)", () => {
  const base = {
    id: "0f9a1b00-0000-4000-8000-000000000001",
    employeeNumber: "0001",
    legalName: "Uwase Aline",
    preferredName: null,
    displayName: "Uwase Aline",
    phone: "+250788123456",
    email: null,
    hasPhoto: false,
    workPropertyId: null,
    workPropertyName: null,
    jobPositionId: null,
    jobPositionTitle: null,
    reportingManagerId: null,
    reportingManagerName: null,
    hiredOn: "2026-01-05",
    status: "active",
    offboardedOn: null,
    employeeType: null,
    tags: [],
    qualification: null,
    priorExperienceYears: null,
    hasAccount: false,
    orgRole: null,
    detailsMissing: [],
    currentContract: null,
  };
  // Every personal field of the matrix: the basic view must drop each one.
  const sensitive = {
    sex: "female",
    dateOfBirth: "1994-03-02",
    idDocumentType: "national_id",
    idDocumentNumber: "1199480000000000",
    rssbNumber: "RS-1",
    maritalStatus: "married",
    childrenCount: 2,
    address: {
      villageId: 1,
      villageName: "Rugando",
      cellName: "Rukiri I",
      sectorName: "Remera",
      districtName: "Gasabo",
      street: "KG 11 Ave",
    },
    emergencyContact: { name: "Mukamana Béatrice", phone: "+250788000111", relation: "Sister" },
    offboardReason: "Moved to Musanze",
    serviceFrom: "2026-01-05",
    previousEmployeeId: null,
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
      endReason: "Replaced by a new contract",
      wageRwf: 250000,
    });
    assert.equal("wageRwf" in parsed, false);
    assert.equal("endReason" in parsed, false, "an end reason can say why someone left");
  });

  test("the full shape carries them", () => {
    const parsed = c.EmployeeFull.parse({ ...base, ...sensitive, view: "full" });
    for (const key of Object.keys(sensitive)) {
      assert.deepEqual(parsed[key], sensitive[key], `${key} survives the full shape`);
    }
  });

  test("a rehire is a create naming the old file", () => {
    const parsed = c.CreateEmployeeRequest.parse({
      legalName: "Habimana Eric",
      phone: "0788 123 456",
      dateOfBirth: "1990-06-01",
      sex: "male",
      idDocumentType: "national_id",
      idDocumentNumber: "1199080000000000",
      hiredOn: "2026-02-01",
      workPropertyId: "0f9a1b00-0000-4000-8000-000000000002",
      rehireOf: "0f9a1b00-0000-4000-8000-000000000009",
    });
    assert.equal(parsed.rehireOf, "0f9a1b00-0000-4000-8000-000000000009");
  });

  test("an edit refuses children past 30 and experience past 60 (AC-PF1)", () => {
    assert.equal(c.UpdateEmployeeRequest.safeParse({ childrenCount: 31 }).success, false);
    assert.equal(c.UpdateEmployeeRequest.safeParse({ priorExperienceYears: 61 }).success, false);
    assert.equal(c.UpdateEmployeeRequest.safeParse({ childrenCount: 30, priorExperienceYears: 60 }).success, true);
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

  test("a job position travels on create and edit, and null clears it (AC-PF11)", () => {
    const position = "0f9a1b00-0000-4000-8000-0000000000aa";
    assert.equal(c.UpdateEmployeeRequest.parse({ jobPositionId: position }).jobPositionId, position);
    assert.equal(c.UpdateEmployeeRequest.parse({ jobPositionId: null }).jobPositionId, null);
    assert.equal(c.UpdateEmployeeRequest.safeParse({ jobPositionId: "not-a-uuid" }).success, false);
  });

  test("the file's new fields are bounded as AC-PF1 says", () => {
    assert.equal(c.UpdateEmployeeRequest.safeParse({ childrenCount: 30 }).success, true);
    assert.equal(c.UpdateEmployeeRequest.safeParse({ childrenCount: 31 }).success, false);
    assert.equal(c.UpdateEmployeeRequest.safeParse({ priorExperienceYears: 60 }).success, true);
    assert.equal(c.UpdateEmployeeRequest.safeParse({ priorExperienceYears: 61 }).success, false);
    assert.equal(c.UpdateEmployeeRequest.parse({ emergencyPhone: "0788 123 999" }).emergencyPhone, "+250788123999");
    assert.equal(c.UpdateEmployeeRequest.safeParse({ tagIds: Array(21).fill("0f9a1b00-0000-4000-8000-0000000000aa") }).success, false);
  });

  test("the Employees lens filters by employee type and tag; a tag never groups (AC-PF13)", () => {
    const fields = Object.fromEntries(c.EMPLOYEE_LIST.fields.map((f) => [f.key, f]));
    assert.equal(fields.employeeType.filterable && fields.employeeType.groupable, true);
    assert.equal(fields.tag.filterable, true);
    assert.equal(Boolean(fields.tag.groupable), false);
  });

  test("a pay period is YYYY-MM", () => {
    assert.equal(c.CreatePayRunRequest.safeParse({ period: "2026-09" }).success, true);
    assert.equal(c.CreatePayRunRequest.safeParse({ period: "2026-13" }).success, false);
  });
});

describe("the people file's requests (058-people-file)", () => {
  const someone = "0f9a1b00-0000-4000-8000-0000000000bb";

  test("a document request names closed formats and at most 10 MB (AC-PF4)", () => {
    const ok = { title: "National ID copy", formats: ["pdf", "jpg"], maxMb: 10, employeeIds: [someone] };
    assert.equal(c.CreateDocumentRequestRequest.safeParse(ok).success, true);
    assert.equal(c.CreateDocumentRequestRequest.safeParse({ ...ok, formats: ["docx"] }).success, false);
    assert.equal(c.CreateDocumentRequestRequest.safeParse({ ...ok, maxMb: 11 }).success, false);
    assert.equal(c.CreateDocumentRequestRequest.safeParse({ ...ok, formats: [] }).success, false);
  });

  test("an upload names its requested document or a new title, never both", () => {
    const fileKey = "staff_document/abc.pdf";
    assert.equal(c.UploadEmployeeDocumentRequest.safeParse({ documentId: someone, fileKey }).success, true);
    assert.equal(c.UploadEmployeeDocumentRequest.safeParse({ title: "Food handler certificate", fileKey }).success, true);
    assert.equal(c.UploadEmployeeDocumentRequest.safeParse({ fileKey }).success, false);
    assert.equal(c.UploadEmployeeDocumentRequest.safeParse({ documentId: someone, title: "Both", fileKey }).success, false);
  });

  test("a refusal says why; an approval needs nothing", () => {
    assert.equal(c.DecideDocumentRequest.safeParse({ decision: "approve" }).success, true);
    assert.equal(c.DecideDocumentRequest.safeParse({ decision: "reject" }).success, false);
    assert.equal(c.DecideDocumentRequest.safeParse({ decision: "reject", reason: "Cut off." }).success, true);
  });

  test("a pay account is a bank account or MoMo, never a mix (AC-PF3)", () => {
    assert.equal(c.CreatePayAccountRequest.safeParse({ kind: "bank", bankName: "Bank of Kigali", accountNumber: "00040-0123456-78" }).success, true);
    assert.equal(c.CreatePayAccountRequest.safeParse({ kind: "bank", bankName: "BK", accountNumber: "abc12" }).success, false);
    assert.equal(c.CreatePayAccountRequest.safeParse({ kind: "momo", momoPhone: "0788 765 432" }).success, true);
    assert.equal(c.CreatePayAccountRequest.safeParse({ kind: "momo", bankName: "BK" }).success, false);
  });

  test("a targeted policy names somebody; everyone needs no targets (AC-PF7)", () => {
    const none = { departmentIds: [], jobPositionIds: [], employeeIds: [] };
    assert.equal(c.CreateStaffPolicyRequest.safeParse({ title: "Uniform", body: "Badge on.", audience: "all" }).success, true);
    assert.equal(c.CreateStaffPolicyRequest.safeParse({ title: "Uniform", body: "Badge on.", audience: "targeted", targets: none }).success, false);
    assert.equal(
      c.CreateStaffPolicyRequest.safeParse({ title: "Uniform", body: "Badge on.", audience: "targeted", targets: { ...none, employeeIds: [someone] } }).success,
      true,
    );
  });

  test("a disciplinary length comes with its unit, or neither (AC-PF8)", () => {
    const base = { employeeIds: [someone], typeId: someone, description: "Late again.", startsOn: "2026-10-05" };
    assert.equal(c.CreateDisciplinaryActionRequest.safeParse(base).success, true);
    assert.equal(c.CreateDisciplinaryActionRequest.safeParse({ ...base, unit: "days", length: 3 }).success, true);
    assert.equal(c.CreateDisciplinaryActionRequest.safeParse({ ...base, unit: "days" }).success, false);
    assert.equal(c.CreateDisciplinaryActionRequest.safeParse({ ...base, length: 3 }).success, false);
  });

  test("an HR number prefix is up to 8 capitals, digits or dashes, upper cased on the way in (AC-PF12)", () => {
    assert.equal(c.UpdateHrSettingsRequest.parse({ employeeNumberPrefix: "amh-" }).employeeNumberPrefix, "AMH-");
    assert.equal(c.UpdateHrSettingsRequest.parse({ employeeNumberPrefix: null }).employeeNumberPrefix, null);
    assert.equal(c.UpdateHrSettingsRequest.safeParse({ employeeNumberPrefix: "TOOLONGPREFIX" }).success, false);
    assert.equal(c.UpdateHrSettingsRequest.safeParse({ employeeNumberPrefix: "A B" }).success, false);
  });
});
