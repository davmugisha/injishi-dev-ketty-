/**
 * "Set up your property" links only to a setup the API will let the owner use (`src/lib/setup-link.ts`).
 *
 * The bug this pins: the In review page said "While you wait, prepare your listing" and linked to
 * `/w/<id>/setup` at every stage, while the API refuses every inventory write until the business is active
 * (D20), and nothing answered at that path. Now the link exists only once the registration is active, and it
 * goes to the operator app's origin when that is a separate origin (a laptop), or stays relative when the app
 * is a zone under web's (every deployed stack).
 *
 * THIS TEST RUNS THE REAL FUNCTION: the source is read, transpiled and evaluated, never restated.
 *
 * Run: pnpm --filter @injishi/web test
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

async function load() {
  const src = readFileSync(resolve(here, "../src/lib/setup-link.ts"), "utf8");
  assert.doesNotMatch(src, /^\s*import\s/m, "setup-link.ts has grown an import; this test loads it bare");
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const { setupLink, setupNote } = await load();

const WS = "7f3c2a10-1b2c-4d5e-8f90-a1b2c3d4e5f6";
const LAPTOP = ["http://localhost:3000", "http://localhost:3002"];
const ZONE = ["https://www.injishi.com", "https://www.injishi.com"];

describe("no link while the API would refuse the setup", () => {
  for (const status of ["pending_payment", "submitted", "tin_verified", "field_verified", "approved", "rejected", "suspended"]) {
    test(status, () => {
      assert.equal(setupLink({ status, workspaceId: WS }, ...LAPTOP), null);
      assert.equal(setupLink({ status, workspaceId: WS }, ...ZONE), null);
      assert.doesNotMatch(setupNote(status), /prepare (it|your listing) now|add rooms, prices and photos now/i);
      assert.match(setupNote(status), /opens once/i);
    });
  }
});

describe("an active business gets the setup page", () => {
  test("on a laptop the app is its own origin, so the link carries it", () => {
    assert.equal(setupLink({ status: "active", workspaceId: WS }, ...LAPTOP), `http://localhost:3002/w/${WS}/setup`);
  });
  test("in a deployed stack the app is a zone under web, so the path alone", () => {
    assert.equal(setupLink({ status: "active", workspaceId: WS }, ...ZONE), `/w/${WS}/setup`);
  });
  test("unset build values fall back to the laptop defaults", () => {
    assert.equal(setupLink({ status: "active", workspaceId: WS }, undefined, undefined), `http://localhost:3002/w/${WS}/setup`);
  });
  test("the note invites the setup without promising anything early", () => {
    assert.match(setupNote("active"), /publish/i);
  });
});

test("a malformed workspace id never becomes a link", () => {
  assert.equal(setupLink({ status: "active", workspaceId: "../admin" }, ...LAPTOP), null);
  assert.equal(setupLink({ status: "active", workspaceId: "" }, ...ZONE), null);
});
