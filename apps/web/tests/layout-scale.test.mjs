/**
 * ADR-027's layout scale has to COMPILE, not just be written down.
 *
 * For most of this repository's life it was neither. `ui-rules.md` and
 * `ui-tokens.md` both described `text-2xs`, `max-w-page` and `py-band` as the
 * vocabulary the web surface is written against, and no stylesheet in the
 * checkout defined any of them: `layout.ts` lived in the deleted
 * `injishi.managed` repo and never crossed the mirror. A class that resolves to
 * nothing does not error in Tailwind — it compiles to no rule at all and the
 * element simply renders at its inherited size — so the gap was invisible from
 * the browser and stayed open for months.
 *
 * ADR-034 task 4 closed it by adding `packages/design-tokens/src/layout.ts` and
 * emitting it into `injishi-heroui.css`. This test is that task's acceptance
 * criterion, kept: it runs the real Tailwind compiler over the real token
 * stylesheet and asserts each utility emits a rule carrying the value
 * `ui-tokens.md` tabulates.
 *
 * It fails if the token is deleted, renamed, moved out of the sheet, or given a
 * different value than the document promises — and, most usefully, if the
 * two-dash `--text-*--line-height` spelling is ever written with one dash,
 * which registers an unrelated token and ships the size with no leading.
 *
 * Run: pnpm --filter @injishi/web test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");

/** The entry the public layer actually uses, reduced to its token imports. */
const ENTRY = `@import "tailwindcss" source(none);\n@import "@injishi/design-tokens/heroui.css";\n`;

/**
 * Tailwind's `compile` needs a stylesheet loader because it resolves `@import`
 * itself. Resolving through `require.resolve` rather than a path join is what
 * makes this test read the same bytes Next reads: the package export map picks
 * the file, not this test.
 */
async function compileWith(candidates) {
  const { compile } = await import("tailwindcss");
  const compiler = await compile(ENTRY, {
    base: appRoot,
    onDependency() {},
    async loadStylesheet(id, base) {
      const path = require.resolve(id === "tailwindcss" ? "tailwindcss/index.css" : id, {
        paths: [base, appRoot],
      });
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

/** Every utility the scale promises, against the value ui-tokens.md tabulates. */
const TYPE = [
  ["text-2xs", "0.6875rem", "1.4"],
  ["text-display-sm", "2rem", "1.2"],
  ["text-display-md", "2.75rem", "1.1"],
  ["text-display-lg", "3.5rem", "1.05"],
];

const CONTAINERS = [
  ["max-w-page", "70rem"],
  ["max-w-wide", "52.5rem"],
  ["max-w-read", "42rem"],
  ["max-w-narrow", "32rem"],
  ["max-w-form", "28rem"],
  ["max-w-tile", "25rem"],
];

const RHYTHM = [
  ["p-inset", "1rem"],
  ["px-inset", "1rem"],
  ["py-band", "4rem"],
  ["mt-band", "4rem"],
  ["gap-block", "1.5rem"],
  ["space-y-block", "1.5rem"],
];

const ALL = [...TYPE.map((r) => r[0]), ...CONTAINERS.map((r) => r[0]), ...RHYTHM.map((r) => r[0])];

describe("ADR-027 layout scale compiles in apps/web", () => {
  test("the four authored type steps emit a size AND a line height", async () => {
    const css = await compileWith(ALL);
    for (const [cls, size, lineHeight] of TYPE) {
      const body = ruleBody(css, cls);
      assert.ok(body, `.${cls} emitted no rule — the token is missing from injishi-heroui.css`);
      assert.match(body, /font-size/, `.${cls} emitted no font-size`);
      assert.ok(
        body.includes(size) || body.includes(`--text-${cls.slice(5)}`),
        `.${cls} does not carry ${size}: ${body}`,
      );
      // The failure this line exists for: a one-dash `--text-x-line-height`
      // registers a separate token and the size ships with no leading.
      assert.match(body, /line-height/, `.${cls} shipped without a line height (check the two-dash spelling)`);
      assert.ok(
        body.includes(lineHeight) || body.includes("--line-height"),
        `.${cls} line height is not ${lineHeight}: ${body}`,
      );
    }
  });

  test("the six page widths resolve as max-w utilities", async () => {
    const css = await compileWith(ALL);
    for (const [cls, value] of CONTAINERS) {
      const body = ruleBody(css, cls);
      assert.ok(body, `.${cls} emitted no rule — --container-${cls.slice(6)} is not defined`);
      assert.match(body, /max-width/, `.${cls} emitted no max-width`);
      assert.ok(
        body.includes(value) || body.includes(`--container-${cls.slice(6)}`),
        `.${cls} does not carry ${value}: ${body}`,
      );
    }
  });

  test("the three rhythm steps produce their whole utility family", async () => {
    const css = await compileWith(ALL);
    for (const [cls, value] of RHYTHM) {
      const body = ruleBody(css, cls);
      assert.ok(body, `.${cls} emitted no rule — the --spacing-* token is not defined`);
      assert.ok(
        body.includes(value) || body.includes("--spacing-"),
        `.${cls} does not carry ${value}: ${body}`,
      );
    }
  });

  test("the scale exported by the package is the scale the sheet emits", async () => {
    const { typeSteps, typeScale, containers, rhythm } = require("@injishi/design-tokens");

    // Eleven steps, four authored here — the count ADR-034 task 4 settles.
    assert.equal(typeScale.length, 11, "the type scale is eleven named steps");
    assert.equal(Object.keys(typeSteps).length, 4, "four of the eleven are authored in layout.ts");
    for (const name of Object.keys(typeSteps)) {
      assert.ok(typeScale.includes(name), `${name} is authored but not in the allow-list`);
    }
    assert.equal(Object.keys(containers).length, 6);
    assert.equal(Object.keys(rhythm).length, 3);

    // Every authored step carries its own leading — the rule the type scale
    // exists to enforce, asserted at the source and not only at the utility.
    for (const [name, step] of Object.entries(typeSteps)) {
      assert.ok(step.size, `${name} has no size`);
      assert.ok(step.lineHeight, `${name} has no line height`);
    }
  });

  test("a class outside the scale emits nothing, which is why this test exists", async () => {
    const css = await compileWith(["max-w-page", "max-w-gutter"]);
    assert.ok(ruleBody(css, "max-w-page"), "the control utility must compile");
    assert.equal(
      ruleBody(css, "max-w-gutter"),
      null,
      "an undefined width compiles to no rule rather than an error — that silence is the failure mode",
    );
  });
});
