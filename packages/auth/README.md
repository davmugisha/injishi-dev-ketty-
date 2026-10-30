# @injishi/auth

The one Better Auth setup the API, web and the app share: email code sign-in
(codes stored hashed), Google, the OTP send budget and the session cookie names.

- `src/` is the source. Consumers read the compiled `dist/`, which is committed:
  after editing `src/`, run `pnpm --filter @injishi/auth build` and commit both.
  A rebuild that changes only line endings in `dist/` is not a change; revert it.
- Entry points: `./server` (`createAuth`, used by
  `server/api/src/modules/auth/auth.module.ts`), `./client` (the browser client
  and the OTP constants), `./edge` (cookie helpers for web's and the app's
  `proxy.ts`) and `.`, which re-exports the server code too, so a client
  component imports `./client`, never `.`.
- Tests: `pnpm --filter @injishi/auth test` (`tests/*.test.mjs`, against `dist/`).

It was a build-output mirror of another repository once (ADR-034); that
repository is gone and this directory is the only copy.
