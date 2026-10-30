/**
 * What search engines are told (ADR-048 AC-16 as launched, ADR-053 AC-I9).
 *
 * `robots.ts` and `sitemap.ts` were written for the waitlist and outlived it on
 * purpose: deleting them would have started launch day with no search
 * directives at all. So they are pinned here: robots must let crawlers read the
 * marketplace, the sitemap must list exactly what the API calls publicly
 * sellable, and every URL must be absolute on the site's own origin, because a
 * relative or localhost URL in a sitemap is one crawlers quietly ignore.
 *
 * THIS TEST RUNS THE REAL FUNCTIONS through `ts-source-hook.mjs`, with the
 * real `lib/web-url.ts` and `lib/api.ts` under them. Only `fetch` is stood in.
 * Both modules read their origin once at load, so the two variables are set
 * before the first import.
 *
 * Run: pnpm --filter @injishi/web test
 */
import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./ts-source-hook.mjs", import.meta.url);

process.env.NEXT_PUBLIC_WEB_URL = "https://www.example.rw/";
process.env.NEXT_PUBLIC_API_URL = "https://api.example.rw";

const { default: robots } = await import("@/app/robots");
const { default: sitemap } = await import("@/app/sitemap");

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Answer the sitemap read with `respond`, recording what was asked. */
function serve(respond) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return respond();
  };
  return calls;
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("robots", () => {
  test("lets every crawler read the marketplace", () => {
    const [rule] = robots().rules;

    assert.equal(rule.userAgent, "*");
    assert.equal(rule.allow, "/");
  });

  test("disallows nothing but the unsubscribe links still sitting in inboxes", () => {
    const [rule] = robots().rules;

    assert.deepEqual(rule.disallow, ["/waitlist/unsubscribe/"]);
  });

  test("points at an absolute sitemap on the site's own origin", () => {
    assert.equal(robots().sitemap, "https://www.example.rw/sitemap.xml");
  });
});

/** Every entry the sitemap lists that is not a property: the site's own pages. */
const OWN = (entries) => entries.filter((e) => !e.url.includes("/property/"));

describe("sitemap (covers: AC-I9)", () => {
  test("lists the site's own pages, then every property the API calls publicly sellable", async () => {
    const calls = serve(() =>
      json([
        { slug: "amahoro-lodge", publishedAt: "2026-10-01T08:00:00.000Z" },
        { slug: "inzu nziza", publishedAt: null },
      ]),
    );

    const entries = await sitemap();

    assert.deepEqual(entries.slice(-2), [
      { url: "https://www.example.rw/property/amahoro-lodge", lastModified: "2026-10-01T08:00:00.000Z" },
      { url: "https://www.example.rw/property/inzu%20nziza" },
    ]);
    assert.equal(entries[0].url, "https://www.example.rw/");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.example.rw/api/v1/properties/sitemap");
    assert.equal(calls[0].init.cache, "no-store");
  });

  // On launch day nothing was published and the sitemap was one URL long, so
  // the guides, the destination pages and the host page were invisible to it.
  test("lists the pages a crawler can rank even when nothing is published", async () => {
    serve(() => json([]));

    const urls = (await sitemap()).map((e) => e.url);

    for (const path of ["/", "/explore", "/stays", "/stays/musanze", "/host", "/how-it-works"]) {
      assert.ok(urls.includes(`https://www.example.rw${path}`), `missing ${path}`);
    }
    // No guides are published yet (data/guides.ts), so neither the index nor an article is listed.
    assert.ok(urls.every((u) => !u.startsWith("https://www.example.rw/guides")), "lists a guide that does not exist");
  });

  test("never lists a page that tells crawlers not to index it", async () => {
    serve(() => json([]));

    const urls = (await sitemap()).map((e) => e.url);

    for (const path of ["/book", "/demo", "/services", "/sign-in", "/register"]) {
      assert.ok(
        urls.every((u) => u !== `https://www.example.rw${path}` && !u.startsWith(`https://www.example.rw${path}/`)),
        `lists ${path}`,
      );
    }
  });

  test("lists every URL once, all on the site's own origin", async () => {
    serve(() => json([{ slug: "amahoro-lodge", publishedAt: null }]));

    const urls = (await sitemap()).map((e) => e.url);

    assert.equal(new Set(urls).size, urls.length);
    assert.ok(urls.every((u) => u.startsWith("https://www.example.rw/")), urls.join(", "));
  });

  test("names no waitlist page", async () => {
    serve(() => json([{ slug: "amahoro-lodge", publishedAt: null }]));

    const urls = (await sitemap()).map((e) => e.url);

    assert.ok(urls.every((u) => !u.includes("/waitlist")), urls.join(", "));
  });

  for (const [label, respond] of [
    ["the API cannot be reached", () => Promise.reject(new TypeError("fetch failed"))],
    ["the API answers an error", () => json({ message: "down" }, 503)],
    ["the API answers a shape it does not promise", () => json({ properties: [] })],
  ]) {
    test(`falls back to the site's own pages when ${label}`, async () => {
      serve(respond);

      const entries = await sitemap();

      assert.deepEqual(entries, OWN(entries));
      assert.equal(entries[0].url, "https://www.example.rw/");
    });
  }
});
