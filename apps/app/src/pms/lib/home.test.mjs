/**
 * A home for each role, and the role-aware nav behind it (ADR-069 D-c, D-d,
 * D-f; the Navigation and Sidebar boards, 2026-10-07).
 *
 * THIS TEST RUNS THE REAL FUNCTIONS against the REAL default permission sets.
 * `nav.ts` and `home.ts` are read, their imports dropped, and transpiled into
 * one module; `HR_PERMISSIONS` and `permissionsForRole` come from the built
 * `@injishi/contracts`, so a change to a role's default set shows up here as a
 * door gained or lost, not as a fixture that went stale. `legacy-redirect.ts`
 * is loaded the same way for its table of moved addresses.
 *
 * Run: pnpm --filter @injishi/app test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ts = require("typescript");
const contracts = await import("@injishi/contracts");

const IMPORTS = /^import[^;]+;\s*$/gm;

function source(file) {
  const src = readFileSync(resolve(here, file), "utf8");
  assert.ok(src.match(IMPORTS)?.length, `${file} has no imports to strip; update this loader`);
  return src.replace(IMPORTS, "");
}

async function evaluate(src) {
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

// nav.ts reads one value from the contracts at module level; home.ts reads nav.
const nav = await evaluate(
  `const HR_PERMISSIONS = ${JSON.stringify(contracts.HR_PERMISSIONS)};\n${source("nav.ts")}\n${source("home.ts")}`,
);
const { MOVED_IN_WORKSPACE } = await evaluate(source("legacy-redirect.ts"));

const { homeFor, homeEntryKey, navFor, allowedSegments, activeEntry, opensOnPhoneSurface } = nav;
const roleSet = (role) => [...contracts.permissionsForRole(role)];

const WS = "de300000-0000-4000-8000-000000000201";
const BASE = `/w/${WS}`;
/** Every USALI category, as Amahoro runs them (migration 0011). */
const ALL_DEPARTMENTS = [
  "rooms", "fnb", "spa_recreation", "other_operated", "misc_income", "admin_general",
  "sales_marketing", "it", "engineering", "utilities", "hr",
];

function grant(role, overrides = {}) {
  return {
    key: "host",
    workspaceId: WS,
    role,
    permissions: roleSet(role),
    departments: ALL_DEPARTMENTS,
    psfCanManage: false,
    ...overrides,
  };
}

function sectionsFor(g, counts) {
  return navFor({
    ws: g.key,
    workspaceId: g.workspaceId,
    permissions: g.permissions,
    departments: g.departments,
    psfManage: g.psfCanManage === true,
    counts,
  });
}

const labels = (sections) => sections.flatMap((s) => s.items.map((i) => i.label));
const item = (sections, label) => sections.flatMap((s) => s.items).find((i) => i.label === label);

const SIXTEEN = [
  "Dashboard", "Front desk", "Reservations", "Calendar", "Guests", "Messages",
  "Housekeeping", "Services", "Night audit",
  "Rates & Inventory", "Revenue", "Sales & events", "Finance", "Reports", "People",
];

