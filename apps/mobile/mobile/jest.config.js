/**
 * Jest for the Expo app (ADR-031 child "the test strategy").
 *
 * `jest-expo` is Expo's own preset and carries the transform pipeline, the
 * module mapping and the native module mocks a React Native codebase needs.
 * Almost everything here comes from it; the three overrides below are the parts
 * this repo's shape makes necessary.
 *
 * **transformIgnorePatterns** is the one to understand before changing. Jest
 * does not transform `node_modules`, but React Native packages ship
 * untranspiled source, so the preset supplies an allow-list of scopes to let
 * through. This starts from the preset's own list rather than replacing it,
 * because jest overwrites this key instead of merging it — write it from
 * scratch and you silently drop `expo`, `react-native` and the rest. Two
 * additions:
 *
 *   - `.pnpm`, already in the preset's list, is what makes pnpm's real layout
 *     (`node_modules/.pnpm/<name>@<version>/node_modules/<name>`) resolvable at
 *     all. Keep it first.
 *   - `@shopify` is ours: FlashList ships untranspiled and is not in the
 *     preset's list.
 *   - `standard-navigation` is ours too, and arrived with SDK 57: expo-router
 *     57 re-exports it from `src/exports.ts`, it ships untranspiled ESM, and
 *     the preset does not list it. Without it every suite that reaches
 *     expo-router dies on `Cannot use import statement outside a module`.
 *
 * `.mjs` is transformed too, which the preset's `\.[jt]sx?$` pattern does not
 * cover. The palette generator's colour maths lives in `scripts/color-math.mjs`
 * and the palette test imports it directly; without this every test importing
 * it dies on an `import` statement.
 */
const os = require('node:os');

/**
 * How many workers this machine can hold, by memory rather than by core count.
 * See the `maxWorkers` note below for why that distinction is the whole fix.
 *
 * `GB_PER_WORKER` is measured, not guessed: a `jest-expo` worker carrying a
 * React Native runtime across a 75-suite run sits above 1GB and grows, so 1.2
 * is the working figure with a little room in it.
 *
 * `BUDGET` is the share of TOTAL memory the run may claim. Total, not free:
 * free memory is whatever the editor and the browser happen to be holding at
 * the moment jest starts, so deriving from it would make the worker count — and
 * therefore which tests pass — vary run to run. A gate cannot be built on that.
 * 0.4 leaves the rest of the machine the majority, which is the right default
 * for a suite that runs on a working laptop rather than a dedicated runner.
 */
function workerCount() {
  const GB_PER_WORKER = 1.2;
  const BUDGET = 0.4;
  const byMemory = Math.floor((os.totalmem() / 1024 ** 3) * BUDGET / GB_PER_WORKER);
  const byCores = Math.floor(os.cpus().length / 2);
  return Math.max(1, Math.min(byCores, byMemory));
}

module.exports = {
  preset: 'jest-expo',

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'json', 'node'],

  // Layers react-native-worklets' resolver onto the preset's. See jest.resolver.js.
  resolver: '<rootDir>/jest.resolver.js',

  // Appended to the preset's own setup files, not a replacement for them.
  setupFiles: ['<rootDir>/jest.setup.js'],

  // The `@/*` path alias from tsconfig.json. Jest does not read tsconfig.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  transform: {
    // Merged into the preset's transforms, not a replacement for them.
    '^.+\.mjs$': [
      'babel-jest',
      { caller: { name: 'metro', bundler: 'metro', platform: 'ios' } },
    ],
  },

  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|@shopify|standard-navigation))',
    '/node_modules/react-native-reanimated/plugin/',
  ],

  /**
   * Jest's 5s default is not enough for the screen-level suites on SDK 57.
   * These tests mount a whole route and wait on its data, and React Native
   * 0.86 with React 19.2 renders slowly enough under a full parallel run that
   * suites which pass comfortably in isolation were timing out rather than
   * failing an assertion. The ceiling only bounds a hang; it does not slow a
   * passing test down.
   *
   * **THE INVARIANT: this must exceed the worst-case SUM of the `waitFor` caps
   * a single test can spend in sequence, not the largest one.** Session 11
   * raised two suites' caps to 15s each — `COLD` in `host-screens.test.tsx`,
   * `GONE` in `saved.test.tsx` — and left this at 20s, which quietly made those
   * caps unreachable. Three tests spend two of them back to back:
   * `host-screens` "groups the day into the four things a desk works" (the
   * `open()` helper waits once, then the group heading waits again),
   * `host-screens` "offers checkout for a stay in progress…" (two `open()`
   * calls), and `saved` "puts it back through the same store when undo is
   * pressed" (a remove wait, then an undo wait). Each is allowed 30s of
   * waiting inside a 20s test, so on a slow run jest killed the TEST at 20s and
   * reported `Exceeded timeout of 20000 ms` — an error that names this number
   * and not the 15s cap that looks like the budget. It presented as one
   * intermittently failing test out of 1735.
   *
   * 60s is 2 × 15s with headroom for the mount and render work between them.
   * Raising a `waitFor` cap in any suite means checking that sum again.
   */
  testTimeout: 60000,

  /**
   * **Session 11's audit found this.** Two suites failed a full `pnpm test` and
   * passed in isolation — `saved` at 93s against 29s alone, `host-screens` at
   * 2203s against 17s — and the assertions they failed were `waitFor` caps, not
   * anything about the screens. That signature is memory, not logic.
   *
   * Jest defaults to one worker per core minus one, and a `jest-expo` worker
   * mounts a whole React Native runtime. On a 22-core machine that is 21 of
   * them against 17GB, so the box swaps and every suite slows by the same
   * factor at once. Capping at half the cores keeps the total resident set
   * inside real memory; the wall clock for the whole run goes DOWN rather than
   * up, because a swapping worker is slower than no worker.
   *
   * **Session 12 finished the thought.** The diagnosis above is right and the
   * implementation did not follow from it: the constraint is stated in MEMORY
   * and was then enforced in CORES. Those only track each other when a machine
   * has RAM in proportion to its cores, and this one does not — 22 cores
   * against 16.5GB is 0.75GB per core, while a `jest-expo` worker mounting a
   * React Native runtime settles well above 1GB. `50%` therefore asked for 11
   * workers needing ~12GB on a box that had 3GB free, and the suite went on
   * failing intermittently: one test in 1735, in whichever of `host-screens` or
   * `saved` lost the race, never the same one twice.
   *
   * So the worker count is derived from MEMORY, with cores as a ceiling rather
   * than as the measure. It still travels — better than a ratio does, because a
   * CI container with 8GB and 16 cores gets a count that fits its RAM instead of
   * a count that fits its core list.
   *
   * Measured here, full suite, 75 suites and 1735 tests:
   *   11 workers (the old `50%`)  ~90s, and intermittently red
   *    4 workers                   169s, green, slowest suite 67s against 102s
   *
   * The old setting is faster when it fits and unreliable when it does not, and
   * a gate that is usually green is not a gate. The wall clock is the price.
   */
  maxWorkers: workerCount(),

  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
};
