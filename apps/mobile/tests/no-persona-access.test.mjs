/**
 * The phone takes access from the server, and a demo persona only on the demo (ADR-076 G15).
 *
 * Which phone app a person gets is decided in `src/lib/auth.ts` from `/me/workspaces` (a housekeeper, by
 * the role their grant names, gets the housekeeping app). A demo persona's email is matched only when
 * `GET /api/v1/platform` says the API is the demo; outside it, that email is a person with grants of
 * their own. This fails on any native file that matches a persona without that gate.
 *
 * `*.web.ts` and `*.web.tsx` are exempt, and on purpose: they are the Expo web preview build, which signs
 * in against the local fixtures because it talks to no API at all (`src/lib/auth.ts` header).
 *
 * Mobile has no `test` script on main yet, so run it by hand:
 *   node --test apps/mobile/tests/*.test.mjs
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const mobile = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function nativeSources(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...nativeSources(path));
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.web\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

test("a native file matches a demo persona by email only behind the demo gate", () => {
  const ungated = [];
  for (const file of nativeSources(join(mobile, "src"))) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/personaByEmail\(/g)) {
      const before = text.slice(Math.max(0, match.index - 40), match.index);
      if (!/demo\s*\?\s*$/.test(before)) ungated.push(`${relative(mobile, file)} at ${match.index}`);
    }
  }
  assert.deepEqual(ungated, []);
});

test("the phone app is chosen from the server's grants, and from the demo flag the API reports", () => {
  const auth = readFileSync(join(mobile, "src", "lib", "auth.ts"), "utf8");
  assert.ok(auth.includes("/api/v1/me/workspaces"), "the workspaces are asked of the API");
  assert.ok(auth.includes("/api/v1/platform"), "whether this is the demo is asked of the API");
  assert.ok(
    /phonePersonaFor\([^)]*options\?\.demo === true\)/.test(auth),
    "the shell is chosen with the API's demo flag",
  );
});
