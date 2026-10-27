/**
 * The landlord's home and who-am-I (WP 1.8, 2.2, 2.3): the months of the
 * rent trend, the month-on-month change, a building's location request, the
 * unit media shapes, and where a person lands.
 *
 *   pnpm --filter @injishi/contracts test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const c = require("../dist/index.js");

describe("the rent trend", () => {
  test("twelve Kigali months ending with this one, across a year end", () => {
    const months = c.overviewMonths("2026-01-15");
    assert.equal(months.length, 12);
    assert.equal(months[0], "2025-02");
    assert.equal(months[11], "2026-01");
    assert.deepEqual(c.overviewMonths("2026-10-31", 3), ["2026-08", "2026-09", "2026-10"]);
  });

  test("the change in percent, one decimal, none from nothing", () => {
    assert.equal(c.percentChange(1_000_000, 800_000), 25);
    assert.equal(c.percentChange(500, 1500), -66.7);
    assert.equal(c.percentChange(10, 0), null);
  });
});

describe("a building's location", () => {
  test("every level down to the village is asked for, the street is optional", () => {
    const ok = c.PropertyLocationRequest.safeParse({ provinceId: 1, districtId: 2, sectorId: 3, cellId: 4, villageId: 5, street: "  " });
    assert.ok(ok.success);
    assert.equal(ok.data.street, null);
    const missing = c.PropertyLocationRequest.safeParse({ provinceId: 1, districtId: 2, sectorId: 3, cellId: 4 });
    assert.ok(!missing.success);
    assert.equal(missing.error.issues[0].message, "Choose the village.");
  });
});

describe("unit media", () => {
  test("a reorder names each photo once", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    assert.ok(!c.ReorderUnitPhotosRequest.safeParse({ photoIds: [id, id] }).success);
    assert.ok(c.ReorderUnitPhotosRequest.safeParse({ photoIds: [id] }).success);
  });

  test("a video tour runs 1 to 180 seconds", () => {
    assert.ok(c.UnitVideoFields.safeParse({ durationS: "42" }).success);
    assert.ok(!c.UnitVideoFields.safeParse({ durationS: "181" }).success);
    assert.ok(!c.UnitVideoFields.safeParse({ durationS: "0" }).success);
    assert.equal(c.UNIT_PHOTO_MAX, 20);
  });
});

describe("where a person lands", () => {
  const res = "11111111-1111-4111-8111-111111111111";
  const hotel = "22222222-2222-4222-8222-222222222222";
  const business = (workspaceId, domain, operational = true) => ({
    workspaceId,
    orgId: workspaceId,
    orgName: "x",
    domain,
    role: "owner",
    registrationStatus: operational ? "active" : "tin_verified",
    operational,
    permissions: [],
  });
  const none = { businesses: [], activeWorkspaceId: null, tenancies: [], oversight: [], broker: null, staff: { isStaff: false, roles: [] } };

  test("the business the session chose, else a residence one, else any other", () => {
    assert.deepEqual(c.landingFor({ ...none, businesses: [business(hotel, "hospitality"), business(res, "residence")] }), {
      surface: "landlord",
      workspaceId: res,
    });
    assert.deepEqual(
      c.landingFor({ ...none, businesses: [business(hotel, "hospitality"), business(res, "residence")], activeWorkspaceId: hotel }),
      { surface: "business", workspaceId: hotel },
    );
  });

  test("then a tenancy, a leader seat, a broker record, staff, else a guest", () => {
    assert.equal(c.landingFor({ ...none, businesses: [business(res, "residence", false)], tenancies: [{ status: "active" }] }).surface, "tenant");
    assert.equal(c.landingFor({ ...none, oversight: [{}] }).surface, "leader");
    assert.equal(c.landingFor({ ...none, broker: { id: res, name: null, status: "active" } }).surface, "broker");
    assert.equal(c.landingFor({ ...none, staff: { isStaff: true, roles: ["ops"] } }).surface, "admin");
    assert.equal(c.landingFor(none).surface, "guest");
  });

  test("the landlord's business is the session's residence choice, else the first running one", () => {
    const list = [business(hotel, "residence"), business(res, "residence")];
    assert.equal(c.landlordBusiness(list, res).workspaceId, res);
    assert.equal(c.landlordBusiness(list, null).workspaceId, hotel);
    assert.equal(c.landlordBusiness([business(res, "residence", false)], res), null);
  });
});
