#!/usr/bin/env node
/**
 * The one way an over the air update goes out (mobile spec 0001, D-q, D-ad, AC-10, AC-11).
 *
 *   pnpm --filter @injishi/mobile update:publish -- --to preview [--dry-run]
 *   pnpm --filter @injishi/mobile update:publish -- --to production [--dry-run]
 *
 * Preview first, then production from the same merged commit. In order, it:
 *
 *    1. refuses a dirty tree (`git status --porcelain`, untracked files included), so every update
 *       maps to one commit;
 *    2. for production, fetches origin, refuses unless HEAD is merged into origin/main, and reminds
 *       you that the API this commit calls must already be deployed (nothing checks it);
 *    3. drops APP_VARIANT and every EXPO_PUBLIC_ variable from its own environment and refuses if an
 *       apps/mobile/.env* file sets one, so the bundle takes the target environment's values from EAS
 *       and nothing else (a preview bundle never goes to production);
 *    4. installs with the commit's lockfile (`pnpm install --frozen-lockfile`), so the bundle and the
 *       runtime version come from what the commit names;
 *    5. refuses unless the target channel serves the branch of the same name, and only that. After
 *       the install, because every eas call reads app.config.ts and resolves its config plugins
 *       from the installed packages;
 *    6. builds the compiled workspace packages the app depends on;
 *    7. judges each platform on its own (publish-platforms.mjs): a finished build on the target
 *       channel has the runtime version this update would get there, and, for production, the newest
 *       update on branch `preview` for that platform was built from this commit. It prints every
 *       failing reason and refuses if no platform is left;
 *    8. notes, per platform it keeps, the update group live on the target branch for that runtime
 *       version, and prints the command that takes the branch back to it. `--dry-run` stops here;
 *    9. publishes once, with `eas update --channel <to> --environment <to> --clear-cache`;
 *   10. fails loudly if a published update's platform or runtime version is not the one it resolved;
 *   11. prints the rollback commands again and the platforms it skipped, and exits 0.
 *
 * It exits non-zero on any refusal and changes nothing on EAS before step 9.
 */

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { judgePlatforms, PLATFORMS } from "./publish-platforms.mjs";

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const TARGETS = ["preview", "production"];
// The values an EAS environment owns. A local copy would end up in the bundle instead.
const ENV_OWNED = /^(APP_VARIANT|EXPO_PUBLIC_\w*)$/;
const ENV_OWNED_LINE = /^\s*(?:export\s+)?(APP_VARIANT|EXPO_PUBLIC_\w*)\s*=/gm;
const WINDOWS = process.platform === "win32";

class Refusal extends Error {}

function refuse(message) {
  throw new Refusal(message);
}

/**
 * Runs a command, in the app's folder unless told otherwise. Through a shell on Windows, where eas
 * and pnpm are .cmd files; every argument this script passes is a plain token or a double quoted
 * string with no quote inside.
 */
