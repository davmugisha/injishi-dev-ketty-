// Holds which package.json scripts count as a native change (mobile spec 0001, D-ab, AC-9):
// fingerprint.config.js hashes the scripts that run on the build machine, and only those.
// Run with `pnpm --filter @injishi/mobile test`.

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { after, describe, test } from "node:test";

import { fromApp, makeSandbox, removeSandboxes } from "./test-support/sandbox.mjs";

/** The config loaded against a package.json holding `scripts`. */
function configWith(scripts) {
  const box = makeSandbox({
    "fingerprint.config.js": fromApp("fingerprint.config.js"),
    "package.json": JSON.stringify({ name: "probe", scripts }),
  });
  return createRequire(import.meta.url)(path.join(box.root, "fingerprint.config.js"));
}
const hashedScripts = (config) =>
  JSON.parse(config.extraSources.find((s) => s.id === "packageJson:buildScripts").contents);

describe("fingerprint.config.js", () => {
  after(removeSandboxes);

  test("AC-9: hashes the install hooks and eas-build-* scripts, sorted, and nothing else", () => {
    const config = configWith({
      lint: "biome lint .",
      "eas-build-post-install": "pnpm build",
      test: "node --test",
      postinstall: "node patch.js",
      prepare: "husky",
    });
    assert.deepEqual(Object.entries(hashedScripts(config)), [
      ["eas-build-post-install", "pnpm build"],
      ["postinstall", "node patch.js"],
      ["prepare", "husky"],
    ]);
  });

  test("AC-9: editing a script that never runs on the build machine leaves the hashed source unchanged", () => {
    const before = configWith({ lint: "biome lint .", "eas-build-post-install": "pnpm build" });
    const afterEdit = configWith({
      lint: "biome lint . --max-diagnostics=500",
      "eas-build-post-install": "pnpm build",
    });
    assert.equal(hashedScripts(afterEdit).lint, undefined);
    assert.deepEqual(hashedScripts(afterEdit), hashedScripts(before));
  });

  test("AC-9: skips the whole scripts section, so only the hashed build scripts reach the fingerprint", () => {
    const config = configWith({});
    assert.deepEqual([...config.sourceSkips].sort(), ["ExpoConfigVersions", "PackageJsonScriptsAll"]);
    assert.deepEqual([...config.ignorePaths].sort(), ["android/**/*", "ios/**/*"]);
  });
});
