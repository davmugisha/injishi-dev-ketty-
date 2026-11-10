/**
 * Web takes access from the server, never from a demo persona (ADR-076 G15).
 *
 * `lib/access.ts` sends a signed-in person where `/me/workspaces`, `/me/oversight` and `/me/staff` say they
 * belong. The demo personas live in `@injishi/data`, which web does not depend on; this keeps it so, by
 * failing on the first production file that imports it.
 *
 *   node --test tests/no-persona-access.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const web = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function sources(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sources(path));
    else if (/\.(ts|tsx|mjs|js)$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(path);
  }
  return out;
}

test("no production file in web reads the demo personas", () => {
  const offenders = sources(join(web, "src")).filter((file) =>
    /from\s+["']@injishi\/data(?:\/[^"']*)?["']/.test(readFileSync(file, "utf8")),
  );
  assert.deepEqual(offenders.map((file) => relative(web, file)), []);
});

test("web's own access comes from the server's answers", () => {
  const access = readFileSync(join(web, "src", "lib", "access.ts"), "utf8");
  for (const path of ["/api/v1/me/workspaces", "/api/v1/me/oversight", "/api/v1/me/staff"]) {
    assert.ok(access.includes(path), `lib/access.ts asks ${path}`);
  }
});
