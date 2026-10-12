import tsParser from '@typescript-eslint/parser';

import injishi from '../../tools/eslint-rules/index.mjs';

/**
 * Lint for the Expo app.
 *
 * This app had no ESLint config at all, which is why `AGENTS.md` had to say the
 * kebab-case rule "cannot reach `apps/admin` or `apps/mobile` because neither
 * has an ESLint config". A naming standard that is enforced in two of the four
 * apps is a naming standard that drifts in the other two, and a case-only
 * difference resolves on Windows and 404s on Linux CI — so the gap was the kind
 * of silent failure the rule exists for.
 *
 * Narrower than `apps/web` on purpose:
 *
 *   - No `@next/eslint-plugin-next`. This is React Native, not Next.
 *
 * ADR-034 task 5 added the two design rules that have a React Native shape.
 * This is the first time any design rule has reached this app: the four were
 * written against `apps/web` in a repository that was deleted, and
 * `parity.md` §5 measured what that cost here — 757 hand-typed type sizes and
 * 27 hex literals, with nothing to stop either.
 *
 * Both source roots are linted. `app/` is Expo Router's file-based routing and
 * `src/` is everything else; the rule's bracket exemption is what lets `app/`
 * keep its `[id].tsx` route files.
 */

/**
 * ADR-063 invariant 1. Every privacy rule for crash reports lives in
 * `src/lib/crash-reporter.ts`: the allowlist, the scrubber, the switch. A
 * second importer of the SDK could set a user, attach a screenshot or send an
 * event around all three, so the SDK has exactly one importer. Type imports are
 * refused too: the reporter re-exports what callers need.
 */
const SENTRY_ONLY_IN_THE_REPORTER = {
  name: '@sentry/react-native',
  message:
    'Only src/lib/crash-reporter.ts may import the Sentry SDK (ADR-063). Call its exports instead.',
};

/**
 * 2026-10-11. React Native's `<StatusBar>` flushes `hidden: false` and
 * `translucent: false` on its first render, and in Expo Go, where React
 * Native's edge-to-edge flag is off, that takes the window out of edge to edge
 * on Android 11 to 14: a pale strip under the tab bar, and every native sheet
 * frozen waiting for insets the window swallowed. `status-bar-style.tsx` sets
 * the icon colour without it, and is the one file allowed a `StatusBar`.
 */
const STATUS_BAR_ONLY_IN_ONE_FILE = [
  {
    name: 'expo-status-bar',
    message:
      'Only src/components/status-bar-style.tsx may touch the status bar: render <StatusBarStyle>. A <StatusBar> on Android takes Expo Go out of edge to edge (2026-10-11).',
  },
];

/**
 * The same rule for React Native's own `StatusBar`. A syntax selector rather
 * than `importNames`, because `importNames` also refuses every
 * `import * as ReactNative from 'react-native'`, and one file has a reason for
 * that (`trip-platform.ts`, the deprecated `Clipboard` read on use).
 */
const NO_REACT_NATIVE_STATUS_BAR = {
  selector:
    "ImportDeclaration[source.value='react-native'] > ImportSpecifier[imported.name='StatusBar']",
  message:
    "Never React Native's StatusBar: render <StatusBarStyle> from src/components/status-bar-style.tsx. On Android it takes Expo Go out of edge to edge (2026-10-11).",
};

/**
 * 2026-10-11. react-native-screens' Android `formSheet` froze the app in Expo
 * Go, so every sheet route takes its options from `sheetRouteOptions` in
 * `src/components/sheet-route.tsx`, which gives Android the app's own sheet.
 * A route that names a presentation itself could bring the native sheet back
 * to Android, and `transparentModal` is how the frame recognises a sheet, so
 * both words are refused outside that file. Comments are not code and may use
 * them freely.
 */
