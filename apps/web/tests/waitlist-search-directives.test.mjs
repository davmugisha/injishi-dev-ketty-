/**
 * What search engines are told while the waitlist is up (ADR-048 AC-16).
 *
 * `robots.ts` and `sitemap.ts` are the two waitlist files that are REPLACED at
 * launch rather than deleted, so they are worth pinning twice over: while the
 * gate is up they must point crawlers at `/waitlist` and nothing else, and they
 * must build every URL from `NEXT_PUBLIC_SITE_URL`, because a relative or
 * localhost URL in a sitemap is one crawlers quietly ignore.
 *
 * THIS TEST RUNS THE REAL FUNCTIONS, following `waitlist-gate.test.mjs`: the
 * source is read, transpiled and evaluated. Both files import only a type,
 * which the transpile removes.
 *
 * Run: pnpm --filter @injishi/web test
 */
import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ts = require("typescript");

async function load(file) {
  const src = readFileSync(resolve(here, "../src/app", file), "utf8");
  assert.doesNotMatch(
    src.replace(/^\s*import\s+type\s.*$/gm, ""),
    /^\s*import\s/m,
    `${file} has grown a runtime import; this test loads it bare`,
  );
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return (await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`)).default;
}

const robots = await load("robots.ts");
const sitemap = await load("sitemap.ts");

const ORIGINAL = process.env.NEXT_PUBLIC_SITE_URL;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL;
});

describe("robots while the gate is up (covers: AC-16)", () => {
  test("allows /waitlist to every crawler", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.injishi.com";

    const [rule] = robots().rules;

    assert.equal(rule.userAgent, "*");
    assert.equal(rule.allow, "/waitlist");
  });

  test("disallows everything else", () => {
    const [rule] = robots().rules;

    assert.ok(rule.disallow.includes("/"), `disallow was ${JSON.stringify(rule.disallow)}`);
  });

  test("keeps unsubscribe links out of search results", () => {
    const [rule] = robots().rules;

    assert.ok(rule.disallow.includes("/waitlist/unsubscribe/"));
  });

  test("allows nothing but /waitlist", () => {
    const { rules } = robots();
    const allows = rules.flatMap((r) => [r.allow].flat().filter(Boolean));

    assert.deepEqual(allows, ["/waitlist"]);
  });

  test("points at an absolute sitemap on the production origin", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.injishi.com";

    assert.equal(robots().sitemap, "https://www.injishi.com/sitemap.xml");
  });
});

describe("sitemap while the gate is up (covers: AC-16)", () => {
  test("names /waitlist and nothing else", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.injishi.com";

    const entries = sitemap();

    assert.deepEqual(entries.map((e) => e.url), ["https://www.injishi.com/waitlist"]);
  });

  test("builds the URL from NEXT_PUBLIC_SITE_URL at call time", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://staging.example.rw";

    assert.equal(sitemap()[0].url, "https://staging.example.rw/waitlist");
  });
});

describe("without a site URL", () => {
  for (const [label, value] of [["unset", undefined], ["an empty string", ""]]) {
    test(`falls back to the local origin when NEXT_PUBLIC_SITE_URL is ${label}`, () => {
      if (value === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = value;

      assert.equal(sitemap()[0].url, "http://localhost:3000/waitlist");
      assert.equal(robots().sitemap, "http://localhost:3000/sitemap.xml");
    });
  }
});
