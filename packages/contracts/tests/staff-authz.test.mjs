/**
 * The staff authorization model, pinned (ADR-053, AC-A7).
 *
 * The org half has had `authz.test.mjs` since ADR-035. The staff half had
 * nothing, while ADR-053 changed it: five read permissions arrived and three of
 * the four roles gained reads. This is the copy of those facts that needs no
 * database, no API and no OTP budget, so it runs on every change. The two
 * `verify-authz*` scripts stay the live proof.
 *
 * It tests the BUILT module (`dist/`), as the org test does, because `dist/` is
 * what every consumer imports. `pnpm test` builds first.
 *
 *   pnpm --filter @injishi/contracts test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const {
  Permission,
  StaffPermission,
  STAFF_PERMISSION_LABEL,
  TWO_PERSON_STAFF_PERMISSIONS,
  NO_STAFF_ACCESS,
  needsSecondSigner,
  staffAllows,
  staffPermissionsForRoles,
  staffRequiresStepUp,
  staffStepUpOwed,
} = require("../dist/index.js");

const OBSERVE = ["admin.overview.view", "admin.analytics.view", "admin.system.view"];

describe("the five staff roles", () => {
  /*
   * Exact membership, in canonical order, never a count alone. A count catches a
   * permission being dropped and misses one being SWAPPED, and a swap is what
   * actually moves a boundary.
   */
  test("the matrix holds thirty seven permissions", () => {
    // Thirty platform powers (ADR-053) and seven `training.*` powers (ADR-049).
    assert.equal(StaffPermission.options.length, 37);
  });

  test("trainer holds four training powers and no platform power (ADR-049)", () => {
    assert.deepEqual(staffPermissionsForRoles(["trainer"]), [
      "training.view",
      "training.session.manage",
      "training.attendance.mark",
      "training.certificate.revoke",
    ]);
  });

  test("super_admin holds every permission there is", () => {
    assert.deepEqual(staffPermissionsForRoles(["super_admin"]), StaffPermission.options);
  });

  test("ops runs the pipeline and reads the platform areas it works beside", () => {
    assert.deepEqual(staffPermissionsForRoles(["ops"]), [
      ...OBSERVE,
      "admin.business.view",
      "admin.business.review",
      "admin.business.suspend",
      "admin.business.reinstate",
      "admin.user.view",
      "admin.user.session.revoke",
      "admin.broker.view",
      "admin.broker.approve",
      "admin.config.view",
      "admin.environment.view",
      "admin.announcement.view",
      "admin.moderation.view",
      "admin.moderation.act",
      "admin.localization.view",
      "admin.localization.edit",
    ]);
    assert.equal(staffPermissionsForRoles(["ops"]).length, 18);
  });

  test("compliance reads, and acts only inside compliance", () => {
    assert.deepEqual(staffPermissionsForRoles(["compliance"]), [
      ...OBSERVE,
      "admin.business.view",
      "admin.compliance.view",
      "admin.dsr.action",
      "admin.audit.read",
      "admin.config.view",
      "admin.moderation.view",
      "admin.localization.view",
    ]);
    assert.equal(staffPermissionsForRoles(["compliance"]).length, 10);
  });

  test("finance sees money, prices the catalog and reads configuration", () => {
    assert.deepEqual(staffPermissionsForRoles(["finance"]), [
      ...OBSERVE,
      "admin.finance.view",
      "admin.fee.edit",
      "admin.payout.release",
      "admin.config.view",
    ]);
    assert.equal(staffPermissionsForRoles(["finance"]).length, 7);
  });
});

