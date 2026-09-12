/**
 * Kept as a re-export so the two frozen route files that import `Leases` —
 * `app/(tabs)/index.tsx` (the home tab of every surface) and
 * `app/(tabs)/leases.tsx` — keep resolving without being edited.
 *
 * The screen itself is Session 7's and lives with the rest of the tenant seat
 * in `./tenant/leases`. Session 11 can collapse this file once it is free to
 * touch the tab files again.
 */
export { Leases } from './tenant/leases';
