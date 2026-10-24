/**
 * Proves the first paint fix against the HTML a browser actually receives.
 *
 * The bug this pins: on `/` the three shared stylesheets used to sit at byte
 * 182089 of a 577KB response, while </head> closed at byte 3069. The browser
 * painted ~180KB of page before it even knew those sheets existed, then
 * restyled everything on screen once they arrived.
 *
 * Needs a running server. Start one with `pnpm dev` (or `pnpm build && pnpm
 * start`) and point BASE_URL at it. Without a server these tests skip rather
 * than fail, so the source guard in stylesheet-precedence.test.mjs stays useful
 * on its own.
 */
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

/**
 * Every route that ships a stylesheet, across the two root layouts.
 *
 * This list used to be the twelve marketing captures. Nine of them were deleted
 * with the old marketing layer in `a78935c` and the list was not updated, so
 * this suite failed on nine 404s for a while. The rebuilt public layer
 * (ADR-013) brings `/`, `/explore` and `/book` back under a different regime:
 * one compiled stylesheet, no captured CSS, fonts through `next/font/local`.
 *
 * `/sign-in` is in this list on the same terms as every other route now.
 * ADR-017 retired the last capture, so there is no route left that ships its
 * own CSS bundle, and nothing here is an exception any more.
 *
 * The group names changed with ADR-021 and the URLs did not, which is that
 * ADR's whole claim: the marketplace group is `(marketplace)`, and `(auth)`
 * plus `(onboarding)` are both `(app)/(entry)` now. Every path below is byte
 * for byte what it was.
 */
const ROUTES = [
  // (marketplace) — one compiled sheet each
  "/",
  "/explore",
  "/book",
  // (app)/(entry) — the generated app sheet and nothing else. The font <link>
  // that `(onboarding)` used to render died with that layout (ADR-021, AC-4).
  "/sign-in",
  "/verify-otp",
  "/register",
];

let serverUp = false;

before(async () => {
  try {
    const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(15_000) });
    serverUp = res.ok;
  } catch {
    serverUp = false;
  }
  if (!serverUp) {
    console.log(
      `\n  no server at ${BASE_URL}, skipping the rendered HTML checks.` +
        `\n  start one with: pnpm --filter @injishi/web dev\n`,
    );
  }
});

/** Fetch a route and locate every stylesheet link plus the end of <head>. */
async function inspect(route) {
  const res = await fetch(new URL(route, BASE_URL), {
    signal: AbortSignal.timeout(30_000),
  });
  assert.equal(res.status, 200, `${route} did not return 200`);
  const html = await res.text();

  const headEnd = html.indexOf("</head>");
  assert.ok(headEnd > -1, `${route} has no </head>`);

  const links = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].map(
    (m) => ({
      at: m.index,
      href: m[0].match(/\bhref="([^"]*)"/)?.[1] ?? "",
    }),
  );

  // The page that answered, which is not always web's: `/sign-in` hands off to
  // the operator app when that is another origin (src/lib/app-handoff.ts), and
  // that page's stylesheets live on the app's origin.
  return { html, headEnd, links, origin: res.url };
}

describe("stylesheets reach the browser inside <head>", () => {
  for (const route of ROUTES) {
    test(`${route} renders no stylesheet after </head>`, async (t) => {
      if (!serverUp) return t.skip("no server");

      const { headEnd, links } = await inspect(route);
      const stranded = links
        .filter((l) => l.at > headEnd)
        .map((l) => `${l.href} at byte ${l.at} (head closed at ${headEnd})`);

      assert.deepEqual(
        stranded,
        [],
        "A stylesheet below </head> is discovered after the page has already " +
          "painted, which is the visible restyle this fix removes.",
      );
    });

    test(`${route} serves every stylesheet it references`, async (t) => {
      if (!serverUp) return t.skip("no server");

      const { links, origin } = await inspect(route);
      const local = links.filter((l) => l.href.startsWith("/"));
      assert.ok(local.length > 0, `${route} references no stylesheet at all`);

      for (const sheet of local) {
        const res = await fetch(new URL(sheet.href, origin), {
          signal: AbortSignal.timeout(15_000),
        });
        assert.equal(res.status, 200, `${sheet.href} did not resolve from ${route}`);
      }
    });
  }
});
