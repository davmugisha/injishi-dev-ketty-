/**
 * Where the API is, for the admin console.
 *
 * One owner for one fact. `middleware.ts` and `lib/sign-in-url.ts` each already
 * read a `NEXT_PUBLIC_*` origin for themselves, and a console that verifies a
 * cookie against one deployment while reading data from another refuses
 * everybody for a reason nobody can see.
 *
 * The read stays in app source rather than moving into a package, for the
 * reason `lib/sign-in-url.ts` records: `NEXT_PUBLIC_*` is inlined by the app's
 * own bundler, and a read buried in prebuilt package output is a read the
 * replacement may never reach.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