describe("the navigation's shape (the Navigation board)", () => {
  test("three groups in the body, Settings in the footer", () => {
    const sections = sectionsFor(grant("owner"));
    assert.deepEqual(
      sections.map((s) => [s.label, s.placement ?? "body"]),
      [["Front desk", "body"], ["Operations", "body"], ["Business", "body"], ["Settings", "footer"]],
    );
  });

  test("the owner reaches every destination, in the board's order, and Settings", () => {
    assert.deepEqual(labels(sectionsFor(grant("owner"))), [...SIXTEEN, "Settings"]);
  });

  test("the manager reaches the same sixteen and Settings", () => {
    assert.deepEqual(labels(sectionsFor(grant("manager"))), [...SIXTEEN, "Settings"]);
  });

  test("the renames: no Today, Inbox, Inventory, Staff or Team & Departments label survives", () => {
    const all = labels(sectionsFor(grant("owner")));
    for (const old of ["Today", "Inbox", "Inventory", "Staff", "Team & Departments", "Room status", "Setup"]) {
      assert.ok(!all.includes(old), `${old} is still a nav label`);
    }
  });

  test("Housekeeping is one destination with three lenses, opening on Room status", () => {
    const hk = item(sectionsFor(grant("manager")), "Housekeeping");
    assert.deepEqual(hk.lenses.map((l) => l.label), ["Room status", "Tasks", "Maintenance"]);
    assert.equal(hk.href, `${BASE}/rooms`);
  });

  test("a hotel with no engineering department has no Maintenance lens", () => {
    const hk = item(sectionsFor(grant("manager", { departments: ["rooms", "fnb"] })), "Housekeeping");
    assert.deepEqual(hk.lenses.map((l) => l.label), ["Room status", "Tasks"]);
  });

  test("a hotel with no service department has no Services", () => {
    assert.ok(!labels(sectionsFor(grant("owner", { departments: ["rooms"] }))).includes("Services"));
  });

  test("Guests, Revenue and Sales & events are marked Horizon, nothing else is", () => {
    const horizon = sectionsFor(grant("owner")).flatMap((s) => s.items).filter((i) => i.horizon).map((i) => i.label);
    assert.deepEqual(horizon, ["Guests", "Revenue", "Sales & events"]);
  });
});

describe("each role's doors (the Sidebar board, ADR-069 D-c and D-d)", () => {
  test("the desk: the front office and operations, none of the business", () => {
    assert.deepEqual(labels(sectionsFor(grant("receptionist"))), [
      "Dashboard", "Front desk", "Reservations", "Calendar", "Guests", "Messages",
      "Housekeeping", "Services", "Night audit",
    ]);
  });

  test("the accountant: Finance, Reservations, Guests, Reports, and Settings on Integrations", () => {
    const sections = sectionsFor(grant("finance"));
    assert.deepEqual(labels(sections), ["Reservations", "Guests", "Finance", "Reports", "Settings"]);
    const settings = item(sections, "Settings");
    assert.deepEqual(settings.lenses.map((l) => l.label), ["Integrations"]);
    assert.equal(settings.href, `${BASE}/settings/integrations`);
  });

  test("HR: People, and Settings on Departments read only; no guest inbox (D-d)", () => {
    const sections = sectionsFor(grant("hr"));
    assert.deepEqual(labels(sections), ["People", "Settings"]);
    const settings = item(sections, "Settings");
    assert.deepEqual(settings.lenses.map((l) => l.label), ["Departments"]);
    assert.equal(settings.href, `${BASE}/people/departments`);
  });

  test("HR opens Payroll (payroll.draft, ADR-069 D-e)", () => {
    const people = item(sectionsFor(grant("hr")), "People");
    assert.ok(people.lenses.some((l) => l.label === "Payroll"));
    assert.ok(nav.staffLenses(roleSet("hr")).some((l) => l.key === "payroll"));
    assert.ok(nav.staffLenses(["payroll.draft"]).some((l) => l.key === "payroll"));
  });

  test("the owner's Settings: Property, Integrations, Team & roles, Departments, and Memberships when PSF is theirs", () => {
    const settings = item(sectionsFor(grant("owner", { psfCanManage: true })), "Settings");
    assert.deepEqual(settings.lenses.map((l) => l.label), ["Property", "Integrations", "Team & roles", "Departments", "Memberships"]);
    assert.equal(settings.href, `${BASE}/settings`);
  });

  test("the desk clocks a shift in from Front desk, not from a People door", () => {
    const sections = sectionsFor(grant("receptionist"));
    const desk = item(sections, "Front desk");
    assert.deepEqual(desk.lenses.map((l) => l.label), ["Staff attendance"]);
    // Whoever reaches People reaches attendance there, so the lens is not doubled.
    assert.deepEqual(item(sectionsFor(grant("owner")), "Front desk").lenses, []);
  });

  test("a business that granted its desk money.view (ADR-055) shows the desk Finance and Reports: the grant decides", () => {
    const g = grant("receptionist", { permissions: [...roleSet("receptionist"), "money.view"] });
    const all = labels(sectionsFor(g));
    assert.ok(all.includes("Finance") && all.includes("Reports"));
    // Revenue and Sales & events stay shut: neither is the money alone.
    assert.ok(!all.includes("Revenue") && !all.includes("Sales & events"));
  });
});

