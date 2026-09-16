/**
 * Operator authorization, as the operator app sees it.
 *
 * The model itself is NOT here. It lives in `@injishi/contracts` (`authz.ts`)
 * and the API enforces it server side (Spec 0002). This file is a thin bridge
 * so the app words a refusal from the same table the server refuses from, and
 * can never drift from it again.
 *
 * It used to hold its own copy of 21 permissions and 4 roles. That copy was the
 * problem: the app and the server could disagree about what a role may do, and
 * the app's answer was the only one anything checked.
 *
 * **`can` and `permissionsForRole` are deliberately NOT re-exported** (ADR-012,
 * AC-4). Resolving a permission from a role in the browser is the thing this
 * app stopped doing. Capability comes from the server resolved array on
 * `GET /api/v1/me/workspaces`: `permissionsOf` in `store/helpers.ts` for the
 * reducer, `useCapability` in `data/capability.ts` for a screen. The
 * `no-client-authz` lint rule fails the build on an import of either, so this
 * is enforced rather than remembered.
 *
 * What stays, and why: `PERMISSION_LABEL` and `REGISTRATION_STAGE_MESSAGE` are
 * wording, not decisions — they say what a refusal MEANS after the array has
 * already said no. `isOperational` is the predicate that tells the two kinds of
 * refusal apart. None of the three can grant anything.
 *
 * **`permissionsForWorkspace` is re-exported and NOTHING CALLS IT — keep it that
 * way** (ADR-055). Since a business can move a permission on or off its own
 * roles, that function only gives the right answer when it is handed the
 * business's overrides, and a screen has no way to know them: the server has
 * already resolved the array and put it on the grant. A component that called
 * this with a role and a status would quietly disagree with the API for exactly
 * the businesses that had customised anything. Read the grant.
 *
 * Two things still worth stating about how this app uses the model:
 *
 *  - PERMISSIONS are enforced at the one choke point that matters here, the
 *    store reducer, which refuses an unpermitted mutation even if the button
 *    was reached some other way. That is a product correctness control: it runs
 *    in the browser. The security boundary is the API's `WorkspaceGuard`.
 *
 *  - SCREEN ACCESS has ONE mechanism: `navFor` in `lib/nav.ts`. `AppShell`
 *    derives the allowed screens from the nav a role actually gets, and refuses
 *    a direct URL that is not in it. A second, parallel `SCREEN_PERMISSION` map
 *    used to sit here and was called by nothing; it is gone (Spec 0002, D-e).
 *    Do not add a third.
 */

export {
  isOperational,
  permissionsForWorkspace,
  workspaceAllows,
  PERMISSION_LABEL,
  REGISTRATION_STAGE_MESSAGE,
} from "@injishi/contracts";

export type { OrgRegistrationStatus, Permission, OrgRole } from "@injishi/contracts";
