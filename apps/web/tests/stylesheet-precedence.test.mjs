/**
 * Source guard for the first paint restyle bug.
 *
 * React 19 only lifts a <link rel="stylesheet"> into <head> when the tag carries
 * a `precedence` prop. Without it React leaves the tag exactly where it was
 * rendered. Our page components render these tags at the very end of the
 * component, so an unmarked tag lands roughly 180KB deep inside <body>: the
 * browser paints the whole page with the head stylesheets only, discovers the
 * rest late, and restyles everything already on screen.
 *
 * These tests read the source, so they catch the mistake at author time without
 * needing a server. The companion file rendered-head.test.mjs proves the same
 * thing against the HTML a browser actually receives.
 *
 * The cascade-order block that used to sit at the bottom of this file is gone
 * with ADR-017. It ordered three shared sheets behind the captured CSS they
 * had to out-rank, and `/sign-in` was the last page that loaded any of them.
 * The capture is gone and those sheets are deleted from `public/shared/css/`.
 * ADR-021 then removed the last <link> of all, the brand font one, with the
 * `(onboarding)` root layout that rendered it. There is nothing left to order,
 * and nothing left to link: every group imports its stylesheet in its layout.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = fileURLToPath(new URL("..", import.meta.url));
const APP_DIR = join(WEB_ROOT, "src", "app");

/** Every .tsx file under src/app, recursively. */
function collectPages(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectPages(full));
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** Matches a full <link ...> tag whose rel is stylesheet, either JSX quoting style. */
const LINK_TAG = /<link\b[^>]*\brel=(?:"stylesheet"|\{"stylesheet"\})[^>]*>/g;

/** Pull the href out of a matched tag, either JSX quoting style. */
function hrefOf(tag) {
  const m = tag.match(/\bhref=(?:"([^"]*)"|\{"([^"]*)"\})/);
  return m ? (m[1] ?? m[2]) : null;
}

const SOURCE_FILES = collectPages(APP_DIR);
const ALL_LINKS = SOURCE_FILES.flatMap((file) => {
  const src = readFileSync(file, "utf8");
  return [...src.matchAll(LINK_TAG)].map((m) => ({
    file: relative(WEB_ROOT, file).replace(/\\/g, "/"),
    tag: m[0],
    href: hrefOf(m[0]),
    // Line number makes a failure directly actionable.
    line: src.slice(0, m.index).split("\n").length,
  }));
});

describe("stylesheet links in src/app", () => {
  test("the scan reaches the files it is meant to guard", () => {
    // A guard that silently matches nothing always passes, so this file has
    // always pinned a floor. It used to pin the number of LINKS: 24 across the
    // twelve marketing captures, then 10 across the one that outlived them,
    // then 1 after ADR-017 left only the brand font sheet in
    // `(onboarding)/layout.tsx`.
    //
    // ADR-021 deleted that layout when the three signed-in roots merged into
    // one, so the correct count is now ZERO and a link floor would fail on a
    // healthy app. The floor therefore moves onto the SCAN itself: prove the
    // walker still reaches src/app, and the two assertions below stay
    // meaningful the moment anyone hand-links CSS again. Zero links is the
    // target state, not a broken scan — an invariant of ADR-021 (AC-4).
    assert.ok(
      SOURCE_FILES.length >= 20,
      `expected the scan to reach at least 20 .tsx files under src/app, found ` +
        `${SOURCE_FILES.length}. The walker or the app layout changed.`,
    );
  });

  test("every stylesheet link carries a precedence prop", () => {
    const unmarked = ALL_LINKS.filter((l) => !/\bprecedence=/.test(l.tag));
    assert.deepEqual(
      unmarked.map((l) => `${l.file}:${l.line} -> ${l.href}`),
      [],
      "These tags have no `precedence`, so React leaves them in <body> and the " +
        "page repaints when they finally load. Add precedence to each.",
    );
  });

  test("no stylesheet href walks up the tree with ../", () => {
    // A relative href only resolved correctly by accident: `../../../shared/...`
    // clamps at the root. It breaks the moment a route gains real depth or a
    // trailing slash, and it makes React's href based dedupe miss.
    const relativeHrefs = ALL_LINKS.filter((l) => l.href?.startsWith("../"));
    assert.deepEqual(
      relativeHrefs.map((l) => `${l.file}:${l.line} -> ${l.href}`),
      [],
      "Use an absolute href rooted at /shared/css/ instead.",
    );
  });
});
