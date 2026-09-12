/**
 * The planted controls for the four design lint rules.
 *
 * ADR-034 task 5's acceptance criterion is *"each rule fails on a planted
 * control violation and passes on the clean tree"*, and this file is the first
 * half of it — the second half is `pnpm lint` being green across web, app and
 * mobile.
 *
 * A control matters more here than for most rules. These four were written once
 * before, in a repository that no longer exists, and what this checkout
 * inherited was the DOCUMENTS claiming they ran. `ui-rules.md` and
 * `progress-tracker.md` both said `apps/web` failed the build on a raw colour
 * class; it did not, and nothing noticed for months, because a rule that does
 * not exist and a rule that finds nothing look identical from the outside. So
 * every rule below is asserted in both directions: it fires on the violation
 * ADR-034's Verify section plants, and it stays silent on the shapes the ADRs
 * explicitly allow.
 *
 * The allowed shapes carry as much weight as the refusals. ADR-028 built the
 * blunt version of `ground-foreground-agreement` first, and it flagged ten
 * sites of which six were correct code — *"a rule that fails the build on
 * correct code is a rule the team turns off, and that takes the cases that do
 * matter down with it."* The `valid` cases below are that lesson, pinned.
 *
 * WHY THIS FILE LIVES IN apps/web. The plugin serves three apps and belongs to
 * none of them, and `tools/` is not a workspace package with a test runner.
 * `apps/web` is the plugin's oldest consumer, already runs `node --test`, and
 * already resolves `eslint`. RuleTester is pure — it parses source strings and
 * never touches the app — so the four mobile-shaped cases run correctly here
 * too. Move this the day `tools/` becomes a package of its own.
 *
 * Run: pnpm --filter @injishi/web test
 */
import { describe, test } from "node:test";
import { RuleTester } from "eslint";
import tsParser from "@typescript-eslint/parser";

import groundForegroundAgreement from "../../../tools/eslint-rules/ground-foreground-agreement.mjs";
import noArbitraryTypeScale from "../../../tools/eslint-rules/no-arbitrary-type-scale.mjs";
import noArbitraryWidth from "../../../tools/eslint-rules/no-arbitrary-width.mjs";
import noRawColorClasses from "../../../tools/eslint-rules/no-raw-color-classes.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

describe("injishi/no-raw-color-classes", () => {
  test("refuses a ramp step, a hex literal and a raw ramp variable", () => {
    ruleTester.run("no-raw-color-classes", noRawColorClasses, {
      valid: [
        // Roles, which is the whole point.
        `const a = <div className="bg-accent text-accent-foreground" />;`,
        `const b = <div className="bg-card text-muted-foreground border-border" />;`,
        // A role name that merely contains a number is not a ramp step.
        `const c = <div className="text-2xs gap-2 py-16" />;`,
        // An anchor is not a colour. This is the case that makes the
        // short-hex check whole-string only.
        `const d = <a href="#faq">FAQ</a>;`,
        // The accent role reached by variable is fine; only the RAMPS are not.
        `const e = <div style={{ background: "var(--accent)" }} />;`,
      ],
      invalid: [
        {
          // ADR-034 Verify plants exactly this.
          code: `const a = <div className="bg-blue-600" />;`,
          errors: [{ messageId: "rampClass" }],
        },
        {
          // The kept Injishi ramps compile, which is why they are in the list.
          code: `const b = <div className="bg-green-800 text-green-300" />;`,
          errors: [{ messageId: "rampClass" }, { messageId: "rampClass" }],
        },
        {
          // The defect ADR-027 §2 names: no className audit finds this.
          code: `const c = <div style={{ background: "linear-gradient(140deg, var(--green-400), var(--green-600))" }} />;`,
          errors: [{ messageId: "rampVar" }],
        },
        {
          // The mobile half. Same rule, no class names involved.
          code: `const styles = { dot: { backgroundColor: '#0DA1B2' } };`,
          errors: [{ messageId: "hexLiteral" }],
        },
        {
          code: `const tint = '#fff';`,
          errors: [{ messageId: "hexLiteral" }],
        },
      ],
    });
  });

  test("allowHexIn carries the one place hex legitimately lives", () => {
    ruleTester.run("no-raw-color-classes", noRawColorClasses, {
      valid: [
        {
          code: `export const onPhoto = '#FFFFFF';`,
          filename: "/repo/apps/mobile/src/theme/tokens.ts",
          options: [{ allowHexIn: ["/src/theme/"] }],
        },
      ],
      invalid: [
        {
          code: `export const onPhoto = '#FFFFFF';`,
          filename: "/repo/apps/mobile/src/screens/guest/listing-detail.tsx",
          options: [{ allowHexIn: ["/src/theme/"] }],
          errors: [{ messageId: "hexLiteral" }],
        },
      ],
    });
  });
});

