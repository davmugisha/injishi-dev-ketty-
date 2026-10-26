/**
 * Generate the build-time Tailwind entry for the injishi-runtime screens.
 *
 * The signed-in screens — the Personal surface and the five entry screens, one
 * `(app)` group since ADR-021 — used to compile Tailwind in the browser at
 * runtime: every page loaded shared/vendor/tailwind-browser.js
 * (276 KB) plus shared/js/injishi-theme.js (the @theme token layer), and a FOUC
 * cloak hid <body> until the compiler finished (up to 3 s of blank on a cold
 * load). This replaces that with a real stylesheet compiled at build time by
 * @tailwindcss/postcss (see postcss.config.mjs), imported once in that group's
 * root layout.
 *
 * The token layer (`:root`, `.dark`, `@theme inline`, base + component layers)
 * is the SAME source of truth the runtime path used — it is extracted verbatim
 * from shared/js/injishi-theme.js here, so build-time and (marketing) runtime
 * Tailwind can never drift. The only thing added is the `@import "tailwindcss"`
 * entry and the `@source` globs that tell the compiler where the class names
 * live: the one runtime route group — `@source "./(app)"` recurses into its
 * nested `(shell)` and `(entry)` groups — plus the component directories those
 * screens import from.
 *
 * Output: src/app/_injishi-app.css (committed, machine-generated).
 * Run via `pnpm --filter @injishi/web css:app` or as part of `pnpm regen`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "..");
const themeJs = path.join(appRoot, "public", "shared", "js", "injishi-theme.js");
const outFile = path.join(appRoot, "src", "app", "_injishi-app.css");

// ---- extract the token CSS from injishi-theme.js -------------------------
// The file builds its CSS as `var css = [ '...', '...', ... ].join('\n');`.
const src = fs.readFileSync(themeJs, "utf8");
const m = src.match(/var\s+css\s*=\s*\[([\s\S]*?)\]\s*\.join\(/);
if (!m) {
  throw new Error(
    "gen-app-css: could not locate the `var css = [ ... ].join(` token array in injishi-theme.js",
  );
}
// The array body is a list of single-quoted JS string literals — evaluate it in
// a sandboxed Function (trusted, in-repo build input) and join as the runtime does.
const tokenCss = new Function(`return [${m[1]}]`)().join("\n");

// ---- app-shell CSS ---------------------------------------------------------
// The sidebar's own styling (#sidebar, .nav-item, .sb-switch, .sb-cta, the
// collapsed-state rules). These used to be a JS string array inside
// injishi-web-shell.js, injected into <head> at runtime, and were extracted here
// so the server-rendered sidebar would not flash unstyled. The shell is real
// React now (components/app/AppShell.tsx) and that JS is deleted, so the rules
// are hand-owned in a real stylesheet and simply inlined.
const shellCssFile = path.join(appRoot, "src", "app", "_app-shell.css");
const shellCss = fs.readFileSync(shellCssFile, "utf8");

// ---- compose the Tailwind v4 entry ---------------------------------------
const header = `/* AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Generator: scripts/gen-app-css.mjs (pnpm --filter @injishi/web css:app).
 * Token layer extracted verbatim from public/shared/js/injishi-theme.js — edit
 * tokens there (or via pnpm tokens:sync), then regenerate. Compiled at build
 * time by @tailwindcss/postcss and imported in the one (app) root layout,
 * replacing the runtime shared/vendor/tailwind-browser.js path. */`;

// source(none) disables Tailwind's automatic file detection so the marketing
// route groups (which ship their own captured CSS) never leak classes in here;
// the explicit @source globs below are the complete input surface. Paths are
// relative to this CSS file (src/app/).
const sources = [
  // Recurses into the nested (shell) and (entry) groups, so this ONE glob is
  // the whole signed-in layer (ADR-021). The former ./(auth) and ./(onboarding)
  // globs went with the groups they named.
  '@source "./(app)";',
  // The shell's Tailwind classes now live in real components, not in the JS
  // string builders. Paren-free path: Tailwind's scanner treats the parens in
  // "(app)" as glob metacharacters, so a components dir is matched reliably.
  '@source "../components/app";',
  // The in-stay panels (/stay, and its desks on /inbox) live here.
  '@source "../components/stay";',
  // The sign-in screens' own components, added with ADR-017 slice 1. The group
  // that held them is `(app)/(entry)` now, but the components directory keeps
  // its name. A class in a directory this list does not scan compiles to
  // nothing, and does it silently: the page renders unstyled and no build step
  // complains.
  '@source "../components/auth";',
  // Components shared between the app layer and the marketplace layer, which
  // is exactly why this glob is easy to forget and expensive to miss: the
  // marketplace stylesheet already scanned them, so `RegistrationStepRail`
  // looked correct on /host/start and rendered as five unstyled bars inside
  // the wizard. Same component, one stylesheet that had never seen its class
  // names. This is the silent-compile failure the note above describes.
  '@source "../components/shared";',
  // `../components/ui` is gone (ADR-036 call 1). The classes that folder used
  // to contribute now come from `@injishi/web-ui/styles.css`, imported below, whose
  // own `@source "./"` resolves relative to the package rather than to the
  // emitted file, so the package's components are scanned wherever it is
  // installed. Emitting the dead glob would be harmless today and a trap the
  // day somebody recreates the folder.
  '@source "../components/icons";',
  // The two vanilla scripts that used to be scanned here are deleted (ADR-017
  // slice 4). Nothing loaded either of them: the register wizard and the site
  // chrome are React now, and their class strings live in the .tsx files the
  // globs above already scan. The one utility that existed ONLY in the deleted
  // JS was `animate-spin`, which no component renders, so nothing lost a class.
].join("\n");

const shellBlock =
  `/* --- app shell styling, inlined from src/app/_app-shell.css (hand-owned).\n` +
  `   Served at build time so the server-rendered sidebar is styled on first paint. --- */\n` +
  `${shellCss}`;

// @injishi/web-ui ships its own stylesheet (@source for its component folder, the
// tw-animate-css import and the two accordion keyframes) so a consumer inherits
// all three from one line instead of rediscovering them (ADR-008). It sits
// directly after the Tailwind entry and before the app's own @source globs.
const packageStyles = '@import "@injishi/web-ui/styles.css";';

// @injishi/ui is the one web library products import (ADR-074 D-l), beside
// web-ui until stage 9. Its stylesheet is only its `@source "./"`, so a class
// used only inside it is generated here too; it carries no theme of its own.
const uiStyles = '@import "@injishi/ui/styles.css";';

// HeroUI 3 ships its component CSS plus a full set of role DEFAULTS. It is an
// @import and therefore has to sit at the top with the others; its defaults are
// overridden further down by the token block below, which is why the ORDER of
// those two matters and why the token block is inlined rather than imported.
const herouiStyles = '@import "@heroui/styles";';

// HeroUI Pro's component layer, straight after HeroUI OSS as Pro requires, and
// the same import the public layer carries (`_injishi-public.css`). Without it
// the signed-in screens drew HeroUI's stock buttons and segments while the
// marketplace one click away drew the Pro "mouve" layer the Injishi design
// system is built on (ADR-068): one product, two button looks. The palette
// still comes from the inlined token block below, which outranks Pro's theme.
const proStyles = '@import "@injishi/web-ui/pro.css";';

// The HeroUI palette, INLINED rather than imported.
//
// It has to come AFTER the extracted `tokenCss`, because both define
// `--background`, `--accent`, `--card` and a dozen more at the same
// specificity, and the later one wins. An @import cannot go there: CSS requires
// every @import to precede the rules. So the file is read and pasted.
//
// The extracted block is NOT stripped. It still owns the two ramps
// (`--ink-*`, `--green-*`) and `--success-text` / `--info-foreground`, which
// the HeroUI vocabulary has no name for and screens in these three groups read.
// What it loses is only the roles HeroUI also names.
const herouiTokensFile = path.join(
  appRoot,
  "node_modules",
  "@injishi",
  "design-tokens",
  "generated",
  "injishi-heroui.css",
);
if (!fs.existsSync(herouiTokensFile)) {
  throw new Error(
    "gen-app-css: @injishi/design-tokens/generated/injishi-heroui.css is missing. " +
      "Run `pnpm --filter @injishi/design-tokens generate:css` first.",
  );
}
const herouiTokens = [
  "/* --- HeroUI palette, inlined from @injishi/design-tokens/heroui.css.",
  "   Inlined, not imported, so it lands AFTER the token block above and wins",
  "   the roles the two share. Regenerate the source with",
  "   `pnpm --filter @injishi/design-tokens generate:css`. --- */",
  fs.readFileSync(herouiTokensFile, "utf8"),
].join(String.fromCharCode(10));

const out =
  `${header}\n@import "tailwindcss" source(none);\n${packageStyles}\n${uiStyles}\n${herouiStyles}\n${proStyles}\n\n${sources}\n\n${tokenCss}\n\n${herouiTokens}\n\n${shellBlock}\n`;
fs.writeFileSync(outFile, out, "utf8");
console.log(
  `gen-app-css -> ${path.relative(appRoot, outFile).replace(/\\/g, "/")} ` +
    `(${tokenCss.split("\n").length} token lines, ${shellCss.split("\n").length} shell lines, ${out.length} bytes)`,
);
