/**
 * The authorization model, pinned.
 *
 * THIS FILE WAS CLAIMED TO EXIST FOR MONTHS AND DID NOT. `progress-tracker.md`
 * said the registration gate was "pinned by four tests in
 * `packages/contracts/tests/authz.test.mjs`"; there was no such file, under that
 * path or any other, and `packages/contracts` shipped no tests at all. The rule
 * it named — that an owner of a business still in the registration pipeline
 * holds the role and none of its powers — was enforced in code, believed to be
 * covered, and checked by nothing.
 *
 * WHY THIS AND NOT THE VERIFY SCRIPTS. `server/api/scripts/verify-authz.mjs`
 * proves the model and the seeded rows agree, and `verify-authz-http.mjs` proves
 * the API refuses. Both are worth having and neither can run here: one needs a
 * seeded Postgres, the other a booted API and an OTP budget. This file needs
 * nothing, so it is the copy that can run on every change.
 *
 * It tests the BUILT module (`dist/`), because `dist/` is what every consumer
 * imports — `@injishi/contracts` is a compiled package. `pnpm test` builds
 * first, so a stale `dist/` cannot pass a test the source would fail.
 *
 *   pnpm --filter @injishi/contracts test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const authz = require("../dist/index.js");

const {
  Permission,
  PERMISSION_LABEL,
  REGISTRATION_STAGE_MESSAGE,
  can,
  permissionsForRole,
  permissionsForWorkspace,
  workspaceAllows,
  isOperational,
  oversightConsoleFor,
  withinScope,
  violatesSeparationOfDuties,
  mayElevate,
} = authz;

/** Every registration status that is not `active`. The gate's whole domain. */
const NOT_ACTIVE = [
  "pending_payment",
  "submitted",
  "tin_verified",
  "field_verified",
  "approved",
  "rejected",
  "suspended",
];

const ROLES = ["owner", "manager", "receptionist", "housekeeper"];

// ---------------------------------------------------------------------------

describe("the four org roles", () => {
  /*
   * Pinned as exact sets rather than as counts. A count catches a permission
   * being dropped and misses one being SWAPPED for another, which is the
   * change that actually moves a boundary: receptionist losing `stay.checkin`
   * and gaining `money.view` keeps the count at 8.
   */
  test("owner holds every permission there is", () => {
    assert.deepEqual(permissionsForRole("owner"), Permission.options);
    assert.equal(permissionsForRole("owner").length, 26);
  });

  test("manager holds everything except team.manage", () => {
    assert.deepEqual(
      permissionsForRole("manager"),
      Permission.options.filter((p) => p !== "team.manage"),
    );
    assert.equal(permissionsForRole("manager").length, 25);
  });

  test("receptionist works the front desk and takes orders", () => {
    assert.deepEqual(permissionsForRole("receptionist"), [
      "reservation.approve",
      "reservation.assign",
      "stay.checkin",
      "stay.checkout",
      "folio.charge",
      "folio.payment",
      "order.advance",
      "message.send",
      // ADR-050 D-t: signing a correct sale at the desk is the desk's job.
      "folio.close",
    ]);
  });

  test("housekeeper is the phone: room status and tickets, nothing else", () => {
    assert.deepEqual(permissionsForRole("housekeeper"), [
      "housekeeping.set",
      "ticket.advance",
    ]);
  });

  test("an unknown role holds nothing rather than throwing", () => {
    // `can` is reached with whatever the database returned. A role name that
    // is not in the map must deny, never crash the guard into a 500 that a
    // caller could mistake for an outage.
    assert.equal(can("caretaker", "stay.checkin"), false);
    assert.equal(can(undefined, "stay.checkin"), false);
    assert.equal(can(null, "stay.checkin"), false);
  });
});

