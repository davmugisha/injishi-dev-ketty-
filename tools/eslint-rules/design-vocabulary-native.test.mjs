/**
 * Tests for the `native` halves of the five design vocabulary rules (mobile
 * spec 0002, D-z, AC-18): each refuses its planted violation and stays silent
 * on the shapes the kit is built from.
 *
 * Run from the repository root:
 *   node --test tools/eslint-rules/design-vocabulary-native.test.mjs
 *
 * `tools/eslint-rules` has no package of its own, so ESLint and the TypeScript
 * parser are resolved through `apps/mobile`, the app these halves are for. The
 * allowed shapes carry as much weight as the refusals, for the reason the web
 * rules' tests give: a rule that fails on correct code is a rule the team turns
 * off.
 */
import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

import groundForegroundAgreement from './ground-foreground-agreement.mjs';
import { GROUND_PAIRS, NATIVE_COLOURS, TONE_ROLES } from './native-vocabulary.mjs';
import noArbitraryMotion from './no-arbitrary-motion.mjs';
import noArbitraryTypeScale from './no-arbitrary-type-scale.mjs';
import noArbitraryWidth from './no-arbitrary-width.mjs';
import { surfaceVocabulary } from './surface-vocabulary.mjs';

const mobile = new URL('../../apps/mobile/', import.meta.url);
const requireFromMobile = createRequire(new URL('package.json', mobile));
const { RuleTester } = requireFromMobile('eslint');
const tsParser = requireFromMobile('@typescript-eslint/parser');

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const native = [{ native: true }];
const KIT = '/repo/apps/mobile/src/components/ui/sample.tsx';
const SCREEN = '/repo/apps/mobile/src/features/staff/sample.tsx';
const kit = (code) => ({ code, options: native, filename: KIT });
const screen = (code) => ({ code, options: native, filename: SCREEN });
const ui = `import { Icon, Text } from "@/components/ui";\nimport { View } from "react-native";\n`;

tester.run('no-arbitrary-type-scale (native)', noArbitraryTypeScale, {
  valid: [
    kit(`const a = <Text role="body" tone="muted">Rent</Text>;`),
    // Colour, alignment and weight are not sizes.
    kit(`const b = <Text role="caption" className="text-center text-foreground font-semibold" />;`),
    // A glyph size is not a type step.
    kit(`const c = <Icon name="House" size={20} />;`),
    // The type table's own file is where a role becomes a `fontSize`.
    {
      code: `const s = { fontSize: rnFontSize.md, lineHeight: rnLineHeight.md };`,
      options: native,
      filename: '/repo/apps/mobile/src/components/ui/text.tsx',
    },
    // Destructuring names a key, it sets nothing.
    kit(`const { fontSize } = style;`),
  ],
  invalid: [
    { ...kit(`const a = <Text className="text-[13px]" />;`), errors: [{ messageId: 'nativeClass', data: { actual: 'text-[13px]', role: 'callout' } }] },
    { ...kit(`const b = <View className="text-sm" />;`), errors: [{ messageId: 'nativeClass', data: { actual: 'text-sm', role: 'callout' } }] },
    // Tailwind's 2xl is 24, between the phone's 22 and 28.
    { ...screen('const c = `font-bold ${x} text-2xl`;'), errors: [{ messageId: 'nativeClass', data: { actual: 'text-2xl', role: 'title2' } }] },
    { ...kit(`const d = StyleSheet.create({ l: { fontSize: 15 } });`), errors: [{ messageId: 'nativeFontSize', data: { textFile: 'src/components/ui/text.tsx', role: 'body' } }] },
    // Even a token: a step read without its role ships no leading.
    { ...kit(`const e = { fontSize: rnFontSize.lg };`), errors: [{ messageId: 'nativeFontSize', data: { textFile: 'src/components/ui/text.tsx', role: 'title3' } }] },
  ],
});

