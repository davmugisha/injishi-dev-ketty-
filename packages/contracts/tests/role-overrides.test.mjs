/**
 * A business's own role customisation, pinned.
 *
 * The model that decides what a receptionist may do stopped being a constant on
 * the day a business could edit it, and this file is what keeps "edit" from
 * meaning "escalate". Three rules carry the whole security argument and each one
 * is tested from both sides:
 *
 *   1. an override MOVES a permission for one role of one business, and leaves
 *      every other role and every permission it did not name alone;
 *   2. `owner` is not customisable, so the one role that can reach the screen
 *      cannot be edited from it;
 *   3. `team.manage` is locked, so the power to run this screen cannot be handed
 *      out through it — including by a row that should not exist in the first
 *      place, which is the case a validator alone would miss.
 *
 * Like `authz.test.mjs` beside it, this tests the BUILT module, because `dist/`
 * is what the API and every app import.
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
  CustomisableOrgRole,
  RolePermissionOverride,
  LOCKED_PERMISSIONS,
  LOCKED_PERMISSION_REASON,
  PERMISSION_AREA_OF,
  PERMISSION_AREA_LABEL,
  effectivePermissionsForRole,
  isCustomisableOrgRole,
  isLockedPermission,
  permissionsForRole,
  permissionsForWorkspace,
} = authz;

const ACTIVE = {
  kind: "business",
  registrationStatus: "active",
};

describe("which roles a business may customise", () => {
  test("every role except owner", () => {
    assert.deepEqual([...CustomisableOrgRole.options].sort(), [
      "housekeeper",
      "manager",
      "receptionist",
    ]);
    assert.equal(isCustomisableOrgRole("owner"), false);
    for (const role of CustomisableOrgRole.options) {
      assert.equal(isCustomisableOrgRole(role), true, role);
    }
  });

  test("the override shape refuses owner outright", () => {
    assert.equal(
      RolePermissionOverride.safeParse({
        orgRole: "owner",
        permission: "money.view",
        granted: true,
      }).success,
      false,
    );
    assert.equal(
      RolePermissionOverride.safeParse({
        orgRole: "receptionist",
        permission: "money.view",
        granted: true,
      }).success,
      true,
    );
  });
});

describe("effectivePermissionsForRole", () => {
  test("no overrides is the platform default, exactly", () => {
    for (const role of ["owner", ...CustomisableOrgRole.options]) {
      assert.deepEqual(effectivePermissionsForRole(role, []), permissionsForRole(role), role);
      assert.deepEqual(effectivePermissionsForRole(role), permissionsForRole(role), role);
    }
  });

  test("a grant adds a permission the default withholds", () => {
    const base = permissionsForRole("receptionist");
    assert.equal(base.includes("money.view"), false, "fixture: the default must withhold it");

    const held = effectivePermissionsForRole("receptionist", [
      { orgRole: "receptionist", permission: "money.view", granted: true },
    ]);
    assert.equal(held.includes("money.view"), true);
    // And nothing else moved.
    assert.deepEqual(
      held.filter((p) => p !== "money.view"),
      base,
    );
  });

  test("an ungrant removes a permission the default gives", () => {
    const base = permissionsForRole("manager");
    assert.equal(base.includes("ebm.refund"), true, "fixture: the default must give it");

    const held = effectivePermissionsForRole("manager", [
      { orgRole: "manager", permission: "ebm.refund", granted: false },
    ]);
    assert.equal(held.includes("ebm.refund"), false);
    assert.deepEqual(
      held,
      base.filter((p) => p !== "ebm.refund"),
    );
  });

  test("an override for another role changes nothing here", () => {
    assert.deepEqual(
      effectivePermissionsForRole("housekeeper", [
        { orgRole: "receptionist", permission: "money.view", granted: true },
        { orgRole: "manager", permission: "housekeeping.set", granted: false },
      ]),
      permissionsForRole("housekeeper"),
    );
  });

  test("the last override for a permission wins, so a re-edit is not additive", () => {
    const held = effectivePermissionsForRole("housekeeper", [
      { orgRole: "housekeeper", permission: "money.view", granted: true },
      { orgRole: "housekeeper", permission: "money.view", granted: false },
    ]);
    assert.equal(held.includes("money.view"), false);
  });

  test("the answer keeps Permission.options order, so two equal grants are equal arrays", () => {
    const held = effectivePermissionsForRole("housekeeper", [
      { orgRole: "housekeeper", permission: "money.view", granted: true },
      { orgRole: "housekeeper", permission: "reservation.approve", granted: true },
    ]);
    const ordered = Permission.options.filter((p) => held.includes(p));
    assert.deepEqual(held, ordered);
  });

  test("granting everything to a role still stops at the locked permission", () => {
    const held = effectivePermissionsForRole(
      "manager",
      Permission.options.map((permission) => ({
        orgRole: "manager",
        permission,
        granted: true,
      })),
    );
    assert.deepEqual(
      held,
      Permission.options.filter((p) => !LOCKED_PERMISSIONS.includes(p)),
    );
  });

  test("withdrawing everything from a role leaves nothing, not the default", () => {
    const held = effectivePermissionsForRole(
      "receptionist",
      Permission.options.map((permission) => ({
        orgRole: "receptionist",
        permission,
        granted: false,
      })),
    );
    assert.deepEqual(held, []);
  });
});

describe("the locked permission is an invariant, not a validation", () => {
  test("team.manage is the locked set, and it is locked", () => {
    assert.deepEqual([...LOCKED_PERMISSIONS], ["team.manage"]);
    assert.equal(isLockedPermission("team.manage"), true);
    assert.equal(isLockedPermission("money.view"), false);
    assert.equal(typeof LOCKED_PERMISSION_REASON["team.manage"], "string");
    assert.ok(LOCKED_PERMISSION_REASON["team.manage"].length > 20);
  });

  test("a stored row granting team.manage does not resolve into a grant", () => {
    // The row should be impossible: the request schema and the service both
    // refuse it. This is the case where one was written anyway — a bad
    // migration, a hand edited database — and the model must still refuse.
    for (const role of CustomisableOrgRole.options) {
      const held = effectivePermissionsForRole(role, [
        { orgRole: role, permission: "team.manage", granted: true },
      ]);
      assert.equal(held.includes("team.manage"), false, role);
    }
  });

  test("owner keeps its whole set however many overrides name it", () => {
    const held = effectivePermissionsForRole("owner", [
      { orgRole: "owner", permission: "team.manage", granted: false },
      { orgRole: "owner", permission: "money.view", granted: false },
    ]);
    assert.deepEqual(held, permissionsForRole("owner"));
    assert.equal(held.includes("team.manage"), true);
  });
});

describe("permissionsForWorkspace resolves through the overrides", () => {
  test("a business workspace picks them up", () => {
    assert.deepEqual(
      permissionsForWorkspace({
        ...ACTIVE,
        orgRole: "receptionist",
        roleOverrides: [
          { orgRole: "receptionist", permission: "money.view", granted: true },
        ],
      }),
      effectivePermissionsForRole("receptionist", [
        { orgRole: "receptionist", permission: "money.view", granted: true },
      ]),
    );
  });

  test("omitting them is the platform default, so every old caller is unchanged", () => {
    assert.deepEqual(
      permissionsForWorkspace({ ...ACTIVE, orgRole: "manager" }),
      permissionsForRole("manager"),
    );
  });

  test("the registration gate still wins — a business cannot grant past its own approval", () => {
    for (const status of ["pending_payment", "submitted", "tin_verified", "field_verified", "approved", "rejected", "suspended"]) {
      assert.deepEqual(
        permissionsForWorkspace({
          kind: "business",
          registrationStatus: status,
          orgRole: "manager",
          roleOverrides: [
            { orgRole: "manager", permission: "money.view", granted: true },
            { orgRole: "manager", permission: "listing.manage", granted: true },
          ],
        }),
        [],
        status,
      );
    }
  });

  test("broker and personal stay empty however they are overridden", () => {
    for (const kind of ["broker", "personal"]) {
      assert.deepEqual(
        permissionsForWorkspace({
          kind,
          registrationStatus: null,
          orgRole: null,
          roleOverrides: [
            { orgRole: "manager", permission: "money.view", granted: true },
          ],
        }),
        [],
        kind,
      );
    }
  });
});

describe("the areas a screen groups the toggles by", () => {
  test("every permission has exactly one area, and every area is used", () => {
    const used = new Set();
    for (const permission of Permission.options) {
      const area = PERMISSION_AREA_OF[permission];
      assert.ok(area, `${permission} has no area`);
      assert.ok(PERMISSION_AREA_LABEL[area], `${area} has no label`);
      used.add(area);
    }
    assert.deepEqual(
      [...used].sort(),
      Object.keys(PERMISSION_AREA_LABEL).sort(),
      "an area with no permission in it would render an empty group",
    );
  });

  test("the map holds no permission that is not one", () => {
    assert.deepEqual(
      Object.keys(PERMISSION_AREA_OF).sort(),
      [...Permission.options].sort(),
    );
  });
});
