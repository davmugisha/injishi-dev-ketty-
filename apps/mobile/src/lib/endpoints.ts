/**
 * Every API path this app asks for, declared once.
 *
 * ## Why a registry rather than a string at each call site
 *
 * A path typed inline is a path nothing checks. It compiles, it ships, and it
 * 404s on a device — which surfaces as `refused` with the server's own "Cannot
 * GET" body, on whichever screen happened to need it. Nothing in a typecheck, a
 * test or a lint run has any opinion about the spelling.
 *
 * So `api()` takes an `ApiPath` and nothing else, and `apiPath()` is the only
 * thing that mints one. A screen cannot invent a URL; it has to add it here,
 * where the whole set is readable in one screen and can be checked against the
 * API's declared route table in one pass.
 *
 * That check is a gate rather than a habit: `.unlazy/admin-live/verify/seam.mjs`
 * reads the API's controllers for the routes it declares, reads THIS file for
 * the paths the app asks for, and fails when one does not resolve to the other.
 * It can only read literals it can see, and a literal passed as the first
 * argument of a call is precisely what it sees — which is the second reason the
 * declarations below are written as `apiPath('/…')` calls rather than as bare
 * assignments.
 *
 * ## What is NOT here
 *
 * Better Auth's own routes. They are mounted at `/api/auth`, BEFORE the
 * `/api/v1` global prefix (see `AUTH_BASE` in `./env`), so they are not paths
 * under this base and an `ApiPath` would be the wrong type for one. `lib/auth.ts`
 * owns those three, and owns them alone.
 */

/**
 * A path this app is allowed to ask for.
 *
 * Branded, so a plain string is not one. The brand costs a cast in exactly one
 * place — `apiPath()` below — and buys the guarantee that every URL the app
 * requests appears in this file.
 */
export type ApiPath = string & { readonly __apiPath: unique symbol };

/**
 * Mint one. The template type refuses a path with no leading slash, which
 * `api()` would otherwise join into `…/api/v1me/workspaces`.
 */
function apiPath(path: `/${string}`): ApiPath {
  return path as ApiPath;
}

/**
 * The paths, grouped the way the API mounts them.
 *
 * Each one was checked against the route table on the day it was added; the
 * seam gate is what keeps that true afterwards. A `:p` in a comment marks where
 * a caller interpolates an id.
 */
export const ENDPOINTS = {
  /* -- Person scoped. `api.ts` sends no `x-workspace-id` on anything under
        `/me/`, because `WorkspaceGuard` does not run on these. -------------- */

  /** `GET` — the seats this person holds, plus the step-up state. */
  meWorkspaces: apiPath('/me/workspaces'),
  /** `POST` — record which seat this session is acting in. */
  meActiveWorkspace: apiPath('/me/active-workspace'),
  /** `GET` — the caller's own Step 1 answers. `PUT` is deliberately not used;
   *  see `screens/account/personal-details.tsx` for why. */
  meProfile: apiPath('/me/profile'),
  /** `GET` — whether the emailed step-up is owed and whether it is satisfied. */
  meTwoFactor: apiPath('/me/two-factor'),
  /** `POST` — send the step-up code. */
  meTwoFactorSend: apiPath('/me/two-factor/send'),
  /** `POST` — verify it. */
  meTwoFactorVerify: apiPath('/me/two-factor/verify'),
  /** `GET` — every outlet this guest may order from right now, with its live
   *  menu, resolved on the server from their open stays (ADR-050 D-o). */
  meOrderable: apiPath('/me/orderable'),
  /** `POST` — place an order charged to the room. Needs an `Idempotency-Key`. */
  meOrders: apiPath('/me/orders'),
  /** `POST` — the guest's own check-in before arrival for booking `:p`: the
   *  document, the key of the ID photo uploaded first, and an address (ADR-060). */
  meBookingCheckIn: (bookingId: string) =>
    apiPath(`/me/bookings/${encodeURIComponent(bookingId)}/check-in`),

  /** `GET` — which platform the API is: demo or production, sample data, last
   *  reset (ADR-043). Public; the app's one demo signal, see `queries/platform.ts`. */
  platform: apiPath('/platform'),

  /* -- The demo host, and only the demo host. 404 elsewhere, which is an
        ANSWER rather than a fault — see `queries/demo.ts`. ----------------- */

  /** `GET` — the seeded roster the sign-in screen offers a presenter. */
  demoPersonas: apiPath('/demo/personas'),

  /* -- Workspace scoped. `api.ts` attaches `x-workspace-id` from the active
        workspace, never from a call site. --------------------------------- */

  /** `GET` — every rent charge on the active workspace. */
  opsRentRoll: apiPath('/ops/rent-roll'),
  /** `POST` — record rent received for one named month of lease `:p`. Needs a
   *  UUID `Idempotency-Key` and the `rent.record` permission. */
  opsLeaseRent: (leaseId: string) =>
    apiPath(`/ops/leases/${encodeURIComponent(leaseId)}/rent`),

  /* -- The support assistant (ADR-061). Signed in or out; `api.ts` sends the
        workspace header when one is active, so the API resolves the same
        grant the screens act under, and the assistant headers when asked. -- */

  /** `GET` — the open conversation on this surface, and whether it is on. */
  assistantCurrent: apiPath('/assistant/conversations/current?surface=mobile'),
  /** `POST` — one turn. */
  assistantMessages: apiPath('/assistant/messages'),
  /** `POST` — attach a signed out conversation to the account, with consent. */
  assistantClaim: apiPath('/assistant/conversations/claim'),
  /** `POST` — send the conversation to Injishi support. */
  assistantEscalations: apiPath('/assistant/escalations'),
  /** `POST` — helpful or not, once, on answer `:p`. */
  assistantFeedback: (messageId: string) =>
    apiPath(`/assistant/messages/${encodeURIComponent(messageId)}/feedback`),
  /** `POST` — approve or reject prepared change `:p`. Approve needs a UUID
   *  `Idempotency-Key` and `listing.manage`. */
  assistantDecide: (proposalId: string, decision: 'approve' | 'reject') =>
    apiPath(`/assistant/actions/${encodeURIComponent(proposalId)}/${decision}`),

  /* -- Uploads. Multipart, so `api.ts` sets no Content-Type. --------------- */

  /** `POST` — one attachment, answering with the object key to reference. */
  uploads: apiPath('/uploads'),
} as const;