function run(command, args, { capture = false, allowFailure = false, cwd = APP_DIR } = {}) {
  const quoted = args.map((a) => (/[\s"^&|<>()]/.test(a) ? `"${a}"` : a));
  const result = spawnSync(WINDOWS ? [command, ...quoted].join(" ") : command, WINDOWS ? [] : args, {
    cwd,
    shell: WINDOWS,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    // eas prints the cause on stdout and only "command failed" on stderr, so both are kept.
    const output = [result.stdout, result.stderr].map((s) => (s ?? "").trim()).filter(Boolean);
    const detail = capture ? `\n${output.join("\n")}` : "";
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

const asList = (value) => (Array.isArray(value) ? value : [value]);

function parseArgs(argv) {
  const at = argv.indexOf("--to");
  const to = at >= 0 ? argv[at + 1] : argv.find((a) => a.startsWith("--to="))?.slice(5);
  if (!TARGETS.includes(to)) {
    refuse(`say where the update goes: --to preview or --to production (got ${to ?? "nothing"}).`);
  }
  return { to, dryRun: argv.includes("--dry-run") };
}

/** Update groups on a branch, newest first. An unknown branch has none. */
function groupsOn(branch, { platform, runtimeVersion, limit }) {
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

/** Step 3: the channel serves the branch of the same name, and nothing else (no rollout). */
function checkChannel(to) {
  const channel = easJson(["channel:view", to]).currentPage;
  const branches = (channel?.updateBranches ?? []).map((b) => b.name);
  let mapping = [];
  try {
    mapping = JSON.parse(channel?.branchMapping ?? "{}").data ?? [];
  } catch {
    // An unreadable mapping fails the check below.
  }
  const servesOnly = branches.length === 1 && branches[0] === to && mapping.length === 1;
  if (!servesOnly || mapping[0].branchMappingLogic !== "true") {
    refuse(
      `channel ${to} must serve branch ${to} alone, and it serves ${branches.join(" and ") || "no branch"}` +
        `${mapping.length > 1 ? " (a rollout is in progress)" : ""}. ` +
        `Point it back with: eas channel:edit ${to} --branch ${to}`,
    );
  }
}

/** Step 4: the target environment's values, and only those. */
function dropLocalValues(to) {
  for (const name of Object.keys(process.env)) if (ENV_OWNED.test(name)) delete process.env[name];
  for (const file of readdirSync(APP_DIR).filter((f) => f.startsWith(".env"))) {
    const found = [...readFileSync(join(APP_DIR, file), "utf8").matchAll(ENV_OWNED_LINE)].map((m) => m[1]);
    if (found.length > 0) {
      refuse(`apps/mobile/${file} sets ${[...new Set(found)].join(", ")}, which would override the ${to} environment.`);
    }
  }
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

/**
 * The newest update on branch preview for this platform, with the commit it was built from. Only the
 * newest counts, so no paging. A rollback carries no commit; the listing carries none at all, so the
 * group is read with `update:view`, which rejects --non-interactive.
 */
function newestOnPreview(platform) {
  const [newest] = groupsOn("preview", { platform, limit: 1 });
  if (!newest) return null;
  if (newest.isRollBackToEmbedded) return { group: newest.group, isRollBackToEmbedded: true };
  const update = asList(easJson(["update:view", newest.group], { nonInteractive: false })).find(
    (u) => u.platform === platform,
  );
  return { group: newest.group, gitCommitHash: update?.gitCommitHash, isRollBackToEmbedded: false };
}

/** Keeps only characters that read the same in every shell; the message is for people, not machines. */
function safeMessage(text) {
  return text
    .replace(/[^\w .,:/#()+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/** A live rollback to the build's own code counts as nothing live. */
function rollbackCommand(to, { platform, runtimeVersion, live }) {
  if (live && !live.isRollBackToEmbedded) {
    return `eas update:republish --group ${live.group} --platform ${platform} --message "Roll back to ${live.group}" --non-interactive`;
  }
  return (
    `eas update:roll-back-to-embedded --branch ${to} --runtime-version ${runtimeVersion} ` +
    `--platform ${platform} --message "Roll back to the build's own code" --non-interactive`
  );
}

function printRollback(to, kept) {
  console.log(
    `\nTo roll back, run this from apps/mobile. Each command is good until the next publish to ${to} ` +
      "for that runtime version; phones go back after their next two cold starts.",
  );
  for (const target of kept) console.log(`  ${target.platform}: ${rollbackCommand(to, target)}`);
}

function printSkipped(skipped) {
  if (skipped.length === 0) return;
  console.log(`\nSkipped: ${skipped.map((s) => s.platform).join(", ")}. Run again once each reason above is gone.`);
}

/** Step 10: what EAS published is what this script resolved, platform by platform. */
function checkPublished(published, kept) {
  const problems = [];
  for (const update of published) {
    const expected = kept.find((k) => k.platform === update.platform);
    if (!expected) problems.push(`an update went to ${update.platform}, which this script did not keep`);
    else if (update.runtimeVersion !== expected.runtimeVersion) {
      problems.push(
        `the ${update.platform} update has runtime ${update.runtimeVersion}, not the resolved ${expected.runtimeVersion}`,
      );
    }
  }
  for (const { platform } of kept) {
    if (!published.some((u) => u.platform === platform)) problems.push(`no ${platform} update was published`);
  }
  return problems;
}

function main() {
  const { to, dryRun } = parseArgs(process.argv.slice(2));
  console.log(`update:publish → ${to}${dryRun ? " (dry run)" : ""}\n`);

  // 1. One commit, nothing else.
  const dirty = git("status", "--porcelain", "--untracked-files=all");
  if (dirty) refuse(`the working tree is not clean. Commit or remove these first:\n${dirty}`);
  const head = git("rev-parse", "HEAD");
  const short = git("rev-parse", "--short", "HEAD");
  const subject = git("log", "-1", "--format=%s");
  const repoRoot = git("rev-parse", "--show-toplevel");
  console.log(`commit ${short} ${subject}`);

  // 2. Production takes only a merged commit.
  if (to === "production") {
    run("git", ["fetch", "origin", "--quiet"]);
    const merged = run("git", ["merge-base", "--is-ancestor", "HEAD", "origin/main"], {
      capture: true,
      allowFailure: true,
    }).ok;
    if (!merged) refuse(`${short} is not merged into origin/main. Production gets only merged commits.`);
    console.log("merged into origin/main");
    console.log(
      "reminder: the API this commit calls must already be deployed to https://api.injishi.com. Nothing checks it.",
    );
  }

  // 3. The target environment's values, and only those.
  dropLocalValues(to);

  // 4. The commit's packages.
  console.log("\ninstalling with the commit's lockfile");
  run("pnpm", ["install", "--frozen-lockfile"], { cwd: repoRoot });

  // 5. The channel serves its own branch. eas needs the packages above to read the app config.
  checkChannel(to);
  console.log(`\nchannel ${to} serves branch ${to}`);

  // 6. The compiled packages the bundle imports.
  console.log("\nbuilding the workspace packages the app depends on");
  run("pnpm", ["--filter", "@injishi/mobile^...", "run", "--if-present", "build"]);

  // 7. Each platform on its own.
  console.log("");
  const facts = PLATFORMS.map((platform) => {
    const runtimeVersion = runtimeVersionUnder(to, platform);
    return {
      platform,
      runtimeVersion,
      hasBuild: hasFinishedBuild(to, platform, runtimeVersion),
      newestPreview: to === "production" ? newestOnPreview(platform) : undefined,
    };
  });
  const { kept, skipped, publishPlatform } = judgePlatforms({ to, head, platforms: facts });
  for (const target of kept) console.log(`${target.platform}: runtime ${target.runtimeVersion}, ready`);
  for (const { platform, runtimeVersion, reasons } of skipped) {
    console.log(`${platform}: runtime ${runtimeVersion}, skipped:`);
    for (const reason of reasons) console.log(`  - ${reason}`);
  }
  if (!publishPlatform) refuse(`no platform can take this update on ${to}; see the reasons above.`);

  // 8. What to go back to.
  console.log("");
  for (const target of kept) {
    [target.live] = groupsOn(to, { platform: target.platform, runtimeVersion: target.runtimeVersion, limit: 1 });
    const live = target.live && !target.live.isRollBackToEmbedded ? target.live.group : "the build's own code";
    console.log(`${target.platform}: live on ${to} before publishing: ${live}`);
  }
  printRollback(to, kept);
  if (dryRun) {
    console.log(`\ndry run: every check passed. It would publish to ${to} (${publishPlatform}); stopping here.`);
    printSkipped(skipped);
    return;
  }

  // 9. Publish, once.
  console.log(`\npublishing to ${to} (${publishPlatform})\n`);
  const published = asList(
    easJson([
      "update",
      "--channel",
      to,
      "--environment",
      to,
      "--platform",
      publishPlatform,
      "--clear-cache",
      "--message",
      safeMessage(`${short} ${subject}`),
    ]),
  );
  const groups = [...new Set(published.map((u) => u.group))];
  console.log(`published update group ${groups.join(", ")} to ${to}.`);

  // 10. What went out is what was resolved.
  const problems = checkPublished(published, kept);
  if (problems.length > 0) {
    printRollback(to, kept);
    throw new Error(
      `the published update does not match what this script resolved:\n  - ${problems.join("\n  - ")}\n` +
        "Roll back with the commands above, then find out why before publishing again.",
    );
  }

  // 11. The way back, and what was left out.
  printRollback(to, kept);
  printSkipped(skipped);
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
