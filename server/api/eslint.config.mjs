import tseslint from 'typescript-eslint';

import injishi from '../../tools/eslint-rules/index.mjs';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        { allowExpressions: true },
      ],
    },
  },
  {
    files: ['src/**/*.ts'],
    plugins: { injishi },
    rules: {
      /**
       * ADR-012, AC-1. A mutating route behind `WorkspaceGuard` or
       * `StaffGuard` must say which power it needs, or every member
       * of the workspace may run it — a housekeeper approving a booking looks
       * exactly like a correct route in review.
       *
       * The allowlist holds the exceptions the ADR names, and only those. Each
       * one has to be typed here, where a reviewer sees it, so a fifth cannot
       * appear by accident.
       */
      'injishi/require-permission-on-guarded-route': [
        'error',
        {
          allow: [
            // `POST /api/v1/me/active-workspace`. The guard IS the whole check
            // here: switching into a workspace needs only that you hold it,
            // and there is no power to name. Demanding a permission would mean
            // inventing one that grants nothing.
            'MeController.setActiveWorkspace',
            // Every route of `/api/v1/ops/broker` (ADR-038 child 6): the two
            // commands `POST .../:listingId/reveal` and `.../placements`, and
            // the four reads beside them.
            //
            // `permissionsForWorkspace` returns an EMPTY array for any
            // workspace whose kind is not `business`, and a broker workspace is
            // kind `broker`. So there is no permission that a broker holds:
            // declaring any would refuse the one person the route exists for.
            // The workspace has a single holder, and `BrokerService` refuses
            // anything that is not an active broker's own workspace, which is
            // the whole check.
            //
            // The reads are listed because audit H1 extended this rule from
            // mutations to every verb; before that they needed no entry.
            'OpsBrokerController.reveal',
            'OpsBrokerController.startPlacement',
            'OpsBrokerController.directory',
            'OpsBrokerController.credits',
            'OpsBrokerController.placements',
            'OpsBrokerController.earnings',
          ],
        },
      ],
    },
  },
);