tester.run('no-arbitrary-motion (native)', noArbitraryMotion, {
  valid: [
    kit(`withTiming(1, { duration: motionMs.quick, easing: Easing.bezier(...easingCurves.settle) });`),
    // Arithmetic on a step is idiomatic.
    kit(`withTiming(1, { duration: motionMs.travel / 2 });`),
    // Off is a decision, not a value.
    kit(`withTiming(0, { duration: 0 });`),
    // Control points read from a named curve.
    kit(`const [x1, y1, x2, y2] = easingCurves[curve]; Easing.bezier(x1, y1, x2, y2);`),
    // Not a layout animation builder.
    kit(`const d = dayjs.duration(3, "d");`),
    // A dwell named beside its use.
    kit(`const TOAST_STAY_MS = 4000; toast.show({ duration: TOAST_STAY_MS });`),
    kit(`const a = <View className="duration-0" />;`),
  ],
  invalid: [
    { ...kit(`withTiming(1, { duration: 300 });`), errors: [{ messageId: 'nativeDuration', data: { actual: '300', step: 'travel' } }] },
    { ...kit(`const e = FadeIn.duration(250).delay(50);`), errors: [{ messageId: 'nativeDuration' }] },
    { ...kit(`Animated.timing(v, { toValue: 1, duration: "0.2s" });`), errors: [{ messageId: 'nativeDuration', data: { actual: '"0.2s"', step: 'quick' } }] },
    // One stock curve, one report.
    { ...kit(`withTiming(1, { easing: Easing.inOut(Easing.quad) });`), errors: [{ messageId: 'nativeEasing', data: { actual: 'Easing.inOut(Easing.quad)', curve: 'move' } }] },
    { ...kit(`const c = Easing.linear;`), errors: [{ messageId: 'nativeEasing', data: { actual: 'Easing.linear', curve: 'move' } }] },
    { ...kit(`const c = Easing.bezier(0.2, 0, 0, 1);`), errors: [{ messageId: 'nativeEasing' }] },
    { ...kit(`const t = { transitionTimingFunction: "ease-in-out" };`), errors: [{ messageId: 'nativeEasing', data: { actual: 'ease-in-out', curve: 'move' } }] },
    { ...kit(`withSpring(1, { damping: 12 });`), errors: [{ messageId: 'nativeSpring' }] },
    { ...screen(`const a = <View className="transition-opacity duration-300 ease-out" />;`), errors: [{ messageId: 'nativeClass' }, { messageId: 'nativeClass' }] },
  ],
});

tester.run('no-arbitrary-width (native)', noArbitraryWidth, {
  valid: [
    // Grid steps, which equal `rnSpace`, and relationships.
    kit(`const a = <View className="w-12 h-0.5 size-10 min-h-11 w-[31%] max-w-[82%] w-[calc(100%-2rem)]" />;`),
    kit(`const b = <View style={{ width: metrics.iconButton, height: rnSpace[10], minHeight: metrics.touch }} />;`),
    kit(`const c = <Image style={{ width: "100%", height: "100%" }} />;`),
    kit(`const d = <View style={{ height: 0 }} />;`),
    // The kit's own names live in `metrics.ts`.
    { code: `export const metrics = { width: 48 };`, options: native, filename: '/repo/apps/mobile/src/components/ui/metrics.ts' },
    // Page widths are the web half's; the phone has none.
    kit(`const e = <View className="max-w-2xl" />;`),
  ],
  invalid: [
    { ...kit(`const a = <View className="w-[88px]" />;`), errors: [{ messageId: 'nativeClass', data: { actual: 'w-[88px]', fix: 'It sits on the 4 px grid: write `w-22`.' } }] },
    { ...screen(`const b = <View className="min-h-[52px] size-[46px]" />;`), errors: [{ messageId: 'nativeClass' }, { messageId: 'nativeClass', data: { actual: 'size-[46px]', fix: 'Name it in `src/components/ui/metrics.ts` and set it from there.' } }] },
    { ...kit(`const c = <View style={{ width: 50, height: 40 }} />;`), errors: [{ messageId: 'nativeStyle', data: { key: 'width', actual: '50', fix: 'Name it in `src/components/ui/metrics.ts`.' } }, { messageId: 'nativeStyle', data: { key: 'height', actual: '40', fix: 'It is a grid step: `rnSpace[10]`.' } }] },
  ],
});

tester.run('surface-vocabulary (native)', surfaceVocabulary, {
  valid: [
    kit(`const a = <View className="bg-surface rounded-lg" />;`),
    kit(`const b = <View className="bg-accent-soft bg-success-soft bg-info-soft bg-default-soft bg-field bg-segment" />;`),
    // The kit's press layer, the scrim, and no ground at all.
    kit(`const c = <View className="absolute inset-0 bg-pressed bg-backdrop bg-transparent" />;`),
    kit(`const d = <View className="active:bg-surface-secondary dark:bg-surface-tertiary" />;`),
    // A corner and a hand typed size are not this half's.
    kit(`const e = <View className="rounded-3xl text-[13px]" />;`),
  ],
  invalid: [
    { ...kit(`const a = <View className="bg-muted" />;`), errors: [{ messageId: 'nativeGround' }] },
    { ...screen(`const b = <View className="absolute bg-foreground/75" />;`), errors: [{ messageId: 'nativeGround' }] },
    { ...kit(`const c = <View className="bg-accent/10" />;`), errors: [{ messageId: 'nativeOpacity', data: { cls: 'bg-accent/10', fix: '`bg-accent-soft`, its soft fill' } }] },
    { ...kit(`const d = <View className="bg-white" />;`), errors: [{ messageId: 'nativeGround' }] },
    // A text role painted as a fill.
    { ...kit(`const e = { root: "bg-info" };`), errors: [{ messageId: 'nativeGround' }] },
  ],
});

