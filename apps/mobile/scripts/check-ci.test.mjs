// Holds what "mobile is green" means (mobile spec 0001, D-t, AC-12, AC-13): check-ci.mjs, run in a
// throwaway repository with a fake pnpm (test-support/fake-cli.mjs), so every step's wiring and every
// guard is checked in seconds. The real commands behind each step are proven by /check verify.
// Run with `pnpm --filter @injishi/mobile test`.

import assert from "node:assert/strict";
import { after, describe, test } from "node:test";

import { fromApp, makeSandbox, removeSandboxes } from "./test-support/sandbox.mjs";

const STEPS = [
  "build the workspace packages the app depends on",
  "generate the typed route declarations",
  "palette:check",
  "typecheck",
  "lint",
  "test",
  "bundle Android and iOS",
  "android/ and ios/ are generated, not committed",
  "fingerprint.config.js loads with D-ab's values",
  "fingerprint verdict",
];

const screen = "export default function Screen() {\n  return null;\n}\n";

// Routes in this app: /staff, /staff/me and /home. `/` and dynamic routes are left out.
const sandbox = (scenario = {}) => {
  const box = makeSandbox({
    "apps/mobile/scripts/check-ci.mjs": fromApp("scripts/check-ci.mjs"),
    "apps/mobile/scripts/fingerprint-verdict.mjs": fromApp("scripts/fingerprint-verdict.mjs"),
    "apps/mobile/fingerprint.config.js": fromApp("fingerprint.config.js"),
    "apps/mobile/package.json": fromApp("package.json"),
    "apps/mobile/src/app/_layout.tsx": screen,
    "apps/mobile/src/app/index.tsx": screen,
    "apps/mobile/src/app/staff/index.tsx": screen,
    "apps/mobile/src/app/staff/me.tsx": screen,
    "apps/mobile/src/app/(tabs)/home.tsx": screen,
    "apps/mobile/src/app/room/[id].tsx": screen,
  });
  box.scenario(scenario);
  return box;
};
const headings = (output) => [...output.matchAll(/── check:ci \d+\/10: (.+)/g)].map((m) => m[1].trim());
const checkCi = (box) => box.run("check-ci.mjs");

describe("check:ci", { concurrency: true }, () => {
  after(removeSandboxes);

  test("AC-12: runs the ten steps in order and ends with every step passed", () => {
    const { status, output } = checkCi(sandbox());
    assert.equal(status, 0, output);
    assert.deepEqual(headings(output), STEPS);
    assert.match(output, /check:ci: all steps passed\./);
  });

  test("AC-12: hands each step to the app's own scripts, in CI's order", () => {
    const { calls } = checkCi(sandbox());
    assert.deepEqual(
      calls.filter((c) => c.tool === "pnpm").map((c) => c.args),
      [
        ["--filter", "@injishi/mobile^...", "run", "--if-present", "build"],
        ["exec", "expo", "customize", "tsconfig.json"],
        ["run", "palette:check"],
        ["run", "typecheck"],
        ["run", "lint"],
        ["run", "test"],
        ["exec", "expo", "export", "--platform", "android", "--platform", "ios", "--output-dir", "dist"],
      ],
    );
  });

  test("AC-12: bundles both platforms with EXPO_OFFLINE set, so the bundle needs no network", () => {
    const { calls } = checkCi(sandbox());
    const bundle = calls.find((c) => c.args[0] === "exec" && c.args[2] === "export");
    assert.equal(bundle.env.EXPO_OFFLINE, "1");
  });

  test("AC-13: reports how many of the app's routes the typed declarations name", () => {
    const { output } = checkCi(sandbox());
    assert.match(output, /typed routes: 2 of the 3 routes in src\/app are declared\./);
  });

  test("AC-12, AC-13: never trusts a declaration file left by a dev server", () => {
    const box = sandbox({ routerTypes: null });
    box.write("apps/mobile/.expo/types/router.d.ts", "type Routes = `/staff`;\n");
    const { status, output } = checkCi(box);
    assert.equal(status, 1);
    assert.match(output, /failed at step 2\/10[\s\S]*wrote no \.expo\/types\/router\.d\.ts/);
  });

  test("AC-13: fails step 2 when the declarations name none of the app's routes", () => {
    const { status, output } = checkCi(sandbox({ routerTypes: "type Routes = `/elsewhere`;\n" }));
    assert.equal(status, 1);
    assert.match(output, /failed at step 2\/10[\s\S]*names none of the routes in src\/app/);
  });

  test("AC-12: stops at the first failing step and runs nothing after it", () => {
    const { status, output, calls } = checkCi(sandbox({ failStep: "typecheck" }));
    assert.equal(status, 1);
    assert.match(output, /failed at step 4\/10 \(typecheck\)/);
    assert.deepEqual(headings(output), STEPS.slice(0, 4));
    assert.ok(!calls.some((c) => c.args.includes("lint")));
  });

  test("AC-12: fails step 8 when a file under apps/mobile/android is committed, and lists it", () => {
    const box = sandbox();
    box.write("apps/mobile/android/x", "");
    box.git("add", "-f", "apps/mobile/android/x");
    box.git("commit", "-q", "-m", "native folder");
    const { status, output } = checkCi(box);
    assert.equal(status, 1);
    assert.match(output, /failed at step 8\/10[\s\S]*android\/x/);
  });

  test("AC-12: fails step 9 when fingerprint.config.js throws on load", () => {
    const box = sandbox();
    box.write("apps/mobile/fingerprint.config.js", `require("./does-not-exist");\n`);
    const { status, output } = checkCi(box);
    assert.equal(status, 1);
    assert.match(output, /failed at step 9\/10[\s\S]*fingerprint\.config\.js does not load/);
  });

  test("AC-9, AC-12: fails step 9 when sourceSkips loses a value, naming it", () => {
    const box = sandbox();
    const config = box.read("apps/mobile/fingerprint.config.js");
    box.write(
      "apps/mobile/fingerprint.config.js",
      config.replace('["ExpoConfigVersions", "PackageJsonScriptsAll"]', '["ExpoConfigVersions"]'),
    );
    const { status, output } = checkCi(box);
    assert.equal(status, 1);
    assert.match(output, /sourceSkips is \["ExpoConfigVersions"\]/);
  });

  test("AC-9, AC-12: fails step 9 when the build machine scripts are no longer hashed", () => {
    const box = sandbox();
    box.write(
      "apps/mobile/fingerprint.config.js",
      'module.exports = { sourceSkips: ["ExpoConfigVersions", "PackageJsonScriptsAll"], ignorePaths: ["android/**/*", "ios/**/*"] };\n',
    );
    const { status, output } = checkCi(box);
    assert.equal(status, 1);
    assert.match(output, /the packageJson:buildScripts extra source is missing/);
  });

  test("AC-12: the fingerprint verdict never fails the run, even with no origin/main to compare", () => {
    const { status, output } = checkCi(sandbox());
    assert.equal(status, 0);
    assert.match(output, /fingerprint verdict: no verdict: origin\/main is not here/);
  });
});
