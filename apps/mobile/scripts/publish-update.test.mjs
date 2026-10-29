// Holds the publish script's platform decision (mobile spec 0001, D-ad, AC-10).
// Run with `pnpm --filter @injishi/mobile test`.

import assert from "node:assert/strict";
import { after, describe, test } from "node:test";

import { judgePlatforms } from "./publish-platforms.mjs";
import { fromApp, makeSandbox, removeSandboxes } from "./test-support/sandbox.mjs";

const HEAD = "4f1c2a9e0b7d3c5a6e8f9a1b2c3d4e5f6a7b8c9d";
const OTHER = "9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c";

const onPreview = (gitCommitHash = HEAD) => ({ group: "group-new", gitCommitHash, isRollBackToEmbedded: false });
const rolledBack = { group: "group-back", isRollBackToEmbedded: true };

function facts(platform, { hasBuild = true, newestPreview = onPreview() } = {}) {
  return { platform, runtimeVersion: `rv-${platform}`, hasBuild, newestPreview };
}

const production = (...platforms) => judgePlatforms({ to: "production", head: HEAD, platforms });

describe("judgePlatforms, to production", () => {
  test("both checks pass on both platforms: publishes to all", () => {
    const result = production(facts("android"), facts("ios"));
    assert.deepEqual(
      result.kept.map((k) => k.platform),
      ["android", "ios"],
    );
    assert.deepEqual(result.skipped, []);
    assert.equal(result.publishPlatform, "all");
  });

  test("only the build check fails: that platform is skipped for that one reason", () => {
    const result = production(facts("android"), facts("ios", { hasBuild: false }));
    assert.equal(result.publishPlatform, "android");
    assert.equal(result.skipped.length, 1);
    assert.equal(result.skipped[0].platform, "ios");
    assert.equal(result.skipped[0].reasons.length, 1);
    assert.match(result.skipped[0].reasons[0], /no finished production build has runtime rv-ios/);
  });

  test("only the preview check fails: that platform is skipped for that one reason", () => {
    const result = production(facts("android", { newestPreview: onPreview(OTHER) }), facts("ios"));
    assert.equal(result.publishPlatform, "ios");
    assert.equal(result.skipped[0].platform, "android");
    assert.equal(result.skipped[0].reasons.length, 1);
    assert.match(result.skipped[0].reasons[0], /built from 9d8c7b6a, not this commit/);
  });

  test("both checks fail: every reason is kept, the build's first", () => {
    const result = production(facts("android", { hasBuild: false, newestPreview: onPreview(OTHER) }), facts("ios"));
    assert.deepEqual(result.skipped[0].reasons.length, 2);
    assert.match(result.skipped[0].reasons[0], /no finished production build/);
    assert.match(result.skipped[0].reasons[1], /not this commit/);
  });

  test("a rolled back preview is not proof, even though this commit was published there before", () => {
    const result = production(facts("android", { newestPreview: rolledBack }), facts("ios"));
    assert.equal(result.publishPlatform, "ios");
    assert.match(result.skipped[0].reasons[0], /rolls back to the build's own code/);
  });

  test("no preview update at all is not proof", () => {
    const result = production(facts("android", { newestPreview: null }), facts("ios", { newestPreview: null }));
    assert.equal(result.publishPlatform, null);
    assert.deepEqual(result.kept, []);
    for (const { reasons } of result.skipped) assert.match(reasons[0], /branch preview has no (android|ios) update/);
  });

  test("an update with no commit hash is not proof", () => {
    const result = production(facts("android", { newestPreview: { group: "g", isRollBackToEmbedded: false } }));
    assert.equal(result.publishPlatform, null);
    assert.match(result.skipped[0].reasons[0], /built from an unknown commit/);
  });

  test("nothing left: none to publish to", () => {
    const result = production(facts("android", { hasBuild: false }), facts("ios", { hasBuild: false }));
    assert.equal(result.publishPlatform, null);
    assert.equal(result.skipped.length, 2);
  });
});

describe("judgePlatforms, to preview", () => {
  test("only the build check counts: preview needs no earlier preview update", () => {
    const result = judgePlatforms({
      to: "preview",
      head: HEAD,
      platforms: [facts("android", { newestPreview: null }), facts("ios", { hasBuild: false, newestPreview: null })],
    });
    assert.equal(result.publishPlatform, "android");
    assert.equal(result.skipped[0].platform, "ios");
    assert.deepEqual(result.skipped[0].reasons.length, 1);
    assert.match(result.skipped[0].reasons[0], /no finished preview build has runtime rv-ios/);
  });

  test("the runtime version each kept platform resolved is carried through", () => {
    const result = judgePlatforms({ to: "preview", head: HEAD, platforms: [facts("android"), facts("ios")] });
    assert.deepEqual(result.kept, [
      { platform: "android", runtimeVersion: "rv-android" },
      { platform: "ios", runtimeVersion: "rv-ios" },
    ]);
  });
});

// The script itself, run end to end in a throwaway repository against fake eas and pnpm
// (test-support/fake-cli.mjs). Runtime versions there are always "rv-<environment>-<platform>".
describe("update:publish, run against fake eas and pnpm", { concurrency: true }, () => {
  after(removeSandboxes);

  const sandbox = (scenario = {}) => {
    const box = makeSandbox({
      "apps/mobile/scripts/publish-update.mjs": fromApp("scripts/publish-update.mjs"),
      "apps/mobile/scripts/publish-platforms.mjs": fromApp("scripts/publish-platforms.mjs"),
      ".gitignore": ".env*.local\n",
    });
    box.scenario(scenario);
    return box;
  };
  const easCalls = (calls) => calls.filter((c) => c.tool === "eas");
  const publishes = (calls) => easCalls(calls).filter((c) => c.args[0] === "update");
  const androidBuild = { builds: ["preview:android:rv-preview-android"] };

  test("AC-10: installs from the lockfile before any eas call, because eas reads the app config", () => {
    const { calls } = sandbox().run("publish-update.mjs", ["--to", "preview", "--dry-run"]);
    const install = calls.findIndex((c) => c.tool === "pnpm" && c.args[0] === "install");
    assert.deepEqual(calls[install]?.args, ["install", "--frozen-lockfile"]);
    assert.ok(install < calls.findIndex((c) => c.tool === "eas"), "the install comes first");
  });

  test("AC-10: no eas call sees APP_VARIANT or an EXPO_PUBLIC_ value from this shell", () => {
    const { output, calls } = sandbox().run("publish-update.mjs", ["--to", "preview", "--dry-run"], {
      APP_VARIANT: "staging",
      EXPO_PUBLIC_API_URL: "http://example.test",
    });
    assert.match(output, /channel preview serves branch preview/);
    for (const call of easCalls(calls)) {
      assert.equal(call.env.APP_VARIANT, null, `eas ${call.args[0]} saw APP_VARIANT`);
      assert.deepEqual(call.env.expoPublic, [], `eas ${call.args[0]} saw an EXPO_PUBLIC_ value`);
    }
  });

  test("AC-10: refuses a target that is not preview or production, and runs nothing", () => {
    const { status, output, calls } = sandbox().run("publish-update.mjs", ["--to", "staging"]);
    assert.equal(status, 1);
    assert.match(output, /--to preview or --to production \(got staging\)/);
    assert.deepEqual(calls, []);
  });

  test("AC-10: refuses a tree with an untracked file, and lists it", () => {
    const box = sandbox();
    box.write("notes.txt", "draft\n");
    const { status, output, calls } = box.run("publish-update.mjs", ["--to", "preview"]);
    assert.equal(status, 1);
    assert.match(output, /working tree is not clean[\s\S]*notes\.txt/);
    assert.deepEqual(calls, []);
  });

  test("AC-10: refuses an apps/mobile/.env file that sets an EXPO_PUBLIC_ value, before installing", () => {
    const box = sandbox();
    box.write("apps/mobile/.env.local", "EXPO_PUBLIC_ANYTHING=1\n");
    const { status, output, calls } = box.run("publish-update.mjs", ["--to", "preview", "--dry-run"]);
    assert.equal(status, 1);
    assert.match(output, /apps\/mobile\/\.env\.local sets EXPO_PUBLIC_ANYTHING/);
    assert.deepEqual(calls, []);
  });

  test("AC-10: a lockfile that does not match stops it before eas is asked anything", () => {
    const { status, output, calls } = sandbox({ installFails: true }).run("publish-update.mjs", ["--to", "preview"]);
    assert.equal(status, 1);
    assert.match(output, /pnpm install --frozen-lockfile failed/);
    assert.deepEqual(easCalls(calls), []);
  });

  test("AC-10: refuses when the channel serves another branch, and prints the command that points it back", () => {
    const box = sandbox({ ...androidBuild, channels: { preview: "hotfix" } });
    const { status, output, calls } = box.run("publish-update.mjs", ["--to", "preview"]);
    assert.equal(status, 1);
    assert.match(output, /channel preview must serve branch preview alone, and it serves hotfix/);
    assert.match(output, /eas channel:edit preview --branch preview/);
    assert.deepEqual(publishes(calls), []);
  });

  test("AC-9, AC-10: skips each platform with no finished build for its runtime, and refuses when none is left", () => {
    const { status, output, calls } = sandbox().run("publish-update.mjs", ["--to", "preview"]);
    assert.equal(status, 1);
    for (const platform of ["android", "ios"]) {
      assert.match(output, new RegExp(`${platform}: runtime rv-preview-${platform}, skipped:`));
      assert.match(output, new RegExp(`no finished preview build has runtime rv-preview-${platform}`));
    }
    assert.match(output, /no platform can take this update on preview/);
    assert.deepEqual(publishes(calls), []);
  });

  test("AC-10, AC-11: a dry run keeps the platform with a build, prints its way back, and publishes nothing", () => {
    const { status, output, calls } = sandbox(androidBuild).run("publish-update.mjs", ["--to", "preview", "--dry-run"]);
    assert.equal(status, 0);
    assert.match(output, /android: runtime rv-preview-android, ready/);
    assert.match(
      output,
      /eas update:roll-back-to-embedded --branch preview --runtime-version rv-preview-android --platform android/,
    );
    assert.match(output, /dry run: every check passed/);
    assert.match(output, /Skipped: ios/);
    assert.deepEqual(publishes(calls), []);
  });

  test("AC-11: the way back republishes the group that was live before", () => {
    const live = { group: "g-live", platform: "android", runtimeVersion: "rv-preview-android" };
    const box = sandbox({ ...androidBuild, updates: { preview: [live] } });
    const { output } = box.run("publish-update.mjs", ["--to", "preview", "--dry-run"]);
    assert.match(output, /android: live on preview before publishing: g-live/);
    assert.match(output, /eas update:republish --group g-live --platform android/);
  });

  test("AC-8, AC-11: publishes once to the kept platform, and prints the way back before and after", () => {
    const { status, output, calls } = sandbox(androidBuild).run("publish-update.mjs", ["--to", "preview"]);
    assert.equal(status, 0);
    const [publish, ...more] = publishes(calls);
    assert.deepEqual(more, []);
    for (const arg of ["--channel", "--environment"])
      assert.equal(publish.args[publish.args.indexOf(arg) + 1], "preview");
    assert.equal(publish.args[publish.args.indexOf("--platform") + 1], "android");
    assert.ok(publish.args.includes("--clear-cache"));
    assert.match(output, /published update group published-group to preview/);
    assert.equal(output.match(/To roll back/g)?.length, 2);
  });

  test("AC-10: fails loudly when what EAS published has another runtime version", () => {
    const box = sandbox({ ...androidBuild, publishedRuntime: "rv-other" });
    const { status, output } = box.run("publish-update.mjs", ["--to", "preview"]);
    assert.equal(status, 1);
    assert.match(output, /does not match what this script resolved/);
    assert.match(output, /runtime rv-other, not the resolved rv-preview-android/);
  });

  test("AC-10: production refuses a commit that is not merged into origin/main, before anything else", () => {
    const box = sandbox();
    box.addOrigin();
    box.write("change.txt", "not on main yet\n");
    box.git("add", "-A");
    box.git("commit", "-q", "-m", "unmerged");
    const { status, output, calls } = box.run("publish-update.mjs", ["--to", "production", "--dry-run"]);
    assert.equal(status, 1);
    assert.match(output, /is not merged into origin\/main/);
    assert.deepEqual(calls, []);
  });

  test("AC-10: production keeps only a platform whose newest preview update was built from this commit", () => {
    const box = sandbox();
    box.addOrigin();
    const head = box.git("rev-parse", "HEAD");
    box.scenario({
      builds: ["production:android:rv-production-android", "production:ios:rv-production-ios"],
      updates: {
        preview: [
          { group: "g-android", platform: "android", runtimeVersion: "rv-preview-android", gitCommitHash: head },
          { group: "g-ios", platform: "ios", runtimeVersion: "rv-preview-ios", isRollBackToEmbedded: true },
        ],
      },
    });
    const { status, output, calls } = box.run("publish-update.mjs", ["--to", "production", "--dry-run"]);
    assert.equal(status, 0, output);
    assert.match(output, /android: runtime rv-production-android, ready/);
    assert.match(output, /the newest ios update on preview \(g-ios\) rolls back to the build's own code/);
    const views = easCalls(calls).filter((c) => c.args[0] === "update:view");
    assert.ok(views.length > 0 && views.every((c) => !c.args.includes("--non-interactive")));
  });
});
