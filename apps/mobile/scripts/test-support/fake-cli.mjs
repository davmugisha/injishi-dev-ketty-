// A stand in for `eas` and `pnpm` in the release scripts' tests (sandbox.mjs puts it first on PATH).
// It logs each call to FAKE_LOG and answers from the scenario in FAKE_SCENARIO:
//
//   installFails      `pnpm install` exits 1, as with a lockfile that does not match
//   failStep          the pnpm script or expo command that exits 1 ("typecheck", "export", ...)
//   routerTypes       what `expo customize` writes to .expo/types/router.d.ts; null writes nothing
//   channels          { <channel>: <branch it serves> }, each channel serving its own name otherwise
//   builds            finished builds, as "<channel>:<platform>:<runtime version>"
//   updates           { <branch>: [{ group, platform, runtimeVersion, gitCommitHash, isRollBackToEmbedded }] }, newest first
//   publishedRuntime  the runtime version `eas update` reports, instead of the one resolved
//
// The runtime version under environment <e> for platform <p> is always "rv-<e>-<p>".

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [tool, ...args] = process.argv.slice(2);
const scenarioFile = process.env.FAKE_SCENARIO ?? "";
const scenario = existsSync(scenarioFile) ? JSON.parse(readFileSync(scenarioFile, "utf8")) : {};

appendFileSync(
  process.env.FAKE_LOG,
  `${JSON.stringify({
    tool,
    args,
    env: {
      APP_VARIANT: process.env.APP_VARIANT ?? null,
      EXPO_OFFLINE: process.env.EXPO_OFFLINE ?? null,
      expoPublic: Object.keys(process.env).filter((key) => key.startsWith("EXPO_PUBLIC_")),
    },
  })}\n`,
);

const flag = (name) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const print = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);
const allUpdates = () => Object.values(scenario.updates ?? {}).flat();

function pnpm() {
  if (args[0] === "install") {
    if (!scenario.installFails) return 0;
    console.error('ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile"');
    return 1;
  }
  const name = args[0] === "exec" ? args[2] : args.at(-1);
  if (scenario.failStep === name) {
    console.error(`${name} failed (fake)`);
    return 1;
  }
  if (name === "customize" && scenario.routerTypes !== null) {
    const dir = path.join(process.cwd(), ".expo", "types");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "router.d.ts"), scenario.routerTypes ?? "type Routes = `/staff` | `/staff/me`;\n");
  }
  return 0;
}

function eas() {
  const [command, subject] = args;
  if (command === "channel:view") {
    const branch = scenario.channels?.[subject] ?? subject;
    const branchMapping = JSON.stringify({ version: 0, data: [{ branchId: "b", branchMappingLogic: "true" }] });
    print({ currentPage: { name: subject, updateBranches: [{ name: branch }], branchMapping } });
    return 0;
  }
  if (command === "env:exec") {
    const platform = /--platform (\w+)/.exec(args[2] ?? "")?.[1];
    // A stray line first, as eas env:exec prints, which the script must skip.
    console.log("Environment variables loaded (fake)");
    console.log(JSON.stringify({ runtimeVersion: `rv-${subject}-${platform}` }));
    return 0;
  }
  if (command === "build:list") {
    const key = `${flag("--channel")}:${flag("--platform")}:${flag("--runtime-version")}`;
    print((scenario.builds ?? []).includes(key) ? [{ id: "build-1", status: "FINISHED" }] : []);
    return 0;
  }
  if (command === "update:list") {
    const platform = flag("--platform");
    const runtimeVersion = flag("--runtime-version");
    const groups = (scenario.updates?.[flag("--branch")] ?? [])
      .filter((u) => (!platform || u.platform === platform) && (!runtimeVersion || u.runtimeVersion === runtimeVersion))
      // The listing carries no commit; only update:view does.
      .map(({ gitCommitHash, ...group }) => group);
    print({ currentPage: groups });
    return 0;
  }
  if (command === "update:view") {
    // eas-cli 26 rejects the flag here, which once crashed every production publish.
    if (args.includes("--non-interactive")) {
      console.error("Nonexistent flag: --non-interactive");
      return 1;
    }
    print(allUpdates().filter((u) => u.group === subject));
    return 0;
  }
  if (command === "update") {
    const platform = flag("--platform");
    const platforms = platform === "all" ? ["android", "ios"] : [platform];
    print(
      platforms.map((p) => ({
        group: "published-group",
        platform: p,
        runtimeVersion: scenario.publishedRuntime ?? `rv-${flag("--environment")}-${p}`,
      })),
    );
    return 0;
  }
  console.error(`fake eas has no answer for: ${args.join(" ")}`);
  return 1;
}

process.exitCode = tool === "pnpm" ? pnpm() : eas();
