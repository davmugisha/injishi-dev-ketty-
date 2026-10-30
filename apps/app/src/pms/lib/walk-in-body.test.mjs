/**
 * The registration card goes on the wire only when the desk typed one, and a
 * value the contract would refuse is caught at the field.
 *
 * Runs the real function: the source is read, its one type-only import is
 * dropped, and the TypeScript is transpiled and evaluated, the way
 * `legacy-redirect.test.mjs` does.
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

async function load() {
  let src = readFileSync(resolve(here, "walk-in-body.ts"), "utf8");
  const imports = /^import[^;]+;\s*$/gm;
  assert.ok(src.match(imports)?.length, "walk-in-body.ts has no imports to strip; update this loader");
  src = src.replace(imports, "");
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const { registrationCardFrom, registrationProblems } = await load();
const blank = { nid: "", phone: "", email: "" };

describe("registrationCardFrom", () => {
  test("sends no card when the desk typed nothing", () => {
    assert.equal(registrationCardFrom(blank), undefined);
    assert.equal(registrationCardFrom({ nid: "  ", phone: "\t", email: " " }), undefined);
  });

  test("sends exactly the fields typed, trimmed", () => {
    assert.deepEqual(registrationCardFrom({ ...blank, nid: " 1 1990 8 0012345 0 12 " }), {
      idNumber: "1 1990 8 0012345 0 12",
    });
    assert.deepEqual(registrationCardFrom({ ...blank, phone: " +250 788 000 111 " }), {
      phone: "+250 788 000 111",
    });
  });

  test("lower-cases the email so the echo matches the address mailed", () => {
    assert.deepEqual(registrationCardFrom({ ...blank, email: " Guest@Example.COM " }), {
      email: "guest@example.com",
    });
  });

  test("never sets invite itself; the contract defaults it from the email", () => {
    const card = registrationCardFrom({ nid: "x", phone: "0788000111", email: "a@b.co" });
    assert.deepEqual(Object.keys(card).sort(), ["email", "idNumber", "phone"]);
  });
});

describe("registrationProblems", () => {
  test("has nothing to say about an empty or a well-formed card", () => {
    assert.deepEqual(registrationProblems(blank), {});
    assert.deepEqual(
      registrationProblems({ nid: "1 1990 8 0012345 0 12", phone: "+250788000111", email: "a@b.co" }),
      {},
    );
  });

  test("refuses a phone shorter than the contract's six characters", () => {
    assert.match(registrationProblems({ ...blank, phone: "12345" }).phone, /6 digits/);
    assert.equal(registrationProblems({ ...blank, phone: "123456" }).phone, undefined);
  });

  test("refuses a phone longer than 32 characters", () => {
    assert.ok(registrationProblems({ ...blank, phone: "1".repeat(33) }).phone);
  });

  test("refuses an email with no domain", () => {
    assert.ok(registrationProblems({ ...blank, email: "guest@" }).email);
    assert.ok(registrationProblems({ ...blank, email: "guest" }).email);
  });

  test("refuses an ID number longer than 64 characters", () => {
    assert.ok(registrationProblems({ ...blank, nid: "9".repeat(65) }).nid);
    assert.equal(registrationProblems({ ...blank, nid: "9".repeat(64) }).nid, undefined);
  });
});