const SHEET_PRESENTATION_ONLY_IN_THE_HELPER = ['formSheet', 'transparentModal'].map((word) => ({
  selector: `Literal[value='${word}']`,
  message: `Only src/components/sheet-route.tsx may name '${word}'. Register a sheet with sheetRouteOptions(size) (2026-10-11).`,
}));

export default [
  { ignores: ['node_modules/**', '.expo/**', 'expo-env.d.ts', 'babel.config.js', 'metro.config.js'] },
  {
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    // Parse only, no type-aware program: the rule reads the file name, so
    // loading a full TypeScript program here would cost seconds for nothing.
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { injishi },
    rules: {
      // code-standards.md, Naming. One convention for every source file.
      'injishi/kebab-case-filenames': 'error',

      // ADR-012 AC-4. This app imports `@injishi/contracts` in dozens of files,
      // and a phone is as much a client as a browser: resolving a permission
      // from a role here (`can`, `permissionsForRole`) would be the app
      // inventing an authorization answer the server never gave. Capability
      // comes from `/me/workspaces`, as it does on web.
      'injishi/no-client-authz': 'error',

      // ADR-034 task 5. The two design rules that have a React Native shape.
      //
      // `no-arbitrary-width` and `ground-foreground-agreement` are NOT wired
      // here and that is deliberate rather than an omission: both read Tailwind
      // class names, and this app has none. A rule with nothing to check is a
      // rule nobody has proven, which is the same reason
      // `require-permission-on-guarded-route` waited for its first guarded
      // command.
      //
      // The type rule is what the `Text` API change bought. Before it, `size`
      // took a number and defaulted to 15 — not a step on the app's own scale —
      // and 757 call sites had typed one. There was no name to refuse a number
      // in favour of, so there was nothing for a rule to say.
      'injishi/no-arbitrary-type-scale': ['error', { web: false }],

      // Colour, the RN shape: a hex literal is the mobile form of a raw colour
      // class. Two directories are exempt and each earns it at its own
      // declaration — `src/theme/` holds the generated palette and the
      // photographic scrims (a photograph does not invert, so a scrim over one
      // is a FIXED ground and owes fixed foregrounds), and `src/data/photos.ts`
      // holds each photograph's own average colour, sampled at import. That
      // last one is data: it is derived from the image and could not come from
      // the palette if it tried.
      'injishi/no-raw-color-classes': [
        'error',
        { classes: false, allowHexIn: ['/src/theme/', '/src/data/photos.ts'] },
      ],

      // Two modules with exactly one importer each; the reasons are above.
      'no-restricted-imports': [
        'error',
        { paths: [SENTRY_ONLY_IN_THE_REPORTER, ...STATUS_BAR_ONLY_IN_ONE_FILE] },
      ],
      'no-restricted-syntax': [
        'error',
        NO_REACT_NATIVE_STATUS_BAR,
        ...SHEET_PRESENTATION_ONLY_IN_THE_HELPER,
      ],
    },
  },
  {
    // The Sentry SDK's one importer, and its tests, which read the SDK's types.
    files: ['src/lib/crash-reporter.ts', 'src/lib/crash-reporter.test.ts'],
    rules: { 'no-restricted-imports': ['error', { paths: STATUS_BAR_ONLY_IN_ONE_FILE }] },
  },
  {
    // The status bar's one importer, and its test.
    files: ['src/components/status-bar-style.tsx', 'src/components/status-bar-style.test.tsx'],
    rules: {
      'no-restricted-imports': ['error', { paths: [SENTRY_ONLY_IN_THE_REPORTER] }],
      'no-restricted-syntax': ['error', ...SHEET_PRESENTATION_ONLY_IN_THE_HELPER],
    },
  },
  {
    // The one file that names a sheet presentation, and its test.
    files: ['src/components/sheet-route.tsx', 'src/components/sheet-route.test.tsx'],
    rules: { 'no-restricted-syntax': ['error', NO_REACT_NATIVE_STATUS_BAR] },
  },
];