describe("the route guard is the nav (one mechanism)", () => {
  const guard = (g) => allowedSegments(sectionsFor(g));

  test("the desk is refused the business screens and HR's", () => {
    const allowed = guard(grant("receptionist"));
    for (const s of ["dashboard", "today", "front-desk", "reservations", "stays", "calendar", "guests", "inbox", "rooms", "services", "night-audit", "staff"]) {
      assert.ok(allowed.has(s), `desk refused ${s}`);
    }
    for (const s of ["finance", "people", "settings", "inventory", "setup", "sales", "reports", "housekeeping", "maintenance"]) {
      assert.ok(!allowed.has(s), `desk reaches ${s}`);
    }
  });

  test("the accountant reaches the books and the bookings, and nothing operational", () => {
    const allowed = guard(grant("finance"));
    for (const s of ["finance", "reservations", "stays", "guests", "reports", "settings"]) assert.ok(allowed.has(s), s);
    for (const s of ["dashboard", "today", "calendar", "people", "staff", "rooms", "housekeeping", "inbox", "night-audit"]) {
      assert.ok(!allowed.has(s), `finance reaches ${s}`);
    }
  });

  test("HR reaches People and Departments, and no money, bookings or guest messages", () => {
    const allowed = guard(grant("hr"));
    for (const s of ["people", "staff"]) assert.ok(allowed.has(s), s);
    for (const s of ["finance", "reservations", "inbox", "dashboard", "front-desk", "settings"]) {
      assert.ok(!allowed.has(s), `hr reaches ${s}`);
    }
  });
});

describe("homeFor (ADR-069 D-f)", () => {
  test("each default role lands on its home", () => {
    assert.equal(homeFor(grant("owner")), `${BASE}/dashboard`);
    assert.equal(homeFor(grant("manager")), `${BASE}/dashboard`);
    assert.equal(homeFor(grant("receptionist")), `${BASE}/dashboard`);
    assert.equal(homeFor(grant("finance")), `${BASE}/finance`);
    assert.equal(homeFor(grant("hr")), `${BASE}/people`);
    assert.equal(homeFor(grant("housekeeper")), `${BASE}/housekeeping`);
  });

  test("only the housekeeper's grant opens the phone surface", () => {
    for (const role of ["owner", "manager", "receptionist", "finance", "hr"]) {
      assert.equal(opensOnPhoneSurface({ ws: "host", permissions: roleSet(role) }), false, role);
    }
    assert.equal(opensOnPhoneSurface({ ws: "host", permissions: roleSet("housekeeper") }), true);
  });

  test("rule 2: an accountant whose business withdrew money.view lands on a door they open, never a refusal", () => {
    const g = grant("finance", { permissions: roleSet("finance").filter((p) => p !== "money.view") });
    assert.equal(homeFor(g), `${BASE}/settings/integrations`);
  });

  test("rule 2: an HR officer with only the roster left still lands on People", () => {
    assert.equal(homeFor(grant("hr", { permissions: ["roster.manage"] })), `${BASE}/people`);
  });

  test("rule 2: a desk without the day's movements lands on the first door it has", () => {
    assert.equal(homeFor(grant("receptionist", { permissions: ["message.send"] })), `${BASE}/inbox`);
  });

  test("rule 6: a business in the registration pipeline holds nothing and lands on the Dashboard", () => {
    const g = grant("owner", { permissions: [] });
    assert.equal(homeFor(g), `${BASE}/dashboard`);
    assert.ok(allowedSegments(sectionsFor(g)).has("dashboard"));
  });

  test("rule 5: a residence business", () => {
    const res = (role) => grant(role, { key: "landlord", departments: [] });
    assert.equal(homeFor(res("owner")), `${BASE}/rent-roll`);
    assert.equal(homeFor(res("manager")), `${BASE}/rent-roll`);
    assert.equal(homeFor(res("finance")), `${BASE}/finance`);
    assert.equal(homeFor(res("hr")), `${BASE}/people`);
  });

  test("a broker opens on the directory", () => {
    assert.equal(homeFor({ key: "broker", workspaceId: WS, role: null, permissions: [], departments: [] }), `${BASE}/directory`);
  });

  test("no workspace id is not an address", () => {
    assert.equal(homeFor(grant("owner", { workspaceId: null })), "/");
  });

  test("the sidebar lists the home first: its entry key", () => {
    const key = (role) => homeEntryKey(grant(role), sectionsFor(grant(role)));
    assert.equal(key("owner"), "today");
    assert.equal(key("finance"), "finance");
    assert.equal(key("hr"), "staff");
  });
});