describe("owner and manager are different roles", () => {
  /*
   * They were byte-identical until 2026-09-12 — `new Set(ALL)` twice — so the
   * two roles differed in name only and "a manager sees less" was an assertion
   * nothing had ever checked.
   */
  test("owner and manager are not the same set", () => {
    assert.notDeepEqual(permissionsForRole("owner"), permissionsForRole("manager"));
  });

  test("team.manage is the owner's alone", () => {
    // Deciding who works at a business outlives any one manager's tenure, and
    // a manager holding it could remove the people the owner put there.
    assert.equal(can("owner", "team.manage"), true);
    assert.equal(can("manager", "team.manage"), false);
    assert.equal(can("receptionist", "team.manage"), false);
    assert.equal(can("housekeeper", "team.manage"), false);
  });

  test("ebm.manage stays with the manager, as ADR-041 D-o ratified", () => {
    // Deliberately NOT owner-only. D-o decided owner-and-manager on
    // 2026-09-11 and `navFor` built the Settings -> Integrations door to
    // match; if this ever fails, a manager has a door that refuses them.
    assert.equal(can("owner", "ebm.manage"), true);
    assert.equal(can("manager", "ebm.manage"), true);
    assert.equal(can("receptionist", "ebm.manage"), false);
  });

  test("a receptionist may sign a sale and may not withdraw one (ADR-050 AC-8)", () => {
    // The asymmetry that matches the risk: creating a declaration is routine,
    // withdrawing one reduces declared turnover and needs a manager.
    assert.equal(can("receptionist", "folio.close"), true);
    assert.equal(can("receptionist", "ebm.refund"), false);
    assert.equal(can("receptionist", "outlet.manage"), false);
    assert.equal(can("manager", "ebm.refund"), true);
    assert.equal(can("manager", "outlet.manage"), true);
    for (const p of ["folio.close", "ebm.refund", "outlet.manage"]) {
      assert.equal(can("housekeeper", p), false, `housekeeper must not hold ${p}`);
    }
  });

  test("the money and team boundary below manager holds", () => {
    for (const p of ["money.view", "team.manage", "department.manage"]) {
      assert.equal(can("receptionist", p), false, `receptionist must not hold ${p}`);
      assert.equal(can("housekeeper", p), false, `housekeeper must not hold ${p}`);
    }
  });
});

describe("the registration gate (D20, D23)", () => {
  /*
   * The rule this file was said to cover and did not: an owner of a business
   * still in the pipeline holds the ROLE and none of its POWERS, so a pending
   * org can list no inventory, take no money and invite no staff.
   */
  test("an active business resolves the role's full set", () => {
    assert.deepEqual(
      permissionsForWorkspace({
        kind: "business",
        orgRole: "owner",
        registrationStatus: "active",
      }),
      permissionsForRole("owner"),
    );
  });

  test("every stage before active resolves an EMPTY set, for every role", () => {
    for (const status of NOT_ACTIVE) {
      for (const role of ROLES) {
        assert.deepEqual(
          permissionsForWorkspace({ kind: "business", orgRole: role, registrationStatus: status }),
          [],
          `${role} at ${status} must hold nothing`,
        );
      }
    }
  });

  test("a null status is not treated as active", () => {
    // A missing status means the read did not fetch it. Resolving that as
    // operational would open every power on a row nobody checked — and
    // `verify-authz.mjs` passed `undefined` here for months, which made every
    // business workspace it resolved come back empty.
    assert.deepEqual(
      permissionsForWorkspace({ kind: "business", orgRole: "owner", registrationStatus: null }),
      [],
    );
    assert.deepEqual(
      permissionsForWorkspace({ kind: "business", orgRole: "owner", registrationStatus: undefined }),
      [],
    );
  });

  test("isOperational is true for active and nothing else", () => {
    assert.equal(isOperational("active"), true);
    for (const status of NOT_ACTIVE) assert.equal(isOperational(status), false, status);
    assert.equal(isOperational(null), false);
  });

  test("suspended is refused as firmly as never-approved", () => {
    // A business that WAS active and was suspended must lose its powers, not
    // keep them because it once had them.
    assert.deepEqual(
      permissionsForWorkspace({ kind: "business", orgRole: "owner", registrationStatus: "suspended" }),
      [],
    );
  });
});

describe("workspaces that are not businesses", () => {
  test("personal and broker carry no operator permissions", () => {
    for (const kind of ["personal", "broker"]) {
      assert.deepEqual(
        permissionsForWorkspace({ kind, orgRole: null, registrationStatus: null }),
        [],
        `${kind} must carry nothing`,
      );
    }
  });

  test("a business workspace with no org role carries nothing", () => {
    assert.deepEqual(
      permissionsForWorkspace({ kind: "business", orgRole: null, registrationStatus: "active" }),
      [],
    );
  });
});

describe("workspaceAllows reads the resolved grant, not the role", () => {
  /*
   * This is the predicate the browser is allowed to use. It asks what the
   * SERVER said this workspace grants, never what a role would grant — which
   * is the distinction `injishi/no-client-authz` exists to enforce.
   */
  test("it answers from the permissions array it is given", () => {
    const access = { permissions: ["stay.checkin", "message.send"] };
    assert.equal(workspaceAllows(access, "stay.checkin"), true);
    assert.equal(workspaceAllows(access, "money.view"), false);
  });

  test("an empty grant allows nothing — the pending-business case", () => {
    assert.equal(workspaceAllows({ permissions: [] }, "stay.checkin"), false);
  });
});

