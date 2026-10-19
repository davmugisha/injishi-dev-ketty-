/**
 * The waitlist gate's matchers must be right the first time they ever run.
 *
 * ADR-048 scopes waitlist mode by host so that it needs no flag and no
 * environment variable, and states the cost of that choice plainly: the gate's
 * code path NEVER RUNS anywhere but production. Not on a laptop, not on
 * staging, not on the demo host. The first request it ever sees is a real
 * stranger on `www.injishi.com`, and there is no staging rehearsal in which a
 * mistake shows up first.
 *
 * The mitigation the decision names is this file. Two ways to get it wrong, and
 * they fail in opposite directions:
 *
 * - THE HOST MATCHER TOO NARROW and the gate never fires, so the unfinished
 *   marketplace stays open to everybody while everyone believes it is closed.
 * - THE ALLOWLIST TOO WIDE and a gated route stays reachable. Too narrow and
 *   `/sign-in` is swallowed, which locks out the pilot operators and staff the
 *   allowlist exists to keep letting in.
 *
 * THIS TEST RUNS THE REAL FUNCTIONS, not a copy of their rules, following
 * `safe-redirect.test.mjs`: the source is read, transpiled and evaluated. A
 * test that re-stated the rule would pass against a broken implementation
 * because it would be checking itself.
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

async function loadGate() {
  const path = resolve(here, "../src/lib/waitlist-gate.ts");
  const src = readFileSync(path, "utf8");
  // No stubbing: this module imports nothing, which is why it was carved out
  // of `middleware.ts` in the first place.
  assert.doesNotMatch(
    src,
    /^\s*import\s/m,
    "waitlist-gate.ts has grown an import; this test loads it bare",
  );
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
  );
}

const { isGatedHost, isWaitlistOpen, WAITLIST_OPEN_PREFIXES } = await loadGate();

describe("the host matcher catches every spelling of the two gated hosts", () => {
  const gated = {
    "the bare apex": "injishi.com",
    "with www": "www.injishi.com",
    "shouted": "WWW.INJISHI.COM",
    "mixed case": "WWW.Injishi.com",
    "with the https port": "www.injishi.com:443",
    "with a port on the apex": "injishi.com:8080",
    "with surrounding space": "  www.injishi.com  ",
  };

  for (const [name, host] of Object.entries(gated)) {
    test(name, () => {
      assert.equal(isGatedHost(host), true, `${host} must be gated`);
    });
  }
});

describe("the host matcher leaves every other host alone", () => {
  // AC-5: a laptop, staging and the demo host must behave exactly as they did
  // before ADR-048. A false positive here takes a working environment down.
  const open = {
    localhost: "localhost:3000",
    loopback: "127.0.0.1:3000",
    "IPv6 loopback": "[::1]:3000",
    staging: "staging.injishi.rw",
    demo: "demo.injishi.rw",
    "the API host": "api.injishi.com",
    "the admin host": "admin.injishi.com",
    // The suffix trick `safeRedirect` was already burned by. A gate that used
    // `endsWith` would treat this attacker-controlled host as production.
    "a lookalike suffix": "www.injishi.com.evil.com",
    // And the prefix direction, for a gate that used `startsWith`.
    "a lookalike prefix": "injishi.com.evil.com",
    "a subdomain": "beta.www.injishi.com",
    missing: undefined,
    empty: "",
    null: null,
  };

  for (const [name, host] of Object.entries(open)) {
    test(name, () => {
      assert.equal(isGatedHost(host), false, `${host} must not be gated`);
    });
  }
});

describe("the allowlist opens exactly what AC-2 names", () => {
  const open = [
    "/waitlist",
    "/waitlist/unsubscribe/0f9a1b00-0000-4000-8000-000000000000",
    "/sign-in",
    "/verify-otp",
    "/two-factor",
    "/two-factor/verify",
    "/start",
    "/support",
    "/legal/privacy",
    "/legal/terms",
    "/training",
    "/training/enroll",
    "/verify",
    "/verify/JZDSHY31DXFDBNS7NGPRXN0XYV2EZ1VV",
    // Amended 2026-10-19: List Accommodation in the waitlist header opens the
    // host page, and every way forward on it lands on the wizard.
    "/host",
    "/host/start",
    "/register",
  ];

  for (const pathname of open) {
    test(`${pathname} stays open`, () => {
      assert.equal(isWaitlistOpen(pathname), true);
    });
  }
});

describe("the allowlist gates the unfinished marketplace", () => {
  const gated = [
    "/",
    "/explore",
    "/property/lanternhouse-hotel-kiyovu",
    "/activate",
    "/claim-org",
    "/book",
    "/guides",
    "/services",
    "/legal",
    // The reason `isWaitlistOpen` is not a bare `startsWith`. Each of these
    // begins with an allowlisted prefix and is a different route.
    "/supporters",
    "/sign-in-with-google",
    "/waitlisted",
    "/trainings",
    "/verifying",
    "/startup",
    "/legal/privacy-policy-old",
    "/hosts",
    "/hostel",
    "/registered",
    "/register-business",
  ];

  for (const pathname of gated) {
    test(`${pathname} is gated`, () => {
      assert.equal(isWaitlistOpen(pathname), false);
    });
  }
});

describe("the allowlist and the sign-in route cannot drift apart", () => {
  // AC-19b. The waitlist footer links to `/sign-in`, and it is the only route a
  // pilot operator or staff member has back into the product from this domain.
  // If it ever leaves the allowlist, that link redirects to the page it is on.
  test("/sign-in is on the list", () => {
    assert.ok(WAITLIST_OPEN_PREFIXES.includes("/sign-in"));
  });

  // Every destination the waitlist footer offers (copy.md §8). A link on the
  // page that leads somewhere the gate bounces back is AC-19's one prohibition.
  for (const href of ["/legal/privacy", "/legal/terms", "/support", "/sign-in"]) {
    test(`the footer link ${href} does not bounce`, () => {
      assert.equal(isWaitlistOpen(href), true);
    });
  }
});

describe("the waitlist header's two doors do not bounce", () => {
  // The header renders the marketplace's own `AccountMenu` (Sign In) and
  // `HostCta` (List Accommodation, or Resume registration for somebody already
  // in the pipeline). The hrefs are READ from those files rather than restated,
  // so a control that grows a new destination fails here before it ships a
  // button that redirects to the page it sits on (AC-19). The one dynamic href,
  // `/w/<id>`, is shown only to a signed-in operator, whom the session lets
  // through (AC-3), so only the literal ones are a stranger's.
  const header = readFileSync(
    resolve(here, "../src/components/waitlist/waitlist-header.tsx"),
    "utf8",
  );
  const literalHrefs = (file, pattern) =>
    [...readFileSync(resolve(here, "../src/components/layout", file), "utf8").matchAll(pattern)].map(
      (m) => m[1],
    );

  test("the header still mounts both controls", () => {
    assert.match(header, /<AccountMenu\b/);
    assert.match(header, /<HostCta\b/);
  });

  const doors = [
    ...literalHrefs("account-menu.tsx", /<Link\s+href="(\/[^"]*)"/g),
    ...literalHrefs("host-cta.tsx", /href:\s*"(\/[^"]*)"/g),
  ];

  test("both files still name literal destinations", () => {
    assert.ok(doors.includes("/sign-in"), `AccountMenu offers ${doors.join(", ")}`);
    assert.ok(doors.includes("/host"), `HostCta offers ${doors.join(", ")}`);
  });

  for (const href of new Set(doors)) {
    test(`${href} does not bounce`, () => {
      assert.equal(isWaitlistOpen(href), true);
    });
  }
});
