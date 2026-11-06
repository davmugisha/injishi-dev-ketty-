/**
 * Injishi Account's slice G contracts, pinned (ADR-076).
 *
 * What a business has switched on, the grants a client reads, the new name of
 * every permission and the refusal layers. None of it decides access in a
 * client: the server resolves, and these are the shapes and tables both sides
 * read. What this file guards is that the tables stay whole (every permission
 * renamed once, every code under one layer, every kind given account and
 * marketplace) and that the wire shapes accept what the server sends.
 *
 * Like the other tests here, it reads the BUILT module, because `dist/` is what
 * the API and every app import.
 *
 *   pnpm --filter @injishi/contracts test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const c = require("../dist/index.js");

const {
  Permission,
  ProductId,
  ENTITLEMENT_LEVEL,
  ENTITLED_PRODUCTS,
  isEntitledProduct,
  BusinessKind,
  businessKindOf,
  KIND_PRODUCTS,
  BACKFILL_PRODUCTS,
  HOME_PRODUCT_ORDER,
  LEGACY_PERMISSION_KEY,
  legacyKeyOf,
  WorkspaceGrants,
  WorkspaceAccess,
  grantsProductOn,
  grantsPermissionHeld,
  AccessRefusalCode,
  ACCESS_REFUSAL_LAYER,
  parseAccessRefusal,
  SetOrgProductRequest,
  ENTITLEMENT_REASON_MIN_LENGTH,
} = c;

const BRANCH_A = "11111111-1111-4111-8111-111111111111";
const BRANCH_B = "22222222-2222-4222-8222-222222222222";

describe("products", () => {
  test("the eleven product IDs, in Stage 1's order", () => {
    assert.deepEqual(ProductId.options, [
      "account",
      "admin",
      "membership",
      "marketplace",
      "finance",
      "pay",
      "pms",
      "outlets",
      "pos",
      "hr",
      "residence",
    ]);
  });

  test("admin and membership are never entitlements, account is locked", () => {
    assert.equal(ENTITLEMENT_LEVEL.admin, "none");
    assert.equal(ENTITLEMENT_LEVEL.membership, "none");
    assert.equal(ENTITLEMENT_LEVEL.account, "locked");
    assert.equal(isEntitledProduct("admin"), false);
    assert.ok(!ENTITLED_PRODUCTS.includes("admin"));
    assert.ok(!ENTITLED_PRODUCTS.includes("membership"));
    assert.equal(ENTITLED_PRODUCTS.length, 9);
  });

  test("hr, finance, pay and marketplace are business level; pms, outlets, pos and residence are branch level", () => {
    for (const p of ["hr", "finance", "pay", "marketplace"]) assert.equal(ENTITLEMENT_LEVEL[p], "business", p);
    for (const p of ["pms", "outlets", "pos", "residence"]) assert.equal(ENTITLEMENT_LEVEL[p], "branch", p);
  });
});

describe("the business kind, read from business_kind (ADR-075)", () => {
  test("every stay kind is a stay, both venues a venue, residence a residence, broker a broker", () => {
    for (const kind of ["hotel", "motel", "tented_camp", "guest_house", "apartment", "lodge", "villa", "other"]) {
      assert.equal(businessKindOf({ businessKind: kind }), "stay", kind);
    }
    assert.equal(businessKindOf({ businessKind: "bar_restaurant" }), "venue");
    assert.equal(businessKindOf({ businessKind: "coffee_shop" }), "venue");
    assert.equal(businessKindOf({ businessKind: "residence" }), "residence");
    assert.equal(businessKindOf({ businessKind: "broker" }), "broker");
  });

  test("every value of ADR-075's vocabulary has a set", () => {
    for (const kind of BusinessKind.options) assert.notEqual(businessKindOf({ businessKind: kind }), null, kind);
  });

  test("a kind this release does not know is null, never a guess", () => {
    assert.equal(businessKindOf({ businessKind: "unmapped_check" }), null);
    assert.equal(businessKindOf({ businessKind: null }), null);
    assert.equal(businessKindOf({ businessKind: null, domain: "hospitality" }), null);
  });

  test("a PSF business, which carries no kind, is known by its domain", () => {
    assert.equal(businessKindOf({ businessKind: null, domain: "enterprise" }), "enterprise");
  });

  test("a broker gets account and marketplace only", () => {
    assert.deepEqual([...KIND_PRODUCTS.broker], ["account", "marketplace"]);
  });

  test("every kind gets account and marketplace, and only a stay gets pms (ADR-074 D-k)", () => {
    for (const [kind, set] of Object.entries(KIND_PRODUCTS)) {
      assert.ok(set.includes("account"), kind);
      assert.ok(set.includes("marketplace"), kind);
      for (const p of set) assert.ok(isEntitledProduct(p), `${kind} lists ${p}`);
    }
    assert.ok(KIND_PRODUCTS.stay.includes("pms"));
    assert.ok(!KIND_PRODUCTS.venue.includes("pms"));
    assert.ok(!KIND_PRODUCTS.residence.includes("pms"));
    assert.ok(KIND_PRODUCTS.residence.includes("residence"));
    // A PSF business holds only what every kind holds.
    assert.deepEqual([...KIND_PRODUCTS.enterprise].sort(), ["account", "marketplace"]);
  });

  test("the backfill keeps today's reach by domain (A-13, G3)", () => {
    assert.deepEqual([...BACKFILL_PRODUCTS.hospitality].sort(), ["account", "finance", "hr", "marketplace", "outlets", "pay", "pms", "pos"]);
    assert.deepEqual([...BACKFILL_PRODUCTS.residence].sort(), ["account", "finance", "hr", "marketplace", "pay", "residence"]);
    assert.deepEqual([...BACKFILL_PRODUCTS.enterprise], ["account"]);
  });

  test("the home order is G14's", () => {
    assert.deepEqual(HOME_PRODUCT_ORDER, ["pms", "residence", "outlets", "pos", "hr", "finance"]);
  });
});

describe("the new permission names (ADR-074, D-20)", () => {
  test("every permission has exactly one new name, and no two share one", () => {
    const renamed = Permission.options.map((p) => LEGACY_PERMISSION_KEY[p]);
    assert.equal(renamed.length, Permission.options.length);
    assert.ok(renamed.every((k) => k !== undefined), "every permission is in the table");
    assert.ok(renamed.every((k) => typeof k === "string" && k.split(".").length === 3), "every key is owner.resource.action");
    assert.equal(new Set(renamed).size, renamed.length);
  });

  test("the lock keeps its meaning under its new name", () => {
    assert.equal(LEGACY_PERMISSION_KEY["team.manage"], "account.team.manage");
    assert.equal(LEGACY_PERMISSION_KEY["listing.manage"], "property.listing.manage");
    assert.equal(LEGACY_PERMISSION_KEY["ebm.refund"], "fiscal.ebm.refund");
  });

  test("a new name maps back, and an unknown one does not", () => {
    for (const p of Permission.options) assert.equal(legacyKeyOf(LEGACY_PERMISSION_KEY[p]), p);
    assert.equal(legacyKeyOf("pos.sale.void"), null);
  });
});

describe("grants on the wire", () => {
  const grants = {
    family: "business",
    products: [
      { id: "account", branches: "all" },
      { id: "pos", branches: [BRANCH_A] },
    ],
    roles: [{ roleId: null, key: "receptionist", name: "Front office / Receptionist", kind: "default", scopes: [{ kind: "branch", ids: [BRANCH_A] }] }],
    permissions: [
      { key: "pms.stay.checkin", scopes: [{ kind: "branch", ids: [BRANCH_A] }] },
      { key: "hr.attendance.record", scopes: [] },
    ],
  };

  test("the shape the server sends parses", () => {
    assert.ok(WorkspaceGrants.safeParse(grants).success);
    assert.equal(WorkspaceGrants.safeParse({ ...grants, family: "staff" }).success, false);
  });

  test("a lookup answers per branch and fails closed", () => {
    assert.equal(grantsProductOn(grants, "pos", BRANCH_A), true);
    assert.equal(grantsProductOn(grants, "pos", BRANCH_B), false);
    assert.equal(grantsProductOn(grants, "pos"), true);
    assert.equal(grantsProductOn(grants, "pms"), false);
    assert.equal(grantsProductOn(null, "account"), false);
    assert.equal(grantsPermissionHeld(grants, "pms.stay.checkin", BRANCH_A), true);
    assert.equal(grantsPermissionHeld(grants, "pms.stay.checkin", BRANCH_B), false);
    assert.equal(grantsPermissionHeld(grants, "hr.attendance.record", BRANCH_B), true);
    assert.equal(grantsPermissionHeld(grants, "account.team.manage"), false);
  });

  test("a workspace parses with grants and without them", () => {
    const base = {
      workspaceId: "33333333-3333-4333-8333-333333333333",
      kind: "business",
      orgId: "44444444-4444-4444-8444-444444444444",
      orgName: "Hotel",
      domain: "hospitality",
      orgRole: "receptionist",
      registrationStatus: "active",
      permissions: ["stay.checkin"],
      departments: [],
      propertyName: null,
      branches: [],
      branchCoverage: "limited",
      psfMembership: null,
    };
    assert.ok(WorkspaceAccess.safeParse(base).success, "a client built before grants still parses");
    assert.ok(WorkspaceAccess.safeParse({ ...base, grants }).success);
  });
});

describe("refusals", () => {
  test("every code sits under exactly one layer", () => {
    for (const code of AccessRefusalCode.options) assert.ok(ACCESS_REFUSAL_LAYER[code], code);
    assert.equal(ACCESS_REFUSAL_LAYER.product_off, "entitlement");
    assert.equal(ACCESS_REFUSAL_LAYER.workspace_not_available, "workspace");
    assert.equal(ACCESS_REFUSAL_LAYER.not_found, "scope");
    assert.equal(ACCESS_REFUSAL_LAYER.two_factor_required, "session");
  });

  test("a refusal body parses, and Nest's bare body does not", () => {
    const body = { statusCode: 403, error: "Forbidden", message: "This product is not on here.", layer: "entitlement", code: "product_off" };
    assert.deepEqual(parseAccessRefusal(body), body);
    assert.equal(parseAccessRefusal({ statusCode: 403, error: "Forbidden", message: "x" }), null);
  });
});

describe("the admin product change", () => {
  test("the shape takes any reason up to 500 characters; the server refuses a short one with its own code", () => {
    // 422 `reason_required` comes from the service, so a short reason must
    // reach it rather than stop at the validation pipe's generic 400.
    assert.ok(SetOrgProductRequest.safeParse({ branchIds: null, state: "off", reason: "too short" }).success);
    assert.equal(ENTITLEMENT_REASON_MIN_LENGTH, 10);
    assert.equal(SetOrgProductRequest.safeParse({ branchIds: null, state: "off", reason: "x".repeat(501) }).success, false);
  });

  test("null means every branch, and an empty list is refused rather than read as none", () => {
    assert.ok(SetOrgProductRequest.safeParse({ branchIds: [BRANCH_A], state: "on", reason: "Second branch opens POS." }).success);
    assert.equal(SetOrgProductRequest.safeParse({ branchIds: [], state: "on", reason: "Second branch opens POS." }).success, false);
  });
});
