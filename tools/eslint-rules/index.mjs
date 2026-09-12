/**
 * The `injishi` ESLint plugin: the rules that make a standard load bearing.
 *
 * A standard nobody can break by accident is worth more than a standard
 * everybody agrees with. These rules exist because the failures they catch are
 * silent ones — a route with a guard and no permission still returns 200, and a
 * client that resolves a role still renders a button. Neither looks wrong in
 * review.
 *
 * Deliberately a plain flat-config plugin object imported by relative path
 * rather than a published package. It has no build step and no version to keep
 * in step, and every consumer lives in this repo.
 *
 * `require-permission-on-guarded-route` landed with the first guarded command
 * (ADR-012, build plan step 2), because a rule with nothing to check yet is a
 * rule nobody has proven.
 *
 * `kebab-case-filenames` landed with the rename that made it true. The repo
 * carried two naming conventions for as long as nothing checked, and a
 * case-only difference is invisible on Windows and fatal on Linux CI — the
 * exact class of silent failure the other two rules exist for.
 *
 * `no-duplicate-shared-component` landed with ADR-036, for the same reason and
 * with the receipt to prove it: three copies of `button.tsx` existed, the
 * package's copy carried a fix for a HeroUI trap, and `apps/web`'s copy still
 * had the bug live on the sign in screen. The rule against it was already
 * written down in AGENTS.md and had been broken three times, which is the
 * argument for checking rather than agreeing.
 * The four DESIGN rules landed with ADR-034 task 5, and their history is worth
 * a paragraph because it is the reason the design system felt weaker than its
 * documents claimed. `ui-rules.md` and `progress-tracker.md` both stated that
 * this directory carried seven rules and that `apps/web` failed the build on a
 * raw colour class, a hand-typed type size, an unnamed page width and a
 * ground/foreground disagreement. It carried three. The other four were written
 * against ADR-027 and ADR-028 in the `injishi.managed` repo and never crossed
 * the mirror, so this checkout had the rules as PROSE and none of them as build
 * failures — and `apps/app/eslint.config.mjs` had to unwire
 * `ground-foreground-agreement` entirely, because ESLint aborts the whole run
 * on a rule it cannot find, which meant `no-client-authz` beside it was never
 * enforced on that app either.
 *
 * They are rewritten here from their ADRs, and they reach `apps/mobile` for the
 * first time. React Native has no class names, so two of them carry a
 * second, RN-shaped half: a hex literal in a `StyleSheet` is the mobile form of
 * a raw colour class, and a numeric `fontSize` is the mobile form of
 * `text-[13px]`.
 *
 * `no-arbitrary-motion` landed with ADR-046, which added the product's first
 * motion scale and recorded in its own Negative consequences that the
 * vocabulary was shipping with nothing behind it — the exact order ADR-027
 * followed, and the exact debt that left 163 hand-typed sizes on disk a month
 * after they were "enforced". It is `warn` wherever it is wired: a warn is a
 * count, not a pardon (the ADR-037 idiom), and it flips to `error` when the
 * count reaches zero.
 */

import groundForegroundAgreement from './ground-foreground-agreement.mjs';
import kebabCaseFilenames from './kebab-case-filenames.mjs';
import noArbitraryMotion from './no-arbitrary-motion.mjs';
import noArbitraryTypeScale from './no-arbitrary-type-scale.mjs';
import noArbitraryWidth from './no-arbitrary-width.mjs';
import noClientAuthz from './no-client-authz.mjs';
import noDuplicateSharedComponent from './no-duplicate-shared-component.mjs';
import noRawColorClasses from './no-raw-color-classes.mjs';
import requirePermissionOnGuardedRoute from './require-permission-on-guarded-route.mjs';
import { surfaceVocabulary, surfaceRefusals } from './surface-vocabulary.mjs';

/** @type {import('eslint').ESLint.Plugin} */
const plugin = {
  meta: { name: 'injishi', version: '0.6.0' },
  rules: {
    'ground-foreground-agreement': groundForegroundAgreement,
    'kebab-case-filenames': kebabCaseFilenames,
    'no-arbitrary-motion': noArbitraryMotion,
    'no-arbitrary-type-scale': noArbitraryTypeScale,
    'no-arbitrary-width': noArbitraryWidth,
    'no-client-authz': noClientAuthz,
    'no-duplicate-shared-component': noDuplicateSharedComponent,
    'no-raw-color-classes': noRawColorClasses,
    'require-permission-on-guarded-route': requirePermissionOnGuardedRoute,
    'surface-vocabulary': surfaceVocabulary,
    'surface-refusals': surfaceRefusals,
  },
};

export default plugin;
