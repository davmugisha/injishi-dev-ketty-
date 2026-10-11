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
            // `/api/v1/ops/my-hr/*` (HR self-service, first pass — no ADR yet).
            // An employee reading their OWN leave, tasks and payslips, and
            // asking for their own leave. There is no power to name: the
            // permission would have to be granted to every role. The check
            // that replaces it is that no route takes an employee id — "me" is
            // the session's user — so the only record reachable is the
            // caller's. `setMyTaskDone` and `withdrawLeave` take a task or
            // request id, and match it against the caller's own records before
            // changing anything. Deciding a
            // request and reading anyone else's record stay behind
            // `employee.manage` / `team.manage`.
            'OpsMyHrController.overview',
            'OpsMyHrController.myLeave',
            'OpsMyHrController.requestLeave',
            'OpsMyHrController.withdrawLeave',
            'OpsMyHrController.myTasks',
            'OpsMyHrController.setMyTaskDone',
            'OpsMyHrController.myPayslips',
            // A payslip id is matched against the caller's own payslips before
            // a page is drawn; anybody else's answers 404.
            'OpsMyHrController.myPayslipPdf',
            // Their own clock: reading it, and clocking in and out. Neither
            // write takes a body, so there is no id to point at anybody else.
            'OpsMyHrController.myTime',
            'OpsMyHrController.clockIn',
            'OpsMyHrController.clockOut',
          ],
        },
      ],
    },
  },
);
