import next from '@next/eslint-plugin-next';
import tsParser from '@typescript-eslint/parser';

import injishi from '../../tools/eslint-rules/index.mjs';

/**
 * Lint for the staff console.
 *
 * This app had NO ESLint config and no `lint` script at all, which
 * `ui-rules.md` recorded as a known hole ("`apps/admin` has no ESLint config")
 * and nothing closed. It was also absent from the root `build` filter, so the
 * console was the least checked surface in the product while holding the most
 * sensitive one.
 *
 * Two rules worth a word, because each was once left soft here:
 *
 *   - `no-client-authz` is ON. This app imports `@injishi/contracts` and
 *     renders staff capability, so the ban has to hold here or it only half
 *     exists (ADR-012, AC-4 says "no client", not "not PMS").
 *   - `no-duplicate-shared-component` is an ERROR since 2026-09-11. It was a
 *     warn while ADR-040 moved this app onto `@injishi/ui` one component at a
 *     time; `components/ui/` is gone now (the admin child's step 11), so a
 *     local copy of a shared component is a build failure here too.
 *
 * Every design rule now runs at error. The legacy class vocabulary and the
 * stock corners and widths this console was written in are gone (ADR-040), so
 * nothing here is held at warn any more.
 */
export default [
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'public/**'] },
  {
    // The Next rule set is registered but not run, so this config cannot
    // honestly judge whether a `@next/next/...` disable comment is still
    // needed. Same stance as `apps/web`.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { injishi, '@next/next': next },
    rules: {
      'injishi/kebab-case-filenames': 'error',
      'injishi/no-client-authz': 'error',

      // ADR-040 call 7. `components/ui/` is gone, so this holds at error.
      'injishi/no-duplicate-shared-component': 'error',

      // ADR-027 section 8 and ADR-028 section 6, set from what the FIRST run of
      // this config actually measured rather than from what was hoped. The
      // console had never been linted, so the numbers were unknown until now.
      //
      // At error, because each is genuinely at zero after this change:
      //   no-raw-color-classes    1 site, fixed in place. It was not a Tailwind
      //                           ramp class or a hex literal (there are none in
      //                           this app) but a raw ramp VARIABLE inside an
      //                           inline gradient, which the same rule catches.
      //                           It carries a documented disable in topbar.tsx
      //                           and is the one open question for the design
      //                           system owner: a gradient needs two ramp steps
      //                           and no semantic role offers one.
      //   no-arbitrary-type-scale 2 sites, both `text-[10px]` -> `text-2xs`.
      //   ground-foreground       0 sites. Clean on the first run.
      'injishi/no-raw-color-classes': 'error',
      'injishi/no-arbitrary-type-scale': ['error', { mobile: false }],
      'injishi/ground-foreground-agreement': 'error',

      // ADR-037 call 7, ratcheted by ADR-040 call 7: each flipped to error the
      // day its own count reached zero ("the warn is a count, not a pardon").
      // All three are at zero since 2026-09-11 (the admin child's phase 4):
      //   surface-refusals    36, then 5, then 0 when `.badge` was deleted.
      //   surface-vocabulary  138 -> 0. Every deleted corner became `rounded`
      //                       for a control, `rounded-card` for a surface or
      //                       `rounded-full` for a pill.
      //   no-arbitrary-width  71 -> 0. Stock steps took ADR-027's absorb table
      //                       (`2xl` read, `3xl` wide, `7xl` page). The one
      //                       bracket width, a line of prose in the override
      //                       dialog, is a reading measure (`ch`), not a page
      //                       width, which the rule leaves legal on purpose.
      'injishi/no-arbitrary-width': 'error',
      'injishi/surface-vocabulary': 'error',
      'injishi/surface-refusals': 'error',

      // ADR-046, the motion scale. `error` on the day it was wired, which only
      // this console could manage: it barely moves, so the count was ONE — the
      // sidebar's `duration-200` width transition, now `duration-quick`.
      'injishi/no-arbitrary-motion': ['error', { mobile: false }],
    },
  },
];