describe("the five read permissions (ADR-053)", () => {
  test("every role reads configuration", () => {
    for (const role of ["super_admin", "ops", "compliance", "finance"]) {
      assert.ok(staffAllows(staffPermissionsForRoles([role]), "admin.config.view"), role);
    }
  });

  test("nobody but super_admin gained a platform write", () => {
    const writes = [
      "admin.config.edit",
      "admin.environment.manage",
      "admin.announcement.publish",
    ];
    for (const role of ["ops", "compliance", "finance"]) {
      const held = staffPermissionsForRoles([role]);
      for (const w of writes) assert.equal(staffAllows(held, w), false, `${role} ${w}`);
    }
  });

  test("environments and announcements stay out of compliance and finance", () => {
    for (const role of ["compliance", "finance"]) {
      const held = staffPermissionsForRoles([role]);
      assert.equal(staffAllows(held, "admin.environment.view"), false, role);
      assert.equal(staffAllows(held, "admin.announcement.view"), false, role);
    }
  });
});

describe("resolving a staffer", () => {
  test("several roles are the union, in canonical order whatever order they arrive", () => {
    const a = staffPermissionsForRoles(["finance", "compliance"]);
    const b = staffPermissionsForRoles(["compliance", "finance"]);
    assert.deepEqual(a, b);
    assert.deepEqual(
      a,
      StaffPermission.options.filter(
        (p) =>
          staffPermissionsForRoles(["finance"]).includes(p) ||
          staffPermissionsForRoles(["compliance"]).includes(p),
      ),
    );
  });

  test("no roles, or an unknown one, holds nothing rather than throwing", () => {
    assert.deepEqual(staffPermissionsForRoles([]), []);
    assert.deepEqual(staffPermissionsForRoles(["caretaker"]), []);
  });
});

describe("two person powers and the step-up", () => {
  test("exactly two powers need a second signer", () => {
    assert.deepEqual([...TWO_PERSON_STAFF_PERMISSIONS], [
      "admin.money.override",
      "admin.user.role.grant",
    ]);
    for (const p of StaffPermission.options) {
      assert.equal(needsSecondSigner(p), TWO_PERSON_STAFF_PERMISSIONS.includes(p), p);
    }
  });

  test("NO_STAFF_ACCESS reports no step-up, because nobody looked at a session", () => {
    assert.equal("twoFactor" in NO_STAFF_ACCESS, false);
    assert.deepEqual(NO_STAFF_ACCESS, { isStaff: false, roles: [], permissions: [] });
  });

  test("being staff is itself the step-up requirement", () => {
    assert.equal(staffRequiresStepUp({ isStaff: true }), true);
    assert.equal(staffRequiresStepUp({ isStaff: false }), false);
  });

  test("a code is owed only by staff who have not presented one", () => {
    const staff = { isStaff: true, roles: ["ops"], permissions: [] };
    assert.equal(staffStepUpOwed({ ...staff, twoFactor: { required: true, verified: false } }), true);
    assert.equal(staffStepUpOwed({ ...staff, twoFactor: { required: true, verified: true } }), false);
    assert.equal(staffStepUpOwed(staff), false);
    assert.equal(staffStepUpOwed({ ...NO_STAFF_ACCESS, twoFactor: { required: true, verified: false } }), false);
  });
});

describe("labels", () => {
  test("every staff permission has a label, and there are no extras", () => {
    assert.deepEqual(Object.keys(STAFF_PERMISSION_LABEL).sort(), [...StaffPermission.options].sort());
    for (const p of StaffPermission.options) {
      assert.ok(STAFF_PERMISSION_LABEL[p].trim().length > 0, p);
    }
  });
});

/*
 * THE DECLARED BUT UNENFORCED PERMISSIONS, named so the gap is loud.
 *
 * A permission counts as IN USE when the API declares it on a route
 * (`@RequirePermission` / `@RequireStaffPermission` / `@RequireAnyPermission`).
 * Nav leaves used to count too, from `apps/app/src/pms/lib/nav.ts` and
 * `apps/admin/src/lib/nav.ts`; both apps are gone, and the new interface's
 * navigation (`packages/data/src/navigation.ts`) declares no permissions, so the
 * API is the one place a permission is enforced. Everything else is design
 * intent with nothing behind it. The list below must equal what the code says,
 * so wiring one up fails this test until it leaves the list, and a new orphan
 * fails it until it joins. That is the idiom this repository uses for a backlog:
 * a count that is visible on every run rather than a gap nobody sees.
 *
 * Why each is here:
 *   admin.user.impersonate     F-A13, not built
 *   admin.payout.release        F-A06, not built
 *   admin.dsr.action            F-A08, not built
 *   admin.money.override        FL32, not built
 *   admin.environment.manage, admin.announcement.publish, admin.moderation.act,
 *   admin.localization.edit
 *                               four WRITES whose sections are read only. Each used
 *                               to guard its section's read; ADR-053 moved the reads
 *                               onto a view permission, which is what exposed that
 *                               none of these writes exists yet. The fifth,
 *                               admin.config.edit, left this list when the
 *                               government body catalogue became its first write.
 */