describe("the sidebar lights the destination that holds an address", () => {
  const owner = sectionsFor(grant("owner", { psfCanManage: true }));
  const lit = (path) => {
    const hit = activeEntry(owner, `${BASE}/${path}`);
    return hit ? [hit.item.label, hit.lens?.label ?? null] : null;
  };

  test("every address the navigation moved lights its new destination", () => {
    for (const [old, where] of Object.entries(MOVED_IN_WORKSPACE)) {
      assert.deepEqual(lit(old), [where.destination, where.lens ?? null], `/w/<id>/${old}`);
    }
  });

  test("records light the destination they are reached through", () => {
    assert.deepEqual(lit("stays/abc/folio"), ["Reservations", null]);
    assert.deepEqual(lit("reservations/abc"), ["Reservations", null]);
    assert.deepEqual(lit("finance/bills/abc"), ["Finance", null]);
    assert.deepEqual(lit("inbox/abc"), ["Messages", null]);
  });

  test("a lens of the Staff screen that is not a sidebar lens lights People alone", () => {
    assert.deepEqual(lit("staff/attendance"), ["People", null]);
    assert.deepEqual(lit("staff/leave/types"), ["People", "Leave"]);
  });

  test("Revenue opens Finance's revenue lens and lights Revenue, not Finance", () => {
    assert.deepEqual(lit("finance/revenue"), ["Revenue", null]);
    assert.deepEqual(lit("finance"), ["Finance", null]);
  });

  test("People is /people itself; what Settings absorbed under it lights Settings", () => {
    assert.deepEqual(lit("people"), ["People", null]);
    assert.deepEqual(lit("people/departments"), ["Settings", "Departments"]);
  });
});

describe("pills", () => {
  const counts = { pendingReservations: 3, arrivalsToCheckIn: 4, housekeepingOpen: 15 };

  test("the desk sees the requests to decide and the arrivals to check in", () => {
    const sections = sectionsFor(grant("receptionist"), counts);
    assert.equal(item(sections, "Reservations").count, 3);
    assert.equal(item(sections, "Front desk").count, 4);
  });

  test("the accountant's Reservations is quiet: they decide no request", () => {
    assert.equal(item(sectionsFor(grant("finance"), counts), "Reservations").count, null);
  });

  test("zero and unanswered are both no pill", () => {
    const sections = sectionsFor(grant("owner"), { pendingReservations: 0 });
    assert.equal(item(sections, "Reservations").count, null);
    assert.equal(item(sections, "Front desk").count, null);
  });
});

describe("the Staff overview (ADR-058)", () => {
  const first = (role) => nav.staffLenses(roleSet(role))[0]?.key;

  test("it is the first Staff lens for whoever keeps files, the roster, leave or pay", () => {
    for (const role of ["owner", "manager", "hr"]) assert.equal(first(role), "overview", role);
    assert.equal(item(sectionsFor(grant("owner")), "People").lenses[0].label, "Overview");
  });

  test("the desk and the housekeeper are not offered it", () => {
    for (const role of ["receptionist", "housekeeper"]) {
      assert.ok(!nav.staffLenses(roleSet(role)).some((l) => l.key === "overview"), role);
    }
  });

  test("/staff itself is still Employees: the overview has an address of its own", () => {
    assert.equal(nav.STAFF_LENSES.find((l) => l.key === "employees").segment, "");
    assert.equal(nav.STAFF_LENSES.find((l) => l.key === "overview").segment, "overview");
    const owner = sectionsFor(grant("owner"));
    const lit = (path) => {
      const hit = activeEntry(owner, `${BASE}/${path}`);
      return [hit.item.label, hit.lens?.label ?? null];
    };
    assert.deepEqual(lit("staff"), ["People", "Employees"]);
    assert.deepEqual(lit("staff/overview"), ["People", "Overview"]);
  });
});

