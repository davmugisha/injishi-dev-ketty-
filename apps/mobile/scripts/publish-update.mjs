#!/usr/bin/env node
/**
 * The one way an over the air update goes out (mobile spec 0001, D-q, AC-10, AC-11).
 *
 *   pnpm --filter @injishi/mobile update:publish -- --to preview
 *   pnpm --filter @injishi/mobile update:publish -- --to production
 *
 * Preview first, then production from the same merged commit. In order, it:
 *
 *   1. refuses a dirty tree (`git status --porcelain`, untracked files included), so every update
 *      maps to one commit;
 *   2. for production, fetches origin and refuses unless HEAD is merged into origin/main and an
 *      update for this exact commit is already on branch `preview`;
 *   3. drops EXPO_PUBLIC_API_URL and APP_VARIANT from its own environment and refuses if an
 *      apps/mobile/.env* file sets either, so the bundle takes the target environment's values from
 *      EAS and nothing else (a preview bundle never goes to production);
 *   4. builds the compiled workspace packages the app depends on;
 *   5. resolves, per platform, the runtime version this update would get under the target
 *      environment, and keeps only the platforms where a finished build on the target channel has
 *      it. No update goes out that no installed build can take; none left means it refuses;
 *   6. notes the update group live on the target branch for that runtime version;
 *   7. publishes with `eas update --channel <to> --environment <to>`;
 *   8. prints the command that takes the branch back to the noted group.
 *
 * It exits non-zero on any refusal and changes nothing before step 7.
 */

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const TARGETS = ["preview", "production"];
const PLATFORMS = ["android", "ios"];
// The values an EAS environment owns. A local copy would end up in the bundle instead.
const ENV_OWNED = ["EXPO_PUBLIC_API_URL", "APP_VARIANT"];
const WINDOWS = process.platform === "win32";

class Refusal extends Error {}

function refuse(message) {
  throw new Refusal(message);
}

/**
 * Runs a command in the app's folder. Through a shell on Windows, where eas and pnpm are .cmd files;
 * every argument this script passes is a plain token or a double quoted string with no quote inside.
 */
