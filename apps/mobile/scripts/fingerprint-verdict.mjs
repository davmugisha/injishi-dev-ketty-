#!/usr/bin/env node
/**
 * The verdict check:ci ends with (mobile spec 0001, D-w, AC-12): does this branch change the app's
 * native side, so a new build is needed before an update can reach phones, or only its JavaScript?
 *
 * A heuristic over changed paths. It computes the fingerprint once, at HEAD, with the production
 * variant, and matches the paths changed since the merge base with origin/main against the
 * fingerprint's file and folder sources, plus the files that feed it without being one (the config it
 * reads, and what decides the installed packages). A second fingerprint at the merge base would need
 * a second install. The publish script's build check is the real guard, so this never fails the run:
 * it always exits 0.
 */

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const ALWAYS_NATIVE = [
  "apps/mobile/package.json",
  "apps/mobile/app.config.ts",
  "apps/mobile/fingerprint.config.js",
  "apps/mobile/.gitignore",
  "pnpm-lock.yaml",
  // D-aa's store folder names, and the workspace's `overrides`.
  "pnpm-workspace.yaml",
];

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${(result.stderr || "").trim()}`);
  return result.stdout.trim();
}

const lines = (text) => text.split("\n").filter(Boolean);
const toPosix = (p) => p.split(path.sep).join("/");

async function verdict() {
  const repoRoot = git(APP_DIR, "rev-parse", "--show-toplevel");
  let base;
  try {
    base = git(repoRoot, "merge-base", "origin/main", "HEAD");
  } catch {
    return "no verdict: origin/main is not here to compare with (CI checks out with fetch-depth: 0).";
  }

  // Committed since the merge base, uncommitted, and untracked: a local run judges what you have.
  const changed = [
    ...new Set([
      ...lines(git(repoRoot, "diff", "--name-only", "--no-renames", base)),
      ...lines(git(repoRoot, "ls-files", "--others", "--exclude-standard")),
    ]),
  ];
  if (changed.length === 0) return "nothing changed since origin/main.";

  process.env.APP_VARIANT = "production";
  const { createFingerprintAsync } = createRequire(import.meta.url)("@expo/fingerprint");
  const { sources } = await createFingerprintAsync(APP_DIR);
  const native = sources
    .filter((source) => source.type === "file" || source.type === "dir")
    .map((source) => ({
      type: source.type,
      path: toPosix(path.relative(repoRoot, path.resolve(APP_DIR, source.filePath))),
    }))
    .filter((source) => !source.path.startsWith(".."));

  const matches = changed.filter(
    (file) =>
      ALWAYS_NATIVE.includes(file) ||
      native.some((source) => file === source.path || (source.type === "dir" && file.startsWith(`${source.path}/`))),
  );
  if (matches.length === 0) {
    return `JavaScript only, can ship over the air (${changed.length} changed paths, none native).`;
  }
  return `native changed, a new build is needed before an update can reach phones:\n${matches
    .map((file) => `  ${file}`)
    .join("\n")}`;
}

try {
  console.log(`fingerprint verdict: ${await verdict()}`);
} catch (error) {
  console.log(`fingerprint verdict: none, it could not be worked out (${error.message}).`);
}
