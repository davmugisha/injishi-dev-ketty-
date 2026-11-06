/**
 * The operator app takes access from the server (ADR-076 G12 to G14).
 *
 * Pure decisions over what `/me/workspaces`, `/me/staff`, `/me/oversight` and `/platform` said: which shell
 * a person gets, which screens open and which layer refuses the rest, where they land, and what the
 * switcher lists. No persona decides any of it outside the demo.
 *
 *   pnpm --filter @injishi/app exec tsx --test tests/*.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { type BoardId, personas, screens } from "@injishi/data";
import {
  type AccessSubject,
  homeFor,
  screenDecision,
  switcherFor,
  type Workspace,
  type WorkspaceGrants,
} from "../src/server/access";
import { shellFor } from "../src/server/auth";

const REMERA = "11111111-1111-4111-8111-111111111111";
const RUBAVU = "22222222-2222-4222-8222-222222222222";

const HOTEL_PRODUCTS = ["account", "marketplace", "pms", "outlets", "pos", "hr", "finance", "pay"];

function grants(role: string, permissions: string[], products = HOTEL_PRODUCTS): WorkspaceGrants {
  return {
    family: "business",
    products: products.map((id) => ({ id, branches: "all" as const })),
    roles: [{ roleId: null, key: role, name: role, kind: "default", scopes: [] }],
    permissions: permissions.map((key) => ({ key, scopes: [] })),
  };
}

function workspace(role: string, permissions: string[], extra: Partial<Workspace> = {}): Workspace {
  return {
    workspaceId: "ws-hotel",
    kind: "business",
    orgId: "org-hotel",
    orgName: "Kivu Hotel Ltd",
    domain: "hospitality",
    orgRole: role,
    registrationStatus: "active",
    permissions: [],
    branches: [
      { id: REMERA, name: "Remera", districtName: "Gasabo", isHeadOffice: true },
      { id: RUBAVU, name: "Rubavu", districtName: "Rubavu", isHeadOffice: false },
    ],
    label: "Kivu Hotel Ltd",
    grants: grants(
      role,
      permissions,
      extra.grants?.products.map((p) => p.id),
    ),
    ...extra,
  };
}

const OWNER_KEYS = [
  "account.team.manage",
  "finance.money.view",
  "pms.reservation.approve",
  "pms.stay.checkin",
  "property.listing.manage",
  "hr.people.manage",
];
const OWNER = workspace("owner", OWNER_KEYS);
const DESK_KEYS = [
  "pms.reservation.approve",
  "pms.reservation.assign",
  "pms.stay.checkin",
  "pms.stay.checkout",
  "pms.folio.charge",
  "outlets.order.advance",
  "hr.attendance.record",
];
const DESK = workspace("receptionist", DESK_KEYS);
const HOUSEKEEPER = workspace("housekeeper", ["pms.housekeeping.set", "pms.ticket.advance"]);
const FINANCE = workspace("finance", [
  "finance.money.view",
  "pms.folio.charge",
  "pms.folio.payment",
  "fiscal.ebm.manage",
]);

function subject(active: Workspace | null, extra: Partial<AccessSubject> = {}): AccessSubject {
  return {
    demo: false,
    personaId: "owner",
    workspaces: active ? [active] : [],
    active,
    staff: false,
    oversight: false,
    ...extra,
  };
}

const decide = (s: AccessSubject | null, board: BoardId) => screenDecision(s, board);

test("a production sign-in by a demo persona's email gets that person's own grants, never the persona (G12)", () => {
  const user = { id: "u1", name: "Didier Mugenzi", email: personas.owner.email };
  const real = shellFor(user, [DESK], DESK, { staff: false, oversightRoles: [], environment: "production" });
  assert.equal(real.demo, false);
  assert.equal(real.shell.id, "frontdesk", "the shell of the role the grant names");
  const demo = shellFor(user, [DESK], DESK, { staff: false, oversightRoles: [], environment: "demo" });
  assert.equal(demo.demo, true);
  assert.equal(demo.shell.id, "owner");
});

test("every shell comes from the server: business role, broker, staff, oversight, else the guest's (G12)", () => {
  const user = { id: "u2", name: "A Person", email: "person@example.com" };
  const shell = (workspaces: Workspace[], active: Workspace | null, staff = false, oversightRoles: string[] = []) =>
    shellFor(user, workspaces, active, { staff, oversightRoles, environment: "production" }).shell.id;
  assert.equal(shell([OWNER], OWNER), "owner");
  assert.equal(shell([FINANCE], FINANCE), "finance");
  const landlord = workspace("owner", ["residence.rent.record"], { domain: "residence" });
  assert.equal(shell([landlord], landlord), "landlord");
  // Where /me/context lands a person decides first: a landlord, a broker, a tenant.
  const landed = (landing: "landlord" | "broker" | "tenant") =>
    shellFor(user, [], null, { staff: false, oversightRoles: [], environment: "production", landing }).shell.id;
  assert.equal(landed("landlord"), "landlord");
  assert.equal(landed("broker"), "broker");
  assert.equal(landed("tenant"), "tenant");
  const broker = { ...OWNER, workspaceId: "ws-broker", kind: "broker", grants: undefined };
  assert.equal(shell([broker], null), "broker");
  assert.equal(shell([], null, true), "ops");
  assert.equal(shell([], null, false, ["business_field_verifier"]), "officer");
  assert.equal(shell([], null), "guest");
});

test("an oversight seat picks its console: the PSF District Manager's, the BDE's, a leader's guests", () => {
  const user = { id: "u3", name: "A Person", email: "person@example.com" };
  const seats = (oversightRoles: string[]) =>
    shellFor(user, [], null, { staff: false, oversightRoles, environment: "production" }).shell;
  assert.equal(seats(["psf_membership_officer"]).id, "psf");
  assert.equal(seats(["psf_business_officer"]).id, "psfdbo");
  // A local leader reviews no business: an officer's shell, landing on the guests in their area.
  const leader = seats(["village_leader"]);
  assert.equal(leader.id, "officer");
  assert.equal(leader.home, "LeaderGuests");
  // A leader who also reviews registrations is an officer with the officer's own home.
  assert.notEqual(seats(["village_leader", "business_field_verifier"]).home, "LeaderGuests");
});

test("a screen opens on the product being on and a permission the grant holds (G14)", () => {
  assert.deepEqual(decide(subject(OWNER), "OwnerHome"), { ok: true });
  assert.deepEqual(decide(subject(DESK), "FrontDeskToday"), { ok: true });
  assert.deepEqual(decide(subject(DESK), "OwnerHome"), { ok: false, layer: "permission" });
  assert.deepEqual(decide(subject(HOUSEKEEPER), "FrontDeskToday"), { ok: false, layer: "permission" });
  assert.deepEqual(decide(subject(HOUSEKEEPER), "HousekeepingBoard"), { ok: true });
  assert.deepEqual(decide(subject(FINANCE), "FinanceHome"), { ok: true });
  assert.deepEqual(decide(subject(FINANCE), "Employees"), { ok: false, layer: "permission" });
});

test("a product switched off refuses its screens by entitlement, whatever the role holds", () => {
  const noPms = workspace("owner", OWNER_KEYS, {
    grants: grants("owner", OWNER_KEYS, ["account", "marketplace", "hr", "finance", "pay"]),
  });
  assert.deepEqual(decide(subject(noPms), "Reservations"), { ok: false, layer: "entitlement" });
  assert.deepEqual(decide(subject(noPms), "OwnerHome"), { ok: true });
});

test("a business still in registration is refused by the operational layer, and opens its setup", () => {
  const pending = workspace("owner", [], {
    registrationStatus: "tin_verified",
    grants: grants("owner", [], ["account"]),
  });
  assert.deepEqual(decide(subject(pending), "Reservations"), { ok: false, layer: "operational" });
  assert.equal(homeFor(subject(pending), personas.owner.home, "owner", "/trips"), "/w/ws-hotel/setup");
});

test("staff and oversight screens open from the API's own answers, never a business role", () => {
  assert.deepEqual(decide(subject(OWNER), "AdminHome"), { ok: false, layer: "workspace" });
  assert.deepEqual(decide(subject(null, { staff: true }), "AdminHome"), { ok: true });
  assert.deepEqual(decide(subject(null, { oversight: true }), "PsfConsole"), { ok: true });
  assert.deepEqual(decide(subject(null), "Reservations"), { ok: false, layer: "workspace" });
  assert.deepEqual(decide(null, "Reservations"), { ok: false, layer: "session" });
  assert.deepEqual(decide(null, "MarketExplore"), { ok: true });
});

test("only a demo persona, on the demo, is judged by its story", () => {
  const demo = subject(null, { demo: true, personaId: "frontdesk" });
  assert.deepEqual(decide(demo, "FrontDeskToday"), { ok: true });
  assert.deepEqual(decide(demo, "AdminHome"), { ok: false, layer: "permission" });
});

test("each role keeps its own home; with its product off, the first product it holds a permission in (G14)", () => {
  const home = (w: Workspace, shell: keyof typeof personas) =>
    homeFor(subject(w), personas[shell].home, shell, "/trips");
  assert.equal(home(OWNER, "owner"), screens.OwnerHome.href);
  assert.equal(home(DESK, "frontdesk"), screens.FrontDeskToday.href);
  assert.equal(home(HOUSEKEEPER, "housekeeper"), screens.StaffToday.href);
  assert.equal(home(FINANCE, "finance"), screens.FinanceHome.href);
  const deskNoPms = workspace("receptionist", DESK_KEYS, {
    grants: grants("receptionist", DESK_KEYS, ["account", "outlets", "hr"]),
  });
  assert.equal(home(deskNoPms, "frontdesk"), screens.OutletOrders.href);
  assert.equal(homeFor(subject(null), personas.guest.home, "guest", "/trips"), "/trips");
});

test("the switcher lists the person's own businesses and branches from /me/workspaces, never a demo's (G13)", () => {
  const other = workspace("manager", [], { workspaceId: "ws-lodge", orgName: "Akagera Lodge", branches: [] });
  const ctx = switcherFor([OWNER, other], OWNER);
  assert.ok(ctx);
  assert.equal(ctx.workspaceId, "ws-hotel");
  assert.equal(ctx.name, "Kivu Hotel Ltd");
  assert.deepEqual(
    ctx.branches.map((b) => b.name),
    ["All branches", "Remera", "Rubavu"],
  );
  assert.deepEqual(ctx.others, [{ ini: "AL", name: "Akagera Lodge", meta: "manager", href: "/w/ws-lodge" }]);
  assert.equal(ctx.invite, null);
  assert.ok(!JSON.stringify(ctx).includes("Amahoro"), "nothing of the demo's business");
  assert.equal(switcherFor([], null), null);
});