function run(command, args, { capture = false, allowFailure = false } = {}) {
  const quoted = args.map((a) => (/[\s"^&|<>()]/.test(a) ? `"${a}"` : a));
  const result = spawnSync(WINDOWS ? [command, ...quoted].join(" ") : command, WINDOWS ? [] : args, {
    cwd: APP_DIR,
    shell: WINDOWS,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    const detail = capture ? `\n${(result.stderr || result.stdout || "").trim()}` : "";
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}.${detail}`);
  }
  return { ok: result.status === 0, stdout: (result.stdout ?? "").trim() };
}

const git = (...args) => run("git", args, { capture: true }).stdout;

/**
 * An eas command's --json output. `--non-interactive` goes on unless a command rejects it, as
 * `update:view` does (eas-cli 26); that one never prompts anyway.
 */
function easJson(args, { nonInteractive = true } = {}) {
  const flags = nonInteractive ? ["--json", "--non-interactive"] : ["--json"];
  const { stdout } = run("eas", [...args, ...flags], { capture: true });
  // Only the JSON document goes to stdout with --json; anything before it is a stray line.
  const start = stdout.search(/^[[{]/m);
  if (start < 0) throw new Error(`eas ${args.join(" ")} printed no JSON.`);
  return JSON.parse(stdout.slice(start));
}

function parseTarget(argv) {
  const at = argv.indexOf("--to");
  const to = at >= 0 ? argv[at + 1] : argv.find((a) => a.startsWith("--to="))?.slice(5);
  if (!TARGETS.includes(to)) {
    refuse(`say where the update goes: --to preview or --to production (got ${to ?? "nothing"}).`);
  }
  return to;
}

/** Update groups on a branch, newest first. An unknown branch has none. */
function groupsOn(branch, { platform, runtimeVersion, limit = 50 } = {}) {
  const args = ["update:list", "--branch", branch, "--limit", String(limit)];
  if (platform) args.push("--platform", platform);
  if (runtimeVersion) args.push("--runtime-version", runtimeVersion);
  try {
    return easJson(args).currentPage ?? [];
  } catch (error) {
    if (/not.*found|does not exist|could not find/i.test(String(error.message))) return [];
    throw error;
  }
}

/** True when branch `preview` holds an update built from this exact commit. */
function previewHasCommit(head, short) {
  // The listing carries no commit hash, so match the message first (it starts with the short hash),
  // then confirm on each candidate's own updates.
  const candidates = groupsOn("preview").filter((g) => String(g.message).includes(short));
  return candidates.some((g) => {
    const updates = easJson(["update:view", g.group], { nonInteractive: false });
    return (Array.isArray(updates) ? updates : [updates]).some((u) => u.gitCommitHash === head);
  });
}

/** The runtime version an update for this platform gets with the target environment's values. */
function runtimeVersionUnder(environment, platform) {
  const resolve = `node node_modules/expo-updates/bin/cli.js runtimeversion:resolve --platform ${platform}`;
  const { stdout } = run("eas", ["env:exec", environment, resolve, "--non-interactive"], { capture: true });
  const line = stdout.split("\n").find((l) => l.trim().startsWith('{"runtimeVersion"'));
  const runtimeVersion = line && JSON.parse(line).runtimeVersion;
  if (!runtimeVersion) throw new Error(`Could not resolve the ${platform} runtime version under ${environment}.`);
  return runtimeVersion;
}

function hasFinishedBuild(channel, platform, runtimeVersion) {
  const builds = easJson([
    "build:list",
    "--platform",
    platform,
    "--channel",
    channel,
    "--status",
    "finished",
    "--runtime-version",
    runtimeVersion,
    "--limit",
    "1",
  ]);
  return builds.length > 0;
}

/** Keeps only characters that read the same in every shell; the message is for people, not machines. */
function safeMessage(text) {
  return text
    .replace(/[^\w .,:/#()+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function rollbackCommand(to, platform, runtimeVersion, live) {
  if (live && !live.isRollBackToEmbedded) {
    return `eas update:republish --group ${live.group} --platform ${platform} --message "Roll back to ${live.group}" --non-interactive`;
  }
  return (
    `eas update:roll-back-to-embedded --branch ${to} --runtime-version ${runtimeVersion} ` +
    `--platform ${platform} --message "Roll back to the build's own code" --non-interactive`
  );
}

function main() {
  const to = parseTarget(process.argv.slice(2));
  console.log(`update:publish → ${to}\n`);

  // 1. One commit, nothing else.
  const dirty = git("status", "--porcelain", "--untracked-files=all");
  if (dirty) refuse(`the working tree is not clean. Commit or remove these first:\n${dirty}`);
  const head = git("rev-parse", "HEAD");
  const short = git("rev-parse", "--short", "HEAD");
  const subject = git("log", "-1", "--format=%s");
  console.log(`commit ${short} ${subject}`);

  // 2. Production takes only a merged commit that already ran on preview.
  if (to === "production") {
    run("git", ["fetch", "origin", "--quiet"]);
    const merged = run("git", ["merge-base", "--is-ancestor", "HEAD", "origin/main"], {
      capture: true,
      allowFailure: true,
    }).ok;
    if (!merged) refuse(`${short} is not merged into origin/main. Production gets only merged commits.`);
    if (!previewHasCommit(head, short)) {
      refuse(`no update for ${short} is on branch preview. Publish it with --to preview first and try it there.`);
    }
    console.log("merged into origin/main, and already on preview");
  }

  // 3. The target environment's values, and only those.
  for (const name of ENV_OWNED) delete process.env[name];
  for (const file of readdirSync(APP_DIR).filter((f) => f.startsWith(".env"))) {
    const text = readFileSync(join(APP_DIR, file), "utf8");
    const found = ENV_OWNED.filter((name) => new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=`, "m").test(text));
    if (found.length > 0) {
      refuse(`apps/mobile/${file} sets ${found.join(" and ")}, which would override the ${to} environment.`);
    }
  }

  // 4. The compiled packages the bundle imports.
  console.log("\nbuilding the workspace packages the app depends on");
  run("pnpm", ["--filter", "@injishi/mobile^...", "run", "--if-present", "build"]);

  // 5. Only platforms with a build that can take it.
  const ready = [];
  for (const platform of PLATFORMS) {
    const runtimeVersion = runtimeVersionUnder(to, platform);
    if (hasFinishedBuild(to, platform, runtimeVersion)) {
      ready.push({ platform, runtimeVersion });
      console.log(`${platform}: runtime ${runtimeVersion}, a finished ${to} build has it`);
    } else {
      console.log(`${platform}: runtime ${runtimeVersion}, no finished ${to} build has it, so ${platform} is skipped`);
    }
  }
  if (ready.length === 0) {
    refuse(`no finished ${to} build can take this update. A native change needs a new build first.`);
  }

  // 6. What to go back to.
  for (const target of ready) {
    [target.live] = groupsOn(to, { platform: target.platform, runtimeVersion: target.runtimeVersion, limit: 1 });
    console.log(
      `${target.platform}: live before publishing: ${target.live ? target.live.group : "the build's own code"}`,
    );
  }

  // 7. Publish.
  const platform = ready.length === PLATFORMS.length ? "all" : ready[0].platform;
  console.log(`\npublishing to ${to} (${platform})\n`);
  const published = easJson([
    "update",
    "--channel",
    to,
    "--environment",
    to,
    "--platform",
    platform,
    "--message",
    safeMessage(`${short} ${subject}`),
  ]);
  const groups = [...new Set((Array.isArray(published) ? published : [published]).map((u) => u.group))];
  console.log(`published update group ${groups.join(", ")} to ${to}.`);

  // 8. The way back.
  console.log("\nTo roll back, run this from apps/mobile (phones go back after their next two cold starts):");
  for (const target of ready)
    console.log(`  ${rollbackCommand(to, target.platform, target.runtimeVersion, target.live)}`);
}

try {
  main();
} catch (error) {
  if (error instanceof Refusal) {
    console.error(`\nupdate:publish refused: ${error.message}`);
  } else {
    console.error(`\nupdate:publish failed: ${error.message}`);
  }
  process.exitCode = 1;
}