describe("every refusal can be worded", () => {
  test("PERMISSION_LABEL covers every permission", () => {
    // A missing label renders "Your role cannot undefined in this workspace."
    // The guard builds its message from this map, so a permission added
    // without a label ships a broken sentence to a real person.
    for (const p of Permission.options) {
      assert.equal(typeof PERMISSION_LABEL[p], "string", `${p} has no label`);
      assert.ok(PERMISSION_LABEL[p].length > 0, `${p} has an empty label`);
    }
  });

  test("it carries no labels for permissions that do not exist", () => {
    assert.deepEqual(Object.keys(PERMISSION_LABEL).sort(), [...Permission.options].sort());
  });

  test("every registration stage has a message that names the stage", () => {
    // The refusal must explain the PIPELINE, not blame the role: the role is
    // held. Every stage the gate can refuse needs its own sentence.
    for (const status of [...NOT_ACTIVE, "active"]) {
      assert.equal(typeof REGISTRATION_STAGE_MESSAGE[status], "string", status);
      assert.ok(REGISTRATION_STAGE_MESSAGE[status].length > 0, status);
    }
  });
});

describe("oversight scope is a boundary", () => {
  test("a country grant reaches everywhere", () => {
    const grant = { scopeLevel: "country", provinceId: null, districtId: null };
    assert.equal(withinScope(grant, { provinceId: 1, districtId: 101 }), true);
    assert.equal(withinScope(grant, { provinceId: 5, districtId: 999 }), true);
  });

  test("a district grant reaches its district and no other", () => {
    const grant = { scopeLevel: "district", provinceId: null, districtId: 101 };
    assert.equal(withinScope(grant, { provinceId: null, districtId: 101 }), true);
    assert.equal(withinScope(grant, { provinceId: null, districtId: 102 }), false);
  });

  test("a province grant reaches its province and no other", () => {
    const grant = { scopeLevel: "province", provinceId: 1, districtId: null };
    assert.equal(withinScope(grant, { provinceId: 1, districtId: 101 }), true);
    assert.equal(withinScope(grant, { provinceId: 2, districtId: 201 }), false);
  });

  test("a grant with no id of its own reaches nothing", () => {
    // null === null must not read as a match, or an unscoped grant would
    // silently become a national one.
    assert.equal(
      withinScope({ scopeLevel: "district", provinceId: null, districtId: null }, { provinceId: null, districtId: null }),
      false,
    );
    assert.equal(
      withinScope({ scopeLevel: "province", provinceId: null, districtId: null }, { provinceId: null, districtId: null }),
      false,
    );
  });

  test("each oversight role opens exactly one console", () => {
    assert.equal(oversightConsoleFor("business_field_verifier"), "verification");
    assert.equal(oversightConsoleFor("business_approver"), "approval");
    assert.equal(oversightConsoleFor("tax_compliance_officer"), "tax");
  });
});

describe("separation of duties", () => {
  const OFFICER = "11111111-1111-4111-8111-111111111111";
  const OTHER = "22222222-2222-4222-8222-222222222222";

  test("an officer may not approve what they field-verified", () => {
    assert.equal(
      violatesSeparationOfDuties({ actorUserId: OFFICER, fieldVerifiedByUserId: OFFICER }),
      true,
    );
  });

  test("but may approve what somebody else verified", () => {
    assert.equal(
      violatesSeparationOfDuties({ actorUserId: OFFICER, fieldVerifiedByUserId: OTHER }),
      false,
    );
  });

  test("an unverified business is not a violation", () => {
    // Nothing has been field-verified yet, so there is no earlier decision to
    // conflict with. Reading null as a match would block the first approval.
    assert.equal(
      violatesSeparationOfDuties({ actorUserId: OFFICER, fieldVerifiedByUserId: null }),
      false,
    );
  });
});

describe("the KYC elevation gate", () => {
  test("a verified identity with a document may elevate", () => {
    assert.equal(mayElevate({ kycStatus: "verified", activeDocumentCount: 1 }), true);
  });

  test("verified with no active document may not", () => {
    // A document can be revoked after verification. The status alone is a
    // memory of a past check; the document is the thing still standing.
    assert.equal(mayElevate({ kycStatus: "verified", activeDocumentCount: 0 }), false);
  });

  test("an unverified identity may not, however many documents it holds", () => {
    assert.equal(mayElevate({ kycStatus: "pending", activeDocumentCount: 3 }), false);
    assert.equal(mayElevate({ kycStatus: "rejected", activeDocumentCount: 3 }), false);
  });
});