describe("the Staff rail's groups", () => {
  const groups = (role) => nav.staffGroups(roleSet(role));
  const names = (role) => groups(role).map((g) => g.label);

  test("every lens is in a group, and the table is in the groups' order", () => {
    const keys = nav.STAFF_GROUPS.map((g) => g.key);
    const order = nav.STAFF_LENSES.map((l) => keys.indexOf(l.group));
    assert.ok(order.every((n) => n >= 0));
    assert.deepEqual(order, [...order].sort((a, b) => a - b));
  });

  test("the owner's nineteen lenses are eight groups", () => {
    assert.deepEqual(names("owner"), ["Overview", "Employees", "Schedule", "Attendance", "Leave", "Payroll", "Notices", "Settings"]);
    assert.equal(groups("owner").flatMap((g) => g.lenses).length, 19);
  });

  test("a group holds exactly the lenses the grant reaches, in the rail's old order", () => {
    for (const role of ["owner", "manager", "hr", "receptionist", "finance", "housekeeper"]) {
      assert.deepEqual(
        groups(role).flatMap((g) => g.lenses.map((l) => l.key)),
        nav.staffLenses(roleSet(role)).map((l) => l.key),
        role,
      );
    }
  });

  test("the desk is offered no group it cannot open: no Employees, Leave or Payroll", () => {
    assert.deepEqual(names("receptionist"), ["Schedule", "Attendance", "Notices", "Settings"]);
    assert.deepEqual(groups("receptionist").find((g) => g.key === "settings").lenses.map((l) => l.key), ["time-settings"]);
  });
});

describe("My work (058-self-service)", () => {
  /** The nav of a grant that also carries the person's own staff file. */
  const withFile = (g) =>
    navFor({
      ws: g.key,
      workspaceId: g.workspaceId,
      permissions: g.permissions,
      departments: g.departments,
      psfManage: g.psfCanManage === true,
      workFile: true,
    });

  test("no role is offered it without a staff file: it is not a permission", () => {
    for (const role of ["owner", "manager", "receptionist", "finance", "hr"]) {
      const sections = sectionsFor(grant(role));
      assert.ok(!labels(sections).includes("My work"), role);
      assert.ok(!allowedSegments(sections).has("my-work"), role);
    }
  });

  test("every role with a file is offered it, the desk and the accountant alike", () => {
    for (const role of ["owner", "manager", "receptionist", "finance", "hr"]) {
      const sections = withFile(grant(role));
      assert.ok(labels(sections).includes("My work"), role);
      assert.ok(allowedSegments(sections).has("my-work"), role);
    }
  });

  test("it sits in the footer, above Settings, with its four lenses", () => {
    const sections = withFile(grant("owner"));
    const footer = sections.filter((s) => s.placement === "footer").flatMap((s) => s.items.map((i) => i.label));
    assert.deepEqual(footer, ["My work", "Settings"]);
    assert.deepEqual(item(sections, "My work").lenses.map((l) => l.label), ["Today", "My time", "My leave", "My pay"]);
    assert.deepEqual(
      item(sections, "My work").lenses.map((l) => l.href),
      [`${BASE}/my-work`, `${BASE}/my-work/time`, `${BASE}/my-work/leave`, `${BASE}/my-work/pay`],
    );
  });

  test("it is nobody's home: a file does not move where a role lands", () => {
    for (const role of ["owner", "manager", "receptionist", "finance", "hr"]) {
      assert.equal(homeFor(grant(role, { employeeId: "e0000000-0000-4000-8000-000000000001" })), homeFor(grant(role)), role);
    }
  });

  test("a residence business has it too, and a broker workspace never does", () => {
    const landlord = navFor({ ws: "landlord", workspaceId: WS, permissions: roleSet("manager"), departments: [], workFile: true });
    assert.ok(labels(landlord).includes("My work"));
    const broker = navFor({ ws: "broker", workspaceId: WS, permissions: [], departments: [], workFile: true });
    assert.ok(!labels(broker).includes("My work"));
  });
});
