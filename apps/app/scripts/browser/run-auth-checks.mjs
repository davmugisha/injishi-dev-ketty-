#!/usr/bin/env node
/**
 * Every unit-level check that covers sign-in and sign-out, in one run:
 *   the auth package's tests, the API's auth specs, the app's sign-in unit tests, web's tests, and the
 *   app's and web's typechecks.
 *
 *   node apps/app/scripts/browser/run-auth-checks.mjs
 *
 * Runs them one at a time (several pnpm commands at once race on this workspace) and prints
 * "AUTH CHECKS OK" only when every one exited 0.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

const checks = [
  ["auth package tests", "pnpm --filter @injishi/auth test"],
  ["API auth specs", "pnpm --filter @injishi/api exec vitest run src/modules/auth"],
  ["app sign-in unit tests", "pnpm --filter @injishi/app exec tsx --test tests/*.test.ts"],
  ["web tests", "pnpm --filter @injishi/web test"],
  ["app typecheck", "pnpm --filter @injishi/app typecheck"],
  ["web typecheck", "pnpm --filter @injishi/web typecheck"],
];

const failed = [];
for (const [name, command] of checks) {
  const started = Date.now();
  const run = spawnSync(command, { cwd: ROOT, shell: true, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  if (run.status === 0) {
    console.log(`  ok    ${name} (${seconds}s)`);
  } else {
    failed.push(name);
    console.log(`  FAIL  ${name} (exit ${run.status}, ${seconds}s)`);
    console.log(`${run.stdout ?? ""}${run.stderr ?? ""}`.trim().split("\n").slice(-40).join("\n"));
  }
}
if (failed.length) {
  console.log(`${failed.length} of ${checks.length} failed: ${failed.join(", ")}`);
  process.exit(1);
}
console.log("AUTH CHECKS OK");