describe("injishi/no-arbitrary-type-scale", () => {
  test("refuses a hand-typed size on both surfaces", () => {
    ruleTester.run("no-arbitrary-type-scale", noArbitraryTypeScale, {
      valid: [
        `const a = <p className="text-sm" />;`,
        `const b = <p className="text-2xs uppercase tracking-widest" />;`,
        `const c = <h1 className="text-display-lg" />;`,
        // A glyph size is not a type step: a 20px icon beside 16px text is a
        // deliberate optical match, not an off-scale heading.
        `const d = <Icon name="heart" size={20} />;`,
        `const e = <Feather name="check" size={16} />;`,
        // The token form, which is what the codemod produces.
        `const f = <Text size="sm">Rent</Text>;`,
      ],
      invalid: [
        {
          // ADR-034 Verify plants exactly this.
          code: `const a = <p className="text-[13px]" />;`,
          errors: [{ messageId: "arbitrary", data: { actual: "text-[13px]", step: "sm" } }],
        },
        {
          // Inside a template literal — the half a className-only rule misses.
          code: "const b = <p className={`rounded-card ${tone} text-[44px]`} />;",
          errors: [{ messageId: "arbitrary" }],
        },
        {
          // The mobile half, 745 of these before the codemod.
          code: `const c = <Text size={13}>Rent due</Text>;`,
          errors: [{ messageId: "numericSize" }],
        },
        {
          code: `const styles = StyleSheet.create({ label: { fontSize: 15 } });`,
          errors: [{ messageId: "numericFontSize" }],
        },
      ],
    });
  });
});

describe("injishi/no-arbitrary-width", () => {
  test("refuses both the hand-typed and the stock width", () => {
    ruleTester.run("no-arbitrary-width", noArbitraryWidth, {
      valid: [
        `const a = <div className="max-w-page" />;`,
        `const b = <div className="max-w-tile" />;`,
        // Reading measures: a line length is a different question.
        `const c = <p className="max-w-prose" />;`,
        `const d = <p className="max-w-[46ch]" />;`,
        // Relationships: they describe behaviour rather than pick a value.
        `const e = <div className="max-w-[90vw]" />;`,
        `const f = <div className="max-w-[min(920px,calc(100vw-3rem))]" />;`,
        `const g = <div className="max-w-none max-w-full" />;`,
        // The Tailwind 4 paren form for a raw variable.
        `const h = <div className="max-w-(--container-page)" />;`,
        // Not in scope, deliberately: a fixed-size element is not a page width.
        `const i = <div className="w-[220px]" />;`,
      ],
      invalid: [
        {
          // ADR-034 Verify plants exactly this.
          code: `const a = <div className="max-w-3xl" />;`,
          errors: [{ messageId: "stock", data: { actual: "max-w-3xl", name: "wide" } }],
        },
        {
          code: `const b = <div className="max-w-[760px]" />;`,
          errors: [{ messageId: "arbitrary" }],
        },
        {
          // The v3 spelling fails SILENTLY on 4.3.2, which is why it is refused
          // rather than treated as a variable reference.
          code: `const c = <div className="max-w-[--container-page]" />;`,
          errors: [{ messageId: "bracketVariable" }],
        },
      ],
    });
  });
});

describe("injishi/ground-foreground-agreement", () => {
  test("refuses the mirror case and the shapes that strand a foreground", () => {
    ruleTester.run("ground-foreground-agreement", groundForegroundAgreement, {
      valid: [
        // A fixed ground with ordinary roles inside it. The pin does the work.
        `const a = <section className="bg-canvas"><p className="text-muted-foreground" /></section>;`,
        // A theme-following ground with theme-following foregrounds.
        `const b = <article className="bg-card text-card-foreground border-border" />;`,
        // ADR-028 §7: accent carries the same value in both blocks, read from
        // the tokens rather than named here, so this pair is stable.
        `const c = <span className="bg-accent text-white" />;`,
        // §5a allowed shape 1: the same half is present unprefixed too.
        `const d = <button className="bg-white hover:bg-white" />;`,
        `const e = <button className="bg-canvas hover:bg-white" />;`,
        // §5a allowed shape 2: a fixed pair under the same variant.
        `const f = <button className="hover:bg-ink hover:text-white" />;`,
        // §5a allowed shape 3: nothing is drawn on it.
        `const g = <div className="[&_[data-dot]]:bg-white" />;`,
        // §5a allowed shape 2 under a THEME variant, which is where §5 and §5a
        // meet. `theme-pill.tsx` paints its active segment with `dark:` rather
        // than React state so the pill is right on the first paint; the pair is
        // fixed on both halves, so nothing is stranded.
        `const t = <button className="bg-transparent text-white/40 dark:bg-white/10 dark:text-white" />;`,
        // `ground-theme` where it belongs: nested, not on the ground.
        `const h = <aside className="ground-theme bg-card text-card-foreground" />;`,
        // Out of scope by design, and ADR-028 accepts the hole explicitly.
        `const i = <div className={tone} />;`,
      ],
      invalid: [
        {
          // ADR-034 Verify plants exactly this.
          code: `const a = <div className="bg-card text-ink" />;`,
          errors: [{ messageId: "mirror" }],
        },
        {
          // §5: a theme variant redefines what `canvas` means at one call site.
          code: `const b = <section className="bg-canvas dark:bg-black" />;`,
          errors: [{ messageId: "themeVariant" }],
        },
        {
          // §5a: flips to the other fixed half while the pin stays put.
          code: `const c = <div className="bg-white md:bg-ink" />;`,
          errors: [{ messageId: "strandedFlip" }],
        },
        {
          // §5a: the live gallery-arrow shape — invisible in dark mode, on
          // hover only.
          code: `const d = <button className="bg-card hover:bg-canvas text-foreground" />;`,
          errors: [{ messageId: "strandedFollowing" }],
        },
        {
          // §4a: reads like a careful annotation, cancels what it annotates.
          code: `const e = <section className="bg-ink ground-theme" />;`,
          errors: [{ messageId: "groundThemeOnGround" }],
        },
        {
          // Seen through `cn()`, which is how this codebase writes classes.
          code: `const f = <div className={cn("bg-popover", "text-white")} />;`,
          errors: [{ messageId: "mirror" }],
        },
      ],
    });
  });
});
