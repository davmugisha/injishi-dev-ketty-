/**
 * The motion scale has to COMPILE, and its failure mode is silence.
 *
 * This is `layout-scale.test.mjs`'s twin, for the same reason and against the
 * same trap: a Tailwind class that resolves to nothing does not error. It
 * compiles to no rule, the element simply does not move, and nobody notices in
 * a review — which is exactly how `text-2xs` and `max-w-page` went months
 * meaning nothing. `duration-settle` and `ease-settle` would fail the same way,
 * and `animate-arrive` would fail worse: an element with an arrival animation
 * that does not exist keeps whatever opacity the keyframes were supposed to
 * bring it to, so a missing `@keyframes` can leave content INVISIBLE.
 *
 * So this runs the real Tailwind compiler over the two stylesheets a consuming
 * app imports — the emitted token sheet (`injishi-heroui.css`, which carries the
 * `@theme` block from `packages/design-tokens/src/motion.ts`) and the package's
 * own `@injishi/ui/styles.css`, which carries the four named animations and
 * their keyframes — and asserts each utility emits a rule with the value
 * `ui-tokens.md` tabulates.
 *
 * Run: pnpm --filter @injishi/web test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");

/**
 * Both sheets, in the order a real entry imports them: the package's CSS
 * obligations first (ADR-008 decision 5), then the token sheet.
 */
const ENTRY = [
  '@import "tailwindcss" source(none);',
  '@import "@injishi/ui/styles.css";',
  '@import "@injishi/design-tokens/heroui.css";',
  "",
].join("\n");

/**
 * Resolve a stylesheet import the way a CSS toolchain does, not the way Node
 * does.
 *
 * `tw-animate-css` — which `@injishi/ui/styles.css` imports for the `animate-in`
 * utilities every Radix overlay is written against — publishes ONLY a `style`
 * condition in its export map. `require.resolve` cannot see it and throws
 * `ERR_PACKAGE_PATH_NOT_EXPORTED`, which is not a missing dependency: it is Node
 * being asked a question about CSS. The real pipeline (`@tailwindcss/postcss`)
 * resolves with the `style` condition, so this does the same by hand.
 */
/** `<dir>/node_modules/<id>/package.json`, walking up from `from`. */
function findManifest(id, from) {
  let dir = from;
  for (;;) {
    const candidate = resolve(dir, "node_modules", id, "package.json");
    if (existsSync(candidate)) return candidate;
    const up = dirname(dir);
    if (up === dir) throw new Error(`cannot find ${id} from ${from}`);
    dir = up;
  }
}