const UNENFORCED = [
  // `property.switch` left this list by leaving `Permission` (ADR-054 AC-S4).
  "admin.user.impersonate",
  "admin.payout.release",
  "admin.money.override",
  "admin.dsr.action",
  "admin.environment.manage",
  "admin.announcement.publish",
  "admin.moderation.act",
  "admin.localization.edit",
  // ADR-050: declared for the `NR` refund of a signed receipt, whose route is a
  // later slice. `guest-ordering.service.ts` names it as the power that route will
  // require.
  "ebm.refund",
  // Rentals blueprint 2.1 declared these ahead of their routes (WP 1.1). Each
  // leaves this list when its first route declares it: `expense.manage` and
  // `tax.manage` with expenses and taxes (P4), and `guest.register` with the
  // landlord's guests (P5). `lease.manage`, `lease.sign`, `payout.manage`,
  // `rent.record` and `deposit.return` left it with the rentals module's first
  // routes (WP 1.4 and 1.5a): lease drafting, the signatory, payout accounts,
  // and the lease reads the money side makes.
  "expense.manage",
  "tax.manage",
  "guest.register",
  // `payroll.draft` left this list when its draft routes declared it (ADR-069
  // D-e): `@RequireAnyPermission('payroll.draft', 'payroll.run')` on the pay
  // run's list, create, read, recompute and hold, the payroll dashboard and the
  // national rules.
];

describe("the unenforced permissions", () => {
  const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

  function tsFiles(dir) {
    const out = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && entry.name !== "dist") out.push(...tsFiles(p));
      } else if (/\.ts$/.test(entry.name) && !/\.spec\.ts$/.test(entry.name)) {
        out.push(p);
      }
    }
    return out;
  }

  const inUse = new Set();
  /** Every quoted permission name in a list, such as `('a', 'b')` or `["a", "b"]`. */
  const names = (list) => [...list.matchAll(/['"]([a-z_]+\.[a-z_.]+)['"]/g)].map((m) => m[1]);
  for (const file of tsFiles(join(repo, "server", "api", "src"))) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/@Require(?:Staff)?Permission\(\s*['"]([a-z_.]+)['"]/g)) inUse.add(m[1]);
    // ADR-058: a read opened by any one of several permissions enforces each
    // of them, so `people.view`, which is only ever one of several, counts.
    for (const m of text.matchAll(/@RequireAnyPermission\(([^)]*)\)/g)) for (const p of names(m[1])) inUse.add(p);
  }
  test("the scan found the API's org and staff decorators", () => {
    // A path that moved would otherwise make EVERY permission look unenforced
    // and fail the test below with a misleading list.
    assert.ok(inUse.has("listing.manage"), "API decorators were not found");
    assert.ok(inUse.has("admin.config.view"), "the API's staff decorators were not found");
    assert.ok(inUse.has("team.manage"), "the API's team decorators were not found");
  });

  test("exactly the named permissions are declared and unenforced", () => {
    const all = [...Permission.options, ...StaffPermission.options];
    const unenforced = all.filter((p) => !inUse.has(p));
    assert.deepEqual(unenforced.sort(), [...UNENFORCED].sort());
  });

  test("unit.manage is enforced now, by the residence routes it was written for", () => {
    assert.ok(inUse.has("unit.manage"));
  });
});
