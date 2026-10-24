/**
 * Web hands `/sign-in` to the operator app only when the app is another origin
 * (`src/lib/app-handoff.ts`), and `/register` never: registration is web's
 * wizard everywhere. Old zone links (`/w/...`, `/oversight/...`) are sent on.
 *
 * The first bug this pins: the hand-off was unconditional, and a stack once
 * built web with `NEXT_PUBLIC_PMS_URL` equal to its own origin (the app was a
 * zone under it). So `https://www.injishi.com/sign-in` answered a 307 to
 * itself, forever, and the waitlist's one door into the product was a loop.
 * The second (2026-10-24): every stack gives the app its own origin now, and
 * web forwarded `/w/<id>` to an app with no page there, so sign-in ended on a
 * 404.
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

const { appHandoffRedirects, APP_HANDOFF_PATHS, oldZoneRedirects, OLD_ZONE_ROOTS } = await loadHandoff();

/** Builds whose app shares web's origin: the retired zone model, kept safe. */
const SAME_ORIGIN = {
  "one host": ["https://www.injishi.com", "https://www.injishi.com"],
  "the demo host": ["https://www-demo.injishi.com", "https://www-demo.injishi.com"],
  // A trailing slash on one side is still the same origin.
  "a trailing slash": ["https://www.injishi.com/", "https://www.injishi.com"],
  "one laptop port": ["http://localhost:3000", "http://localhost:3000"],
};

describe("no hand-off when the app shares web's origin", () => {
  for (const [name, [web, app]] of Object.entries(SAME_ORIGIN)) {
    test(name, () => {
      assert.deepEqual(appHandoffRedirects(web, app), []);
    });
  }
});

describe("the hand-off runs when the app is its own origin, as in every stack", () => {
  test("production (docker-compose.dokploy.yml) sends sign in to app.injishi.com", () => {
    assert.deepEqual(appHandoffRedirects("https://www.injishi.com", "https://app.injishi.com"), [
      { source: "/sign-in", destination: "https://app.injishi.com/sign-in", permanent: false },
    ]);
  });

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

describe("old zone links are sent on, never forwarded", () => {
  test("a property setup page keeps its path, on the app", () => {
    const [setup] = oldZoneRedirects("http://localhost:3000", "http://localhost:3002");
    assert.deepEqual(setup, {
      source: "/w/:workspaceId/setup",
      destination: "http://localhost:3002/w/:workspaceId/setup",
      permanent: false,
    });
  });

  test("anything else under an old root goes to /start, which opens the person's home", () => {
    const rest = oldZoneRedirects("https://www.injishi.com", "https://app.injishi.com").slice(1);
    for (const root of OLD_ZONE_ROOTS) {
      assert.ok(rest.some((r) => r.source === root && r.destination === "/start"), root);
      assert.ok(rest.some((r) => r.source === `${root}/:path*` && r.destination === "/start"), `${root}/*`);
    }
  });

  test("with the app on web's own origin, no redirect names it (it would loop)", () => {
    for (const r of oldZoneRedirects("https://www.injishi.com", "https://www.injishi.com")) {
      assert.equal(r.destination, "/start");
    }
  });
});

describe("next.config.ts forwards nothing to the app", () => {
  const config = readFileSync(resolve(here, "../next.config.ts"), "utf8");

  test("it has no rewrites", () => {
    assert.doesNotMatch(config, /async rewrites\(/);
    assert.doesNotMatch(config, /OPERATOR_APP_URL/);
  });

  test("it spreads oldZoneRedirects with the two public origins", () => {
    assert.match(
      config,
      /oldZoneRedirects\(\s*process\.env\.NEXT_PUBLIC_WEB_URL,\s*process\.env\.NEXT_PUBLIC_PMS_URL\s*\)/,
    );
  });
});
