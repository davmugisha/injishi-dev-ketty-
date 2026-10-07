/**
 * The Roles editor's layout and the words the three People lenses share
 * (ADR-055, ADR-069): every permission sits in exactly one area, payroll's
 * draft and confirm are two rows side by side, a change is measured against
 * the arrays the server sent, and each of the six roles has its words.
 *
 * Runs the real functions: each source is read, its type-only imports are
 * dropped, and the TypeScript is transpiled and evaluated, the way
 * `data/nav-counts.test.mjs` does. The permission vocabulary comes from the
 * built `@injishi/contracts`, the same one the screens import.
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
const { OrgRole, Permission, PERMISSION_AREA_OF, PERMISSION_LABEL, InvitableOrgRole } = require("@injishi/contracts");

async function load(file) {
  let src = readFileSync(resolve(here, file), "utf8");
  const imports = /^import[^;]+;\s*$/gm;
  assert.ok(src.match(imports)?.length, `${file} has no imports to strip; update this loader`);
  for (const line of src.match(imports)) {
    assert.match(line, /^import type /, `${file} gained a runtime import (${line.trim()}); the loader drops it`);
  }
  src = src.replace(imports, "");
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const { AREA_ORDER, PERMISSION_HINT, departures, groupByArea, sayPermissions, sentenceCase } =
  await load("permission-rows.ts");
const { ROLE_COPY, OWNER_NOT_INVITABLE } = await load("role-copy.ts");

const ORDER = Permission.options;

describe("groupByArea", () => {
  const groups = groupByArea(ORDER, PERMISSION_AREA_OF);

  test("every permission appears exactly once, under its own area", () => {
    const seen = groups.flatMap((g) => g.permissions);
    assert.equal(seen.length, ORDER.length);
    assert.deepEqual([...seen].sort(), [...ORDER].sort());
    for (const g of groups) for (const p of g.permissions) assert.equal(PERMISSION_AREA_OF[p], g.area);
  });

  test("areas read in the shift's order, and none is empty", () => {
    assert.deepEqual(
      groups.map((g) => g.area),
      AREA_ORDER.filter((a) => groups.some((g) => g.area === a)),
    );
    for (const g of groups) assert.ok(g.permissions.length > 0);
  });

  test("draft the pay run and confirm the pay run are two rows, draft immediately before confirm", () => {
    const people = groups.find((g) => g.area === "people").permissions;
    const draft = people.indexOf("payroll.draft");
    const confirm = people.indexOf("payroll.run");
    assert.ok(draft >= 0 && confirm >= 0);
    assert.equal(confirm, draft + 1);
    assert.equal(sentenceCase(PERMISSION_LABEL["payroll.draft"]), "Draft the pay run");
    assert.equal(sentenceCase(PERMISSION_LABEL["payroll.run"]), "Confirm the pay run");
  });

  test("the team permission is listed in People, where its lock is shown", () => {
    assert.ok(groups.find((g) => g.area === "people").permissions.includes("team.manage"));
  });

  test("every hint names a real permission", () => {
    for (const p of Object.keys(PERMISSION_HINT)) assert.ok(ORDER.includes(p), p);
  });
});

describe("departures", () => {
  test("measures what changed between two arrays, in the contract's order", () => {
    const d = departures(ORDER, ["money.view", "folio.charge"], ["folio.charge", "payroll.run", "folio.payment"]);
    assert.deepEqual(d.granted, ["folio.payment", "payroll.run"]);
    assert.deepEqual(d.withdrawn, ["money.view"]);
  });

  test("the same set is no change, whatever order it arrives in", () => {
    const d = departures(ORDER, ["leave.approve", "people.view"], ["people.view", "leave.approve"]);
    assert.deepEqual(d, { granted: [], withdrawn: [] });
  });
});

describe("sayPermissions", () => {
  test("reads as a list of verb phrases", () => {
    assert.equal(sayPermissions([], PERMISSION_LABEL), "");
    assert.equal(sayPermissions(["money.view"], PERMISSION_LABEL), "view money");
    assert.equal(
      sayPermissions(["money.view", "folio.payment", "folio.close"], PERMISSION_LABEL),
      "view money, record payments and close a bill and sign its receipt",
    );
    assert.equal(
      sayPermissions(["money.view", "folio.payment"], PERMISSION_LABEL, "or"),
      "view money or record payments",
    );
  });
});

describe("ROLE_COPY", () => {
  test("all six roles have their words, and only those", () => {
    assert.deepEqual(Object.keys(ROLE_COPY).sort(), [...OrgRole.options].sort());
    assert.equal(OrgRole.options.length, 6);
  });

  test("each working day is one line, and says something the name does not", () => {
    for (const role of OrgRole.options) {
      const { everyDay, short } = ROLE_COPY[role];
      assert.ok(!/\n/.test(everyDay) && !/\n/.test(short), role);
      assert.ok(everyDay.length > 30 && everyDay.length <= 130, `${role}: ${everyDay.length} chars`);
      assert.ok(short.length > 0 && short.length <= 48, `${role}: ${short.length} chars`);
    }
  });

  test("HR drafts the pay run and the owner confirms it", () => {
    assert.match(ROLE_COPY.hr.everyDay, /drafts the pay run/);
    assert.match(ROLE_COPY.owner.everyDay, /confirming the pay run/);
  });

  test("the owner is the one role no invitation offers, and the reason is worded", () => {
    assert.ok(!InvitableOrgRole.options.includes("owner"));
    assert.deepEqual(
      [...InvitableOrgRole.options].sort(),
      OrgRole.options.filter((r) => r !== "owner").sort(),
    );
    assert.match(OWNER_NOT_INVITABLE, /owner claim/);
  });
});
