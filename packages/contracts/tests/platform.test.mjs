/**
 * `GET /api/v1/platform`, and the one field on it that is about the DEPLOY
 * rather than about the platform: the commit the process was built from.
 *
 * The rule worth pinning is the tolerant one. Every client reads this payload
 * with `safeParse` and falls back to null on a failure, so a REQUIRED `commit`
 * would mean a frontend deployed one minute ahead of the API loses the whole
 * platform answer — the demo pill, the persona picker, the fixed-code notice —
 * over a field it does not use. An older API sends no key; that must parse.
 *
 * It tests the BUILT module (`dist/`), like every other test in this folder.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PlatformInfo } = require("../dist/index.js");

const base = {
  environment: "demo",
  sampleData: true,
  seededAt: "2026-09-16T09:12:12.426Z",
};

describe("PlatformInfo", () => {
  test("carries the commit a deployed process was built from", () => {
    const parsed = PlatformInfo.parse({ ...base, commit: "edf31ae" });
    assert.equal(parsed.commit, "edf31ae");
  });

  test("accepts null from a process started without one", () => {
    assert.equal(PlatformInfo.parse({ ...base, commit: null }).commit, null);
  });

  test("accepts a payload from an API older than the field", () => {
    const parsed = PlatformInfo.parse(base);
    assert.equal(parsed.environment, "demo");
    assert.equal(parsed.commit ?? null, null);
  });

  test("refuses a commit that is not a string", () => {
    assert.equal(PlatformInfo.safeParse({ ...base, commit: 12345 }).success, false);
  });

  test("still refuses a payload missing what it always carried", () => {
    const { environment: _dropped, ...without } = base;
    assert.equal(PlatformInfo.safeParse(without).success, false);
  });
});
