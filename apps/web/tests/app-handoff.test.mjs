/**
 * Web hands `/sign-in` to the operator app only when the app is another origin
 * (`src/lib/app-handoff.ts`), and `/register` never: registration is web's
 * wizard everywhere.
 *
 * The bug this pins: the hand-off was unconditional, and a deployed stack builds
 * web with `NEXT_PUBLIC_PMS_URL` equal to its own origin, because the app is a
 * zone under it. So `https://www.injishi.com/sign-in` answered a 307 to
 * itself, forever, and the waitlist's one door into the product was a loop.
 *
 * THIS TEST RUNS THE REAL FUNCTION: the source is read, transpiled and
 * evaluated, never restated.
 *
 * Run: pnpm --filter @injishi/web test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ts = require("typescript");

async function loadHandoff() {
  const src = readFileSync(resolve(here, "../src/lib/app-handoff.ts"), "utf8");
  // next.config.ts loads this through Next's config require hook, which only
  // transpiles; an import of an alias or a package would break the config.
  assert.doesNotMatch(src, /^\s*import\s/m, "app-handoff.ts has grown an import; next.config.ts and this test load it bare");
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const { appHandoffRedirects, APP_HANDOFF_PATHS } = await loadHandoff();

/** Each stack's two build values, as its compose file or env file sets them. */
const SAME_ORIGIN = {
  // docker-compose.dokploy.yml: the operator app is a zone, so its public URL is web's.
  production: ["https://www.injishi.com", "https://www.injishi.com"],
  // docker-compose.demo.yml, the same shape on the demo host.
  demo: ["https://www-demo.injishi.com", "https://www-demo.injishi.com"],
  // A trailing slash on one side is still the same origin.
  "a trailing slash": ["https://www.injishi.com/", "https://www.injishi.com"],
  // apps/web/.env.example, which describes the zone model on a laptop.
  "the env example": ["http://localhost:3000", "http://localhost:3000"],
};

describe("no hand-off when the app shares web's origin", () => {
  for (const [name, [web, app]] of Object.entries(SAME_ORIGIN)) {
    test(name, () => {
      assert.deepEqual(appHandoffRedirects(web, app), []);
    });
  }
});

describe("the hand-off still runs when the app is its own origin", () => {
  test("a laptop with the app on :3002 sends sign in there", () => {
    assert.deepEqual(appHandoffRedirects("http://localhost:3000", "http://localhost:3002"), [
      { source: "/sign-in", destination: "http://localhost:3002/sign-in", permanent: false },
    ]);
  });

  test("/register is never handed off, so web's wizard answers on a laptop too", () => {
    assert.ok(!APP_HANDOFF_PATHS.includes("/register"));
    for (const [web, app] of [["http://localhost:3000", "http://localhost:3002"], [undefined, undefined]]) {
      assert.ok(appHandoffRedirects(web, app).every((r) => r.source !== "/register"));
    }
  });

  test("both unset keeps the old default of :3000 handing to :3002", () => {
    const redirects = appHandoffRedirects(undefined, undefined);
    assert.deepEqual(
      redirects.map((r) => r.destination),
      ["http://localhost:3002/sign-in"],
    );
  });

  test("an empty build arg is read as unset, as `||` reads it", () => {
    assert.equal(appHandoffRedirects("", "").length, APP_HANDOFF_PATHS.length);
  });
});

describe("a hand-off can never point at web itself", () => {
  test("a relative app url hands off nothing rather than redirecting to this origin", () => {
    assert.deepEqual(appHandoffRedirects("https://www.injishi.com", "/operator"), []);
  });

  const cases = [
    ...Object.values(SAME_ORIGIN),
    ["http://localhost:3000", "http://localhost:3002"],
    ["https://www.injishi.com", "https://app.injishi.com"],
    [undefined, undefined],
  ];
  for (const [web, app] of cases) {
    test(`${web} with ${app}`, () => {
      const self = new URL(web || "http://localhost:3000").origin;
      for (const r of appHandoffRedirects(web, app)) {
        assert.notEqual(new URL(r.destination).origin, self, `${r.source} would redirect to itself`);
      }
    });
  }
});

describe("next.config.ts decides through this function and nowhere else", () => {
  const config = readFileSync(resolve(here, "../next.config.ts"), "utf8");

  test("it spreads appHandoffRedirects with the two public origins", () => {
    assert.match(
      config,
      /appHandoffRedirects\(\s*process\.env\.NEXT_PUBLIC_WEB_URL,\s*process\.env\.NEXT_PUBLIC_PMS_URL\s*\)/,
    );
  });

  for (const path of [...APP_HANDOFF_PATHS, "/register"]) {
    test(`it declares no unconditional redirect from ${path}`, () => {
      assert.doesNotMatch(config, new RegExp(`source:\\s*["'\`]${path}["'\`]`));
    });
  }
});
