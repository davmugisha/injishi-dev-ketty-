// Test support for the release scripts' tests (mobile spec 0001): a throwaway git repository holding
// copies of the scripts, and fake `eas` and `pnpm` commands first on PATH that answer from a scenario
// and log every call (fake-cli.mjs). Nothing here reaches the network, EAS, or this checkout.

import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SUPPORT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.join(SUPPORT_DIR, "..", "..");
const FAKE_CLI = path.join(SUPPORT_DIR, "fake-cli.mjs");
const made = [];

/** Copies a file from the real app (path relative to apps/mobile) into the sandbox. */
export const fromApp = (relative) => ({ copy: relative });

/** Values from the calling shell that would change what the scripts do. */
const LEAKY = /^(APP_VARIANT|EXPO_PUBLIC_\w*|EXPO_OFFLINE|FAKE_\w+|GIT_\w+)$/;

/**
 * A git repository in a temp folder, its files written from `files` (repo relative path → text, or
 * `fromApp(...)`) and committed on `main`. The user's git config is left out, so no signing or hook
 * of theirs runs here.
 */
export function makeSandbox(files) {
  const root = mkdtempSync(path.join(tmpdir(), "injishi-sandbox-"));
  const tools = mkdtempSync(path.join(tmpdir(), "injishi-tools-"));
  made.push(root, tools);
  writeFileSync(path.join(tools, "gitconfig"), "");

  const gitEnv = {
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: path.join(tools, "gitconfig"),
    GIT_AUTHOR_NAME: "sandbox",
    GIT_AUTHOR_EMAIL: "sandbox@example.invalid",
    GIT_COMMITTER_NAME: "sandbox",
    GIT_COMMITTER_EMAIL: "sandbox@example.invalid",
  };
  const baseEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !LEAKY.test(key)));
  const pathKey = Object.keys(baseEnv).find((key) => key.toUpperCase() === "PATH") ?? "PATH";
  const env = {
    ...baseEnv,
    ...gitEnv,
    [pathKey]: `${tools}${path.delimiter}${baseEnv[pathKey] ?? ""}`,
    FAKE_LOG: path.join(tools, "calls.jsonl"),
    FAKE_SCENARIO: path.join(tools, "scenario.json"),
  };

  for (const tool of ["eas", "pnpm"]) {
    writeFileSync(path.join(tools, `${tool}.cmd`), `@"${process.execPath}" "${FAKE_CLI}" ${tool} %*\r\n`);
    const posix = path.join(tools, tool);
    writeFileSync(posix, `#!/bin/sh\nexec "${process.execPath}" "${FAKE_CLI}" ${tool} "$@"\n`);
    chmodSync(posix, 0o755);
  }

  const box = {
    root,
    tools,
    /** Writes or replaces a file (repo relative), without committing it. */
    write(relative, content) {
      const file = path.join(root, relative);
      mkdirSync(path.dirname(file), { recursive: true });
      if (typeof content === "object") copyFileSync(path.join(APP_DIR, content.copy), file);
      else writeFileSync(file, content);
    },
    read: (relative) => readFileSync(path.join(root, relative), "utf8"),
    git(...args) {
      const result = spawnSync("git", args, { cwd: root, env, encoding: "utf8" });
      if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
      return result.stdout.trim();
    },
    /** What the fake eas and pnpm answer; see fake-cli.mjs for the keys. */
    scenario(value) {
      writeFileSync(env.FAKE_SCENARIO, JSON.stringify(value));
    },
    /** Runs apps/mobile/scripts/<script> from apps/mobile, as `pnpm --filter @injishi/mobile` would. */
    run(script, args = [], extraEnv = {}) {
      rmSync(env.FAKE_LOG, { force: true });
      const result = spawnSync(process.execPath, [path.join(root, "apps", "mobile", "scripts", script), ...args], {
        cwd: path.join(root, "apps", "mobile"),
        env: { ...env, ...extraEnv },
        encoding: "utf8",
      });
      const calls = existsSync(env.FAKE_LOG)
        ? readFileSync(env.FAKE_LOG, "utf8")
            .split("\n")
            .filter(Boolean)
            .map((line) => JSON.parse(line))
        : [];
      return { status: result.status, output: `${result.stdout}${result.stderr}`, calls };
    },
    /** A bare repository as `origin`, with `main` pushed, so `git fetch origin` works offline. */
    addOrigin() {
      const origin = path.join(tools, "origin.git");
      spawnSync("git", ["init", "-q", "--bare", origin], { env, encoding: "utf8" });
      box.git("remote", "add", "origin", origin);
      box.git("push", "-q", "origin", "main");
      box.git("fetch", "-q", "origin");
    },
  };

  for (const [relative, content] of Object.entries(files)) box.write(relative, content);
  box.git("init", "-q", "-b", "main");
  box.git("add", "-A");
  box.git("commit", "-q", "-m", "sandbox");
  box.scenario({});
  return box;
}

/** Deletes every sandbox this test file made; call it from `after`. */
export function removeSandboxes() {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
}
