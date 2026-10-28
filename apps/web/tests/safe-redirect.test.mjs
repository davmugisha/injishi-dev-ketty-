/**
 * `safeRedirect` must never send a freshly signed-in person off-site.
 *
 * It did. The rule was "starts with `/` and not `//`", and the WHATWG url
 * parser every browser uses strips a TAB and a NEWLINE before reading a url and
 * treats `\` as `/` — so `"/\t/evil.com"`, `"/\n/evil.com"` and `"/\\evil.com"`
 * all passed the check and all navigated to `http://evil.com/`. `/sign-in` and
 * `/two-factor/verify` both run their `?redirect=` through this function, so a
 * link anyone could send emailed a real code and then handed the session to the
 * attacker's page the moment it was typed.
 *
 * THIS TEST RUNS THE REAL FUNCTION, not a copy of its rule. The source is read,
 * its one path-alias import is replaced with a stub, and the TypeScript is
 * transpiled and evaluated. A test that re-states the rule would pass against a
 * broken implementation, because it would be checking itself.
 *
 * Every bypass is then resolved with `new URL()` — the same parser the browser
 * will use — to state WHERE the browser would actually go. The assertion is on
 * that destination, not on the returned string's shape.
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

const HOME = "/__home__";
const WEB = "http://localhost:3000";

async function loadSafeRedirect() {
  const path = resolve(here, "../src/lib/redirect.ts");
  let src = readFileSync(path, "utf8");
  const aliasImport = /import\s*\{\s*HOME\s*\}\s*from\s*["']@\/lib\/app-nav["'];?/;
  assert.match(src, aliasImport, "redirect.ts no longer imports HOME the way this test stubs it");
  src = src.replace(aliasImport, `const HOME = ${JSON.stringify(HOME)};`);
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  const mod = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
  return mod.safeRedirect;
}

const safeRedirect = await loadSafeRedirect();

/** Where a browser on web would actually go if it followed this value. */
const landsOn = (value) => new URL(value, `${WEB}/sign-in`).origin;

describe("safeRedirect refuses every way off-site", () => {
  const bypasses = {
    "tab after the slash": "/\t/evil.com",
    "newline after the slash": "/\n/evil.com",
    "carriage return after the slash": "/\r/evil.com",
    "backslash": "/\\evil.com",
    "backslash twice": "/\\\\evil.com",
    "protocol-relative": "//evil.com",
    "javascript: url": "javascript:alert(1)",
    "data: url": "data:text/html,<script>alert(1)</script>",
    "suffix trick on an absolute url": "https://injishi.rw.evil.com/",
  };

  for (const [name, raw] of Object.entries(bypasses)) {
    test(name, () => {
      const out = safeRedirect(raw);
      // The control: prove the RAW value really does escape, so a pass below
      // means the function stopped it rather than that the case was harmless.
      if (raw.startsWith("/")) {
        assert.notEqual(landsOn(raw), WEB, `control failed: ${JSON.stringify(raw)} does not escape on its own`);
      }
      assert.equal(landsOn(out), WEB, `${JSON.stringify(raw)} -> ${JSON.stringify(out)} leaves the site`);
    });
  }
});

describe("safeRedirect still lets the real destinations through", () => {
  test("a same-origin path with a query", () => {
    assert.equal(safeRedirect("/book?id=1"), "/book?id=1");
  });
  test("a same-origin path with a hash", () => {
    assert.equal(safeRedirect("/w/abc/today#arrivals"), "/w/abc/today#arrivals");
  });
  test("the operator app, by exact origin", () => {
    assert.equal(safeRedirect("http://localhost:3002/host/today"), "http://localhost:3002/host/today");
  });
  test("the old admin console's origin is no longer trusted (apps/admin is gone; /admin is in the app)", () => {
    assert.equal(safeRedirect("http://localhost:3001/overview"), HOME);
  });
  test("nothing at all falls back to HOME", () => {
    assert.equal(safeRedirect(undefined), HOME);
    assert.equal(safeRedirect(""), HOME);
  });
});
