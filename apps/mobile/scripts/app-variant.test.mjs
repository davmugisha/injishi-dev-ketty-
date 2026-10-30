// The build variant gate (mobile spec 0002, D-x, AC-17). Run with `pnpm --filter @injishi/mobile test`.
// Node strips the types from src/lib/app-variant.ts itself (Node 22.18 and later).

import assert from "node:assert/strict";
import { test } from "node:test";
import { appVariantFrom, designSystemAllowed } from "../src/lib/app-variant.ts";

test("AC-17: extra.appVariant unset counts as production, and the preview stays shut", () => {
  for (const extra of [undefined, null, {}, { eas: { projectId: "x" } }]) {
    assert.equal(appVariantFrom(extra), "production");
    assert.equal(designSystemAllowed(appVariantFrom(extra)), false);
  }
});

test("AC-17: an unknown variant counts as production", () => {
  for (const appVariant of ["staging", "Development", "", 1, true]) {
    assert.equal(appVariantFrom({ appVariant }), "production");
  }
});

test("AC-17: development and preview builds open the design system preview; production does not", () => {
  assert.equal(designSystemAllowed(appVariantFrom({ appVariant: "development" })), true);
  assert.equal(designSystemAllowed(appVariantFrom({ appVariant: "preview" })), true);
  assert.equal(designSystemAllowed(appVariantFrom({ appVariant: "production" })), false);
});
