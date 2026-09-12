# shared/auth

Better Auth 1.6 wiring for F-S01. What is built today:

- `session.guard.ts` holds `SessionGuard`, which resolves the Better Auth session
  from the request cookies and attaches the user, plus the `@CurrentUser()` param
  decorator that reads it back. Never hand roll a session check that bypasses the
  guard.
- The instance itself is built in `modules/auth/auth.module.ts` from
  `@injishi/auth` (`createAuth`): email OTP plus Google, Drizzle adapter,
  `generateId: false` so Postgres `gen_random_uuid()` fills the uuid keys.
- Mounted at `/api/auth` (VERSION_NEUTRAL, outside `/api/v1`).

Specified but NOT built: guards for active workspace scope, approval state and
permissions. `SessionGuard` answers "is this request signed in" and nothing more,
so do not write a route that assumes a scope or permission check already ran.
See `injishi.context/dox/progress-tracker.md` for what exists.
