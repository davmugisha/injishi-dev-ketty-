/**
 * The shared checkbox renders something a person can tick (ADR-048 AC-15).
 *
 * WHY THIS FILE EXISTS. HeroUI 3.2's `Checkbox` is only a field wrapper: the
 * clickable part carrying the input is `Checkbox.Content`, and the visible box
 * is `Checkbox.Control`. The `@injishi/ui` wrapper used to pass its children
 * straight to the root, so every `<Checkbox>label</Checkbox>` in this app
 * rendered text inside an empty field. The waitlist's marketing consent could
 * never be given, and the booking and explore checkboxes had no box either.
 * Every unit test stayed green, because none of them rendered it.
 *
 * WHAT IT RUNS. The real wrapper source (`packages/ui/src/components/checkbox.tsx`),
 * transpiled and rendered to static markup with the web app's own React and
 * HeroUI. The one substitution is `cn` from `@injishi/utils`, which ships as
 * TypeScript source Node cannot load; it only joins class names.
 *
 * The transpiled module is written beside this test so its bare imports
 * resolve from `apps/web/node_modules`, and it is deleted afterwards.
 *
 * Run: pnpm --filter @injishi/web test
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

// `@injishi/ui` in this app is `packages/web-ui` (package.json aliases it); the
// old `packages/ui` copy was deleted with the old interface (c1e9a55).
const SOURCE = resolve(here, "../../../packages/web-ui/src/components/checkbox.tsx");
const COMPILED = resolve(here, `.checkbox-under-test-${process.pid}.mjs`);

let Checkbox;
let HeroCheckbox;

before(async () => {
  const src = readFileSync(SOURCE, "utf8");
  assert.match(src, /from "@injishi\/utils"/, "checkbox.tsx no longer imports cn; update the substitution below");
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const runnable = outputText.replace(
    /import\s*\{\s*cn\s*\}\s*from\s*"@injishi\/utils";?/,
    'const cn = (...parts) => parts.filter((p) => typeof p === "string" && p).join(" ");',
  );
  writeFileSync(COMPILED, runnable);
  ({ Checkbox } = await import(pathToFileURL(COMPILED).href));
  ({ Checkbox: HeroCheckbox } = await import("@heroui/react"));
});

after(() => {
  rmSync(COMPILED, { force: true });
});

const render = (props, label = "Also email me occasional updates and offers from Injishi.") =>
  renderToStaticMarkup(React.createElement(Checkbox, props, label));

const inputs = (html) => html.match(/<input[^>]*type="checkbox"[^>]*>/g) ?? [];

describe("the @injishi/ui Checkbox (covers: AC-15)", () => {
  test("renders exactly one checkbox input", () => {
    assert.equal(inputs(render({ isSelected: false, onChange: () => {} })).length, 1);
  });

  test("renders the visible box and its indicator", () => {
    const html = render({ isSelected: false, onChange: () => {} });

    assert.match(html, /data-slot="checkbox-control"/);
    assert.match(html, /data-slot="checkbox-indicator"/);
  });

  test("puts the input and its label text in one label element, so the text toggles the box", () => {
    const html = render({ isSelected: false, onChange: () => {} }, "Tick me");
    const labels = html.match(/<label[\s\S]*?<\/label>/g) ?? [];

    assert.ok(
      labels.some((l) => /type="checkbox"/.test(l) && l.includes("Tick me")),
      `no label holds both the input and its text: ${html}`,
    );
  });

  test("starts unticked when isSelected is false", () => {
    const [input] = inputs(render({ isSelected: false, onChange: () => {} }));

    assert.doesNotMatch(input, /\schecked(=|\s|>|\/)/);
  });

  test("renders ticked when isSelected is true", () => {
    const [input] = inputs(render({ isSelected: true, onChange: () => {} }));

    assert.match(input, /\schecked(=|\s|>|\/)/);
  });

  test("renders disabled when isDisabled is set", () => {
    const [input] = inputs(render({ isDisabled: true }));

    assert.match(input, /\sdisabled(=|\s|>|\/)/);
  });

  test("puts the caller's className on the clickable row", () => {
    const html = render({ className: "flex items-start gap-3" });

    assert.match(html, /data-slot="checkbox-content"[^>]*class="[^"]*flex items-start gap-3/);
  });
});

describe("control: what the bug looked like", () => {
  test("HeroUI's bare Checkbox with plain children renders no input, so the checks above can fail", () => {
    const html = renderToStaticMarkup(React.createElement(HeroCheckbox, { isSelected: false }, "Plain text child"));

    assert.equal(inputs(html).length, 0, `the bare field unexpectedly rendered an input: ${html}`);
    assert.ok(html.includes("Plain text child"));
  });
});
