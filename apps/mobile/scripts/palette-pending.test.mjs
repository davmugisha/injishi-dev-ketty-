// Holds the palette:check placeholder (mobile spec 0001, D-u, AC-14) until feature 3 replaces it with
// the real comparison. Run with `pnpm --filter @injishi/mobile test`.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "palette-pending.mjs");

test("AC-14: palette:check passes and says the real comparison arrives with feature 3", () => {
  const { status, stdout } = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
  assert.equal(status, 0);
  assert.match(stdout, /arrives with feature 3/);
});
