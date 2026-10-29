# shared/auth

The API's access boundary. Better Auth 1.6 signs people in (email code, Google);
the guards here decide what each request may do. Checks in web and the app are
routing only; this is where a refusal is real.

- `session.guard.ts`: `SessionGuard` resolves the session from the request
  cookies and attaches the user. `@CurrentUser()` reads it back and throws when
  a route forgot the guard. Never hand roll a session check around it.
- `workspace.guard.ts`: `WorkspaceGuard` refuses a request that names a
  workspace the caller does not hold, or lacks the permission the route
  declares (`@RequirePermission`, `@RequireAnyPermission`,
  `@RequireEveryBranch`). Always after the session guard:
  `@UseGuards(SessionGuard, WorkspaceGuard)`.
- `staff.guard.ts` and `require-staff-permission.decorator.ts`: platform staff
  routes (the app's `/admin` console).
- `oversight.guard.ts`: `@RequireOversight`, the government oversight console.
- `two-factor.service.ts`: the emailed step-up some roles owe before guarded
  calls. An email code sign-in counts as stepped up already.
- `assert-owned.ts`, `assert-mine.ts`, `branch-scope.ts`: row checks inside a
  service, for rows a guard cannot see. They answer 404, never 403.

The Better Auth instance is built in `modules/auth/auth.module.ts` from
`@injishi/auth` (`createAuth`) and mounted at `/api/auth`, outside `/api/v1`.
Permissions are defined once in `@injishi/contracts` (`src/authz.ts`), which the
API and the apps both import.