tester.run('ground-foreground-agreement (native)', groundForegroundAgreement, {
  valid: [
    kit(`${ui}const a = <View className="bg-accent"><Text role="body" tone="onAccent">Go</Text></View>;`),
    // A neutral ground carries the tones.
    kit(`${ui}const b = <View className="bg-surface"><Text role="body" tone="danger">Late</Text><Icon name="House" tone="muted" /></View>;`),
    kit(`${ui}const c = <View className="rounded-xl bg-surface-secondary p-4"><Text role="headline">Title</Text></View>;`),
    // `bg-default`'s label is one rounding from `foreground`, the same ink.
    kit(`${ui}const d = <View className="bg-default"><Text role="body">Draft</Text></View>;`),
    // A switch with its label switching beside it.
    kit(`${ui}const e = <View className={on ? "bg-accent" : "bg-default"}><Text role="body" className={on ? "text-accent-foreground" : "text-foreground"}>x</Text></View>;`),
    kit(`const f = <Text className={\`px-2 \${on ? "bg-accent text-accent-foreground" : "bg-default text-default-foreground"}\`}>x</Text>;`),
    // The walk stops at a component, which may paint its own ground.
    kit(`${ui}const g = <View className="bg-accent"><Card><Text role="body">x</Text></Card></View>;`),
    // ...at a tone it cannot read, and at a nested fill.
    kit(`${ui}const h = <View className="bg-accent"><Text role="body" tone={tone}>x</Text><View className="bg-foreground/75"><Text role="body">x</Text></View></View>;`),
    kit(`const i = { root: "bg-info-soft", label: "text-info-soft-foreground", role: "info-soft-foreground" };`),
    // A map with a ground per entry is a map of alternatives, not one element's parts.
    kit(`const j = { success: "bg-success-soft text-success-soft-foreground", danger: "bg-danger-soft", muted: "text-muted" };`),
    kit(`${ui}const k = <View className="bg-separator h-px" />;`),
  ],
  invalid: [
    // The default tone is `foreground`.
    {
      ...kit(`${ui}const a = <View className="bg-accent"><Text role="body">Go</Text></View>;`),
      errors: [{ messageId: 'nativePair', data: { fg: 'The default tone (`text-foreground`)', bg: 'bg-accent', allowed: '`text-accent-foreground`' } }],
    },
    { ...kit(`const b = <Text className="bg-success-soft text-success">Done</Text>;`), errors: [{ messageId: 'nativePair' }] },
    // Through React Native's boxes and a `.map`.
    {
      ...screen(`${ui}const c = <View className="bg-accent-soft"><View>{xs.map((x) => <Text role="body" className="text-foreground">{x}</Text>)}</View></View>;`),
      errors: [{ messageId: 'nativePair' }],
    },
    { ...kit(`${ui}const d = <View className="bg-surface"><Icon name="House" tone="onAccent" /></View>;`), errors: [{ messageId: 'nativePair' }] },
    { ...kit(`const e = { root: "bg-info-soft", label: "text-info" };`), errors: [{ messageId: 'nativePair' }] },
    // A ground that switches over a label that does not: wrong in the accent state.
    { ...kit(`const f = <Text className={\`\${on ? "bg-accent" : "bg-default"} text-foreground\`}>x</Text>;`), errors: [{ messageId: 'nativePair' }] },
    // A variant ground against its own variant's text.
    { ...kit(`const g = <Text className="bg-default text-default-foreground active:bg-accent active:text-muted">x</Text>;`), errors: [{ messageId: 'nativePair' }] },
  ],
});

describe('native vocabulary drift', () => {
  it('reads the same tones as the kit', () => {
    const text = readFileSync(new URL('src/components/ui/text.tsx', mobile), 'utf8');
    const block = /export const toneRoles = \{([^}]*)\}/.exec(text)?.[1];
    assert.ok(block, 'toneRoles not found in text.tsx');
    const kit = Object.fromEntries([...block.matchAll(/(\w+):\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]));
    assert.deepEqual(kit, TONE_ROLES);
  });

  it('knows every colour and ground the installed HeroUI Native defines', () => {
    const pnpm = new URL('../../node_modules/.pnpm/', import.meta.url);
    const dir = readdirSync(pnpm).find((d) => d.startsWith('heroui-native@'));
    assert.ok(dir, 'heroui-native is not installed');
    const styles = new URL(`${dir}/node_modules/heroui-native/lib/module/styles/`, pnpm);
    const theme = readFileSync(new URL('theme.css', styles), 'utf8');
    for (const [, name] of theme.matchAll(/--color-([a-z0-9-]+)\s*:/g)) {
      assert.ok(NATIVE_COLOURS.has(name), `--color-${name} is missing from native-vocabulary.mjs`);
    }
    const components = new URL('components/', styles);
    for (const file of readdirSync(components)) {
      const css = readFileSync(new URL(file, components), 'utf8');
      for (const [, name] of css.matchAll(/background-color: var\(--color-([a-z0-9-]+)\)/g)) {
        if (name === 'accent-foreground' || name === 'field-placeholder') continue; // marks, not grounds
        assert.ok(GROUND_PAIRS.has(name), `${file} paints bg-${name}, missing from the grounds`);
      }
    }
  });
});