function resolveStylesheet(id, base) {
  const paths = [base, appRoot];
  try {
    return require.resolve(id === "tailwindcss" ? "tailwindcss/index.css" : id, { paths });
  } catch (err) {
    if (err?.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw err;
    // Its `package.json` is not exported either, so walk up from the importer
    // the way a resolver does and read the manifest off disk.
    const pkgPath = findManifest(id, base);
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    const style = pkg.exports?.["."]?.style ?? pkg.style ?? pkg.main;
    if (!style) throw err;
    return resolve(dirname(pkgPath), style);
  }
}

async function compileWith(candidates) {
  const { compile } = await import("tailwindcss");
  const compiler = await compile(ENTRY, {
    base: appRoot,
    onDependency() {},
    async loadStylesheet(id, base) {
      const path = resolveStylesheet(id, base);
      return { path, base: dirname(path), content: readFileSync(path, "utf8") };
    },
  });
  return compiler.build(candidates);
}

/** `.foo { … }` -> the declaration body, whitespace-collapsed, or null. */
function ruleBody(css, cls) {
  const m = css.match(new RegExp(`\\.${cls.replace(/-/g, "\\-")}\\s*\\{([^}]*)\\}`));
  return m ? m[1].replace(/\s+/g, " ").trim() : null;
}

/** Five durations, named for what they are for (motion.ts). */
const DURATIONS = [
  ["duration-instant", "120ms"],
  ["duration-quick", "180ms"],
  ["duration-settle", "240ms"],
  ["duration-travel", "320ms"],
  ["duration-arrive", "480ms"],
];

/** Four curves, named for how a thing moves. */
const EASINGS = [
  ["ease-settle", "cubic-bezier(0.22, 1, 0.36, 1)"],
  ["ease-leave", "cubic-bezier(0.5, 0, 0.75, 0)"],
  ["ease-move", "cubic-bezier(0.65, 0, 0.35, 1)"],
  ["ease-spring", "cubic-bezier(0.34, 1.4, 0.64, 1)"],
];

/** The four named moments, from `@injishi/ui/styles.css`. */
const ANIMATIONS = ["animate-arrive", "animate-settle-in", "animate-leave", "animate-acknowledge"];

const ALL = [...DURATIONS.map((r) => r[0]), ...EASINGS.map((r) => r[0]), ...ANIMATIONS];

describe("the motion scale compiles in apps/web", () => {
  test("five named durations emit a transition-duration", async () => {
    const css = await compileWith(ALL);
    for (const [cls, value] of DURATIONS) {
      const body = ruleBody(css, cls);
      assert.ok(body, `.${cls} emitted no rule — --transition-duration-* is missing from the sheet`);
      assert.match(body, /transition-duration/, `.${cls} emitted no transition-duration`);
      assert.ok(
        body.includes(value) || body.includes("--transition-duration-"),
        `.${cls} does not carry ${value}: ${body}`,
      );
    }
  });

  test("four named curves emit a timing function", async () => {
    const css = await compileWith(ALL);
    for (const [cls, value] of EASINGS) {
      const body = ruleBody(css, cls);
      assert.ok(body, `.${cls} emitted no rule — --ease-* is missing from the sheet`);
      assert.match(body, /timing-function|--tw-ease/, `.${cls} emitted no timing function`);
      assert.ok(
        body.includes(value) || body.includes(`--ease-${cls.slice(5)}`),
        `.${cls} does not carry ${value}: ${body}`,
      );
    }
  });

  test("the four named moments emit an animation AND its keyframes", async () => {
    const css = await compileWith(ALL);
    for (const cls of ANIMATIONS) {
      const name = cls.slice("animate-".length);
      const body = ruleBody(css, cls);
      assert.ok(body, `.${cls} emitted no rule — --animate-${name} is missing from styles.css`);
      assert.match(body, /animation/, `.${cls} emitted no animation`);
      // The worst failure this file exists for: the utility compiles, the
      // keyframes do not, and an element that should have faded IN stays at the
      // opacity nothing ever animated away from.
      assert.match(
        css,
        new RegExp(`@keyframes\\s+${name}\\b`),
        `@keyframes ${name} is not in the compiled sheet, so .${cls} animates to nothing`,
      );
    }
  });

  test("every bare `transition` is on the scale, not on Tailwind's stock 150ms", async () => {
    const css = await compileWith(["transition", "transition-colors"]);
    const body = ruleBody(css, "transition");
    assert.ok(body, "the control utility must compile");
    // `--default-transition-duration` and `--default-transition-timing-function`
    // are the two keys that move every untimed transition in three apps onto
    // the scale at once. If they are dropped, this reverts silently.
    assert.match(
      css,
      /--default-transition-duration:\s*180ms/,
      "the default transition duration is no longer the scale's `quick` step",
    );
    assert.match(
      css,
      /--default-transition-timing-function:\s*cubic-bezier\(0\.22, 1, 0\.36, 1\)/,
      "the default transition curve is no longer the scale's `settle`",
    );
  });

  test("the scale exported by the package is the scale the sheet emits", async () => {
    const { motionMs, easingCurves } = require("@injishi/design-tokens");
    assert.deepEqual(Object.keys(motionMs), ["instant", "quick", "settle", "travel", "arrive"]);
    assert.deepEqual(Object.keys(easingCurves), ["settle", "leave", "move", "spring"]);
    for (const [cls, value] of DURATIONS) {
      assert.equal(`${motionMs[cls.slice("duration-".length)]}ms`, value);
    }
    // No linear curve, on purpose: linear motion is mechanical, and nothing a
    // person feels in this product should move like it.
    for (const curve of Object.values(easingCurves)) {
      assert.equal(curve.length, 4, "a curve is four control points");
    }
  });

  test("a motion class outside the scale emits nothing, which is why this test exists", async () => {
    const css = await compileWith(["duration-settle", "duration-snappy", "animate-whoosh"]);
    assert.ok(ruleBody(css, "duration-settle"), "the control utility must compile");
    assert.equal(
      ruleBody(css, "duration-snappy"),
      null,
      "an undefined duration compiles to no rule rather than an error — that silence is the failure mode",
    );
    assert.equal(ruleBody(css, "animate-whoosh"), null, "an undefined animation compiles to no rule");
  });
});
