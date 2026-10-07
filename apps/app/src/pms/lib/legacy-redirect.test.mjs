/**
 * An old kind-prefixed deep link must land on a screen that exists.
 *
 * `redirectLegacyPath` copied the tail of `/host/bills/x` onto `/w/<id>/` as it
 * stood, so `/host/revenue`, `/host/payouts`, `/host/rooms-rates` and
 * `/landlord/compliance` all became addresses no route serves. Every one of
 * them was a live link on the day the prefix changed, which is the only reason
 * the shim exists.
 *
 * THIS TEST RUNS THE REAL FUNCTION, the way `apps/web/tests/safe-redirect`
 * does: the source is read, its imports (Next's server runtime among them) are
 * dropped because `legacyScreenPath` uses none of them, and the TypeScript is
 * transpiled and evaluated.
 *
 * It also walks `src/app/w/[workspaceId]/` and fails when `WORKSPACE_ROUTES`
 * disagrees with the route tree, so a screen added or deleted later cannot
 * quietly change where an old link lands.
 *
 * Run: pnpm --filter @injishi/app test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ts = require("typescript");

async function load() {
  let src = readFileSync(resolve(here, "legacy-redirect.ts"), "utf8");
  const imports = /^import[^;]+;\s*$/gm;
  assert.ok(src.match(imports)?.length, "legacy-redirect.ts has no imports to strip; update this loader");
  src = src.replace(imports, "");
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const { legacyScreenPath, WORKSPACE_ROUTES, MOVED_IN_WORKSPACE } = await load();

/** Every page under the workspace segment, as `a/*\/b` patterns. */
function routesOnDisk() {
  const root = resolve(here, "..", "..", "app", "w", "[workspaceId]");
  const found = [];
  const walk = (dir, parts) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const segment = entry.name.startsWith("[") ? "*" : entry.name;
      const next = [...parts, segment];
      const child = join(dir, entry.name);
      if (existsSync(join(child, "page.tsx"))) found.push(next.join("/"));
      walk(child, next);
    }
  };
  walk(root, []);
  return found.sort();
}

describe("WORKSPACE_ROUTES", () => {
  test("matches the route tree under src/app/w/[workspaceId]", () => {
    assert.deepEqual([...WORKSPACE_ROUTES].sort(), routesOnDisk());
  });
});

describe("legacyScreenPath", () => {
  const cases = [
    // The audit's own examples.
    ["host", ["bills", "x"], "/finance/bills/x"],
    ["host", ["bills"], "/finance"],
    ["host", ["revenue"], "/finance/revenue"],
    ["host", ["payouts"], "/finance/payouts"],
    ["host", ["invoices"], "/finance/invoices"],
    ["host", ["rooms-rates"], "/inventory"],
    ["landlord", ["compliance"], "/finance/filings"],
    // The rest of move 5.
    ["host", ["grid"], "/calendar"],
    ["host", ["availability"], "/calendar"],
    ["host", ["offer"], "/inventory/amenities"],
    ["host", ["orders"], "/services"],
    ["host", ["menu"], "/services/menu"],
    ["host", ["messages"], "/inbox"],
    ["host", ["messages", "t-1"], "/inbox/t-1"],
    ["landlord", ["tenant-messages"], "/inbox"],
    ["host", ["cleaning"], "/housekeeping"],
    ["host", ["tickets"], "/maintenance"],
    // Team & Departments went to Settings › Team & roles (2026-10-07).
    ["host", ["team"], "/people/roles"],
    ["landlord", ["plan"], "/settings/plan"],
    // `directory` meant opposite jobs per kind.
    ["landlord", ["directory"], "/listing"],
    ["broker", ["directory"], "/directory"],
    // Unchanged names pass through, records and lenses included.
    // Today became the Dashboard (the Navigation board's renames).
    ["host", ["today"], "/dashboard"],
    ["host", ["inbox"], "/inbox"],
    ["host", ["inventory", "rate-plans"], "/inventory/rate-plans"],
    ["host", ["staff", "payroll"], "/staff/payroll"],
    ["host", ["rooms"], "/rooms"],
    ["host", ["maintenance"], "/maintenance"],
    ["host", ["people", "departments"], "/people/departments"],
    // The destinations that are new in 2026-10-07 resolve as themselves.
    ["host", ["front-desk"], "/front-desk"],
    ["host", ["night-audit"], "/night-audit"],
    ["host", ["reservations", "r-9", "payment"], "/reservations/r-9/payment"],
    ["landlord", ["leases", "l-2", "filing"], "/leases/l-2/filing"],
    ["broker", ["earnings"], "/earnings"],
    // Past the end of a real screen: cut back to the screen.
    ["host", ["revenue", "2026", "q3"], "/finance/revenue"],
    ["landlord", ["leases", "l-2", "nonsense"], "/leases/l-2"],
    // Segments are encoded, so a decoded param cannot add a path level.
    ["host", ["bills", "a/b"], "/finance/bills/a%2Fb"],
  ];

  for (const [kind, tail, expected] of cases) {
    test(`/${kind}/${tail.join("/")} -> ${expected}`, () => {
      assert.equal(legacyScreenPath(kind, tail), expected);
    });
  }

  test("a segment with no new home gives null, so the caller sends it home", () => {
    assert.equal(legacyScreenPath("host", ["no-such-screen"]), null);
    assert.equal(legacyScreenPath("host", ["no-such-screen", "x"]), null);
  });

  test("an empty tail gives null", () => {
    assert.equal(legacyScreenPath("host", []), null);
    assert.equal(legacyScreenPath("host", [""]), null);
  });

  test("every non-null answer is a real route", () => {
    for (const [kind, tail] of cases) {
      const path = legacyScreenPath(kind, tail);
      const segments = path.slice(1).split("/");
      const real = WORKSPACE_ROUTES.some((route) => {
        const pattern = route.split("/");
        return pattern.length === segments.length &&
          pattern.every((part, i) => part === "*" || part === segments[i]);
      });
      assert.ok(real, `${path} is not a route`);
    }
  });
});

describe("MOVED_IN_WORKSPACE", () => {
  // An old address inside a workspace keeps its page; the nav lights the
  // destination that absorbed it (`home.test.mjs` holds the nav to the table).
  test("every moved address is still a route, so a bookmark still opens", () => {
    for (const old of Object.keys(MOVED_IN_WORKSPACE)) {
      assert.ok(WORKSPACE_ROUTES.includes(old), `/w/<id>/${old} is no longer a route`);
    }
  });

  test("the old addresses the navigation moved are all accounted for", () => {
    for (const old of ["today", "inbox", "inventory", "staff", "people/roles", "people/departments", "rooms", "maintenance", "setup", "psf-membership"]) {
      assert.ok(MOVED_IN_WORKSPACE[old], `${old} has no recorded destination`);
    }
  });
});
