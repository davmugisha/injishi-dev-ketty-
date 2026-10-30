#!/usr/bin/env node
/**
 * What "mobile is green" means, on CI and on your machine alike (mobile spec 0001, D-t, AC-12).
 *
 *   pnpm --filter @injishi/mobile check:ci
 *
 * CI's `mobile` job and mobile-release.yml run this and no other mobile step, so the two lists can
 * never drift. Each step prints a heading and the first failure stops the run; a failed job is read
 * from those headings. It needs no Expo sign in and no network beyond the install.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const WINDOWS = process.platform === "win32";

class StepFailed extends Error {}

function fail(message) {
  throw new StepFailed(message);
}

/**
 * Runs a command in the app's folder with its output shown. Through a shell on Windows, where pnpm is
 * a .cmd file; every argument here is a plain token, quoted when it holds a character cmd would read.
 */
function run(command, args, env = {}) {
  const quoted = args.map((a) => (/[\s"^&|<>()]/.test(a) ? `"${a}"` : a));
  const result = spawnSync(WINDOWS ? [command, ...quoted].join(" ") : command, WINDOWS ? [] : args, {
    cwd: APP_DIR,
    shell: WINDOWS,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) fail(`${command} ${args.join(" ")} exited with code ${result.status}.`);
}

function git(...args) {
  const result = spawnSync("git", args, { cwd: APP_DIR, encoding: "utf8" });
  if (result.status !== 0) fail(`git ${args.join(" ")}: ${(result.stderr || "").trim()}`);
  return result.stdout.trim();
}

/** The app's static routes, as Expo Router names them: `src/app/staff/index.tsx` is `/staff`. */
function routesInApp(dir = path.join(APP_DIR, "src", "app"), prefix = []) {
  const routes = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith("_") || entry.name.startsWith("+")) continue;
    if (entry.isDirectory()) {
      const segment = /^\(.*\)$/.test(entry.name) ? [] : [entry.name];
      routes.push(...routesInApp(path.join(dir, entry.name), [...prefix, ...segment]));
      continue;
    }
    const name = entry.name.replace(/(\.(web|native|ios|android))?\.(tsx|ts|jsx|js)$/, "");
    if (name === entry.name || name.includes("[")) continue;
    routes.push(`/${[...prefix, ...(name === "index" ? [] : [name])].join("/")}`);
  }
  return routes;
}

function typedRoutes() {
  // Generated fresh, so a declaration file a dev server wrote earlier can never stand in for it.
  rmSync(path.join(APP_DIR, ".expo", "types"), { recursive: true, force: true });
  // Writes .expo/types/router.d.ts and leaves an existing tsconfig.json as it is.
  run("pnpm", ["exec", "expo", "customize", "tsconfig.json"]);
  const file = path.join(APP_DIR, ".expo", "types", "router.d.ts");
  if (!existsSync(file)) fail("expo customize wrote no .expo/types/router.d.ts.");
  const declarations = readFileSync(file, "utf8");
  const routes = routesInApp().filter((route) => route !== "/");
  const found = routes.filter((route) => declarations.includes(`\`${route}\``));
  if (found.length === 0) {
    fail(`.expo/types/router.d.ts names none of the routes in src/app (${routes.join(", ")}).`);
  }
  console.log(`typed routes: ${found.length} of the ${routes.length} routes in src/app are declared.`);
}

function exportBundles() {
  // dist/ is ignored by git and by EAS (`apps/*/dist/`).
  rmSync(path.join(APP_DIR, "dist"), { recursive: true, force: true });
  run("pnpm", ["exec", "expo", "export", "--platform", "android", "--platform", "ios", "--output-dir", "dist"], {
    EXPO_OFFLINE: "1",
  });
}

function nativeFoldersUncommitted() {
  // fingerprint.config.js ignores both because they are generated; committed, they would be hashed
  // on this PC and not on EAS's builders, and every publish would be refused.
  const committed = git("ls-files", "--", "android", "ios");
  if (committed) {
    fail(
      `android/ or ios/ is committed, which fingerprint.config.js assumes never happens:\n${committed}\n` +
        "Remove them from git, or first change D-ab (their ignorePaths entries) in mobile spec 0001.",
    );
  }
  console.log("android/ and ios/ are not committed.");
}

function fingerprintConfig() {
  // @expo/fingerprint falls back to its defaults when this file throws, so a broken file would
  // silently change every runtime version.
  let config;
  try {
    config = createRequire(import.meta.url)(path.join(APP_DIR, "fingerprint.config.js"));
  } catch (error) {
    fail(`fingerprint.config.js does not load: ${error.message}`);
  }
  const same = (actual, expected) => JSON.stringify([...(actual ?? [])].sort()) === JSON.stringify(expected);
  const problems = [];
  if (!same(config.sourceSkips, ["ExpoConfigVersions", "PackageJsonScriptsAll"])) {
    problems.push(`sourceSkips is ${JSON.stringify(config.sourceSkips)}`);
  }
  if (!same(config.ignorePaths, ["android/**/*", "ios/**/*"])) {
    problems.push(`ignorePaths is ${JSON.stringify(config.ignorePaths)}`);
  }
  const buildScripts = config.extraSources?.find((source) => source.id === "packageJson:buildScripts");
  if (buildScripts?.type !== "contents" || typeof buildScripts.contents !== "string") {
    problems.push("the packageJson:buildScripts extra source is missing");
  }
  if (problems.length > 0) {
    fail(
      `fingerprint.config.js does not hold D-ab's values: ${problems.join("; ")}.\n` +
        "A new skip or ignore needs AC-9's cross machine test again; then update this check.",
    );
  }
  console.log(`fingerprint.config.js loads; build machine scripts hashed: ${buildScripts.contents}`);
}

const STEPS = [
  [
    "build the workspace packages the app depends on",
    () => run("pnpm", ["--filter", "@injishi/mobile^...", "run", "--if-present", "build"]),
  ],
  ["generate the typed route declarations", typedRoutes],
  ["palette:check", () => run("pnpm", ["run", "palette:check"])],
  ["icons:check", () => run("pnpm", ["run", "icons:check"])],
  ["typecheck", () => run("pnpm", ["run", "typecheck"])],
  ["lint", () => run("pnpm", ["run", "lint"])],
  ["test", () => run("pnpm", ["run", "test"])],
  ["bundle Android and iOS", exportBundles],
  ["android/ and ios/ are generated, not committed", nativeFoldersUncommitted],
  ["fingerprint.config.js loads with D-ab's values", fingerprintConfig],
  // Never fails: it prints a verdict and exits 0.
  ["fingerprint verdict", () => run("node", ["scripts/fingerprint-verdict.mjs"])],
];

let current = 0;
try {
  for (const [index, [title, step]] of STEPS.entries()) {
    current = index;
    console.log(`\n── check:ci ${index + 1}/${STEPS.length}: ${title}`);
    const started = Date.now();
    step();
    console.log(`   done in ${Math.round((Date.now() - started) / 1000)}s`);
  }
  console.log("\ncheck:ci: all steps passed.");
} catch (error) {
  const reason = error instanceof StepFailed ? error.message : String(error?.stack ?? error);
  console.error(`\ncheck:ci failed at step ${current + 1}/${STEPS.length} (${STEPS[current][0]}):\n${reason}`);
  process.exitCode = 1;
}
